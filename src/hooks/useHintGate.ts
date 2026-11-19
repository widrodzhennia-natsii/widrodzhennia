import { create } from 'zustand';
import { BlockHintItem } from '../core/contracts/campaign.contract';
import { HistoryHintQuestion } from '../curriculum/types';
import { BruteForceReason } from './useAttemptTracker';

export type HintGateQuestion = HistoryHintQuestion | BlockHintItem;
export type HintGateMode = 'standard' | 'captcha' | 'alternatives';

export const defaultNeutralHint: HintGateQuestion = {
  id: 'hint_neutral_1',
  question: 'Чи звернули ви увагу на головні величини та правило поточного уроку?',
  correctAnswer: 'Так',
  explanation: 'Уважно перечитайте умову, одиниці вимірювання та опорну схему перед перевіркою.',
  era: 'Самоперевірка',
};

interface HintGateStoreState {
  isOpen: boolean;
  mode: HintGateMode;
  activeBlockId: string;
  activeHintText: string;
  activeHints: HintGateQuestion[];
  currentQuestionIndex: number;
  userAnswer: string;
  feedback: { isSuccess: boolean; text: string } | null;
  theoryStepIndex: number | null;
  subjectId: string;
  bruteForceReason: BruteForceReason;
  openGate: (params?: {
    blockId?: string;
    hintText?: string;
    hints?: HintGateQuestion[];
    mode?: HintGateMode;
    theoryStepIndex?: number | null;
    subjectId?: string;
    bruteForceReason?: BruteForceReason;
  }) => void;
  setMode: (mode: HintGateMode) => void;
  closeGate: () => void;
  setUserAnswer: (val: string) => void;
  setFeedback: (fb: { isSuccess: boolean; text: string } | null) => void;
  selectNextHint: () => void;
}

export const useHintGate = create<HintGateStoreState>((set, get) => ({
  isOpen: false,
  mode: 'standard',
  activeBlockId: '',
  activeHintText: '',
  activeHints: [defaultNeutralHint],
  currentQuestionIndex: 0,
  userAnswer: '',
  feedback: null,
  theoryStepIndex: null,
  subjectId: '',
  bruteForceReason: null,

  openGate: (params) => {
    const rawHints = params?.hints && params.hints.length > 0 ? params.hints : [defaultNeutralHint];
    const hintText =
      params?.hintText ||
      rawHints[0]?.explanation ||
      'Перевірте вихідні дані та правило поточного етапу уроку.';

    set({
      isOpen: true,
      mode: params?.mode || 'standard',
      activeBlockId: params?.blockId || '',
      activeHintText: hintText,
      activeHints: rawHints,
      currentQuestionIndex: 0,
      userAnswer: '',
      feedback: null,
      theoryStepIndex: params?.theoryStepIndex ?? null,
      subjectId: params?.subjectId || '',
      bruteForceReason: params?.bruteForceReason ?? null,
    });
  },

  setMode: (mode: HintGateMode) => set({ mode }),

  closeGate: () => set({ isOpen: false }),

  setUserAnswer: (val: string) => set({ userAnswer: val }),

  setFeedback: (fb) => set({ feedback: fb }),

  selectNextHint: () => {
    const { activeHints, currentQuestionIndex } = get();
    if (activeHints.length <= 1) return;
    set({
      currentQuestionIndex: (currentQuestionIndex + 1) % activeHints.length,
      userAnswer: '',
      feedback: null,
    });
  },
}));
