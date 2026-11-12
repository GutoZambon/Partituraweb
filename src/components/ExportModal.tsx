import React, { useState } from 'react';
import { ScoreItem, ProcessingOptions, OutputFormat } from '../types/music';
import { processMusicXmlAsync } from '../utils/musicLogic';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
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

/**
 * Replica a rotina preparar_xml_cadernin do script local:
 * Ajusta o MusicXML para Paisagem 296.93mm x 170mm (1670 x 956 décimos),
 * remove caixas de texto antigas para eliminar a moldura vertical gigante,
 * zera o distanciamento superior do compasso 1 e insere o título compacto centralizado.
 */
function prepararXmlKindle(xmlString: string, scoreFileName: string): string {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
    
    if (xmlDoc.querySelector('parsererror')) {
      return xmlString;
    }

    const root = xmlDoc.documentElement;

    // 1. Identificar o título da música
    let tituloMusica = '';
    const movTitle = root.querySelector('movement-title');
    if (movTitle && movTitle.textContent?.trim()) {
      tituloMusica = movTitle.textContent.trim();
    }

    if (!tituloMusica) {
      const credits = root.querySelectorAll('credit credit-words');
      for (let i = 0; i < credits.length; i++) {
        const txt = credits[i].textContent?.trim() || '';
        if (!['Tuba', 'Trombone', 'Trompete', 'Bombardino', 'Fanfarra Xamego'].includes(txt) && !/^\d+$/.test(txt)) {
          tituloMusica = txt;
          break;
        }
      }
    }

    if (!tituloMusica) {
      tituloMusica = scoreFileName
        .replace(/\.[^/.]+$/, '')
        .replace(/_pistos|_notas|_linha_baixo|-Tuba/g, '')
        .replace(/_/g, ' ')
        .trim();
    }

    // 2. Reconfigurar <defaults> <page-layout> para 296.93 x 170.00 mm (1670 x 956 décimos)
    let defaults = root.querySelector('defaults');
    if (!defaults) {
      defaults = xmlDoc.createElement('defaults');
      root.insertBefore(defaults, root.firstChild);
    }

    let pageLayout = defaults.querySelector('page-layout');
    if (pageLayout) {
      pageLayout.innerHTML = '';
    } else {
      pageLayout = xmlDoc.createElement('page-layout');
      defaults.appendChild(pageLayout);
    }

    const pw = xmlDoc.createElement('page-width');
    pw.textContent = '1670';
    pageLayout.appendChild(pw);

    const ph = xmlDoc.createElement('page-height');
    ph.textContent = '956';
    pageLayout.appendChild(ph);

    // Margens mínimas: 5mm (28 décimos) nas bordas e 0 na base
    for (const tipo of ['odd', 'even']) {
      const margins = xmlDoc.createElement('page-margins');
      margins.setAttribute('type', tipo);

      const lm = xmlDoc.createElement('left-margin');
      lm.textContent = '28';
      const rm = xmlDoc.createElement('right-margin');
      rm.textContent = '28';
      const tm = xmlDoc.createElement('top-margin');
      tm.textContent = '28';
      const bm = xmlDoc.createElement('bottom-margin');
      bm.textContent = '0';

      margins.appendChild(lm);
      margins.appendChild(rm);
      margins.appendChild(tm);
      margins.appendChild(bm);
      pageLayout.appendChild(margins);
    }

    // 3. Remover títulos e cabeçalhos legados para não empurrar os sistemas para baixo
    root.querySelectorAll('credit').forEach(el => el.remove());
    if (movTitle) movTitle.remove();
    const work = root.querySelector('work');
    if (work) work.remove();
    const ident = root.querySelector('identification');
    if (ident) {
      ident.querySelectorAll('creator').forEach(el => el.remove());
    }

    // 4. Remover top-system-distance do compasso 1 para colar no topo
    const m1 = root.querySelector('part measure');
    if (m1) {
      const topDist = m1.querySelector('print system-layout top-system-distance');
      if (topDist) topDist.remove();
    }

    // 5. Adicionar o título pequeno centralizado no topo (centro x=835 décimos)
    const novoCredit = xmlDoc.createElement('credit');
    novoCredit.setAttribute('page', '1');
    const novoWords = xmlDoc.createElement('credit-words');
    novoWords.setAttribute('default-x', '835');
    novoWords.setAttribute('default-y', '935');
    novoWords.setAttribute('font-family', 'Edwin');
    novoWords.setAttribute('font-size', '14');
    novoWords.setAttribute('font-weight', 'bold');
    novoWords.setAttribute('justify', 'center');
    novoWords.setAttribute('valign', 'top');
    novoWords.textContent = tituloMusica;
    novoCredit.appendChild(novoWords);

    const firstPart = root.querySelector('part');
    if (firstPart) {
      root.insertBefore(novoCredit, firstPart);
    } else {
      root.appendChild(novoCredit);
    }

    return new XMLSerializer().serializeToString(xmlDoc);
  } catch (err) {
    console.warn('[Kindle Layout] Falha ao pré-processar XML, mantendo original:', err);
    return xmlString;
  }
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

  const downloadFile = (bytes: Uint8Array, fileName: string) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

      const results = [];

      for (const format of options.outputFormats) {
        let label = '';
        let fileNameSuffix = '';
        let doc: jsPDF;

        // Configuração do Documento PDF com dimensões correspondentes
        if (format === 'caderninho_a5') {
          label = 'Caderninho A5 (2 por folha A4)';
          fileNameSuffix = 'CADERNINHO_A5';
          doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        } else if (format === 'kindle_10') {
          // Exatas dimensões do Cadernin local: 296,93mm x 170,00mm
          label = 'Kindle 10" / Cadernin (297x170mm Paisagem)';
          fileNameSuffix = 'KINDLE_CADERNIN';
          doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [170.0, 296.93] });
        } else {
          label = 'Normal A4';
          fileNameSuffix = 'NORMAL_A4';
          doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        }

        setProgressMsg(`Iniciando geração vetorial: ${label}...`);
        let globalPageCount = 0;

        for (let sIdx = 0; sIdx < validScores.length; sIdx++) {
          const score = validScores[sIdx];
          setProgressMsg(`Processando ${score.fileName} (${sIdx + 1}/${validScores.length})...`);

          // Fallback para PDFs ou Imagens originais sem dados XML
          if (score.originalFileType === 'pdf' || score.originalFileType === 'image') {
            for (const pageUrl of score.pdfPages || []) {
              const pageWidth = doc.internal.pageSize.getWidth();
              const pageHeight = doc.internal.pageSize.getHeight();

              if (format === 'caderninho_a5') {
                const halfHeight = pageHeight / 2;
                if (globalPageCount > 0 && globalPageCount % 2 === 0) doc.addPage();

                const isBottomHalf = globalPageCount % 2 === 1;
                const yOffset = isBottomHalf ? halfHeight : 0;

                doc.addImage(pageUrl, 'PNG', 0, yOffset, pageWidth, halfHeight);

                if (!isBottomHalf) {
                  doc.setDrawColor(200, 200, 200);
                  doc.setLineDashPattern([2, 2], 0);
                  doc.line(0, halfHeight, pageWidth, halfHeight);
                  doc.setLineDashPattern([], 0);
                }
              } else {
                if (globalPageCount > 0) doc.addPage();
                doc.addImage(pageUrl, 'PNG', 0, 0, pageWidth, pageHeight);
              }
              globalPageCount++;
            }
            continue;
          }

          // Container temporário para renderização vetorial
          const hiddenDiv = document.createElement('div');
          hiddenDiv.style.position = 'fixed';
          hiddenDiv.style.top = '0';
          hiddenDiv.style.left = '0';

          if (format === 'caderninho_a5') {
            hiddenDiv.style.width = '794px';
            hiddenDiv.style.height = '561px';
          } else if (format === 'kindle_10') {
            // 296,93mm x 170,00mm a 96 DPI: 1122px x 643px
            hiddenDiv.style.width = '1122px';
            hiddenDiv.style.height = '643px';
          } else {
            hiddenDiv.style.width = '794px';
            hiddenDiv.style.height = '1123px';
          }

          hiddenDiv.style.background = 'white';
          hiddenDiv.style.opacity = '0';
          hiddenDiv.style.pointerEvents = 'none';
          hiddenDiv.style.zIndex = '-9999';
          document.body.appendChild(hiddenDiv);

          try {
            const { processedXml } = await processMusicXmlAsync(
              score.xmlContent,
              score.instrument,
              options
            );

            // Se for Kindle, aplica a higienização de caixas de texto e layout de 296.93x170mm
            const xmlFinal = format === 'kindle_10'
              ? prepararXmlKindle(processedXml, score.fileName)
              : processedXml;

            let osmdPageFormat: string | undefined = 'A4_P';
            if (format === 'caderninho_a5') osmdPageFormat = 'A5_P';
            if (format === 'kindle_10') osmdPageFormat = undefined; // Permite que o OSMD use o tamanho do container (1122x643px) e o layout embutido

            const osmd = new OpenSheetMusicDisplay(hiddenDiv, {
              autoResize: false,
              backend: 'svg',
              pageFormat: osmdPageFormat,
              drawTitle: format !== 'kindle_10', // Título do Kindle já está embutido de forma compacta no XML
              drawSubtitle: format !== 'kindle_10',
              drawPartNames: false,
              drawFingerings: true,
              drawLyrics: true,
              drawingParameters: format === 'kindle_10' ? 'compact' : 'default',
            });

            // Regras de compactação equivalentes ao estilo_cadernin.mss
            if (format === 'kindle_10') {
              osmd.rules.CompactMode = true;
              osmd.rules.BetweenStaffDistance = 4.0;
              osmd.rules.MinSystemDistance = 4.5;
              osmd.rules.StaffDistance = 4.0;
              osmd.rules.PageTopMargin = 0.5;
              osmd.rules.PageBottomMargin = 0.0;
              osmd.rules.PageLeftMargin = 0.5;
              osmd.rules.PageRightMargin = 0.5;
            }

            osmd.zoom = 1.0;
            await osmd.load(xmlFinal);
            osmd.render();

            await new Promise(resolve => setTimeout(resolve, 800));

            const svgs = hiddenDiv.querySelectorAll('svg');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            for (let i = 0; i < svgs.length; i++) {
              const svg = svgs[i];
              if (!svg.getAttribute('xmlns')) {
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
              }

              if (format === 'caderninho_a5') {
                const halfHeight = pageHeight / 2;
                if (globalPageCount > 0 && globalPageCount % 2 === 0) doc.addPage();

                const isBottomHalf = globalPageCount % 2 === 1;
                const yOffset = isBottomHalf ? halfHeight : 0;

                await doc.svg(svg, {
                  x: 0,
                  y: yOffset,
                  width: pageWidth,
                  height: halfHeight,
                });

                if (!isBottomHalf) {
                  doc.setDrawColor(200, 200, 200);
                  doc.setLineDashPattern([2, 2], 0);
                  doc.line(0, halfHeight, pageWidth, halfHeight);
                  doc.setLineDashPattern([], 0);
                }
              } else {
                if (globalPageCount > 0) doc.addPage();

                await doc.svg(svg, {
                  x: 0,
                  y: 0,
                  width: pageWidth,
                  height: pageHeight,
                });
              }
              globalPageCount++;
            }
          } finally {
            document.body.removeChild(hiddenDiv);
          }
        }

        setProgressMsg(`Finalizando arquivo ${label}...`);
        const pdfBytes = doc.output('arraybuffer');
        const singleScoreName = scores.length === 1 ? scores[0].fileName.replace(/\.[^/.]+$/, '') : 'partituras_unificadas';
        const finalFileName = `${singleScoreName}_${fileNameSuffix}.pdf`;

        results.push({
          format,
          label,
          fileName: finalFileName,
          bytes: new Uint8Array(pdfBytes),
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
                      {f === 'kindle_10' && 'Kindle 10" / Cadernin (297x170mm Paisagem)'}
                      {f === 'normal_a4' && 'Normal A4 (1 página por folha)'}
                    </li>
                  ))}
                </ul>
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
                    <span>Gerar PDFs Vetoriais</span>
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
                      onClick={() => downloadFile(item.bytes, item.fileName)}
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

