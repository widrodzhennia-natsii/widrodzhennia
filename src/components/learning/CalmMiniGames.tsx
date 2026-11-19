import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';

interface MiniGameProps {
  onUnlockHint: () => void;
  playSuccessSound?: () => void;
}

/* ============================================================================
 * 1. CONCEPT MATCH MINI-GAME («Сенсові пари»)
 * ========================================================================== */

interface MatchPair {
  id: string;
  left: string;
  right: string;
  symbol: string;
}

const MATCH_DECKS: MatchPair[][] = [
  [
    { id: 'p1', left: 'Площа прямокутника', right: 'S = a · b', symbol: '□' },
    { id: 'p2', left: 'Периметр прямокутника', right: 'P = 2 · (a + b)', symbol: '▯' },
    { id: 'p3', left: 'Пройдений шлях', right: 'S = v · t', symbol: '→' },
    { id: 'p4', left: 'Об’єм паралелепіпеда', right: 'V = a · b · c', symbol: '◰' },
  ],
  [
    { id: 'm1', left: 'Підмет', right: 'Хто? Що? (Головний член)', symbol: '═' },
    { id: 'm2', left: 'Присудок', right: 'Що робить? Дія предмета', symbol: '≡' },
    { id: 'm3', left: 'Означення', right: 'Який? Чий? (Хвиляста)', symbol: '∿' },
    { id: 'm4', left: 'Обставина', right: 'Де? Коли? Як? (Штрих-пунктир)', symbol: '·-·' },
  ],
];

export const ConceptMatchMiniGame: React.FC<MiniGameProps> = ({
  onUnlockHint,
  playSuccessSound,
}) => {
  const [deckIdx] = useState(() => Math.floor(Math.random() * MATCH_DECKS.length));
  const pairs = MATCH_DECKS[deckIdx];

  const shuffledRight = useMemo(() => {
    const copy = [...pairs];
    // Deterministic swap so order differs from left column cleanly
    if (copy.length === 4) {
      return [copy[2], copy[0], copy[3], copy[1]];
    }
    return copy.reverse();
  }, [pairs]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [mismatchNote, setMismatchNote] = useState<string | null>(null);

  const handleRightPick = (pairId: string) => {
    if (!selectedLeft || matchedIds.includes(pairId)) return;
    if (selectedLeft === pairId) {
      const next = [...matchedIds, pairId];
      setMatchedIds(next);
      setSelectedLeft(null);
      setMismatchNote(null);
      if (next.length === pairs.length) {
        playSuccessSound?.();
        setTimeout(onUnlockHint, 550);
      }
    } else {
      setMismatchNote('Ці поняття не утворюють пару — спробуйте уважно зіставити ще раз.');
      setSelectedLeft(null);
    }
  };

  const completed = matchedIds.length === pairs.length;

  return (
    <div className="space-y-3 p-4 bg-[var(--hl-bg)] border border-[var(--hl-border)] rounded-[var(--radius-sm)]">
      <div className="flex items-center justify-between text-xs font-extrabold text-[var(--hl-text)]">
        <span>🔗 Сенсові пари</span>
        <span className="tabular-nums font-mono">
          Знайдено {matchedIds.length} з {pairs.length}
        </span>
      </div>

      <p className="text-xs text-[var(--text)] leading-relaxed">
        Спокійно оберіть поняття ліворуч, а потім — відповідну пару праворуч.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          {pairs.map((p) => {
            const isMatched = matchedIds.includes(p.id);
            const isSelected = selectedLeft === p.id;
            return (
              <Button
                key={p.id}
                type="button"
                variant={isMatched ? 'primary' : isSelected ? 'accent' : 'outline'}
                size="sm"
                disabled={isMatched}
                onClick={() => {
                  setMismatchNote(null);
                  setSelectedLeft(p.id);
                }}
                className="w-full justify-start text-left"
              >
                <span>{isMatched ? '✓' : p.symbol}</span>
                <span className="truncate">{p.left}</span>
              </Button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          {shuffledRight.map((p) => {
            const isMatched = matchedIds.includes(p.id);
            return (
              <Button
                key={p.id}
                type="button"
                variant={isMatched ? 'primary' : 'outline'}
                size="sm"
                disabled={isMatched || !selectedLeft}
                onClick={() => handleRightPick(p.id)}
                className="w-full justify-start text-left"
              >
                <span>{isMatched ? '✓' : '◇'}</span>
                <span className="truncate">{p.right}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {mismatchNote && (
        <div className="status-panel status-panel--warning text-xs">{mismatchNote}</div>
      )}

      {completed && (
        <div className="status-panel status-panel--success text-center text-xs">
          Усі пари знайдено! Відкриваємо підказку...
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2. PATTERN SEQUENCE MINI-GAME («Логічний патерн»)
 * ========================================================================== */

interface PatternTask {
  title: string;
  sequence: string[];
  options: string[];
  correctOption: string;
  ruleHint: string;
}

const PATTERN_TASKS: PatternTask[] = [
  {
    title: 'Продовжте числовий ряд (кожен крок збільшується на +3)',
    sequence: ['4', '7', '10', '13', '?'],
    options: ['15', '16', '17', '19'],
    correctOption: '16',
    ruleHint: 'Різниця між сусідніми числами постійна: 13 + 3 = 16.',
  },
  {
    title: 'Знайдіть закономірність подвоєння',
    sequence: ['3', '6', '12', '24', '?'],
    options: ['36', '42', '48', '30'],
    correctOption: '48',
    ruleHint: 'Кожне наступне число у 2 рази більше за попереднє: 24 · 2 = 48.',
  },
  {
    title: 'Продовжте геометричний ритм фігур',
    sequence: ['▲', '■', '●', '▲', '■', '?'],
    options: ['▲', '■', '●', '◆'],
    correctOption: '●',
    ruleHint: 'Цикл із 3 фігур повторюється: трикутник → квадрат → коло.',
  },
];

export const PatternSequenceMiniGame: React.FC<MiniGameProps> = ({
  onUnlockHint,
  playSuccessSound,
}) => {
  const [taskIdx, setTaskIdx] = useState(() => Math.floor(Math.random() * PATTERN_TASKS.length));
  const [picked, setPicked] = useState<string | null>(null);
  const task = PATTERN_TASKS[taskIdx];
  const isSolved = picked === task.correctOption;

  const handleChoose = (opt: string) => {
    setPicked(opt);
    if (opt === task.correctOption) {
      playSuccessSound?.();
      setTimeout(onUnlockHint, 600);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)]">
      <div className="flex items-center justify-between text-xs font-extrabold text-[var(--primary-dark)]">
        <span>🧩 Логічний патерн</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setPicked(null);
            setTaskIdx((i) => (i + 1) % PATTERN_TASKS.length);
          }}
        >
          ↻ Інший патерн
        </Button>
      </div>

      <p className="text-xs font-semibold text-[var(--text)]">{task.title}:</p>

      <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)]">
        {task.sequence.map((item, idx) => (
          <span
            key={idx}
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] border font-mono font-extrabold text-sm tabular-nums ${
              item === '?'
                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text)]'
            }`}
          >
            {item}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {task.options.map((opt) => (
          <Button
            key={opt}
            type="button"
            variant={picked === opt ? (isSolved ? 'primary' : 'outline') : 'outline'}
            size="sm"
            onClick={() => handleChoose(opt)}
            className="font-mono tabular-nums"
          >
            {opt}
          </Button>
        ))}
      </div>

      {picked && !isSolved && (
        <div className="status-panel status-panel--warning text-xs">
          Поки інша відповідь. Підказка: подивіться, як змінюється кожен наступний елемент.
        </div>
      )}

      {isSolved && (
        <div className="status-panel status-panel--success text-xs">
          Вірно! {task.ruleHint}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. FOCUS SORT MINI-GAME («Баланс уваги»)
 * ========================================================================== */

interface SortItem {
  id: string;
  label: string;
  bucket: 'left' | 'right';
}

interface SortDeck {
  leftLabel: string;
  rightLabel: string;
  items: SortItem[];
}

const SORT_DECKS: SortDeck[] = [
  {
    leftLabel: '✓ Істинне твердження',
    rightLabel: '✕ Хибне твердження',
    items: [
      { id: 's1', label: '1 км = 1000 м', bucket: 'left' },
      { id: 's2', label: 'У квадрата всі сторони рівні', bucket: 'left' },
      { id: 's3', label: '1 година = 100 хвилин', bucket: 'right' },
      { id: 's4', label: 'Ділення на нуль неможливе', bucket: 'left' },
    ],
  },
  {
    leftLabel: '📘 Іменник (Хто? Що?)',
    rightLabel: '⚡ Дієслово (Що робить?)',
    items: [
      { id: 'u1', label: 'Фортеця', bucket: 'left' },
      { id: 'u2', label: 'Досліджує', bucket: 'right' },
      { id: 'u3', label: 'Алгоритм', bucket: 'left' },
      { id: 'u4', label: 'Будуємо', bucket: 'right' },
    ],
  },
];

export const FocusSortMiniGame: React.FC<MiniGameProps> = ({
  onUnlockHint,
  playSuccessSound,
}) => {
  const [deckIdx] = useState(() => Math.floor(Math.random() * SORT_DECKS.length));
  const deck = SORT_DECKS[deckIdx];

  const [placements, setPlacements] = useState<Record<string, 'left' | 'right'>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const assignBucket = (itemId: string, bucket: 'left' | 'right') => {
    setFeedback(null);
    setPlacements((prev) => ({ ...prev, [itemId]: bucket }));
  };

  const allPlaced = deck.items.every((item) => placements[item.id]);

  const handleCheck = () => {
    const wrongCount = deck.items.filter((item) => placements[item.id] !== item.bucket).length;
    if (wrongCount === 0) {
      setFeedback({ ok: true, text: 'Усе розкладено бездоганно! Підказку розблоковано.' });
      playSuccessSound?.();
      setTimeout(onUnlockHint, 550);
    } else {
      setFeedback({
        ok: false,
        text: `Знайдено невідповідностей: ${wrongCount}. Перевірте кожну картку спокійно ще раз.`,
      });
    }
  };

  return (
    <div className="space-y-3 p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)]">
      <div className="flex items-center justify-between text-xs font-extrabold text-[var(--primary-dark)]">
        <span>⚖️ Баланс уваги</span>
        <span className="tabular-nums font-mono">
          Розподілено {Object.keys(placements).length} / {deck.items.length}
        </span>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Віднесіть кожен приклад до правильної групи:
      </p>

      <div className="space-y-2">
        {deck.items.map((item) => {
          const current = placements[item.id];
          return (
            <div
              key={item.id}
              className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <span className="text-xs font-bold text-[var(--text)]">{item.label}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant={current === 'left' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => assignBucket(item.id, 'left')}
                >
                  {deck.leftLabel}
                </Button>
                <Button
                  type="button"
                  variant={current === 'right' ? 'accent' : 'outline'}
                  size="sm"
                  onClick={() => assignBucket(item.id, 'right')}
                >
                  {deck.rightLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {feedback && (
        <div className={`status-panel ${feedback.ok ? 'status-panel--success' : 'status-panel--warning'} text-xs`}>
          {feedback.text}
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={!allPlaced || Boolean(feedback?.ok)}
        onClick={handleCheck}
        className="w-full"
      >
        Перевірити розподіл
      </Button>
    </div>
  );
};
