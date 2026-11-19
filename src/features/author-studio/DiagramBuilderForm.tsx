// Повна реалізація: Візуальний конструктор діаграм із текстового синтаксису (відступи та `->`)
// Детальний план: fix_tech_patch/future_plans/STAGE_5_AUTHOR_STUDIO_AND_TEAM_COOP.md

import React, { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { IndentedDiagramSvg } from '../../core/diagrams/IndentedDiagramSvg';
import { parseIndentedDiagram } from '../../core/diagrams/indentedDiagramParser';

export interface DiagramBuilderDraft {
  sourceText: string;
}

interface DiagramBuilderFormProps {
  onInsertSnippet: (snippet: string) => void;
}

const PRESETS: Array<{ label: string; title: string; source: string }> = [
  {
    label: 'Алгоритм розв’язання',
    title: 'Етапи розв’язання задачі',
    source: [
      'Умова задачі (що відомо)',
      '  Аналіз величин (одиниці СІ) -> Вибір формули (S = v · t)',
      '  Побудова схеми -> Перевірка відповіді',
    ].join('\n'),
  },
  {
    label: 'Ієрархія мови',
    title: 'Будова речення',
    source: [
      'Речення (закінчена думка)',
      '  Граматична основа -> Підмет (хто? що?)',
      '  Граматична основа -> Присудок (що робить?)',
      '  Другорядні члени -> Означення',
      '  Другорядні члени -> Обставина',
    ].join('\n'),
  },
  {
    label: 'Енергія й екологія',
    title: 'Колообіг води',
    source:
      'Випаровування (нагрів сонцем) -> Конденсація (утворення хмар) -> Опади (дощ чи сніг) -> Повернення в річки',
  },
];

export const DiagramBuilderForm: React.FC<DiagramBuilderFormProps> = ({
  onInsertSnippet,
}) => {
  const [title, setTitle] = useState(PRESETS[0].title);
  const [sourceText, setSourceText] = useState(PRESETS[0].source);

  const parsed = useMemo(() => parseIndentedDiagram(sourceText), [sourceText]);

  const generatedSnippet = useMemo(() => {
    const inlineSpec = sourceText
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0)
      .join('|')
      .replace(/"/g, "'");
    const safeTitle = (title.trim() || 'Структурна схема').replace(/"/g, "'");
    return `{{flow_diagram:title="${safeTitle}";spec="${inlineSpec}"}}`;
  }, [title, sourceText]);

  return (
    <div className="space-y-3 text-xs">
      <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold text-[var(--primary-dark)]">
            🗺️ Конструктор SVG-діаграм із тексту (відступи та стрілки)
          </span>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTitle(p.title);
                  setSourceText(p.source);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Використовуйте відступи (2 пробіли) для вкладених понять, <code>-&gt;</code> для послідовних кроків і{' '}
          <code>(примітка)</code> у дужках для пояснень під вузлом.
        </p>

        <div>
          <label className="block font-bold mb-1">Заголовок схеми</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field py-1.5 text-xs w-full"
          />
        </div>

        <div>
          <label className="block font-bold mb-1">Текстовий опис зв’язків</label>
          <textarea
            rows={5}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            spellCheck={false}
            className="input-field w-full font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-[var(--text-muted)] tabular-nums">
            Вузлів: {parsed.nodes.length} · Зв’язків: {parsed.edges.length}
          </span>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(generatedSnippet)}
            >
              📋 Копіювати тег
            </Button>
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={parsed.nodes.length === 0}
              onClick={() => onInsertSnippet(generatedSnippet)}
            >
              ✨ Вставити схему в блок
            </Button>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] space-y-2">
        <div className="text-[11px] font-extrabold text-[var(--primary-dark)] uppercase">
          Попередній перегляд SVG-діаграми
        </div>
        <IndentedDiagramSvg sourceText={sourceText} title={title} />
      </div>
    </div>
  );
};
