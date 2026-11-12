import React, { useRef, useState } from 'react';
import { InstrumentType, ScoreItem } from '../types/music';
import { FileUp, Loader2, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { extractMusicXml } from '../utils/musicLogic';
import { SAMPLE_SCORES } from '../utils/sampleScores';

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
    'Apenas Notas',
    'Apenas Formatação',
  ];

  const triggerDownload = (base64Data: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${base64Data}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError(null);
    setIsProcessing(true);
    const newScores: ScoreItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();

      try {
        setStatusMessage(`Processando e diagramando: ${file.name}...`);

        let payload: any = {
          fileName: file.name,
          instrument: selectedDefaultInstrument,
        };

        if (ext === 'pdf') {
          setStatusMessage(`Executando OMR e renderizando PDFs e MIDI para: ${file.name}...`);
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
          });
          payload.fileBase64 = base64;
        } else if (ext === 'mxl') {
          const buf = await file.arrayBuffer();
          payload.xmlContent = await extractMusicXml(buf);
        } else if (ext === 'xml' || ext === 'musicxml') {
          payload.xmlContent = await file.text();
        } else {
          continue;
        }

        const res = await fetch('/api/process-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Falha ao processar partitura no servidor.');
        }

        const data = await res.json();

        // Dispara o download automático do ZIP completo
        if (data.zipBase64) {
          triggerDownload(data.zipBase64, data.zipFileName);
        }

        newScores.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          originalFileType: ext as any,
          instrument: selectedDefaultInstrument,
          xmlContent: data.processedXml,
          detectedKey: data.detectedKey,
          zipBase64: data.zipBase64,
          zipFileName: data.zipFileName,
          status: 'ready',
        });

      } catch (err: any) {
        setUploadError(err.message || 'Erro durante o processamento.');
      }
    }

    setIsProcessing(false);
    setStatusMessage(null);
    if (newScores.length > 0) onAddScores(newScores);
  };

  const loadSample = () => {
    const s = SAMPLE_SCORES[0];
    if (s) {
      onAddScores([{
        id: crypto.randomUUID(),
        fileName: s.fileName,
        originalFileType: 'xml',
        instrument: s.instrument,
        xmlContent: s.xml,
        title: s.name,
        status: 'ready',
      }]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Modo / Instrumento */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block">
          1. Escolha o Instrumento ou Modo:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {instrumentsList.map((inst) => (
            <button
              key={inst}
              type="button"
              onClick={() => onChangeDefaultInstrument(inst)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedDefaultInstrument === inst
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {inst}
            </button>
          ))}
        </div>
      </div>

      {/* Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]' : 'border-stone-300 hover:border-indigo-400 bg-white'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xml,.mxl,.musicxml"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> : <FileUp className="w-6 h-6" />}
          </div>

          <div>
            <p className="text-base font-semibold text-stone-900">
              {isProcessing ? 'Processando e gerando pacote completo...' : '2. Arraste a partitura aqui (PDF ou XML)'}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              O download do arquivo .ZIP (PDF Normal A4, Caderninho A5, Kindle Paisagem, MIDI e XML) iniciará automaticamente.
            </p>
          </div>

          {statusMessage && (
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-900 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{statusMessage}</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 text-left flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p>{uploadError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};