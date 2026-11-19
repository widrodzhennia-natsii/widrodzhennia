import { create } from 'zustand';

const GATE_CONFIG_STORAGE_KEY = 'nush_author_gate_cfg_v1';

export type AuthorGateMode = 'math' | 'pin';

interface AuthorGateConfig {
  gateMode: AuthorGateMode;
  pinCode: string; // 4-digit PIN when gateMode === 'pin'
}

const DEFAULT_CONFIG: AuthorGateConfig = {
  gateMode: 'math',
  pinCode: '2025',
};

const loadConfig = (): AuthorGateConfig => {
  if (typeof localStorage === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(GATE_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      gateMode: parsed.gateMode === 'pin' ? 'pin' : 'math',
      pinCode: /^\d{4}$/.test(String(parsed.pinCode || '')) ? String(parsed.pinCode) : '2025',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

const persistConfig = (cfg: AuthorGateConfig) => {
  try {
    localStorage.setItem(GATE_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
};

interface AuthorGateState extends AuthorGateConfig {
  isAuthorUnlocked: boolean;
  isGateModalOpen: boolean;
  onUnlockCallback: (() => void) | null;
  requestAuthorAccess: (onUnlocked: () => void) => void;
  closeGateModal: () => void;
  unlockAuthorSession: () => void;
  lockAuthorSession: () => void;
  setGateConfig: (mode: AuthorGateMode, pinCode?: string) => void;
}

const initial = loadConfig();

export const useAuthorGateStore = create<AuthorGateState>((set, get) => ({
  gateMode: initial.gateMode,
  pinCode: initial.pinCode,
  isAuthorUnlocked: false,
  isGateModalOpen: false,
  onUnlockCallback: null,

  requestAuthorAccess: (onUnlocked) => {
    if (get().isAuthorUnlocked) {
      onUnlocked();
      return;
    }
    set({
      isGateModalOpen: true,
      onUnlockCallback: onUnlocked,
    });
  },

  closeGateModal: () => set({ isGateModalOpen: false, onUnlockCallback: null }),

  unlockAuthorSession: () => {
    const cb = get().onUnlockCallback;
    set({
      isAuthorUnlocked: true,
      isGateModalOpen: false,
      onUnlockCallback: null,
    });
    cb?.();
  },

  lockAuthorSession: () => set({ isAuthorUnlocked: false }),

  setGateConfig: (gateMode, pinCode) => {
    const safePin =
      pinCode && /^\d{4}$/.test(pinCode) ? pinCode : get().pinCode || '2025';
    const next = { gateMode, pinCode: safePin };
    persistConfig(next);
    set(next);
  },
}));
