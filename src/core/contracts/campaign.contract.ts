/**
 * Contract specification for Story Blocks, Hints, Blueprints, and Campaign Quest Flow
 */

export interface BlockHintItem {
  id?: string;
  question: string;
  correctAnswer: string;
  explanation?: string;
  era?: string;
}

export interface QuizOptionObj {
  text: string;
  isCorrect?: boolean;
  feedbackSuccess?: string;
  feedbackFail?: string;
}

export interface ReactionZone {
  condition: string;
  emote?: 'idea' | 'sweat' | 'question' | 'joy';
  spriteState?: string;
  speaker?: string;
  avatar?: string;
  text: string;
}

export interface BlueprintCalculationStep {
  id?: string;
  fieldKey: string;
  label: string;
  prompt: string;
  correctAnswer: number | string;
  unit?: string;
  hint?: string;
}

export type StoryBlockRaw =
  // 1. Story Dialogue Step / Block
  | {
      type: 'block_dialogue' | 'dialogue';
      id?: string;
      speaker: string;
      avatar: string;
      text: string;
      emote?: 'idea' | 'sweat' | 'question' | 'joy';
      copilotAdvice?: string;
      hints?: BlockHintItem[];
    }

  // 2. Anchor Fact / Context Block
  | {
      type: 'block_anchor_fact';
      id?: string;
      year?: number | string;
      epoch?: string;
      headline?: string;
      contentSummary: string;
      factText?: string;
      locationLabel?: string;
      location?: string;
      formulaText?: string;
      stepByStepBreakdown?: string[];
      codeSnippet?: string;
      codeLanguage?: string;
      blueprintId?: string;
      blueprint?: Record<string, any>;
      geometry?: Record<string, any>;
      hints?: BlockHintItem[];
      copilotAdvice?: string;
    }

  // 3. Theory Rule Concept
  | {
      type: 'block_theory_rule';
      id?: string;
      title: string;
      ruleSummary: string;
      formulaText?: string;
      codeSnippet?: string;
      codeLanguage?: string;
      stepByStepBreakdown?: string[];
      blueprintId?: string;
      blueprint?: Record<string, any>;
      geometry?: Record<string, any>;
      hints?: BlockHintItem[];
      copilotAdvice?: string;
    }

  // 4. Interactive Sandbox / Engine Step
  | {
      type: 'block_interactive_sandbox' | 'sandbox';
      id?: string;
      title?: string;
      engineId: string;
      config: Record<string, any>;
      engineConfig?: Record<string, any>;
      instruction: string;
      hints?: BlockHintItem[];
      copilotAdvice?: string;
    }

  // 5. Recognition Quiz Step / Block
  | {
      type: 'block_recognition_quiz';
      id?: string;
      question?: string;
      prompt?: string;
      options: Array<string | QuizOptionObj>;
      correctIndex: number;
      correctIndices?: number[];
      multiSelect?: boolean;
      explanation?: string;
      feedbackSuccess?: string;
      feedbackFail?: string;
      codeSnippet?: string;
      codeLanguage?: string;
      hints?: BlockHintItem[];
      copilotAdvice?: string;
    }

  // 6. Notebook Manual / Blueprint Task
  | {
      type: 'block_notebook_task';
      id?: string;
      title?: string;
      notebookPrompt?: string;
      prompt?: string;
      scaffoldTemplate?: string;
      inputFieldKey?: string;
      expectedValue?: number | string;
      unit?: string;
      correctAnswer?: number | string;
      hint?: string;
      hints?: BlockHintItem[];
      blueprintId?: string;
      blueprint?: Record<string, any>;
      geometry?: Record<string, any>;
      blueprintMode?: 'progressive' | 'reference' | 'audit';
      targetField?: string;
      calculationSteps?: BlueprintCalculationStep[];
      codeSnippet?: string;
      codeLanguage?: string;
      copilotAdvice?: string;
      reward?: { wood: number; stone: number; energy: number };
    }

  // 7. Independent / Boss Challenge Task
  | {
      type: 'block_boss_challenge';
      id?: string;
      title?: string;
      contextStory?: string;
      notebookPrompt?: string;
      instruction?: string;
      engineId?: string;
      engineConfig?: Record<string, any>;
      validation?: any;
      expected?: number | string;
      correctAnswer?: number | string;
      hint?: string;
      hints?: BlockHintItem[];
      blueprintId?: string;
      blueprint?: Record<string, any>;
      geometry?: Record<string, any>;
      blueprintMode?: 'progressive' | 'reference' | 'audit';
      targetField?: string;
      calculationSteps?: BlueprintCalculationStep[];
      codeSnippet?: string;
      codeLanguage?: string;
      copilotAdvice?: string;
      reactionZones?: ReactionZone[];
      reward?: { wood: number; stone: number; energy: number };
    }

  // 8. Somatic Pause / Relaxation Step
  | {
      type: 'block_somatic_pause' | 'somatic_break';
      id?: string;
      activity?: 'vocal_humming' | 'double_sigh' | 'muscle_squeeze' | 'eye_eight' | 'vowel_sound_flow' | string;
      activityId?: 'vocal_humming' | 'double_sigh' | 'muscle_squeeze' | 'eye_eight' | 'vowel_sound_flow' | string;
      durationSec?: number;
      duration?: number;
      guideVoiceText?: string;
      inhaleSec?: number;
      holdSec?: number;
      exhaleSec?: number;
      restSec?: number;
      cues?: string[];
      copilotAdvice?: string;
    }

  // 8.5 Interactive Text Marking (Deferred Check)
  | {
      type: 'block_text_marking';
      id?: string;
      title?: string;
      prompt: string;
      sentence: string;
      availableTools: string[];
      toleranceMode?: 'exact' | 'partial';
      targetTokens?: Array<{ index: number; word: string; role: string }>;
      explanation?: string;
      hint?: string;
      hints?: BlockHintItem[];
      copilotAdvice?: string;
      reward?: { wood: number; stone: number; energy: number };
    }

  // 8.6 Logical Audit & Critical Evaluation of Blueprint/Data
  | {
      type: 'block_logic_review';
      id?: string;
      title?: string;
      scenarioPrompt: string;
      claimedLabel?: string;
      claimedValue?: number | string;
      blueprintId?: string;
      blueprint?: Record<string, any>;
      geometry?: Record<string, any>;
      expectedVerdict: 'already_solved' | 'error_found' | 'missing_data';
      verdictOptions?: Array<{ id: 'already_solved' | 'error_found' | 'missing_data'; label: string }>;
      followUpQuestion?: string;
      followUpAnswer?: number | string;
      followUpUnit?: string;
      explanation?: string;
      hint?: string;
      hints?: BlockHintItem[];
      copilotAdvice?: string;
      reward?: { wood: number; stone: number; energy: number };
    }

  // 9. Legacy Task Reference Step
  | {
      type: 'task_ref';
      id?: string;
      taskId: string;
      storyWrapper?: {
        intro?: string;
        winText?: string;
      };
    }

  // 10. Legacy World Event Step
  | {
      type: 'world_event';
      id?: string;
      mutationKey: string;
    };

export interface StoryBlockMeta {
  vars?: Record<string, any>;
  copilotHint?: string;
  reactionZones?: ReactionZone[];
}

export type StoryBlock = StoryBlockRaw & StoryBlockMeta;

export type QuestStep = StoryBlock;

export interface CampaignQuest {
  id: string;
  title: string;
  regionId: string;
  description: string;
  vars?: Record<string, any>;
  steps: QuestStep[];
}
