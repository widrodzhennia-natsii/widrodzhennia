import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface BalancePhysicsConfig {
  mode?: 'weights' | 'equation';
  targetSum?: number;
  targetValue?: number;
  targetNumber?: number;
  leftConstant?: number;
  unknownValue?: number;
  initialTens?: number;
  initialOnes?: number;
  unitLabel?: string;
  instruction?: string;
}

export const BalancePhysicsEngine: React.FC<EngineProps<BalancePhysicsConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const unit = config.unitLabel || 'кг';
  const isEquationMode =
    config.mode === 'equation' ||
    config.unknownValue !== undefined ||
    config.leftConstant !== undefined;

  const rightTarget = config.targetSum ?? config.targetValue ?? config.targetNumber ?? 14;
  const leftConstant = isEquationMode ? (config.leftConstant ?? 0) : 0;
  const expectedAnswer = isEquationMode
    ? config.unknownValue ?? Math.max(0, rightTarget - leftConstant)
    : rightTarget;

  const [tens, setTens] = useState(config.initialTens ?? 0);
  const [ones, setOnes] = useState(config.initialOnes ?? 0);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setTens(config.initialTens ?? 0);
    setOnes(config.initialOnes ?? 0);
    setFeedback(null);
  }, [config, rightTarget, leftConstant]);

  const studentWeight = tens * 10 + ones;
  const leftTotal = isEquationMode ? leftConstant + studentWeight : rightTarget;
  const rightTotal = isEquationMode ? rightTarget : studentWeight;

  // Positive diff -> right side heavier -> clockwise tilt; negative -> counter-clockwise
  const diff = rightTotal - leftTotal;
  const isBalanced = diff === 0;
  const tiltAngle = Math.max(-14, Math.min(14, diff * 1.4));

  const adjustWeight = (kind: 'tens' | 'ones', delta: number) => {
    if (isReadOnly) return;
    setFeedback(null);
    if (kind === 'tens') {
      setTens((prev) => Math.max(0, Math.min(20, prev + delta)));
    } else {
      setOnes((prev) => Math.max(0, Math.min(20, prev + delta)));
    }
  };

  const handleCheck = () => {
    if (isBalanced) {
      setFeedback(
        isEquationMode
          ? `🎉 Рівняння розв’язано! X = ${studentWeight} (${leftConstant} + ${studentWeight} = ${rightTarget}).`
          : `🎉 Ідеальна рівновага! Обидві шальки по ${rightTarget} ${unit}.`
      );
      if (onSubmitAnswer) {
        onSubmitAnswer(isEquationMode ? expectedAnswer : studentWeight);
      }
    } else {
      setFeedback(
        diff > 0
          ? `⚖️ Права шалька переважує на ${diff} ${unit}. Додайте вагу ліворуч або зніміть праворуч.`
          : `⚖️ Ліва шалька переважує на ${Math.abs(diff)} ${unit}. Зменште або додайте гирі для рівноваги.`
      );
    }
  };

  const renderWeightBadges = (
    totalConst: number,
    isInteractiveCup: boolean,
    labelPrefix: string
  ) => {
    const tCount = Math.floor(totalConst / 10);
    const oCount = totalConst % 10;

    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        {isInteractiveCup && isEquationMode && (
          <span className="px-1.5 py-0.5 rounded border-2 border-[var(--accent)] bg-[var(--hl-bg)] text-[var(--hl-text)] text-[11px] font-mono font-extrabold tabular-nums">
            X = {studentWeight}
          </span>
        )}
        {tCount > 0 && tCount <= 5 &&
          Array.from({ length: tCount }).map((_, i) =>
            isInteractiveCup ? (
              <button
                key={`t-${i}`}
                type="button"
                disabled={isReadOnly}
                onClick={() => adjustWeight('tens', -1)}
                title={`Зняти 10 ${unit}`}
                className="px-1.5 py-0.5 rounded border border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)] text-[10px] font-mono font-bold cursor-pointer hover:border-[var(--err-border)]"
              >
                ▪10 ✕
              </button>
            ) : (
              <span
                key={`t-${i}`}
                className="px-1.5 py-0.5 rounded border border-[var(--border-hover)] bg-[var(--surface)] text-[var(--text)] text-[10px] font-mono font-bold"
              >
                ▪10
              </span>
            )
          )}
        {tCount > 5 && (
          <span className="px-1.5 py-0.5 rounded border border-[var(--border-hover)] bg-[var(--surface)] text-[var(--text)] text-[10px] font-mono font-bold tabular-nums">
            ▪10 ×{tCount}
          </span>
        )}

        {oCount > 0 && oCount <= 5 &&
          Array.from({ length: oCount }).map((_, i) =>
            isInteractiveCup ? (
              <button
                key={`o-${i}`}
                type="button"
                disabled={isReadOnly}
                onClick={() => adjustWeight('ones', -1)}
                title={`Зняти 1 ${unit}`}
                className="px-1.5 py-0.5 rounded-full border border-[var(--border-hover)] bg-[var(--surface-alt)] text-[var(--text)] text-[10px] font-mono font-bold cursor-pointer hover:border-[var(--err-border)]"
              >
                ●1 ✕
              </button>
            ) : (
              <span
                key={`o-${i}`}
                className="px-1.5 py-0.5 rounded-full border border-[var(--border-hover)] bg-[var(--surface-alt)] text-[var(--text)] text-[10px] font-mono font-bold"
              >
                ●1
              </span>
            )
          )}
        {oCount > 5 && (
          <span className="px-1.5 py-0.5 rounded-full border border-[var(--border-hover)] bg-[var(--surface-alt)] text-[var(--text)] text-[10px] font-mono font-bold tabular-nums">
            ●1 ×{oCount}
          </span>
        )}

        {totalConst === 0 && !(isInteractiveCup && isEquationMode) && (
          <span className="text-[10px] text-[var(--text-muted)] italic">
            {labelPrefix}: 0 {unit}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card select-none min-w-0 overflow-hidden">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          ⚖️ {isEquationMode ? 'Терези рівнянь з невідомим X' : 'Інтерактивні вагові терези'}
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium max-w-md mx-auto">
          {config.instruction ||
            (isEquationMode
              ? `Знайдіть невідоме X, щоб зрівноважити ${leftConstant} + X = ${rightTarget}:`
              : `Додавайте або знімайте гирі (+10 / +1 ${unit}), щоб зрівноважити ${rightTarget} ${unit}:`)}
        </p>
      </div>

      {/* Fixed-height Balance Stage with Gravity-Vertical Counter-Rotated Cups */}
      <div className="p-4 bg-[var(--bg)] rounded-[var(--radius-md)] border border-[var(--border)] space-y-3 overflow-hidden">
        <div className="relative w-full max-w-md mx-auto h-[184px] flex justify-center items-start pt-5">
          {/* Central Pedestal & Fulcrum */}
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-3 rounded-full bg-[var(--border-hover)]"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-5 h-28 rounded-t-md bg-[var(--text-muted)]"
            aria-hidden="true"
          />

          {/* Tilting Beam */}
          <div
            className="relative w-[92%] max-w-[360px] h-2.5 rounded-full bg-[var(--accent)] transition-transform duration-300 ease-out flex items-center justify-between px-1 z-10 mt-6"
            style={{ transform: `rotate(${tiltAngle}deg)` }}
          >
            {/* Left Cup Hanger (counter-rotates so cup always hangs strictly vertical under gravity!) */}
            <div
              className="relative flex flex-col items-center transition-transform duration-300 ease-out"
              style={{
                transform: `rotate(${-tiltAngle}deg)`,
                transformOrigin: 'top center',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary-dark)] -mt-1" />
              <div className="w-0.5 h-8 bg-[var(--border-hover)]" />
              <div
                className={`w-32 sm:w-36 h-[86px] overflow-y-auto rounded-b-xl border-2 p-1.5 flex flex-col justify-between items-center transition-colors ${
                  isBalanced
                    ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                    : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                }`}
              >
                <span className="text-[10px] font-extrabold tabular-nums">
                  {isEquationMode ? `${leftConstant} + X = ${leftTotal}` : `Ціль: ${leftTotal} ${unit}`}
                </span>
                {renderWeightBadges(
                  isEquationMode ? leftConstant : rightTarget,
                  isEquationMode,
                  'Ліва'
                )}
              </div>
            </div>

            {/* Central Fulcrum Dial + Moving Needle */}
            <div className="relative flex items-center justify-center z-20">
              <div className="w-9 h-9 rounded-full bg-[var(--surface)] border-2 border-[var(--primary-dark)] flex items-center justify-center shadow-sm">
                <div
                  className="w-0.5 h-5 bg-[var(--accent)] rounded-full transition-transform duration-300"
                  style={{ transform: `rotate(${tiltAngle * 1.8}deg)` }}
                />
              </div>
            </div>

            {/* Right Cup Hanger (counter-rotates so cup always hangs strictly vertical) */}
            <div
              className="relative flex flex-col items-center transition-transform duration-300 ease-out"
              style={{
                transform: `rotate(${-tiltAngle}deg)`,
                transformOrigin: 'top center',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary-dark)] -mt-1" />
              <div className="w-0.5 h-8 bg-[var(--border-hover)]" />
              <div
                className={`w-32 sm:w-36 h-[86px] overflow-y-auto rounded-b-xl border-2 p-1.5 flex flex-col justify-between items-center transition-colors ${
                  isBalanced
                    ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                    : 'bg-[var(--surface)] border-[var(--border-hover)] text-[var(--text)]'
                }`}
              >
                <span className="text-[10px] font-extrabold tabular-nums">
                  {isEquationMode ? `Еталон: ${rightTotal} ${unit}` : `Ваша: ${rightTotal} ${unit}`}
                </span>
                {renderWeightBadges(
                  isEquationMode ? rightTarget : studentWeight,
                  !isEquationMode,
                  'Права'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Equilibrium Banner (fixed height so zero UI jump) */}
        <div className="flex justify-center">
          <div
            className={`status-panel text-xs font-bold tabular-nums min-h-[2.5rem] flex items-center justify-center ${
              isBalanced ? 'status-panel--success' : 'status-panel--neutral'
            }`}
          >
            {isBalanced
              ? `✓ Рівновага! (${leftTotal} = ${rightTotal})`
              : diff > 0
              ? `▲ Права шалька важча на ${diff} ${unit}`
              : `▲ Ліва шалька важча на ${Math.abs(diff)} ${unit}`}
          </div>
        </div>
      </div>

      {/* Symmetric Add & Subtract Weight Controls */}
      {!isReadOnly && (
        <div className="space-y-2">
          <span className="text-xs font-extrabold text-[var(--text-muted)] block text-center">
            {isEquationMode
              ? `Керування значенням X (зараз X = ${studentWeight}):`
              : `Керування гирями на шальці (зараз ${studentWeight} ${unit}):`}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={tens <= 0}
              onClick={() => adjustWeight('tens', -1)}
            >
              −10 {isEquationMode ? '' : unit}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={tens >= 20}
              onClick={() => adjustWeight('tens', 1)}
            >
              +10 {isEquationMode ? '' : unit}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ones <= 0}
              onClick={() => adjustWeight('ones', -1)}
            >
              −1 {isEquationMode ? '' : unit}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ones >= 20}
              onClick={() => adjustWeight('ones', 1)}
            >
              +1 {isEquationMode ? '' : unit}
            </Button>
          </div>
        </div>
      )}

      {feedback && !isBalanced && (
        <div className="status-panel status-panel--warning text-xs">{feedback}</div>
      )}

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setTens(config.initialTens ?? 0);
              setOnes(config.initialOnes ?? 0);
              setFeedback(null);
            }}
          >
            ↺ Скинути
          </Button>
          <Button type="button" variant="primary" onClick={handleCheck} className="flex-1 min-w-[200px]">
            {isEquationMode
              ? `Перевірити рівновагу (X = ${studentWeight})`
              : `Підтвердити зрівноваження (${studentWeight} ${unit})`}
          </Button>
        </div>
      )}
    </div>
  );
};
