import { create } from 'zustand';

export type ThemeMode =
  | 'cream'
  | 'sage'
  | 'nordic'
  | 'lavender'
  | 'focus'
  | 'cozy'
  | 'mono-light'
  | 'mono-dark';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  group: 'light' | 'dark' | 'mono';
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'cream', label: '📖 Тепла книга', group: 'light' },
  { id: 'sage', label: '🌿 Лісова шавлія', group: 'light' },
  { id: 'nordic', label: '❄️ Скандинавська', group: 'light' },
  { id: 'lavender', label: '🪻 М’яка лаванда', group: 'light' },
  { id: 'focus', label: '🌌 Фокус (Темна)', group: 'dark' },
  { id: 'cozy', label: '🏡 Затишок (Темна)', group: 'dark' },
  { id: 'mono-light', label: '📄 Ч/Б Папір E-Ink', group: 'mono' },
  { id: 'mono-dark', label: '🖤 Ч/Б Графіт OLED', group: 'mono' },
];

const THEME_STORAGE_KEY = 'nush_theme_v1';
const ALLOWED_THEMES = new Set<ThemeMode>(THEME_OPTIONS.map((t) => t.id));
const DARK_THEMES = new Set<ThemeMode>(['focus', 'cozy', 'mono-dark']);

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'cream';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'paper') return 'cream';
    if (raw && ALLOWED_THEMES.has(raw as ThemeMode)) {
      return raw as ThemeMode;
    }
  } catch {
    // ignore storage errors
  }
  return 'cream';
};

export const applyThemeToDom = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.classList.toggle('dark', DARK_THEMES.has(mode));

  if (document.body) {
    const existingThemeClasses = Array.from(document.body.classList).filter((cls) =>
      cls.startsWith('theme-')
    );
    existingThemeClasses.forEach((cls) => document.body.classList.remove(cls));
    document.body.classList.add(`theme-${mode}`);
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
};

const initialTheme = getInitialTheme();
applyThemeToDom(initialTheme);

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeMode: initialTheme,

  setThemeMode: (mode: ThemeMode) => {
    const safeMode = ALLOWED_THEMES.has(mode) ? mode : 'cream';
    applyThemeToDom(safeMode);
    set({ themeMode: safeMode });
  },

  toggleTheme: () =>
    set((state) => {
      const idx = THEME_OPTIONS.findIndex((t) => t.id === state.themeMode);
      const nextMode = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length].id;
      applyThemeToDom(nextMode);
      return { themeMode: nextMode };
    }),
}));
