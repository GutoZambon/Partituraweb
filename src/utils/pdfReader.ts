import * as pdfjsLib from 'pdfjs-dist';
import { isBlankImage } from './pdfGenerator';

// Configure worker for Vite browser runtime
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  isBlank: boolean;
}

/**
 * Extracts and renders pages from a PDF ArrayBuffer directly in the browser
 */
export async function renderPdfToImages(
  arrayBuffer: ArrayBuffer,
  removeBlankPages: boolean = true
): Promise<RenderedPdfPage[]> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages: RenderedPdfPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    // Render at 2x scale for sharp high-DPI sheet music
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) continue;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isBlank = isBlankImage(imgData);

    if (removeBlankPages && isBlank) {
      console.log(`Página em branco removida da partitura: página ${i}`);
      continue;
    }

    pages.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL('image/png'),
      width: viewport.width,
      height: viewport.height,
      isBlank,
    });
  }

  return pages;
}
