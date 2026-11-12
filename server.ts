import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para exibir no terminal todas as requisições que chegam
app.use((req, _res, next) => {
  console.log(`[HTTP ${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'deterministic', time: new Date().toISOString() });
});

// Helper para encontrar o caminho correto do script Python
function getPythonScriptPath(): string {
  const p1 = path.resolve(__dirname, 'scripts', 'process_score.py');
  if (fsSync.existsSync(p1)) return p1;
  return path.resolve(__dirname, 'process_score.py');
}

// 1. Rota para processar PDF via Audiveris (OMR) + Python
app.post('/api/process-pdf', async (req, res) => {
  const { pdfBase64, fileName, instrument } = req.body;

  if (!pdfBase64 || !instrument) {
    return res.status(400).json({ error: 'Faltam parâmetros (pdfBase64 ou instrument)' });
  }

  const tempDir = path.join(os.tmpdir(), `omr_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const pdfPath = path.join(tempDir, 'input.pdf');
  await fs.writeFile(pdfPath, Buffer.from(pdfBase64, 'base64'));

  console.log(`[OMR] Iniciando Audiveris para ${fileName || 'input.pdf'}...`);

  // Executa o Audiveris em modo headless
  const cmdAudiveris = `export JAVA_OPTS="-Xmx2G -Djava.awt.headless=true" && xvfb-run -a /opt/audiveris/bin/Audiveris -batch -export -output "${tempDir}" "${pdfPath}"`;

  exec(cmdAudiveris, { timeout: 300000 }, async (error, stdout, stderr) => {
    if (error) {
      console.error(`[Audiveris Error] ${error.message}`);
      console.error(`[Audiveris Stderr] ${stderr}`);
    }

    try {
      // Localiza o arquivo .mxl gerado pelo Audiveris
      const files = await fs.readdir(tempDir);
      const mxlFile = files.find(f => f.endsWith('.mxl') || f.endsWith('.xml'));

      if (!mxlFile) {
        console.error('[Audiveris] Nenhum arquivo MXL gerado.');
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        return res.status(500).json({ 
          error: 'Audiveris OMR não identificou pautas legíveis no PDF.',
          debugLogs: stderr || stdout 
        });
      }

      const mxlPath = path.join(tempDir, mxlFile);
      console.log(`[OMR] Sucesso. Arquivo gerado: ${mxlFile}. Enviando para o Python...`);

      // Executa o Python music21 para adicionar pistos e tom
      const pythonScript = getPythonScriptPath();
      const pythonBin = fsSync.existsSync('/opt/venv/bin/python') ? '/opt/venv/bin/python' : 'python3';
      const cmdPython = `"${pythonBin}" "${pythonScript}" "${mxlPath}" "${instrument}"`;

      exec(cmdPython, async (pyError, pyStdout, pyStderr) => {
        if (pyError) {
          console.error(`[Python Error] ${pyError.message}`);
          console.error(`[Python Stderr] ${pyStderr}`);
        }

        const processedPath = `${mxlPath}.processed.xml`;
        let processedXml = '';

        if (fsSync.existsSync(processedPath)) {
          processedXml = await fs.readFile(processedPath, 'utf-8');
        } else if (fsSync.existsSync(mxlPath)) {
          processedXml = await fs.readFile(mxlPath, 'utf-8');
        }

        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

        const keyMatch = pyStdout.match(/KEY:(.+)/);
        const detectedKey = keyMatch ? keyMatch[1].trim() : '';

        console.log(`[Concluído] Partitura processada. Tom: ${detectedKey}`);
        res.json({ processedXml, detectedKey, debugLogs: pyStderr || stderr });
      });

    } catch (err: any) {
      console.error(`[Erro Geral OMR] ${err.message}`);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      res.status(500).json({ error: 'Erro no pipeline de processamento do PDF.' });
    }
  });
});

// 2. Rota para processar XML/MXL diretamente via Python
app.post('/api/process-xml', async (req, res) => {
  const { xmlContent, instrument } = req.body;

  if (!xmlContent || !instrument) {
    return res.status(400).json({ error: 'Faltam parâmetros' });
  }

  try {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `temp_${Date.now()}.xml`);
    await fs.writeFile(tempFilePath, xmlContent, 'utf-8');

    const pythonScript = getPythonScriptPath();
    const pythonBin = fsSync.existsSync('/opt/venv/bin/python') ? '/opt/venv/bin/python' : 'python3';

    exec(`"${pythonBin}" "${pythonScript}" "${tempFilePath}" "${instrument}"`, async (error, stdout, stderr) => {
      await fs.unlink(tempFilePath).catch(() => {});

      if (error) {
        console.error(`[Python Error] ${error.message}`);
        return res.status(500).json({ error: 'Falha ao processar partitura no servidor.', debugLogs: stderr });
      }

      const processedFilePath = `${tempFilePath}.processed.xml`;
      try {
        const processedXml = await fs.readFile(processedFilePath, 'utf-8');
        await fs.unlink(processedFilePath).catch(() => {});

        const keyMatch = stdout.match(/KEY:(.+)/);
        const detectedKey = keyMatch ? keyMatch[1].trim() : '';

        res.json({ processedXml, detectedKey, debugLogs: stderr });
      } catch (readError) {
        res.status(500).json({ error: 'Falha ao ler o resultado do processamento.' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Dev vs Production static/Vite mounting
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`PartiturasWeb server rodando na porta ${PORT} (dev: ${!isProd})`);
  });
}

startServer();