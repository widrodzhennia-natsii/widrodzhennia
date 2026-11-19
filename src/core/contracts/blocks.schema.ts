import { z } from 'zod';

export const BlockHintSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1),
  correctAnswer: z.union([z.string(), z.number()]).transform(String),
  explanation: z.string().optional(),
  era: z.string().optional(),
});

export const ReactionZoneSchema = z.object({
  condition: z.string().min(1),
  emote: z.enum(['idea', 'sweat', 'question', 'joy']).optional(),
  spriteState: z.string().optional(),
  speaker: z.string().optional(),
  avatar: z.string().optional(),
  text: z.string().min(1),
});

export const QuizOptionItemSchema = z.union([
  z.string(),
  z.object({
    text: z.string().min(1),
    isCorrect: z.boolean().optional(),
    feedbackSuccess: z.string().optional(),
    feedbackFail: z.string().optional(),
  }),
]);

export const BlockAnchorFactSchema = z.object({
  id: z.string().optional(),
  type: z.literal('block_anchor_fact'),
  year: z.union([z.number(), z.string()]).optional(),
  headline: z.string().min(1, 'Заголовок факту є обов’язковим'),
  contentSummary: z.string().min(1, 'Зміст факту є обов’язковим'),
  locationLabel: z.string().default('Контекст'),
  formulaText: z.string().optional(),
  stepByStepBreakdown: z.array(z.string()).optional(),
  codeSnippet: z.string().optional(),
  codeLanguage: z.string().optional(),
  blueprintId: z.string().optional(),
  blueprint: z.record(z.string(), z.any()).optional(),
  geometry: z.record(z.string(), z.any()).optional(),
  hints: z.array(BlockHintSchema).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  vars: z.record(z.string(), z.any()).optional(),
});

export const BlockDialogueSchema = z.object({
  id: z.string().optional(),
  type: z.union([z.literal('block_dialogue'), z.literal('dialogue')]),
  speaker: z.string().min(1, 'Вкажіть персонажа'),
  avatar: z.string().default('👤'),
  emote: z.enum(['idea', 'sweat', 'question', 'joy']).catch('idea'),
  text: z.string().min(1, 'Текст репліки не може бути порожнім'),
  hints: z.array(BlockHintSchema).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  vars: z.record(z.string(), z.any()).optional(),
});

export const BlockTheoryRuleSchema = z.object({
  id: z.string().optional(),
  type: z.literal('block_theory_rule'),
  title: z.string().min(1, 'Заголовок правила є обов’язковим'),
  ruleSummary: z.string().min(1, 'Опис правила є обов’язковим'),
  formulaText: z.string().optional(),
  codeSnippet: z.string().optional(),
  codeLanguage: z.string().optional(),
  stepByStepBreakdown: z.array(z.string()).default([]),
  blueprintId: z.string().optional(),
  blueprint: z.record(z.string(), z.any()).optional(),
  geometry: z.record(z.string(), z.any()).optional(),
  hints: z.array(BlockHintSchema).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  vars: z.record(z.string(), z.any()).optional(),
});

export const BlockRecognitionQuizSchema = z.object({
  id: z.string().optional(),
  type: z.literal('block_recognition_quiz'),
  question: z.string().min(1, 'Запитання тесту є обов’язковим'),
  options: z.array(QuizOptionItemSchema).min(2, 'Мінімум 2 варіанти відповідей'),
  correctIndex: z.number().int().nonnegative('Індекс правильної відповіді має бути >= 0'),
  correctIndices: z.array(z.number().int().nonnegative()).optional(),
  multiSelect: z.boolean().optional(),
  explanation: z.string().default('Чудово! Відповідь вірна.'),
  feedbackSuccess: z.string().optional(),
  feedbackFail: z.string().optional(),
  codeSnippet: z.string().optional(),
  codeLanguage: z.string().optional(),
  hints: z.array(BlockHintSchema).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  vars: z.record(z.string(), z.any()).optional(),
});

export const BlueprintCalculationStepSchema = z.object({
  id: z.string().optional(),
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  prompt: z.string().min(1),
  correctAnswer: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  hint: z.string().optional(),
});

export const BlockNotebookTaskSchema = z.object({
  id: z.string().optional(),
  type: z.literal('block_notebook_task'),
  title: z.string().min(1, 'Заголовок завдання є обов’язковим'),
  notebookPrompt: z.string().min(1, 'Текст завдання є обов’язковим'),
  scaffoldTemplate: z.string().optional(),
  inputFieldKey: z.string().optional(),
  expectedValue: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  correctAnswer: z.union([z.string(), z.number()]).optional(),
  hint: z.string().optional(),
  hints: z.array(BlockHintSchema).optional(),
  blueprintId: z.string().optional(),
  blueprint: z.record(z.string(), z.any()).optional(),
  geometry: z.record(z.string(), z.any()).optional(),
  blueprintMode: z.enum(['progressive', 'reference', 'audit']).optional(),
  targetField: z.string().optional(),
  calculationSteps: z.array(BlueprintCalculationStepSchema).optional(),
  codeSnippet: z.string().optional(),
  codeLanguage: z.string().optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  vars: z.record(z.string(), z.any()).optional(),
  reward: z
    .object({
      wood: z.number().default(25),
      stone: z.number().default(10),
      energy: z.number().default(15),
    })
    .default({ wood: 25, stone: 10, energy: 15 }),
});

export const BlockBossChallengeSchema = z.object({
  id: z.string().optional(),
  type: z.literal('block_boss_challenge'),
  title: z.string().min(1, 'Заголовок виклику є обов’язковим'),
  contextStory: z.string().optional(),
  notebookPrompt: z.string().default('Виконайте самостійне обчислення або завдання у симуляторі!'),
  instruction: z.string().optional(),
  engineId: z.string().optional(),
  engineConfig: z.record(z.string(), z.any()).default({}),
  validation: z.any().optional(),
  expected: z.union([z.string(), z.number()]).optional(),
  correctAnswer: z.union([z.string(), z.number()]).optional(),
  hint: z.string().optional(),
  hints: z.array(BlockHintSchema).optional(),
  blueprintId: z.string().optional(),
  blueprint: z.record(z.string(), z.any()).optional(),
  geometry: z.record(z.string(), z.any()).optional(),
  blueprintMode: z.enum(['progressive', 'reference', 'audit']).optional(),
  targetField: z.string().optional(),
  calculationSteps: z.array(BlueprintCalculationStepSchema).optional(),
  codeSnippet: z.string().optional(),
  codeLanguage: z.string().optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  reactionZones: z.array(ReactionZoneSchema).optional(),
  vars: z.record(z.string(), z.any()).optional(),
  reward: z
    .object({
      wood: z.number().default(40),
      stone: z.number().default(20),
      energy: z.number().default(25),
    })
    .default({ wood: 40, stone: 20, energy: 25 }),
});

export const BlockSomaticPauseSchema = z.object({
  id: z.string().optional(),
  type: z.union([z.literal('block_somatic_pause'), z.literal('somatic_break')]),
  activity: z
    .enum(['vocal_humming', 'double_sigh', 'eye_eight', 'muscle_squeeze', 'vowel_sound_flow'])
    .catch('double_sigh')
    .optional(),
  activityId: z
    .enum(['vocal_humming', 'double_sigh', 'eye_eight', 'muscle_squeeze', 'vowel_sound_flow'])
    .catch('double_sigh'),
  durationSec: z.number().positive().default(30),
  guideVoiceText: z.string().optional(),
  inhaleSec: z.number().positive().optional(),
  holdSec: z.number().nonnegative().optional(),
  exhaleSec: z.number().positive().optional(),
  restSec: z.number().nonnegative().optional(),
  cues: z.array(z.string()).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
});

export const BlockInteractiveSandboxSchema = z.object({
  id: z.string().optional(),
  type: z.union([z.literal('block_interactive_sandbox'), z.literal('sandbox')]),
  title: z.string().optional(),
  engineId: z.string().default('balance-physics'),
  instruction: z.string().default('Експериментуйте у симуляторі!'),
  config: z.record(z.string(), z.any()).default({}),
  engineConfig: z.record(z.string(), z.any()).optional(),
  hints: z.array(BlockHintSchema).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  reactionZones: z.array(ReactionZoneSchema).optional(),
  vars: z.record(z.string(), z.any()).optional(),
});

export const BlockTextMarkingSchema = z.object({
  id: z.string().optional(),
  type: z.literal('block_text_marking'),
  title: z.string().optional(),
  prompt: z.string().min(1, 'Вкажіть інструкцію для розмітки тексту'),
  sentence: z.string().min(1, 'Речення для розбору не може бути порожнім'),
  availableTools: z.array(z.string()).min(1, 'Оберіть хоча б один інструмент розмітки'),
  toleranceMode: z.enum(['exact', 'partial']).default('exact'),
  targetTokens: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        word: z.string(),
        role: z.string(),
      })
    )
    .optional(),
  explanation: z.string().optional(),
  hint: z.string().optional(),
  hints: z.array(BlockHintSchema).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  vars: z.record(z.string(), z.any()).optional(),
  reward: z
    .object({
      wood: z.number().default(20),
      stone: z.number().default(10),
      energy: z.number().default(15),
    })
    .optional(),
});

export const BlockLogicReviewSchema = z.object({
  id: z.string().optional(),
  type: z.literal('block_logic_review'),
  title: z.string().default('Логічна оцінка та перевірка даних'),
  scenarioPrompt: z.string().min(1, 'Опис ситуації є обов’язковим'),
  claimedLabel: z.string().optional(),
  claimedValue: z.union([z.string(), z.number()]).optional(),
  blueprintId: z.string().optional(),
  blueprint: z.record(z.string(), z.any()).optional(),
  geometry: z.record(z.string(), z.any()).optional(),
  expectedVerdict: z.enum(['already_solved', 'error_found', 'missing_data']),
  verdictOptions: z
    .array(
      z.object({
        id: z.enum(['already_solved', 'error_found', 'missing_data']),
        label: z.string().min(1),
      })
    )
    .optional(),
  followUpQuestion: z.string().optional(),
  followUpAnswer: z.union([z.string(), z.number()]).optional(),
  followUpUnit: z.string().optional(),
  explanation: z.string().default('Критична перевірка допомогла ухвалити правильне рішення.'),
  hint: z.string().optional(),
  hints: z.array(BlockHintSchema).optional(),
  copilotAdvice: z.string().optional(),
  copilotHint: z.string().optional(),
  vars: z.record(z.string(), z.any()).optional(),
  reward: z
    .object({
      wood: z.number().default(25),
      stone: z.number().default(15),
      energy: z.number().default(15),
    })
    .optional(),
});

export const BlockSchema = z.union([
  BlockAnchorFactSchema,
  BlockDialogueSchema,
  BlockTheoryRuleSchema,
  BlockRecognitionQuizSchema,
  BlockNotebookTaskSchema,
  BlockBossChallengeSchema,
  BlockSomaticPauseSchema,
  BlockInteractiveSandboxSchema,
  BlockTextMarkingSchema,
  BlockLogicReviewSchema,
]);

export type BlockAnchorFact = z.infer<typeof BlockAnchorFactSchema>;
export type BlockDialogue = z.infer<typeof BlockDialogueSchema>;
export type BlockTheoryRule = z.infer<typeof BlockTheoryRuleSchema>;
export type BlockRecognitionQuiz = z.infer<typeof BlockRecognitionQuizSchema>;
export type BlockNotebookTask = z.infer<typeof BlockNotebookTaskSchema>;
export type BlockBossChallenge = z.infer<typeof BlockBossChallengeSchema>;
export type BlockSomaticPause = z.infer<typeof BlockSomaticPauseSchema>;
export type BlockInteractiveSandbox = z.infer<typeof BlockInteractiveSandboxSchema>;
export type BlockTextMarking = z.infer<typeof BlockTextMarkingSchema>;
export type BlockLogicReview = z.infer<typeof BlockLogicReviewSchema>;

export type StoryBlockZod = z.infer<typeof BlockSchema>;
