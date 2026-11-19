import React, { useState, useEffect, useRef } from 'react';
import { SvgHatchDefs, useWidgetHatchIds } from './SvgHatchDefs';
import { WidgetDefinition, numArg, strArg } from './widget.types';
import { soundEngine } from '../../services/soundEngineService';
import { musicalSynth } from '../../core/audio/musical-synth';

const TimelineSvg: React.FC<{ eventsRaw: string }> = ({ eventsRaw }) => {
  const events = eventsRaw
    .split('|')
    .map((e) => e.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((entry) => {
      const colonIdx = entry.indexOf(':');
      if (colonIdx > 0) {
        return { date: entry.slice(0, colonIdx).trim(), label: entry.slice(colonIdx + 1).trim() };
      }
      return { date: '', label: entry };
    });

  const width = 340;
  const count = Math.max(1, events.length);
  const padX = 36;
  const stepX = count > 1 ? (width - padX * 2) / (count - 1) : 0;

  return (
    <svg viewBox="0 0 340 104" className="w-full max-w-[380px] h-auto" role="img" aria-label="Хронологічна стрічка">
      <line x1="20" y1="52" x2="320" y2="52" stroke="var(--border-hover)" strokeWidth="3" strokeLinecap="round" />
      <polygon points="326,52 316,47 316,57" fill="var(--accent)" />
      {events.map((ev, idx) => {
        const cx = count === 1 ? 170 : padX + idx * stepX;
        const topLabel = idx % 2 === 0;
        return (
          <g key={idx}>
            <circle cx={cx} cy="52" r="6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
            {ev.date && (
              <text x={cx} y={topLabel ? 26 : 86} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--primary-dark)">
                {ev.date}
              </text>
            )}
            <text x={cx} y={topLabel ? 39 : 73} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--text)">
              {ev.label.slice(0, 18)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const wrapSvgWords = (text: string, maxChars: number): string[] => {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return ['—'];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushWord = (word: string) => {
    if (word.length <= maxChars) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxChars) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
      return;
    }

    if (current) {
      lines.push(current);
      current = '';
    }
    let idx = 0;
    while (idx < word.length) {
      const chunk = word.slice(idx, idx + maxChars - 1);
      const hasMore = idx + maxChars - 1 < word.length;
      if (hasMore) {
        lines.push(`${chunk}-`);
      } else {
        current = word.slice(idx);
      }
      idx += maxChars - 1;
    }
  };

  words.forEach(pushWord);
  if (current) lines.push(current);
  return lines.slice(0, 4);
};

interface VennCalloutBoxProps {
  cx: number;
  cy: number;
  width: number;
  lines: string[];
  stroke: string;
  strokeDasharray?: string;
  textFill?: string;
  anchorX: number;
  anchorY: number;
  edgeSide: 'left' | 'right' | 'top' | 'bottom';
  prefixSymbol?: string;
}

const VennCalloutBox: React.FC<VennCalloutBoxProps> = ({
  cx,
  cy,
  width,
  lines,
  stroke,
  strokeDasharray,
  textFill = 'var(--text)',
  anchorX,
  anchorY,
  edgeSide,
  prefixSymbol,
}) => {
  const lineH = 14.5;
  const boxH = lines.length * lineH + 10;
  const x = cx - width / 2;
  const y = cy - boxH / 2;
  const lineStartX =
    edgeSide === 'left' ? x + width : edgeSide === 'right' ? x : cx;
  const lineStartY =
    edgeSide === 'top' ? y + boxH : edgeSide === 'bottom' ? y : cy;

  return (
    <g>
      {/* Crisp halo + leader line pointing to region center */}
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={anchorX}
        y2={anchorY}
        stroke="var(--surface)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={anchorX}
        y2={anchorY}
        stroke={stroke}
        strokeWidth="1.6"
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
      />
      <circle
        cx={anchorX}
        cy={anchorY}
        r="3.8"
        fill={stroke}
        stroke="var(--surface)"
        strokeWidth="1.6"
      />

      {/* Rounded callout card */}
      <rect
        x={x}
        y={y}
        width={width}
        height={boxH}
        rx="6"
        fill="var(--surface)"
        fillOpacity="0.96"
        stroke={stroke}
        strokeWidth="1.5"
        strokeDasharray={strokeDasharray}
      />
      {lines.map((lineText, idx) => {
        const textY = y + 16 + idx * lineH;
        const displayLine =
          idx === 0 && prefixSymbol ? `${prefixSymbol} ${lineText}` : lineText;
        return (
          <text
            key={idx}
            x={cx}
            y={textY}
            textAnchor="middle"
            fontSize="11.2"
            fontWeight="800"
            fill={textFill}
          >
            {displayLine}
          </text>
        );
      })}
    </g>
  );
};

const VennSvg: React.FC<{ a: string; b: string; both: string; c?: string }> = ({
  a,
  b,
  both,
  c,
}) => {
  const ids = useWidgetHatchIds();
  const aLines = wrapSvgWords(a, 12);
  const bLines = wrapSvgWords(b, 12);

  if (c && c.trim()) {
    const bothLines = wrapSvgWords(both, 28);
    const cLines = wrapSvgWords(c, 32);

    const topBoxH = bothLines.length * 14.5 + 10;
    const bothCy = 6 + topBoxH / 2;
    const cy = 6 + topBoxH + 54;
    const cBoxH = cLines.length * 14.5 + 10;
    const cCy = cy + 72 + 14 + cBoxH / 2;
    const svgHeight = cy + 72 + 14 + cBoxH + 6;

    const bothW = Math.min(
      260,
      Math.max(96, Math.max(...bothLines.map((l) => l.length + 2)) * 7.1 + 22)
    );
    const cW = Math.min(
      300,
      Math.max(96, Math.max(...cLines.map((l) => l.length)) * 7.1 + 22)
    );

    return (
      <svg
        viewBox={`0 0 360 ${svgHeight}`}
        className="block mx-auto w-full max-w-[380px] h-auto"
        role="img"
        aria-label="Діаграма Ейлера-Венна"
      >
        <SvgHatchDefs ids={ids} />
        <circle
          cx="154"
          cy={cy}
          r="41"
          fill={`url(#${ids.diagA})`}
          fillOpacity="0.58"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle
          cx="206"
          cy={cy}
          r="41"
          fill={`url(#${ids.diagB})`}
          fillOpacity="0.58"
          stroke="var(--ok-border)"
          strokeWidth="2"
          strokeDasharray="5 2"
        />
        <circle
          cx="180"
          cy={cy + 31}
          r="41"
          fill={`url(#${ids.dots})`}
          fillOpacity="0.5"
          stroke="var(--text)"
          strokeWidth="1.6"
          strokeDasharray="2 2"
        />

        <VennCalloutBox
          cx={53}
          cy={cy - 4}
          width={102}
          lines={aLines}
          stroke="var(--accent)"
          anchorX={132}
          anchorY={cy - 4}
          edgeSide="left"
        />
        <VennCalloutBox
          cx={307}
          cy={cy - 4}
          width={102}
          lines={bLines}
          stroke="var(--ok-border)"
          strokeDasharray="4 2"
          anchorX={228}
          anchorY={cy - 4}
          edgeSide="right"
        />
        <VennCalloutBox
          cx={180}
          cy={bothCy}
          width={bothW}
          lines={bothLines}
          stroke="var(--primary-dark)"
          textFill="var(--primary-dark)"
          anchorX={180}
          anchorY={cy - 10}
          edgeSide="top"
          prefixSymbol="∩"
        />
        <VennCalloutBox
          cx={180}
          cy={cCy}
          width={cW}
          lines={cLines}
          stroke="var(--text)"
          strokeDasharray="2 2"
          anchorX={180}
          anchorY={cy + 52}
          edgeSide="bottom"
        />
      </svg>
    );
  }

  // Clean 2-set diagram with left/right set callouts + bottom center-intersection leader callout
  const bothLines = wrapSvgWords(both, 36);
  const bothBoxH = bothLines.length * 14.5 + 10;
  const cy = 60;
  const bothCy = 124 + bothBoxH / 2;
  const svgHeight = 124 + bothBoxH + 6;
  const bothW = Math.min(
    344,
    Math.max(104, Math.max(...bothLines.map((l) => l.length + 2)) * 7.1 + 24)
  );

  return (
    <svg
      viewBox={`0 0 360 ${svgHeight}`}
      className="block mx-auto w-full max-w-[380px] h-auto"
      role="img"
      aria-label="Діаграма Ейлера-Венна"
    >
      <SvgHatchDefs ids={ids} />
      <circle
        cx="154"
        cy={cy}
        r="44"
        fill={`url(#${ids.diagA})`}
        fillOpacity="0.58"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <circle
        cx="206"
        cy={cy}
        r="44"
        fill={`url(#${ids.diagB})`}
        fillOpacity="0.58"
        stroke="var(--ok-border)"
        strokeWidth="2"
        strokeDasharray="5 2"
      />

      <VennCalloutBox
        cx={53}
        cy={cy}
        width={102}
        lines={aLines}
        stroke="var(--accent)"
        anchorX={132}
        anchorY={cy}
        edgeSide="left"
      />
      <VennCalloutBox
        cx={307}
        cy={cy}
        width={102}
        lines={bLines}
        stroke="var(--ok-border)"
        strokeDasharray="4 2"
        anchorX={228}
        anchorY={cy}
        edgeSide="right"
      />
      <VennCalloutBox
        cx={180}
        cy={bothCy}
        width={bothW}
        lines={bothLines}
        stroke="var(--primary-dark)"
        textFill="var(--primary-dark)"
        anchorX={180}
        anchorY={cy}
        edgeSide="bottom"
        prefixSymbol="∩"
      />
    </svg>
  );
};

const TreeSvg: React.FC<{ root: string; children: string[] }> = ({ root, children }) => {
  const count = Math.max(1, Math.min(4, children.length));
  const spacing = 300 / count;
  return (
    <svg viewBox="0 0 320 118" className="w-full max-w-[350px] h-auto" role="img" aria-label={`Дерево: ${root}`}>
      <rect x="86" y="10" width="148" height="30" rx="8" fill="var(--hl-bg)" stroke="var(--accent)" strokeWidth="2" />
      <text x="160" y="29" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="var(--hl-text)">
        {root.slice(0, 22)}
      </text>
      {children.slice(0, 4).map((child, idx) => {
        const cx = 10 + spacing * idx + spacing / 2;
        const bw = Math.min(86, spacing - 8);
        return (
          <g key={idx}>
            <line x1="160" y1="40" x2={cx} y2="74" stroke="var(--border-hover)" strokeWidth="1.8" />
            <rect x={cx - bw / 2} y="74" width={bw} height="30" rx="7" fill="var(--surface-alt)" stroke="var(--border-hover)" strokeWidth="1.5" />
            <text x={cx} y="93" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">
              {child.slice(0, 14)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const FlowChain: React.FC<{ steps: string[] }> = ({ steps }) => (
  <div className="flex flex-wrap items-center gap-1.5 my-1.5">
    {steps.map((step, idx) => (
      <React.Fragment key={idx}>
        <span className="surface-subtle px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-bold border border-[var(--border)]">
          {step}
        </span>
        {idx < steps.length - 1 && (
          <span className="text-xs font-extrabold text-[var(--accent)]" aria-hidden="true">
            →
          </span>
        )}
      </React.Fragment>
    ))}
  </div>
);

const DeepDiveCard: React.FC<{
  title: string;
  body: string;
  renderRichText?: (t: string) => React.ReactNode;
}> = ({ title, body, renderRichText }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface-subtle rounded-[var(--radius-sm)] border border-[var(--border)] my-1.5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs font-extrabold text-[var(--primary-dark)] cursor-pointer hover:bg-[var(--surface-hover)]"
      >
        <span>🔍 Для допитливих: {title}</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)] text-xs font-medium text-[var(--text)] leading-relaxed">
          {renderRichText ? renderRichText(body) : body}
        </div>
      )}
    </div>
  );
};

/* --- SUBJECT-SPECIFIC WIDGETS (Task 2.5) --- */

const AlgorithmTraceTable: React.FC<{ stepsRaw: string; initVars: string }> = ({ stepsRaw, initVars }) => {
  const rows = stepsRaw
    .split('|')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const idx = r.indexOf(':');
      return idx > 0 ? { op: r.slice(0, idx).trim(), state: r.slice(idx + 1).trim() } : { op: r, state: '' };
    });

  return (
    <div className="surface-subtle rounded-[var(--radius-sm)] border border-[var(--border)] overflow-x-auto my-1.5">
      <div className="px-3 py-1.5 border-b border-[var(--border)] text-[11px] font-extrabold text-[var(--primary-dark)]">
        💻 Трасування алгоритму {initVars ? `· Старт: ${initVars}` : ''}
      </div>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-left">
            <th className="px-2.5 py-1">#</th>
            <th className="px-2.5 py-1">Команда</th>
            <th className="px-2.5 py-1">Змінні</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
              <td className="px-2.5 py-1 text-[var(--text-muted)]">{i + 1}</td>
              <td className="px-2.5 py-1 font-bold text-[var(--text)]">{r.op}</td>
              <td className="px-2.5 py-1 text-[var(--primary-dark)]">{r.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const BinaryBitsWidget: React.FC<{
  initialValue: number;
  interactive?: boolean;
  overrideValue?: number;
  onChangeValue?: (val: number) => void;
}> = ({ initialValue, interactive, overrideValue, onChangeValue }) => {
  const value = Math.max(0, Math.min(255, Math.round(overrideValue ?? initialValue)));
  const bits = Array.from({ length: 8 }).map((_, idx) => {
    const power = 7 - idx;
    return (value >> power) & 1;
  });

  const handleToggleBit = (bitIndexFromLeft: number) => {
    if (!interactive || !onChangeValue) return;
    const power = 7 - bitIndexFromLeft;
    const next = value ^ (1 << power);
    onChangeValue(next);
  };

  return (
    <div className="surface-subtle rounded-[var(--radius-sm)] border border-[var(--border)] p-3 my-1.5 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span>🔢 8-бітне подання</span>
        <span className="font-mono font-extrabold text-[var(--primary-dark)] tabular-nums">
          {value}₁₀ = {bits.join('')}₂
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {bits.map((b, idx) => {
          const weight = 1 << (7 - idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={!interactive}
              onClick={() => handleToggleBit(idx)}
              className={`rounded border py-1 text-center font-mono text-xs font-extrabold transition-colors ${
                b === 1
                  ? 'bg-[var(--hl-bg)] border-[var(--accent)] text-[var(--hl-text)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
              } ${interactive ? 'cursor-pointer hover:border-[var(--accent)]' : 'cursor-default'}`}
              title={`Розряд ${weight}`}
            >
              <div>{b}</div>
              <div className="text-[9px] font-normal">{weight}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CircuitSvg: React.FC<{ voltage: number; resistance: number; closed: boolean }> = ({
  voltage,
  resistance,
  closed,
}) => {
  const ids = useWidgetHatchIds();
  const current = closed && resistance > 0 ? Number((voltage / resistance).toFixed(2)) : 0;

  return (
    <svg viewBox="0 0 320 122" className="block mx-auto w-full max-w-[340px] h-auto" role="img" aria-label="Схема електричного кола">
      <SvgHatchDefs ids={ids} />
      {/* Loop wires */}
      <path d="M 48 34 L 130 34" fill="none" stroke="var(--text)" strokeWidth="2.2" />
      <path d="M 180 34 L 272 34 L 272 90 L 192 90" fill="none" stroke="var(--text)" strokeWidth="2.2" />
      <path d="M 128 90 L 48 90 L 48 68" fill="none" stroke="var(--text)" strokeWidth="2.2" />
      <path d="M 48 52 L 48 34" fill="none" stroke="var(--text)" strokeWidth="2.2" />

      {/* Battery (left) */}
      <line x1="36" y1="52" x2="60" y2="52" stroke="var(--accent)" strokeWidth="3" />
      <line x1="41" y1="68" x2="55" y2="68" stroke="var(--text)" strokeWidth="2.4" />
      <text
        x="30"
        y="64"
        textAnchor="end"
        fontSize="10.5"
        fontWeight="800"
        fill="var(--primary-dark)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {voltage}В
      </text>

      {/* Switch (top) */}
      <circle cx="130" cy="34" r="3.5" fill="var(--accent)" />
      <circle cx="180" cy="34" r="3.5" fill="var(--accent)" />
      <line
        x1="130"
        y1="34"
        x2={closed ? 180 : 172}
        y2={closed ? 34 : 16}
        stroke="var(--accent)"
        strokeWidth="2.6"
      />
      <text x="155" y="17" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--text-muted)">
        {closed ? 'Ключ замкнуто' : 'Ключ розімкнуто'}
      </text>

      {/* Lamp / Resistor (bottom) with high-contrast label backing inside hatched body */}
      <rect
        x="128"
        y="76"
        width="64"
        height="28"
        rx="6"
        fill={closed ? `url(#${ids.diagA})` : 'var(--surface-alt)'}
        stroke={closed ? 'var(--accent)' : 'var(--border-hover)'}
        strokeWidth="2"
      />
      <rect
        x="135"
        y="81"
        width="50"
        height="18"
        rx="4"
        fill="var(--surface)"
        fillOpacity="0.94"
      />
      <text
        x="160"
        y="94"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="800"
        fill="var(--text)"
        className="svg-hatch-label"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {resistance} Ом
      </text>

      <text
        x="272"
        y="22"
        textAnchor="end"
        fontSize="11"
        fontWeight="800"
        fill={closed ? 'var(--ok-text)' : 'var(--text-muted)'}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        I = {current} А
      </text>
    </svg>
  );
};

const CycleDiagramSvg: React.FC<{ nodes: string[]; title?: string }> = ({ nodes, title }) => {
  const safeNodes = nodes.slice(0, 4);
  const coords = [
    { x: 160, y: 24 },
    { x: 256, y: 68 },
    { x: 160, y: 112 },
    { x: 64, y: 68 },
  ];
  return (
    <svg viewBox="0 0 320 136" className="w-full max-w-[340px] h-auto" role="img" aria-label={title || 'Природний цикл'}>
      <ellipse cx="160" cy="68" rx="92" ry="42" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 3" />
      {safeNodes.map((n, idx) => {
        const c = coords[idx % coords.length];
        return (
          <g key={idx}>
            <rect x={c.x - 46} y={c.y - 13} width="92" height="26" rx="13" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.6" />
            <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--text)">
              {n.slice(0, 15)}
            </text>
          </g>
        );
      })}
      {title && (
        <text x="160" y="72" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--text-muted)">
          {title}
        </text>
      )}
    </svg>
  );
};

const AtomShellSvg: React.FC<{ element: string; protons: number; shells: number[] }> = ({
  element,
  protons,
  shells,
}) => (
  <svg viewBox="0 0 220 132" className="w-full max-w-[230px] h-auto" role="img" aria-label={`Модель атома ${element}`}>
    <circle cx="80" cy="66" r="14" fill="var(--hl-bg)" stroke="var(--accent)" strokeWidth="2" />
    <text x="80" y="70" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--hl-text)">
      +{protons}
    </text>
    {shells.slice(0, 3).map((eCount, idx) => {
      const r = 28 + idx * 16;
      return (
        <g key={idx}>
          <circle cx="80" cy="66" r={r} fill="none" stroke="var(--border-hover)" strokeWidth="1.3" strokeDasharray="3 2" />
          {Array.from({ length: Math.min(8, eCount) }).map((__, ei) => {
            const ang = (ei / Math.min(8, eCount)) * Math.PI * 2;
            return (
              <circle
                key={ei}
                cx={80 + r * Math.cos(ang)}
                cy={66 + r * Math.sin(ang)}
                r="3.2"
                fill="var(--accent)"
              />
            );
          })}
        </g>
      );
    })}
    <text x="152" y="60" fontSize="13" fontWeight="800" fill="var(--primary-dark)">
      {element}
    </text>
    <text x="152" y="78" fontSize="10" fontWeight="700" fill="var(--text-muted)">
      e⁻: {shells.join(' | ')}
    </text>
  </svg>
);

const MorphemeBuilder: React.FC<{ partsRaw: string }> = ({ partsRaw }) => {
  const chunks = partsRaw
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const idx = p.indexOf(':');
      if (idx > 0) {
        return { kind: p.slice(0, idx).trim(), text: p.slice(idx + 1).trim() };
      }
      return { kind: 'root', text: p };
    });

  return (
    <div className="inline-flex flex-wrap items-end gap-1 surface-subtle px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] my-1">
      {chunks.map((c, idx) => (
        <span key={idx} className={`morpheme-chip morpheme-${c.kind}`} title={c.kind}>
          {c.text}
        </span>
      ))}
    </div>
  );
};

const MusicRhythmInlineWidget: React.FC<{ patternRaw: string; bpm: number }> = ({
  patternRaw,
  bpm,
}) => {
  const hatchIds = useWidgetHatchIds();
  const pattern = patternRaw
    .split('|')
    .map((n) => Math.max(0, Math.min(3, Number(n) || 0)))
    .slice(0, 8);
  const safeBpm = Math.max(40, Math.min(180, Number(bpm) || 96));
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const stopPlayback = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    musicalSynth.stopGroup('percussion');
    setIsPlaying(false);
    setActiveBeat(null);
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      musicalSynth.stopGroup('percussion');
    };
  }, [patternRaw, safeBpm]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    stopPlayback();
    musicalSynth.setVolume(soundEngine.getVolume());
    musicalSynth.setMuted(soundEngine.getIsMuted());
    const beatSec = 60 / safeBpm;
    let cursorMs = 0;
    setIsPlaying(true);

    pattern.forEach((level, idx) => {
      const kind = level === 2 ? 'strong' : level === 3 ? 'sub' : level === 1 ? 'weak' : 'rest';
      const durMult = level === 3 ? 0.5 : 1;
      musicalSynth.schedulePercussion(kind, cursorMs / 1000);
      const beatStart = cursorMs;
      const t = setTimeout(() => setActiveBeat(idx), beatStart + 20);
      timersRef.current.push(t);
      cursorMs += Math.round(beatSec * durMult * 1000);
    });

    const endT = setTimeout(() => {
      setIsPlaying(false);
      setActiveBeat(null);
    }, cursorMs + 120);
    timersRef.current.push(endT);
  };

  const barW = 280;
  const cellW = barW / Math.max(1, pattern.length);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <svg viewBox="0 0 320 96" className="w-full max-w-[360px] h-auto" role="img" aria-label="Схема музичного такту">
        <SvgHatchDefs ids={hatchIds} />
        <rect x="18" y="14" width={barW} height="56" rx="8" fill="var(--surface-alt)" stroke="var(--border)" strokeWidth="1.5" />
        {pattern.map((level, idx) => {
          const x = 18 + idx * cellW;
          const cx = x + cellW / 2;
          const h = level === 2 ? 34 : level === 1 ? 22 : level === 3 ? 14 : 5;
          const isBeatActive = activeBeat === idx;
          const labelText =
            level === 2 ? '> ♩ ТУК' : level === 3 ? '♪ 1/8' : level === 1 ? '♩ ТА' : '𝄽';
          return (
            <g key={idx}>
              {idx > 0 && <line x1={x} y1="14" x2={x} y2="70" stroke="var(--border)" strokeDasharray="3 3" />}
              {isBeatActive && (
                <rect
                  x={x + 2}
                  y="16"
                  width={Math.max(8, cellW - 4)}
                  height="52"
                  rx="6"
                  fill="var(--hl-bg)"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                />
              )}
              <rect
                x={cx - 10}
                y={62 - h}
                width="20"
                height={h}
                rx="4"
                fill={
                  level === 2
                    ? `url(#${hatchIds.diagA})`
                    : level === 1 || level === 3
                    ? `url(#${hatchIds.dots})`
                    : 'var(--border)'
                }
                stroke={level > 0 ? 'var(--accent)' : 'none'}
                strokeWidth={level > 0 ? '1.2' : '0'}
              />
              <text x={cx} y="84" textAnchor="middle" fontSize="9" fontWeight="800" fill={isBeatActive ? 'var(--accent)' : 'var(--text)'}>
                {labelText}
              </text>
            </g>
          );
        })}
        <text x="160" y="10" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          Темп: ♩ = {safeBpm} BPM · Долей: {pattern.length}
        </text>
      </svg>
      <button
        type="button"
        onClick={handleTogglePlay}
        className="min-w-[8.5rem] px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] hover:border-[var(--accent)] text-xs font-extrabold text-[var(--primary-dark)] cursor-pointer transition-colors"
      >
        {isPlaying ? '⏹ Зупинити' : '🔊 Послухати такт'}
      </button>
    </div>
  );
};

const ProtocolStepsCard: React.FC<{ title: string; stepsRaw: string }> = ({ title, stepsRaw }) => {
  const steps = stepsRaw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="surface-subtle rounded-[var(--radius-sm)] border border-[var(--border)] p-3 my-1.5 space-y-2 w-full">
      <div className="text-xs font-extrabold text-[var(--primary-dark)] flex items-center gap-1.5">
        <span aria-hidden="true">🛡️</span>
        <span>{title}</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((step, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text)]"
          >
            <span className="w-5 h-5 rounded-full bg-[var(--hl-bg)] border border-[var(--accent)] text-[var(--hl-text)] font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">
              {idx + 1}
            </span>
            <span className="min-w-0 break-words leading-snug">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export const HUMANITIES_AND_SUBJECT_WIDGETS: Record<string, WidgetDefinition> = {
  timeline: {
    type: 'timeline',
    label: 'Хронологічна стрічка',
    category: 'humanities',
    render: (args) => (
      <TimelineSvg eventsRaw={strArg(args, ['events', 'items'], '1556:Січ|1648:Гетьманщина|1991:Незалежність', 0)} />
    ),
  },
  venn: {
    type: 'venn',
    label: 'Діаграма Ейлера-Венна',
    category: 'humanities',
    render: (args) => (
      <VennSvg
        a={strArg(args, ['a'], 'Множина A', 0)}
        b={strArg(args, ['b'], 'Множина B', 1)}
        both={strArg(args, ['both', 'intersection'], 'A ∩ B', 2)}
        c={args.params.c}
      />
    ),
  },
  tree: {
    type: 'tree',
    label: 'Ієрархічне дерево',
    category: 'humanities',
    render: (args) => (
      <TreeSvg
        root={strArg(args, ['root'], 'Поняття', 0)}
        children={strArg(args, ['children', 'nodes'], 'Гілка 1|Гілка 2|Гілка 3', 1).split('|')}
      />
    ),
  },
  flow: {
    type: 'flow',
    label: 'Причинно-наслідковий ланцюг',
    category: 'humanities',
    render: (args) => (
      <FlowChain steps={strArg(args, ['steps', 'items'], 'Причина|Дія|Наслідок', 0).split(/->|\|/)} />
    ),
  },
  deep_dive: {
    type: 'deep_dive',
    label: 'Блок поглиблення',
    category: 'humanities',
    render: (args, _ov, opts) => (
      <DeepDiveCard
        title={strArg(args, ['title', 't'], 'Детальніше про поняття', 0)}
        body={strArg(args, ['body', 'text'], '', 1)}
        renderRichText={opts?.renderRichText}
      />
    ),
  },
  protocol_steps: {
    type: 'protocol_steps',
    label: 'Протокол дій (безпека / алгоритм)',
    category: 'subject',
    render: (args) => (
      <ProtocolStepsCard
        title={strArg(args, ['title', 't'], 'Порядок дій у ситуації', 0)}
        stepsRaw={strArg(args, ['steps', 'items'], 'Зупинитись і перевірити|Зберегти докази|Повідомити дорослих', 1)}
      />
    ),
  },
  algorithm_trace: {
    type: 'algorithm_trace',
    label: 'Трасування алгоритму',
    category: 'subject',
    render: (args) => (
      <AlgorithmTraceTable
        initVars={strArg(args, ['vars', 'init'], '')}
        stepsRaw={strArg(args, ['steps'], 'x = x + 2:x = 3|y = x * 2:y = 6', 0)}
      />
    ),
  },
  binary_bits: {
    type: 'binary_bits',
    label: 'Двійковий 8-бітний регістр',
    category: 'subject',
    render: (args, ov, opts) => {
      const bitsStr = args.params.bits;
      const initial = bitsStr ? parseInt(bitsStr, 2) || 0 : numArg(args, {}, ['value', 'val', 'n'], 10, 0);
      return (
        <BinaryBitsWidget
          initialValue={initial}
          interactive={opts?.interactive}
          overrideValue={ov.value}
          onChangeValue={(v) => opts?.onToggleOverride?.('value', v)}
        />
      );
    },
    getSliders: (args) => {
      const bitsStr = args.params.bits;
      const initial = bitsStr ? parseInt(bitsStr, 2) || 0 : numArg(args, {}, ['value', 'val', 'n'], 10, 0);
      return [{ key: 'value', label: 'Десяткове значення', min: 0, max: 255, step: 1, defaultValue: initial }];
    },
  },
  circuit: {
    type: 'circuit',
    label: 'Електричне коло',
    category: 'subject',
    render: (args, ov) => (
      <CircuitSvg
        voltage={numArg(args, ov, ['voltage', 'u', 'v'], 6, 0)}
        resistance={Math.max(1, numArg(args, ov, ['resistance', 'r'], 3, 1))}
        closed={numArg(args, ov, ['closed'], 1, 2) !== 0}
      />
    ),
    getSliders: (args) => [
      { key: 'voltage', label: 'Напруга (U)', unit: 'В', min: 1, max: 24, step: 1, defaultValue: numArg(args, {}, ['voltage', 'u', 'v'], 6, 0) },
      { key: 'resistance', label: 'Опір (R)', unit: 'Ом', min: 1, max: 20, step: 1, defaultValue: Math.max(1, numArg(args, {}, ['resistance', 'r'], 3, 1)) },
      { key: 'closed', label: 'Ключ (0=викл, 1=увімк)', min: 0, max: 1, step: 1, defaultValue: numArg(args, {}, ['closed'], 1, 2) !== 0 ? 1 : 0 },
    ],
    getLiveSummary: (args, ov) => {
      const u = numArg(args, ov, ['voltage', 'u', 'v'], 6, 0);
      const r = Math.max(1, numArg(args, ov, ['resistance', 'r'], 3, 1));
      const closed = numArg(args, ov, ['closed'], 1, 2) !== 0;
      return closed
        ? `За законом Ома I = U / R = ${u} / ${r} = ${(u / r).toFixed(2)} А`
        : 'Коло розімкнуте: струм відсутній (I = 0 А)';
    },
  },
  cycle_diagram: {
    type: 'cycle_diagram',
    label: 'Замкнутий цикл',
    category: 'subject',
    render: (args) => (
      <CycleDiagramSvg
        nodes={strArg(args, ['nodes', 'items'], 'Випаровування|Конденсація|Опади|Стік', 0).split('|')}
        title={args.params.title}
      />
    ),
  },
  atom_shell: {
    type: 'atom_shell',
    label: 'Модель атома',
    category: 'subject',
    render: (args, ov) => (
      <AtomShellSvg
        element={strArg(args, ['element', 'el'], 'Карбон (C)', 0)}
        protons={numArg(args, ov, ['protons', 'p'], 6, 1)}
        shells={strArg(args, ['electrons', 'shells'], '2|4').split('|').map((n) => Math.max(1, Number(n) || 1))}
      />
    ),
  },
  morpheme_builder: {
    type: 'morpheme_builder',
    label: 'Морфемний розбір слова',
    category: 'subject',
    render: (args) => (
      <MorphemeBuilder
        partsRaw={strArg(args, ['parts'], 'prefix:при|root:кордон|suffix:н|ending:ий', 0)}
      />
    ),
  },
  music_rhythm: {
    type: 'music_rhythm',
    label: 'Схема музичного ритму і такту',
    category: 'subject',
    render: (args, ov) => {
      const patternRaw = strArg(args, ['pattern'], '2|1|0|1', 0);
      const bpm = numArg(args, ov, ['bpm', 'tempo'], 96, 1);
      return <MusicRhythmInlineWidget patternRaw={patternRaw} bpm={bpm} />;
    },
    getSliders: (args) => [
      { key: 'bpm', label: 'Темп (уд/хв)', unit: 'bpm', min: 60, max: 140, step: 4, defaultValue: numArg(args, {}, ['bpm', 'tempo'], 96, 1) },
    ],
    getLiveSummary: (args, ov) => {
      const bpm = numArg(args, ov, ['bpm', 'tempo'], 96, 1);
      const secPerBeat = (60 / Math.max(40, bpm)).toFixed(2);
      return `За темпу ${bpm} уд/хв кожна доля звучить приблизно ${secPerBeat} с (${bpm < 80 ? 'повільний ларго/адажіо' : bpm <= 112 ? 'помірний анданте/модерато' : 'жвавий алегро'}).`;
    },
  },
  perspective_guide: {
    type: 'perspective_guide',
    label: 'Схема лінійної перспективи',
    category: 'subject',
    render: (args, ov) => {
      const hPct = Math.max(20, Math.min(80, numArg(args, ov, ['horizon', 'h'], 40, 0)));
      const vPct = Math.max(15, Math.min(85, numArg(args, ov, ['vanishing', 'f', 'v'], 50, 1)));
      const hY = (hPct / 100) * 105;
      const vX = (vPct / 100) * 300;
      return (
        <svg viewBox="0 0 300 118" className="w-full max-w-[350px] h-auto" role="img" aria-label="Схема лінійної перспективи">
          <rect x="8" y="8" width="284" height="96" rx="8" fill="var(--surface-alt)" stroke="var(--border)" strokeWidth="1.5" />
          <polygon points={`${vX},${hY} 54,104 246,104`} fill="var(--surface)" stroke="var(--border-hover)" strokeWidth="1.5" />
          <line x1="8" y1={hY} x2="292" y2={hY} stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="5 3" />
          <line x1="16" y1="14" x2={vX} y2={hY} stroke="var(--hl-border)" strokeWidth="1.1" strokeDasharray="3 3" />
          <line x1="284" y1="14" x2={vX} y2={hY} stroke="var(--hl-border)" strokeWidth="1.1" strokeDasharray="3 3" />
          <circle cx={vX} cy={hY} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
          <text x={vX} y={Math.max(18, hY - 8)} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--primary-dark)" style={{ fontVariantNumeric: 'tabular-nums' }}>
            Горизонт {hPct}% · Точка сходу F ({vPct}%)
          </text>
        </svg>
      );
    },
    getSliders: (args) => [
      { key: 'horizon', label: 'Горизонт', unit: '%', min: 20, max: 80, step: 2, defaultValue: numArg(args, {}, ['horizon', 'h'], 40, 0) },
      { key: 'vanishing', label: 'Точка сходу F', unit: '%', min: 15, max: 85, step: 5, defaultValue: numArg(args, {}, ['vanishing', 'f', 'v'], 50, 1) },
    ],
    getLiveSummary: (args, ov) => {
      const hPct = numArg(args, ov, ['horizon', 'h'], 40, 0);
      return hPct <= 35
        ? 'Висока лінія горизонту створює панорамний «погляд з висоти пташиного польоту».'
        : hPct >= 65
        ? 'Низька лінія горизонту підкреслює висоту неба й монументальність об’єктів.'
        : 'Середня лінія горизонту відповідає природному рівню очей глядача.';
    },
  },
};
