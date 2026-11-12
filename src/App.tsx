import React, { useState } from 'react';
import { ScoreItem, ProcessingOptions, InstrumentType } from './types/music';
import { ConfigPanel } from './components/ConfigPanel';
import { DropZone } from './components/DropZone';
import { ScoreReorderList } from './components/ScoreReorderList';
import { ScoreViewer } from './components/ScoreViewer';
import { Music2, Download } from 'lucide-react';

export default function App() {
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [defaultInstrument, setDefaultInstrument] = useState<InstrumentType>('Trompete');

  const [options, setOptions] = useState<ProcessingOptions>({
    addFingerings: true,
    addNoteNames: true,
    addKeyHeader: true,
    transposeSolToFa: true,
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
    setScores((prev) => prev.map((s) => (s.id === id ? { ...s, instrument } : s)));
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

  const currentScore = scores.find((s) => s.id === selectedScoreId) || scores[0] || null;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-stone-900">
              PartiturasWeb
            </span>
          </div>

          {currentScore?.zipBase64 && (
            <a
              href={`data:application/zip;base64,${currentScore.zipBase64}`}
              download={currentScore.zipFileName || 'pacote_partituras.zip'}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Pacote Completo (.ZIP)</span>
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <DropZone
              onAddScores={handleAddScores}
              selectedDefaultInstrument={defaultInstrument}
              onChangeDefaultInstrument={setDefaultInstrument}
            />

            <ConfigPanel options={options} onChange={setOptions} />

            <ScoreReorderList
              scores={scores}
              selectedScoreId={selectedScoreId}
              onSelectScore={setSelectedScoreId}
              onUpdateInstrument={handleUpdateInstrument}
              onMoveScore={handleMoveScore}
              onRemoveScore={handleRemoveScore}
            />
          </div>

          <div className="lg:col-span-7 sticky top-24">
            <ScoreViewer score={currentScore} options={options} />
          </div>
        </div>
      </main>
    </div>
  );
}