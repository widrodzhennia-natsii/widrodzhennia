import React, { useState } from 'react';
import { WidgetDefinition, numArg, strArg } from './widget.types';

interface HotspotPoint {
  x: number;
  y: number;
  title: string;
  desc: string;
}

const HotspotDiagramCard: React.FC<{
  title: string;
  themeKind: string;
  points: HotspotPoint[];
}> = ({ title, themeKind, points }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = points[activeIndex] || points[0];

  return (
    <div className="w-full max-w-[420px] space-y-2">
      <div className="text-xs font-extrabold text-[var(--primary-dark)] text-center">{title}</div>
      <svg
        viewBox="0 0 260 150"
        className="w-full h-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)]"
        role="img"
        aria-label={title}
      >
        {/* Base schema illustration according to themeKind */}
        {themeKind === 'circuit' ? (
          <g>
            <rect x="42" y="28" width="176" height="94" rx="10" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" />
            <rect x="26" y="55" width="32" height="40" rx="4" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
            <rect x="108" y="18" width="44" height="20" rx="3" fill="var(--hl-bg)" stroke="var(--hl-border)" strokeWidth="2" />
            <circle cx="218" cy="75" r="16" fill="var(--ok-bg)" stroke="var(--ok-border)" strokeWidth="2" />
          </g>
        ) : (
          <g>
            <ellipse cx="130" cy="75" rx="102" ry="56" fill="var(--surface)" stroke="var(--text-muted)" strokeWidth="2.5" />
            <circle cx="105" cy="72" r="24" fill="var(--hl-bg)" stroke="var(--hl-border)" strokeWidth="2" />
            <ellipse cx="176" cy="84" rx="22" ry="12" fill="var(--surface-alt)" stroke="var(--border)" strokeWidth="2" />
          </g>
        )}

        {/* Interactive Hotspot Pins */}
        {points.map((pt, idx) => {
          const isSelected = idx === activeIndex;
          return (
            <g
              key={`${pt.title}_${idx}`}
              onClick={() => setActiveIndex(idx)}
              className="cursor-pointer"
            >
              {isSelected && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="15"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="10"
                fill={isSelected ? 'var(--accent)' : 'var(--surface)'}
                stroke={isSelected ? 'var(--accent)' : 'var(--text)'}
                strokeWidth="2"
              />
              <text
                x={pt.x}
                y={pt.y + 3.5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="900"
                fill={isSelected ? 'var(--accent-text)' : 'var(--text)'}
              >
                {idx + 1}
              </text>
            </g>
          );
        })}
      </svg>

      {current && (
        <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--hl-border)] bg-[var(--hl-bg)] text-[var(--hl-text)] text-xs space-y-0.5">
          <div className="font-extrabold">
            {activeIndex + 1}. {current.title}
          </div>
          <div className="leading-snug font-medium">{current.desc}</div>
        </div>
      )}
    </div>
  );
};

export const STAGE4_WIDGETS: Record<string, WidgetDefinition> = {
  hotspot_diagram: {
    type: 'hotspot_diagram',
    label: 'Інтерактивна схема з активними мітками',
    category: 'subject',
    render: (args) => {
      const title = strArg(args, ['title', 'label'], 'Інтерактивна схема', 0);
      const themeKind = strArg(args, ['kind', 'theme'], 'cell');
      const rawPoints = strArg(
        args,
        ['points'],
        '105,72,Центральний вузол:Головний керівний або ядерний компонент системи.|176,84,Виконавчий блок:Перетворює енергію та підтримує роботу.|62,56,Зовнішня межа:Захисна оболонка і вибірковий бар’єр.'
      );

      const points: HotspotPoint[] = rawPoints
        .split('|')
        .map((chunk) => {
          const firstComma = chunk.indexOf(',');
          const secondComma = chunk.indexOf(',', firstComma + 1);
          if (firstComma === -1 || secondComma === -1) return null;
          const x = Math.max(16, Math.min(244, Number(chunk.slice(0, firstComma).trim()) || 130));
          const y = Math.max(16, Math.min(134, Number(chunk.slice(firstComma + 1, secondComma).trim()) || 75));
          const rest = chunk.slice(secondComma + 1).trim();
          const colonIdx = rest.indexOf(':');
          const pTitle = colonIdx >= 0 ? rest.slice(0, colonIdx).trim() : rest;
          const pDesc = colonIdx >= 0 ? rest.slice(colonIdx + 1).trim() : 'Натисніть на інші мітки схеми.';
          return { x, y, title: pTitle, desc: pDesc };
        })
        .filter((item): item is HotspotPoint => item !== null);

      return <HotspotDiagramCard title={title} themeKind={themeKind} points={points} />;
    },
  },

  pythagoras_squares: {
    type: 'pythagoras_squares',
    label: 'Візуальна теорема Піфагора (a² + b² = c²)',
    category: 'stem',
    getSliders: (args) => [
      {
        key: 'a',
        label: 'Катет a',
        unit: 'од.',
        min: 2,
        max: 10,
        step: 1,
        defaultValue: numArg(args, {}, ['a'], 3, 0),
      },
      {
        key: 'b',
        label: 'Катет b',
        unit: 'од.',
        min: 2,
        max: 10,
        step: 1,
        defaultValue: numArg(args, {}, ['b'], 4, 1),
      },
    ],
    getLiveSummary: (args, overrides) => {
      const a = numArg(args, overrides, ['a'], 3, 0);
      const b = numArg(args, overrides, ['b'], 4, 1);
      const c2 = a * a + b * b;
      const c = Math.sqrt(c2);
      return `a² (${a * a}) + b² (${b * b}) = c² (${c2}) → гіпотенуза c ≈ ${Number.isInteger(c) ? c : c.toFixed(2)}`;
    },
    render: (args, overrides) => {
      const a = numArg(args, overrides, ['a'], 3, 0);
      const b = numArg(args, overrides, ['b'], 4, 1);
      const c2 = a * a + b * b;
      const c = Math.sqrt(c2);

      // Normalized SVG scale so it always stays in frame
      const maxDim = Math.max(a, b, 6);
      const unitPx = 64 / maxDim;
      const w = b * unitPx;
      const h = a * unitPx;
      const ox = 115;
      const oy = 115;

      // Triangle vertices: right angle at (ox, oy), up to (ox, oy - h), right to (ox + w, oy)
      const x1 = ox;
      const y1 = oy - h;
      const x2 = ox + w;
      const y2 = oy;

      return (
        <div className="flex flex-col items-center space-y-1.5 w-full">
          <svg viewBox="0 0 280 205" className="w-full max-w-[320px] h-auto" role="img" aria-label="Візуальний Піфагор">
            {/* Square on a (left of vertical cathetus) */}
            <rect
              x={ox - h}
              y={oy - h}
              width={h}
              height={h}
              fill="var(--hl-bg)"
              stroke="var(--hl-border)"
              strokeWidth="1.5"
            />
            <text x={ox - h / 2} y={oy - h / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--hl-text)">
              {a * a}
            </text>

            {/* Square on b (below horizontal cathetus) */}
            <rect
              x={ox}
              y={oy}
              width={w}
              height={w}
              fill="var(--ok-bg)"
              stroke="var(--ok-border)"
              strokeWidth="1.5"
            />
            <text x={ox + w / 2} y={oy + w / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--ok-text)">
              {b * b}
            </text>

            {/* Right triangle */}
            <polygon
              points={`${ox},${oy} ${x1},${y1} ${x2},${y2}`}
              fill="var(--accent)"
              fillOpacity="0.22"
              stroke="var(--text)"
              strokeWidth="2.5"
            />
            <rect x={ox} y={oy - 8} width="8" height="8" fill="none" stroke="var(--text)" strokeWidth="1.5" />

            {/* Square badge on hypotenuse c² */}
            <rect
              x={(x1 + x2) / 2 + 8}
              y={(y1 + y2) / 2 - 22}
              width="58"
              height="24"
              rx="4"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <text
              x={(x1 + x2) / 2 + 37}
              y={(y1 + y2) / 2 - 6}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="900"
              fill="var(--primary-dark)"
            >
              c² = {c2}
            </text>

            <text x="140" y="196" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--text-muted)">
              a = {a}, b = {b}, c ≈ {Number.isInteger(c) ? c : c.toFixed(2)}
            </text>
          </svg>
        </div>
      );
    },
  },

  circle_theorem: {
    type: 'circle_theorem',
    label: 'Властивості кола: центральний і вписаний кути',
    category: 'stem',
    getSliders: (args) => [
      {
        key: 'deg',
        label: 'Центральний кут 2α',
        unit: '°',
        min: 30,
        max: 160,
        step: 10,
        defaultValue: numArg(args, {}, ['deg'], 80, 0),
      },
      {
        key: 'r',
        label: 'Радіус r',
        unit: 'см',
        min: 2,
        max: 12,
        step: 1,
        defaultValue: numArg(args, {}, ['r'], 5, 1),
      },
    ],
    getLiveSummary: (args, overrides) => {
      const central = numArg(args, overrides, ['deg'], 80, 0);
      const r = numArg(args, overrides, ['r'], 5, 1);
      const inscribed = central / 2;
      const circ = (2 * Math.PI * r).toFixed(1);
      return `Центральний кут = ${central}° → вписаний α = ${inscribed}° (у 2× менший) · Довжина кола ≈ ${circ} см`;
    },
    render: (args, overrides) => {
      const centralDeg = numArg(args, overrides, ['deg'], 80, 0);
      const inscribedDeg = centralDeg / 2;
      const cx = 130;
      const cy = 92;
      const radius = 64;

      // Chord endpoints A, B symmetric around bottom
      const halfRad = ((centralDeg / 2) * Math.PI) / 180;
      const ax = cx - Math.sin(halfRad) * radius;
      const ay = cy + Math.cos(halfRad) * radius;
      const bx = cx + Math.sin(halfRad) * radius;
      const by = cy + Math.cos(halfRad) * radius;
      // Inscribed vertex P near top
      const px = cx + 18;
      const py = cy - Math.sqrt(Math.max(0, radius * radius - 18 * 18));

      return (
        <svg viewBox="0 0 260 185" className="w-full max-w-[300px] h-auto" role="img" aria-label="Схема центрального та вписаного кута в колі">
          <circle cx={cx} cy={cy} r={radius} fill="var(--surface-alt)" stroke="var(--text)" strokeWidth="2" />
          {/* Chord */}
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4 3" />
          {/* Central angle rays */}
          <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="var(--accent)" strokeWidth="2.5" />
          <line x1={cx} y1={cy} x2={bx} y2={by} stroke="var(--accent)" strokeWidth="2.5" />
          {/* Inscribed angle rays */}
          <line x1={px} y1={py} x2={ax} y2={ay} stroke="var(--primary-dark)" strokeWidth="2" />
          <line x1={px} y1={py} x2={bx} y2={by} stroke="var(--primary-dark)" strokeWidth="2" />

          <circle cx={cx} cy={cy} r="3.5" fill="var(--accent)" />
          <circle cx={px} cy={py} r="3.5" fill="var(--primary-dark)" />
          <text x={cx} y={cy + 22} textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--accent)">
            2α = {centralDeg}°
          </text>
          <text x={px} y={py - 8} textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--primary-dark)">
            α = {inscribedDeg}°
          </text>
        </svg>
      );
    },
  },

  express_graph: {
    type: 'express_graph',
    label: 'Експрес-графік функції y = ax² + kx + b',
    category: 'stem',
    getSliders: (args) => [
      {
        key: 'a',
        label: 'Коеф. a (x²)',
        min: -1,
        max: 1,
        step: 0.25,
        defaultValue: numArg(args, {}, ['a'], 0),
      },
      {
        key: 'k',
        label: 'Нахил k (x)',
        min: -3,
        max: 3,
        step: 0.5,
        defaultValue: numArg(args, {}, ['k'], 1, 0),
      },
      {
        key: 'b',
        label: 'Зсув b',
        min: -4,
        max: 4,
        step: 0.5,
        defaultValue: numArg(args, {}, ['b'], 0, 1),
      },
    ],
    getLiveSummary: (args, overrides) => {
      const a = numArg(args, overrides, ['a'], 0);
      const k = numArg(args, overrides, ['k'], 1, 0);
      const b = numArg(args, overrides, ['b'], 0, 1);
      return `Функція: y = ${a !== 0 ? `${a}x² + ` : ''}${k}x ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`} · Перетин з OY у точці (0; ${b})`;
    },
    render: (args, overrides) => {
      const a = numArg(args, overrides, ['a'], 0);
      const k = numArg(args, overrides, ['k'], 1, 0);
      const b = numArg(args, overrides, ['b'], 0, 1);

      const cx = 130;
      const cy = 90;
      const scale = 16; // 1 unit = 16px

      const pts: string[] = [];
      for (let x = -7; x <= 7; x += 0.25) {
        const y = a * x * x + k * x + b;
        const sx = cx + x * scale;
        const sy = cy - y * scale;
        if (sy >= 6 && sy <= 174) {
          pts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
        }
      }

      return (
        <svg viewBox="0 0 260 180" className="w-full max-w-[320px] h-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)]" role="img" aria-label="Графік функції">
          {/* Grid lines */}
          {[-4, -2, 2, 4].map((u) => (
            <React.Fragment key={u}>
              <line x1={cx + u * scale} y1="6" x2={cx + u * scale} y2="174" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" />
              <line x1="10" y1={cy - u * scale} x2="250" y2={cy - u * scale} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" />
            </React.Fragment>
          ))}
          {/* Axes */}
          <line x1="8" y1={cy} x2="252" y2={cy} stroke="var(--text-muted)" strokeWidth="1.5" />
          <line x1={cx} y1="6" x2={cx} y2="174" stroke="var(--text-muted)" strokeWidth="1.5" />

          {pts.length >= 2 && (
            <polyline fill="none" stroke="var(--accent)" strokeWidth="3" points={pts.join(' ')} />
          )}
          <circle cx={cx} cy={Math.max(10, Math.min(170, cy - b * scale))} r="4" fill="var(--primary-dark)" />
          <text x="16" y="20" fontSize="10" fontWeight="900" fill="var(--primary-dark)">
            y = {a !== 0 ? `${a}x² ` : ''}{k}x {b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`}
          </text>
        </svg>
      );
    },
  },
};
