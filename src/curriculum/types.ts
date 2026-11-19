import { Blueprint } from '../core/contracts/blueprint.schema';
import { BlockHintItem } from '../core/contracts/campaign.contract';

export interface ConceptBreakdown {
  number1: number;
  tens1: number;
  ones1: number;
  number2: number;
  tens2: number;
  ones2: number;
  sumTens: number;
  sumOnes: number;
  totalSum: number;
}

export interface TheoryConcept {
  title: string;
  ruleSummary: string;
  formulaText?: string;
  stepByStepBreakdown: string[];
}

export interface RecognitionQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MultipleChoiceTask {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ManualTask {
  id: string;
  title: string;
  contextStory: string;
  notebookPrompt: string;
  question: string;
  correctAnswer: number | string;
  hint: string;
  hints?: BlockHintItem[];
  reward: {
    wood: number;
    stone: number;
    energy: number;
  };
}

export interface ChapterLesson {
  id: string;
  title: string;
  islandStageName?: string;
  description: string;
  storyText: string;
  conceptTitle: string;
  conceptBreakdown: ConceptBreakdown;
  theoryConcept?: TheoryConcept;
  recognitionQuestion: RecognitionQuestion;
  multipleChoiceTasks: MultipleChoiceTask[];
  notebookManualTasks: ManualTask[];
  independentChallengeTask: ManualTask;
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  islandStageName?: string;
  subjectId?: string;
  gradeId?: string;
  mapTopology?: WorldMapSchema;
  lesson: ChapterLesson;
}

export interface SubjectConfig {
  id: string;
  name: string;
  description: string;
  iconName: string;
  isAvailable: boolean;
  chapters: Chapter[];
  blueprints?: Record<string, Blueprint>;
  subjectCategory?: string;
  authorLabel?: string;
  isCustom?: boolean;
  gradeId?: string;
}

export interface GradeConfig {
  id: string;
  gradeNumber: number;
  name: string;
  description: string;
  isAvailable: boolean;
  hasPartialMaterials?: boolean;
  subjects: SubjectConfig[];
}

export interface HistoryHintQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  explanation: string;
  era: string;
}

export type ExtensionMode = 'append' | 'alternative' | 'custom_standalone' | 'create_new_book' | 'extend_lesson';

export interface WorldMapNode {
  id: string;
  title?: string;
  label?: string;
  type: 'region' | 'quest' | 'exercise' | 'region_main' | 'quest_episode';
  x: number;
  y: number;
  regionId?: string;
  questId?: string;
  status?: 'completed' | 'current' | 'locked';
  connectedTo?: string[];
  parentId?: string;
  lane?: 'upper' | 'spine' | 'lower';
  isCompleted?: boolean;
  isUnlocked?: boolean;
}

export interface WorldMapSchema {
  mapTitle: string;
  gradeNumber?: number | string;
  grade?: number | string;
  subject?: string;
  nodes: WorldMapNode[];
}
