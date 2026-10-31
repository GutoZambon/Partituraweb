import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

/**
 * Executa comandos headless (MuseScore, Audiveris, etc.) com timeout configurável
 */
function execCommand(cmd: string, timeoutMs: number = 60000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`${error.message}\nStderr: ${stderr}\nStdout: ${stdout}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Busca recursiva por arquivos .mxl ou .xml em um diretório
 */
async function findScoreFiles(dir: string): Promise<string[]> {
  if (!fsSync.existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findScoreFiles(fullPath)));
    } else if (entry.name.endsWith('.mxl') || entry.name.endsWith('.xml')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Health check com verificação de MuseScore, Audiveris e Python
 */
app.get('/api/health', async (_req, res) => {
  let musescoreInstalled = false;
  let audiverisInstalled = false;

  try {
    const { stdout } = await execCommand('xvfb-run -a musescore3 --version', 10000);
    musescoreInstalled = stdout.includes('MuseScore');
  } catch {}

  try {
    audiverisInstalled = fsSync.existsSync('/opt/audiveris/bin/Audiveris');
  } catch {}

  res.json({
    status: 'ok',
    engine: 'musescore-audiveris-music21',
    musescoreAvailable: musescoreInstalled,
    audiverisAvailable: audiverisInstalled,
    time: new Date().toISOString()
  });
});

/**
 * Endpoint de processamento musical (Anotações, Dedilhados, Transposição) via Python music21
 */
app.post('/api/process-xml', async (req, res) => {
  const { xmlContent, instrument } = req.body;
  
  if (!xmlContent || !instrument) {
    return res.status(400).json({ error: 'Faltam parâmetros (xmlContent ou instrument)' });
  }

  const tempDir = os.tmpdir();
  const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.xml`;
  const tempFilePath = path.join(tempDir, tempFileName);
  const processedFilePath = `${tempFilePath}.processed.xml`;

  try {
    await fs.writeFile(tempFilePath, xmlContent, 'utf-8');

    const pythonScriptPath = path.resolve(__dirname, 'scripts', 'process_score.py');
    const { stdout, stderr } = await execCommand(`python3 "${pythonScriptPath}" "${tempFilePath}" "${instrument}"`);

    await fs.unlink(tempFilePath).catch(() => {});

    if (!fsSync.existsSync(processedFilePath)) {
      throw new Error(`Arquivo processado não foi gerado pelo Python.\nStderr: ${stderr}\nStdout: ${stdout}`);
    }

    const processedXml = await fs.readFile(processedFilePath, 'utf-8');
    await fs.unlink(processedFilePath).catch(() => {}); 
    
    const keyMatch = stdout.match(/KEY:(.+)/);
    const detectedKey = keyMatch ? keyMatch[1].trim() : '';

    res.json({ processedXml, detectedKey, debugLogs: stderr });
  } catch (err: any) {
    await fs.unlink(tempFilePath).catch(() => {});
    await fs.unlink(processedFilePath).catch(() => {});
    console.error('Erro em /api/process-xml:', err);
    res.status(500).json({ error: 'Falha ao processar partitura no servidor.', debugLogs: err?.message });
  }
});

/**
 * NOVO ENDPOINT: Reconhecimento Ótico Musical (OMR) de PDFs via Audiveris e anotações via Python
 */
app.post('/api/process-pdf', upload.single('pdf'), async (req, res) => {
  const instrument = (req.body?.instrument as string) || 'Trompete';
  let pdfBuffer: Buffer | null = null;

  if (req.file && req.file.buffer) {
    pdfBuffer = req.file.buffer;
  } else if (req.body?.pdfBase64) {
    const cleanB64 = req.body.pdfBase64.replace(/^data:[^;]+;base64,/, '');
    pdfBuffer = Buffer.from(cleanB64, 'base64');
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    return res.status(400).json({ error: 'Arquivo PDF não fornecido.' });
  }

  const jobDir = path.join(os.tmpdir(), `audiveris_job_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const inputPdfPath = path.join(jobDir, 'input.pdf');
  const outputOmrDir = path.join(jobDir, 'output');

  try {
    await fs.mkdir(jobDir, { recursive: true });
    await fs.mkdir(outputOmrDir, { recursive: true });
    await fs.writeFile(inputPdfPath, pdfBuffer);

    const audiverisBin = '/opt/audiveris/bin/Audiveris';
    if (!fsSync.existsSync(audiverisBin)) {
      throw new Error('O binário do Audiveris não foi encontrado em /opt/audiveris/bin/Audiveris.');
    }

    console.log(`[Audiveris OMR] Iniciando processamento para ${req.file?.originalname || 'arquivo.pdf'} (instrumento: ${instrument})...`);

    // Executa Audiveris em modo headless (-batch -export) com timeout de 3 minutos (180.000 ms)
    const audiverisCmd = `xvfb-run -a "${audiverisBin}" -batch -export -output "${outputOmrDir}" "${inputPdfPath}"`;
    let audiverisLogs = '';

    try {
      const result = await execCommand(audiverisCmd, 180000);
      audiverisLogs = `${result.stdout}\n${result.stderr}`;
    } catch (cmdErr: any) {
      audiverisLogs = cmdErr.message || '';
      console.warn('[Audiveris OMR] Processo finalizado com avisos/erros. Verificando se arquivo .mxl foi gerado...');
    }

    // Busca arquivos de partitura gerados (.mxl ou .xml)
    const foundScores = await findScoreFiles(outputOmrDir);

    if (foundScores.length === 0) {
      console.error('[Audiveris OMR] Nenhum arquivo .mxl ou .xml gerado pelo Audiveris.\nLogs:\n', audiverisLogs);
      return res.status(422).json({
        error: 'O Audiveris OMR não conseguiu reconhecer pautas musicais válidas no PDF.',
        debugLogs: audiverisLogs,
      });
    }

    // Prioriza .mxl se houver
    const scoreFile = foundScores.find(f => f.endsWith('.mxl')) || foundScores[0];
    console.log(`[Audiveris OMR] Partitura extraída com sucesso: ${scoreFile}`);

    // Passa a partitura para o script Python existente (process_score.py)
    const pythonScriptPath = path.resolve(__dirname, 'scripts', 'process_score.py');
    const pyResult = await execCommand(`python3 "${pythonScriptPath}" "${scoreFile}" "${instrument}"`);

    const processedXmlPath = `${scoreFile}.processed.xml`;
    if (!fsSync.existsSync(processedXmlPath)) {
      throw new Error('Falha ao gerar arquivo MusicXML anotado pelo Python.');
    }

    const processedXml = await fs.readFile(processedXmlPath, 'utf-8');
    const keyMatch = pyResult.stdout.match(/KEY:(.+)/);
    const detectedKey = keyMatch ? keyMatch[1].trim() : 'Desconhecido';

    res.json({
      success: true,
      processedXml,
      detectedKey,
      debugLogs: `${audiverisLogs}\n--- PYTHON LOGS ---\n${pyResult.stderr}`,
    });
  } catch (err: any) {
    console.error('Erro em /api/process-pdf:', err);
    res.status(500).json({
      error: 'Falha no processamento OMR do PDF.',
      details: err?.message,
      debugLogs: err?.message
    });
  } finally {
    // Limpeza do diretório temporário do job
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch {}
  }
});

/**
 * Endpoint para converter arquivos nativos do MuseScore (.mscz / .mscx) para MusicXML
 */
app.post('/api/convert-mscz', async (req, res) => {
  const { fileBase64, fileName } = req.body;

  if (!fileBase64) {
    return res.status(400).json({ error: 'Arquivo base64 não fornecido.' });
  }

  const ext = fileName && fileName.toLowerCase().endsWith('.mscx') ? 'mscx' : 'mscz';
  const tempDir = os.tmpdir();
  const fileId = `mscz_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const inputPath = path.join(tempDir, `${fileId}.${ext}`);
  const outputXmlPath = path.join(tempDir, `${fileId}.xml`);
  const outputPngPrefix = path.join(tempDir, `${fileId}.png`);

  try {
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    await fs.writeFile(inputPath, buffer);

    // 1. Converter MSCZ -> MusicXML via MuseScore
    await execCommand(`xvfb-run -a musescore3 -o "${outputXmlPath}" "${inputPath}"`);

    if (!fsSync.existsSync(outputXmlPath)) {
      throw new Error('O MuseScore não conseguiu converter o arquivo para MusicXML.');
    }

    const xmlContent = await fs.readFile(outputXmlPath, 'utf-8');

    // 2. Tentar gerar páginas PNG renderizadas diretamente pelo MuseScore
    const pageImages: string[] = [];
    try {
      await execCommand(`xvfb-run -a musescore3 -o "${outputPngPrefix}" "${inputPath}"`);
      const dirFiles = await fs.readdir(tempDir);
      const pngFiles = dirFiles
        .filter(f => f.startsWith(fileId) && f.endsWith('.png'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/.*-(\d+)\.png$/, '$1'), 10) || 0;
          const numB = parseInt(b.replace(/.*-(\d+)\.png$/, '$1'), 10) || 0;
          return numA - numB;
        });

      for (const pngFile of pngFiles) {
        const fullPngPath = path.join(tempDir, pngFile);
        const imgBuffer = await fs.readFile(fullPngPath);
        pageImages.push(`data:image/png;base64,${imgBuffer.toString('base64')}`);
        await fs.unlink(fullPngPath).catch(() => {});
      }
    } catch (pngErr) {
      console.warn('Não foi possível gerar PNGs prévios do MSCZ via MuseScore:', pngErr);
    }

    // Cleanup
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputXmlPath).catch(() => {});

    res.json({
      success: true,
      xmlContent,
      pageImages,
      fileName: fileName ? fileName.replace(/\.msc[zx]$/i, '.xml') : 'score.xml'
    });
  } catch (err: any) {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputXmlPath).catch(() => {});
    console.error('Erro ao converter MSCZ no servidor:', err);
    res.status(500).json({ error: 'Falha ao ler arquivo do MuseScore.', details: err?.message });
  }
});

/**
 * Renderiza páginas em PNG de alta definição diretamente com as fontes do MuseScore
 */
app.post('/api/musescore/render-pages', async (req, res) => {
  const { xmlContent } = req.body;

  if (!xmlContent) {
    return res.status(400).json({ error: 'Conteúdo MusicXML obrigatório.' });
  }

  const tempDir = os.tmpdir();
  const fileId = `render_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const inputXmlPath = path.join(tempDir, `${fileId}.xml`);
  const outputPngPrefix = path.join(tempDir, `${fileId}.png`);

  try {
    await fs.writeFile(inputXmlPath, xmlContent, 'utf-8');

    // Executa exportação PNG no MuseScore 3
    await execCommand(`xvfb-run -a musescore3 -o "${outputPngPrefix}" "${inputXmlPath}"`);

    const dirFiles = await fs.readdir(tempDir);
    const pngFiles = dirFiles
      .filter(f => f.startsWith(fileId) && f.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/.*-(\d+)\.png$/, '$1'), 10) || 0;
        const numB = parseInt(b.replace(/.*-(\d+)\.png$/, '$1'), 10) || 0;
        return numA - numB;
      });

    const pages: string[] = [];
    for (const pngFile of pngFiles) {
      const fullPngPath = path.join(tempDir, pngFile);
      const imgBuffer = await fs.readFile(fullPngPath);
      pages.push(`data:image/png;base64,${imgBuffer.toString('base64')}`);
      await fs.unlink(fullPngPath).catch(() => {});
    }

    await fs.unlink(inputXmlPath).catch(() => {});

    res.json({ success: true, pages });
  } catch (err: any) {
    await fs.unlink(inputXmlPath).catch(() => {});
    console.error('Erro na renderização de páginas do MuseScore:', err);
    res.status(500).json({ error: 'Falha ao renderizar páginas no MuseScore.', details: err?.message });
  }
});

/**
 * Exporta MusicXML anotado para arquivo binário compactado .mscz do MuseScore
 */
app.post('/api/musescore/export-mscz', async (req, res) => {
  const { xmlContent, fileName } = req.body;

  if (!xmlContent) {
    return res.status(400).json({ error: 'Conteúdo MusicXML obrigatório.' });
  }

  const tempDir = os.tmpdir();
  const fileId = `mscz_out_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const inputXmlPath = path.join(tempDir, `${fileId}.xml`);
  const outputMsczPath = path.join(tempDir, `${fileId}.mscz`);

  try {
    await fs.writeFile(inputXmlPath, xmlContent, 'utf-8');
    await execCommand(`xvfb-run -a musescore3 -o "${outputMsczPath}" "${inputXmlPath}"`);

    if (!fsSync.existsSync(outputMsczPath)) {
      throw new Error('MuseScore não conseguiu gerar o arquivo .mscz.');
    }

    const msczBuffer = await fs.readFile(outputMsczPath);
    await fs.unlink(inputXmlPath).catch(() => {});
    await fs.unlink(outputMsczPath).catch(() => {});

    const base64Data = msczBuffer.toString('base64');
    const safeName = (fileName || 'partitura').replace(/\.[^/.]+$/, '') + '.mscz';

    res.json({ success: true, base64Data, fileName: safeName });
  } catch (err: any) {
    await fs.unlink(inputXmlPath).catch(() => {});
    await fs.unlink(outputMsczPath).catch(() => {});
    console.error('Erro ao exportar .mscz no MuseScore:', err);
    res.status(500).json({ error: 'Falha ao exportar .mscz.', details: err?.message });
  }
});

/**
 * Exporta partitura para PDF direto pelo motor nativo do MuseScore
 */
app.post('/api/musescore/export-pdf', async (req, res) => {
  const { xmlContent, fileName } = req.body;

  if (!xmlContent) {
    return res.status(400).json({ error: 'Conteúdo MusicXML obrigatório.' });
  }

  const tempDir = os.tmpdir();
  const fileId = `pdf_out_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const inputXmlPath = path.join(tempDir, `${fileId}.xml`);
  const outputPdfPath = path.join(tempDir, `${fileId}.pdf`);

  try {
    await fs.writeFile(inputXmlPath, xmlContent, 'utf-8');
    await execCommand(`xvfb-run -a musescore3 -o "${outputPdfPath}" "${inputXmlPath}"`);

    if (!fsSync.existsSync(outputPdfPath)) {
      throw new Error('MuseScore não conseguiu gerar o PDF.');
    }

    const pdfBuffer = await fs.readFile(outputPdfPath);
    await fs.unlink(inputXmlPath).catch(() => {});
    await fs.unlink(outputPdfPath).catch(() => {});

    const base64Data = pdfBuffer.toString('base64');
    const safeName = (fileName || 'partitura').replace(/\.[^/.]+$/, '') + '_musescore.pdf';

    res.json({ success: true, base64Data, fileName: safeName });
  } catch (err: any) {
    await fs.unlink(inputXmlPath).catch(() => {});
    await fs.unlink(outputPdfPath).catch(() => {});
    console.error('Erro ao gerar PDF no MuseScore:', err);
    res.status(500).json({ error: 'Falha ao gerar PDF no MuseScore.', details: err?.message });
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