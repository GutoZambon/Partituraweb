import React, { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { ScoreItem, ProcessingOptions } from '../types/music';
import { processMusicXml } from '../utils/musicLogic';
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Music, CheckCircle } from 'lucide-react';

interface ScoreViewerProps {
  score: ScoreItem | null;
  options: ProcessingOptions;
  onRenderedPagesReady?: (pages: string[]) => void;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({
  score,
  options,
  onRenderedPagesReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [activeXml, setActiveXml] = useState<string>('');
  const [activeKey, setActiveKey] = useState<string>('');

  useEffect(() => {
    if (!score || !containerRef.current) return;
    if (!score.xmlContent && (!score.pdfPages || score.pdfPages.length === 0)) return;

    let isMounted = true;
    setIsRendering(true);
    setRenderError(null);

    const renderScore = async () => {
      try {
        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Case A: Render directly from PDF / Image pages
        if (score.pdfPages && score.pdfPages.length > 0) {
          score.pdfPages.forEach((pageUrl, idx) => {
            const pageCard = document.createElement('div');
            pageCard.className = 'mb-6 last:mb-0 bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm';
            pageCard.style.width = '100%';
            pageCard.style.maxWidth = `${Math.round(800 * zoom)}px`;

            const header = document.createElement('div');
            header.className = 'px-4 py-2 bg-stone-50 border-b border-stone-100 flex items-center justify-between text-xs text-stone-500 font-mono';
            header.innerHTML = `<span>${score.fileName}</span><span>Página ${idx + 1} de ${score.pdfPages!.length}</span>`;

            const img = document.createElement('img');
            img.src = pageUrl;
            img.className = 'w-full h-auto block';
            img.alt = `Partitura - Página ${idx + 1}`;

            pageCard.appendChild(header);
            pageCard.appendChild(img);
            containerRef.current?.appendChild(pageCard);
          });

          if (onRenderedPagesReady) {
            onRenderedPagesReady(score.pdfPages);
          }
          return;
        }

        // Case B: Render from MusicXML
        const { processedXml, detectedKey } = processMusicXml(
          score.xmlContent,
          score.instrument,
          options
        );

        if (!isMounted) return;
        setActiveXml(processedXml);
        setActiveKey(detectedKey);

        // Initialize OSMD
        const osmd = new OpenSheetMusicDisplay(containerRef.current!, {
          autoResize: true,
          backend: 'svg',
          drawTitle: true,
          drawSubtitle: true,
          drawPartNames: true,
          drawFingerings: true,
          drawLyrics: true,
          drawingParameters: 'compact',
        });

        osmd.zoom = zoom;
        await osmd.load(processedXml);
        osmd.render();

        osmdRef.current = osmd;

        // Collect rendered SVG pages for PDF generation
        if (containerRef.current) {
          const svgs = containerRef.current.querySelectorAll('svg');
          const pageDataUrls: string[] = [];

          for (let i = 0; i < svgs.length; i++) {
            const svg = svgs[i];
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            // Convert SVG to Canvas image to get raster PNG for pdf-lib
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => {
                const canvas = document.createElement('canvas');
                // High DPI for crisp print quality
                const scale = 2.0;
                canvas.width = (svg.clientWidth || 800) * scale;
                canvas.height = (svg.clientHeight || 1100) * scale;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  pageDataUrls.push(canvas.toDataURL('image/png'));
                }
                URL.revokeObjectURL(url);
                resolve();
              };
              img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve();
              };
              img.src = url;
            });
          }

          if (pageDataUrls.length > 0 && onRenderedPagesReady) {
            onRenderedPagesReady(pageDataUrls);
          }
        }
      } catch (err: any) {
        console.error('Erro ao renderizar partitura:', err);
        if (isMounted) {
          setRenderError(err?.message || 'Falha ao renderizar a partitura na tela.');
        }
      } finally {
        if (isMounted) {
          setIsRendering(false);
        }
      }
    };

    renderScore();

    return () => {
      isMounted = false;
    };
  }, [score, options, zoom]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.15, 0.6));
  const handleResetZoom = () => setZoom(1.0);

  if (!score) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400">
        <Music className="w-10 h-10 mx-auto text-stone-300 mb-3" />
        <p className="text-sm font-medium text-stone-600">Pré-Visualização de Partitura</p>
        <p className="text-xs text-stone-400 mt-1">
          Selecione uma partitura na fila para inspecionar notas, dedilhados e tom.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Score Header & Controls */}
      <div className="px-5 py-3 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 bg-stone-50/70">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">
              {score.title || score.fileName}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
              {score.instrument}
            </span>
          </div>
          {activeKey && (
            <p className="text-xs text-stone-500 font-mono">
              Tom Calculado: <span className="font-semibold text-stone-800">{activeKey}</span>
            </p>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-1">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Reduzir Zoom"
            className="p-1 rounded hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono px-2 text-stone-700 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Aumentar Zoom"
            className="p-1 rounded hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Ajustar ao tamanho normal"
            className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Render Error Alert */}
      {renderError && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Erro ao renderizar partitura graficamente</p>
            <p className="text-red-700">{renderError}</p>
          </div>
        </div>
      )}

      {/* Sheet Music Canvas Area */}
      <div className="p-6 bg-stone-100/50 min-h-[460px] flex items-center justify-center overflow-auto max-h-[720px]">
        <div
          ref={containerRef}
          className="bg-white p-6 rounded-lg shadow-sm border border-stone-200/80 w-full max-w-4xl min-h-[400px] flex flex-col items-center justify-center transition-opacity"
          style={{ opacity: isRendering ? 0.6 : 1 }}
        />
      </div>

      {/* Bottom Info Bar */}
      <div className="px-5 py-2.5 border-t border-stone-100 bg-white flex flex-wrap items-center justify-between text-xs text-stone-500 font-mono">
        <div className="flex items-center gap-3">
          <span>Dedilhado: {options.addFingerings ? 'Ativo' : 'Oculto'}</span>
          <span>·</span>
          <span>Notas: {options.addNoteNames ? 'Ativo' : 'Oculto'}</span>
          <span>·</span>
          <span>Tom: {options.addKeyHeader ? 'No 1º Compasso' : 'Oculto'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Pronta para Impressão</span>
        </div>
      </div>
    </div>
  );
};
