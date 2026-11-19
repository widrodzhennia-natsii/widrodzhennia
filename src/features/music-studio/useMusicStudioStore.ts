// Повна реалізація сховища Вільної музичної майстерні з localStorage-персистенцією
// Детальний план: fix_tech_patch/future_plans/MUSIC_STUDIO_FUTURE_PLAN.md

import { create } from 'zustand';
import type { MusicStudioComposition } from './musicStudio.types';

const STORAGE_KEY = 'nush_music_studio_compositions_v1';

const createStarterComposition = (): MusicStudioComposition => {
  const now = Date.now();
  return {
    id: 'studio_starter_1',
    title: 'Сонячна пентатоніка',
    gradeBand: '5-7',
    scale: 'pentatonic',
    timbre: 'plucked_bandura',
    timeSignature: '4/4',
    tempoBpm: 96,
    steps: [
      { id: 's1', notes: ['До'], duration: 'quarter', rhythmBeat: 'strong' },
      { id: 's2', notes: ['Мі'], duration: 'quarter', rhythmBeat: 'weak' },
      { id: 's3', notes: ['Соль'], duration: 'quarter', rhythmBeat: 'strong' },
      { id: 's4', notes: ['Ля'], duration: 'quarter', rhythmBeat: 'weak' },
      { id: 's5', notes: ['До5'], duration: 'half', rhythmBeat: 'strong' },
      { id: 's6', notes: ['Соль'], duration: 'quarter', rhythmBeat: 'sub' },
      { id: 's7', notes: ['Мі'], duration: 'quarter', rhythmBeat: 'weak' },
      { id: 's8', notes: ['До', 'Мі', 'Соль'], duration: 'half', rhythmBeat: 'strong' },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

const persistCompositions = (list: MusicStudioComposition[]) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore storage errors
  }
};

const loadInitialCompositions = (): MusicStudioComposition[] => {
  if (typeof localStorage === 'undefined') return [createStarterComposition()];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const starter = [createStarterComposition()];
      persistCompositions(starter);
      return starter;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [createStarterComposition()];
  } catch {
    return [createStarterComposition()];
  }
};

interface MusicStudioStoreState {
  compositions: MusicStudioComposition[];
  activeCompositionId: string | null;
  isStudioModalOpen: boolean;
  setStudioModalOpen: (open: boolean) => void;
  setActiveCompositionId: (id: string) => void;
  saveComposition: (comp: MusicStudioComposition) => void;
  deleteComposition: (id: string) => void;
}

const initialList = loadInitialCompositions();

export const useMusicStudioStore = create<MusicStudioStoreState>((set) => ({
  compositions: initialList,
  activeCompositionId: initialList[0]?.id ?? null,
  isStudioModalOpen: false,

  setStudioModalOpen: (open) => set({ isStudioModalOpen: open }),
  setActiveCompositionId: (id) => set({ activeCompositionId: id }),

  saveComposition: (comp) =>
    set((state) => {
      const exists = state.compositions.some((c) => c.id === comp.id);
      const next = exists
        ? state.compositions.map((c) => (c.id === comp.id ? comp : c))
        : [comp, ...state.compositions];
      persistCompositions(next);
      return { compositions: next, activeCompositionId: comp.id };
    }),

  deleteComposition: (id) =>
    set((state) => {
      const filtered = state.compositions.filter((c) => c.id !== id);
      const next = filtered.length > 0 ? filtered : [createStarterComposition()];
      persistCompositions(next);
      return {
        compositions: next,
        activeCompositionId:
          state.activeCompositionId === id ? next[0]?.id ?? null : state.activeCompositionId,
      };
    }),
}));
