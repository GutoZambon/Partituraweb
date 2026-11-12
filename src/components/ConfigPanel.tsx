import React from 'react';
import { ProcessingOptions } from '../types/music';
import { Settings } from 'lucide-react';

interface ConfigPanelProps {
  options: ProcessingOptions;
  onChange: (options: ProcessingOptions) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ options, onChange }) => {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
          <Settings className="w-4 h-4 text-indigo-600" />
          <span>Configurações das Anotações</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-stone-200 cursor-pointer hover:bg-stone-50">
          <input
            type="checkbox"
            checked={options.addFingerings}
            onChange={(e) => onChange({ ...options, addFingerings: e.target.checked })}
            className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300"
          />
          <div>
            <span className="font-semibold text-stone-900 block">Posições de Pisto / Vara</span>
            <span className="text-stone-500">Adiciona digitação abaixo de cada nota.</span>
          </div>
        </label>

        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-stone-200 cursor-pointer hover:bg-stone-50">
          <input
            type="checkbox"
            checked={options.addNoteNames}
            onChange={(e) => onChange({ ...options, addNoteNames: e.target.checked })}
            className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300"
          />
          <div>
            <span className="font-semibold text-stone-900 block">Nomes das Notas em Português</span>
            <span className="text-stone-500">Solfejo (Dó, Ré, Mi...).</span>
          </div>
        </label>

        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-stone-200 cursor-pointer hover:bg-stone-50">
          <input
            type="checkbox"
            checked={options.addKeyHeader}
            onChange={(e) => onChange({ ...options, addKeyHeader: e.target.checked })}
            className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300"
          />
          <div>
            <span className="font-semibold text-stone-900 block">Tom no 1º Compasso</span>
            <span className="text-stone-500">Identifica a armadura automaticamente.</span>
          </div>
        </label>

        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-stone-200 cursor-pointer hover:bg-stone-50">
          <input
            type="checkbox"
            checked={options.transposeSolToFa}
            onChange={(e) => onChange({ ...options, transposeSolToFa: e.target.checked })}
            className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300"
          />
          <div>
            <span className="font-semibold text-stone-900 block">Transpor Clave Sol ➔ Fá</span>
            <span className="text-stone-500">Para Bombardino e Trombone.</span>
          </div>
        </label>
      </div>
    </div>
  );
};