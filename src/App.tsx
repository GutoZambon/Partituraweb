import React, { useState } from 'react';
import { ScoreItem, ProcessingOptions, InstrumentType } from './types/music';
import { ConfigPanel } from './components/ConfigPanel';
import { DropZone } from './components/DropZone';
import { ScoreReorderList } from './components/ScoreReorderList';
import { ScoreViewer } from './components/ScoreViewer';
import { ExportModal } from './components/ExportModal';
import {
  Music2,
  Printer,
  Sparkles,
  BookOpen,
  Tablet,
  FolderArchive,
  Music,
  Sliders,
  FileCheck
} from 'lucide-react';

export default function App() {
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [defaultInstrument, setDefaultInstrument] = useState<InstrumentType>('Trompete');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'files' | 'viewer' | 'config'>('files');

  const [options, setOptions] = useState<ProcessingOptions>({
    addFingerings: true,
    addNoteNames: true,
    addKeyHeader: true,
    transposeSolToFa: true,
    removeBlankPages: true,
    outputFormats: ['caderninho_a5', 'kindle_10', 'normal_a4'],
    unifiedPrint: true,
  });

  const handleAddScores = (newScores: ScoreItem[]) => {
    setScores((prev) => {
      const updated = [...prev, ...newScores];
      if (updated.length > 0) {
        const firstValid = newScores.find((s) => s.status !== 'error') || updated[0];
        setSelectedScoreId(firstValid.id);
        // No celular, troca automaticamente para a aba do visualizador para conferir o resultado
        setMobileTab('viewer');
      }
      return updated;
    });
  };

  const handleUpdateInstrument = (id: string, instrument: InstrumentType) => {
    setScores((prev) =>
      prev.map((s) => (s.id === id ? { ...s, instrument } : s))
    );
  };

  const handleMoveScore = (index: number, direction: 'up' | 'down') => {
    setScores((prev) => {
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[nextIndex];
      copy[nextIndex] = temp;
      return copy;
    });
  };

  const handleRemoveScore = (id: string) => {
    setScores((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (selectedScoreId === id) {
        setSelectedScoreId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  const handleSelectScoreAndTab = (id: string) => {
    setSelectedScoreId(id);
    setMobileTab('viewer');
  };

  const validScores = scores.filter(
    (s) => s.status !== 'error' && (s.xmlContent || (s.pdfPages && s.pdfPages.length > 0))
  );

  const currentScore =
    scores.find(
      (s) =>
        s.id === selectedScoreId &&
        s.status !== 'error' &&
        (s.xmlContent || (s.pdfPages && s.pdfPages.length > 0))
    ) ||
    validScores[0] ||
    null;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-stone-900 leading-tight block">
                PartiturasWeb
              </span>
              <span className="text-[10px] text-stone-500 font-medium hidden sm:block">
                Metais & OMR Audiveris
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-600">
            <span className="hover:text-stone-900 transition-colors cursor-default">
              Carregue sua partitura (.pdf ou arquivos musescore) para adicionar posições dos pistos e/ou notas. <br />
              Formatações de impressão ainda em desenvolvimento.
            </span>
            
          </nav>

          {/* Action button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              disabled={validScores.length === 0}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-all shadow-xs flex items-center gap-2 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Exportar ({validScores.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6 pb-24 lg:pb-8">
        {/* Intro Banner (Compacto no celular) */}
        <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Automação para Bandas Marciais & Orquestras</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-stone-900 tracking-tight leading-snug">
              Processamento Inteligente de Partituras para Metais
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Compatibilidade nativa com MuseScore (.mscz), MusicXML e PDFs via Audiveris OMR.
            </p>
          </div>

          
        </section>

        {/* Seletor de Abas Mobile (Apenas em telas menores que lg) */}
        <div className="lg:hidden bg-stone-200/80 p-1 rounded-xl flex items-center justify-between gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setMobileTab('files')}
            className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === 'files'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Arquivos ({scores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('viewer')}
            className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === 'viewer'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Visualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('config')}
            className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === 'config'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Opções</span>
          </button>
        </div>

        {/* 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (No mobile, exibido dependendo da aba ativa) */}
          <div
            className={`lg:col-span-5 space-y-6 ${
              mobileTab === 'files' || mobileTab === 'config' ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* Seção Arquivos / Upload */}
            {(mobileTab === 'files' || window.innerWidth >= 1024) && (
              <div className="space-y-6">
                <DropZone
                  onAddScores={handleAddScores}
                  selectedDefaultInstrument={defaultInstrument}
                  onChangeDefaultInstrument={setDefaultInstrument}
                />

                <ScoreReorderList
                  scores={scores}
                  selectedScoreId={selectedScoreId}
                  onSelectScore={handleSelectScoreAndTab}
                  onUpdateInstrument={handleUpdateInstrument}
                  onMoveScore={handleMoveScore}
                  onRemoveScore={handleRemoveScore}
                />
              </div>
            )}

            {/* Seção Configurações */}
            {(mobileTab === 'config' || window.innerWidth >= 1024) && (
              <ConfigPanel options={options} onChange={setOptions} />
            )}
          </div>

          {/* Right Column: Interactive Score Viewer */}
          <div
            className={`lg:col-span-7 lg:sticky lg:top-24 ${
              mobileTab === 'viewer' ? 'block' : 'hidden lg:block'
            }`}
          >
            <ScoreViewer score={currentScore} options={options} />
          </div>
        </div>
      </main>

      {/* Floating Bottom Bar no Celular para Ação Rápida */}
      <aside aria-label="Ações rápidas de exportação" className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-stone-200 z-30 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-semibold text-stone-900 block">
              {validScores.length} partitura(s) pronta(s)
            </span>
            <span className="text-stone-500 text-[11px]">
              Caderninho A5 & Kindle
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            disabled={validScores.length === 0}
            className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar PDFs</span>
          </button>
        </div>
      </aside>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        scores={scores}
        options={options}
      />

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-8 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <p>© 2026 PartiturasWeb · Audiveris OMR, MuseScore & Python Music21.</p>
          <div className="flex items-center gap-3">
            <span>Trompete</span>
            <span>·</span>
            <span>Trombone</span>
            <span>·</span>
            <span>Tuba</span>
            <span>·</span>
            <span>Bombardino</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
