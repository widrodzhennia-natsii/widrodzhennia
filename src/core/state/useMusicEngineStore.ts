import { create } from 'zustand';
import type { RhythmBeatType } from '../audio/musicTheory';

export type StoredRhythmBeatType = RhythmBeatType;

export interface MusicEngineInstanceState {
  slotNotes: Array<string | null>;
  activeSlotIdx: number;
  beatPattern: StoredRhythmBeatType[];
  isSolved: boolean;
  statusMsg: string | null;
}

interface MusicEngineStoreState {
  instances: Record<string, MusicEngineInstanceState>;
  ensureInstance: (key: string, noteCount: number, beatCount: number) => void;
  setSlotNotes: (key: string, noteCount: number, beatCount: number, next: Array<string | null>) => void;
  setActiveSlotIdx: (key: string, noteCount: number, beatCount: number, idx: number) => void;
  setBeatPattern: (key: string, noteCount: number, beatCount: number, next: StoredRhythmBeatType[]) => void;
  setStatus: (key: string, noteCount: number, beatCount: number, statusMsg: string | null, isSolved?: boolean) => void;
  resetInstance: (key: string, noteCount: number, beatCount: number) => void;
}

export const createDefaultMusicState = (
  noteCount: number,
  beatCount: number
): MusicEngineInstanceState => ({
  slotNotes: Array.from({ length: noteCount }, () => null),
  activeSlotIdx: 0,
  beatPattern: Array.from({ length: beatCount }, () => 'rest'),
  isSolved: false,
  statusMsg: null,
});

const normalizeState = (
  existing: MusicEngineInstanceState | undefined,
  noteCount: number,
  beatCount: number
): MusicEngineInstanceState => {
  if (!existing) return createDefaultMusicState(noteCount, beatCount);
  const slotNotes =
    existing.slotNotes.length === noteCount
      ? existing.slotNotes
      : Array.from({ length: noteCount }, (_, i) => existing.slotNotes[i] ?? null);
  const beatPattern =
    existing.beatPattern.length === beatCount
      ? existing.beatPattern
      : Array.from({ length: beatCount }, (_, i) => existing.beatPattern[i] ?? 'rest');
  const activeSlotIdx = Math.max(0, Math.min(Math.max(0, noteCount - 1), existing.activeSlotIdx));
  return {
    ...existing,
    slotNotes,
    beatPattern,
    activeSlotIdx,
  };
};

export const useMusicEngineStore = create<MusicEngineStoreState>((set) => ({
  instances: {},

  ensureInstance: (key, noteCount, beatCount) =>
    set((state) => {
      const existing = state.instances[key];
      if (
        existing &&
        existing.slotNotes.length === noteCount &&
        existing.beatPattern.length === beatCount
      ) {
        return state;
      }
      return {
        instances: {
          ...state.instances,
          [key]: normalizeState(existing, noteCount, beatCount),
        },
      };
    }),

  setSlotNotes: (key, noteCount, beatCount, next) =>
    set((state) => {
      const base = normalizeState(state.instances[key], noteCount, beatCount);
      return {
        instances: {
          ...state.instances,
          [key]: { ...base, slotNotes: next },
        },
      };
    }),

  setActiveSlotIdx: (key, noteCount, beatCount, idx) =>
    set((state) => {
      const base = normalizeState(state.instances[key], noteCount, beatCount);
      const safeIdx = Math.max(0, Math.min(Math.max(0, noteCount - 1), idx));
      if (base.activeSlotIdx === safeIdx) return state;
      return {
        instances: {
          ...state.instances,
          [key]: { ...base, activeSlotIdx: safeIdx },
        },
      };
    }),

  setBeatPattern: (key, noteCount, beatCount, next) =>
    set((state) => {
      const base = normalizeState(state.instances[key], noteCount, beatCount);
      return {
        instances: {
          ...state.instances,
          [key]: { ...base, beatPattern: next },
        },
      };
    }),

  setStatus: (key, noteCount, beatCount, statusMsg, isSolved) =>
    set((state) => {
      const base = normalizeState(state.instances[key], noteCount, beatCount);
      return {
        instances: {
          ...state.instances,
          [key]: {
            ...base,
            statusMsg,
            isSolved: isSolved !== undefined ? isSolved : base.isSolved,
          },
        },
      };
    }),

  resetInstance: (key, noteCount, beatCount) =>
    set((state) => ({
      instances: {
        ...state.instances,
        [key]: createDefaultMusicState(noteCount, beatCount),
      },
    })),
}));
