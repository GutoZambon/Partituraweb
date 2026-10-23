import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs/promises';
import os from 'os';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', engine: 'deterministic', time: new Date().toISOString() });
});

app.post('/api/process-xml', async (req, res) => {
  const { xmlContent, instrument } = req.body;
  
  if (!xmlContent || !instrument) {
    return res.status(400).json({ error: 'Faltam parâmetros (xmlContent ou instrument)' });
  }

  try {
    const tempDir = os.tmpdir();
    const tempFileName = `temp_${Date.now()}.xml`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    await fs.writeFile(tempFilePath, xmlContent, 'utf-8');

    const pythonScriptPath = path.resolve(__dirname, 'scripts', 'process_score.py');

    exec(`python3 "${pythonScriptPath}" "${tempFilePath}" "${instrument}"`, async (error, stdout, stderr) => {
      await fs.unlink(tempFilePath).catch(() => {});

      if (error) {
        console.error(`Erro na execução do Python: ${error.message}\nStderr: ${stderr}`);
        return res.status(500).json({ error: 'Falha ao processar partitura no servidor.', debugLogs: stderr });
      }

      const processedFilePath = `${tempFilePath}.processed.xml`;
      
      try {
        const processedXml = await fs.readFile(processedFilePath, 'utf-8');
        await fs.unlink(processedFilePath).catch(() => {}); 
        
        const keyMatch = stdout.match(/KEY:(.+)/);
        const detectedKey = keyMatch ? keyMatch[1].trim() : '';

        // ENVIANDO O STDERR (LOGS DO PYTHON) PARA O FRONTEND
        res.json({ processedXml, detectedKey, debugLogs: stderr });
      } catch (readError) {
        console.error(`Erro ao ler arquivo processado: ${readError}`);
        res.status(500).json({ error: 'Falha ao ler o resultado do processamento.' });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
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

  app.listen(PORT, () => {
    console.log(`PartiturasWeb server rodando na porta ${PORT} (dev: ${!isProd})`);
  });
}

startServer();