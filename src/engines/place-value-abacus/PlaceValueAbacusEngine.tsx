import React, { useEffect, useMemo, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface PlaceValueAbacusConfig {
  targetValue?: number;
  initialValue?: number;
  allowDecimals?: boolean;
  instruction?: string;
}

interface AbacusColumnDef {
  id: string;
  label: string;
  subLabel: string;
  scaleFactor: number; // integer factor relative to 1 (or 0.01 when decimal mode)
  isDecimalPart?: boolean;
  borderStyle: 'solid' | 'dashed' | 'dotted';
}

export const PlaceValueAbacusEngine: React.FC<EngineProps<PlaceValueAbacusConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const target = config.targetValue ?? 1245;
  const isDecimalMode = Boolean(
    config.allowDecimals || Math.abs(target - Math.round(target)) > 1e-6
  );

  // Integer scaling: 100 when decimal mode (0.01 = 1 unit), 1 when integer mode
  const precisionScale = isDecimalMode ? 100 : 1;
  const targetScaled = Math.round(target * precisionScale);

  const columns: AbacusColumnDef[] = useMemo(() => {
    if (isDecimalMode) {
      return [
        { id: 'tens', label: 'Десятки', subLabel: '×10', scaleFactor: 1000, borderStyle: 'solid' },
        { id: 'ones', label: 'Одиниці', subLabel: '×1', scaleFactor: 100, borderStyle: 'solid' },
        { id: 'tenths', label: 'Десяті', subLabel: '×0.1', scaleFactor: 10, isDecimalPart: true, borderStyle: 'dashed' },
        { id: 'hundredths', label: 'Соті', subLabel: '×0.01', scaleFactor: 1, isDecimalPart: true, borderStyle: 'dotted' },
      ];
    }
    return [
      { id: 'thousands', label: 'Тисячі', subLabel: '×1000', scaleFactor: 1000, borderStyle: 'solid' },
      { id: 'hundreds', label: 'Сотні', subLabel: '×100', scaleFactor: 100, borderStyle: 'dashed' },
      { id: 'tens', label: 'Десятки', subLabel: '×10', scaleFactor: 10, borderStyle: 'solid' },
      { id: 'ones', label: 'Одиниці', subLabel: '×1', scaleFactor: 1, borderStyle: 'dotted' },
    ];
  }, [isDecimalMode]);

  const computeInitialDigits = () => {
    const initScaled = Math.max(0, Math.round((config.initialValue ?? 0) * precisionScale));
    const map: Record<string, number> = {};
    let rem = initScaled;
    columns.forEach((col) => {
      const d = Math.min(9, Math.floor(rem / col.scaleFactor));
      map[col.id] = d;
      rem -= d * col.scaleFactor;
    });
    return map;
  };

  const [digits, setDigits] = useState<Record<string, number>>(computeInitialDigits);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setDigits(computeInitialDigits());
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.targetValue, config.initialValue, isDecimalMode]);

  const currentScaled = columns.reduce(
    (sum, col) => sum + (digits[col.id] ?? 0) * col.scaleFactor,
    0
  );
  const formatScaled = (scaled: number): string =>
    isDecimalMode ? (scaled / 100).toFixed(2).replace(/\.?0+$/, (m) => (m.includes('.') ? '' : m)) : String(scaled);

  const formattedCurrent = isDecimalMode
    ? (currentScaled / 100).toFixed(2).replace('.', ',')
    : String(currentScaled);
  const formattedTarget = isDecimalMode
    ? (targetScaled / 100).toFixed(2).replace('.', ',')
    : String(targetScaled);

  const isSuccess = currentScaled === targetScaled;

  const updateDigit = (colId: string, delta: number) => {
    if (isReadOnly) return;
    setDigits((prev) => {
      const cur = prev[colId] ?? 0;
      const next = Math.max(0, Math.min(9, cur + delta));
      return { ...prev, [colId]: next };
    });
    setFeedback(null);
  };

  const handleVerify = () => {
    if (isSuccess) {
      setFeedback(`🎯 Точно! Рахівниця відтворює число ${formattedTarget}.`);
      if (onSubmitAnswer) {
        onSubmitAnswer(Number(formatScaled(currentScaled)));
      }
    } else {
      setFeedback(
        `💡 Зараз на рахівниці: ${formattedCurrent}. Потрібно утворити ${formattedTarget}.`
      );
    }
  };

  return (
    <div className="p-4 sm:p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card min-w-0 overflow-hidden">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          🧮 Соробан-рахівниця розрядного складу
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction ||
            `Виставте намистини на спицях розрядів, щоб отримати число ${formattedTarget}:`}
        </p>
      </div>

      {/* Fixed-height Abacus Columns Grid (never expands vertically on 6..9 beads) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
        {columns.map((col, idx) => {
          const val = digits[col.id] ?? 0;
          return (
            <div
              key={col.id}
              className="p-2.5 rounded-[var(--radius-sm)] border-2 text-center space-y-2 flex flex-col justify-between min-w-0"
              style={{
                borderStyle: col.borderStyle,
                borderColor: col.isDecimalPart ? 'var(--ok-border)' : 'var(--border-hover)',
                backgroundColor: col.isDecimalPart ? 'var(--ok-bg)' : 'var(--surface-alt)',
                color: col.isDecimalPart ? 'var(--ok-text)' : 'var(--text)',
              }}
            >
              <div className="leading-tight min-w-0">
                <span className="text-[11px] font-extrabold uppercase tracking-wide block truncate">
                  {isDecimalMode && idx === 2 ? `, ${col.label}` : col.label}
                </span>
                <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] tabular-nums">
                  {col.subLabel}
                </span>
              </div>

              {/* Fixed-height Soroban Rod (h-[152px] strictly accommodates 0..9 beads without shifting) */}
              <div className="relative h-[152px] w-full bg-[var(--surface)] rounded-[var(--radius-sm)] border border-[var(--border)] flex flex-col items-center justify-end p-1.5 gap-1 overflow-hidden">
                {/* Vertical central rod */}
                <div
                  className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-1 rounded-full bg-[var(--border-hover)] pointer-events-none"
                  aria-hidden="true"
                />
                {/* Top 5-separator visual bar */}
                <div
                  className="absolute top-1.5 inset-x-2 h-0.5 bg-[var(--border)] pointer-events-none"
                  aria-hidden="true"
                />

                {Array.from({ length: val }).map((_, beadIdx) => (
                  <div
                    key={beadIdx}
                    className={`relative z-10 w-full max-w-[46px] h-3 rounded-full border transition-transform ${
                      beadIdx >= 5
                        ? 'bg-[var(--hl-bg)] border-[var(--accent)]'
                        : 'bg-[var(--accent)] border-[var(--primary-dark)]'
                    }`}
                  />
                ))}
              </div>

              {!isReadOnly ? (
                <div className="flex items-center justify-center gap-1.5 pt-0.5 min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={val <= 0}
                    onClick={() => updateDigit(col.id, -1)}
                    aria-label={`Зменшити ${col.label}`}
                  >
                    −
                  </Button>
                  <span className="font-mono font-extrabold text-sm min-w-[1.5rem] text-center tabular-nums text-[var(--text)]">
                    {val}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={val >= 9}
                    onClick={() => updateDigit(col.id, 1)}
                    aria-label={`Збільшити ${col.label}`}
                  >
                    +
                  </Button>
                </div>
              ) : (
                <div className="font-mono font-extrabold text-sm tabular-nums">{val}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Place Value Formula Summary */}
      <div className="p-2.5 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--border)] text-center font-mono text-xs font-bold text-[var(--text)] tabular-nums flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>
          {columns
            .map((c) => `${digits[c.id] ?? 0}${c.subLabel}`)
            .join(' + ')}{' '}
          =
        </span>
        <span className="text-base font-extrabold text-[var(--primary-dark)]">{formattedCurrent}</span>
      </div>

      {feedback && (
        <div className={`status-panel ${isSuccess ? 'status-panel--success' : 'status-panel--warning'}`}>
          {feedback}
        </div>
      )}

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDigits(computeInitialDigits());
              setFeedback(null);
            }}
          >
            ↺ Скинути
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleVerify}
            className="flex-1 min-w-[200px]"
          >
            Підтвердити значення ({formattedCurrent})
          </Button>
        </div>
      )}
    </div>
  );
};
