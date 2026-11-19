import { create } from 'zustand';

export type EscalationAction = 'soft_hint' | 'captcha' | 'alternatives';
export type BruteForceReason = 'rapid_clicks' | 'sequential_guessing' | null;

export interface BlockAttemptStats {
  consecutiveErrors: number;
  totalErrors: number;
  recentTimestamps: number[];
  recentInputs: string[];
  captchaCyclesCompleted: number;
  bruteForceDetected: boolean;
  bruteForceReason: BruteForceReason;
}

const DEFAULT_STATS: BlockAttemptStats = {
  consecutiveErrors: 0,
  totalErrors: 0,
  recentTimestamps: [],
  recentInputs: [],
  captchaCyclesCompleted: 0,
  bruteForceDetected: false,
  bruteForceReason: null,
};

interface AttemptSettings {
  captchaErrorThreshold: number;
  captchaMaxCycles: number;
}

interface AttemptOutcome {
  stats: BlockAttemptStats;
  action: EscalationAction;
  bruteForceReason: BruteForceReason;
}

interface AttemptTrackerState {
  byBlock: Record<string, BlockAttemptStats>;
  recordWrongAttempt: (
    blockId: string,
    inputSignature: string,
    settings: AttemptSettings
  ) => AttemptOutcome;
  recordCorrectAttempt: (blockId: string) => void;
  recordCaptchaCompleted: (blockId: string) => BlockAttemptStats;
  resetBlockAttempts: (blockId: string) => void;
  resetAllAttempts: () => void;
}

const detectBruteForce = (
  timestamps: number[],
  inputs: string[]
): BruteForceReason => {
  // 1. Rapid clicking / submitting: 2+ consecutive wrong tries within < 3.5s
  if (timestamps.length >= 2) {
    const lastInterval = timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2];
    if (lastInterval < 3500) {
      if (timestamps.length >= 3) {
        const prevInterval = timestamps[timestamps.length - 2] - timestamps[timestamps.length - 3];
        if (prevInterval < 4500) return 'rapid_clicks';
      }
      if (lastInterval < 2200) return 'rapid_clicks';
    }
  }

  // 2. Sequential numeric guessing or cycling through distinct options quickly
  if (inputs.length >= 3) {
    const lastThree = inputs.slice(-3);
    const nums = lastThree.map((s) => Number(s.replace(',', '.')));
    if (nums.every((n) => Number.isFinite(n))) {
      const d1 = Math.abs(nums[1] - nums[0]);
      const d2 = Math.abs(nums[2] - nums[1]);
      if (d1 > 0 && d1 <= 2 && d2 > 0 && d2 <= 2) {
        return 'sequential_guessing';
      }
    }

    // Repeated cycling across 3 distinct signatures inside 9s
    if (timestamps.length >= 3) {
      const span = timestamps[timestamps.length - 1] - timestamps[timestamps.length - 3];
      const uniqueCount = new Set(lastThree).size;
      if (uniqueCount >= 3 && span < 9000) {
        return 'sequential_guessing';
      }
    }
  }

  return null;
};

export const useAttemptTracker = create<AttemptTrackerState>((set, get) => ({
  byBlock: {},

  recordWrongAttempt: (blockId, inputSignature, settings) => {
    const now = Date.now();
    const prev = get().byBlock[blockId] || DEFAULT_STATS;
    const recentTimestamps = [...prev.recentTimestamps, now].slice(-6);
    const recentInputs = [...prev.recentInputs, String(inputSignature || '').trim()].slice(-6);

    const consecutiveErrors = prev.consecutiveErrors + 1;
    const totalErrors = prev.totalErrors + 1;
    const detectedReason = detectBruteForce(recentTimestamps, recentInputs);
    const bruteForceDetected = Boolean(detectedReason);

    const nextStats: BlockAttemptStats = {
      ...prev,
      consecutiveErrors,
      totalErrors,
      recentTimestamps,
      recentInputs,
      bruteForceDetected,
      bruteForceReason: detectedReason,
    };

    set((state) => ({
      byBlock: {
        ...state.byBlock,
        [blockId]: nextStats,
      },
    }));

    let action: EscalationAction = 'soft_hint';
    if (prev.captchaCyclesCompleted >= settings.captchaMaxCycles) {
      action = 'alternatives';
    } else if (bruteForceDetected || consecutiveErrors >= settings.captchaErrorThreshold) {
      action = 'captcha';
    }

    return {
      stats: nextStats,
      action,
      bruteForceReason: detectedReason,
    };
  },

  recordCorrectAttempt: (blockId) => {
    set((state) => {
      if (!state.byBlock[blockId]) return state;
      return {
        byBlock: {
          ...state.byBlock,
          [blockId]: {
            ...state.byBlock[blockId],
            consecutiveErrors: 0,
            bruteForceDetected: false,
            bruteForceReason: null,
          },
        },
      };
    });
  },

  recordCaptchaCompleted: (blockId) => {
    const prev = get().byBlock[blockId] || DEFAULT_STATS;
    const nextStats: BlockAttemptStats = {
      ...prev,
      consecutiveErrors: 0,
      recentTimestamps: [],
      recentInputs: [],
      bruteForceDetected: false,
      bruteForceReason: null,
      captchaCyclesCompleted: prev.captchaCyclesCompleted + 1,
    };
    set((state) => ({
      byBlock: {
        ...state.byBlock,
        [blockId]: nextStats,
      },
    }));
    return nextStats;
  },

  resetBlockAttempts: (blockId) => {
    set((state) => {
      const next = { ...state.byBlock };
      delete next[blockId];
      return { byBlock: next };
    });
  },

  resetAllAttempts: () => set({ byBlock: {} }),
}));
