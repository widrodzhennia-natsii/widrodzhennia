import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { speechAudio } from '../../core/audio/formant-synth';

export type SomaticActivityId =
  | 'vocal_humming'
  | 'double_sigh'
  | 'muscle_squeeze'
  | 'eye_eight'
  | 'vowel_sound_flow';

interface SomaticPauseModalProps {
  isOpen: boolean;
  activityId: SomaticActivityId;
  durationSec: number;
  guideVoiceText?: string;
  inhaleSec?: number;
  holdSec?: number;
  exhaleSec?: number;
  restSec?: number;
  cues?: string[];
  onComplete: () => void;
  onClose?: () => void;
  inlinePreview?: boolean;
}

interface BreathPhase {
  kind: 'inhale' | 'topup' | 'hold' | 'exhale' | 'rest';
  label: string;
  hint: string;
  durationSec: number;
  fromScale: number;
  toScale: number;
}

const DEFAULT_VOWELS = ['А-а-а…', 'О-о-о…', 'У-у-у…', 'І-і-і…'];

/**
 * Extracts explicit sound sequences (e.g. "У — О — А", "А — О — У — Е — И — І", "«м-м-м»")
 * directly from the lesson's guideVoiceText so visuals always match the authored content.
 */
const extractMaterialCues = (
  activityId: SomaticActivityId,
  guideVoiceText?: string,
  explicitCues?: string[]
): { soundSequence: string[]; singleSound?: string } => {
  if (explicitCues && explicitCues.length > 0) {
    return {
      soundSequence: explicitCues.map((c) => (c.endsWith('…') ? c : `${c}…`)),
      singleSound: explicitCues[0],
    };
  }

  const text = String(guideVoiceText || '').trim();
  if (text) {
    // Match chained sound tokens separated by em-dash/en-dash/hyphen: "У — О — А" or "А - О - У - І"
    const dashChainMatch = text.match(
      /([А-ЯІЇЄҐA-Zа-яіїєґa-z]{1,4}(?:\s*[—–-]\s*[А-ЯІЇЄҐA-Zа-яіїєґa-z]{1,4}){1,7})/
    );
    if (dashChainMatch) {
      const rawTokens = dashChainMatch[1]
        .split(/\s*[—–-]\s*/)
        .map((t) => t.trim())
        .filter(Boolean);
      // Avoid mistaking hyphenated humming like "м-м-м" for multiple distinct vowels
      const uniqueLower = new Set(rawTokens.map((t) => t.toLowerCase()));
      if (rawTokens.length >= 2 && uniqueLower.size > 1) {
        return {
          soundSequence: rawTokens.map((t) => `${t}…`),
        };
      }
      if (rawTokens.length >= 2 && uniqueLower.size === 1) {
        return {
          soundSequence: DEFAULT_VOWELS,
          singleSound: rawTokens.join('-').toLowerCase(),
        };
      }
    }

    // Match quoted prolonged sound e.g. «м-м-м» or "м-м-м"
    const quotedMatch = text.match(/[«"„]([а-яіїєґa-z-]{2,12})[»"”]/i);
    if (quotedMatch) {
      return {
        soundSequence: DEFAULT_VOWELS,
        singleSound: quotedMatch[1].toLowerCase(),
      };
    }
  }

  return {
    soundSequence: activityId === 'vowel_sound_flow' ? DEFAULT_VOWELS : [],
  };
};

/**
 * Extracts optional rhythmic ratios if authored inside text (e.g. "4-7-8", "4-4-4-4", "3–4 рази")
 */
const extractTimingHints = (guideVoiceText?: string): { ratio?: number[]; hintedRepeats?: number } => {
  const text = String(guideVoiceText || '');
  const ratioMatch = text.match(/\b(\d)\s*[—–-]\s*(\d)\s*[—–-]\s*(\d)(?:\s*[—–-]\s*(\d))?\b/);
  if (ratioMatch) {
    const nums = [ratioMatch[1], ratioMatch[2], ratioMatch[3], ratioMatch[4]]
      .filter(Boolean)
      .map(Number)
      .filter((n) => n > 0 && n <= 12);
    if (nums.length >= 3) return { ratio: nums };
  }
  const repMatch = text.match(/(\d+)\s*(?:–|-)?\s*(?:(\d+)\s*)?(?:раз|цикл)/i);
  if (repMatch) {
    const val = Number(repMatch[2] || repMatch[1]);
    if (val >= 1 && val <= 8) return { hintedRepeats: val };
  }
  return {};
};

const normalizePhasesToCycleDuration = (
  rawPhases: BreathPhase[],
  targetCycleDurationSec: number
): BreathPhase[] => {
  const rawSum = rawPhases.reduce((s, p) => s + p.durationSec, 0) || 1;
  const k = targetCycleDurationSec / rawSum;
  return rawPhases.map((p) => ({
    ...p,
    durationSec: p.durationSec * k,
  }));
};

const buildHarmonizedPlan = (
  activityId: SomaticActivityId,
  totalDurationSec: number,
  guideVoiceText?: string,
  overrides?: {
    inhaleSec?: number;
    holdSec?: number;
    exhaleSec?: number;
    restSec?: number;
    cues?: string[];
  }
): {
  phases: BreathPhase[];
  cycleCount: number;
  cycleDurationSec: number;
  soundSequence: string[];
} => {
  const safeTotal = Math.max(6, totalDurationSec);
  const { soundSequence, singleSound } = extractMaterialCues(
    activityId,
    guideVoiceText,
    overrides?.cues
  );
  const { ratio, hintedRepeats } = extractTimingHints(guideVoiceText);

  const hasExplicitTimings = Boolean(overrides?.inhaleSec || overrides?.exhaleSec);

  // Target deep calm breath duration ~11.5s unless short pause (<=15s -> 1 deep cycle) or hinted repeats
  let cycleCount: number;
  if (hasExplicitTimings) {
    const approxSum =
      (overrides?.inhaleSec ?? 4) +
      (overrides?.holdSec ?? 1) +
      (overrides?.exhaleSec ?? 6) +
      (overrides?.restSec ?? 1);
    cycleCount = Math.max(1, Math.round(safeTotal / Math.max(5, approxSum)));
  } else if (hintedRepeats && safeTotal / hintedRepeats >= 4.5 && safeTotal / hintedRepeats <= 16) {
    cycleCount = hintedRepeats;
  } else if (safeTotal <= 15) {
    cycleCount = 1;
  } else {
    cycleCount = Math.max(1, Math.round(safeTotal / 11.5));
  }

  const cycleDurationSec = safeTotal / cycleCount;

  // Deep visual amplitude for fuller inhales & slow complete exhales
  const MIN_S = 0.74;
  const MID_S = 1.06;
  const MAX_S = 1.32;

  if (activityId === 'eye_eight') {
    return {
      phases: [
        {
          kind: 'inhale',
          label: 'Плавний рух очей',
          hint: 'Стежте за рухом точки очима без поворотів голови',
          durationSec: cycleDurationSec,
          fromScale: 1,
          toScale: 1,
        },
      ],
      cycleCount,
      cycleDurationSec,
      soundSequence,
    };
  }

  if (activityId === 'muscle_squeeze') {
    const raw: BreathPhase[] = [
      { kind: 'inhale', label: 'Стисніть кулачки', hint: 'Вдих і м’яке напруження долонь', durationSec: 3.5, fromScale: 1.0, toScale: 0.78 },
      { kind: 'hold', label: 'Утримайте напругу', hint: 'Відчуйте силу в долонях', durationSec: 1.5, fromScale: 0.78, toScale: 0.78 },
      { kind: 'exhale', label: 'Розслабте руки', hint: 'Повільний видих і повне розтискання', durationSec: 5.0, fromScale: 0.78, toScale: 1.24 },
      { kind: 'rest', label: 'Спокій', hint: 'Легкість у долонях і плечах', durationSec: 1.5, fromScale: 1.24, toScale: 1.0 },
    ];
    return {
      phases: normalizePhasesToCycleDuration(raw, cycleDurationSec),
      cycleCount,
      cycleDurationSec,
      soundSequence,
    };
  }

  // If explicit overrides or numeric text pattern (e.g. 4-7-8 / 4-4-4-4) provided
  if (hasExplicitTimings || ratio) {
    const inVal = overrides?.inhaleSec ?? ratio?.[0] ?? 4;
    const holdVal = overrides?.holdSec ?? (ratio && ratio.length >= 3 ? ratio[1] : 1);
    const exVal = overrides?.exhaleSec ?? (ratio ? ratio[2] : 6);
    const restVal = overrides?.restSec ?? (ratio && ratio[3] ? ratio[3] : 1);
    const raw: BreathPhase[] = [
      { kind: 'inhale', label: 'Глибокий вдих', hint: 'Повільне наповнення грудей і живота', durationSec: inVal, fromScale: MIN_S, toScale: MAX_S },
      ...(holdVal > 0
        ? [{ kind: 'hold' as const, label: 'Затримка', hint: 'Спокійна пауза на вдиху', durationSec: holdVal, fromScale: MAX_S, toScale: MAX_S }]
        : []),
      {
        kind: 'exhale',
        label: singleSound ? `Видих: ${singleSound}` : 'Глибокий видих',
        hint: 'Рівний довгий видих до кінця',
        durationSec: exVal,
        fromScale: MAX_S,
        toScale: MIN_S,
      },
      ...(restVal > 0
        ? [{ kind: 'rest' as const, label: 'Пауза', hint: 'Природне розслаблення', durationSec: restVal, fromScale: MIN_S, toScale: MIN_S }]
        : []),
    ];
    return {
      phases: normalizePhasesToCycleDuration(raw, cycleDurationSec),
      cycleCount,
      cycleDurationSec,
      soundSequence,
    };
  }

  if (activityId === 'double_sigh') {
    const raw: BreathPhase[] = [
      { kind: 'inhale', label: 'Глибокий вдих', hint: 'Повільний перший вдих носом', durationSec: 2.8, fromScale: MIN_S, toScale: MID_S },
      { kind: 'topup', label: 'Довдих носом', hint: 'Короткий повний довдих догори', durationSec: 1.5, fromScale: MID_S, toScale: MAX_S },
      { kind: 'exhale', label: 'Глибокий видих', hint: 'Довгий, спокійний видих ротом', durationSec: 5.7, fromScale: MAX_S, toScale: MIN_S },
      { kind: 'rest', label: 'Пауза', hint: 'Тихий перепочинок перед наступним вдихом', durationSec: 1.2, fromScale: MIN_S, toScale: MIN_S },
    ];
    return {
      phases: normalizePhasesToCycleDuration(raw, cycleDurationSec),
      cycleCount,
      cycleDurationSec,
      soundSequence,
    };
  }

  if (activityId === 'vocal_humming') {
    const exLabel = singleSound ? `Видих: ${singleSound}` : 'Видих: м-м-м';
    const raw: BreathPhase[] = [
      { kind: 'inhale', label: 'Глибокий вдих', hint: 'Повільний глибокий вдих без напруги', durationSec: 3.8, fromScale: MIN_S, toScale: MAX_S },
      { kind: 'hold', label: 'Затримка', hint: 'М’яка пауза перед звучанням', durationSec: 0.9, fromScale: MAX_S, toScale: MAX_S },
      { kind: 'exhale', label: exLabel, hint: 'Протяжний рівний звук на повільному видиху', durationSec: 5.5, fromScale: MAX_S, toScale: MIN_S },
      { kind: 'rest', label: 'Пауза', hint: 'Природний спокій', durationSec: 1.2, fromScale: MIN_S, toScale: MIN_S },
    ];
    return {
      phases: normalizePhasesToCycleDuration(raw, cycleDurationSec),
      cycleCount,
      cycleDurationSec,
      soundSequence,
    };
  }

  // vowel_sound_flow: deep breath + long exhale synced with parsed vowel sequence
  const raw: BreathPhase[] = [
    { kind: 'inhale', label: 'Глибокий вдих', hint: 'Спокійний глибокий вдих носом', durationSec: 3.8, fromScale: MIN_S, toScale: MAX_S },
    { kind: 'hold', label: 'Затримка', hint: 'М’яке відчуття наповненості', durationSec: 0.8, fromScale: MAX_S, toScale: MAX_S },
    { kind: 'exhale', label: 'Протяжний видих', hint: 'Плавне звучання голосних на видиху', durationSec: 5.8, fromScale: MAX_S, toScale: MIN_S },
    { kind: 'rest', label: 'Пауза', hint: 'Спокійне завершення циклу', durationSec: 1.1, fromScale: MIN_S, toScale: MIN_S },
  ];
  return {
    phases: normalizePhasesToCycleDuration(raw, cycleDurationSec),
    cycleCount,
    cycleDurationSec,
    soundSequence,
  };
};

const easeInOutSine = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)));

export const SomaticPauseModal: React.FC<SomaticPauseModalProps> = ({
  isOpen,
  activityId,
  durationSec,
  guideVoiceText,
  inhaleSec,
  holdSec,
  exhaleSec,
  restSec,
  cues,
  onComplete,
  onClose,
  inlinePreview = false,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setElapsedMs(0);

    if (guideVoiceText && !inlinePreview) {
      speechAudio.playSpeechBuffer(guideVoiceText, 'Наставник').catch(() => {});
    }

    const startTs = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      setElapsedMs(now - startTs);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      speechAudio.stop();
    };
  }, [durationSec, isOpen, guideVoiceText, inlinePreview]);

  const plan = useMemo(
    () =>
      buildHarmonizedPlan(activityId, durationSec, guideVoiceText, {
        inhaleSec,
        holdSec,
        exhaleSec,
        restSec,
        cues,
      }),
    [activityId, durationSec, guideVoiceText, inhaleSec, holdSec, exhaleSec, restSec, cues]
  );

  if (!isOpen) return null;

  const { phases, cycleCount, cycleDurationSec, soundSequence } = plan;
  const totalDurationMs = Math.max(1, durationSec) * 1000;
  const clampedElapsedMs = Math.min(elapsedMs, totalDurationMs);
  const timeLeft = Math.max(0, Math.ceil((totalDurationMs - elapsedMs) / 1000));

  const elapsedSec = clampedElapsedMs / 1000;
  const currentCycleIndex = Math.min(cycleCount - 1, Math.floor(elapsedSec / cycleDurationSec));
  const cycleTimeSec =
    elapsedSec >= durationSec ? cycleDurationSec - 0.001 : elapsedSec % cycleDurationSec;

  let accSec = 0;
  let activePhase = phases[0];
  let phaseProgress = 0;
  let phaseRemainingSec = phases[0].durationSec;

  for (const ph of phases) {
    if (cycleTimeSec <= accSec + ph.durationSec + 0.0001) {
      activePhase = ph;
      const localSec = Math.max(0, cycleTimeSec - accSec);
      phaseProgress = Math.min(1, localSec / Math.max(0.01, ph.durationSec));
      phaseRemainingSec = Math.max(1, Math.ceil(ph.durationSec - localSec));
      break;
    }
    accSec += ph.durationSec;
  }

  const eased = easeInOutSine(phaseProgress);
  const circleScale =
    activePhase.fromScale + (activePhase.toScale - activePhase.fromScale) * eased;

  // Map vowel/sound cues evenly across the whole exercise progress or cycles
  const activeCueIdx =
    soundSequence.length === 0
      ? -1
      : soundSequence.length <= cycleCount
      ? currentCycleIndex % soundSequence.length
      : Math.min(
          soundSequence.length - 1,
          Math.floor((elapsedSec / Math.max(1, durationSec)) * soundSequence.length)
        );

  // Smooth ∞ Lissajous point for eye_eight synced to total duration
  const eightAngle = (cycleTimeSec / Math.max(1, cycleDurationSec)) * Math.PI * 2;
  const eyeX = 110 + 62 * Math.sin(eightAngle);
  const eyeY = 44 + 22 * Math.sin(eightAngle * 2);

  const handleCloseOrSkip = () => {
    speechAudio.stop();
    if (onClose) {
      onClose();
    } else {
      onComplete();
    }
  };

  const getActivityDetails = () => {
    switch (activityId) {
      case 'vowel_sound_flow':
        return {
          title: `🎵 Плавне звучання голосних (${soundSequence.map((s) => s.replace('…', '')).join(' — ')})`,
          instruction:
            'Зробіть глибокий спокійний вдих і на повільному довгому видиху м’яко протягніть голосні у ритмі кола.',
        };
      case 'double_sigh':
        return {
          title: '🫁 Подвійний фізіологічний видих',
          instruction:
            'Зробіть глибокий вдих носом, короткий довдих догори, а потім довгий повільний видих ротом.',
        };
      case 'vocal_humming':
        return {
          title: '🐝 Вокальне гудіння (М-м-м)',
          instruction:
            'Розслабте плечі, зробіть глибокий вдих і на повільному видиху м’яко звучіть «м-м-м» у ритмі анімації.',
        };
      case 'muscle_squeeze':
        return {
          title: '✊ Стискання та розслаблення кулачків',
          instruction:
            'На вдиху стисніть кулачки, відчуйте силу, а на довгому видиху повністю розтисніть і розслабте долоні.',
        };
      default:
        return {
          title: '👀 Вправа для очей «Вісімка»',
          instruction: 'Повільно стежте очима за рухом світлої точки по плавній горизонтальній вісімці ∞.',
        };
    }
  };

  const activity = getActivityDetails();

  const content = (
    <div className="space-y-4 text-center">
        <div className="status-panel status-panel--success space-y-2">
          <h3 className="text-base font-extrabold">{activity.title}</h3>
          <p className="text-xs font-medium leading-relaxed">{activity.instruction}</p>
          {guideVoiceText && (
            <div className="pt-2 mt-2 border-t border-[var(--ok-border)] text-xs font-bold">
              🎙️ Супровід: «{guideVoiceText}»
            </div>
          )}
        </div>

        <div className="surface-subtle rounded-[var(--radius-md)] p-4 border border-[var(--border)] flex flex-col items-center gap-2">
          {activityId === 'eye_eight' ? (
            <div className="h-32 w-full flex flex-col items-center justify-center">
              <svg viewBox="0 0 220 88" className="w-full max-w-[240px] h-auto" aria-label="Траєкторія вісімки для очей">
                <path
                  d="M 110 44 C 145 14, 178 14, 178 44 C 178 74, 145 74, 110 44 C 75 14, 42 14, 42 44 C 42 74, 75 74, 110 44 Z"
                  fill="none"
                  stroke="var(--border-hover)"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                />
                <circle
                  cx={eyeX}
                  cy={eyeY}
                  r="9"
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth="2.5"
                />
              </svg>
            </div>
          ) : (
            /* Fixed-height stage box accommodates deeper 0.74x..1.32x breathing expansion cleanly */
            <div className="h-36 w-full flex items-center justify-center">
              <div
                className="w-24 h-24 rounded-full border-2 border-[var(--accent)] bg-[var(--hl-bg)] text-[var(--hl-text)] flex flex-col items-center justify-center px-2 leading-tight shadow-sm will-change-transform"
                style={{
                  transform: `scale(${circleScale.toFixed(3)})`,
                }}
              >
                <span className="text-[11px] font-extrabold">{activePhase.label}</span>
                <span className="text-[11px] font-mono font-bold tabular-nums opacity-85 mt-0.5">
                  {phaseRemainingSec} с
                </span>
              </div>
            </div>
          )}

          <p className="text-xs font-bold text-[var(--text-muted)] min-h-[1.25rem]">
            {activePhase.hint}
          </p>

          {/* Auto-harmonized cycle metadata synced with block durationSec */}
          <div className="w-full max-w-xs space-y-1.5 pt-1">
            {activityId !== 'eye_eight' && (
              <div className="w-full flex gap-1" aria-hidden="true">
                {phases.map((ph, idx) => {
                  const isActive = ph.label === activePhase.label && ph.kind === activePhase.kind;
                  return (
                    <div
                      key={`${ph.kind}_${idx}`}
                      className={`h-1.5 rounded-full transition-colors ${
                        isActive ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                      }`}
                      style={{ flexGrow: ph.durationSec }}
                      title={`${ph.label}: ${ph.durationSec.toFixed(1)} с`}
                    />
                  );
                })}
              </div>
            )}
            <div className="text-[10px] font-mono font-bold text-[var(--text-muted)] tabular-nums">
              Цикл {currentCycleIndex + 1}/{cycleCount} · ~{cycleDurationSec.toFixed(1)} с (узгоджено з {durationSec} с)
            </div>
          </div>

          {activityId === 'vowel_sound_flow' && soundSequence.length > 0 && (
            <>
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] pt-1">
                Звуковий ряд вправи
              </span>
              <div className="flex flex-wrap justify-center items-center gap-2">
                {soundSequence.map((v, i) => (
                  <span
                    key={`${v}_${i}`}
                    className={`px-3 py-1 rounded-[var(--radius-full)] font-extrabold text-sm border transition-colors ${
                      i === activeCueIdx
                        ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="text-3xl font-black font-mono tabular-nums text-[var(--primary-dark)]">
          {timeLeft > 0 ? `${timeLeft}с` : '✨ Готово!'}
        </div>

        <div className="space-y-2 pt-1">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              speechAudio.stop();
              onComplete();
            }}
            className="w-full"
          >
            {timeLeft > 0 ? '👍 Завершити розминку зараз' : '👍 Чудово! Продовжити урок'}
          </Button>

          {timeLeft > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleCloseOrSkip}>
              ⏩ Пропустити розминку
            </Button>
          )}
        </div>
      </div>
  );

  if (inlinePreview) {
    return <div className="card space-y-3">{content}</div>;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCloseOrSkip} title="🧘 Соматична пауза та розминка">
      {content}
    </Modal>
  );
};
