import { create } from 'zustand';

export interface WidgetInstanceState {
  exploreOpen: boolean;
  overrides: Record<string, number>;
}

const DEFAULT_WIDGET_STATE: WidgetInstanceState = {
  exploreOpen: false,
  overrides: {},
};

interface WidgetStoreState {
  instances: Record<string, WidgetInstanceState>;
  setExploreOpen: (key: string, open: boolean) => void;
  toggleExplore: (key: string) => void;
  setOverride: (
    key: string,
    paramKey: string,
    value: number,
    normalize?: (updated: Record<string, number>) => Record<string, number>
  ) => void;
  resetOverrides: (key: string) => void;
  resetByPrefix: (prefix: string) => void;
}

export const useWidgetStore = create<WidgetStoreState>((set) => ({
  instances: {},

  setExploreOpen: (key, open) =>
    set((state) => {
      const current = state.instances[key] || DEFAULT_WIDGET_STATE;
      if (current.exploreOpen === open) return state;
      return {
        instances: {
          ...state.instances,
          [key]: { ...current, exploreOpen: open },
        },
      };
    }),

  toggleExplore: (key) =>
    set((state) => {
      const current = state.instances[key] || DEFAULT_WIDGET_STATE;
      return {
        instances: {
          ...state.instances,
          [key]: { ...current, exploreOpen: !current.exploreOpen },
        },
      };
    }),

  setOverride: (key, paramKey, value, normalize) =>
    set((state) => {
      const current = state.instances[key] || DEFAULT_WIDGET_STATE;
      const rawUpdated = { ...current.overrides, [paramKey]: value };
      const finalOverrides = normalize ? normalize(rawUpdated) : rawUpdated;
      return {
        instances: {
          ...state.instances,
          [key]: { ...current, overrides: finalOverrides },
        },
      };
    }),

  resetOverrides: (key) =>
    set((state) => {
      const current = state.instances[key];
      if (!current || Object.keys(current.overrides).length === 0) return state;
      return {
        instances: {
          ...state.instances,
          [key]: { ...current, overrides: {} },
        },
      };
    }),

  resetByPrefix: (prefix) =>
    set((state) => {
      const next: Record<string, WidgetInstanceState> = {};
      let changed = false;
      for (const [k, v] of Object.entries(state.instances)) {
        if (k.startsWith(prefix)) {
          changed = true;
        } else {
          next[k] = v;
        }
      }
      return changed ? { instances: next } : state;
    }),
}));

export const getWidgetInstanceState = (
  instances: Record<string, WidgetInstanceState>,
  key: string
): WidgetInstanceState => instances[key] || DEFAULT_WIDGET_STATE;
