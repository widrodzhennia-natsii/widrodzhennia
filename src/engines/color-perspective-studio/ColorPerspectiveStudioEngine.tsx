import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EngineProps } from '../adapter';
import { soundEngine } from '../../services/soundEngineService';
import { Button } from '../../components/ui/Button';
import { SvgHatchDefs, useWidgetHatchIds } from '../../components/widgets/SvgHatchDefs';

export type PigmentId = 'yellow' | 'red' | 'blue' | 'white' | 'black';

export interface ColorPerspectiveConfig {
  mode?: 'color_mix' | 'perspective' | 'shading';
  title?: string;
  instruction?: string;
  targetColor?: string;
  availablePigments?: PigmentId[];
  targetHorizon?: number;
  targetVanishing?: number;
  tolerance?: number;
  targetLightAngle?: number;
  toleranceAngle?: number;
  successMessage?: string;
}

interface PigmentMeta {
  id: PigmentId;
  name: string;
  symbol: string;
  tempLabel: string;
  swatchHsl: string;
}

const PIGMENTS: Record<PigmentId, PigmentMeta> = {
  yellow: {
    id: 'yellow',
    name: 'Жовтий',
    symbol: '☀',
    tempLabel: 'Основний · Теплий',
    swatchHsl: 'hsl(48 92% 54%)',
  },
  red: {
    id: 'red',
    name: 'Червоний',
    symbol: '▲',
    tempLabel: 'Основний · Теплий',
    swatchHsl: 'hsl(4 78% 52%)',
  },
  blue: {
    id: 'blue',
    name: 'Синій',
    symbol: '◆',
    tempLabel: 'Основний · Холодний',
    swatchHsl: 'hsl(216 78% 46%)',
  },
  white: {
    id: 'white',
    name: 'Білий',
    symbol: '○',
    tempLabel: 'Ахромат · Висвітлення',
    swatchHsl: 'hsl(0 0% 97%)',
  },
  black: {
    id: 'black',
    name: 'Чорний',
    symbol: '■',
    tempLabel: 'Ахромат · Затемнення',
    swatchHsl: 'hsl(0 0% 16%)',
  },
};

interface MixedColorResult {
  id: string;
  name: string;
  temp: string;
  swatchHsl: string;
  formula: string;
}

const resolveColorMix = (a: PigmentId, b: PigmentId): MixedColorResult => {
  const pair = [a, b].sort().join('+');
  const map: Record<string, MixedColorResult> = {
    'blue+yellow': {
      id: 'green',
      name: 'Зелений',
      temp: 'Похідний колір · Свіжий/природний',
      swatchHsl: 'hsl(142 62% 38%)',
      formula: 'Жовтий + Синій = Зелений',
    },
    'red+yellow': {
      id: 'orange',
      name: 'Помаранчевий',
      temp: 'Похідний колір · Теплий',
      swatchHsl: 'hsl(26 90% 52%)',
      formula: 'Жовтий + Червоний = Помаранчевий',
    },
    'blue+red': {
      id: 'purple',
      name: 'Фіолетовий',
      temp: 'Похідний колір · Холодний',
      swatchHsl: 'hsl(274 58% 46%)',
      formula: 'Червоний + Синій = Фіолетовий',
    },
    'blue+white': {
      id: 'sky_blue',
      name: 'Блакитний (світло-синій)',
      temp: 'Пастельний · Холодний',
      swatchHsl: 'hsl(202 82% 72%)',
      formula: 'Синій + Білий = Блакитний',
    },
    'red+white': {
      id: 'pink',
      name: 'Рожевий',
      temp: 'Ніжний відтінок · Теплий',
      swatchHsl: 'hsl(344 78% 76%)',
      formula: 'Червоний + Білий = Рожевий',
    },
    'black+white': {
      id: 'gray',
      name: 'Сірий',
      temp: 'Ахроматичний тон',
      swatchHsl: 'hsl(0 0% 56%)',
      formula: 'Білий + Чорний = Сірий',
    },
    'black+yellow': {
      id: 'olive',
      name: 'Оливковий (темно-жовтий)',
      temp: 'Затемнений відтінок',
      swatchHsl: 'hsl(52 45% 32%)',
      formula: 'Жовтий + Чорний = Оливковий',
    },
    'black+blue': {
      id: 'navy',
      name: 'Темно-синій (індиго)',
      temp: 'Глибокий холодний тон',
      swatchHsl: 'hsl(222 64% 24%)',
      formula: 'Синій + Чорний = Темно-синій',
    },
    'black+red': {
      id: 'maroon',
      name: 'Бордовий (темно-червоний)',
      temp: 'Глибокий теплий тон',
      swatchHsl: 'hsl(356 62% 28%)',
      formula: 'Червоний + Чорний = Бордовий',
    },
    'white+yellow': {
      id: 'cream_yellow',
      name: 'Світло-жовтий (лимонний)',
      temp: 'Світлий теплий відтінок',
      swatchHsl: 'hsl(52 94% 78%)',
      formula: 'Жовтий + Білий = Світло-жовтий',
    },
  };

  if (a === b) {
    const p = PIGMENTS[a];
    return {
      id: a,
      name: `Чистий ${p.name.toLowerCase()}`,
      temp: p.tempLabel,
      swatchHsl: p.swatchHsl,
      formula: `${p.name} + ${p.name} = ${p.name}`,
    };
  }

  return (
    map[pair] || {
      id: pair,
      name: `${PIGMENTS[a].name} + ${PIGMENTS[b].name}`,
      temp: 'Змішаний тон',
      swatchHsl: 'hsl(35 30% 50%)',
      formula: `${PIGMENTS[a].name} + ${PIGMENTS[b].name}`,
    }
  );
};

const TARGET_COLOR_NAMES: Record<string, string> = {
  green: 'Зелений',
  orange: 'Помаранчевий',
  purple: 'Фіолетовий',
  sky_blue: 'Блакитний',
  pink: 'Рожевий',
  gray: 'Сірий',
  olive: 'Оливковий',
  navy: 'Темно-синій',
  maroon: 'Бордовий',
  cream_yellow: 'Світло-жовтий',
};

export const ColorPerspectiveStudioEngine: React.FC<EngineProps<ColorPerspectiveConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const hatchIds = useWidgetHatchIds();
  const mode =
    config.mode === 'perspective'
      ? 'perspective'
      : config.mode === 'shading'
      ? 'shading'
      : 'color_mix';

  const configSignature = useMemo(() => JSON.stringify(config ?? {}), [config]);

  const availablePigments: PigmentId[] = useMemo(() => {
    if (Array.isArray(config.availablePigments) && config.availablePigments.length > 0) {
      return config.availablePigments.filter((p): p is PigmentId => p in PIGMENTS);
    }
    return ['yellow', 'red', 'blue', 'white', 'black'];
  }, [config.availablePigments]);

  const targetColorId = String(config.targetColor || 'green').toLowerCase();
  const targetColorLabel = TARGET_COLOR_NAMES[targetColorId] || targetColorId;

  const targetHorizon = Math.max(20, Math.min(80, Number(config.targetHorizon ?? 38)));
  const targetVanishing = Math.max(15, Math.min(85, Number(config.targetVanishing ?? 50)));
  const tolerance = Math.max(3, Number(config.tolerance ?? 8));

  const targetLightAngle = Math.max(20, Math.min(160, Number(config.targetLightAngle ?? 40)));
  const toleranceAngle = Math.max(8, Number(config.toleranceAngle ?? 18));

  const [pickedPigments, setPickedPigments] = useState<PigmentId[]>([]);
  const [horizonPct, setHorizonPct] = useState<number>(52);
  const [vanishingPct, setVanishingPct] = useState<number>(32);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [lightAngle, setLightAngle] = useState<number>(90);
  const [hatchDensity, setHatchDensity] = useState<number>(3);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<boolean>(false);

  useEffect(() => {
    setPickedPigments([]);
    setHorizonPct(52);
    setVanishingPct(32);
    setLightAngle(90);
    setHatchDensity(3);
    setStatusMsg(null);
    setIsSolved(false);
  }, [configSignature]);

  const mixedResult = useMemo(() => {
    if (pickedPigments.length === 2) {
      return resolveColorMix(pickedPigments[0], pickedPigments[1]);
    }
    if (pickedPigments.length === 1) {
      const p = PIGMENTS[pickedPigments[0]];
      return {
        id: p.id,
        name: p.name,
        temp: p.tempLabel,
        swatchHsl: p.swatchHsl,
        formula: `${p.name} + ? (оберіть другу фарбу)`,
      };
    }
    return null;
  }, [pickedPigments]);

  const handlePickPigment = (pigmentId: PigmentId) => {
    if (isReadOnly || isSolved) return;
    soundEngine.playClick();
    setStatusMsg(null);
    setPickedPigments((prev) => {
      if (prev.length >= 2) return [prev[1], pigmentId];
      return [...prev, pigmentId];
    });
  };

  const handleVerifyColorMix = () => {
    if (pickedPigments.length < 2 || !mixedResult) {
      soundEngine.playError();
      setStatusMsg('Оберіть дві фарби на палітрі, щоб утворити новий колір.');
      return;
    }

    if (mixedResult.id === targetColorId) {
      soundEngine.playSuccess();
      setIsSolved(true);
      setStatusMsg(
        config.successMessage ||
          `🎨 Чудово! ${mixedResult.formula} — саме так утворюється ${mixedResult.name.toLowerCase()} колір.`
      );
      onSubmitAnswer?.(pickedPigments);
    } else {
      soundEngine.playError();
      setStatusMsg(
        `Утворився «${mixedResult.name}», а нам потрібен «${targetColorLabel}». Спробуйте іншу пару основних або ахроматичних фарб.`
      );
    }
  };

  const updatePerspectiveFromPointer = (clientX: number, clientY: number) => {
    if (isReadOnly || isSolved || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const relX = ((clientX - rect.left) / rect.width) * 100;
    const relY = ((clientY - rect.top) / rect.height) * 100;
    setVanishingPct(Math.round(Math.max(15, Math.min(85, relX))));
    setHorizonPct(Math.round(Math.max(20, Math.min(80, relY))));
    setStatusMsg(null);
  };

  const handleVerifyPerspective = () => {
    const hDiff = Math.abs(horizonPct - targetHorizon);
    const vDiff = Math.abs(vanishingPct - targetVanishing);

    if (hDiff <= tolerance && vDiff <= tolerance) {
      soundEngine.playSuccess();
      setIsSolved(true);
      setStatusMsg(
        config.successMessage ||
          `📐 Точна лінійна перспектива! Горизонт (${horizonPct}%) і точка сходу F (${vanishingPct}%) утворюють гармонійний простір.`
      );
      onSubmitAnswer?.({ horizonPct, vanishingPct });
    } else {
      soundEngine.playError();
      const hints: string[] = [];
      if (hDiff > tolerance) {
        hints.push(
          horizonPct < targetHorizon
            ? `опустіть лінію горизонту нижче (орієнтир ~${targetHorizon}%)`
            : `підніміть лінію горизонту вище (орієнтир ~${targetHorizon}%)`
        );
      }
      if (vDiff > tolerance) {
        hints.push(
          vanishingPct < targetVanishing
            ? `змістіть точку сходу F правіше (~${targetVanishing}%)`
            : `змістіть точку сходу F лівіше (~${targetVanishing}%)`
        );
      }
      setStatusMsg(`Потрібне невелике коригування: ${hints.join(' та ')}.`);
    }
  };

  const handleVerifyShading = () => {
    const diff = Math.abs(lightAngle - targetLightAngle);
    if (diff <= toleranceAngle) {
      soundEngine.playSuccess();
      setIsSolved(true);
      setStatusMsg(
        config.successMessage ||
          `🕯️ Правильно! За кута освітлення ${lightAngle}° світло, півтінь та падаюча тінь розташовані фізично вірно.`
      );
      onSubmitAnswer?.({ lightAngle, hatchDensity });
    } else {
      soundEngine.playError();
      setStatusMsg(
        lightAngle < targetLightAngle
          ? `Джерело світла занадто ліворуч (${lightAngle}°). Перемістіть його трохи правіше (орієнтир ~${targetLightAngle}°).`
          : `Джерело світла занадто праворуч (${lightAngle}°). Перемістіть його лівіше (орієнтир ~${targetLightAngle}°).`
      );
    }
  };

  // Perspective SVG geometry coordinates (480 x 240)
  const SVG_W = 480;
  const SVG_H = 240;
  const horizonY = (horizonPct / 100) * SVG_H;
  const vpX = (vanishingPct / 100) * SVG_W;

  // Sun / Lamp position for Shading SVG (440 x 220)
  const radLight = (lightAngle * Math.PI) / 180;
  const sunX = 220 - Math.cos(radLight) * 145;
  const sunY = 148 - Math.sin(radLight) * 110;
  const shadowOffsetX = Math.cos(radLight) * 78;
  const sphereHighlightX = 220 - Math.cos(radLight) * 20;
  const sphereHighlightY = 128 - Math.sin(radLight) * 18;

  return (
    <div className="p-4 sm:p-5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-[var(--radius-md)] shadow-card space-y-4 text-[var(--text)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide flex items-center gap-1.5">
            <span aria-hidden="true">
              {mode === 'color_mix' ? '🎨' : mode === 'perspective' ? '📐' : '🕯️'}
            </span>
            <span>
              {config.title ||
                (mode === 'color_mix'
                  ? 'Майстерня кольору Іттена'
                  : mode === 'perspective'
                  ? 'Студія лінійної перспективи'
                  : 'Лабораторія світлотіні та штриху')}
            </span>
          </h4>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            {config.instruction ||
              (mode === 'color_mix'
                ? `Оберіть дві фарби на палітрі, щоб утворити колір: ${targetColorLabel}.`
                : mode === 'perspective'
                ? `Налаштуйте лінію горизонту (~${targetHorizon}%) та точку сходу F (~${targetVanishing}%).`
                : `Установіть кут падіння світла (~${targetLightAngle}°) та простежте за утворенням падаючої тіні.`)}
          </p>
        </div>

        <span className="surface-subtle px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-mono font-bold tabular-nums shrink-0">
          {mode === 'color_mix'
            ? `Ціль: ${targetColorLabel}`
            : mode === 'perspective'
            ? `H=${horizonPct}% · F=${vanishingPct}%`
            : `Кут світла: ${lightAngle}°`}
        </span>
      </div>

      {/* MODE 1: COLOR MIXING STUDIO */}
      {mode === 'color_mix' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
            {/* Mixing Bowl Preview */}
            <div className="sm:col-span-5 p-3.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="flex items-center gap-2 text-xs font-extrabold">
                <span className="px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] min-w-[74px]">
                  {pickedPigments[0] ? PIGMENTS[pickedPigments[0]].name : 'Фарба 1'}
                </span>
                <span>+</span>
                <span className="px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] min-w-[74px]">
                  {pickedPigments[1] ? PIGMENTS[pickedPigments[1]].name : 'Фарба 2'}
                </span>
              </div>

              <div
                className="w-24 h-24 rounded-full border-2 border-[var(--border-hover)] shadow-sm flex items-center justify-center transition-colors"
                style={{
                  background: mixedResult ? mixedResult.swatchHsl : 'var(--surface)',
                }}
              >
                {!mixedResult && (
                  <span className="text-xs font-bold text-[var(--text-muted)]">Палітра</span>
                )}
              </div>

              <div className="space-y-0.5">
                <div className="text-sm font-extrabold text-[var(--primary-dark)]">
                  {mixedResult ? mixedResult.name : 'Оберіть 2 фарби праворуч'}
                </div>
                <div className="text-[11px] font-medium text-[var(--text-muted)]">
                  {mixedResult ? mixedResult.formula : 'Наприклад: Жовтий + Синій'}
                </div>
              </div>
            </div>

            {/* Pigment Tubes Grid */}
            <div className="sm:col-span-7 space-y-2">
              <span className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wide block">
                Доступні фарби (оберіть 2 для змішування):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availablePigments.map((pid) => {
                  const p = PIGMENTS[pid];
                  const pickCount = pickedPigments.filter((x) => x === pid).length;
                  return (
                    <button
                      key={pid}
                      type="button"
                      disabled={isReadOnly || isSolved}
                      onClick={() => handlePickPigment(pid)}
                      className={`p-2.5 rounded-[var(--radius-sm)] border-2 text-left flex items-center gap-2.5 cursor-pointer transition-colors ${
                        pickCount > 0
                          ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                          : 'bg-[var(--bg)] hover:bg-[var(--surface-hover)] border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)]'
                      }`}
                    >
                      <span
                        className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-hover)] shrink-0 flex items-center justify-center text-xs font-black"
                        style={{ backgroundColor: p.swatchHsl }}
                        aria-hidden="true"
                      >
                        <span className="px-1 rounded bg-[var(--surface)] text-[var(--text)] opacity-90 text-[10px]">
                          {p.symbol}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate">{p.name}</div>
                        <div className="text-[10px] font-medium opacity-80 truncate">
                          {p.tempLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pickedPigments.length === 0 || isReadOnly || isSolved}
              onClick={() => {
                setPickedPigments([]);
                setStatusMsg(null);
              }}
            >
              ↺ Очистити палітру
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={isReadOnly || isSolved}
              onClick={handleVerifyColorMix}
            >
              ✓ Перевірити колір
            </Button>
          </div>
        </div>
      )}

      {/* MODE 2: LINEAR PERSPECTIVE STUDIO */}
      {mode === 'perspective' && (
        <div className="space-y-3">
          <div className="rounded-[var(--radius-sm)] border-2 border-[var(--border)] bg-[var(--bg)] overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-auto block cursor-crosshair select-none touch-none"
              role="img"
              aria-label="Сцена лінійної перспективи"
              onPointerDown={(e) => {
                draggingRef.current = true;
                updatePerspectiveFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (draggingRef.current) {
                  updatePerspectiveFromPointer(e.clientX, e.clientY);
                }
              }}
              onPointerUp={() => {
                draggingRef.current = false;
              }}
              onPointerLeave={() => {
                draggingRef.current = false;
              }}
            >
              <SvgHatchDefs ids={hatchIds} />

              {/* Sky above horizon */}
              <rect x="0" y="0" width={SVG_W} height={horizonY} fill="var(--surface)" />

              {/* Ground plane below horizon */}
              <rect
                x="0"
                y={horizonY}
                width={SVG_W}
                height={SVG_H - horizonY}
                fill={`url(#${hatchIds.diagA})`}
                opacity="0.35"
              />

              {/* Road / Perspective Plane converging to vanishing point */}
              <polygon
                points={`${vpX},${horizonY} ${Math.max(40, vpX - 150)},${SVG_H} ${Math.min(SVG_W - 40, vpX + 150)},${SVG_H}`}
                fill="var(--surface-alt)"
                stroke="var(--border-hover)"
                strokeWidth="2"
              />

              {/* Center dashed road axis toward F */}
              <line
                x1={vpX}
                y1={horizonY}
                x2={vpX}
                y2={SVG_H}
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeDasharray="6 5"
              />

              {/* Perspective rhythm poles/trees along left & right converging lines */}
              {[0.28, 0.52, 0.78].map((t, idx) => {
                const leftBaseX = vpX + (Math.max(40, vpX - 150) - vpX) * t;
                const rightBaseX = vpX + (Math.min(SVG_W - 40, vpX + 150) - vpX) * t;
                const baseY = horizonY + (SVG_H - horizonY) * t;
                const poleH = 62 * t;
                return (
                  <g key={idx}>
                    <line
                      x1={leftBaseX}
                      y1={baseY}
                      x2={leftBaseX}
                      y2={baseY - poleH}
                      stroke="var(--primary-dark)"
                      strokeWidth={1.5 + t * 1.5}
                    />
                    <circle
                      cx={leftBaseX}
                      cy={baseY - poleH}
                      r={4 + t * 7}
                      fill={`url(#${hatchIds.diagB})`}
                      stroke="var(--primary-dark)"
                      strokeWidth="1.5"
                    />
                    <line
                      x1={rightBaseX}
                      y1={baseY}
                      x2={rightBaseX}
                      y2={baseY - poleH}
                      stroke="var(--primary-dark)"
                      strokeWidth={1.5 + t * 1.5}
                    />
                    <circle
                      cx={rightBaseX}
                      cy={baseY - poleH}
                      r={4 + t * 7}
                      fill={`url(#${hatchIds.diagB})`}
                      stroke="var(--primary-dark)"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

              {/* Construction perspective rays */}
              {showGuidelines && (
                <g stroke="var(--hl-border)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.85">
                  <line x1="0" y1="15" x2={vpX} y2={horizonY} />
                  <line x1={SVG_W} y1="15" x2={vpX} y2={horizonY} />
                  <line x1="0" y1={SVG_H - 12} x2={vpX} y2={horizonY} />
                  <line x1={SVG_W} y1={SVG_H - 12} x2={vpX} y2={horizonY} />
                </g>
              )}

              {/* Horizon Line */}
              <line
                x1="0"
                y1={horizonY}
                x2={SVG_W}
                y2={horizonY}
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="7 4"
              />
              <rect
                x="8"
                y={Math.max(6, horizonY - 22)}
                width="106"
                height="18"
                rx="4"
                fill="var(--surface)"
                stroke="var(--border)"
              />
              <text
                x="14"
                y={Math.max(18, horizonY - 9)}
                fontSize="10"
                fontWeight="800"
                fill="var(--primary-dark)"
              >
                Лінія горизонту
              </text>

              {/* Vanishing Point F */}
              <circle
                cx={vpX}
                cy={horizonY}
                r="8"
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth="2.5"
              />
              <text
                x={vpX}
                y={horizonY - 13}
                textAnchor="middle"
                fontSize="11"
                fontWeight="900"
                fill="var(--primary-dark)"
                className="svg-hatch-label"
              >
                Точка сходу F
              </text>
            </svg>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)]">
            <label className="block space-y-1 text-xs font-bold">
              <div className="flex justify-between tabular-nums">
                <span>Висота лінії горизонту:</span>
                <span className="font-mono text-[var(--primary-dark)]">{horizonPct}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={80}
                disabled={isReadOnly || isSolved}
                value={horizonPct}
                onChange={(e) => {
                  setHorizonPct(Number(e.target.value));
                  setStatusMsg(null);
                }}
                className="settings-range"
              />
            </label>

            <label className="block space-y-1 text-xs font-bold">
              <div className="flex justify-between tabular-nums">
                <span>Положення точки сходу F:</span>
                <span className="font-mono text-[var(--primary-dark)]">{vanishingPct}%</span>
              </div>
              <input
                type="range"
                min={15}
                max={85}
                disabled={isReadOnly || isSolved}
                value={vanishingPct}
                onChange={(e) => {
                  setVanishingPct(Number(e.target.value));
                  setStatusMsg(null);
                }}
                className="settings-range"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGuidelines((prev) => !prev)}
            >
              {showGuidelines ? '📐 Сховати промені' : '📐 Показати промені'}
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={isReadOnly || isSolved}
              onClick={handleVerifyPerspective}
            >
              ✓ Перевірити перспективу
            </Button>
          </div>
        </div>
      )}

      {/* MODE 3: CHIAROSCURO / SHADING STUDIO */}
      {mode === 'shading' && (
        <div className="space-y-3">
          <div className="rounded-[var(--radius-sm)] border-2 border-[var(--border)] bg-[var(--bg)] overflow-hidden">
            <svg
              viewBox="0 0 440 220"
              className="w-full h-auto block"
              role="img"
              aria-label="Схема світлотіні на кулі"
            >
              <SvgHatchDefs ids={hatchIds} />

              <rect x="0" y="0" width="440" height="175" fill="var(--surface)" />
              <rect x="0" y="175" width="440" height="45" fill="var(--surface-alt)" />
              <line x1="0" y1="175" x2="440" y2="175" stroke="var(--border-hover)" strokeWidth="2" />

              {/* Arc guide for light */}
              <path
                d="M 75 148 A 145 110 0 0 1 365 148"
                fill="none"
                stroke="var(--border)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Light ray */}
              <line
                x1={sunX}
                y1={sunY}
                x2="220"
                y2="130"
                stroke="var(--hl-border)"
                strokeWidth="1.8"
                strokeDasharray="5 4"
              />

              {/* Sun / Lamp source */}
              <circle
                cx={sunX}
                cy={sunY}
                r="13"
                fill="var(--hl-bg)"
                stroke="var(--hl-border)"
                strokeWidth="2"
              />
              <text
                x={sunX}
                y={sunY + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="900"
                fill="var(--hl-text)"
              >
                ☀
              </text>

              {/* Cast shadow on table opposite to light */}
              <ellipse
                cx={220 + shadowOffsetX}
                cy="183"
                rx={42 + hatchDensity * 4}
                ry="11"
                fill={`url(#${hatchIds.cross})`}
                stroke="var(--border-hover)"
                strokeWidth="1.2"
              />
              <text
                x={220 + shadowOffsetX}
                y="204"
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill="var(--text-muted)"
              >
                Падаюча тінь
              </text>

              {/* Sphere base with hatched shadow side */}
              <circle
                cx="220"
                cy="132"
                r="46"
                fill="var(--surface-alt)"
                stroke="var(--primary-dark)"
                strokeWidth="2.2"
              />
              {/* Shadow crescent hatched area */}
              <circle
                cx={220 + Math.cos(radLight) * 10}
                cy={132 + Math.sin(radLight) * 6}
                r="34"
                fill={`url(#${hatchIds.diagA})`}
                opacity={0.28 + hatchDensity * 0.12}
              />
              {/* Lit highlight zone */}
              <circle
                cx={sphereHighlightX}
                cy={sphereHighlightY}
                r="16"
                fill="var(--surface)"
                stroke="var(--border)"
                strokeWidth="1"
              />
              <circle cx={sphereHighlightX - 3} cy={sphereHighlightY - 3} r="5" fill="var(--hl-bg)" stroke="var(--hl-border)" strokeWidth="1.2" />

              <text x={sphereHighlightX} y={sphereHighlightY + 3} textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--primary-dark)">
                Світло
              </text>
            </svg>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)]">
            <label className="block space-y-1 text-xs font-bold">
              <div className="flex justify-between tabular-nums">
                <span>Кут джерела світла:</span>
                <span className="font-mono text-[var(--primary-dark)]">{lightAngle}°</span>
              </div>
              <input
                type="range"
                min={20}
                max={160}
                disabled={isReadOnly || isSolved}
                value={lightAngle}
                onChange={(e) => {
                  setLightAngle(Number(e.target.value));
                  setStatusMsg(null);
                }}
                className="settings-range"
              />
            </label>

            <label className="block space-y-1 text-xs font-bold">
              <div className="flex justify-between tabular-nums">
                <span>Насиченість штрихування:</span>
                <span className="font-mono text-[var(--primary-dark)]">{hatchDensity}/5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                disabled={isReadOnly || isSolved}
                value={hatchDensity}
                onChange={(e) => setHatchDensity(Number(e.target.value))}
                className="settings-range"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="accent"
              disabled={isReadOnly || isSolved}
              onClick={handleVerifyShading}
            >
              ✓ Перевірити світлотінь
            </Button>
          </div>
        </div>
      )}

      {statusMsg && (
        <div
          className={`status-panel ${
            isSolved ? 'status-panel--success' : 'status-panel--warning'
          }`}
        >
          {statusMsg}
        </div>
      )}
    </div>
  );
};
