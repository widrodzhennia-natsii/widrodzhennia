import React from 'react';
import { ResolvedDensityMode } from '../../core/state/useLayoutPrefsStore';

interface ProgressStepMeta {
  id?: string;
  title?: string;
  headline?: string;
  type?: string;
}

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  chapterTitle: string;
  steps?: ProgressStepMeta[];
  completedBlockIds?: string[];
  onSelectStep?: (index: number) => void;
  effectiveDensity?: ResolvedDensityMode;
  cascadeStart?: number;
  cascadeEnd?: number;
  docScrollPercent?: number;
  docActiveStepIndex?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  chapterTitle,
  steps = [],
  completedBlockIds = [],
  onSelectStep,
  effectiveDensity = 'slides',
  cascadeStart = 0,
  cascadeEnd = 0,
  docScrollPercent = 0,
  docActiveStepIndex = 0,
}) => {
  const safeTotal = Math.max(1, totalSteps);
  const safeCurrent = Math.min(Math.max(1, currentStep), safeTotal);
  const activeIdx =
    effectiveDensity === 'document'
      ? Math.min(Math.max(0, docActiveStepIndex), safeTotal - 1)
      : safeCurrent - 1;

  const stepPercent = Math.min(100, Math.round((safeCurrent / safeTotal) * 100));
  const completedCount = steps.reduce((acc, meta, idx) => {
    const id = meta?.id || `step_${idx}`;
    return completedBlockIds.includes(id) ? acc + 1 : acc;
  }, 0);

  const maxDots = 12;
  let start = 0;
  let end = safeTotal;
  if (safeTotal > maxDots) {
    const half = Math.floor(maxDots / 2);
    start = Math.max(0, Math.min(activeIdx - half, safeTotal - maxDots));
    end = start + maxDots;
  }

  const visibleCount = end - start;
  const visibleActiveOffset = activeIdx - start;

  const lineFillPercent =
    effectiveDensity === 'document'
      ? Math.min(100, Math.max(0, docScrollPercent))
      : visibleCount > 1
      ? Math.min(100, Math.max(0, (visibleActiveOffset / (visibleCount - 1)) * 100))
      : 100;

  // Cascade visual span bracket across visible dots
  const clampedWinStart = Math.max(start, Math.min(cascadeStart, end - 1));
  const clampedWinEnd = Math.max(clampedWinStart, Math.min(cascadeEnd, end - 1));
  const showWindowBand =
    effectiveDensity === 'cascade' && visibleCount > 1 && clampedWinEnd > clampedWinStart;
  const bandStartRatio = visibleCount > 1 ? (clampedWinStart - start) / (visibleCount - 1) : 0;
  const bandSpanRatio =
    visibleCount > 1 ? (clampedWinEnd - clampedWinStart) / (visibleCount - 1) : 1;

  const isMultiCascade = effectiveDensity === 'cascade' && cascadeEnd > cascadeStart;

  const desktopStatusText =
    effectiveDensity === 'document'
      ? `Конспект · ${docScrollPercent}% · Розділ ${activeIdx + 1}/${safeTotal}${
          completedCount > 0 ? ` (✓ ${completedCount})` : ''
        }`
      : isMultiCascade
      ? `Каскад ${cascadeStart + 1}–${cascadeEnd + 1} з ${safeTotal} · Крок ${safeCurrent} (${stepPercent}%)`
      : `Етап ${safeCurrent} з ${safeTotal} (${stepPercent}%)`;

  const mobileStatusText =
    effectiveDensity === 'document'
      ? `Конспект · ${docScrollPercent}%`
      : isMultiCascade
      ? `${cascadeStart + 1}–${cascadeEnd + 1}/${safeTotal} · ${stepPercent}%`
      : `${safeCurrent}/${safeTotal} · ${stepPercent}%`;

  return (
    <div className="lesson-progress-strip" aria-label="Прогрес уроку">
      <div className="lesson-progress-inner">
        <div className="flex items-center justify-between gap-2 sm:max-w-[34%] sm:shrink-0 min-w-0">
          <span className="truncate text-[11px] sm:text-xs font-extrabold text-[var(--text)]">
            {chapterTitle}
          </span>
          <span className="sm:hidden text-[11px] font-extrabold text-[var(--text-muted)] tabular-nums shrink-0">
            {mobileStatusText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {start > 0 && onSelectStep && (
            <button
              type="button"
              onClick={() => onSelectStep(0)}
              className="text-[10px] font-mono font-bold text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer px-0.5 shrink-0"
              title="На початок (Етап 1)"
            >
              1…
            </button>
          )}

          <div className="progress-track">
            <div className="progress-track-rail" />

            {showWindowBand && (
              <div
                className="progress-window-band"
                style={{
                  left: `calc(1px + (100% - 12px) * ${bandStartRatio})`,
                  width: `calc(10px + (100% - 12px) * ${bandSpanRatio})`,
                }}
              />
            )}

            <div
              className="progress-track-fill"
              style={{ width: `calc((100% - 12px) * ${lineFillPercent / 100})` }}
            />

            {Array.from({ length: visibleCount }).map((_, offsetIdx) => {
              const idx = start + offsetIdx;
              const meta = steps[idx];
              const stepId = meta?.id || `step_${idx}`;
              const isCompleted = completedBlockIds.includes(stepId);
              const isCurrent = idx === activeIdx;
              const isInCascadeWindow =
                effectiveDensity === 'cascade' && idx >= cascadeStart && idx <= cascadeEnd;
              const stepLabel = meta?.title || meta?.headline;
              const tooltip = stepLabel ? `Етап ${idx + 1}: ${stepLabel}` : `Етап ${idx + 1}`;

              const dotClass = isCurrent
                ? 'progress-dot progress-dot--current'
                : isCompleted || (effectiveDensity !== 'document' && idx < activeIdx)
                ? `progress-dot progress-dot--done ${isInCascadeWindow ? 'progress-dot--in-window' : ''}`
                : isInCascadeWindow
                ? 'progress-dot progress-dot--in-window'
                : 'progress-dot';

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!onSelectStep}
                  onClick={() => onSelectStep?.(idx)}
                  title={tooltip}
                  aria-label={tooltip}
                  className={`${dotClass} ${onSelectStep ? 'cursor-pointer' : 'cursor-default'}`}
                />
              );
            })}
          </div>

          {end < safeTotal && onSelectStep && (
            <button
              type="button"
              onClick={() => onSelectStep(safeTotal - 1)}
              className="text-[10px] font-mono font-bold text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer px-0.5 shrink-0"
              title={`До кінця (Етап ${safeTotal})`}
            >
              …{safeTotal}
            </button>
          )}
        </div>

        <span className="hidden sm:inline text-xs font-extrabold text-[var(--text-muted)] tabular-nums shrink-0 whitespace-nowrap">
          {desktopStatusText}
        </span>
      </div>
    </div>
  );
};
