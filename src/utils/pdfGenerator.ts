import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { OutputFormat } from '../types/music';

// A4 Dimensions in Points (72 pt per inch)
// 210mm = 595.28 pt, 297mm = 841.89 pt
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

// Kindle 10" (Kindle Scribe) 16:10 Aspect Ratio
// 16:10 ratio: 960 x 600 pt (or 1200 x 750 pt)
export const KINDLE_WIDTH = 1200;
export const KINDLE_HEIGHT = 750;

/**
 * Sanitizes a text string to ensure all characters are valid WinAnsi Latin1 for pdf-lib standard fonts
 */
export function sanitizeWinAnsi(str: string): string {
  if (!str) return '';
  return str
    .replace(/✄/g, '--')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/·/g, '-')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/’/g, "'")
    .replace(/”/g, '"')
    .replace(/“/g, '"')
    .replace(/[^\x00-\xFF]/g, ''); // strip any non-latin1 characters
}

export function getFingeringGuide(instrument: string): string {
  switch (instrument) {
    case 'Trompete':
      return 'PISTOS: Do(0) Re(1) Mi(0) Fa(1) Sol(0) La(1-2) Si(2) Do#(1-2-3)';
    case 'Trombone':
      return 'POSICOES DE VARA: Do(6a) Re(4a) Mi(2a) Fa(1a) Sol(4a) La(2a) Si b(1a)';
    case 'Tuba':
      return 'PISTOS: Do(0) Re(1-2) Mi(2) Fa(0) Sol(1-2) La(1) Si(2) Do#(1-2-3)';
    case 'Bombardino':
      return 'PISTOS: Do(0) Re(1-2) Mi(2) Fa(0) Sol(1-2) La(1) Si(2) Do#(1-2-3-4)';
    default:
      return 'NOTAS EM PORTUGUES: Do, Re, Mi, Fa, Sol, La, Si';
  }
}

/**
 * Checks if a canvas or image data is effectively a blank page
 */
export function isBlankImage(imageData: ImageData, thresholdPercent: number = 0.992): boolean {
  const data = imageData.data;
  let whitePixels = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Transparent or near-white (threshold > 240)
    if (a < 15 || (r > 240 && g > 240 && b > 240)) {
      whitePixels++;
    }
  }

  return (whitePixels / totalPixels) >= thresholdPercent;
}

export interface PageRenderSource {
  dataUrl: string; // PNG or JPEG base64
  scoreTitle: string;
  instrument: string;
  pageNumber: number;
  detectedKey?: string;
}

/**
 * Generates formatted PDF based on output format
 */
export async function generatePdf(
  pages: PageRenderSource[],
  format: OutputFormat,
  options: {
    removeBlankPages: boolean;
    includeHeaderInfo?: boolean;
    jobTitle?: string;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (pages.length === 0) {
    const emptyPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    emptyPage.drawText(sanitizeWinAnsi('Nenhuma partitura processada.'), {
      x: 50,
      y: A4_HEIGHT - 100,
      font: helvetica,
      size: 16,
      color: rgb(0.2, 0.2, 0.2)
    });
    return await pdfDoc.save();
  }

  // Embed images into PDF
  const embeddedImages = await Promise.all(
    pages.map(async (page) => {
      const base64Data = page.dataUrl.split(',')[1] || page.dataUrl;
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const image = page.dataUrl.includes('image/jpeg') || page.dataUrl.includes('image/jpg')
        ? await pdfDoc.embedJpg(imageBytes)
        : await pdfDoc.embedPng(imageBytes);
      return { image, meta: page };
    })
  );

  if (format === 'normal_a4') {
    // Normal A4 layout: 1 score page per A4 sheet
    for (const item of embeddedImages) {
      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      const { image, meta } = item;

      // Fit with margins
      const margin = 28;
      const maxWidth = A4_WIDTH - margin * 2;
      const maxHeight = A4_HEIGHT - margin * 2 - 24;

      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const x = (A4_WIDTH - drawWidth) / 2;
      const y = (A4_HEIGHT - drawHeight) / 2 + 8;

      // Draw Top Annotation Banner
      const keyStr = meta.detectedKey ? `TOM: ${meta.detectedKey}` : 'TOM: Si b Maior';
      const fingeringStr = getFingeringGuide(meta.instrument);
      const headerStr = sanitizeWinAnsi(`${keyStr}  |  ${meta.instrument.toUpperCase()}  |  ${fingeringStr}`);

      page.drawRectangle({
        x: margin,
        y: A4_HEIGHT - margin - 14,
        width: maxWidth,
        height: 14,
        color: rgb(0.96, 0.96, 0.98),
        borderColor: rgb(0.82, 0.82, 0.88),
        borderWidth: 0.5,
      });

      page.drawText(headerStr, {
        x: margin + 6,
        y: A4_HEIGHT - margin - 10,
        font: helveticaBold,
        size: 7,
        color: rgb(0.15, 0.15, 0.35)
      });

      page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });

      // Footer
      page.drawText(sanitizeWinAnsi(`${meta.scoreTitle} - ${meta.instrument} - Pág. ${meta.pageNumber}`), {
        x: margin,
        y: 12,
        font: helvetica,
        size: 8,
        color: rgb(0.4, 0.4, 0.4)
      });
    }
  } else if (format === 'caderninho_a5') {
    // 2 A5 pages per A4 Portrait Sheet (Stacked vertically)
    // Sheet: A4 Portrait (595.28 pt wide x 841.89 pt high)
    // Top Half: Y from 420.94 to 841.89 pt (Height = 420.94 pt)
    // Bottom Half: Y from 0 to 420.94 pt (Height = 420.94 pt)
    const halfHeight = A4_HEIGHT / 2; // 420.945 pt

    for (let i = 0; i < embeddedImages.length; i += 2) {
      const sheet = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      const margin = 20;

      // Draw Top Half (Page i)
      const topItem = embeddedImages[i];
      if (topItem) {
        const { image, meta } = topItem;
        const maxW = A4_WIDTH - margin * 2;
        const maxH = halfHeight - margin * 2;
        const scale = Math.min(maxW / image.width, maxH / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        const x = (A4_WIDTH - drawW) / 2;
        const y = halfHeight + (halfHeight - drawH) / 2;

        // Top Banner for Page i
        const keyStr = meta.detectedKey ? `TOM: ${meta.detectedKey}` : 'TOM: Si b Maior';
        const fingeringStr = getFingeringGuide(meta.instrument);
        const headerStr = sanitizeWinAnsi(`${keyStr}  |  ${meta.instrument.toUpperCase()}  |  ${fingeringStr}`);

        sheet.drawRectangle({
          x: margin,
          y: A4_HEIGHT - margin - 12,
          width: maxW,
          height: 12,
          color: rgb(0.96, 0.96, 0.98),
          borderColor: rgb(0.82, 0.82, 0.88),
          borderWidth: 0.5,
        });

        sheet.drawText(headerStr, {
          x: margin + 4,
          y: A4_HEIGHT - margin - 9,
          font: helveticaBold,
          size: 6.5,
          color: rgb(0.15, 0.15, 0.35)
        });

        sheet.drawImage(image, { x, y, width: drawW, height: drawH });

        // Mini footer top
        sheet.drawText(sanitizeWinAnsi(`${meta.scoreTitle} - ${meta.instrument} (Pág. ${meta.pageNumber})`), {
          x: margin + 4,
          y: halfHeight + 8,
          font: helvetica,
          size: 7.5,
          color: rgb(0.45, 0.45, 0.45)
        });
      }

      // Cut guideline in the middle (dashed line)
      sheet.drawLine({
        start: { x: 12, y: halfHeight },
        end: { x: A4_WIDTH - 12, y: halfHeight },
        thickness: 0.6,
        color: rgb(0.7, 0.7, 0.7),
        dashArray: [4, 4]
      });

      sheet.drawText(sanitizeWinAnsi('-- CORTE AQUI (CADERNO A5) --'), {
        x: A4_WIDTH / 2 - 65,
        y: halfHeight - 3,
        font: helvetica,
        size: 7,
        color: rgb(0.6, 0.6, 0.6)
      });

      // Draw Bottom Half (Page i + 1)
      if (i + 1 < embeddedImages.length) {
        const bottomItem = embeddedImages[i + 1];
        const { image, meta } = bottomItem;
        const maxW = A4_WIDTH - margin * 2;
        const maxH = halfHeight - margin * 2;
        const scale = Math.min(maxW / image.width, maxH / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        const x = (A4_WIDTH - drawW) / 2;
        const y = (halfHeight - drawH) / 2;

        // Banner Bottom Half
        const keyStr = meta.detectedKey ? `TOM: ${meta.detectedKey}` : 'TOM: Si b Maior';
        const fingeringStr = getFingeringGuide(meta.instrument);
        const headerStr = sanitizeWinAnsi(`${keyStr}  |  ${meta.instrument.toUpperCase()}  |  ${fingeringStr}`);

        sheet.drawRectangle({
          x: margin,
          y: halfHeight - margin - 12,
          width: maxW,
          height: 12,
          color: rgb(0.96, 0.96, 0.98),
          borderColor: rgb(0.82, 0.82, 0.88),
          borderWidth: 0.5,
        });

        sheet.drawText(headerStr, {
          x: margin + 4,
          y: halfHeight - margin - 9,
          font: helveticaBold,
          size: 6.5,
          color: rgb(0.15, 0.15, 0.35)
        });

        sheet.drawImage(image, { x, y, width: drawW, height: drawH });

        // Mini footer bottom
        sheet.drawText(sanitizeWinAnsi(`${meta.scoreTitle} - ${meta.instrument} (Pág. ${meta.pageNumber})`), {
          x: margin + 4,
          y: 8,
          font: helvetica,
          size: 7.5,
          color: rgb(0.45, 0.45, 0.45)
        });
      } else {
        // Blank back or memo area if odd page count
        sheet.drawText(sanitizeWinAnsi('Anotacoes de Ensaio / Fim da Partitura'), {
          x: A4_WIDTH / 2 - 70,
          y: halfHeight / 2,
          font: helvetica,
          size: 10,
          color: rgb(0.7, 0.7, 0.7)
        });
      }
    }
  } else if (format === 'kindle_10') {
    // Kindle Scribe 10" (16:10 Landscape)
    for (const item of embeddedImages) {
      const page = pdfDoc.addPage([KINDLE_WIDTH, KINDLE_HEIGHT]);
      const { image, meta } = item;

      // Kindle e-ink display benefit: Minimal margins, maximize score width!
      const margin = 24;
      const maxW = KINDLE_WIDTH - margin * 2;
      const maxH = KINDLE_HEIGHT - margin * 2 - 20;

      const scale = Math.min(maxW / image.width, maxH / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const x = (KINDLE_WIDTH - drawW) / 2;
      const y = (KINDLE_HEIGHT - drawH) / 2 + 10;

      // Kindle top header
      const keyStr = meta.detectedKey ? `TOM: ${meta.detectedKey}` : 'TOM: Si b Maior';
      const fingeringStr = getFingeringGuide(meta.instrument);
      const headerStr = sanitizeWinAnsi(`${keyStr}  |  ${meta.instrument.toUpperCase()}  |  ${fingeringStr}`);

      page.drawText(headerStr, {
        x: margin,
        y: KINDLE_HEIGHT - 16,
        font: helveticaBold,
        size: 9,
        color: rgb(0.2, 0.2, 0.2)
      });

      page.drawImage(image, { x, y, width: drawW, height: drawH });

      // Kindle header/footer text
      page.drawText(sanitizeWinAnsi(`${meta.scoreTitle} - ${meta.instrument} (Kindle 10" Scribe)`), {
        x: margin,
        y: 12,
        font: helveticaBold,
        size: 9,
        color: rgb(0.2, 0.2, 0.2)
      });
      page.drawText(sanitizeWinAnsi(`Página ${meta.pageNumber}`), {
        x: KINDLE_WIDTH - margin - 60,
        y: 12,
        font: helvetica,
        size: 9,
        color: rgb(0.3, 0.3, 0.3)
      });
    }
  }

  return await pdfDoc.save();
}

/**
 * Triggers browser download of a PDF binary array
 */
export function downloadPdfBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
