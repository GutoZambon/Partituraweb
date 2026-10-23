import React, { useState } from 'react';
import { ScoreItem, ProcessingOptions, InstrumentType } from './types/music';
import { ConfigPanel } from './components/ConfigPanel';
import { DropZone } from './components/DropZone';
import { ScoreReorderList } from './components/ScoreReorderList';
import { ScoreViewer } from './components/ScoreViewer';
import { ExportModal } from './components/ExportModal';
import { Music2, Printer, Sparkles, BookOpen, Tablet, HelpCircle } from 'lucide-react';

export default function App() {
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [defaultInstrument, setDefaultInstrument] = useState<InstrumentType>('Trompete');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [options, setOptions] = useState<ProcessingOptions>({
    addFingerings: true,
    addNoteNames: true,
    addKeyHeader: true,
    transposeSolToFa: true,
    removeBlankPages: true,
    outputFormats: ['caderninho_a5', 'kindle_10'],
    unifiedPrint: true,
  });

  const handleAddScores = (newScores: ScoreItem[]) => {
    setScores((prev) => {
      const updated = [...prev, ...newScores];
      if (!selectedScoreId && updated.length > 0) {
        setSelectedScoreId(updated[0].id);
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
      {/* Top Bar Contract (1 Row: Brand - Links - 1 Action) */}
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap">
              PartiturasWeb
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            <a href="#pipeline" className="hover:text-stone-900 transition-colors whitespace-nowrap">
              Pipeline de Metais
            </a>
            <a href="#caderninho" className="hover:text-stone-900 transition-colors whitespace-nowrap">
              Caderninho A5 2-em-1
            </a>
            <a href="#kindle" className="hover:text-stone-900 transition-colors whitespace-nowrap">
              Kindle 10" Scribe
            </a>
            <a href="#omr" className="hover:text-stone-900 transition-colors whitespace-nowrap">
              Reconhecimento Ótico
            </a>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              disabled={validScores.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-all shadow-xs flex items-center gap-2 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Exportar ({validScores.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Intro Banner */}
        <section className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 tracking-wide uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Automação para Bandas Marciais & Orquestras</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">
              Processamento Inteligente de Partituras para Metais
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              Adicione posições de pisto, posições de vara (1–7), nomes de notas em português, detecção automática do tom no primeiro compasso e diagramação direta para Caderninho A5 e Kindle 10''.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-600">
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>2 Pág. por Folha A4</span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg">
              <Tablet className="w-4 h-4 text-indigo-600" />
              <span>16:10 Paisagem</span>
            </div>
          </div>
        </section>

        {/* 2-Column Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Upload, Settings & Order (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* File Upload DropZone */}
            <DropZone
              onAddScores={handleAddScores}
              selectedDefaultInstrument={defaultInstrument}
              onChangeDefaultInstrument={setDefaultInstrument}
            />

            {/* Config Panel */}
            <ConfigPanel options={options} onChange={setOptions} />

            {/* Queue & Reorder List */}
            <ScoreReorderList
              scores={scores}
              selectedScoreId={selectedScoreId}
              onSelectScore={setSelectedScoreId}
              onUpdateInstrument={handleUpdateInstrument}
              onMoveScore={handleMoveScore}
              onRemoveScore={handleRemoveScore}
            />
          </div>

          {/* Right Column: Interactive Score Viewer (7 cols) */}
          <div className="lg:col-span-7 sticky top-24">
            <ScoreViewer
              score={currentScore}
              options={options}
            />
          </div>
        </div>
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        scores={scores}
        options={options}
      />

      {/* Minimal Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <p>© 2026 PartiturasWeb · Acesso público gratuito e sem necessidade de cadastro.</p>
          <div className="flex items-center gap-4">
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
