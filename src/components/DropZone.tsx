import React, { useRef, useState } from 'react';
import { InstrumentType, ScoreItem } from '../types/music';
import { FileUp, Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { extractMusicXml } from '../utils/musicLogic';
import { PDFDocument } from 'pdf-lib';

interface DropZoneProps {
  onAddScores: (scores: ScoreItem[]) => void;
  selectedDefaultInstrument: InstrumentType;
  onChangeDefaultInstrument: (inst: InstrumentType) => void;
}

interface RetryState {
  currentAttempt: number;
  maxAttempts: number;
  errors: string[];
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
  const [retryInfo, setRetryInfo] = useState<RetryState | null>(null);
  const [showErrorHistory, setShowErrorHistory] = useState(false);

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
    setRetryInfo(null);
    setShowErrorHistory(false);

    const fileList = Array.from(files);

    // 1. TRAVA: Não permitir selecionar mais de um PDF por vez
    const pdfFiles = fileList.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length > 1) {
      setUploadError('Operação bloqueada: envie apenas 1 arquivo PDF por vez.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    const newScores: ScoreItem[] = [];
    const MAX_RETRIES = 5;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase();

      let payload: any = {
        fileName: file.name,
        instrument: selectedDefaultInstrument,
      };

      try {
        if (ext === 'pdf') {
          // 2. TRAVA: Inspecionar número de páginas antes de enviar ao servidor
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          const totalPages = pdfDoc.getPageCount();

          if (totalPages > 2) {
            throw new Error(
              `O arquivo "${file.name}" possui ${totalPages} páginas. O limite máximo permitido é de 2 páginas.`
            );
          }

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
      } catch (e: any) {
        setUploadError(e.message || 'Erro ao carregar arquivo.');
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Loop de até 5 tentativas com recuperação
      let success = false;
      const attemptErrors: string[] = [];

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        setRetryInfo({
          currentAttempt: attempt,
          maxAttempts: MAX_RETRIES,
          errors: [...attemptErrors],
        });

        setStatusMessage(
          attempt === 1
            ? `Processando ${file.name}...`
            : `Tentativa ${attempt} de ${MAX_RETRIES} para ${file.name}...`
        );

        try {
          const res = await fetch('/api/process-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errDetail = errData.details || errData.error || `HTTP ${res.status}`;
            throw new Error(errDetail);
          }

          const data = await res.json();

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

          success = true;
          break;

        } catch (err: any) {
          const msg = err.message || 'Falha de processamento';
          attemptErrors.push(`Tentativa ${attempt}: ${msg}`);
          console.warn(`[Retry ${attempt}/${MAX_RETRIES}] ${msg}`);

          if (attempt < MAX_RETRIES) {
            setStatusMessage(`Tentativa ${attempt} falhou. Aguardando 2s para tentar novamente...`);
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            setUploadError(`Falha após ${MAX_RETRIES} tentativas: ${msg}`);
          }
        }
      }

      setRetryInfo((prev) => (prev ? { ...prev, errors: attemptErrors } : null));
    }

    setIsProcessing(false);
    setStatusMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (newScores.length > 0) onAddScores(newScores);
  };

  return (
    <div className="space-y-4">
      {/* 1. Modo / Instrumento */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 shadow-xs space-y-2.5">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-500 block">
          1. Instrumento ou Modo de Formatação:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {instrumentsList.map((inst) => (
            <button
              key={inst}
              type="button"
              onClick={() => onChangeDefaultInstrument(inst)}
              className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
                selectedDefaultInstrument === inst
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {inst}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Área de Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragging ? 'border-indigo-600 bg-indigo-50/50' : 'border-stone-300 hover:border-indigo-400 bg-white'
        } ${isProcessing ? 'pointer-events-none opacity-85' : ''}`}
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
            <p className="text-sm sm:text-base font-semibold text-stone-900">
              {isProcessing ? 'Processando partituras...' : '2. Toque ou arraste a partitura aqui'}
            </p>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              PDFs (máx. 1 arquivo e até 2 páginas) ou MusicXML (.xml, .mxl). O download do <strong>.ZIP</strong> é automático.
            </p>
          </div>

          {/* Indicador Visual do Loop de Tentativas */}
          {retryInfo && isProcessing && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1.5 text-indigo-950">
              <div className="flex items-center justify-center gap-2 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Tentativa {retryInfo.currentAttempt} de {retryInfo.maxAttempts}</span>
              </div>
              <p className="text-[11px] text-indigo-700">{statusMessage}</p>
            </div>
          )}

          {/* Exibição e Histórico de Erros */}
          {uploadError && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 text-left space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  Validação de Arquivo
                </span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] text-red-800 leading-normal">{uploadError}</p>

              {retryInfo && retryInfo.errors.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowErrorHistory(!showErrorHistory)}
                    className="text-[11px] text-indigo-700 font-semibold hover:underline flex items-center gap-1 pt-1"
                  >
                    <span>{showErrorHistory ? 'Ocultar detalhes das tentativas' : 'Ver detalhes das 5 tentativas'}</span>
                    {showErrorHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showErrorHistory && (
                    <ul className="mt-2 space-y-1 bg-white/70 p-2 rounded border border-red-100 font-mono text-[10px] text-red-950 max-h-32 overflow-y-auto">
                      {retryInfo.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};