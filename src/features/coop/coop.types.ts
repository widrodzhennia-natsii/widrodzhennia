// Типи для Сімейного Co-op («Пілот і Штурман») та структурна основа Командної гри (2–4 учасники з ротацією ролей)
// Детальні плани:
// - fix_tech_patch/future_plans/STAGE_5_AUTHOR_STUDIO_AND_TEAM_COOP.md
// - fix_tech_patch/future_plans/TEAM_COOP_FUTURE_PLAN.md

export type FamilyCoopRole = 'pilot' | 'navigator';

export type CoopRole = 'engineer' | 'navigator' | 'archivist' | 'economist';

export type CoopSyncTransport = 'pass_and_play' | 'projector' | 'qr_sync' | 'web_bluetooth';

export type PilotControlType = 'choices' | 'slider' | 'numeric';

export interface FamilyCoopStep {
  id: string;
  title: string;
  navigatorBriefing: string;
  navigatorDiagram?: string;
  navigatorStrategyHint: string;
  pilotPrompt: string;
  controlType: PilotControlType;
  options?: string[];
  sliderConfig?: {
    min: number;
    max: number;
    step: number;
    unit: string;
    initial: number;
  };
  unit?: string;
  expectedAnswer: string | number;
  tolerance?: number;
  successReflection: string;
}

export interface CoopMission {
  id: string;
  title: string;
  subjectLabel: string;
  difficultyLabel: string;
  description: string;
  rewardPoints: {
    collaboration: number;
    leadership: number;
    energy: number;
  };
  steps: FamilyCoopStep[];
}

export interface TeamRoleBlueprint {
  role: CoopRole;
  title: string;
  icon: string;
  responsibility: string;
  rotationFocus: string;
}

export interface TeamTransportBlueprint {
  transport: CoopSyncTransport;
  title: string;
  icon: string;
  summary: string;
  statusLabel: string;
}
