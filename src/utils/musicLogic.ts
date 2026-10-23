import JSZip from 'jszip';
import { ProcessingOptions, InstrumentType } from '../types/music';

export async function extractMusicXml(bufferOrString: ArrayBuffer | string): Promise<string> {
  if (typeof bufferOrString === 'string') {
    if (bufferOrString.trim().startsWith('<') || bufferOrString.includes('<score-partwise')) {
      return bufferOrString;
    }
  }

  try {
    const zip = await JSZip.loadAsync(bufferOrString);
    const container = zip.file('META-INF/container.xml');
    let xmlFileName = '';
    if (container) {
      const containerText = await container.async('text');
      const match = containerText.match(/full-path="([^"]+)"/);
      if (match && match[1]) {
        xmlFileName = match[1];
      }
    }

    if (xmlFileName && zip.file(xmlFileName)) {
      return await zip.file(xmlFileName)!.async('text');
    }

    for (const [name, file] of Object.entries(zip.files)) {
      if (name.endsWith('.xml') && !name.includes('META-INF') && !file.dir) {
        return await file.async('text');
      }
    }
  } catch {
    if (typeof bufferOrString !== 'string') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bufferOrString);
    }
  }

  return typeof bufferOrString === 'string' ? bufferOrString : '';
}

export async function processMusicXmlAsync(
  xmlContent: string,
  instrument: InstrumentType,
  options?: ProcessingOptions
): Promise<{ processedXml: string; detectedKey: string }> {
  try {
    console.log(`[Frontend] Enviando XML para o servidor. Instrumento: ${instrument}`);
    
    const response = await fetch('/api/process-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        xmlContent,
        instrument,
        options,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (errData.debugLogs) {
        console.error("[PYTHON ERROR LOGS]:\n", errData.debugLogs);
      }
      throw new Error(errData.error || `Erro no servidor: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Frontend] Sucesso! Tom detectado: ${data.detectedKey}`);
    
    // IMPRIME OS LOGS DO PYTHON NO CONSOLE DO NAVEGADOR
    if (data.debugLogs) {
      console.log("%c--- LOGS DO PYTHON ---", "color: #4f46e5; font-weight: bold;");
      console.log(data.debugLogs);
    }
    
    return {
      processedXml: data.processedXml,
      detectedKey: data.detectedKey || '',
    };
  } catch (error) {
    console.error("[Frontend] Erro ao processar XML via API:", error);
    throw error;
  }
}