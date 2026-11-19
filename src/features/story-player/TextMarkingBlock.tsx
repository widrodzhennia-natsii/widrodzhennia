import React, { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RichBlockText } from '../../components/ui/RichBlockText';

interface MarkingToken {
  index: number;
  text: string;
  targetRole: string | null;
  joinWithNext?: boolean;
}

interface ToolMeta {
  id: string;
  label: string;
  markerPreview: string;
  className: string;
}

const TOOL_CATALOG: Record<string, ToolMeta> = {
  subj: { id: 'subj', label: 'Підмет (хто? що?)', markerPreview: '───', className: 'sem-subj' },
  pred: { id: 'pred', label: 'Присудок (що робить?)', markerPreview: '═══', className: 'sem-pred' },
  attr: { id: 'attr', label: 'Означення (який? чий?)', markerPreview: '〰️', className: 'sem-attr' },
  obj: { id: 'obj', label: 'Додаток (кого? чого?)', markerPreview: '- - -', className: 'sem-obj' },
  adv: { id: 'adv', label: 'Обставина (де? коли?)', markerPreview: '─·─·', className: 'sem-adv' },
  ortho: { id: 'ortho', label: 'Орфограма', markerPreview: '[…]', className: 'ortho-mark' },
  prefix: { id: 'prefix', label: 'Префікс', markerPreview: '¬', className: 'morpheme-chip morpheme-prefix' },
  root: { id: 'root', label: 'Корінь', markerPreview: '⌒', className: 'morpheme-chip morpheme-root' },
  suffix: { id: 'suffix', label: 'Суфікс', markerPreview: '∧', className: 'morpheme-chip morpheme-suffix' },
  ending: { id: 'ending', label: 'Закінчення', markerPreview: '□', className: 'morpheme-chip morpheme-ending' },
  key_term: { id: 'key_term', label: 'Ключове слово', markerPreview: '◆', className: 'ortho-mark' },
  evidence: { id: 'evidence', label: 'Історичний доказ', markerPreview: '📌', className: 'sem-thesis' },
  fine_print: { id: 'fine_print', label: 'Ризик / умова', markerPreview: '⚠️', className: 'sem-warn' },
};

function parseSentenceToTokens(
  sentence: string,
  targetTokens?: Array<{ index: number; word: string; role: string }>
): MarkingToken[] {
  const result: MarkingToken[] = [];
  const markerRegex = /\[\[([a-zA-Z_][a-zA-Z0-9_]*):((?:(?!\]\]).)+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let wordCounter = 0;

  const pushPlainWords = (chunk: string, role: string | null) => {
    const words = chunk.split(/\s+/).filter(Boolean);
    words.forEach((w) => {
      result.push({ index: wordCounter++, text: w, targetRole: role });
    });
  };

  while ((match = markerRegex.exec(sentence)) !== null) {
    if (match.index > lastIndex) {
      pushPlainWords(sentence.slice(lastIndex, match.index), null);
    }
    const rawRole = match[1].trim().toLowerCase();
    const body = match[2];
    if (rawRole === 'morpheme_parts' || rawRole === 'morpheme_word') {
      const parts = body.split('|').map((p) => p.trim()).filter(Boolean);
      parts.forEach((part, pIdx) => {
        const cIdx = part.indexOf(':');
        const partRole = cIdx > 0 ? part.slice(0, cIdx).trim().toLowerCase() : 'root';
        const partText = cIdx > 0 ? part.slice(cIdx + 1) : part;
        result.push({
          index: wordCounter++,
          text: partText,
          targetRole: partRole,
          joinWithNext: pIdx < parts.length - 1,
        });
      });
    } else {
      pushPlainWords(body, rawRole);
    }
    lastIndex = markerRegex.lastIndex;
  }

  if (lastIndex < sentence.length) {
    pushPlainWords(sentence.slice(lastIndex), null);
  }

  if (Array.isArray(targetTokens) && targetTokens.length > 0) {
    targetTokens.forEach((tt) => {
      if (result[tt.index]) {
        result[tt.index].targetRole = String(tt.role).trim().toLowerCase();
      }
    });
  }

  return result;
}

interface TextMarkingBlockProps {
  title?: string;
  prompt: string;
  sentence: string;
  availableTools: string[];
  toleranceMode?: 'exact' | 'partial';
  targetTokens?: Array<{ index: number; word: string; role: string }>;
  explanation?: string;
  rewardWood?: number;
  isLastStep?: boolean;
  onOpenHint?: () => void;
  onOpenTheory?: () => void;
  onWrongAttempt?: (signature: string) => void;
  onSuccessSound?: () => void;
  onErrorSound?: () => void;
  onSolved: () => void;
}

export const TextMarkingBlock: React.FC<TextMarkingBlockProps> = ({
  title,
  prompt,
  sentence,
  availableTools,
  toleranceMode = 'exact',
  targetTokens,
  explanation,
  rewardWood = 20,
  isLastStep = false,
  onOpenHint,
  onOpenTheory,
  onWrongAttempt,
  onSuccessSound,
  onErrorSound,
  onSolved,
}) => {
  const tokens = useMemo(
    () => parseSentenceToTokens(sentence, targetTokens),
    [sentence, targetTokens]
  );

  const tools = useMemo(
    () =>
      (availableTools && availableTools.length > 0 ? availableTools : ['subj', 'pred']).map(
        (id) =>
          TOOL_CATALOG[id] || {
            id,
            label: id,
            markerPreview: '•',
            className: 'ortho-mark',
          }
      ),
    [availableTools]
  );

  const [activeToolId, setActiveToolId] = useState<string>(tools[0]?.id || 'subj');
  const [userMarks, setUserMarks] = useState<Record<number, string>>({});
  const [checkedResult, setCheckedResult] = useState<{
    passed: boolean;
    matchedCount: number;
    expectedCount: number;
    wrongIndices: number[];
    missedIndices: number[];
  } | null>(null);

  // Strict Deferred Check: clicking a word ONLY stores student selection with ZERO feedback/sound
  const handleTokenClick = (tokenIndex: number) => {
    if (checkedResult?.passed) return;
    setCheckedResult(null);
    setUserMarks((prev) => {
      const next = { ...prev };
      if (activeToolId === '__eraser__' || next[tokenIndex] === activeToolId) {
        delete next[tokenIndex];
      } else {
        next[tokenIndex] = activeToolId;
      }
      return next;
    });
  };

  const handleCheck = () => {
    const expectedEntries = tokens.filter((t) => t.targetRole !== null);
    let matchedCount = 0;
    const wrongIndices: number[] = [];
    const missedIndices: number[] = [];

    tokens.forEach((tok) => {
      const userRole = userMarks[tok.index] || null;
      if (tok.targetRole && userRole === tok.targetRole) {
        matchedCount++;
      } else if (tok.targetRole && userRole !== tok.targetRole) {
        if (userRole) wrongIndices.push(tok.index);
        else missedIndices.push(tok.index);
      } else if (!tok.targetRole && userRole) {
        wrongIndices.push(tok.index);
      }
    });

    const expectedCount = Math.max(1, expectedEntries.length);
    const passed =
      toleranceMode === 'partial'
        ? matchedCount / expectedCount >= 0.8 && wrongIndices.length <= 1
        : matchedCount === expectedCount && wrongIndices.length === 0 && missedIndices.length === 0;

    setCheckedResult({
      passed,
      matchedCount,
      expectedCount,
      wrongIndices,
      missedIndices,
    });

    if (passed) {
      onSuccessSound?.();
    } else {
      onErrorSound?.();
      const signature = Object.entries(userMarks)
        .map(([k, v]) => `${k}:${v}`)
        .sort()
        .join('|');
      onWrongAttempt?.(signature || 'empty_marks');
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          ✍️ {title || 'Аналітичний розбір тексту'}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenTheory && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenTheory}>
              📖 Теорія (0 ₴)
            </Button>
          )}
          {onOpenHint && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenHint}>
              💡 Підказка
            </Button>
          )}
          <span className="text-xs font-extrabold text-[var(--accent)]">
            🏆 +{rewardWood} балів
          </span>
        </div>
      </div>

      <div className="surface-subtle rounded-[var(--radius-sm)] p-3.5 text-sm font-semibold">
        <RichBlockText text={prompt} />
      </div>

      {/* Tool Palette */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
          Оберіть інструмент розмітки та натисніть на слова:
        </span>
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => {
            const isSelected = activeToolId === tool.id;
            return (
              <Button
                key={tool.id}
                type="button"
                variant={isSelected ? 'accent' : 'outline'}
                size="sm"
                onClick={() => setActiveToolId(tool.id)}
              >
                <span className="font-mono">{tool.markerPreview}</span>
                <span>{tool.label}</span>
              </Button>
            );
          })}
          <Button
            type="button"
            variant={activeToolId === '__eraser__' ? 'accent' : 'outline'}
            size="sm"
            onClick={() => setActiveToolId('__eraser__')}
          >
            🧹 Стерти позначку
          </Button>
        </div>
      </div>

      {/* Interactive Sentence Tokens — NO pre-marking reveals, NO live evaluation */}
      <div className="p-4 sm:p-5 bg-[var(--notebook-bg)] border-2 border-[var(--border)] rounded-[var(--radius-sm)] flex flex-wrap items-baseline gap-x-2 gap-y-3 leading-loose">
        {tokens.map((tok) => {
          const markedRole = userMarks[tok.index];
          const toolMeta = markedRole ? TOOL_CATALOG[markedRole] : null;
          const isChecked = checkedResult !== null;
          const isWrong = isChecked && checkedResult.wrongIndices.includes(tok.index);
          const isMissed = isChecked && checkedResult.missedIndices.includes(tok.index);

          return (
            <button
              key={tok.index}
              type="button"
              onClick={() => handleTokenClick(tok.index)}
              className={`${tok.joinWithNext ? 'px-0.5 mr-[-6px]' : 'px-1.5'} py-0.5 rounded-[var(--radius-sm)] text-base sm:text-lg font-semibold cursor-pointer transition-transform hover:-translate-y-0.5 ${
                toolMeta ? toolMeta.className : 'border border-dashed border-[var(--border)] hover:border-[var(--border-hover)]'
              } ${isWrong ? 'ring-2 ring-[var(--err-border)]' : ''} ${
                isMissed ? 'border border-dashed border-[var(--warn-border)]' : ''
              }`}
              title={toolMeta ? toolMeta.label : 'Натисніть, щоб позначити фрагмент'}
            >
              {tok.text}
            </button>
          );
        })}
      </div>

      {/* Deferred Check Result Panel */}
      {checkedResult && (
        <div
          className={`status-panel space-y-2 ${
            checkedResult.passed ? 'status-panel--success' : 'status-panel--warning'
          }`}
        >
          {checkedResult.passed ? (
            <div>
              <span className="font-extrabold">✅ Чудово! Розбір виконано точно.</span>
              {explanation && (
                <div className="mt-1 font-medium">
                  <RichBlockText text={explanation} />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-extrabold">
                Перевірено: правильних міток {checkedResult.matchedCount} з {checkedResult.expectedCount}.
              </p>
              <p className="text-xs font-medium">
                {checkedResult.missedIndices.length > 0 &&
                  `Пропущено слів: ${checkedResult.missedIndices.length}. `}
                {checkedResult.wrongIndices.length > 0 &&
                  `Потрібно переглянути позначок: ${checkedResult.wrongIndices.length} (виділені рамкою).`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
        {!checkedResult?.passed ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUserMarks({});
                setCheckedResult(null);
              }}
            >
              ↺ Очистити все
            </Button>
            <Button type="button" variant="primary" size="md" onClick={handleCheck}>
              Перевірити розмітку
            </Button>
          </>
        ) : (
          <Button type="button" variant="accent" size="md" onClick={onSolved} className="w-full">
            {isLastStep ? 'Завершити розбір 🎯' : 'Чудово! Продовжити далі →'}
          </Button>
        )}
      </div>
    </div>
  );
};
