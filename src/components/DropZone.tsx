import React, { useRef, useState } from 'react';
import { InstrumentType, ScoreItem } from '../types/music';
import { Upload, FileUp, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { extractMusicXml } from '../utils/musicLogic';
import { SAMPLE_SCORES } from '../utils/sampleScores';
import { renderPdfToImages } from '../utils/pdfReader';

interface DropZoneProps {
  onAddScores: (scores: ScoreItem[]) => void;
  selectedDefaultInstrument: InstrumentType;
  onChangeDefaultInstrument: (inst: InstrumentType) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onAddScores,
  selectedDefaultInstrument,
  onChangeDefaultInstrument,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const instrumentsList: InstrumentType[] = [
    'Trompete',
    'Trombone',
    'Tuba',
    'Bombardino',
    'Apenas Notas'
  ];

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError(null);
    setIsProcessing(true);
    setStatusMessage(`Processando ${files.length} arquivo(s)...`);

    const newScores: ScoreItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();

      try {
        if (ext === 'xml' || ext === 'musicxml') {
          setStatusMessage(`Lendo partitura MusicXML: ${file.name}...`);
          const text = await file.text();
          newScores.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            originalFileType: 'xml',
            instrument: selectedDefaultInstrument,
            xmlContent: text,
            status: 'ready'
          });
        } else if (ext === 'mxl') {
          setStatusMessage(`Descompactando partitura comprimida: ${file.name}...`);
          const arrayBuffer = await file.arrayBuffer();
          const xml = await extractMusicXml(arrayBuffer);
          newScores.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            originalFileType: 'mxl',
            instrument: selectedDefaultInstrument,
            xmlContent: xml,
            status: 'ready'
          });
        } else if (ext === 'pdf') {
          setStatusMessage(`Processando páginas da partitura PDF: ${file.name}...`);
          const arrayBuffer = await file.arrayBuffer();
          const renderedPages = await renderPdfToImages(arrayBuffer, true);
          if (renderedPages.length === 0) {
            throw new Error('O arquivo PDF não possui páginas visíveis de partitura ou todas eram em branco.');
          }
          newScores.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            originalFileType: 'pdf',
            instrument: selectedDefaultInstrument,
            xmlContent: '',
            pdfPages: renderedPages.map((p) => p.dataUrl),
            pageCount: renderedPages.length,
            status: 'ready',
          });
        } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
          setStatusMessage(`Carregando imagem da partitura: ${file.name}...`);
          const dataUrl = await readFileAsBase64(file);
          newScores.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            originalFileType: 'image',
            instrument: selectedDefaultInstrument,
            xmlContent: '',
            pdfPages: [dataUrl],
            pageCount: 1,
            status: 'ready',
          });
        } else {
          console.warn(`Formato não suportado: ${file.name}`);
        }
      } catch (err: any) {
        console.error('Falha ao processar arquivo:', err);
        const msg = err?.message || 'Falha ao processar arquivo.';
        setUploadError(msg);
        newScores.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          originalFileType: 'xml',
          instrument: selectedDefaultInstrument,
          xmlContent: '',
          status: 'error',
          errorMessage: msg
        });
      }
    }

    setIsProcessing(false);
    setStatusMessage(null);

    if (newScores.length > 0) {
      onAddScores(newScores);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const loadSampleScores = () => {
    const samples: ScoreItem[] = SAMPLE_SCORES.map(s => ({
      id: crypto.randomUUID(),
      fileName: s.fileName,
      originalFileType: 'xml',
      instrument: s.instrument,
      xmlContent: s.xml,
      title: s.name,
      status: 'ready'
    }));
    onAddScores(samples);
  };

  return (
    <div className="space-y-4">
      {/* Instrumento Padrão Seletor */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-stone-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Instrumento Destino:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {instrumentsList.map(inst => (
              <button
                key={inst}
                type="button"
                onClick={() => onChangeDefaultInstrument(inst)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  selectedDefaultInstrument === inst
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={loadSampleScores}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Carregar Partituras de Demonstração</span>
        </button>
      </div>

      {/* Upload Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]'
            : 'border-stone-300 hover:border-indigo-400 bg-white hover:bg-stone-50/50'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.xml,.mxl,.musicxml"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            ) : (
              <FileUp className="w-6 h-6" />
            )}
          </div>

          <div>
            <p className="text-base font-semibold text-stone-900">
              {isProcessing
                ? 'Processando e analisando partituras...'
                : 'Arraste as partituras aqui ou clique para selecionar'}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Suporta PDFs escaneados, fotos (.png, .jpg) e arquivos nativos MusicXML (.xml, .mxl)
            </p>
          </div>

          {statusMessage && (
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-900 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{statusMessage}</span>
            </div>
          )}

          {uploadError && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 text-left space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  Aviso no processamento
                </span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>
              <p className="text-red-800 leading-relaxed">{uploadError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
