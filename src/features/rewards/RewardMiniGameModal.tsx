// Етап 3 (P1): Короткі скінченні міні-ігри нагороди після успішного проходження квесту або накопичення ресурсів
// Детальний план: fix_tech_patch/future_plans/STAGE_3_ECONOMY_CAPTCHA_AND_FINANCE.md

import React, { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useEconomyAccountsStore } from '../economy/useEconomyAccountsStore';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';

export interface RewardMiniGameConfig {
  id: 'mosaic' | 'pairs' | 'buckets';
  title: string;
  subtitle: string;
}

const REWARD_GAMES: RewardMiniGameConfig[] = [
  {
    id: 'mosaic',
    title: 'Симетричний візерунок',
    subtitle: '3 короткі раунди на просторову симетрію',
  },
  {
    id: 'pairs',
    title: 'Тихі пари пам’яті',
    subtitle: '4 пари символів у спокійному ритмі',
  },
  {
    id: 'buckets',
    title: 'Фінансовий баланс',
    subtitle: '3 кроки розумного розподілу бюджету',
  },
];

/* ----------------------------------------------------------------------------
 * Game 1: Finite 3-Round Symmetry Mosaic (4x4 grid, reflect left -> right)
 * --------------------------------------------------------------------------*/
const MOSAIC_TARGETS: Array<{ title: string; leftPattern: number[] }> = [
  { title: 'Раунд 1/3 · Кристал', leftPattern: [1, 4, 5, 9, 13] }, // left cols (col 0,1)
  { title: 'Раунд 2/3 · Сходинки', leftPattern: [0, 4, 5, 8, 9, 12] },
  { title: 'Раунд 3/3 · Зірка орнаменту', leftPattern: [0, 5, 8, 9, 12] },
];

const mirrorCell = (idx: number): number => {
  const row = Math.floor(idx / 4);
  const col = idx % 4;
  return row * 4 + (3 - col);
};

const SymmetryMosaicGame: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
  const [roundIdx, setRoundIdx] = useState(0);
  const [selectedRight, setSelectedRight] = useState<number[]>([]);
  const [roundError, setRoundError] = useState<string | null>(null);

  const round = MOSAIC_TARGETS[roundIdx];
  const expectedRight = useMemo(
    () => Array.from(new Set(round.leftPattern.map(mirrorCell))).sort((a, b) => a - b),
    [round]
  );

  const toggleRightCell = (idx: number) => {
    setRoundError(null);
    setSelectedRight((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
    );
  };

  const handleCheck = () => {
    const sorted = [...selectedRight].sort((a, b) => a - b);
    const matches =
      sorted.length === expectedRight.length &&
      sorted.every((val, i) => val === expectedRight[i]);

    if (!matches) {
      setRoundError('Дзеркальне відображення правої половини ще не збігається з лівою.');
      return;
    }

    if (roundIdx + 1 >= MOSAIC_TARGETS.length) {
      onFinished();
    } else {
      setRoundIdx((r) => r + 1);
      setSelectedRight([]);
      setRoundError(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-extrabold text-[var(--primary-dark)]">
        <span>{round.title}</span>
        <span className="font-mono tabular-nums text-[var(--text-muted)]">
          Віддзеркаліть праворуч
        </span>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Ліва частина візерунка вже готова. Позначте симетричні клітинки у правій половині.
      </p>

      <div className="grid grid-cols-4 gap-1.5 max-w-[220px] mx-auto p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)]">
        {Array.from({ length: 16 }).map((_, idx) => {
          const col = idx % 4;
          const isLeft = col < 2;
          const activeLeft = isLeft && round.leftPattern.includes(idx);
          const activeRight = !isLeft && selectedRight.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={isLeft}
              onClick={() => toggleRightCell(idx)}
              className={`h-11 rounded-[var(--radius-sm)] border transition-all text-xs font-extrabold ${
                isLeft
                  ? activeLeft
                    ? 'bg-[var(--primary)] border-[var(--primary-dark)] text-[var(--surface)]'
                    : 'bg-[var(--surface-alt)] border-[var(--border)] opacity-60'
                  : activeRight
                  ? 'bg-[var(--accent)] border-[var(--primary-dark)] text-[var(--accent-text)] cursor-pointer'
                  : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)] cursor-pointer'
              }`}
              aria-label={`Клітинка ${idx + 1}`}
            >
              {activeLeft ? '◆' : activeRight ? '◇' : ''}
            </button>
          );
        })}
      </div>

      {roundError && <div className="status-panel status-panel--warning text-xs">{roundError}</div>}

      <Button type="button" variant="primary" size="sm" onClick={handleCheck} className="w-full">
        {roundIdx + 1 < MOSAIC_TARGETS.length ? 'Перевірити і далі →' : 'Завершити візерунок ✓'}
      </Button>
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * Game 2: Finite 4-Pair Calm Memory Match
 * --------------------------------------------------------------------------*/
interface MemoryCard {
  uid: number;
  pairId: string;
  symbol: string;
  label: string;
}

const BASE_SYMBOLS = [
  { pairId: 'compass', symbol: '🧭', label: 'Компас' },
  { pairId: 'triangle', symbol: '📐', label: 'Кутник' },
  { pairId: 'note', symbol: '🎵', label: 'Нота' },
  { pairId: 'leaf', symbol: '🌿', label: 'Спокій' },
];

const buildDeck = (): MemoryCard[] => {
  const doubled = [...BASE_SYMBOLS, ...BASE_SYMBOLS].map((item, idx) => ({
    ...item,
    uid: idx,
  }));
  // Deterministic calm shuffle that stays fresh per mount
  for (let i = doubled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
  }
  return doubled;
};

const QuietMemoryGame: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
  const [deck] = useState<MemoryCard[]>(() => buildDeck());
  const [flippedUids, setFlippedUids] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const handleCardClick = (card: MemoryCard) => {
    if (isBusy || matchedPairs.includes(card.pairId) || flippedUids.includes(card.uid)) return;
    const nextFlipped = [...flippedUids, card.uid];
    setFlippedUids(nextFlipped);

    if (nextFlipped.length === 2) {
      const [firstUid, secondUid] = nextFlipped;
      const firstCard = deck.find((c) => c.uid === firstUid);
      const secondCard = deck.find((c) => c.uid === secondUid);
      if (firstCard && secondCard && firstCard.pairId === secondCard.pairId) {
        const nextMatched = [...matchedPairs, firstCard.pairId];
        setMatchedPairs(nextMatched);
        setFlippedUids([]);
        if (nextMatched.length === BASE_SYMBOLS.length) {
          setTimeout(onFinished, 450);
        }
      } else {
        setIsBusy(true);
        setTimeout(() => {
          setFlippedUids([]);
          setIsBusy(false);
        }, 650);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-extrabold text-[var(--primary-dark)]">
        <span>Знайдіть 4 пари без поспіху</span>
        <span className="font-mono tabular-nums text-[var(--text-muted)]">
          Пари: {matchedPairs.length} / {BASE_SYMBOLS.length}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-[300px] mx-auto">
        {deck.map((card) => {
          const isMatched = matchedPairs.includes(card.pairId);
          const isOpen = isMatched || flippedUids.includes(card.uid);
          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleCardClick(card)}
              className={`h-16 rounded-[var(--radius-sm)] border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                isMatched
                  ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                  : isOpen
                  ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                  : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]'
              }`}
              aria-label={isOpen ? card.label : 'Закрита картка'}
            >
              <span className="text-lg">{isOpen ? card.symbol : '◈'}</span>
              {isOpen && <span className="text-[9px] font-bold">{card.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * Game 3: Finite 3-Step Budget Sorting
 * --------------------------------------------------------------------------*/
const BUDGET_ROUNDS = [
  {
    prompt: 'Куди варто спрямувати кошти, щоб вони підтримували щоденні підказки й практику?',
    correct: 'operating' as const,
    feedback: 'Вірно! Поточні робочі витрати покриває саме операційний бюджет.',
  },
  {
    prompt: 'Який рахунок захищає від непередбачених витрат і не витрачається автоматично?',
    correct: 'reserve' as const,
    feedback: 'Точно! Резервний фонд створює безпечну фінансову подушку.',
  },
  {
    prompt: 'Який рахунок накопичує капітал на довгострокові проєкти та вдосконалення?',
    correct: 'investment' as const,
    feedback: 'Саме так! Інвестиційний капітал працює на майбутній розвиток.',
  },
];

const BudgetBalanceGame: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
  const [step, setStep] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const current = BUDGET_ROUNDS[step];

  const handlePick = (bucket: 'operating' | 'reserve' | 'investment') => {
    if (bucket === current.correct) {
      setNote(null);
      if (step + 1 >= BUDGET_ROUNDS.length) {
        onFinished();
      } else {
        setStep((s) => s + 1);
      }
    } else {
      setNote('Подумайте, яку роль виконує кожен із трьох рахунків, і спробуйте ще раз.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-extrabold text-[var(--primary-dark)]">
        <span>Крок {step + 1} з {BUDGET_ROUNDS.length}</span>
        <span className="text-[var(--text-muted)] font-mono tabular-nums">3 раунди</span>
      </div>

      <div className="p-3.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs font-bold text-[var(--text)] leading-relaxed">
        {current.prompt}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => handlePick('operating')} className="justify-start">
          🪙 Операційний бюджет (щоденні задачі)
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => handlePick('reserve')} className="justify-start">
          🛡️ Резервний фонд (недоторканний запас)
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => handlePick('investment')} className="justify-start">
          📈 Інвестиційний капітал (довгі проєкти)
        </Button>
      </div>

      {note && <div className="status-panel status-panel--warning text-xs">{note}</div>}
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * Modal Shell
 * --------------------------------------------------------------------------*/
interface RewardMiniGameModalProps {
  isOpen: boolean;
  sourceKey: string;
  onClose: () => void;
}

export const RewardMiniGameModal: React.FC<RewardMiniGameModalProps> = ({
  isOpen,
  sourceKey,
  onClose,
}) => {
  const [selectedGame, setSelectedGame] = useState<RewardMiniGameConfig['id']>('mosaic');
  const [completedRunId, setCompletedRunId] = useState(0);
  const [finished, setFinished] = useState(false);
  const [claimedNow, setClaimedNow] = useState(false);

  const { claimRewardGameBonus } = useEconomyAccountsStore();
  const { notify } = useFeedbackStore();

  const handleGameFinished = () => {
    setFinished(true);
    const claimId = sourceKey ? `${sourceKey}::${selectedGame}` : '';
    if (claimId) {
      const credited = claimRewardGameBonus(claimId, 1, 10, 'Нагорода за спокійну міні-гру');
      setClaimedNow(credited);
      if (credited) {
        notify('Отримано +10 операційних балів та +1 🪙 жетон за коротку гру!', 'success');
      }
    }
  };

  const handleRestart = (nextGame: RewardMiniGameConfig['id'] = selectedGame) => {
    setSelectedGame(nextGame);
    setFinished(false);
    setClaimedNow(false);
    setCompletedRunId((c) => c + 1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🎮 Коротка гра-нагорода"
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Спокійний відпочинок із чітким фіналом (3 раунди без нескінченної стрічки).
        </p>

        {/* Game Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {REWARD_GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleRestart(g.id)}
              className={`p-2 rounded-[var(--radius-sm)] border text-left transition-colors cursor-pointer ${
                selectedGame === g.id
                  ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                  : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]'
              }`}
            >
              <div className="text-xs font-extrabold">{g.title}</div>
              <div className="text-[10px] opacity-80">{g.subtitle}</div>
            </button>
          ))}
        </div>

        {/* Active finite game or completion state */}
        {finished ? (
          <div className="p-5 bg-[var(--ok-bg)] border border-[var(--ok-border)] text-[var(--ok-text)] rounded-[var(--radius-md)] text-center space-y-3">
            <div className="text-2xl">✨</div>
            <h4 className="text-sm font-extrabold">Коротку гру завершено!</h4>
            <p className="text-xs leading-relaxed">
              {claimedNow
                ? 'Нагорода зарахована: +10 до операційного бюджету та +1 🪙 жетон.'
                : 'Чудовий результат! Основну нагороду за цей етап уже отримано раніше.'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => handleRestart(selectedGame)}>
                ↻ Зіграти ще раз
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onClose}>
                Повернутися
              </Button>
            </div>
          </div>
        ) : (
          <div key={`${selectedGame}_${completedRunId}`} className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)]">
            {selectedGame === 'mosaic' && <SymmetryMosaicGame onFinished={handleGameFinished} />}
            {selectedGame === 'pairs' && <QuietMemoryGame onFinished={handleGameFinished} />}
            {selectedGame === 'buckets' && <BudgetBalanceGame onFinished={handleGameFinished} />}
          </div>
        )}
      </div>
    </Modal>
  );
};
