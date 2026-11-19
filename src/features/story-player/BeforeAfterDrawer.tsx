import React, { useState } from 'react';

export interface BeforeAfterPair {
  title?: string;
  beforeLabel: string;
  afterLabel: string;
  beforeText?: string;
  afterText?: string;
  beforeMeta?: string;
  afterMeta?: string;
}

interface BeforeAfterDrawerProps {
  pair: BeforeAfterPair;
  renderRichText?: (text: string) => React.ReactNode;
}

export const BeforeAfterDrawer: React.FC<BeforeAfterDrawerProps> = ({
  pair,
  renderRichText,
}) => {
  const [splitPercent, setSplitPercent] = useState<number>(50);

  const renderBody = (txt?: string) => {
    if (!txt) return <span className="text-[var(--text-muted)]">—</span>;
    return renderRichText ? renderRichText(txt) : txt;
  };

  return (
    <div className="w-full space-y-2.5 text-left" role="region" aria-label={pair.title || 'Порівняння До і Після'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-[var(--primary-dark)]">
          {pair.title || 'Порівняння станів: До та Після'}
        </span>

        <div className="inline-flex flex-wrap max-w-full items-center gap-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setSplitPercent(100)}
            className={`px-2 py-0.5 rounded-[var(--radius-sm)] border cursor-pointer transition-colors ${
              splitPercent >= 85
                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            До
          </button>
          <button
            type="button"
            onClick={() => setSplitPercent(50)}
            className={`px-2 py-0.5 rounded-[var(--radius-sm)] border cursor-pointer transition-colors ${
              splitPercent > 15 && splitPercent < 85
                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            50 / 50
          </button>
          <button
            type="button"
            onClick={() => setSplitPercent(0)}
            className={`px-2 py-0.5 rounded-[var(--radius-sm)] border cursor-pointer transition-colors ${
              splitPercent <= 15
                ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            Після
          </button>
        </div>
      </div>

      {/* Interactive Curtain Split Viewport */}
      <div className="relative rounded-[var(--radius-sm)] border border-[var(--border-hover)] bg-[var(--surface)] overflow-hidden min-h-[124px]">
        {/* AFTER layer (Base Layer) */}
        <div className="p-3.5 sm:p-4 bg-[var(--ok-bg)] text-[var(--ok-text)] min-h-[124px] flex flex-col justify-between gap-2">
          <div className="flex items-center justify-end gap-2">
            {pair.afterMeta && (
              <span className="text-[10px] font-mono opacity-80">{pair.afterMeta}</span>
            )}
            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--ok-border)] text-[var(--ok-text)] text-[10px] font-extrabold uppercase tracking-wide">
              {pair.afterLabel}
            </span>
          </div>
          <div className="text-xs sm:text-sm font-bold leading-relaxed pl-2">
            {renderBody(pair.afterText)}
          </div>
        </div>

        {/* BEFORE layer (Clipped Curtain Overlay) */}
        <div
          className="absolute inset-0 p-3.5 sm:p-4 bg-[var(--surface-alt)] text-[var(--text)] flex flex-col justify-between gap-2 pointer-events-none"
          style={{
            clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
          }}
        >
          <div className="flex items-center justify-start gap-2">
            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border-hover)] text-[var(--primary-dark)] text-[10px] font-extrabold uppercase tracking-wide">
              {pair.beforeLabel}
            </span>
            {pair.beforeMeta && (
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{pair.beforeMeta}</span>
            )}
          </div>
          <div className="text-xs sm:text-sm font-semibold leading-relaxed pr-2">
            {renderBody(pair.beforeText)}
          </div>
        </div>

        {/* Vertical Curtain Divider Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--accent)] pointer-events-none"
          style={{ left: `${splitPercent}%` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--accent-text)] border-2 border-[var(--surface)] shadow-sm flex items-center justify-center text-[10px] font-extrabold">
            ⇆
          </div>
        </div>
      </div>

      {/* Accessible Slider */}
      <label className="block space-y-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] tabular-nums">
          <span>{pair.beforeLabel}</span>
          <span>Шторка: {splitPercent}%</span>
          <span>{pair.afterLabel}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={splitPercent}
          onChange={(e) => setSplitPercent(Number(e.target.value))}
          className="settings-range"
          aria-label={`Повзунок порівняння ${pair.beforeLabel} та ${pair.afterLabel}`}
        />
      </label>

      {/* Readable Side-by-Side Summary Cards (especially clear on narrow screens & print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
        <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)]">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--text-muted)] mb-1">
            {pair.beforeLabel}
          </div>
          <div className="font-semibold text-[var(--text)] leading-snug">
            {renderBody(pair.beforeText)}
          </div>
        </div>
        <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--ok-bg)] border border-[var(--ok-border)] text-[var(--ok-text)]">
          <div className="text-[10px] font-extrabold uppercase tracking-wide mb-1">
            {pair.afterLabel}
          </div>
          <div className="font-bold leading-snug">
            {renderBody(pair.afterText)}
          </div>
        </div>
      </div>
    </div>
  );
};
