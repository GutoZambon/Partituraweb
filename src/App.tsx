import React, { useState, useRef } from 'react';
import { InstrumentType, ScoreItem } from './types/music';
import { ScoreViewer } from './components/ScoreViewer';
import { extractMusicXml } from './utils/musicLogic';
import { PDFDocument } from 'pdf-lib';
import { 
  Music2, 
  FileUp, 
  Loader2, 
  Download, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

interface RetryState {
  currentAttempt: number;
  maxAttempts: number;
  errors: string[];
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados do fluxo
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instrument, setInstrument] = useState<InstrumentType>('Trompete');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<RetryState | null>(null);
  const [showErrorHistory, setShowErrorHistory] = useState(false);

  // Resultado
  const [processedScore, setProcessedScore] = useState<ScoreItem | null>(null);

  const instrumentsList: InstrumentType[] = [
    'Trompete',
    'Trombone',
    'Tuba',
    'Bombardino',
    'Apenas Notas',
    'Apenas Formatação',
  ];

  // 1. Seleção e validação do arquivo no navegador
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);

    const fileList = Array.from(files);

    // Trava de 1 arquivo por vez
    if (fileList.length > 1) {
      setErrorMessage('Operação bloqueada: envie apenas 1 arquivo por vez.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = fileList[0];
    const ext = file.name.split('.').pop()?.toLowerCase();

    // Trava de no máximo 2 páginas para PDFs
    if (ext === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const totalPages = pdfDoc.getPageCount();

        if (totalPages > 2) {
          setErrorMessage(`O arquivo possui ${totalPages} páginas. O limite máximo permitido é de 2 páginas.`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      } catch (e: any) {
        setErrorMessage('Falha ao validar as páginas do PDF.');
        return;
      }
    }

    setSelectedFile(file);
  };

  // Disparo do download do pacote ZIP
  const triggerDownload = (base64Data: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${base64Data}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2 e 3. Processamento com Loop de até 5 tentativas
  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setRetryInfo(null);
    setShowErrorHistory(false);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    let payload: any = {
      fileName: selectedFile.name,
      instrument,
    };

    try {
      if (ext === 'pdf' || ext === 'mscz' || ext === 'mscx') {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(selectedFile);
        });
        payload.fileBase64 = base64;
      } else if (ext === 'mxl') {
        // Descompactação no navegador com JSZip para economizar processamento do servidor
        const buf = await selectedFile.arrayBuffer();
        payload.xmlContent = await extractMusicXml(buf);
      } else if (ext === 'xml' || ext === 'musicxml') {
        payload.xmlContent = await selectedFile.text();
      }
    } catch (e: any) {
      setErrorMessage(`Erro ao preparar arquivo: ${e.message}`);
      setIsProcessing(false);
      return;
    }

    const MAX_RETRIES = 5;
    const attemptErrors: string[] = [];
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      setRetryInfo({
        currentAttempt: attempt,
        maxAttempts: MAX_RETRIES,
        errors: [...attemptErrors],
      });

      setStatusMessage(
        attempt === 1
          ? `Processando partitura...`
          : `Tentativa ${attempt} de ${MAX_RETRIES}...`
      );

      try {
        const res = await fetch('/api/process-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.details || errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        // 5. Download automático do pacote de 7 arquivos
        if (data.zipBase64) {
          triggerDownload(data.zipBase64, data.zipFileName);
        }

        // 4. Salva para exibir a pré-visualização A4
        setProcessedScore({
          id: crypto.randomUUID(),
          fileName: selectedFile.name,
          originalFileType: ext as any,
          instrument,
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

        if (attempt < MAX_RETRIES) {
          setStatusMessage(`Tentativa ${attempt} falhou. Aguardando 2s para tentar novamente...`);
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          setErrorMessage(`Falha após ${MAX_RETRIES} tentativas: ${msg}`);
        }
      }
    }

    setRetryInfo((prev) => (prev ? { ...prev, errors: attemptErrors } : null));
    setIsProcessing(false);
    setStatusMessage(null);
  };

  // 6. Limpar tudo para nova partitura
  const handleReset = () => {
    setSelectedFile(null);
    setProcessedScore(null);
    setErrorMessage(null);
    setRetryInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Mobile-First */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Music2 className="w-4 h-4" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-stone-900">
              PartiturasWeb
            </span>
          </div>

          {processedScore?.zipBase64 && (
            <button
              onClick={() => triggerDownload(processedScore.zipBase64!, processedScore.zipFileName!)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar ZIP</span>
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {!processedScore ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <h1 className="text-lg sm:text-xl font-bold text-stone-900">
                Processador de Partituras
              </h1>
              <p className="text-xs sm:text-sm text-stone-500">
                Gere os pacotes completos de A4, Kindle e arquivos editáveis para a sua banda.
              </p>
            </div>

            {/* 1º Seleção de Arquivo */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                1. Selecione a Partitura (PDF máx. 2 pág, XML ou MuseScore):
              </label>

              <div
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-stone-50/50 hover:bg-indigo-50/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xml,.mxl,.musicxml,.mscz,.mscx"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <FileUp className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                <span className="text-sm font-semibold text-stone-800 block">
                  {selectedFile ? selectedFile.name : 'Toque para escolher o arquivo'}
                </span>
                <span className="text-xs text-stone-500 block mt-0.5">
                  {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'PDF (até 2 pág), XML, MXL ou MSCZ'}
                </span>
              </div>
            </div>

            {/* 2º Seleção do Modo / Instrumento */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                2. Escolha o Instrumento ou Modo:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {instrumentsList.map((inst) => (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => setInstrument(inst)}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg transition-all text-center truncate ${
                      instrument === inst
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>

            {/* 3º Botão de Processar */}
            <button
              type="button"
              onClick={handleProcess}
              disabled={!selectedFile || isProcessing}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <span>Processar e Gerar Pacote</span>
              )}
            </button>

            {/* Indicador de Tentativas */}
            {retryInfo && isProcessing && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1 text-indigo-950 text-center">
                <div className="flex items-center justify-center gap-1.5 font-bold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Tentativa {retryInfo.currentAttempt} de {retryInfo.maxAttempts}</span>
                </div>
                <p className="text-[11px] text-indigo-700">{statusMessage}</p>
              </div>
            )}

            {/* Mensagem de Erro e Histórico de Tentativas */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    Erro no processamento
                  </span>
                  <button onClick={() => setErrorMessage(null)} className="text-stone-400 hover:text-stone-700">✕</button>
                </div>
                <p className="text-[11px] text-red-800">{errorMessage}</p>

                {retryInfo && retryInfo.errors.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowErrorHistory(!showErrorHistory)}
                      className="text-[11px] text-indigo-700 font-bold hover:underline flex items-center gap-1 pt-1"
                    >
                      <span>{showErrorHistory ? 'Ocultar detalhes das tentativas' : 'Ver detalhes das 5 tentativas'}</span>
                      {showErrorHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showErrorHistory && (
                      <ul className="mt-2 space-y-1 bg-white p-2 rounded border border-red-100 font-mono text-[10px] text-red-950 max-h-32 overflow-y-auto">
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
        ) : (
          /* 4º, 5º e 6º: Preview A4, Download e Botão Limpar */
          <div className="space-y-4">
            <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Partitura processada com sucesso!</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerDownload(processedScore.zipBase64!, processedScore.zipFileName!)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Pacote Completo (.ZIP)</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Nova Partitura</span>
                </button>
              </div>
            </div>

            {/* Pré-Visualização A4 Padrão */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <ScoreViewer
                score={processedScore}
                options={{
                  addFingerings: instrument !== 'Apenas Formatação' && instrument !== 'Apenas Notas',
                  addNoteNames: instrument !== 'Apenas Formatação',
                  addKeyHeader: instrument !== 'Apenas Formatação',
                  transposeSolToFa: instrument === 'Bombardino' || instrument === 'Trombone',
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}