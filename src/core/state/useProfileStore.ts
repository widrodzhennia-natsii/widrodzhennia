import { create } from 'zustand';
import {
  StudentProfile,
  JournalEntry,
  createDefaultTraits,
  normalizeTraits,
  resolveTraitKey,
  generateProfileSeed,
} from '../contracts/profile.contract';
import { useEconomyAccountsStore } from '../../features/economy/useEconomyAccountsStore';

const PROFILE_STORAGE_KEY = 'edu_student_profile_v1';
const LEGACY_PROGRESS_KEY = 'edu_game_progress_v1';

interface ResourceCost {
  wood?: number;
  stone?: number;
  energy?: number;
}

interface ProfileState {
  profile: StudentProfile;
  setStudentName: (name: string) => void;
  setSelectedSubject: (gradeNumber: number, subjectId: string) => void;
  addResources: (reward: { wood?: number; stone?: number; energy?: number }) => void;
  spendResources: (cost: ResourceCost) => boolean;
  addResilienceXp: (amount: number) => void;
  addTraitPoints: (trait: string, points: number) => void;
  markQuestStarted: (questId: string) => void;
  completeQuest: (questId: string, questTitle?: string) => void;
  completeTask: (
    taskId: string,
    reward?: { wood: number; stone: number; energy: number },
    taskTitle?: string,
    variantMeta?: { variantNonce?: number; hasVars?: boolean }
  ) => void;
  unlockHintForTask: (taskId: string) => void;
  setSubjectChapterIndex: (subjectId: string, chapterIndex: number, taskIndex?: number) => void;
  addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  importProfile: (profile: Partial<StudentProfile>) => void;
  resetProfile: () => void;
}

const createDefaultProfile = (): StudentProfile => ({
  id: 'default_student',
  profileSeed: generateProfileSeed(),
  studentName: 'Молодий Дослідник',
  avatarId: 'explorer',
  currentGrade: 5,
  selectedSubjectId: '',
  resources: {
    wood: 0,
    stone: 0,
    energy: 50,
  },
  traits: createDefaultTraits(),
  totalXp: 0,
  startedQuestIds: [],
  completedQuestIds: [],
  completedTaskIds: [],
  unlockedHintTaskIds: [],
  chapterProgressBySubject: {},
  journal: [],
});

const persistProfileToLocalStorage = (profile: StudentProfile) => {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // LocalStorage fallback
  }
};

const loadInitialProfile = (): StudentProfile => {
  const defaults = createDefaultProfile();
  if (typeof localStorage === 'undefined') return defaults;

  try {
    const savedRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
    const legacyRaw = localStorage.getItem(LEGACY_PROGRESS_KEY);

    const parsedSaved: Partial<StudentProfile> = savedRaw ? JSON.parse(savedRaw) : {};
    const parsedLegacy: any = legacyRaw ? JSON.parse(legacyRaw) : null;

    const cleanAvatar =
      parsedSaved.avatarId === 'beaver_brus' ? 'explorer' : parsedSaved.avatarId || defaults.avatarId;
    const cleanSubject =
      parsedSaved.selectedSubjectId === 'math_5' ? '' : parsedSaved.selectedSubjectId || '';

    const mergedCompletedTasks = Array.from(
      new Set([
        ...(Array.isArray(parsedSaved.completedTaskIds) ? parsedSaved.completedTaskIds : []),
        ...(Array.isArray(parsedLegacy?.completedTaskIds) ? parsedLegacy.completedTaskIds : []),
      ])
    );

    const mergedUnlockedHints = Array.from(
      new Set([
        ...(Array.isArray(parsedSaved.unlockedHintTaskIds) ? parsedSaved.unlockedHintTaskIds : []),
        ...(Array.isArray(parsedLegacy?.unlockedHintTaskIds) ? parsedLegacy.unlockedHintTaskIds : []),
      ])
    );

    const mergedResources = parsedSaved.resources || parsedLegacy?.resources || defaults.resources;

    const merged: StudentProfile = {
      ...defaults,
      ...parsedSaved,
      profileSeed:
        typeof parsedSaved.profileSeed === 'string' && parsedSaved.profileSeed.trim()
          ? parsedSaved.profileSeed
          : defaults.profileSeed,
      avatarId: cleanAvatar,
      selectedSubjectId: cleanSubject,
      studentName: parsedSaved.studentName || parsedLegacy?.studentName || defaults.studentName,
      resources: {
        wood: Number(mergedResources.wood) || 0,
        stone: Number(mergedResources.stone) || 0,
        energy: Number(mergedResources.energy) ?? 50,
      },
      traits: normalizeTraits(parsedSaved.traits),
      startedQuestIds: Array.isArray(parsedSaved.startedQuestIds) ? parsedSaved.startedQuestIds : [],
      completedQuestIds: Array.isArray(parsedSaved.completedQuestIds) ? parsedSaved.completedQuestIds : [],
      completedTaskIds: mergedCompletedTasks,
      unlockedHintTaskIds: mergedUnlockedHints,
      chapterProgressBySubject: parsedSaved.chapterProgressBySubject || {},
      journal: Array.isArray(parsedSaved.journal) ? parsedSaved.journal : [],
    };

    if (legacyRaw || !parsedSaved.profileSeed) {
      persistProfileToLocalStorage(merged);
      if (legacyRaw) localStorage.removeItem(LEGACY_PROGRESS_KEY);
    }

    return merged;
  } catch {
    return defaults;
  }
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: loadInitialProfile(),

  setStudentName: (name: string) =>
    set((state) => {
      const updatedProfile = { ...state.profile, studentName: name };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  setSelectedSubject: (gradeNumber: number, subjectId: string) =>
    set((state) => {
      const updatedProfile = {
        ...state.profile,
        currentGrade: gradeNumber,
        selectedSubjectId: subjectId,
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  addResources: (reward) =>
    set((state) => {
      const updatedProfile: StudentProfile = {
        ...state.profile,
        resources: {
          wood: state.profile.resources.wood + (reward.wood || 0),
          stone: state.profile.resources.stone + (reward.stone || 0),
          energy: state.profile.resources.energy + (reward.energy || 0),
        },
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  spendResources: (cost) => {
    const current = get().profile.resources;
    const needWood = Math.max(0, cost.wood || 0);
    const needStone = Math.max(0, cost.stone || 0);
    const needEnergy = Math.max(0, cost.energy || 0);

    if (current.wood < needWood || current.stone < needStone || current.energy < needEnergy) {
      return false;
    }

    set((state) => {
      const updatedProfile: StudentProfile = {
        ...state.profile,
        resources: {
          wood: state.profile.resources.wood - needWood,
          stone: state.profile.resources.stone - needStone,
          energy: state.profile.resources.energy - needEnergy,
        },
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    });
    return true;
  },

  addResilienceXp: (amount: number) =>
    set((state) => {
      const updatedProfile: StudentProfile = {
        ...state.profile,
        totalXp: state.profile.totalXp + amount,
        traits: {
          ...state.profile.traits,
          resilience: (state.profile.traits.resilience ?? 10) + amount,
        },
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  addTraitPoints: (trait: string, points: number) =>
    set((state) => {
      const key = resolveTraitKey(trait);
      const currentVal = state.profile.traits[key] ?? 10;
      const updatedProfile: StudentProfile = {
        ...state.profile,
        traits: {
          ...state.profile.traits,
          [key]: Math.max(0, currentVal + points),
        },
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  markQuestStarted: (questId: string) =>
    set((state) => {
      if (!questId || state.profile.startedQuestIds.includes(questId)) return state;
      const updatedProfile: StudentProfile = {
        ...state.profile,
        startedQuestIds: [...state.profile.startedQuestIds, questId],
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  completeQuest: (questId: string, questTitle?: string) =>
    set((state) => {
      const alreadyCompleted = state.profile.completedQuestIds.includes(questId);
      const startedSet = state.profile.startedQuestIds.includes(questId)
        ? state.profile.startedQuestIds
        : [...state.profile.startedQuestIds, questId];

      const newJournalEntry: JournalEntry | null =
        !alreadyCompleted && questTitle
          ? {
              id: `entry_${Date.now()}`,
              timestamp: Date.now(),
              taskTitle: questTitle,
              reflectionText: 'Успішно завершено навчальний епізод та закріплено практичні навички.',
              traitBoosted: 'Аналітика +5 / Допитливість +5 / Співпраця +3',
            }
          : null;

      const updatedProfile: StudentProfile = {
        ...state.profile,
        startedQuestIds: startedSet,
        completedQuestIds: alreadyCompleted
          ? state.profile.completedQuestIds
          : [...state.profile.completedQuestIds, questId],
        totalXp: alreadyCompleted ? state.profile.totalXp : state.profile.totalXp + 50,
        traits: alreadyCompleted
          ? state.profile.traits
          : {
              ...state.profile.traits,
              analytics: (state.profile.traits.analytics ?? 10) + 5,
              curiosity: (state.profile.traits.curiosity ?? 10) + 5,
              collaboration: (state.profile.traits.collaboration ?? 10) + 3,
            },
        journal: newJournalEntry ? [...state.profile.journal, newJournalEntry] : state.profile.journal,
      };
      persistProfileToLocalStorage(updatedProfile);
      if (!alreadyCompleted) {
        useEconomyAccountsStore.getState().depositEarnings({
          signature: `quest::${questId}`,
          baseAmount: 30,
          details: 2,
          tokens: 1,
          label: questTitle ? `Тема: ${questTitle}` : 'Завершення уроку',
          kind: 'quest_bonus',
        });
      }
      return { profile: updatedProfile };
    }),

  completeTask: (taskId: string, reward, taskTitle?: string, variantMeta?: { variantNonce?: number; hasVars?: boolean }) =>
    set((state) => {
      const alreadyDone = state.profile.completedTaskIds.includes(taskId);
      const completedTaskIds = alreadyDone
        ? state.profile.completedTaskIds
        : [...state.profile.completedTaskIds, taskId];

      const nonce = Math.max(0, Number(variantMeta?.variantNonce ?? 0));
      const isFreshVariantRun = Boolean(alreadyDone && variantMeta?.hasVars && nonce > 0);
      const variantSignature = `task::${taskId}::v${nonce}`;
      const economyStore = useEconomyAccountsStore.getState();
      const canAwardFreshVariant =
        isFreshVariantRun && !economyStore.hasRewardSignature(variantSignature);

      let updatedResources = state.profile.resources;
      let xpDelta = 0;

      if (!alreadyDone) {
        xpDelta = 20;
        if (reward) {
          updatedResources = {
            wood: state.profile.resources.wood + reward.wood,
            stone: state.profile.resources.stone + reward.stone,
            energy: state.profile.resources.energy + reward.energy,
          };
        }
        economyStore.depositEarnings({
          signature: `task::${taskId}::v0`,
          baseAmount: Math.max(12, (reward?.energy || 10) + Math.round((reward?.wood || 10) / 3)),
          details: 1,
          tokens: 0,
          label: taskTitle || 'Виконання вправи',
          kind: 'task_earn',
        });
      } else if (canAwardFreshVariant) {
        xpDelta = 8;
        updatedResources = {
          wood: state.profile.resources.wood + 5,
          stone: state.profile.resources.stone + 3,
          energy: state.profile.resources.energy + 5,
        };
        economyStore.depositEarnings({
          signature: variantSignature,
          baseAmount: 10,
          details: 1,
          tokens: 0,
          label: `${taskTitle || 'Вправа'} (варіант №${nonce + 1})`,
          kind: 'variant_earn',
        });
      }

      const journalEntry: JournalEntry | null =
        !alreadyDone && taskTitle
          ? {
              id: `task_entry_${Date.now()}`,
              timestamp: Date.now(),
              taskTitle,
              reflectionText: 'Практичне завдання виконано та перевірено.',
              traitBoosted: 'Стійкість +5',
            }
          : null;

      const updatedProfile: StudentProfile = {
        ...state.profile,
        completedTaskIds,
        resources: updatedResources,
        totalXp: state.profile.totalXp + xpDelta,
        journal: journalEntry ? [...state.profile.journal, journalEntry] : state.profile.journal,
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  unlockHintForTask: (taskId: string) =>
    set((state) => {
      if (!taskId || state.profile.unlockedHintTaskIds.includes(taskId)) return state;
      const updatedProfile: StudentProfile = {
        ...state.profile,
        unlockedHintTaskIds: [...state.profile.unlockedHintTaskIds, taskId],
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  setSubjectChapterIndex: (subjectId: string, chapterIndex: number, taskIndex: number = 0) =>
    set((state) => {
      if (!subjectId) return state;
      const updatedProfile: StudentProfile = {
        ...state.profile,
        selectedSubjectId: subjectId,
        chapterProgressBySubject: {
          ...state.profile.chapterProgressBySubject,
          [subjectId]: {
            currentChapterIndex: Math.max(0, chapterIndex),
            currentTaskIndex: Math.max(0, taskIndex),
          },
        },
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  addJournalEntry: (entry) =>
    set((state) => {
      const newEntry: JournalEntry = {
        ...entry,
        id: `entry_${Date.now()}`,
        timestamp: Date.now(),
      };
      const updatedProfile: StudentProfile = {
        ...state.profile,
        journal: [...state.profile.journal, newEntry],
      };
      persistProfileToLocalStorage(updatedProfile);
      return { profile: updatedProfile };
    }),

  importProfile: (imported: Partial<StudentProfile>) => {
    const defaults = createDefaultProfile();
    const merged: StudentProfile = {
      ...defaults,
      ...imported,
      profileSeed:
        typeof imported.profileSeed === 'string' && imported.profileSeed.trim()
          ? imported.profileSeed
          : defaults.profileSeed,
      resources: {
        ...defaults.resources,
        ...(imported.resources || {}),
      },
      traits: normalizeTraits(imported.traits),
      startedQuestIds: Array.isArray(imported.startedQuestIds) ? imported.startedQuestIds : [],
      completedQuestIds: Array.isArray(imported.completedQuestIds) ? imported.completedQuestIds : [],
      completedTaskIds: Array.isArray(imported.completedTaskIds) ? imported.completedTaskIds : [],
      unlockedHintTaskIds: Array.isArray(imported.unlockedHintTaskIds) ? imported.unlockedHintTaskIds : [],
      chapterProgressBySubject: imported.chapterProgressBySubject || {},
      journal: Array.isArray(imported.journal) ? imported.journal : [],
    };
    persistProfileToLocalStorage(merged);
    set({ profile: merged });
  },

  resetProfile: () => {
    const fresh = createDefaultProfile();
    persistProfileToLocalStorage(fresh);
    useEconomyAccountsStore.getState().resetAccounts();
    set({ profile: fresh });
  },
}));
