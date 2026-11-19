// Етап 3 (P1): Асоціативна 15-секундна візуальна когнітивна капча за предметами
// Детальний план: fix_tech_patch/future_plans/STAGE_3_ECONOMY_CAPTCHA_AND_FINANCE.md

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import type { BruteForceReason } from '../../hooks/useAttemptTracker';

export interface VisualAssociativePuzzle {
  id: string;
  subjectId: string;
  prompt: string;
  visualKind:
    | 'rect_area'
    | 'triangle_angle'
    | 'sentence_subject'
    | 'sentence_modifier'
    | 'history_anchor'
    | 'physics_circuit'
    | 'logic_and_gate'
    | 'music_rhythm'
    | 'general_scale';
  caption: string;
  options: Array<{ id: string; label: string; hint?: string }>;
  correctOptionId: string;
}

const PUZZLE_BANK: VisualAssociativePuzzle[] = [
  {
    id: 'math_rect',
    subjectId: 'math',
    prompt: 'Зіставте креслення фігури з величиною, яку позначає заштрихована внутрішня область:',
    visualKind: 'rect_area',
    caption: 'Сторони a та b утворюють внутрішню площину',
    options: [
      { id: 'area', label: 'Площа прямокутника (S = a · b)' },
      { id: 'perimeter', label: 'Периметр (сума довжин усіх сторін)' },
      { id: 'volume', label: 'Об’єм просторового тіла' },
    ],
    correctOptionId: 'area',
  },
  {
    id: 'math_tri',
    subjectId: 'math',
    prompt: 'Яка властивість відповідає зображеному куту з квадратною позначкою в вершині?',
    visualKind: 'triangle_angle',
    caption: 'Кут із прямим перетином сторін',
    options: [
      { id: 'right', label: 'Прямий кут (90°)' },
      { id: 'obtuse', label: 'Тупий кут (більше 90°)' },
      { id: 'straight', label: 'Розгорнутий кут (180°)' },
    ],
    correctOptionId: 'right',
  },
  {
    id: 'uk_subject',
    subjectId: 'ukrainian',
    prompt: 'Який член речення традиційно підкреслюють однією прямою лінією на схемі?',
    visualKind: 'sentence_subject',
    caption: 'Підкреслення однією лінією (Хто? Що?)',
    options: [
      { id: 'subject', label: 'Підмет — головний носій дії' },
      { id: 'predicate', label: 'Присудок — підкреслюється двома лініями' },
      { id: 'attr', label: 'Означення — хвиляста лінія' },
    ],
    correctOptionId: 'subject',
  },
  {
    id: 'uk_attr',
    subjectId: 'ukrainian',
    prompt: 'Якому члену речення відповідає хвиляста лінія під словом?',
    visualKind: 'sentence_modifier',
    caption: 'Питання: Який? Чий? Котрий?',
    options: [
      { id: 'attr', label: 'Означення' },
      { id: 'adv', label: 'Обставина (штрих-пунктир)' },
      { id: 'obj', label: 'Додаток (пунктир)' },
    ],
    correctOptionId: 'attr',
  },
  {
    id: 'hist_anchor',
    subjectId: 'history',
    prompt: 'Що показує стріла часу з пронумерованими точками подій?',
    visualKind: 'history_anchor',
    caption: 'Послідовність епох зліва направо',
    options: [
      { id: 'chrono', label: 'Хронологію — зв’язок подій у часі' },
      { id: 'scale', label: 'Географічний масштаб карти' },
      { id: 'glossary', label: 'Алфавітний покажчик термінів' },
    ],
    correctOptionId: 'chrono',
  },
  {
    id: 'phys_circuit',
    subjectId: 'physics',
    prompt: 'Зіставте умовний знак розриву в електричному колі з його призначенням:',
    visualKind: 'physics_circuit',
    caption: 'Керування протіканням струму в ланцюзі',
    options: [
      { id: 'switch', label: 'Ключ (вимикач) — замикає та розмикає коло' },
      { id: 'battery', label: 'Джерело живлення (гальванічний елемент)' },
      { id: 'bulb', label: 'Лампа розжарювання' },
    ],
    correctOptionId: 'switch',
  },
  {
    id: 'info_gate',
    subjectId: 'informatics',
    prompt: 'Коли логічний елемент «І» (AND) пропускає сигнал 1 на вихід?',
    visualKind: 'logic_and_gate',
    caption: 'Вхід A · Вхід B → Вихід',
    options: [
      { id: 'both', label: 'Лише тоді, коли обидва входи A і B дорівнюють 1' },
      { id: 'either', label: 'Коли хоча б один вхід дорівнює 0' },
      { id: 'invert', label: 'Завжди змінює сигнал на протилежний' },
    ],
    correctOptionId: 'both',
  },
  {
    id: 'music_rhythm',
    subjectId: 'music',
    prompt: 'Скільки рівних долей пульсу зазвичай уміщує такт із цією схемою двох четвертних нот?',
    visualKind: 'music_rhythm',
    caption: 'Дві чверті підряд: раз — і, два — і',
    options: [
      { id: 'two', label: 'Дві рівні долі (розмір 2/4)' },
      { id: 'four', label: 'Чотири долі без пауз (4/4)' },
      { id: 'none', label: 'Тривалість не вимірюється долями' },
    ],
    correctOptionId: 'two',
  },
  {
    id: 'general_scale',
    subjectId: 'general',
    prompt: 'Яка головна умова рівноваги на зображених важільних терезах?',
    visualKind: 'general_scale',
    caption: 'Ліве плече = Праве плече',
    options: [
      { id: 'equal', label: 'Однакова маса або однаковий добуток сили на плече' },
      { id: 'random', label: 'Перевага будь-якої чаші прискорює розв’язок' },
      { id: 'omit', label: 'Достатньо знати лише одну сторону' },
    ],
    correctOptionId: 'equal',
  },
];

const pickSubjectPuzzle = (subjectId: string, blockId: string): VisualAssociativePuzzle => {
  const clean = (subjectId || '').toLowerCase();
  const candidates = PUZZLE_BANK.filter((p) => {
    if (clean.includes('math') || clean.includes('alg') || clean.includes('geom')) {
      return p.subjectId === 'math';
    }
    if (clean.includes('ukrainian') || clean.includes('mova') || clean.includes('lit')) {
      return p.subjectId === 'ukrainian';
    }
    if (clean.includes('history')) return p.subjectId === 'history';
    if (clean.includes('physics') || clean.includes('chem')) return p.subjectId === 'physics';
    if (clean.includes('info') || clean.includes('cyber') || clean.includes('tech')) {
      return p.subjectId === 'informatics';
    }
    if (clean.includes('music') || clean.includes('art')) return p.subjectId === 'music';
    return p.subjectId === 'general' || p.subjectId === 'math';
  });

  const pool = candidates.length > 0 ? candidates : PUZZLE_BANK;
  let hash = 0;
  for (let i = 0; i < blockId.length; i++) {
    hash = (hash * 31 + blockId.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
};

const PuzzleSvgArt: React.FC<{ kind: VisualAssociativePuzzle['visualKind'] }> = ({ kind }) => {
  const strokeMain = 'var(--primary-dark)';
  const accent = 'var(--accent)';
  const muted = 'var(--text-muted)';
  const fillSoft = 'var(--hl-bg)';

  return (
    <svg
      viewBox="0 0 240 84"
      className="w-full max-w-[260px] h-[84px] mx-auto block"
      role="img"
      aria-label="Візуальна асоціація"
    >
      {kind === 'rect_area' && (
        <>
          <rect x="48" y="14" width="144" height="54" rx="4" fill={fillSoft} stroke={strokeMain} strokeWidth="2.5" />
          <line x1="56" y1="26" x2="184" y2="26" stroke={accent} strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="56" y1="41" x2="184" y2="41" stroke={accent} strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="56" y1="56" x2="184" y2="56" stroke={accent} strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="120" y="10" textAnchor="middle" fontSize="11" fontWeight="700" fill={strokeMain}>a</text>
          <text x="34" y="45" textAnchor="middle" fontSize="11" fontWeight="700" fill={strokeMain}>b</text>
        </>
      )}

      {kind === 'triangle_angle' && (
        <>
          <polygon points="56,68 186,68 56,16" fill={fillSoft} stroke={strokeMain} strokeWidth="2.5" />
          <polyline points="56,52 72,52 72,68" fill="none" stroke={accent} strokeWidth="2.5" />
          <text x="92" y="59" fontSize="11" fontWeight="700" fill={accent}>90°</text>
        </>
      )}

      {kind === 'sentence_subject' && (
        <>
          <text x="120" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill={strokeMain}>
            Дослідник будує модель
          </text>
          <line x1="36" y1="45" x2="108" y2="45" stroke={accent} strokeWidth="3" />
          <text x="72" y="64" textAnchor="middle" fontSize="11" fontWeight="700" fill={muted}>Хто?</text>
        </>
      )}

      {kind === 'sentence_modifier' && (
        <>
          <text x="120" y="34" textAnchor="middle" fontSize="15" fontWeight="700" fill={strokeMain}>
            Точний розрахунок
          </text>
          <path
            d="M 46 46 Q 54 40 62 46 T 78 46 T 94 46 T 110 46"
            fill="none"
            stroke={accent}
            strokeWidth="2.8"
          />
          <text x="78" y="66" textAnchor="middle" fontSize="11" fontWeight="700" fill={muted}>Який?</text>
        </>
      )}

      {kind === 'history_anchor' && (
        <>
          <line x1="24" y1="42" x2="210" y2="42" stroke={strokeMain} strokeWidth="2.5" />
          <polygon points="210,36 224,42 210,48" fill={accent} />
          <circle cx="58" cy="42" r="6" fill={fillSoft} stroke={accent} strokeWidth="2.5" />
          <circle cx="120" cy="42" r="6" fill={fillSoft} stroke={accent} strokeWidth="2.5" />
          <circle cx="180" cy="42" r="6" fill={fillSoft} stroke={accent} strokeWidth="2.5" />
          <text x="58" y="66" textAnchor="middle" fontSize="10" fontWeight="700" fill={muted}>XVI ст.</text>
          <text x="120" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill={strokeMain}>Подія А</text>
          <text x="180" y="66" textAnchor="middle" fontSize="10" fontWeight="700" fill={muted}>Подія Б</text>
        </>
      )}

      {kind === 'physics_circuit' && (
        <>
          <line x1="36" y1="48" x2="92" y2="48" stroke={strokeMain} strokeWidth="2.5" />
          <circle cx="92" cy="48" r="4" fill={accent} />
          <line x1="92" y1="48" x2="144" y2="24" stroke={accent} strokeWidth="3" />
          <circle cx="148" cy="48" r="4" fill={accent} />
          <line x1="148" y1="48" x2="204" y2="48" stroke={strokeMain} strokeWidth="2.5" />
          <text x="120" y="72" textAnchor="middle" fontSize="11" fontWeight="700" fill={muted}>Розрив / замикання</text>
        </>
      )}

      {kind === 'logic_and_gate' && (
        <>
          <line x1="40" y1="28" x2="82" y2="28" stroke={strokeMain} strokeWidth="2.5" />
          <line x1="40" y1="54" x2="82" y2="54" stroke={strokeMain} strokeWidth="2.5" />
          <path d="M 82 18 L 122 18 A 23 23 0 0 1 122 64 L 82 64 Z" fill={fillSoft} stroke={strokeMain} strokeWidth="2.5" />
          <line x1="145" y1="41" x2="196" y2="41" stroke={accent} strokeWidth="2.5" />
          <text x="106" y="45" textAnchor="middle" fontSize="13" fontWeight="800" fill={strokeMain}>&amp;</text>
          <text x="30" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill={muted}>A</text>
          <text x="30" y="58" textAnchor="middle" fontSize="11" fontWeight="700" fill={muted}>B</text>
        </>
      )}

      {kind === 'music_rhythm' && (
        <>
          <line x1="36" y1="56" x2="204" y2="56" stroke={muted} strokeWidth="1.5" />
          <ellipse cx="86" cy="54" rx="9" ry="6" fill={strokeMain} />
          <line x1="94" y1="54" x2="94" y2="20" stroke={strokeMain} strokeWidth="2.5" />
          <ellipse cx="146" cy="54" rx="9" ry="6" fill={accent} />
          <line x1="154" y1="54" x2="154" y2="20" stroke={accent} strokeWidth="2.5" />
          <text x="120" y="76" textAnchor="middle" fontSize="11" fontWeight="700" fill={muted}>♩ + ♩ = 2 долі</text>
        </>
      )}

      {kind === 'general_scale' && (
        <>
          <polygon points="120,38 110,66 130,66" fill={fillSoft} stroke={strokeMain} strokeWidth="2" />
          <line x1="52" y1="38" x2="188" y2="38" stroke={strokeMain} strokeWidth="3" />
          <rect x="44" y="20" width="24" height="14" rx="2" fill={accent} />
          <rect x="172" y="20" width="24" height="14" rx="2" fill={accent} />
          <text x="120" y="24" textAnchor="middle" fontSize="12" fontWeight="800" fill={strokeMain}>=</text>
        </>
      )}
    </svg>
  );
};

interface VisualAssociativeCaptchaProps {
  blockId: string;
  subjectId?: string;
  durationSec: number;
  bruteForceReason: BruteForceReason;
  captchaCyclesCompleted: number;
  captchaMaxCycles: number;
  onComplete: () => void;
  onSwitchToAlternatives: () => void;
}

export const VisualAssociativeCaptcha: React.FC<VisualAssociativeCaptchaProps> = ({
  blockId,
  subjectId = '',
  durationSec,
  bruteForceReason,
  captchaCyclesCompleted,
  captchaMaxCycles,
  onComplete,
  onSwitchToAlternatives,
}) => {
  const puzzle = useMemo(() => pickSubjectPuzzle(subjectId, blockId), [subjectId, blockId]);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(5, durationSec));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [wrongNotice, setWrongNotice] = useState<string | null>(null);

  useEffect(() => {
    setSecondsLeft(Math.max(5, durationSec));
    setPickedId(null);
    setWrongNotice(null);
  }, [blockId, durationSec]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const timerReady = secondsLeft === 0;
  const isSolved = pickedId === puzzle.correctOptionId;
  const canFinish = timerReady && isSolved;

  const reasonText =
    bruteForceReason === 'rapid_clicks'
      ? 'Спроби надходили надто швидко поспіль. Зробіть спокійний вдих і перегляньте візуальну підказку.'
      : bruteForceReason === 'sequential_guessing'
      ? 'Помічено послідовний підбір варіантів. Коротке зіставлення допоможе згадати ключовий образ правила.'
      : 'Кілька спроб не збіглися з еталоном. Спокійна 15-секундна асоціація поверне чіткість уваги.';

  const handleSelectOption = (optionId: string) => {
    setPickedId(optionId);
    if (optionId === puzzle.correctOptionId) {
      setWrongNotice(null);
    } else {
      setWrongNotice('Погляньте на схему вище ще раз і оберіть точну пару.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Calm countdown bar */}
      <div className="p-3.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[var(--primary-dark)]">
          <span>⏱️ Спокійна 15-сек візуальна пауза</span>
          <span className="tabular-nums font-mono px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
            {timerReady ? 'Готово' : `${secondsLeft} с`}
          </span>
        </div>

        <p className="text-xs text-[var(--text)] leading-relaxed">{reasonText}</p>

        <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--surface)] border border-[var(--border)]">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{
              width: `${
                durationSec > 0
                  ? Math.min(100, Math.round(((Math.max(5, durationSec) - secondsLeft) / Math.max(5, durationSec)) * 100))
                  : 100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Subject-adaptive visual association card */}
      <div className="p-3.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-3">
        <div className="space-y-1">
          <span className="text-xs font-extrabold text-[var(--text)] block">
            🔍 Візуальне зіставлення: {puzzle.prompt}
          </span>
        </div>

        <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] text-center space-y-1">
          <PuzzleSvgArt kind={puzzle.visualKind} />
          <div className="text-[11px] font-semibold text-[var(--text-muted)]">{puzzle.caption}</div>
        </div>

        <div className="space-y-1.5">
          {puzzle.options.map((opt) => {
            const selected = pickedId === opt.id;
            const correct = opt.id === puzzle.correctOptionId;
            return (
              <Button
                key={opt.id}
                type="button"
                variant={selected ? (correct ? 'primary' : 'outline') : 'outline'}
                size="sm"
                onClick={() => handleSelectOption(opt.id)}
                className="w-full justify-start text-left"
              >
                <span>{selected ? (correct ? '✓' : '✕') : '○'}</span>
                <span>{opt.label}</span>
              </Button>
            );
          })}
        </div>

        {wrongNotice && (
          <div className="status-panel status-panel--warning text-xs">{wrongNotice}</div>
        )}
        {isSolved && (
          <div className="status-panel status-panel--success text-xs">
            ✓ Асоціацію знайдено точно! {timerReady ? 'Можна повертатися до завдання.' : `Зачекайте ще ${secondsLeft} с для рівного темпу.`}
          </div>
        )}
      </div>

      {/* Confirm & optional escalation */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!canFinish}
          onClick={onComplete}
          className="flex-1"
        >
          {timerReady
            ? isSolved
              ? '✓ Повернутися до спроби (+5 до саморегуляції)'
              : 'Оберіть візуальну пару вище'
            : `Зачекайте ще ${secondsLeft} с...`}
        </Button>

        {captchaCyclesCompleted + 1 >= captchaMaxCycles && (
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={onSwitchToAlternatives}
          >
            💡 Мені потрібна підказка
          </Button>
        )}
      </div>
    </div>
  );
};
