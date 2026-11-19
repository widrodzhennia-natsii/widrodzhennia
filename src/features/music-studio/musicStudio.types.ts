/**
 * Structural Contracts for the Upcoming Free Music Studio («Вільна музична майстерня»).
 * Reserved scaffold — full interactive multi-track workspace is scheduled for a future milestone
 * (see /fix_tech_patch/future_plans/MUSIC_STUDIO_FUTURE_PLAN.md).
 */

import type {
  GradeBandId,
  MusicScaleId,
  NoteDurationId,
  PlannedInstrumentTimbreId,
  RhythmBeatType,
  TimeSignatureId,
} from '../../core/audio/musicTheory';

export interface MusicStudioStep {
  id: string;
  /** Supports polyphonic chords/intervals per step (e.g., ['До', 'Мі', 'Соль']) */
  notes: string[];
  duration: NoteDurationId;
  rhythmBeat?: RhythmBeatType;
}

export interface MusicStudioComposition {
  id: string;
  title: string;
  gradeBand: GradeBandId;
  scale: MusicScaleId;
  timbre: PlannedInstrumentTimbreId;
  timeSignature: TimeSignatureId;
  tempoBpm: number;
  steps: MusicStudioStep[];
  createdAt: number;
  updatedAt: number;
}
