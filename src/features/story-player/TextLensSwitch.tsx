import React from 'react';

export type TextLensMode = 'all' | 'facts' | 'causes' | 'rules' | 'numbers';

interface TextLensSwitchProps {
  activeLens: TextLensMode;
  onChangeLens: (lens: TextLensMode) => void;
  compact?: boolean;
}

const LENS_OPTIONS: Array<{ id: TextLensMode; icon: string; label: string; hint: string }> = [
  { id: 'all', icon: '👁️', label: 'Усе', hint: 'Звичайний перегляд без акцентів' },
  { id: 'facts', icon: '📜', label: 'Факти', hint: 'Підсвітити дати, факти та тези' },
  { id: 'causes', icon: '🔗', label: 'Причини', hint: 'Підсвітити причинно-наслідкові зв’язки' },
  { id: 'rules', icon: '📐', label: 'Правила', hint: 'Підсвітити поняття, орфограми та формули' },
  { id: 'numbers', icon: '🔢', label: 'Числа', hint: 'Підсвітити ключові числа й одиниці' },
];

export const TextLensSwitch: React.FC<TextLensSwitchProps> = ({
  activeLens,
  onChangeLens,
  compact = false,
}) => {
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Лінзи читання тексту"
    >
      {!compact && (
        <span className="text-[11px] font-extrabold text-[var(--text-muted)] mr-1 whitespace-nowrap">
          🔍 Лінзи:
        </span>
      )}
      {LENS_OPTIONS.map((opt) => {
        const isActive = activeLens === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChangeLens(opt.id)}
            aria-pressed={isActive}
            title={opt.hint}
            className={`px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer inline-flex items-center gap-1 ${
              isActive
                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)] shadow-xs'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text)]'
            }`}
          >
            <span aria-hidden="true">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
