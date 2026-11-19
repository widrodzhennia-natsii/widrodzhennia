import React, { useState } from 'react';
import {
  PersonalityTraits,
  STRENGTH_REGISTRY,
  StrengthCategory,
  normalizeTraits,
} from '../../core/contracts/profile.contract';

interface PersonalityRadarProps {
  traits?: PersonalityTraits;
  gradeNumber?: number;
  profileSeed?: string;
}

const CATEGORY_LABELS: Record<StrengthCategory | 'all', string> = {
  all: 'Усі сильні сторони',
  cognitive: 'Мислення',
  stem: 'STEM та аналіз',
  humanities: 'Мовлення',
  social: 'Взаємодія та спокій',
};

export const PersonalityRadarChart: React.FC<PersonalityRadarProps> = ({
  traits,
  gradeNumber,
  profileSeed,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<StrengthCategory | 'all'>('all');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const actualTraits = normalizeTraits(traits);

  const visibleStrengths = STRENGTH_REGISTRY.filter(
    (s) => selectedCategory === 'all' || s.category === selectedCategory
  );

  // Use all registered strengths for the radar polygon if < 3 filtered
  const axisItems = visibleStrengths.length >= 3 ? visibleStrengths : STRENGTH_REGISTRY;
  const count = axisItems.length;

  const maxVal = Math.max(
    100,
    ...axisItems.map((item) => actualTraits[item.key] ?? item.defaultValue)
  );

  const viewWidth = 420;
  const viewHeight = 310;
  const centerX = viewWidth / 2;
  const centerY = viewHeight / 2;
  const radius = 92;

  const angles = axisItems.map((_, idx) => -Math.PI / 2 + (idx * 2 * Math.PI) / count);

  const polygonPoints = axisItems
    .map((item, idx) => {
      const val = Math.max(item.defaultValue, actualTraits[item.key] ?? item.defaultValue);
      const ratio = val / maxVal;
      const r = radius * ratio;
      const angle = angles[idx];
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const hoveredMeta = axisItems.find((a) => a.key === hoveredKey) || null;

  return (
    <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--primary-dark)]">
        <span>📊 Сильні сторони дослідника ({STRENGTH_REGISTRY.length} компетенцій)</span>
        <span className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
          {gradeNumber ? `${gradeNumber} клас` : 'Профіль'}
          {profileSeed ? ` · ${profileSeed}` : ''}
        </span>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)]">
        {(Object.keys(CATEGORY_LABELS) as Array<StrengthCategory | 'all'>).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="flex justify-center items-center py-1">
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="w-full max-w-[420px] h-auto overflow-visible"
          role="img"
          aria-label="Діаграма сильних сторін учня"
        >
          <defs>
            <pattern
              id="radarHatchPattern"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="7" height="7" fill="var(--ok-bg)" fillOpacity="0.45" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ok-border)" strokeWidth="1.35" strokeOpacity="0.45" />
            </pattern>
          </defs>

          {gridLevels.map((lvl, idx) => {
            const gridPts = angles
              .map((a) => {
                const r = radius * lvl;
                return `${(centerX + r * Math.cos(a)).toFixed(1)},${(centerY + r * Math.sin(a)).toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={idx}
                points={gridPts}
                fill="none"
                stroke="var(--border)"
                strokeDasharray="2,2"
                strokeWidth="1"
              />
            );
          })}

          {angles.map((a, idx) => {
            const x2 = centerX + radius * Math.cos(a);
            const y2 = centerY + radius * Math.sin(a);
            return (
              <line
                key={idx}
                x1={centerX}
                y1={centerY}
                x2={x2}
                y2={y2}
                stroke="var(--text-muted)"
                strokeOpacity="0.55"
                strokeWidth="1.2"
              />
            );
          })}

          <polygon
            points={polygonPoints}
            fill="url(#radarHatchPattern)"
            stroke="var(--ok-border)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {axisItems.map((item, idx) => {
            const a = angles[idx];
            const val = actualTraits[item.key] ?? item.defaultValue;
            const ratio = Math.max(item.defaultValue, val) / maxVal;
            const px = centerX + radius * ratio * Math.cos(a);
            const py = centerY + radius * ratio * Math.sin(a);

            const cosA = Math.cos(a);
            const sinA = Math.sin(a);
            const labelR = radius + (Math.abs(sinA) > 0.85 ? 20 : 16);
            const lx = centerX + labelR * cosA;
            const ly = centerY + labelR * sinA;
            const anchor: 'start' | 'middle' | 'end' =
              cosA > 0.28 ? 'start' : cosA < -0.28 ? 'end' : 'middle';

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={px}
                  cy={py}
                  r={hoveredKey === item.key ? 5 : 3.5}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth="1.5"
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="central"
                  className="text-[10.5px] font-bold fill-[var(--text)] font-sans tabular-nums svg-hatch-label"
                >
                  {item.icon} {item.shortLabel} ({val})
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredMeta && (
        <div className="p-2.5 bg-[var(--hl-bg)] border border-[var(--hl-border)] rounded-[var(--radius-sm)] text-xs text-[var(--hl-text)]">
          <strong className="mr-1">
            {hoveredMeta.icon} {hoveredMeta.label}:
          </strong>
          <span>{hoveredMeta.description}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs pt-2 border-t border-[var(--border)]">
        {visibleStrengths.map((item) => (
          <div
            key={item.key}
            title={item.description}
            className="p-2 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--border)] text-[11px] font-bold flex justify-between items-center gap-2"
          >
            <span className="truncate text-[var(--text)]">
              {item.icon} {item.label}
            </span>
            <span className="font-mono tabular-nums text-[var(--primary-dark)] text-xs shrink-0">
              {actualTraits[item.key] ?? item.defaultValue} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
