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
const PORT = Number(process.env.PORT) || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, _res, next) => {
  console.log(`[HTTP ${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'deterministic', time: new Date().toISOString() });
});

function getPythonScriptPath(): string {
  const p1 = path.resolve(__dirname, 'scripts', 'process_score.py');
  if (fsSync.existsSync(p1)) return p1;
  return path.resolve(__dirname, 'process_score.py');
}

app.post('/api/process-all', async (req, res) => {
  const { fileBase64, xmlContent, fileName, instrument } = req.body;

  if ((!fileBase64 && !xmlContent) || !instrument) {
    return res.status(400).json({ error: 'Faltam dados da partitura ou modo/instrumento.' });
  }

  const tempDir = path.join(os.tmpdir(), `score_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const cleanName = (fileName || 'partitura').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  let inputFilePath = '';

  try {
    if (fileBase64) {
      const pdfPath = path.join(tempDir, `${cleanName}.pdf`);
      await fs.writeFile(pdfPath, Buffer.from(fileBase64, 'base64'));

      console.log(`[OMR] Executando Audiveris no arquivo: ${cleanName}.pdf...`);
      const cmdAudiveris = `export JAVA_OPTS="-Xmx2G -Djava.awt.headless=true" && xvfb-run -a /opt/audiveris/bin/Audiveris -batch -export -output "${tempDir}" "${pdfPath}"`;

      await new Promise<void>((resolve) => {
        exec(cmdAudiveris, { timeout: 300000 }, (error, _stdout, stderr) => {
          if (error) console.warn(`[Audiveris Warning]: ${stderr || error.message}`);
          resolve();
        });
      });

      const files = await fs.readdir(tempDir);
      const mxl = files.find(f => f.endsWith('.mxl') || f.endsWith('.xml'));

      if (!mxl) {
        throw new Error('Audiveris não identificou pautas legíveis no PDF.');
      }
      inputFilePath = path.join(tempDir, mxl);
    } else {
      inputFilePath = path.join(tempDir, `${cleanName}.xml`);
      await fs.writeFile(inputFilePath, xmlContent, 'utf-8');
    }

    console.log(`[Processamento] Gerando pacote A4 e Kindle para ${instrument}...`);
    const pythonScript = getPythonScriptPath();
    const pythonBin = fsSync.existsSync('/opt/venv/bin/python') ? '/opt/venv/bin/python' : 'python3';
    const cmdPython = `"${pythonBin}" "${pythonScript}" "${inputFilePath}" "${instrument}" "${tempDir}"`;

    exec(cmdPython, { timeout: 240000 }, async (pyErr, pyStdout, pyStderr) => {
      if (pyErr) {
        console.error(`[Python Error]: ${pyStderr || pyErr.message}`);
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        return res.status(500).json({ error: 'Falha ao processar e diagramar partitura.', details: pyStderr });
      }

      try {
        const keyMatch = pyStdout.match(/KEY:(.+)/);
        const outMatch = pyStdout.match(/OUT:(.+)/);
        const zipMatch = pyStdout.match(/ZIP:(.+)/);

        const detectedKey = keyMatch ? keyMatch[1].trim() : '';
        const mxlOutPath = outMatch ? outMatch[1].trim() : '';
        const zipPath = zipMatch ? zipMatch[1].trim() : '';

        let processedXml = '';
        if (fsSync.existsSync(mxlOutPath)) {
          // Converte o MXL gerado em XML para o OSMD renderizar no preview
          processedXml = await fs.readFile(mxlOutPath, 'utf-8').catch(() => '');
        }

        let zipBase64 = '';
        if (fsSync.existsSync(zipPath)) {
          const zipBuffer = await fs.readFile(zipPath);
          zipBase64 = zipBuffer.toString('base64');
        }

        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

        console.log(`[Sucesso] Pacote finalizado com sucesso para ${cleanName}.`);
        res.json({
          success: true,
          processedXml,
          detectedKey,
          zipBase64,
          zipFileName: `${cleanName}_pacote_completo.zip`
        });
      } catch (e: any) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        res.status(500).json({ error: e.message });
      }
    });

  } catch (err: any) {
    console.error(`[Erro Geral]: ${err.message}`);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PartiturasWeb server rodando na porta ${PORT} (prod: ${isProd})`);
  });
}

startServer().catch((err) => {
  console.error('[Fatal Startup Error]:', err);
  process.exit(1);
});