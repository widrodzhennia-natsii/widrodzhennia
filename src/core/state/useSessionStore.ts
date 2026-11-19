import { create } from 'zustand';
import { QuestStep } from '../contracts/campaign.contract';
import { CrashGuard } from '../storage/crash-guard';
import { ActiveView, SubjectViewMode } from '../../app/appTypes';
import type { TextLensMode } from '../../features/story-player/TextLensSwitch';

const LEFT_PANEL_PREF_KEY = 'nush_context_expanded_v1';
const DELETE_MODE_KEY = 'nush_delete_mode_enabled';

const loadBoolPref = (key: string, fallback: boolean): boolean => {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === 'true';
};

interface SessionState {
  // Navigation State
  activeView: ActiveView;
  selectedGradeId: string;
  selectedSubjectId: string;
  subjectViewMode: SubjectViewMode;
  isMapExpanded: boolean;
  isProfileOpen: boolean;
  isYamlImporterOpen: boolean;
  isGlossaryOpen: boolean;
  glossaryInitialQuery: string;
  glossarySubjectId: string;
  isRewardGameOpen: boolean;
  rewardGameSourceKey: string;
  isCartridgesOpen: boolean;
  cartridgesInitialTab: 'law' | 'valeology' | 'ecology' | 'diction' | 'resilience';
  isCoopOpen: boolean;

  // User UI Preferences
  showLeftPanel: boolean;
  isDeleteModeEnabled: boolean;
  activeTextLens: TextLensMode;

  // Quest State
  currentQuestId: string | null;
  currentStepIndex: number;
  activeSteps: QuestStep[];
  inputDrafts: Record<string, string | number>;
  completedBlockIds: string[];
  sandboxState: Record<string, any>;
  isSomaticBreakActive: boolean;
  isPracticeModeOnly: boolean;
  isQuestCompletedSummaryVisible: boolean;
  variantNonce: number;
  returnFromTheoryStep: number | null;

  // Navigation Setters
  setActiveView: (view: ActiveView) => void;
  setSelectedGradeId: (gradeId: string) => void;
  setSelectedSubjectId: (subjectId: string) => void;
  setSubjectViewMode: (mode: SubjectViewMode) => void;
  setMapExpanded: (isExpanded: boolean) => void;
  setProfileOpen: (isOpen: boolean) => void;
  setYamlImporterOpen: (isOpen: boolean) => void;
  openGlossary: (query?: string, subjectId?: string) => void;
  closeGlossary: () => void;
  openRewardGame: (sourceKey?: string) => void;
  closeRewardGame: () => void;
  openCartridges: (tab?: 'law' | 'valeology' | 'ecology' | 'diction' | 'resilience') => void;
  closeCartridges: () => void;
  openCoop: () => void;
  closeCoop: () => void;
  setShowLeftPanel: (visible: boolean) => void;
  setDeleteModeEnabled: (enabled: boolean) => void;
  setActiveTextLens: (lens: TextLensMode) => void;

  // Quest Setters
  setQuest: (questId: string, steps: QuestStep[]) => void;
  setPracticeModeOnly: (isPractice: boolean) => void;
  setQuestCompletedSummaryVisible: (visible: boolean) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;
  jumpToTheoryAndRemember: (theoryStepIndex: number, fromStepIndex: number) => void;
  returnFromTheory: () => void;
  setInputDraft: (blockId: string, value: string | number) => void;
  markBlockCompleted: (blockId: string) => void;
  updateSandboxState: (key: string, value: any) => void;
  setSomaticBreak: (isActive: boolean) => void;
  bumpVariantNonce: () => void;
  resetSession: () => void;
}

const recoveredFlash = CrashGuard.recoverFlashBuffer();

export const useSessionStore = create<SessionState>((set) => ({
  // Initial Navigation State
  activeView: 'doors',
  selectedGradeId: 'grade_5',
  selectedSubjectId: '',
  subjectViewMode: 'map',
  isMapExpanded: false,
  isProfileOpen: false,
  isYamlImporterOpen: false,
  isGlossaryOpen: false,
  glossaryInitialQuery: '',
  glossarySubjectId: '',
  isRewardGameOpen: false,
  rewardGameSourceKey: '',
  isCartridgesOpen: false,
  cartridgesInitialTab: 'resilience',
  isCoopOpen: false,

  // User Preferences
  showLeftPanel: loadBoolPref(LEFT_PANEL_PREF_KEY, false),
  isDeleteModeEnabled: loadBoolPref(DELETE_MODE_KEY, false),
  activeTextLens: 'all',

  // Initial Quest State
  currentQuestId: recoveredFlash ? recoveredFlash.questId : null,
  currentStepIndex: recoveredFlash ? recoveredFlash.stepIndex : 0,
  activeSteps: [],
  inputDrafts: recoveredFlash?.inputDrafts ? recoveredFlash.inputDrafts : {},
  completedBlockIds: recoveredFlash?.completedBlockIds ? recoveredFlash.completedBlockIds : [],
  sandboxState: recoveredFlash?.sandboxState ? recoveredFlash.sandboxState : {},
  isSomaticBreakActive: false,
  isPracticeModeOnly: false,
  isQuestCompletedSummaryVisible: false,
  variantNonce: 0,
  returnFromTheoryStep: null,

  // Navigation Actions
  setActiveView: (view: ActiveView) => set({ activeView: view }),
  setSelectedGradeId: (gradeId: string) => set({ selectedGradeId: gradeId }),
  setSelectedSubjectId: (subjectId: string) => set({ selectedSubjectId: subjectId }),
  setSubjectViewMode: (mode: SubjectViewMode) => set({ subjectViewMode: mode }),
  setMapExpanded: (isExpanded: boolean) => set({ isMapExpanded: isExpanded }),
  setProfileOpen: (isOpen: boolean) => set({ isProfileOpen: isOpen }),
  setYamlImporterOpen: (isOpen: boolean) => set({ isYamlImporterOpen: isOpen }),
  openGlossary: (query = '', subjectId = '') =>
    set((state) => ({
      isGlossaryOpen: true,
      glossaryInitialQuery: query,
      glossarySubjectId: subjectId || state.selectedSubjectId || '',
    })),
  closeGlossary: () => set({ isGlossaryOpen: false }),
  openRewardGame: (sourceKey = '') =>
    set({ isRewardGameOpen: true, rewardGameSourceKey: sourceKey }),
  closeRewardGame: () => set({ isRewardGameOpen: false }),
  openCartridges: (tab = 'resilience') =>
    set({ isCartridgesOpen: true, cartridgesInitialTab: tab }),
  closeCartridges: () => set({ isCartridgesOpen: false }),
  openCoop: () => set({ isCoopOpen: true }),
  closeCoop: () => set({ isCoopOpen: false }),
  setActiveTextLens: (lens: TextLensMode) => set({ activeTextLens: lens }),

  setShowLeftPanel: (visible: boolean) => {
    try {
      localStorage.setItem(LEFT_PANEL_PREF_KEY, visible ? 'true' : 'false');
    } catch {
      // Ignore storage errors
    }
    set({ showLeftPanel: visible });
  },

  setDeleteModeEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem(DELETE_MODE_KEY, enabled ? 'true' : 'false');
      window.dispatchEvent(new Event('nush_storage_change'));
    } catch {
      // Ignore storage errors
    }
    set({ isDeleteModeEnabled: enabled });
  },

  // Quest Actions
  setPracticeModeOnly: (isPractice: boolean) => set({ isPracticeModeOnly: isPractice }),
  setQuestCompletedSummaryVisible: (visible: boolean) => set({ isQuestCompletedSummaryVisible: visible }),

  setQuest: (questId: string, steps: QuestStep[]) => {
    set({
      currentQuestId: questId,
      activeSteps: steps,
      currentStepIndex: 0,
      inputDrafts: {},
      completedBlockIds: [],
      sandboxState: {},
      isSomaticBreakActive: false,
      isQuestCompletedSummaryVisible: false,
      returnFromTheoryStep: null,
    });
    CrashGuard.saveFlashBuffer({
      questId,
      stepIndex: 0,
      inputDrafts: {},
      completedBlockIds: [],
      sandboxState: {},
      timestamp: Date.now(),
    });
  },

  nextStep: () => {
    set((state) => {
      const nextIdx = state.currentStepIndex + 1;
      if (nextIdx >= state.activeSteps.length) return state;
      const newState = { ...state, currentStepIndex: nextIdx };
      CrashGuard.saveFlashBuffer({
        questId: newState.currentQuestId,
        stepIndex: newState.currentStepIndex,
        inputDrafts: newState.inputDrafts,
        completedBlockIds: newState.completedBlockIds,
        sandboxState: newState.sandboxState,
        timestamp: Date.now(),
      });
      return newState;
    });
  },

  previousStep: () => {
    set((state) => {
      const prevIdx = Math.max(0, state.currentStepIndex - 1);
      const newState = { ...state, currentStepIndex: prevIdx };
      CrashGuard.saveFlashBuffer({
        questId: newState.currentQuestId,
        stepIndex: newState.currentStepIndex,
        inputDrafts: newState.inputDrafts,
        completedBlockIds: newState.completedBlockIds,
        sandboxState: newState.sandboxState,
        timestamp: Date.now(),
      });
      return newState;
    });
  },

  goToStep: (index: number) => {
    set((state) => {
      const targetIdx = Math.min(Math.max(0, index), Math.max(0, state.activeSteps.length - 1));
      const newState = {
        ...state,
        currentStepIndex: targetIdx,
        isQuestCompletedSummaryVisible: false,
        returnFromTheoryStep: null,
      };
      CrashGuard.saveFlashBuffer({
        questId: newState.currentQuestId,
        stepIndex: newState.currentStepIndex,
        inputDrafts: newState.inputDrafts,
        completedBlockIds: newState.completedBlockIds,
        sandboxState: newState.sandboxState,
        timestamp: Date.now(),
      });
      return newState;
    });
  },

  jumpToTheoryAndRemember: (theoryStepIndex: number, fromStepIndex: number) => {
    set((state) => {
      const targetIdx = Math.min(Math.max(0, theoryStepIndex), Math.max(0, state.activeSteps.length - 1));
      return {
        ...state,
        currentStepIndex: targetIdx,
        isQuestCompletedSummaryVisible: false,
        returnFromTheoryStep: fromStepIndex,
      };
    });
  },

  returnFromTheory: () => {
    set((state) => {
      if (state.returnFromTheoryStep === null) return state;
      const targetIdx = Math.min(Math.max(0, state.returnFromTheoryStep), Math.max(0, state.activeSteps.length - 1));
      return {
        ...state,
        currentStepIndex: targetIdx,
        isQuestCompletedSummaryVisible: false,
        returnFromTheoryStep: null,
      };
    });
  },

  setInputDraft: (blockId: string, value: string | number) => {
    set((state) => {
      const newDrafts = { ...state.inputDrafts, [blockId]: value };
      CrashGuard.saveFlashBuffer({
        questId: state.currentQuestId,
        stepIndex: state.currentStepIndex,
        inputDrafts: newDrafts,
        completedBlockIds: state.completedBlockIds,
        sandboxState: state.sandboxState,
        timestamp: Date.now(),
      });
      return { inputDrafts: newDrafts };
    });
  },

  markBlockCompleted: (blockId: string) => {
    set((state) => {
      if (state.completedBlockIds.includes(blockId)) return state;
      const newCompleted = [...state.completedBlockIds, blockId];
      CrashGuard.saveFlashBuffer({
        questId: state.currentQuestId,
        stepIndex: state.currentStepIndex,
        inputDrafts: state.inputDrafts,
        completedBlockIds: newCompleted,
        sandboxState: state.sandboxState,
        timestamp: Date.now(),
      });
      return { completedBlockIds: newCompleted };
    });
  },

  updateSandboxState: (key: string, value: any) => {
    set((state) => {
      const newSandboxState = { ...state.sandboxState, [key]: value };
      CrashGuard.saveFlashBuffer({
        questId: state.currentQuestId,
        stepIndex: state.currentStepIndex,
        inputDrafts: state.inputDrafts,
        completedBlockIds: state.completedBlockIds,
        sandboxState: newSandboxState,
        timestamp: Date.now(),
      });
      return { sandboxState: newSandboxState };
    });
  },

  setSomaticBreak: (isActive: boolean) => set({ isSomaticBreakActive: isActive }),

  bumpVariantNonce: () => set((state) => ({ variantNonce: state.variantNonce + 1 })),

  resetSession: () => {
    CrashGuard.clearFlashBuffer();
    set({
      currentQuestId: null,
      currentStepIndex: 0,
      activeSteps: [],
      inputDrafts: {},
      completedBlockIds: [],
      sandboxState: {},
      isSomaticBreakActive: false,
      isQuestCompletedSummaryVisible: false,
      returnFromTheoryStep: null,
    });
  },
}));
