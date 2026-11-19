import React, { useEffect, useMemo, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';
import { SvgHatchDefs, useWidgetHatchIds } from '../../components/widgets/SvgHatchDefs';

export interface NumberLineScalesConfig {
  scaleType?: 'thermometer' | 'beaker' | 'clock' | 'ruler';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  initialValue?: number;
  targetValue?: number;
  tolerance?: number;
  // Clock-specific options
  targetHour?: number;
  targetMinute?: number;
  initialHour?: number;
  initialMinute?: number;
  hideDigital?: boolean;
  instruction?: string;
}

const roundPrecision = (val: number): number => Math.round(val * 100) / 100;

const pad2 = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, '0');

export const NumberLineScalesEngine: React.FC<EngineProps<NumberLineScalesConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const hatchIds = useWidgetHatchIds();
  const scaleType = config.scaleType || 'thermometer';
  const isClock = scaleType === 'clock';

  const min = config.min ?? (scaleType === 'thermometer' ? -20 : 0);
  const max = config.max ?? (scaleType === 'thermometer' ? 40 : scaleType === 'beaker' ? 200 : 15);
  const safeMax = max <= min ? min + 10 : max;
  const step = Math.max(0.1, config.step ?? (scaleType === 'beaker' ? 10 : scaleType === 'ruler' ? 0.5 : 1));
  const unit = config.unit ?? (scaleType === 'thermometer' ? '°C' : scaleType === 'beaker' ? 'мл' : 'см');

  const initialNumeric = useMemo(() => {
    const fallback = min <= 0 && safeMax >= 0 ? 0 : min;
    const raw = config.initialValue ?? fallback;
    return roundPrecision(Math.max(min, Math.min(safeMax, raw)));
  }, [config.initialValue, min, safeMax]);

  const targetNumeric = useMemo(() => {
    const raw = config.targetValue ?? roundPrecision(min + (safeMax - min) * 0.6);
    return roundPrecision(Math.max(min, Math.min(safeMax, raw)));
  }, [config.targetValue, min, safeMax]);

  const numericTolerance = config.tolerance ?? step * 0.05;

  const normalizeHour = (h: number) => {
    const mod = ((Math.round(h) % 12) + 12) % 12;
    return mod === 0 ? 12 : mod;
  };
  const normalizeMinute = (m: number) => ((Math.round(m) % 60) + 60) % 60;

  const initH = normalizeHour(config.initialHour ?? 12);
  const initM = normalizeMinute(config.initialMinute ?? 0);
  const targetH = normalizeHour(config.targetHour ?? 3);
  const targetM = normalizeMinute(config.targetMinute ?? 30);

  const [value, setValue] = useState<number>(initialNumeric);
  const [hour, setHour] = useState<number>(initH);
  const [minute, setMinute] = useState<number>(initM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);

  useEffect(() => {
    setValue(initialNumeric);
    setHour(initH);
    setMinute(initM);
    setFeedback(null);
    setIsSuccessState(false);
  }, [initialNumeric, initH, initM, config.scaleType, config.targetValue, config.targetHour, config.targetMinute]);

  const clampNumeric = (next: number) => {
    const snapped = Math.round((next - min) / step) * step + min;
    const bounded = Math.max(min, Math.min(safeMax, snapped));
    return roundPrecision(bounded);
  };

  const handleSetValue = (next: number) => {
    if (isReadOnly) return;
    setValue(clampNumeric(next));
    setFeedback(null);
    setIsSuccessState(false);
  };

  const adjustClockMinutes = (deltaMinutes: number) => {
    if (isReadOnly) return;
    const total = (hour % 12) * 60 + minute + deltaMinutes;
    const wrapped = ((total % 720) + 720) % 720;
    const nextH = normalizeHour(Math.floor(wrapped / 60));
    const nextM = wrapped % 60;
    setHour(nextH);
    setMinute(nextM);
    setFeedback(null);
    setIsSuccessState(false);
  };

  const handleReset = () => {
    if (isReadOnly) return;
    setValue(initialNumeric);
    setHour(initH);
    setMinute(initM);
    setFeedback(null);
    setIsSuccessState(false);
  };

  const handleConfirm = () => {
    if (isClock) {
      const hourMatch = hour % 12 === targetH % 12;
      const minMatch = Math.abs(minute - targetM) <= (config.tolerance ?? 0);
      if (hourMatch && minMatch) {
        setIsSuccessState(true);
        setFeedback(`🎯 Чудово! На годиннику рівно ${pad2(hour)}:${pad2(minute)}.`);
        onSubmitAnswer?.({ hour, minute });
      } else {
        setIsSuccessState(false);
        setFeedback(
          config.hideDigital
            ? `💡 Положення стрілок не збігається із завданням (${targetH}:${pad2(targetM)}). Перевірте коротку годинну й довгу хвилинну стрілки!`
            : `💡 Зараз виставлено ${hour}:${pad2(minute)}, а потрібно ${targetH}:${pad2(targetM)}. Відкоригуйте стрілки.`
        );
      }
      return;
    }

    const matched = Math.abs(value - targetNumeric) <= numericTolerance;
    if (matched) {
      setIsSuccessState(true);
      setFeedback(`🎯 Точно! Прилад показує ${value} ${unit}.`);
      onSubmitAnswer?.(value);
    } else {
      setIsSuccessState(false);
      const dirHint = value < targetNumeric ? 'Додайте' : 'Зменште';
      setFeedback(
        `💡 Зараз на шкалі ${value} ${unit}, а ціль — ${targetNumeric} ${unit}. ${dirHint} показання (ціна поділки: ${step} ${unit}).`
      );
    }
  };

  // Generate scale ticks cleanly avoiding overcrowding
  const ticks = useMemo(() => {
    const totalSteps = Math.max(1, Math.round((safeMax - min) / step));
    const majorEvery = totalSteps <= 10 ? 2 : totalSteps <= 25 ? 5 : Math.ceil(totalSteps / 6);
    const list: Array<{ val: number; ratio: number; isMajor: boolean }> = [];
    // Guard against huge step count
    const renderStride = totalSteps > 60 ? Math.ceil(totalSteps / 40) : 1;
    for (let i = 0; i <= totalSteps; i += renderStride) {
      const v = roundPrecision(min + i * step);
      const ratio = (v - min) / (safeMax - min);
      const isMajor = i % majorEvery === 0 || i === totalSteps;
      list.push({ val: v, ratio, isMajor });
    }
    return list;
  }, [min, safeMax, step]);

  const fillRatio = Math.max(0, Math.min(1, (value - min) / (safeMax - min)));

  const renderSvgInstrument = () => {
    if (scaleType === 'clock') {
      const cx = 130;
      const cy = 115;
      const r = 92;
      const minuteAngle = (minute / 60) * 360 - 90;
      const hourAngle = (((hour % 12) + minute / 60) / 12) * 360 - 90;
      const hrRad = (hourAngle * Math.PI) / 180;
      const minRad = (minuteAngle * Math.PI) / 180;

      return (
        <svg viewBox="0 0 260 230" className="block mx-auto w-full max-w-[270px] h-auto" role="img" aria-label="Аналоговий годинник">
          <SvgHatchDefs ids={hatchIds} />
          <circle cx={cx} cy={cy} r={r + 8} fill="var(--surface-alt)" stroke="var(--border-hover)" strokeWidth="2.2" />
          <circle cx={cx} cy={cy} r={r} fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.4" />

          {/* 60 ticks + 12 numerals */}
          {Array.from({ length: 60 }).map((_, idx) => {
            const isHourMark = idx % 5 === 0;
            const ang = (idx / 60) * Math.PI * 2 - Math.PI / 2;
            const rOuter = r - 4;
            const rInner = isHourMark ? r - 14 : r - 9;
            return (
              <line
                key={idx}
                x1={cx + rInner * Math.cos(ang)}
                y1={cy + rInner * Math.sin(ang)}
                x2={cx + rOuter * Math.cos(ang)}
                y2={cy + rOuter * Math.sin(ang)}
                stroke={isHourMark ? 'var(--text)' : 'var(--border-hover)'}
                strokeWidth={isHourMark ? 2.2 : 1.1}
                strokeLinecap="round"
              />
            );
          })}

          {Array.from({ length: 12 }).map((_, idx) => {
            const num = idx + 1;
            const ang = (num / 12) * Math.PI * 2 - Math.PI / 2;
            const tx = cx + (r - 26) * Math.cos(ang);
            const ty = cy + (r - 26) * Math.sin(ang) + 4;
            return (
              <text
                key={num}
                x={tx}
                y={ty}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fill="var(--text)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {num}
              </text>
            );
          })}

          {/* Hour hand (short thick) */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + 46 * Math.cos(hrRad)}
            y2={cy + 46 * Math.sin(hrRad)}
            stroke="var(--primary-dark)"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Minute hand (long accent) */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + 68 * Math.cos(minRad)}
            y2={cy + 68 * Math.sin(minRad)}
            stroke="var(--accent)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          <circle cx={cx} cy={cy} r="5.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        </svg>
      );
    }

    if (scaleType === 'beaker') {
      const topY = 30;
      const bottomY = 200;
      const scaleH = bottomY - topY;
      const liquidY = bottomY - fillRatio * scaleH;
      const liquidH = Math.max(0, bottomY - liquidY);

      return (
        <svg viewBox="0 0 300 232" className="block mx-auto w-full max-w-[310px] h-auto" role="img" aria-label="Вимірювальна мензурка">
          <SvgHatchDefs ids={hatchIds} />
          {/* Beaker outer body */}
          <path
            d="M 78 24 L 88 34 L 88 206 Q 88 214 96 214 L 184 214 Q 192 214 192 206 L 192 28 L 204 24"
            fill="var(--surface-alt)"
            stroke="var(--text)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />

          {/* Liquid fill using hatch + accent opacity */}
          {liquidH > 1 && (
            <>
              <rect
                x="90"
                y={liquidY}
                width="100"
                height={Math.min(liquidH + 10, 212 - liquidY)}
                rx="4"
                fill={`url(#${hatchIds.diagA})`}
              />
              <line
                x1="90"
                y1={liquidY}
                x2="190"
                y2={liquidY}
                stroke="var(--accent)"
                strokeWidth="2.6"
              />
            </>
          )}

          {/* Graduated scale ticks */}
          {ticks.map((t, idx) => {
            const y = bottomY - t.ratio * scaleH;
            return (
              <g key={idx}>
                <line
                  x1={t.isMajor ? 156 : 170}
                  y1={y}
                  x2="191"
                  y2={y}
                  stroke="var(--text)"
                  strokeWidth={t.isMajor ? 1.8 : 1}
                />
                {t.isMajor && (
                  <>
                    <rect x="197" y={y - 8} width="54" height="15" rx="3" fill="var(--surface)" fillOpacity="0.92" />
                    <text
                      x="200"
                      y={y + 3.5}
                      fontSize="10.5"
                      fontWeight="800"
                      fill="var(--text)"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {t.val} {unit}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Crisp reading badge inside surface-backed card */}
          <rect x="16" y="88" width="62" height="44" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.8" />
          <text x="47" y="106" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--text-muted)">
            РІВЕНЬ
          </text>
          <text
            x="47"
            y="123"
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill="var(--primary-dark)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value} {unit}
          </text>
        </svg>
      );
    }

    if (scaleType === 'ruler') {
      const startX = 28;
      const endX = 292;
      const spanW = endX - startX;
      const pointerX = startX + fillRatio * spanW;

      return (
        <svg viewBox="0 0 320 120" className="block mx-auto w-full max-w-[360px] h-auto" role="img" aria-label="Вимірювальна лінійка">
          <SvgHatchDefs ids={hatchIds} />
          {/* Measurement hatched strip above ruler */}
          <rect
            x={startX}
            y="22"
            width={Math.max(4, pointerX - startX)}
            height="18"
            rx="4"
            fill={`url(#${hatchIds.diagA})`}
            stroke="var(--accent)"
            strokeWidth="1.6"
          />

          {/* Ruler wooden/plastic body */}
          <rect
            x="16"
            y="48"
            width="288"
            height="54"
            rx="6"
            fill="var(--surface-alt)"
            stroke="var(--border-hover)"
            strokeWidth="2"
          />

          {ticks.map((t, idx) => {
            const x = startX + t.ratio * spanW;
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1="48"
                  x2={x}
                  y2={t.isMajor ? 72 : 62}
                  stroke="var(--text)"
                  strokeWidth={t.isMajor ? 1.8 : 1}
                />
                {t.isMajor && (
                  <text
                    x={x}
                    y="87"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="800"
                    fill="var(--text)"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t.val}
                  </text>
                )}
              </g>
            );
          })}

          {/* Pointer triangle */}
          <polygon
            points={`${pointerX},48 ${pointerX - 7},37 ${pointerX + 7},37`}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth="1.2"
          />
          <rect x="236" y="10" width="76" height="22" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <text
            x="274"
            y="25"
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="800"
            fill="var(--primary-dark)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value} {unit}
          </text>
        </svg>
      );
    }

    // Default: Thermometer
    const topY = 24;
    const bottomY = 186;
    const scaleH = bottomY - topY;
    const colTopY = bottomY - fillRatio * scaleH;

    return (
      <svg viewBox="0 0 280 238" className="block mx-auto w-full max-w-[300px] h-auto" role="img" aria-label="Шкала термометра">
        <SvgHatchDefs ids={hatchIds} />
        {/* Backing plate */}
        <rect x="92" y="12" width="114" height="216" rx="16" fill="var(--surface-alt)" stroke="var(--border-hover)" strokeWidth="1.8" />
        {/* Glass tube */}
        <rect x="114" y="20" width="18" height="174" rx="9" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
        {/* Mercury/alcohol hatched column */}
        <rect
          x="117"
          y={colTopY}
          width="12"
          height={Math.max(8, 194 - colTopY)}
          rx="5"
          fill={`url(#${hatchIds.diagA})`}
          stroke="var(--accent)"
          strokeWidth="1.4"
        />
        {/* Bulb */}
        <circle cx="123" cy="204" r="15" fill={`url(#${hatchIds.diagA})`} stroke="var(--accent)" strokeWidth="2.2" />
        <circle cx="123" cy="204" r="6" fill="var(--accent)" />

        {/* Ticks along right side of tube */}
        {ticks.map((t, idx) => {
          const y = bottomY - t.ratio * scaleH;
          return (
            <g key={idx}>
              <line
                x1="134"
                y1={y}
                x2={t.isMajor ? 150 : 143}
                y2={y}
                stroke="var(--text)"
                strokeWidth={t.isMajor ? 1.8 : 1}
              />
              {t.isMajor && (
                <text
                  x="155"
                  y={y + 3.5}
                  fontSize="10.5"
                  fontWeight="800"
                  fill="var(--text)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {t.val}{unit}
                </text>
              )}
            </g>
          );
        })}

        {/* Floating current level badge with solid surface backing */}
        <rect x="12" y={Math.max(16, Math.min(176, colTopY - 14))} width="72" height="28" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.8" />
        <text
          x="48"
          y={Math.max(16, Math.min(176, colTopY - 14)) + 18}
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill="var(--primary-dark)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value} {unit}
        </text>
        <line
          x1="84"
          y1={colTopY}
          x2="114"
          y2={colTopY}
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeDasharray="3 2"
        />
      </svg>
    );
  };

  const titleByType: Record<string, string> = {
    thermometer: '🌡️ Лабораторний термометр',
    beaker: '🧪 Вимірювальна мензурка',
    clock: '🕒 Аналоговий годинник',
    ruler: '📏 Шкала вимірювальної лінійки',
  };

  return (
    <div className="p-4 sm:p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card min-w-0 overflow-hidden">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          {titleByType[scaleType] || 'Шкала приладу'}
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction ||
            (isClock
              ? `Установіть на годиннику час ${targetH}:${pad2(targetM)}.`
              : `Виставте показання ${targetNumeric} ${unit} на шкалі приладу.`)}
        </p>
      </div>

      {/* Instrument Canvas */}
      <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)]">
        {renderSvgInstrument()}
      </div>

      {/* Precision Metadata Bar (Fixed min-height so zero jumping) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs font-bold tabular-nums min-h-[2.5rem]">
        {isClock ? (
          <>
            <span className="text-[var(--text-muted)]">
              Поділки: <strong className="text-[var(--text)]">12 год · 60 хв</strong>
            </span>
            <span className="font-mono text-sm font-extrabold text-[var(--primary-dark)]">
              {config.hideDigital ? 'Час: стрілки' : `${pad2(hour)}:${pad2(minute)}`}
            </span>
          </>
        ) : (
          <>
            <span className="text-[var(--text-muted)]">
              Ціна поділки: <strong className="text-[var(--text)]">{step} {unit}</strong>
            </span>
            <span className="font-mono text-sm font-extrabold text-[var(--primary-dark)]">
              Показання: {value} {unit}
            </span>
          </>
        )}
      </div>

      {/* Controls */}
      {!isReadOnly && (
        <div className="space-y-3">
          {!isClock ? (
            <>
              <input
                type="range"
                min={min}
                max={safeMax}
                step={step}
                value={value}
                onChange={(e) => handleSetValue(Number(e.target.value))}
                className="settings-range"
                aria-label="Повзунок значення шкали"
              />
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={value <= min}
                  onClick={() => handleSetValue(value - step * 5)}
                >
                  −{roundPrecision(step * 5)}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={value <= min}
                  onClick={() => handleSetValue(value - step)}
                >
                  −{step}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={value >= safeMax}
                  onClick={() => handleSetValue(value + step)}
                >
                  +{step}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={value >= safeMax}
                  onClick={() => handleSetValue(value + step * 5)}
                >
                  +{roundPrecision(step * 5)}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => adjustClockMinutes(-60)}>
                −1 год
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => adjustClockMinutes(60)}>
                +1 год
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => adjustClockMinutes(-5)}>
                −5 хв
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => adjustClockMinutes(5)}>
                +5 хв
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => adjustClockMinutes(-1)}>
                −1 хв
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => adjustClockMinutes(1)}>
                +1 хв
              </Button>
            </div>
          )}
        </div>
      )}

      {feedback && (
        <div className={`status-panel ${isSuccessState ? 'status-panel--success' : 'status-panel--warning'}`}>
          {feedback}
        </div>
      )}

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            ↺ Скинути
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} className="flex-1 min-w-[200px]">
            {isClock
              ? config.hideDigital
                ? 'Перевірити положення стрілок'
                : `Підтвердити час (${pad2(hour)}:${pad2(minute)})`
              : `Підтвердити (${value} ${unit})`}
          </Button>
        </div>
      )}
    </div>
  );
};
