import React from 'react';
import { ProcessingOptions, OutputFormat } from '../types/music';
import { Settings, FileText, BookOpen, Tablet, Sparkles, Scissors, Music } from 'lucide-react';

interface ConfigPanelProps {
  options: ProcessingOptions;
  onChange: (options: ProcessingOptions) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ options, onChange }) => {
  const toggleFormat = (fmt: OutputFormat) => {
    const exists = options.outputFormats.includes(fmt);
    let newFormats: OutputFormat[];
    if (exists) {
      if (options.outputFormats.length === 1) return; // Keep at least one
      newFormats = options.outputFormats.filter(f => f !== fmt);
    } else {
      newFormats = [...options.outputFormats, fmt];
    }
    onChange({ ...options, outputFormats: newFormats });
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2 text-stone-900 font-semibold">
          <Settings className="w-5 h-5 text-indigo-600" />
          <span>Configurações de Processamento & Layout</span>
        </div>
        <span className="text-xs text-stone-500 font-mono">Pipeline v2.0</span>
      </div>

      {/* Anotações Musicais */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Anotações & Regras Musicais
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Pistos / Varas */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-stone-200 hover:border-indigo-300 hover:bg-stone-50/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={options.addFingerings}
              onChange={(e) => onChange({ ...options, addFingerings: e.target.checked })}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500"
            />
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-stone-900 block">Posições de Pistos / Varas</span>
              <p className="text-xs text-stone-500 leading-relaxed">
                Adiciona digitação abaixo de cada nota (Trompete, Tuba, Bombardino) ou posição 1 a 7 (Trombone).
              </p>
            </div>
          </label>

          {/* Nomes das Notas */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-stone-200 hover:border-indigo-300 hover:bg-stone-50/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={options.addNoteNames}
              onChange={(e) => onChange({ ...options, addNoteNames: e.target.checked })}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500"
            />
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-stone-900 block">Nomes das Notas em Português</span>
              <p className="text-xs text-stone-500 leading-relaxed">
                Insere a nomenclatura de solfejo (Dó, Ré, Mi, Fá, Sol, Lá, Si) com sustenidos e bemóis.
              </p>
            </div>
          </label>

          {/* Tom da Música */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-stone-200 hover:border-indigo-300 hover:bg-stone-50/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={options.addKeyHeader}
              onChange={(e) => onChange({ ...options, addKeyHeader: e.target.checked })}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500"
            />
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-stone-900 block">Tom da Música no 1º Compasso</span>
              <p className="text-xs text-stone-500 leading-relaxed">
                Detecta a armadura de clave e escreve o tom legível no topo (ex: "Tom: Si♭ Maior").
              </p>
            </div>
          </label>

          {/* Transposição Automática */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-stone-200 hover:border-indigo-300 hover:bg-stone-50/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={options.transposeSolToFa}
              onChange={(e) => onChange({ ...options, transposeSolToFa: e.target.checked })}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500"
            />
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-stone-900 block">Transposição Clave Sol ➔ Fá (-9M)</span>
              <p className="text-xs text-stone-500 leading-relaxed">
                Para Bombardino e Trombone escritos em clave de Sol, converte para clave de Fá real.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Formatos de Saída & Impressão */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Formatos de Impressão e Dispositivos
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Caderninho A5 2-em-1 */}
          <button
            type="button"
            onClick={() => toggleFormat('caderninho_a5')}
            className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
              options.outputFormats.includes('caderninho_a5')
                ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <BookOpen className={`w-5 h-5 ${options.outputFormats.includes('caderninho_a5') ? 'text-indigo-600' : 'text-stone-400'}`} />
              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                options.outputFormats.includes('caderninho_a5') ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                2 por Folha A4
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-stone-900">Caderninho A5</div>
              <p className="text-xs text-stone-500 mt-1 leading-normal">
                2 páginas empilhadas em folha A4 retrato com linha tracejada de corte ao centro.
              </p>
            </div>
          </button>

          {/* Kindle 10" Paisagem */}
          <button
            type="button"
            onClick={() => toggleFormat('kindle_10')}
            className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
              options.outputFormats.includes('kindle_10')
                ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Tablet className={`w-5 h-5 ${options.outputFormats.includes('kindle_10') ? 'text-indigo-600' : 'text-stone-400'}`} />
              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                options.outputFormats.includes('kindle_10') ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                16:10 Paisagem
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-stone-900">Kindle 10'' (Scribe)</div>
              <p className="text-xs text-stone-500 mt-1 leading-normal">
                Dimensionada em tela cheia com alto contraste para leitura e-ink na estante.
              </p>
            </div>
          </button>

          {/* Normal A4 */}
          <button
            type="button"
            onClick={() => toggleFormat('normal_a4')}
            className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
              options.outputFormats.includes('normal_a4')
                ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <FileText className={`w-5 h-5 ${options.outputFormats.includes('normal_a4') ? 'text-indigo-600' : 'text-stone-400'}`} />
              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                options.outputFormats.includes('normal_a4') ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                1 por Folha
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-stone-900">Normal A4</div>
              <p className="text-xs text-stone-500 mt-1 leading-normal">
                Partitura padrão em folha inteira com margens equilibradas para pastas tradicionais.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Otimizações Adicionais */}
      <div className="border-t border-stone-100 pt-4 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={options.removeBlankPages}
            onChange={(e) => onChange({ ...options, removeBlankPages: e.target.checked })}
            className="w-4 h-4 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500"
          />
          <span className="text-xs font-medium text-stone-800">
            Remover automaticamente páginas em branco e sobras sem notas
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={options.unifiedPrint}
            onChange={(e) => onChange({ ...options, unifiedPrint: e.target.checked })}
            className="w-4 h-4 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500"
          />
          <span className="text-xs font-medium text-stone-800">
            Ativar Impressão Unificada (permite ordenar instrumentos para encadernação)
          </span>
        </label>
      </div>
    </div>
  );
};
