import { create } from 'zustand';

export type DensityPreference = 'auto' | 'slides' | 'cascade' | 'document';
export type ResolvedDensityMode = 'slides' | 'cascade' | 'document';

const LAYOUT_PREFS_STORAGE_KEY = 'nush_layout_prefs_v1';

interface PersistedLayoutPrefs {
  densityMode: DensityPreference;
  isDocumentExpanded: boolean;
  prolongedAnimations: boolean;
  autoPlayDialoguesInDoc: boolean;
}

const DEFAULT_PREFS: PersistedLayoutPrefs = {
  densityMode: 'auto',
  isDocumentExpanded: false,
  prolongedAnimations: false,
  autoPlayDialoguesInDoc: false,
};

const loadLayoutPrefs = (): PersistedLayoutPrefs => {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(LAYOUT_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    const validModes: DensityPreference[] = ['auto', 'slides', 'cascade', 'document'];
    return {
      densityMode: validModes.includes(parsed.densityMode) ? parsed.densityMode : 'auto',
      isDocumentExpanded: Boolean(parsed.isDocumentExpanded),
      prolongedAnimations: Boolean(parsed.prolongedAnimations),
      autoPlayDialoguesInDoc: Boolean(parsed.autoPlayDialoguesInDoc),
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

const saveLayoutPrefs = (prefs: PersistedLayoutPrefs) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
};

export function resolveEffectiveDensity(
  preference: DensityPreference,
  viewportWidth: number
): ResolvedDensityMode {
  if (preference !== 'auto') return preference;
  if (viewportWidth < 680) return 'slides';
  if (viewportWidth < 1120) return 'cascade';
  return 'document';
}

interface LayoutPrefsState extends PersistedLayoutPrefs {
  docScrollPercent: number;
  docActiveStepIndex: number;
  setDensityMode: (mode: DensityPreference) => void;
  cycleDensityMode: () => void;
  setDocumentExpanded: (expanded: boolean) => void;
  toggleDocumentExpanded: () => void;
  setProlongedAnimations: (enabled: boolean) => void;
  toggleProlongedAnimations: () => void;
  setAutoPlayDialoguesInDoc: (enabled: boolean) => void;
  toggleAutoPlayDialoguesInDoc: () => void;
  setDocReadingProgress: (scrollPercent: number, activeStepIndex: number) => void;
}

const initialPrefs = loadLayoutPrefs();

export const useLayoutPrefsStore = create<LayoutPrefsState>((set, get) => ({
  ...initialPrefs,
  docScrollPercent: 0,
  docActiveStepIndex: 0,

  setDensityMode: (densityMode) =>
    set((state) => {
      const next: PersistedLayoutPrefs = {
        densityMode,
        isDocumentExpanded: state.isDocumentExpanded,
        prolongedAnimations: state.prolongedAnimations,
        autoPlayDialoguesInDoc: state.autoPlayDialoguesInDoc,
      };
      saveLayoutPrefs(next);
      return { densityMode };
    }),

  cycleDensityMode: () => {
    const order: DensityPreference[] = ['slides', 'cascade', 'document', 'auto'];
    const cur = get().densityMode;
    const nextMode = order[(order.indexOf(cur) + 1) % order.length];
    get().setDensityMode(nextMode);
  },

  setDocumentExpanded: (isDocumentExpanded) =>
    set((state) => {
      const next: PersistedLayoutPrefs = {
        densityMode: state.densityMode,
        isDocumentExpanded,
        prolongedAnimations: state.prolongedAnimations,
        autoPlayDialoguesInDoc: state.autoPlayDialoguesInDoc,
      };
      saveLayoutPrefs(next);
      return { isDocumentExpanded };
    }),

  toggleDocumentExpanded: () => {
    get().setDocumentExpanded(!get().isDocumentExpanded);
  },

  setProlongedAnimations: (prolongedAnimations) =>
    set((state) => {
      const next: PersistedLayoutPrefs = {
        densityMode: state.densityMode,
        isDocumentExpanded: state.isDocumentExpanded,
        prolongedAnimations,
        autoPlayDialoguesInDoc: state.autoPlayDialoguesInDoc,
      };
      saveLayoutPrefs(next);
      return { prolongedAnimations };
    }),

  toggleProlongedAnimations: () => {
    get().setProlongedAnimations(!get().prolongedAnimations);
  },

  setAutoPlayDialoguesInDoc: (autoPlayDialoguesInDoc) =>
    set((state) => {
      const next: PersistedLayoutPrefs = {
        densityMode: state.densityMode,
        isDocumentExpanded: state.isDocumentExpanded,
        prolongedAnimations: state.prolongedAnimations,
        autoPlayDialoguesInDoc,
      };
      saveLayoutPrefs(next);
      return { autoPlayDialoguesInDoc };
    }),

  toggleAutoPlayDialoguesInDoc: () => {
    get().setAutoPlayDialoguesInDoc(!get().autoPlayDialoguesInDoc);
  },

  setDocReadingProgress: (scrollPercent, activeStepIndex) =>
    set((state) => {
      const clampedPct = Math.max(0, Math.min(100, Math.round(scrollPercent)));
      const clampedIdx = Math.max(0, activeStepIndex);
      if (state.docScrollPercent === clampedPct && state.docActiveStepIndex === clampedIdx) {
        return state;
      }
      return { docScrollPercent: clampedPct, docActiveStepIndex: clampedIdx };
    }),
}));
