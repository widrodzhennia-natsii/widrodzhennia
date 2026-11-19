export interface LiveThemePalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderHover: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentText: string;
  hlBg: string;
  hlBorder: string;
  hlText: string;
  okBg: string;
  okBorder: string;
  okText: string;
  warnBg: string;
  warnBorder: string;
  warnText: string;
  errBg: string;
  errBorder: string;
  errText: string;
  primaryDark: string;
  isMono: boolean;
  isDark: boolean;
}

const readVar = (style: CSSStyleDeclaration | null, name: string, fallback: string): string => {
  if (!style) return fallback;
  const val = style.getPropertyValue(name).trim();
  return val || fallback;
};

export const readThemeColors = (): LiveThemePalette => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      bg: '#efe9dc',
      surface: '#faf7f0',
      surfaceAlt: '#e6dfd0',
      border: '#cfc4ae',
      borderHover: '#a99b80',
      text: '#2a2118',
      textMuted: '#655746',
      accent: '#8c4a1c',
      accentHover: '#703913',
      accentText: '#faf7f0',
      hlBg: '#fbf1da',
      hlBorder: '#b87324',
      hlText: '#6e3b10',
      okBg: '#e7f2e8',
      okBorder: '#2e7346',
      okText: '#1d512f',
      warnBg: '#fbf0d9',
      warnBorder: '#c98b34',
      warnText: '#66420e',
      errBg: '#fae9e7',
      errBorder: '#cc6d67',
      errText: '#7d1f1a',
      primaryDark: '#572b0c',
      isMono: false,
      isDark: false,
    };
  }

  const target = document.body || document.documentElement;
  const style = window.getComputedStyle(target);
  const className = document.body?.className || '';
  const dataTheme = document.documentElement?.getAttribute('data-theme') || '';
  const isMono = className.includes('theme-mono') || dataTheme.startsWith('mono-');
  const isDark =
    document.documentElement.classList.contains('dark') ||
    dataTheme === 'focus' ||
    dataTheme === 'cozy' ||
    dataTheme === 'mono-dark';

  return {
    bg: readVar(style, '--bg', '#efe9dc'),
    surface: readVar(style, '--surface', '#faf7f0'),
    surfaceAlt: readVar(style, '--surface-alt', '#e6dfd0'),
    border: readVar(style, '--border', '#cfc4ae'),
    borderHover: readVar(style, '--border-hover', '#a99b80'),
    text: readVar(style, '--text', '#2a2118'),
    textMuted: readVar(style, '--text-muted', '#655746'),
    accent: readVar(style, '--accent', '#8c4a1c'),
    accentHover: readVar(style, '--accent-hover', '#703913'),
    accentText: readVar(style, '--accent-text', '#faf7f0'),
    hlBg: readVar(style, '--hl-bg', '#fbf1da'),
    hlBorder: readVar(style, '--hl-border', '#b87324'),
    hlText: readVar(style, '--hl-text', '#6e3b10'),
    okBg: readVar(style, '--ok-bg', '#e7f2e8'),
    okBorder: readVar(style, '--ok-border', '#2e7346'),
    okText: readVar(style, '--ok-text', '#1d512f'),
    warnBg: readVar(style, '--warn-bg', '#fbf0d9'),
    warnBorder: readVar(style, '--warn-border', '#c98b34'),
    warnText: readVar(style, '--warn-text', '#66420e'),
    errBg: readVar(style, '--err-bg', '#fae9e7'),
    errBorder: readVar(style, '--err-border', '#cc6d67'),
    errText: readVar(style, '--err-text', '#7d1f1a'),
    primaryDark: readVar(style, '--primary-dark', '#572b0c'),
    isMono,
    isDark,
  };
};

export const createCanvasHatchPattern = (
  ctx: CanvasRenderingContext2D,
  strokeColor: string,
  fillColor?: string,
  spacing = 8,
  lineWidth = 2
): CanvasPattern | string => {
  if (typeof document === 'undefined') return strokeColor;
  const tile = document.createElement('canvas');
  tile.width = spacing;
  tile.height = spacing;
  const tctx = tile.getContext('2d');
  if (!tctx) return strokeColor;

  if (fillColor) {
    tctx.fillStyle = fillColor;
    tctx.fillRect(0, 0, spacing, spacing);
  }

  tctx.strokeStyle = strokeColor;
  tctx.lineWidth = lineWidth;
  tctx.beginPath();
  tctx.moveTo(0, spacing);
  tctx.lineTo(spacing, 0);
  tctx.moveTo(-spacing / 2, spacing / 2);
  tctx.lineTo(spacing / 2, -spacing / 2);
  tctx.moveTo(spacing / 2, spacing * 1.5);
  tctx.lineTo(spacing * 1.5, spacing / 2);
  tctx.stroke();

  return ctx.createPattern(tile, 'repeat') || strokeColor;
};
