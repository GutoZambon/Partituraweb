import React, { useState } from 'react';
import { ScoreItem, ProcessingOptions, OutputFormat } from '../types/music';
import { processMusicXmlAsync } from '../utils/musicLogic';
import { generatePdf, downloadPdfBlob, isBlankImage, PageRenderSource } from '../utils/pdfGenerator';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import JSZip from 'jszip';
import {
  Download,
  BookOpen,
  Tablet,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Music
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scores: ScoreItem[];
  options: ProcessingOptions;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  scores,
  options,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<{
    format: OutputFormat;
    label: string;
    fileName: string;
    bytes: Uint8Array;
  }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const renderScoreToPages = async (score: ScoreItem): Promise<PageRenderSource[]> => {
    if ((score.originalFileType === 'pdf' || score.originalFileType === 'image') && score.pdfPages && score.pdfPages.length > 0) {
      return score.pdfPages.map((dataUrl, idx) => ({
        dataUrl,
        scoreTitle: score.title || score.fileName.replace(/\.[^/.]+$/, ''),
        instrument: score.instrument,
        pageNumber: idx + 1,
        detectedKey: score.detectedKey,
      }));
    }

    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.left = '0';
    // Força a largura exata de um A4 a 96dpi para proporção correta
    hiddenDiv.style.width = '794px'; 
    hiddenDiv.style.height = '1123px'; // Altura A4 (96dpi) - ISSO EVITA QUE FIQUE ESPREMIDO
    hiddenDiv.style.background = 'white';
    hiddenDiv.style.opacity = '0';
    hiddenDiv.style.pointerEvents = 'none';
    hiddenDiv.style.zIndex = '-9999';
    document.body.appendChild(hiddenDiv);

    try {
      const { processedXml, detectedKey } = await processMusicXmlAsync(
        score.xmlContent,
        score.instrument,
        options
      );

      const osmd = new OpenSheetMusicDisplay(hiddenDiv, {
        autoResize: false,
        backend: 'svg',
        pageFormat: 'A4_P', // Força a paginação no formato A4 Retrato
        drawTitle: true,
        drawSubtitle: true,
        drawPartNames: true,
        drawFingerings: true,
        drawLyrics: true,
        drawingParameters: 'default', // Remove o 'compact' para respeitar as margens
      });

      osmd.zoom = 1.0;
      await osmd.load(processedXml);
      osmd.render();

      // Aguarda um pouco mais para garantir que as fontes musicais carregaram no DOM
      await new Promise(resolve => setTimeout(resolve, 800));

      const svgs = hiddenDiv.querySelectorAll('svg');
      const pages: PageRenderSource[] = [];

      for (let i = 0; i < svgs.length; i++) {
        const svg = svgs[i];
        
        if (!svg.getAttribute('xmlns')) {
          svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }

        // Pega as dimensões reais do SVG gerado pelo OSMD
        const svgWidth = parseFloat(svg.getAttribute('width') || '794');
        const svgHeight = parseFloat(svg.getAttribute('height') || '1123');

        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        const dataUrl = await new Promise<string>((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2.0; // 2x para impressão nítida
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              if (options.removeBlankPages) {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (isBlankImage(imgData)) {
                  console.log(`Página em branco detectada e removida: ${score.fileName} (Pág. ${i + 1})`);
                  URL.revokeObjectURL(url);
                  resolve('');
                  return;
                }
              }

              const res = canvas.toDataURL('image/png', 1.0);
              URL.revokeObjectURL(url);
              resolve(res);
            } else {
              URL.revokeObjectURL(url);
              resolve('');
            }
          };
          img.onerror = (err) => {
            console.error("Erro ao converter SVG para Imagem:", err);
            URL.revokeObjectURL(url);
            resolve('');
          };
          img.src = url;
        });

        if (dataUrl) {
          pages.push({
            dataUrl,
            scoreTitle: score.title || score.fileName.replace(/\.[^/.]+$/, ''),
            instrument: score.instrument,
            pageNumber: i + 1,
            detectedKey: detectedKey || score.detectedKey,
          });
        }
      }

      return pages;
    } finally {
      document.body.removeChild(hiddenDiv);
    }
  };

  const handleStartGeneration = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedFiles([]);

    try {
      const validScores = scores.filter(
        (s) =>
          s.status !== 'error' &&
          ((s.xmlContent && s.xmlContent.trim().length > 0) ||
            (s.pdfPages && s.pdfPages.length > 0))
      );

      if (validScores.length === 0) {
        throw new Error('Nenhuma partitura válida encontrada para exportação.');
      }

      const allPages: PageRenderSource[] = [];

      for (let i = 0; i < validScores.length; i++) {
        const score = validScores[i];
        setProgressMsg(`Processando no Python e renderizando: ${score.fileName} (${i + 1}/${validScores.length})...`);
        const pages = await renderScoreToPages(score);
        allPages.push(...pages);
      }

      if (allPages.length === 0) {
        throw new Error('Nenhuma página válida pôde ser renderizada.');
      }

      const results = [];

      for (const format of options.outputFormats) {
        let label = '';
        let fileNameSuffix = '';

        if (format === 'caderninho_a5') {
          label = 'Caderninho A5 (2 por folha A4)';
          fileNameSuffix = 'CADERNINHO_A5';
        } else if (format === 'kindle_10') {
          label = 'Kindle 10" Scribe (16:10 Paisagem)';
          fileNameSuffix = 'KINDLE_10_PAISAGEM';
        } else {
          label = 'Normal A4';
          fileNameSuffix = 'NORMAL_A4';
        }

        setProgressMsg(`Compondo PDF no formato: ${label}...`);

        const pdfBytes = await generatePdf(allPages, format, {
          removeBlankPages: options.removeBlankPages,
          jobTitle: scores.length === 1 ? scores[0].fileName : 'Caderno de Partituras',
        });

        const singleScoreName = scores.length === 1 ? scores[0].fileName.replace(/\.[^/.]+$/, '') : 'partituras_unificadas';
        const finalFileName = `${singleScoreName}_${fileNameSuffix}.pdf`;

        results.push({
          format,
          label,
          fileName: finalFileName,
          bytes: pdfBytes,
        });
      }

      setGeneratedFiles(results);
      setProgressMsg('Geração concluída com sucesso!');
    } catch (err: any) {
      console.error('Erro na exportação:', err);
      setErrorMsg(err?.message || 'Falha ao gerar os arquivos PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (generatedFiles.length === 0) return;
    const zip = new JSZip();

    for (const item of generatedFiles) {
      zip.file(item.fileName, item.bytes);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'partituras_formatadas.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-stone-900">
              Exportação & Impressão de Partituras
            </h3>
            <p className="text-xs text-stone-500">
              {scores.length} partitura(s) na ordem configurada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro no processamento</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {generatedFiles.length === 0 ? (
            <div className="space-y-4">
              
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-xs space-y-2 text-stone-700">
                <div className="font-semibold text-indigo-900 flex items-center gap-1.5">
                  <Music className="w-4 h-4" />
                  Anotações Musicais a serem aplicadas:
                </div>
                <ul className="space-y-1 list-disc list-inside ml-1">
                  {options.addFingerings && <li>Posições de Pistos / Varas</li>}
                  {options.addNoteNames && <li>Nomes das Notas em Português</li>}
                  {options.addKeyHeader && <li>Tom da Música no 1º Compasso</li>}
                  {options.transposeSolToFa && <li>Transposição Clave Sol ➔ Fá (se aplicável)</li>}
                  {!options.addFingerings && !options.addNoteNames && !options.addKeyHeader && !options.transposeSolToFa && (
                    <li className="text-stone-500 italic list-none">Nenhuma anotação musical selecionada.</li>
                  )}
                </ul>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs space-y-2 text-stone-600">
                <div className="font-semibold text-stone-900">Formatos de Saída Selecionados:</div>
                <ul className="space-y-1 list-disc list-inside ml-1">
                  {options.outputFormats.map((f) => (
                    <li key={f}>
                      {f === 'caderninho_a5' && 'Caderninho A5 (2 por folha A4 retrato empilhadas)'}
                      {f === 'kindle_10' && 'Kindle 10" Paisagem (16:10 Scribe alto contraste)'}
                      {f === 'normal_a4' && 'Normal A4 (1 página por folha)'}
                    </li>
                  ))}
                </ul>
                {options.removeBlankPages && (
                  <p className="text-emerald-700 font-medium pt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Remoção de páginas em branco ativada
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartGeneration}
                disabled={isGenerating || scores.length === 0}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Gerar PDFs Formatados</span>
                  </>
                )}
              </button>

              {progressMsg && (
                <div className="text-center text-xs font-mono text-indigo-600 animate-pulse bg-indigo-50 py-2 rounded-lg">
                  {progressMsg}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-800 font-medium text-xs bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Todos os arquivos foram gerados e estão prontos para download!</span>
              </div>

              <div className="space-y-2">
                {generatedFiles.map((item) => (
                  <div
                    key={item.format}
                    className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      {item.format === 'caderninho_a5' && <BookOpen className="w-5 h-5 text-indigo-600" />}
                      {item.format === 'kindle_10' && <Tablet className="w-5 h-5 text-indigo-600" />}
                      {item.format === 'normal_a4' && <FileText className="w-5 h-5 text-indigo-600" />}
                      <div>
                        <div className="text-xs font-semibold text-stone-900">{item.label}</div>
                        <div className="text-[11px] text-stone-500 truncate max-w-[200px]">
                          {item.fileName}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadPdfBlob(item.bytes, item.fileName)}
                      className="px-3 py-1.5 bg-white border border-stone-200 hover:border-indigo-600 text-stone-800 hover:text-indigo-600 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar</span>
                    </button>
                  </div>
                ))}
              </div>

              {generatedFiles.length > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Baixar Todos em Arquivo .ZIP</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setGeneratedFiles([])}
                className="w-full py-2 text-xs text-stone-500 hover:text-stone-800 transition-colors"
              >
                Gerar novamente com novas opções
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};