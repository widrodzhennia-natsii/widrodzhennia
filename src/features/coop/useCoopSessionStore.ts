// Стан сімейного Co-op («Пілот і Штурман») та структурний стан командного каркасу (2–4 ролі)
// Детальний план командного режиму: fix_tech_patch/future_plans/TEAM_COOP_FUTURE_PLAN.md

import { create } from 'zustand';
import type { CoopRole, CoopSyncTransport } from './coop.types';

export type CoopModeTab = 'family' | 'team_blueprint';

interface CoopSessionState {
  activeTab: CoopModeTab;
  pilotName: string;
  navigatorName: string;
  isRolesSwapped: boolean;
  activeMissionIndex: number;
  activeStepIndex: number;
  navigatorHintRevealed: boolean;
  completedStepIds: string[];
  completedMissionIds: string[];
  // Structural blueprint preview state for 2-4 role rotation
  teamActiveRole: CoopRole;
  teamTransport: CoopSyncTransport;

  setActiveTab: (tab: CoopModeTab) => void;
  setPlayerNames: (pilotName: string, navigatorName: string) => void;
  swapRoles: () => void;
  selectMission: (index: number) => void;
  selectStep: (index: number) => void;
  toggleNavigatorHint: () => void;
  markStepCompleted: (stepId: string, missionId: string, totalStepsInMission: number) => boolean;
  rotateTeamRolePreview: () => void;
  setTeamTransportPreview: (transport: CoopSyncTransport) => void;
}

const TEAM_ROTATION_ORDER: CoopRole[] = ['engineer', 'navigator', 'archivist', 'economist'];

export const useCoopSessionStore = create<CoopSessionState>((set) => ({
  activeTab: 'family',
  pilotName: 'Гравець 1',
  navigatorName: 'Гравець 2',
  isRolesSwapped: false,
  activeMissionIndex: 0,
  activeStepIndex: 0,
  navigatorHintRevealed: false,
  completedStepIds: [],
  completedMissionIds: [],
  teamActiveRole: 'engineer',
  teamTransport: 'pass_and_play',

  setActiveTab: (tab) => set({ activeTab: tab }),

  setPlayerNames: (pilotName, navigatorName) =>
    set({
      pilotName: pilotName || 'Гравець 1',
      navigatorName: navigatorName || 'Гравець 2',
    }),

  swapRoles: () =>
    set((state) => ({
      isRolesSwapped: !state.isRolesSwapped,
    })),

  selectMission: (index) =>
    set({
      activeMissionIndex: Math.max(0, index),
      activeStepIndex: 0,
      navigatorHintRevealed: false,
    }),

  selectStep: (index) =>
    set({
      activeStepIndex: Math.max(0, index),
      navigatorHintRevealed: false,
    }),

  toggleNavigatorHint: () =>
    set((state) => ({ navigatorHintRevealed: !state.navigatorHintRevealed })),

  markStepCompleted: (stepId, missionId, totalStepsInMission) => {
    let missionNewlyCompleted = false;
    set((state) => {
      const nextCompletedSteps = state.completedStepIds.includes(stepId)
        ? state.completedStepIds
        : [...state.completedStepIds, stepId];

      const isLastStep = state.activeStepIndex >= totalStepsInMission - 1;
      const alreadyDone = state.completedMissionIds.includes(missionId);
      let nextCompletedMissions = state.completedMissionIds;
      if (isLastStep && !alreadyDone) {
        missionNewlyCompleted = true;
        nextCompletedMissions = [...state.completedMissionIds, missionId];
      }

      return {
        completedStepIds: nextCompletedSteps,
        completedMissionIds: nextCompletedMissions,
        navigatorHintRevealed: false,
      };
    });
    return missionNewlyCompleted;
  },

  rotateTeamRolePreview: () =>
    set((state) => {
      const idx = TEAM_ROTATION_ORDER.indexOf(state.teamActiveRole);
      const next = TEAM_ROTATION_ORDER[(idx + 1) % TEAM_ROTATION_ORDER.length];
      return { teamActiveRole: next };
    }),

  setTeamTransportPreview: (transport) => set({ teamTransport: transport }),
}));
