import { create } from 'zustand';
import { VarMap, VarPrimitive, recomputeScopeVars } from './var-engine';

export interface ReactiveLessonScopeState {
  lessonId: string | null;
  defaults: VarMap;
  variables: VarMap;
  formulas: Record<string, string>;
  units: Record<string, string>;
  initScope: (
    lessonId: string,
    initialVars: VarMap,
    formulas?: Record<string, string>,
    units?: Record<string, string>
  ) => void;
  registerVarIfMissing: (key: string, defaultValue: VarPrimitive, unit?: string) => void;
  setVar: (key: string, value: VarPrimitive) => void;
  resetScope: () => void;
  hasChanges: () => boolean;
}

export const useLessonScopeStore = create<ReactiveLessonScopeState>((set, get) => ({
  lessonId: null,
  defaults: {},
  variables: {},
  formulas: {},
  units: {},

  initScope: (lessonId, initialVars, formulas = {}, units = {}) => {
    const computedInitial = recomputeScopeVars(initialVars, formulas);
    set({
      lessonId,
      defaults: { ...computedInitial },
      variables: { ...computedInitial },
      formulas: { ...formulas },
      units: { ...units },
    });
  },

  registerVarIfMissing: (key, defaultValue, unit) => {
    if (!key) return;
    set((state) => {
      const hasDefault = Object.prototype.hasOwnProperty.call(state.defaults, key);
      const hasCurrent = Object.prototype.hasOwnProperty.call(state.variables, key);
      if (hasDefault && hasCurrent) return state;

      const nextDefaults = hasDefault ? state.defaults : { ...state.defaults, [key]: defaultValue };
      const nextVars = hasCurrent ? state.variables : { ...state.variables, [key]: defaultValue };
      const nextUnits =
        unit && !state.units[key] ? { ...state.units, [key]: unit } : state.units;

      return {
        defaults: nextDefaults,
        variables: recomputeScopeVars(nextVars, state.formulas),
        units: nextUnits,
      };
    });
  },

  setVar: (key, value) => {
    set((state) => {
      const nextRaw: VarMap = { ...state.variables, [key]: value };
      const nextComputed = recomputeScopeVars(nextRaw, state.formulas);
      return { variables: nextComputed };
    });
  },

  resetScope: () => {
    const { defaults, formulas } = get();
    set({
      variables: recomputeScopeVars({ ...defaults }, formulas),
    });
  },

  hasChanges: () => {
    const { defaults, variables } = get();
    const keys = new Set([...Object.keys(defaults), ...Object.keys(variables)]);
    for (const k of keys) {
      if (defaults[k] !== variables[k]) return true;
    }
    return false;
  },
}));
