import { create } from 'zustand';
import { soundEngine } from '../../services/soundEngineService';
import { speechAudio } from '../audio/formant-synth';
import { musicalSynth } from '../audio/musical-synth';

const SETTINGS_STORAGE_KEY = 'nush_ui_settings_v1';

export interface UiSettingsData {
  typingSpeedMs: number;
  volume: number;
  captchaDurationSec: number;
  captchaErrorThreshold: number;
  captchaMaxCycles: number;
}

const DEFAULT_SETTINGS: UiSettingsData = {
  typingSpeedMs: 45,
  volume: 0.75,
  captchaDurationSec: 15,
  captchaErrorThreshold: 2,
  captchaMaxCycles: 2,
};

const clamp = (val: number, min: number, max: number, fallback: number): number => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const loadSettings = (): UiSettingsData => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      typingSpeedMs: clamp(parsed.typingSpeedMs, 20, 80, DEFAULT_SETTINGS.typingSpeedMs),
      volume: clamp(parsed.volume, 0, 1, DEFAULT_SETTINGS.volume),
      captchaDurationSec: clamp(parsed.captchaDurationSec, 5, 45, DEFAULT_SETTINGS.captchaDurationSec),
      captchaErrorThreshold: clamp(parsed.captchaErrorThreshold, 1, 5, DEFAULT_SETTINGS.captchaErrorThreshold),
      captchaMaxCycles: clamp(parsed.captchaMaxCycles, 1, 5, DEFAULT_SETTINGS.captchaMaxCycles),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const persistSettings = (next: UiSettingsData) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
};

const initial = loadSettings();
soundEngine.setVolume(initial.volume);
speechAudio.setVolume(initial.volume);
musicalSynth.setVolume(initial.volume);

interface SettingsStoreState extends UiSettingsData {
  setTypingSpeedMs: (ms: number) => void;
  setVolume: (vol: number) => void;
  setCaptchaDurationSec: (sec: number) => void;
  setCaptchaErrorThreshold: (count: number) => void;
  setCaptchaMaxCycles: (cycles: number) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  ...initial,

  setTypingSpeedMs: (ms: number) =>
    set((state) => {
      const next: UiSettingsData = {
        typingSpeedMs: clamp(ms, 20, 80, DEFAULT_SETTINGS.typingSpeedMs),
        volume: state.volume,
        captchaDurationSec: state.captchaDurationSec,
        captchaErrorThreshold: state.captchaErrorThreshold,
        captchaMaxCycles: state.captchaMaxCycles,
      };
      persistSettings(next);
      return next;
    }),

  setVolume: (vol: number) =>
    set((state) => {
      const safeVol = clamp(vol, 0, 1, DEFAULT_SETTINGS.volume);
      soundEngine.setVolume(safeVol);
      speechAudio.setVolume(safeVol);
      musicalSynth.setVolume(safeVol);
      const next: UiSettingsData = {
        typingSpeedMs: state.typingSpeedMs,
        volume: safeVol,
        captchaDurationSec: state.captchaDurationSec,
        captchaErrorThreshold: state.captchaErrorThreshold,
        captchaMaxCycles: state.captchaMaxCycles,
      };
      persistSettings(next);
      return next;
    }),

  setCaptchaDurationSec: (sec: number) =>
    set((state) => {
      const next: UiSettingsData = {
        typingSpeedMs: state.typingSpeedMs,
        volume: state.volume,
        captchaDurationSec: clamp(sec, 5, 45, DEFAULT_SETTINGS.captchaDurationSec),
        captchaErrorThreshold: state.captchaErrorThreshold,
        captchaMaxCycles: state.captchaMaxCycles,
      };
      persistSettings(next);
      return next;
    }),

  setCaptchaErrorThreshold: (count: number) =>
    set((state) => {
      const next: UiSettingsData = {
        typingSpeedMs: state.typingSpeedMs,
        volume: state.volume,
        captchaDurationSec: state.captchaDurationSec,
        captchaErrorThreshold: clamp(count, 1, 5, DEFAULT_SETTINGS.captchaErrorThreshold),
        captchaMaxCycles: state.captchaMaxCycles,
      };
      persistSettings(next);
      return next;
    }),

  setCaptchaMaxCycles: (cycles: number) =>
    set((state) => {
      const next: UiSettingsData = {
        typingSpeedMs: state.typingSpeedMs,
        volume: state.volume,
        captchaDurationSec: state.captchaDurationSec,
        captchaErrorThreshold: state.captchaErrorThreshold,
        captchaMaxCycles: clamp(cycles, 1, 5, DEFAULT_SETTINGS.captchaMaxCycles),
      };
      persistSettings(next);
      return next;
    }),

  resetSettings: () => {
    soundEngine.setVolume(DEFAULT_SETTINGS.volume);
    speechAudio.setVolume(DEFAULT_SETTINGS.volume);
    musicalSynth.setVolume(DEFAULT_SETTINGS.volume);
    persistSettings(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));
