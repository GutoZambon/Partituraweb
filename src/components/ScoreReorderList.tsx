import React from 'react';
import { ScoreItem, InstrumentType } from '../types/music';
import { ChevronUp, ChevronDown, Eye, Trash2, Music, AlertCircle, FileText } from 'lucide-react';

interface ScoreReorderListProps {
  scores: ScoreItem[];
  selectedScoreId: string | null;
  onSelectScore: (id: string) => void;
  onUpdateInstrument: (id: string, instrument: InstrumentType) => void;
  onMoveScore: (index: number, direction: 'up' | 'down') => void;
  onRemoveScore: (id: string) => void;
}

export const ScoreReorderList: React.FC<ScoreReorderListProps> = ({
  scores,
  selectedScoreId,
  onSelectScore,
  onUpdateInstrument,
  onMoveScore,
  onRemoveScore,
}) => {
  const instruments: InstrumentType[] = [
    'Trompete',
    'Trombone',
    'Tuba',
    'Bombardino',
    'Apenas Notas',
  ];

  if (scores.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-500">
        <Music className="w-8 h-8 mx-auto text-stone-300 mb-2" />
        <p className="text-sm font-medium text-stone-700">Nenhuma partitura na fila</p>
        <p className="text-xs text-stone-400 mt-1">
          Envie partituras acima ou carregue as de demonstração para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
      <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">
            Fila de Partituras & Ordem de Impressão
          </h3>
          <p className="text-xs text-stone-500">
            {scores.length} arquivo(s) prontos. Reordene para montar o caderno na ordem desejada.
          </p>
        </div>
      </div>

      <div className="divide-y divide-stone-100">
        {scores.map((score, index) => {
          const isSelected = score.id === selectedScoreId;

          return (
            <div
              key={score.id}
              className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                isSelected ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-500/20' : 'hover:bg-stone-50/60'
              }`}
            >
              {/* Order & Title */}
              <div className="flex items-center gap-3 min-w-[240px] flex-1">
                <span className="w-6 h-6 rounded-md bg-stone-100 text-stone-700 text-xs font-mono font-medium flex items-center justify-center shrink-0">
                  {index + 1}
                </span>

                <div className="space-y-0.5 truncate">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900 truncate">
                      {score.title || score.fileName}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 uppercase">
                      {score.originalFileType}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 flex items-center gap-2">
                    <span className="truncate">{score.fileName}</span>
                    {score.status === 'error' ? (
                      <span className="text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        {score.errorMessage || 'Erro ao carregar'}
                      </span>
                    ) : (
                      score.detectedKey && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-indigo-700">{score.detectedKey}</span>
                        </>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Instrument Selector */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-stone-500">Instrumento:</span>
                  <select
                    value={score.instrument}
                    onChange={(e) => onUpdateInstrument(score.id, e.target.value as InstrumentType)}
                    className="text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {instruments.map((inst) => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reorder Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveScore(index, 'up')}
                    disabled={index === 0}
                    title="Mover para cima"
                    className="p-1 rounded hover:bg-stone-200 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveScore(index, 'down')}
                    disabled={index === scores.length - 1}
                    title="Mover para baixo"
                    className="p-1 rounded hover:bg-stone-200 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={() => onSelectScore(score.id)}
                  disabled={
                    score.status === 'error' ||
                    (!score.xmlContent && (!score.pdfPages || score.pdfPages.length === 0))
                  }
                  title={score.status === 'error' ? 'Partitura com erro' : 'Pré-visualizar partitura'}
                  className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver</span>
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => onRemoveScore(score.id)}
                  title="Remover partitura"
                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
