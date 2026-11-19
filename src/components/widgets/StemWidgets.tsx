import React from 'react';
import { SvgHatchDefs, useWidgetHatchIds } from './SvgHatchDefs';
import { WidgetDefinition, numArg, strArg } from './widget.types';
import { evaluateSafeExpression } from '../../core/vars/var-engine';

const CompareSvg: React.FC<{ a: number; b: number; labelA: string; labelB: string }> = ({
  a,
  b,
  labelA,
  labelB,
}) => {
  const ids = useWidgetHatchIds();
  const maxVal = Math.max(1, a, b);
  const wA = Math.max(12, Math.round((a / maxVal) * 210));
  const wB = Math.max(12, Math.round((b / maxVal) * 210));

  return (
    <svg viewBox="0 0 320 96" className="w-full max-w-[340px] h-auto" role="img" aria-label={`Порівняння ${a} і ${b}`}>
      <SvgHatchDefs ids={ids} />
      <text x="8" y="25" fontSize="11" fontWeight="700" fill="var(--text)">
        {labelA}
      </text>
      <rect x="8" y="31" width={wA} height="18" rx="4" fill={`url(#${ids.diagA})`} stroke="var(--accent)" strokeWidth="1.5" />
      <text x={wA + 16} y="44" fontSize="12" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {a}
      </text>

      <text x="8" y="65" fontSize="11" fontWeight="700" fill="var(--text)">
        {labelB}
      </text>
      <rect x="8" y="71" width={wB} height="18" rx="4" fill={`url(#${ids.dots})`} stroke="var(--border-hover)" strokeWidth="1.5" />
      <text x={wB + 16} y="84" fontSize="12" fontWeight="800" fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {b}
      </text>
    </svg>
  );
};

const SplitSvg: React.FC<{ total: number; left: number }> = ({ total, left }) => {
  const ids = useWidgetHatchIds();
  const safeLeft = Math.max(0, Math.min(total, left));
  const right = Math.max(0, total - safeLeft);

  return (
    <svg viewBox="0 0 280 120" className="block mx-auto w-full max-w-[300px] h-auto" role="img" aria-label={`Декомпозиція числа ${total}`}>
      <SvgHatchDefs ids={ids} />
      <line x1="140" y1="42" x2="72" y2="74" stroke="var(--border-hover)" strokeWidth="2" />
      <line x1="140" y1="42" x2="208" y2="74" stroke="var(--border-hover)" strokeWidth="2" />

      <rect x="102" y="10" width="76" height="34" rx="10" fill="var(--hl-bg)" stroke="var(--accent)" strokeWidth="2" />
      <text x="140" y="32" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--hl-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {total}
      </text>

      <rect x="34" y="74" width="76" height="34" rx="10" fill={`url(#${ids.diagA})`} stroke="var(--accent)" strokeWidth="1.8" />
      <rect x="50" y="80" width="44" height="22" rx="5" fill="var(--surface)" fillOpacity="0.92" />
      <text x="72" y="96" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--text)" className="svg-hatch-label" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {safeLeft}
      </text>

      <rect x="170" y="74" width="76" height="34" rx="10" fill={`url(#${ids.diagB})`} stroke="var(--ok-border)" strokeWidth="1.8" />
      <rect x="186" y="80" width="44" height="22" rx="5" fill="var(--surface)" fillOpacity="0.92" />
      <text x="208" y="96" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--ok-text)" className="svg-hatch-label" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {right}
      </text>
    </svg>
  );
};

const RectGeoSvg: React.FC<{ w: number; h: number; unit: string }> = ({ w, h, unit }) => {
  const ids = useWidgetHatchIds();
  const safeW = Math.max(1, Math.min(16, Math.round(w)));
  const safeH = Math.max(1, Math.min(12, Math.round(h)));
  const maxBoxW = 180;
  const maxBoxH = 104;
  const cell = Math.min(maxBoxW / safeW, maxBoxH / safeH);
  const drawW = safeW * cell;
  const drawH = safeH * cell;
  const x0 = 42;
  const y0 = 26;
  const area = safeW * safeH;
  const perim = 2 * (safeW + safeH);

  return (
    <svg viewBox="0 0 320 154" className="w-full max-w-[340px] h-auto" role="img" aria-label={`Прямокутник ${safeW} на ${safeH}`}>
      <SvgHatchDefs ids={ids} />
      <rect x={x0} y={y0} width={drawW} height={drawH} fill={`url(#${ids.diagA})`} stroke="var(--accent)" strokeWidth="2.2" />

      {safeW <= 12 &&
        Array.from({ length: safeW - 1 }).map((_, idx) => (
          <line
            key={`gx_${idx}`}
            x1={x0 + (idx + 1) * cell}
            y1={y0}
            x2={x0 + (idx + 1) * cell}
            y2={y0 + drawH}
            stroke="var(--border-hover)"
            strokeWidth="0.9"
            strokeDasharray="2 2"
          />
        ))}
      {safeH <= 10 &&
        Array.from({ length: safeH - 1 }).map((_, idx) => (
          <line
            key={`gy_${idx}`}
            x1={x0}
            y1={y0 + (idx + 1) * cell}
            x2={x0 + drawW}
            y2={y0 + (idx + 1) * cell}
            stroke="var(--border-hover)"
            strokeWidth="0.9"
            strokeDasharray="2 2"
          />
        ))}

      <text x={x0 + drawW / 2} y={y0 - 7} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        a = {safeW} {unit}
      </text>
      <text x={x0 - 8} y={y0 + drawH / 2 + 4} textAnchor="end" fontSize="11" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        b = {safeH}
      </text>

      <rect x="230" y="30" width="82" height="58" rx="8" fill="var(--surface-alt)" stroke="var(--border)" strokeWidth="1.2" />
      <text x="238" y="52" fontSize="11" fontWeight="800" fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        S = {area} {unit}²
      </text>
      <text x="238" y="73" fontSize="11" fontWeight="700" fill="var(--text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        P = {perim} {unit}
      </text>
    </svg>
  );
};

const TapeSvg: React.FC<{ parts: number[]; labels: string[]; wholeLabel?: string }> = ({
  parts,
  labels,
  wholeLabel,
}) => {
  const ids = useWidgetHatchIds();
  const total = Math.max(1, parts.reduce((acc, n) => acc + Math.max(1, n), 0));
  const totalWidth = 280;
  let curX = 20;

  return (
    <svg viewBox="0 0 320 94" className="block mx-auto w-full max-w-[340px] h-auto" role="img" aria-label="Стрічкова модель">
      <SvgHatchDefs ids={ids} />
      <path d="M 20 26 Q 160 10 300 26" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
      <text x="160" y="15" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {wholeLabel || `Усього: ${total}`}
      </text>

      {parts.map((val, idx) => {
        const segW = Math.max(24, (Math.max(1, val) / total) * totalWidth);
        const x = curX;
        curX += segW;
        const fillPat = idx % 2 === 0 ? ids.diagA : ids.diagB;
        const lbl = labels[idx] || String(val);
        const badgeW = Math.min(segW - 6, Math.max(20, lbl.length * 6.5 + 10));
        return (
          <g key={idx}>
            <rect x={x} y="34" width={segW} height="34" fill={`url(#${fillPat})`} stroke="var(--accent)" strokeWidth="1.6" />
            <rect
              x={x + segW / 2 - badgeW / 2}
              y="42"
              width={badgeW}
              height="18"
              rx="4"
              fill="var(--surface)"
              fillOpacity="0.92"
            />
            <text
              x={x + segW / 2}
              y="55"
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill="var(--text)"
              className="svg-hatch-label"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {lbl}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const FractionSvg: React.FC<{ num: number; den: number; mode: 'pie' | 'bar' }> = ({
  num,
  den,
  mode,
}) => {
  const ids = useWidgetHatchIds();
  const safeDen = Math.max(1, Math.min(12, Math.round(den)));
  const safeNum = Math.max(0, Math.min(safeDen, Math.round(num)));

  if (mode === 'bar') {
    const segW = 240 / safeDen;
    return (
      <svg viewBox="0 0 320 72" className="w-full max-w-[330px] h-auto" role="img" aria-label={`Дріб ${safeNum}/${safeDen}`}>
        <SvgHatchDefs ids={ids} />
        {Array.from({ length: safeDen }).map((_, idx) => (
          <rect
            key={idx}
            x={16 + idx * segW}
            y={18}
            width={segW}
            height={34}
            fill={idx < safeNum ? `url(#${ids.diagA})` : 'var(--surface-alt)'}
            stroke="var(--accent)"
            strokeWidth="1.5"
          />
        ))}
        <text x="272" y="40" fontSize="15" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {safeNum}/{safeDen}
        </text>
      </svg>
    );
  }

  const cx = 64;
  const cy = 54;
  const r = 42;

  return (
    <svg viewBox="0 0 260 108" className="block mx-auto w-full max-w-[280px] h-auto" role="img" aria-label={`Сектор дробу ${safeNum}/${safeDen}`}>
      <SvgHatchDefs ids={ids} />
      {safeDen === 1 ? (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={safeNum >= 1 ? `url(#${ids.diagA})` : 'var(--surface-alt)'}
          stroke="var(--accent)"
          strokeWidth="2"
        />
      ) : (
        Array.from({ length: safeDen }).map((_, idx) => {
          const a1 = (idx / safeDen) * Math.PI * 2 - Math.PI / 2;
          const a2 = ((idx + 1) / safeDen) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy + r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2);
          const y2 = cy + r * Math.sin(a2);
          const largeArc = a2 - a1 > Math.PI ? 1 : 0;
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return (
            <path
              key={idx}
              d={d}
              fill={idx < safeNum ? `url(#${ids.diagA})` : 'var(--surface-alt)'}
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
          );
        })
      )}

      <text x="132" y="48" fontSize="18" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {safeNum}/{safeDen}
      </text>
      <text x="132" y="68" fontSize="11" fontWeight="700" fill="var(--text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Math.round((safeNum / safeDen) * 100)}% від цілого
      </text>
    </svg>
  );
};

const AngleSvg: React.FC<{ deg: number }> = ({ deg }) => {
  const ids = useWidgetHatchIds();
  const clamped = Math.max(5, Math.min(180, Math.round(deg)));
  const rad = (clamped * Math.PI) / 180;
  const cx = 110;
  const cy = 96;
  const rLine = 74;
  const rArc = 38;
  const x2 = cx + rLine * Math.cos(-rad);
  const y2 = cy + rLine * Math.sin(-rad);
  const ax = cx + rArc * Math.cos(-rad);
  const ay = cy + rArc * Math.sin(-rad);
  const typeLabel =
    clamped < 90
      ? 'Гострий'
      : clamped === 90
      ? 'Прямий'
      : clamped < 180
      ? 'Тупий'
      : 'Розгорнутий';

  return (
    <svg viewBox="0 0 280 116" className="w-full max-w-[300px] h-auto" role="img" aria-label={`Кут ${clamped} градусів`}>
      <SvgHatchDefs ids={ids} />
      <path
        d={`M ${cx} ${cy} L ${cx + rArc} ${cy} A ${rArc} ${rArc} 0 0 0 ${ax} ${ay} Z`}
        fill={`url(#${ids.diagA})`}
        stroke="var(--accent)"
        strokeWidth="1.4"
      />
      <line x1={cx} y1={cy} x2={cx + rLine} y2={cy} stroke="var(--text)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill="var(--primary-dark)" />
      <text x="200" y="54" fontSize="16" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {clamped}°
      </text>
      <text x="200" y="74" fontSize="11" fontWeight="700" fill="var(--text-muted)">
        {typeLabel}
      </text>
    </svg>
  );
};

const AxisSvg: React.FC<{ min: number; max: number; start: number; jump: number }> = ({
  min,
  max,
  start,
  jump,
}) => {
  const safeMax = max <= min ? min + 10 : max;
  const span = safeMax - min;
  const toX = (val: number) => 22 + ((Math.max(min, Math.min(safeMax, val)) - min) / span) * 276;
  const end = Math.max(min, Math.min(safeMax, start + jump));
  const sx = toX(start);
  const ex = toX(end);
  const midX = (sx + ex) / 2;
  const ticks = Math.min(10, Math.max(2, Math.round(span)));

  return (
    <svg viewBox="0 0 320 90" className="w-full max-w-[340px] h-auto" role="img" aria-label="Числова вісь">
      <line x1="16" y1="54" x2="306" y2="54" stroke="var(--text)" strokeWidth="2" />
      <polygon points="306,54 298,49 298,59" fill="var(--text)" />
      {Array.from({ length: ticks + 1 }).map((_, idx) => {
        const v = min + (idx * span) / ticks;
        const x = toX(v);
        return (
          <g key={idx}>
            <line x1={x} y1="49" x2={x} y2="59" stroke="var(--text-muted)" strokeWidth="1.4" />
            <text x={x} y="74" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-muted)">
              {Number(v.toFixed(1))}
            </text>
          </g>
        );
      })}
      {jump !== 0 && (
        <path
          d={`M ${sx} 48 Q ${midX} 16 ${ex} 48`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.2"
          strokeDasharray="4 2"
        />
      )}
      <text x={midX} y="24" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--accent)">
        {jump >= 0 ? `+${jump}` : jump}
      </text>
      <circle cx={sx} cy="54" r="4.5" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
      <circle cx={ex} cy="54" r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
};

const BalanceSvg: React.FC<{ leftVal: number; rightVal: number; leftExpr: string; rightExpr: string }> = ({
  leftVal,
  rightVal,
  leftExpr,
  rightExpr,
}) => {
  const diff = Math.max(-15, Math.min(15, rightVal - leftVal));
  const balanced = Math.abs(leftVal - rightVal) < 0.01;
  const tilt = diff * 1.1;

  return (
    <svg viewBox="0 0 300 120" className="w-full max-w-[320px] h-auto" role="img" aria-label="Важільні терези">
      <polygon points="150,48 134,104 166,104" fill="var(--surface-alt)" stroke="var(--border-hover)" strokeWidth="2" />
      <rect x="115" y="104" width="70" height="8" rx="4" fill="var(--border-hover)" />
      <g transform={`rotate(${tilt} 150 48)`}>
        <line x1="58" y1="48" x2="242" y2="48" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
        <rect x="28" y="54" width="64" height="28" rx="6" fill="var(--hl-bg)" stroke="var(--accent)" strokeWidth="1.8" />
        <text x="60" y="72" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--hl-text)">
          {leftExpr || leftVal}
        </text>
        <rect x="208" y="54" width="64" height="28" rx="6" fill={balanced ? 'var(--ok-bg)' : 'var(--surface-alt)'} stroke={balanced ? 'var(--ok-border)' : 'var(--border-hover)'} strokeWidth="1.8" />
        <text x="240" y="72" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text)">
          {rightExpr || rightVal}
        </text>
      </g>
      <circle cx="150" cy="48" r="5" fill={balanced ? 'var(--ok-border)' : 'var(--accent)'} />
      <text x="150" y="20" textAnchor="middle" fontSize="11" fontWeight="800" fill={balanced ? 'var(--ok-text)' : 'var(--text-muted)'}>
        {balanced ? '⚖️ Рівновага (=)' : leftVal > rightVal ? 'Ліва шалька важча' : 'Права шалька важча'}
      </text>
    </svg>
  );
};

const GridSvg: React.FC<{ rows: number; cols: number; pointsRaw?: string }> = ({ rows, cols, pointsRaw }) => {
  const ids = useWidgetHatchIds();
  const r = Math.max(1, Math.min(8, rows));
  const c = Math.max(1, Math.min(10, cols));
  const cell = 18;
  const ox = 24;
  const oy = 18;
  const pts = (pointsRaw || '')
    .split('|')
    .map((p) => p.split(':').map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  return (
    <svg viewBox="0 0 260 176" className="w-full max-w-[260px] h-auto" role="img" aria-label={`Сітка ${r} на ${c}`}>
      <SvgHatchDefs ids={ids} />
      {Array.from({ length: r }).map((_, ri) =>
        Array.from({ length: c }).map((__, ci) => (
          <rect
            key={`${ri}_${ci}`}
            x={ox + ci * cell}
            y={oy + ri * cell}
            width={cell}
            height={cell}
            fill={(ri + ci) % 2 === 0 ? `url(#${ids.dots})` : 'var(--surface)'}
            stroke="var(--border-hover)"
            strokeWidth="1"
          />
        ))
      )}
      {pts.map(([x, y], idx) => (
        <circle
          key={idx}
          cx={ox + Math.min(c, Math.max(0, x)) * cell}
          cy={oy + (r - Math.min(r, Math.max(0, y))) * cell}
          r="4.5"
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      ))}
      <text x={ox} y={oy + r * cell + 16} fontSize="11" fontWeight="700" fill="var(--text-muted)">
        Масив {r} × {c} = {r * c}
      </text>
    </svg>
  );
};

const FormulaCard: React.FC<{ expr: string; legend: string }> = ({ expr, legend }) => (
  <div className="inline-block surface-subtle rounded-[var(--radius-sm)] px-3.5 py-2.5 my-1 space-y-1.5 border border-[var(--border)]">
    <div className="font-mono text-sm sm:text-base font-extrabold text-[var(--primary-dark)]">{expr}</div>
    {legend && (
      <div className="flex flex-wrap gap-1.5">
        {legend.split(';').map((item, idx) => (
          <span key={idx} className="code-inline">
            {item.trim()}
          </span>
        ))}
      </div>
    )}
  </div>
);

const VectorsSvg: React.FC<{ f1: number; f2: number; opposite: boolean }> = ({ f1, f2, opposite }) => {
  const res = opposite ? f1 - f2 : f1 + f2;
  const cx = 140;
  const s1 = Math.min(95, Math.max(18, Math.abs(f1) * 4.5));
  const s2 = Math.min(95, Math.max(18, Math.abs(f2) * 4.5));

  return (
    <svg viewBox="0 0 300 96" className="w-full max-w-[320px] h-auto" role="img" aria-label="Вектори сил">
      <circle cx={cx} cy="40" r="7" fill="var(--primary-dark)" />
      {/* Vector F1 -> right */}
      <line x1={cx} y1="36" x2={cx + s1} y2="36" stroke="var(--accent)" strokeWidth="3" />
      <polygon points={`${cx + s1 + 7},36 ${cx + s1 - 1},31 ${cx + s1 - 1},41`} fill="var(--accent)" />
      <text x={cx + s1 / 2} y="25" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--accent)">
        F₁={f1}
      </text>

      {/* Vector F2 -> opposite (left) or same (right lower) */}
      {opposite ? (
        <>
          <line x1={cx} y1="44" x2={cx - s2} y2="44" stroke="var(--text)" strokeWidth="3" strokeDasharray="4 2" />
          <polygon points={`${cx - s2 - 7},44 ${cx - s2 + 1},39 ${cx - s2 + 1},49`} fill="var(--text)" />
          <text x={cx - s2 / 2} y="62" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--text)">
            F₂={f2}
          </text>
        </>
      ) : (
        <>
          <line x1={cx} y1="48" x2={cx + s2} y2="48" stroke="var(--ok-border)" strokeWidth="3" strokeDasharray="4 2" />
          <polygon points={`${cx + s2 + 7},48 ${cx + s2 - 1},43 ${cx + s2 - 1},53`} fill="var(--ok-border)" />
          <text x={cx + s2 / 2} y="64" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--ok-text)">
            F₂={f2}
          </text>
        </>
      )}

      <text x="150" y="86" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        Рівнодійна R = {Math.abs(res)} ({res >= 0 ? '→ вправо' : '← вліво'})
      </text>
    </svg>
  );
};

const MachineSvg: React.FC<{ input: number; factor: number; add: number; opLabel?: string }> = ({
  input,
  factor,
  add,
  opLabel,
}) => {
  const out = opLabel && opLabel.includes('x')
    ? evaluateSafeExpression(opLabel, { x: input, in: input })
    : input * factor + add;
  const formulaLabel = opLabel || `× ${factor} ${add >= 0 ? `+ ${add}` : `- ${Math.abs(add)}`}`;

  return (
    <svg viewBox="0 0 320 82" className="block mx-auto w-full max-w-[340px] h-auto" role="img" aria-label="Функціональна машина">
      <rect x="10" y="22" width="66" height="38" rx="8" fill="var(--surface-alt)" stroke="var(--border-hover)" strokeWidth="1.8" />
      <text x="43" y="45" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {input}
      </text>
      <line x1="76" y1="41" x2="104" y2="41" stroke="var(--text-muted)" strokeWidth="2" />
      <polygon points="108,41 100,36 100,46" fill="var(--text-muted)" />

      <rect x="110" y="16" width="102" height="50" rx="10" fill="var(--hl-bg)" stroke="var(--accent)" strokeWidth="2" />
      <text x="161" y="46" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--hl-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formulaLabel}
      </text>

      <line x1="212" y1="41" x2="240" y2="41" stroke="var(--text-muted)" strokeWidth="2" />
      <polygon points="244,41 236,36 236,46" fill="var(--text-muted)" />

      <rect x="246" y="22" width="64" height="38" rx="8" fill="var(--ok-bg)" stroke="var(--ok-border)" strokeWidth="1.8" />
      <text x="278" y="45" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--ok-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {out}
      </text>
    </svg>
  );
};

const ScaleGaugeSvg: React.FC<{
  type: 'thermometer' | 'beaker';
  min: number;
  max: number;
  value: number;
  step: number;
  unit: string;
}> = ({ type, min, max, value, step, unit }) => {
  const ids = useWidgetHatchIds();
  const safeMax = max <= min ? min + 10 : max;
  const clamped = Math.max(min, Math.min(safeMax, value));
  const fillRatio = (clamped - min) / (safeMax - min);
  const safeStep = Math.max(0.1, step);
  const totalTicks = Math.max(2, Math.min(24, Math.round((safeMax - min) / safeStep)));
  const majorStride = totalTicks <= 10 ? 2 : 5;

  if (type === 'beaker') {
    const topY = 16;
    const botY = 104;
    const scaleH = botY - topY;
    const liqY = botY - fillRatio * scaleH;
    return (
      <svg viewBox="0 0 240 124" className="block mx-auto w-full max-w-[260px] h-auto" role="img" aria-label={`Мензурка: ${clamped} ${unit}`}>
        <SvgHatchDefs ids={ids} />
        <path
          d="M 54 14 L 62 20 L 62 106 Q 62 112 68 112 L 136 112 Q 142 112 142 106 L 142 16 L 150 14"
          fill="var(--surface-alt)"
          stroke="var(--text)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {fillRatio > 0 && (
          <>
            <rect
              x="64"
              y={liqY}
              width="76"
              height={Math.max(4, 110 - liqY)}
              rx="3"
              fill={`url(#${ids.diagA})`}
            />
            <line x1="64" y1={liqY} x2="140" y2={liqY} stroke="var(--accent)" strokeWidth="2.2" />
          </>
        )}
        {Array.from({ length: totalTicks + 1 }).map((_, idx) => {
          const r = idx / totalTicks;
          const y = botY - r * scaleH;
          const v = Math.round((min + r * (safeMax - min)) * 10) / 10;
          const isMaj = idx % majorStride === 0 || idx === totalTicks;
          return (
            <g key={idx}>
              <line x1={isMaj ? 118 : 128} y1={y} x2="141" y2={y} stroke="var(--text)" strokeWidth={isMaj ? 1.5 : 0.9} />
              {isMaj && (
                <text x="147" y={y + 3} fontSize="9.5" fontWeight="700" fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {v}
                </text>
              )}
            </g>
          );
        })}
        <text x="196" y="54" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {clamped} {unit}
        </text>
        <text x="196" y="72" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--text-muted)">
          Поділка: {safeStep}
        </text>
      </svg>
    );
  }

  // Thermometer inline mini-gauge
  const topY = 14;
  const botY = 96;
  const scaleH = botY - topY;
  const colY = botY - fillRatio * scaleH;

  return (
    <svg viewBox="0 0 240 124" className="block mx-auto w-full max-w-[260px] h-auto" role="img" aria-label={`Термометр: ${clamped} ${unit}`}>
      <SvgHatchDefs ids={ids} />
      <rect x="64" y="10" width="12" height="90" rx="6" fill="var(--surface)" stroke="var(--text)" strokeWidth="1.8" />
      <rect x="66" y={colY} width="8" height={Math.max(6, 100 - colY)} rx="4" fill={`url(#${ids.diagA})`} stroke="var(--accent)" strokeWidth="1.2" />
      <circle cx="70" cy="106" r="10" fill={`url(#${ids.diagA})`} stroke="var(--accent)" strokeWidth="2" />
      <circle cx="70" cy="106" r="4" fill="var(--accent)" />
      {Array.from({ length: totalTicks + 1 }).map((_, idx) => {
        const r = idx / totalTicks;
        const y = botY - r * scaleH;
        const v = Math.round((min + r * (safeMax - min)) * 10) / 10;
        const isMaj = idx % majorStride === 0 || idx === totalTicks;
        return (
          <g key={idx}>
            <line x1="78" y1={y} x2={isMaj ? 90 : 85} y2={y} stroke="var(--text)" strokeWidth={isMaj ? 1.5 : 0.9} />
            {isMaj && (
              <text x="94" y={y + 3} fontSize="9.5" fontWeight="700" fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {v}{unit}
              </text>
            )}
          </g>
        );
      })}
      <rect x="148" y="42" width="76" height="38" rx="7" fill="var(--surface-alt)" stroke="var(--accent)" strokeWidth="1.5" />
      <text x="186" y="59" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {clamped} {unit}
      </text>
      <text x="186" y="73" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-muted)">
        Крок: {safeStep} {unit}
      </text>
    </svg>
  );
};

const ClockFaceSvg: React.FC<{ hour: number; minute: number }> = ({ hour, minute }) => {
  const h = ((Math.round(hour) % 12) + 12) % 12 || 12;
  const m = ((Math.round(minute) % 60) + 60) % 60;
  const cx = 64;
  const cy = 60;
  const r = 46;
  const minAng = ((m / 60) * 360 - 90) * (Math.PI / 180);
  const hrAng = ((((h % 12) + m / 60) / 12) * 360 - 90) * (Math.PI / 180);
  const padded = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return (
    <svg viewBox="0 0 240 120" className="block mx-auto w-full max-w-[260px] h-auto" role="img" aria-label={`Циферблат ${padded}`}>
      <circle cx={cx} cy={cy} r={r} fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.2" />
      {Array.from({ length: 12 }).map((_, idx) => {
        const ang = ((idx + 1) / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <g key={idx}>
            <line
              x1={cx + (r - 6) * Math.cos(ang)}
              y1={cy + (r - 6) * Math.sin(ang)}
              x2={cx + (r - 1) * Math.cos(ang)}
              y2={cy + (r - 1) * Math.sin(ang)}
              stroke="var(--text)"
              strokeWidth="1.6"
            />
            <text
              x={cx + (r - 14) * Math.cos(ang)}
              y={cy + (r - 14) * Math.sin(ang) + 3}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="800"
              fill="var(--text)"
            >
              {idx + 1}
            </text>
          </g>
        );
      })}
      <line x1={cx} y1={cy} x2={cx + 22 * Math.cos(hrAng)} y2={cy + 22 * Math.sin(hrAng)} stroke="var(--primary-dark)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + 34 * Math.cos(minAng)} y2={cy + 34 * Math.sin(minAng)} stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.5" fill="var(--accent)" />

      <rect x="132" y="34" width="90" height="50" rx="8" fill="var(--surface-alt)" stroke="var(--border-hover)" strokeWidth="1.5" />
      <text x="177" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {padded}
      </text>
      <text x="177" y="74" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--text-muted)">
        Годинник
      </text>
    </svg>
  );
};

export const STEM_WIDGETS: Record<string, WidgetDefinition> = {
  compare: {
    type: 'compare',
    label: 'Порівняння величин',
    category: 'stem',
    render: (args, ov) => (
      <CompareSvg
        a={numArg(args, ov, ['a', 'v1'], 12, 0)}
        b={numArg(args, ov, ['b', 'v2'], 8, 1)}
        labelA={strArg(args, ['labelA', 'la'], 'A')}
        labelB={strArg(args, ['labelB', 'lb'], 'B')}
      />
    ),
  },
  split: {
    type: 'split',
    label: 'Декомпозиція числа',
    category: 'stem',
    render: (args, ov) => (
      <SplitSvg
        total={numArg(args, ov, ['total', 'whole', 'sum'], 15, 0)}
        left={numArg(args, ov, ['left', 'a', 'part1'], 10, 1)}
      />
    ),
    getSliders: (args) => {
      const total = numArg(args, {}, ['total', 'whole', 'sum'], 15, 0);
      const left = Math.min(total, numArg(args, {}, ['left', 'a', 'part1'], Math.floor(total / 2), 1));
      return [
        { key: 'total', label: 'Ціле', min: 2, max: 100, step: 1, defaultValue: total },
        { key: 'left', label: 'Перша частина', min: 1, max: Math.max(1, total - 1), step: 1, defaultValue: left },
      ];
    },
    getLiveSummary: (args, ov) => {
      const total = numArg(args, ov, ['total', 'whole', 'sum'], 15, 0);
      const left = Math.min(total, numArg(args, ov, ['left', 'a', 'part1'], 10, 1));
      return `Розклад: ${total} = ${left} + ${Math.max(0, total - left)}`;
    },
  },
  rect_geo: {
    type: 'rect_geo',
    label: 'Прямокутник (площа і периметр)',
    category: 'stem',
    render: (args, ov) => (
      <RectGeoSvg
        w={numArg(args, ov, ['w', 'a', 'width'], 6, 0)}
        h={numArg(args, ov, ['h', 'b', 'height'], 4, 1)}
        unit={strArg(args, ['unit'], 'см')}
      />
    ),
    getSliders: (args) => [
      { key: 'w', label: 'Ширина (a)', unit: strArg(args, ['unit'], 'см'), min: 1, max: 14, step: 1, defaultValue: numArg(args, {}, ['w', 'a', 'width'], 6, 0) },
      { key: 'h', label: 'Висота (b)', unit: strArg(args, ['unit'], 'см'), min: 1, max: 10, step: 1, defaultValue: numArg(args, {}, ['h', 'b', 'height'], 4, 1) },
    ],
    getLiveSummary: (args, ov) => {
      const w = numArg(args, ov, ['w', 'a', 'width'], 6, 0);
      const h = numArg(args, ov, ['h', 'b', 'height'], 4, 1);
      const unit = strArg(args, ['unit'], 'см');
      return `Площа S = ${w} × ${h} = ${w * h} ${unit}², периметр P = ${2 * (w + h)} ${unit}`;
    },
  },
  tape: {
    type: 'tape',
    label: 'Стрічкова модель задачі',
    category: 'stem',
    render: (args) => {
      const partsRaw = strArg(args, ['parts'], '10|14', 0);
      const parts = partsRaw.split('|').map((v) => Math.max(1, Number(v) || 1));
      const labelsRaw = strArg(args, ['labels'], '', 1);
      const labels = labelsRaw ? labelsRaw.split('|') : [];
      return <TapeSvg parts={parts} labels={labels} wholeLabel={args.params.whole} />;
    },
  },
  fraction: {
    type: 'fraction',
    label: 'Модель дробу',
    category: 'stem',
    render: (args, ov) => {
      const slash = args.positional[0]?.includes('/') ? args.positional[0].split('/') : null;
      const den = Math.max(1, numArg(args, ov, ['den', 'd'], slash ? Number(slash[1]) || 4 : 4, 1));
      const num = Math.min(den, numArg(args, ov, ['num', 'n'], slash ? Number(slash[0]) || 1 : 3, 0));
      const mode = strArg(args, ['mode'], 'pie') === 'bar' ? 'bar' : 'pie';
      return <FractionSvg num={num} den={den} mode={mode} />;
    },
    getSliders: (args) => {
      const slash = args.positional[0]?.includes('/') ? args.positional[0].split('/') : null;
      const den = Math.max(1, Math.min(12, numArg(args, {}, ['den', 'd'], slash ? Number(slash[1]) || 4 : 4, 1)));
      const num = Math.min(den, numArg(args, {}, ['num', 'n'], slash ? Number(slash[0]) || 1 : 3, 0));
      return [
        { key: 'num', label: 'Чисельник', min: 0, max: 12, step: 1, defaultValue: num },
        { key: 'den', label: 'Знаменник', min: 1, max: 12, step: 1, defaultValue: den },
      ];
    },
    getLiveSummary: (args, ov) => {
      const slash = args.positional[0]?.includes('/') ? args.positional[0].split('/') : null;
      const den = Math.max(1, numArg(args, ov, ['den', 'd'], slash ? Number(slash[1]) || 4 : 4, 1));
      const num = Math.min(den, numArg(args, ov, ['num', 'n'], slash ? Number(slash[0]) || 1 : 3, 0));
      return `Дріб ${num}/${den} становить ${Math.round((num / den) * 100)}% від усього цілого`;
    },
  },
  angle: {
    type: 'angle',
    label: 'Кутомірна дуга',
    category: 'stem',
    render: (args, ov) => <AngleSvg deg={numArg(args, ov, ['deg', 'angle', 'a'], 60, 0)} />,
    getSliders: (args) => [
      { key: 'deg', label: 'Кут', unit: '°', min: 10, max: 180, step: 5, defaultValue: numArg(args, {}, ['deg', 'angle', 'a'], 60, 0) },
    ],
    getLiveSummary: (args, ov) => {
      const d = numArg(args, ov, ['deg', 'angle', 'a'], 60, 0);
      const kind = d < 90 ? 'гострий' : d === 90 ? 'прямий' : d < 180 ? 'тупий' : 'розгорнутий';
      return `Величина кута ${d}° — це ${kind} кут`;
    },
  },
  axis: {
    type: 'axis',
    label: 'Числова вісь',
    category: 'stem',
    render: (args, ov) => (
      <AxisSvg
        min={numArg(args, ov, ['min'], 0)}
        max={numArg(args, ov, ['max'], 10)}
        start={numArg(args, ov, ['start', 'a'], 2, 0)}
        jump={numArg(args, ov, ['jump', 'step'], 4, 1)}
      />
    ),
    getSliders: (args) => {
      const min = numArg(args, {}, ['min'], 0);
      const max = numArg(args, {}, ['max'], 10);
      return [
        { key: 'start', label: 'Початок', min, max, step: 1, defaultValue: numArg(args, {}, ['start', 'a'], 2, 0) },
        { key: 'jump', label: 'Стрибок', min: -Math.max(4, max - min), max: Math.max(4, max - min), step: 1, defaultValue: numArg(args, {}, ['jump', 'step'], 4, 1) },
      ];
    },
    getLiveSummary: (args, ov) => {
      const start = numArg(args, ov, ['start', 'a'], 2, 0);
      const jump = numArg(args, ov, ['jump', 'step'], 4, 1);
      return `Старт у точці ${start}, стрибок ${jump >= 0 ? `+${jump}` : jump} → результат ${start + jump}`;
    },
  },
  balance: {
    type: 'balance',
    label: 'Важільні терези',
    category: 'stem',
    render: (args, ov) => {
      const leftVal = numArg(args, ov, ['leftVal', 'l', 'left'], 10, 0);
      const rightVal = numArg(args, ov, ['rightVal', 'r', 'right'], 10, 1);
      return (
        <BalanceSvg
          leftVal={leftVal}
          rightVal={rightVal}
          leftExpr={ov.leftVal !== undefined ? String(leftVal) : strArg(args, ['leftExpr'], String(leftVal))}
          rightExpr={ov.rightVal !== undefined ? String(rightVal) : strArg(args, ['rightExpr'], String(rightVal))}
        />
      );
    },
    getSliders: (args) => [
      { key: 'leftVal', label: 'Ліва шалька', min: 1, max: 30, step: 1, defaultValue: numArg(args, {}, ['leftVal', 'l', 'left'], 10, 0) },
      { key: 'rightVal', label: 'Права шалька', min: 1, max: 30, step: 1, defaultValue: numArg(args, {}, ['rightVal', 'r', 'right'], 10, 1) },
    ],
    getLiveSummary: (args, ov) => {
      const l = numArg(args, ov, ['leftVal', 'l', 'left'], 10, 0);
      const r = numArg(args, ov, ['rightVal', 'r', 'right'], 10, 1);
      return l === r ? `Терези в рівновазі: ${l} = ${r}` : `Різниця мас: |${l} − ${r}| = ${Math.abs(l - r)}`;
    },
  },
  grid: {
    type: 'grid',
    label: 'Координатна міні-сітка',
    category: 'stem',
    render: (args, ov) => (
      <GridSvg
        rows={numArg(args, ov, ['rows', 'r'], 3, 0)}
        cols={numArg(args, ov, ['cols', 'c'], 4, 1)}
        pointsRaw={strArg(args, ['points'], '')}
      />
    ),
  },
  formula: {
    type: 'formula',
    label: 'Картка формули',
    category: 'stem',
    render: (args) => (
      <FormulaCard
        expr={strArg(args, ['expr', 'f'], 'S = v · t', 0)}
        legend={strArg(args, ['vars', 'legend'], '', 1)}
      />
    ),
  },
  vectors: {
    type: 'vectors',
    label: 'Вектори сил і швидкостей',
    category: 'stem',
    render: (args, ov) => (
      <VectorsSvg
        f1={numArg(args, ov, ['f1', 'v1'], 12, 0)}
        f2={numArg(args, ov, ['f2', 'v2'], 7, 1)}
        opposite={strArg(args, ['dir'], 'opposite') !== 'same'}
      />
    ),
    getSliders: (args) => [
      { key: 'f1', label: 'Сила F₁', unit: 'Н', min: 1, max: 25, step: 1, defaultValue: numArg(args, {}, ['f1', 'v1'], 12, 0) },
      { key: 'f2', label: 'Сила F₂', unit: 'Н', min: 0, max: 25, step: 1, defaultValue: numArg(args, {}, ['f2', 'v2'], 7, 1) },
    ],
    getLiveSummary: (args, ov) => {
      const f1 = numArg(args, ov, ['f1', 'v1'], 12, 0);
      const f2 = numArg(args, ov, ['f2', 'v2'], 7, 1);
      const opposite = strArg(args, ['dir'], 'opposite') !== 'same';
      return opposite
        ? `Сили протилежні: рівнодійна R = |${f1} − ${f2}| = ${Math.abs(f1 - f2)} Н`
        : `Сили співнапрямлені: рівнодійна R = ${f1} + ${f2} = ${f1 + f2} Н`;
    },
  },
  machine: {
    type: 'machine',
    label: 'Машина «Вхід → Вихід»',
    category: 'stem',
    render: (args, ov) => (
      <MachineSvg
        input={numArg(args, ov, ['in', 'x', 'input'], 5, 0)}
        factor={numArg(args, ov, ['factor', 'k'], 3)}
        add={numArg(args, ov, ['add', 'b'], 2)}
        opLabel={args.params.op}
      />
    ),
    getSliders: (args) => [
      { key: 'in', label: 'Вхідне число', min: 0, max: 20, step: 1, defaultValue: numArg(args, {}, ['in', 'x', 'input'], 5, 0) },
      { key: 'factor', label: 'Множник', min: 1, max: 6, step: 1, defaultValue: numArg(args, {}, ['factor', 'k'], 3) },
    ],
    getLiveSummary: (args, ov) => {
      const x = numArg(args, ov, ['in', 'x', 'input'], 5, 0);
      const k = numArg(args, ov, ['factor', 'k'], 3);
      const b = numArg(args, ov, ['add', 'b'], 2);
      const op = args.params.op;
      const out = op && op.includes('x') ? evaluateSafeExpression(op, { x, in: x }) : x * k + b;
      return `При вході ${x} машина обчислює вихід ${out}`;
    },
  },
  scale_gauge: {
    type: 'scale_gauge',
    label: 'Шкала приладу (термометр / мензурка)',
    category: 'stem',
    render: (args, ov) => {
      const kind = strArg(args, ['type', 'kind'], 'thermometer') === 'beaker' ? 'beaker' : 'thermometer';
      const min = numArg(args, {}, ['min'], kind === 'thermometer' ? -10 : 0);
      const max = numArg(args, {}, ['max'], kind === 'thermometer' ? 40 : 100);
      const step = Math.max(0.5, numArg(args, {}, ['step'], kind === 'beaker' ? 10 : 2));
      const unit = strArg(args, ['unit'], kind === 'beaker' ? 'мл' : '°C');
      const value = numArg(args, ov, ['value', 'val', 'v'], kind === 'beaker' ? 60 : 22, 0);
      return <ScaleGaugeSvg type={kind} min={min} max={max} value={value} step={step} unit={unit} />;
    },
    getSliders: (args) => {
      const kind = strArg(args, ['type', 'kind'], 'thermometer') === 'beaker' ? 'beaker' : 'thermometer';
      const min = numArg(args, {}, ['min'], kind === 'thermometer' ? -10 : 0);
      const max = numArg(args, {}, ['max'], kind === 'thermometer' ? 40 : 100);
      const step = Math.max(0.5, numArg(args, {}, ['step'], kind === 'beaker' ? 10 : 2));
      const unit = strArg(args, ['unit'], kind === 'beaker' ? 'мл' : '°C');
      return [
        {
          key: 'value',
          label: 'Показання',
          unit,
          min,
          max,
          step,
          defaultValue: numArg(args, {}, ['value', 'val', 'v'], kind === 'beaker' ? 60 : 22, 0),
        },
      ];
    },
    getLiveSummary: (args, ov) => {
      const kind = strArg(args, ['type', 'kind'], 'thermometer') === 'beaker' ? 'beaker' : 'thermometer';
      const step = Math.max(0.5, numArg(args, {}, ['step'], kind === 'beaker' ? 10 : 2));
      const unit = strArg(args, ['unit'], kind === 'beaker' ? 'мл' : '°C');
      const value = numArg(args, ov, ['value', 'val', 'v'], kind === 'beaker' ? 60 : 22, 0);
      return `Показання приладу: ${value} ${unit} (ціна однієї поділки = ${step} ${unit})`;
    },
  },
  clock_face: {
    type: 'clock_face',
    label: 'Годинник (стрілки і кут)',
    category: 'stem',
    render: (args, ov) => (
      <ClockFaceSvg
        hour={numArg(args, ov, ['hour', 'h'], 3, 0)}
        minute={numArg(args, ov, ['minute', 'min', 'm'], 15, 1)}
      />
    ),
    getSliders: (args) => [
      { key: 'hour', label: 'Години', min: 1, max: 12, step: 1, defaultValue: numArg(args, {}, ['hour', 'h'], 3, 0) },
      { key: 'minute', label: 'Хвилини', min: 0, max: 55, step: 5, defaultValue: numArg(args, {}, ['minute', 'min', 'm'], 15, 1) },
    ],
    getLiveSummary: (args, ov) => {
      const h = ((Math.round(numArg(args, ov, ['hour', 'h'], 3, 0)) % 12) + 12) % 12 || 12;
      const m = ((Math.round(numArg(args, ov, ['minute', 'min', 'm'], 15, 1)) % 60) + 60) % 60;
      const hrAngle = (h % 12) * 30 + m * 0.5;
      const minAngle = m * 6;
      const diff = Math.abs(hrAngle - minAngle);
      const between = Math.round(Math.min(diff, 360 - diff));
      return `Час ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · Кут між стрілками: ${between}°`;
    },
  },
};
