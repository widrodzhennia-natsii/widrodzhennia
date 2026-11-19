import React, { useEffect, useRef, useState } from 'react';
import { THEME_OPTIONS, ThemeMode, useThemeStore } from '../../core/state/useThemeStore';

const THEME_GLYPHS: Record<ThemeMode, { icon: string; short: string }> = {
  cream: { icon: '☀', short: 'Крем' },
  sage: { icon: '🌿', short: 'Шавлія' },
  nordic: { icon: '❄', short: 'Сканди' },
  lavender: { icon: '🪻', short: 'Лаванда' },
  focus: { icon: '🌙', short: 'Фокус' },
  cozy: { icon: '🕯', short: 'Затишок' },
  'mono-light': { icon: '◐', short: 'Ч/Б Світла' },
  'mono-dark': { icon: '◑', short: 'Ч/Б Темна' },
};

export const RadialThemeMenu: React.FC = () => {
  const { themeMode, setThemeMode } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const activeGlyph = THEME_GLYPHS[themeMode] || THEME_GLYPHS.cream;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Швидкий вибір теми (8 палітр)"
        title="Палітра оформлення (8 тем)"
        className="btn btn-outline btn-sm radial-theme-trigger"
      >
        <span aria-hidden="true">{activeGlyph.icon}</span>
        <span className="hidden lg:inline">{activeGlyph.short}</span>
      </button>

      {isOpen && (
        <div
          className="radial-theme-popover"
          role="dialog"
          aria-label="Радіальне меню вибору палітри"
        >
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--border)]">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--primary-dark)]">
              🎨 Тема (8 палітр)
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)] px-1.5 py-0.5 cursor-pointer"
              aria-label="Закрити меню тем"
            >
              ✕
            </button>
          </div>

          <div className="radial-theme-ring" role="radiogroup" aria-label="Доступні теми">
            {THEME_OPTIONS.map((opt, idx) => {
              const glyph = THEME_GLYPHS[opt.id];
              const isSelected = themeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setThemeMode(opt.id);
                    setIsOpen(false);
                  }}
                  className={`radial-theme-petal ${
                    isSelected ? 'radial-theme-petal--active' : ''
                  }`}
                  data-ring-idx={idx}
                >
                  <span className="text-sm leading-none" aria-hidden="true">
                    {glyph.icon}
                  </span>
                  <span className="text-[11px] font-extrabold leading-tight truncate">
                    {glyph.short}
                  </span>
                  <span className="text-[9px] opacity-75 leading-none">
                    {opt.group === 'mono' ? '0% кольору' : opt.group === 'dark' ? 'Темна' : 'Світла'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
