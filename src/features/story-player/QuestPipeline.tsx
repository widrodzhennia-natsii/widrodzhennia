import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BlueprintCalculationStep, StoryBlock } from '../../core/contracts/campaign.contract';
import { DialogueCard } from './DialogueCard';
import { CopilotBar } from './CopilotBar';
import { SomaticPauseModal } from './SomaticPauseModal';
import { EngineRegistry } from '../../engines/registry';
import { useSessionStore } from '../../core/state/useSessionStore';
import { useProfileStore } from '../../core/state/useProfileStore';
import { useSettingsStore } from '../../core/state/useSettingsStore';
import {
  useLayoutPrefsStore,
  resolveEffectiveDensity,
  DensityPreference,
  ResolvedDensityMode,
} from '../../core/state/useLayoutPrefsStore';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { useHintGate } from '../../hooks/useHintGate';
import { useAttemptTracker } from '../../hooks/useAttemptTracker';
import { computeCascadeWindow } from '../../hooks/useActiveLessonSession';
import { Button } from '../../components/ui/Button';
import { RichBlockText } from '../../components/ui/RichBlockText';
import { YamlCurriculumParser } from '../../services/yamlCurriculumParser';
import { applyVarsToValue, resolveVarsSpec } from '../../core/vars/var-engine';
import { TextMarkingBlock } from './TextMarkingBlock';
import { BlueprintDiagramCard } from './BlueprintDiagramCard';
import { TextLensSwitch, TextLensMode } from './TextLensSwitch';
import { useLessonScopeStore } from '../../core/vars/useLessonScopeStore';
import { RealWorldBridgeCard } from '../bridges/RealWorldBridgeCard';

interface QuestPipelineProps {
  questId: string;
  questTitle?: string;
  subjectId?: string;
  steps: StoryBlock[];
  hasNextChapter?: boolean;
  nextChapterTitle?: string;
  onNextChapter?: () => void;
  onBackToSubject?: () => void;
  hasContext?: boolean;
  showContextPanel?: boolean;
  onToggleContextPanel?: () => void;
}

interface StepFeedbackState {
  stepIndex: number;
  isError: boolean;
  text: string;
}

interface StepBlockCardProps {
  questId: string;
  rawStep: StoryBlock;
  stepIndex: number;
  totalSteps: number;
  isCurrent: boolean;
  effectiveDensity: ResolvedDensityMode;
  autoPlayDialoguesInDoc: boolean;
  activeLens: TextLensMode;
  nearestTheoryStepIndex: number | null;
  inputValue: string;
  isCompleted: boolean;
  unlockedKeysRaw: string;
  verdictDraft: string;
  stepFeedback: StepFeedbackState | null;
  profileSeed: string;
  variantNonce: number;
  onSetInputDraft: (blockId: string, val: string | number) => void;
  onSetStepFeedback: (fb: StepFeedbackState | null) => void;
  onBumpVariantNonce: () => void;
  onFocusStep: (idx: number) => void;
  onAdvance: (stepIndex: number, blockId: string) => void;
  onJumpToTheory: (fromIndex: number) => void;
  onOpenHint: (
    blockId: string,
    step: StoryBlock,
    nearestTheoryIdx: number | null,
    mode?: 'standard' | 'captcha' | 'alternatives'
  ) => void;
  onWrongAttempt: (
    blockId: string,
    step: StoryBlock,
    nearestTheoryIdx: number | null,
    sig: string
  ) => void;
  onCorrectAttempt: (blockId: string) => void;
  onAddResilienceXp: (xp: number) => void;
  onAddTraitPoints: (trait: any, pts: number) => void;
  onCompleteTask: (
    blockId: string,
    reward: any,
    label?: string,
    variantMeta?: { variantNonce?: number; hasVars?: boolean }
  ) => void;
  onPlaySuccess: () => void;
  onPlayError: () => void;
}

interface BlueprintProgressionState {
  maskedKeys: string[];
  unlockedKeys: string[];
  calcSteps: BlueprintCalculationStep[];
  activeCalcStepIndex: number;
  activeCalcStep: BlueprintCalculationStep | null;
}

function resolveBlueprintProgression(
  step: any,
  targetAns: unknown,
  unlockedKeysRaw: string,
  isCompleted: boolean
): BlueprintProgressionState {
  const mode = step?.blueprintMode;
  if (mode === 'reference' || mode === 'audit') {
    return {
      maskedKeys: [],
      unlockedKeys: [],
      calcSteps: [],
      activeCalcStepIndex: -1,
      activeCalcStep: null,
    };
  }

  const calcSteps: BlueprintCalculationStep[] = Array.isArray(step?.calculationSteps)
    ? step.calculationSteps
    : [];

  if (calcSteps.length > 0) {
    const allKeys = calcSteps.map((c) => c.fieldKey).filter(Boolean);
    const savedUnlocked = unlockedKeysRaw ? unlockedKeysRaw.split(',').filter(Boolean) : [];
    const unlockedKeys = isCompleted ? allKeys : savedUnlocked;
    const activeCalcStepIndex = calcSteps.findIndex((c) => !unlockedKeys.includes(c.fieldKey));
    return {
      maskedKeys: allKeys,
      unlockedKeys,
      calcSteps,
      activeCalcStepIndex,
      activeCalcStep: activeCalcStepIndex >= 0 ? calcSteps[activeCalcStepIndex] : null,
    };
  }

  let targetKey: string | undefined =
    typeof step?.targetField === 'string' && step.targetField.trim() !== ''
      ? step.targetField.trim()
      : undefined;

  if (!targetKey && (step?.blueprint || step?.geometry)) {
    const ansStr = targetAns !== undefined && targetAns !== null ? String(targetAns).trim() : '';
    if (ansStr !== '') {
      const pool: Record<string, unknown> = {
        ...(step.geometry || {}),
        ...(step.blueprint?.geometry || {}),
        ...(step.blueprint?.materials || {}),
      };
      const priorityKeys = [
        'totalWidthCm',
        'totalWidth',
        'totalSpanMeters',
        'spanMeters',
        'archHeightCm',
        'heightCm',
        'widthCm',
        'heightMeters',
      ];
      targetKey = priorityKeys.find(
        (k) => pool[k] !== undefined && String(pool[k]).trim() === ansStr
      );
      if (!targetKey) {
        const matches = Object.entries(pool)
          .filter(([, v]) => v !== undefined && String(v).trim() === ansStr)
          .map(([k]) => k);
        if (matches.length === 1) {
          targetKey = matches[0];
        }
      }
    }
  }

  const maskedKeys = targetKey ? [targetKey] : [];
  const unlockedKeys = isCompleted && targetKey ? [targetKey] : [];

  return {
    maskedKeys,
    unlockedKeys,
    calcSteps: [],
    activeCalcStepIndex: -1,
    activeCalcStep: null,
  };
}

const StepBlockCard: React.FC<StepBlockCardProps> = ({
  questId,
  rawStep,
  stepIndex,
  totalSteps,
  isCurrent,
  effectiveDensity,
  autoPlayDialoguesInDoc,
  activeLens,
  nearestTheoryStepIndex,
  inputValue,
  isCompleted,
  unlockedKeysRaw,
  verdictDraft,
  stepFeedback,
  profileSeed,
  variantNonce,
  onSetInputDraft,
  onSetStepFeedback,
  onBumpVariantNonce,
  onFocusStep,
  onAdvance,
  onJumpToTheory,
  onOpenHint,
  onWrongAttempt,
  onCorrectAttempt,
  onAddResilienceXp,
  onAddTraitPoints,
  onCompleteTask,
  onPlaySuccess,
  onPlayError,
}) => {
  const isLast = stepIndex >= totalSteps - 1;
  const blockId = rawStep.id || `step_${stepIndex}`;
  const resetSignal = `${questId}_${stepIndex}_${variantNonce}`;

  const resolvedVars = useMemo(
    () =>
      resolveVarsSpec(rawStep.vars, {
        profileSeed,
        lessonId: blockId,
        chapterId: questId,
        variantNonce,
      }),
    [rawStep.vars, profileSeed, blockId, questId, variantNonce]
  );

  const currentStep = useMemo(
    () =>
      Object.keys(resolvedVars).length > 0 || rawStep.vars
        ? applyVarsToValue(rawStep, resolvedVars)
        : rawStep,
    [rawStep, resolvedVars]
  );

  const hasBlockVars = Boolean(rawStep.vars && Object.keys(rawStep.vars).length > 0);
  const localFeedback = stepFeedback?.stepIndex === stepIndex ? stepFeedback : null;
  const isStacked = effectiveDensity !== 'slides';

  const stepLabel =
    (currentStep as any).title ||
    (currentStep as any).headline ||
    (currentStep as any).question ||
    (currentStep as any).speaker ||
    '';

  const handleStepAdvance = () => onAdvance(stepIndex, blockId);
  const handleStepJumpTheory = () => onJumpToTheory(stepIndex);
  const handleStepHint = (mode?: 'standard' | 'captcha' | 'alternatives') =>
    onOpenHint(blockId, currentStep, nearestTheoryStepIndex, mode);
  const handleStepWrong = (sig: string) =>
    onWrongAttempt(blockId, currentStep, nearestTheoryStepIndex, sig);

  return (
    <section
      id={`lesson-step-${stepIndex}`}
      onFocusCapture={() => {
        if (effectiveDensity === 'cascade' && !isCurrent) {
          onFocusStep(stepIndex);
        }
      }}
      onPointerDownCapture={() => {
        if (effectiveDensity === 'cascade' && !isCurrent) {
          onFocusStep(stepIndex);
        }
      }}
      className={`scroll-mt-24 transition-all ${
        isStacked && isCurrent
          ? 'ring-2 ring-[var(--accent)] rounded-[var(--radius-md)] p-1 bg-[var(--surface-alt)]'
          : ''
      }`}
    >
      {isStacked && (
        <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => onFocusStep(stepIndex)}
            className={`font-extrabold uppercase tracking-wide flex items-center gap-1.5 cursor-pointer min-w-0 ${
              isCurrent
                ? 'text-[var(--primary-dark)]'
                : 'text-[var(--text-muted)] hover:text-[var(--primary-dark)]'
            }`}
          >
            <span className="font-mono shrink-0">
              Крок {stepIndex + 1}/{totalSteps}
            </span>
            {stepLabel && (
              <span className="font-semibold normal-case truncate max-w-[240px] sm:max-w-[420px]">
                · {String(stepLabel)}
              </span>
            )}
          </button>
          {isCurrent && (
            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--hl-bg)] border border-[var(--hl-border)] text-[var(--hl-text)] text-[10px] font-extrabold shrink-0">
              Активний
            </span>
          )}
        </div>
      )}

      {/* 1. DIALOGUE BLOCK */}
      {(currentStep.type === 'block_dialogue' || currentStep.type === 'dialogue') && (
        <DialogueCard
          speaker={currentStep.speaker || 'Наставник'}
          avatar={currentStep.avatar || '👤'}
          text={currentStep.text || (currentStep as any).content || (currentStep as any).title || '...'}
          emote={currentStep.emote}
          vars={resolvedVars}
          onNext={() => {
            onAddTraitPoints('collaboration', 2);
            handleStepAdvance();
          }}
          isLastStep={isLast}
          instantReveal={effectiveDensity === 'document' ? !autoPlayDialoguesInDoc : !isCurrent}
          hideActionRow={isStacked && !isCurrent}
        />
      )}

      {/* 2. CONTEXT / ANCHOR FACT BLOCK */}
      {currentStep.type === 'block_anchor_fact' && (
        <div className="p-5 bg-[var(--color-fact-bg)] border border-[var(--color-fact-border)] rounded-[var(--radius-md)] shadow-card space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="px-2.5 py-1 text-[11px] font-bold bg-[var(--accent)] text-[var(--accent-text)] rounded shadow-xs">
              📜 {currentStep.year && String(currentStep.year) !== '0' ? `${currentStep.year} · ` : ''}
              {currentStep.locationLabel || 'Контекст уроку'}
            </span>
          </div>

          {currentStep.headline && (
            <h3 className="text-base font-extrabold text-[var(--hl-text)]">
              {currentStep.headline}
            </h3>
          )}

          <div className="text-[14px] text-[var(--color-text)] leading-relaxed font-medium p-3.5 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] shadow-xs space-y-3">
            <RichBlockText
              text={
                currentStep.contentSummary ||
                (currentStep as any).factText ||
                (currentStep as any).text ||
                (currentStep as any).content ||
                (currentStep as any).description ||
                (currentStep as any).summary ||
                (currentStep as any).ruleSummary ||
                currentStep.headline ||
                'Теоретичні та контекстні відомості.'
              }
              codeSnippet={currentStep.codeSnippet}
              codeLanguage={currentStep.codeLanguage}
              vars={resolvedVars}
              interactiveWidgets={true}
              resetSignal={resetSignal}
              activeLens={activeLens}
            />

            {currentStep.formulaText && (
              <div className="p-3 bg-[var(--color-bg)] rounded border-2 border-[var(--color-primary)] text-center font-mono font-extrabold text-lg text-[var(--color-primary-dark)] shadow-xs">
                {currentStep.formulaText}
              </div>
            )}

            {currentStep.stepByStepBreakdown && currentStep.stepByStepBreakdown.length > 0 && (
              <ul className="space-y-2 pt-1">
                {currentStep.stepByStepBreakdown.map((item, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 bg-[var(--color-surface-subtle)] rounded border border-[var(--color-border)] flex items-start gap-3 text-[13px]"
                  >
                    <span className="flex items-center justify-center w-5 h-5 bg-[var(--accent)] text-[var(--accent-text)] text-[10px] font-extrabold rounded-[var(--radius-sm)] shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <RichBlockText text={item} vars={resolvedVars} activeLens={activeLens} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <BlueprintDiagramCard blueprint={currentStep.blueprint} geometry={currentStep.geometry} />

          {(!isStacked || isCurrent) && (
            <Button
              variant="primary"
              onClick={() => {
                onAddTraitPoints('curiosity', 4);
                handleStepAdvance();
              }}
              className="w-full text-xs font-bold py-3 mt-2"
            >
              {isLast ? 'Завершити розбір 🎯' : 'Зрозуміло! Продовжити →'}
            </Button>
          )}
        </div>
      )}

      {/* 3. THEORY RULE BLOCK */}
      {currentStep.type === 'block_theory_rule' && (
        <div className="p-5 sm:p-6 bg-[var(--color-theory-bg)] border-2 border-[var(--color-theory-border)] rounded-[var(--radius-md)] shadow-card space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--color-primary-dark)] uppercase tracking-wide">
              <span className="w-6 h-6 flex items-center justify-center bg-[var(--accent)] text-[var(--accent-text)] rounded-[var(--radius-sm)] text-[10px]">
                📖
              </span>
              Опорний конспект
            </div>
            <h3 className="text-xl font-extrabold text-[var(--color-text)] mt-1">{currentStep.title}</h3>
          </div>

          <div className="p-4 sm:p-5 bg-[var(--color-theory-accent)] border border-[var(--color-fact-border)] rounded-[var(--radius-sm)] space-y-3">
            <div className="text-[14px] font-semibold text-[var(--color-text)] leading-relaxed">
              <RichBlockText
                text={
                  currentStep.ruleSummary ||
                  (currentStep as any).summary ||
                  (currentStep as any).rule ||
                  (currentStep as any).theory ||
                  (currentStep as any).theoryText ||
                  (currentStep as any).explanation ||
                  (currentStep as any).definition ||
                  (currentStep as any).text ||
                  (currentStep as any).content ||
                  (currentStep as any).contentSummary ||
                  (currentStep as any).description ||
                  currentStep.title ||
                  'Опорне правило уроку.'
                }
                codeSnippet={currentStep.codeSnippet}
                codeLanguage={currentStep.codeLanguage}
                vars={resolvedVars}
                interactiveWidgets={true}
                resetSignal={resetSignal}
                activeLens={activeLens}
              />
            </div>

            {currentStep.formulaText && (
              <div className="p-4 bg-[var(--color-surface)] rounded border-2 border-[var(--color-primary)] text-center font-mono font-extrabold text-xl text-[var(--color-primary-dark)] shadow-sm">
                {currentStep.formulaText}
              </div>
            )}
          </div>

          <BlueprintDiagramCard blueprint={currentStep.blueprint} geometry={currentStep.geometry} />

          {currentStep.stepByStepBreakdown && currentStep.stepByStepBreakdown.length > 0 && (
            <div className="space-y-3">
              <span className="text-[11px] font-extrabold text-[var(--color-muted)] uppercase tracking-wide">
                Покроковий алгоритм дій:
              </span>
              <ul className="grid grid-cols-1 gap-2.5">
                {currentStep.stepByStepBreakdown.map((item, idx) => (
                  <li
                    key={idx}
                    className="p-3.5 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)] flex items-start gap-4 shadow-xs"
                  >
                    <span className="flex items-center justify-center w-6 h-6 bg-[var(--accent)] text-[var(--accent-text)] text-[11px] font-extrabold rounded-[var(--radius-sm)] shrink-0 shadow-sm">
                      {idx + 1}
                    </span>
                    <div className="text-[13px] font-semibold leading-normal text-[var(--color-text)] flex-1 min-w-0">
                      <RichBlockText text={item} vars={resolvedVars} activeLens={activeLens} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(!isStacked || isCurrent) && (
            <Button
              variant="accent"
              onClick={() => {
                onAddTraitPoints('curiosity', 5);
                handleStepAdvance();
              }}
              className="w-full text-xs font-extrabold py-3.5 shadow-sm"
            >
              {isLast ? 'Завершити розбір 🎯' : 'Зрозуміло! Перейти далі →'}
            </Button>
          )}
        </div>
      )}

      {/* 4. INTERACTIVE ENGINE / SANDBOX BLOCK */}
      {(currentStep.type === 'block_interactive_sandbox' || currentStep.type === 'sandbox') && (
        <div className="space-y-3">
          <div className="p-3 bg-[var(--hl-bg)] border border-[var(--hl-border)] rounded-[var(--radius-sm)] text-xs font-bold text-[var(--hl-text)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <span aria-hidden="true">💡</span>
              <RichBlockText text={currentStep.instruction} vars={resolvedVars} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {nearestTheoryStepIndex !== null && (
                <Button type="button" variant="outline" size="sm" onClick={handleStepJumpTheory}>
                  📖 Теорія (0 ₴)
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => handleStepHint()}>
                💡 Підказка
              </Button>
            </div>
          </div>

          {(() => {
            const EngineComp = EngineRegistry.getComponent(currentStep.engineId);
            if (!EngineComp) {
              return (
                <div className="p-4 bg-[var(--color-guidance-bg)] text-[var(--color-guidance-text)] rounded text-xs font-bold border border-[var(--color-guidance-border)]">
                  Інтерактивний рушій для цього етапу не знайдено у реєстрі.
                </div>
              );
            }
            const mergedConfig = {
              ...(currentStep.engineConfig || {}),
              ...(currentStep.config || {}),
              ...(currentStep.reactionZones ? { reactionZones: currentStep.reactionZones } : {}),
            };
            return (
              <EngineComp
                config={mergedConfig}
                onSubmitAnswer={() => {
                  onPlaySuccess();
                  onCorrectAttempt(blockId);
                  onAddResilienceXp(15);
                  onAddTraitPoints('engineering', 15);
                  onAddTraitPoints('spatial', 10);
                  onCompleteTask(
                    blockId,
                    { wood: 10, stone: 5, energy: 10 },
                    currentStep.instruction,
                    { variantNonce, hasVars: hasBlockVars }
                  );
                  handleStepAdvance();
                }}
              />
            );
          })()}
        </div>
      )}

      {/* 5. RECOGNITION QUIZ BLOCK (String + Object options + multiSelect) */}
      {currentStep.type === 'block_recognition_quiz' &&
        (() => {
          const opts = currentStep.options || [];
          const isMulti = Boolean(
            currentStep.multiSelect &&
              Array.isArray(currentStep.correctIndices) &&
              currentStep.correctIndices.length > 1
          );
          const selectedIndices = isMulti
            ? String(inputValue || '')
                .split(',')
                .filter(Boolean)
                .map(Number)
            : inputValue !== ''
            ? [Number(inputValue)]
            : [];

          const isOptionCorrect = (idx: number): boolean => {
            const item = opts[idx];
            if (typeof item === 'object' && item !== null && item.isCorrect !== undefined) {
              return Boolean(item.isCorrect);
            }
            if (isMulti && currentStep.correctIndices) {
              return currentStep.correctIndices.includes(idx);
            }
            return idx === (currentStep.correctIndex ?? 0);
          };

          const solvedQuiz = isMulti
            ? Boolean(
                currentStep.correctIndices &&
                  selectedIndices.length === currentStep.correctIndices.length &&
                  currentStep.correctIndices.every((ci) => selectedIndices.includes(ci))
              )
            : selectedIndices.length === 1 && isOptionCorrect(selectedIndices[0]);

          const lastChosenIdx =
            selectedIndices.length > 0 ? selectedIndices[selectedIndices.length - 1] : null;
          const lastChosenObj =
            lastChosenIdx !== null && typeof opts[lastChosenIdx] === 'object'
              ? (opts[lastChosenIdx] as any)
              : null;

          return (
            <div className="p-5 bg-[var(--color-quiz-bg)] border border-[var(--color-quiz-border)] rounded-[var(--radius-md)] shadow-card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-xs font-extrabold text-[var(--color-primary-dark)] uppercase tracking-wide">
                    🎯 {isMulti ? 'Тест (кілька правильних варіантів)' : 'Тест на розуміння'}
                  </span>
                  <h4 className="text-sm font-extrabold text-[var(--color-text)]">
                    <RichBlockText
                      text={
                        currentStep.question ||
                        (currentStep as any).prompt ||
                        'Оберіть правильний варіант'
                      }
                      codeSnippet={currentStep.codeSnippet}
                      codeLanguage={currentStep.codeLanguage}
                      vars={resolvedVars}
                    />
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
                  {nearestTheoryStepIndex !== null && (
                    <Button type="button" variant="outline" size="sm" onClick={handleStepJumpTheory}>
                      📖 Теорія (0 ₴)
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => handleStepHint()}>
                    💡 Підказка
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {opts.map((opt, idx) => {
                  const isSelected = selectedIndices.includes(idx);
                  const isCorrect = isOptionCorrect(idx);
                  const label = typeof opt === 'string' ? opt : opt?.text || String(opt);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isMulti) {
                          const nextSet = new Set(selectedIndices);
                          if (nextSet.has(idx)) nextSet.delete(idx);
                          else nextSet.add(idx);
                          const nextStr = Array.from(nextSet).join(',');
                          onSetInputDraft(blockId, nextStr);
                          if (isCorrect && nextSet.has(idx)) {
                            onPlaySuccess();
                          } else if (!isCorrect && nextSet.has(idx)) {
                            onPlayError();
                            handleStepWrong(`quiz:${idx}`);
                          }
                        } else {
                          onSetInputDraft(blockId, idx);
                          if (isCorrect) {
                            onPlaySuccess();
                            onCorrectAttempt(blockId);
                          } else {
                            onPlayError();
                            handleStepWrong(`quiz:${idx}`);
                          }
                        }
                      }}
                      className={`p-3 text-left rounded-[var(--radius-sm)] text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? isCorrect
                            ? 'bg-[var(--color-quiz-correct-bg)] border-[var(--color-quiz-correct-border)] text-[var(--color-success-text)]'
                            : 'bg-[var(--color-quiz-wrong-bg)] border-[var(--color-quiz-wrong-border)] text-[var(--color-danger-text)]'
                          : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border-[var(--color-border)]'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="font-mono text-[var(--color-muted)] shrink-0">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <RichBlockText text={label} vars={resolvedVars} className="flex-1 min-w-0" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedIndices.length > 0 && (
                <div className={`status-panel ${solvedQuiz ? 'status-panel--success' : 'status-panel--warning'}`}>
                  {solvedQuiz ? (
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0">✅ Вірно!</span>
                      <RichBlockText
                        text={
                          lastChosenObj?.feedbackSuccess ||
                          currentStep.explanation ||
                          currentStep.feedbackSuccess ||
                          'Розрахунок точний!'
                        }
                        vars={resolvedVars}
                        className="flex-1 min-w-0"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <span className="shrink-0">💡</span>
                        <RichBlockText
                          text={
                            lastChosenIdx !== null &&
                            !isOptionCorrect(lastChosenIdx) &&
                            lastChosenObj?.feedbackFail
                              ? lastChosenObj.feedbackFail
                              : isMulti
                              ? 'Оберіть усі правильні варіанти або скористайтеся підказкою.'
                              : currentStep.feedbackFail || 'Перевірте правило теорії або відкрийте підказку.'
                          }
                          vars={resolvedVars}
                          className="flex-1 min-w-0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleStepHint('alternatives')}
                      >
                        Мені складно
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {solvedQuiz && (
                <Button
                  variant="primary"
                  onClick={() => {
                    onCorrectAttempt(blockId);
                    onAddTraitPoints('criticalThinking', 12);
                    onCompleteTask(
                      blockId,
                      { wood: 10, stone: 5, energy: 10 },
                      currentStep.question,
                      { variantNonce, hasVars: hasBlockVars }
                    );
                    handleStepAdvance();
                  }}
                  className="w-full"
                >
                  {isLast ? 'Завершити тест 🎯' : 'Продовжити далі →'}
                </Button>
              )}
            </div>
          );
        })()}

      {/* 6. NOTEBOOK / BLUEPRINT MANUAL TASK BLOCK */}
      {currentStep.type === 'block_notebook_task' &&
        (() => {
          const singleTargetAns =
            currentStep.correctAnswer !== undefined
              ? currentStep.correctAnswer
              : (currentStep as any).expectedValue;
          const bpState = resolveBlueprintProgression(
            currentStep,
            singleTargetAns,
            unlockedKeysRaw,
            isCompleted
          );
          const activeHintStep =
            bpState.activeCalcStep?.hint
              ? ({ ...currentStep, hint: bpState.activeCalcStep.hint } as StoryBlock)
              : currentStep;

          return (
            <div className="p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[var(--color-primary-dark)] uppercase tracking-wide">
                  📝 Практичне завдання у чернетці
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {hasBlockVars && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onBumpVariantNonce();
                        onSetStepFeedback(null);
                      }}
                    >
                      🔄 Інший варіант чисел
                    </Button>
                  )}
                  {nearestTheoryStepIndex !== null && (
                    <Button type="button" variant="outline" size="sm" onClick={handleStepJumpTheory}>
                      📖 Теорія (0 ₴)
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenHint(blockId, activeHintStep, nearestTheoryStepIndex)}
                  >
                    💡 Підказка
                  </Button>
                  <span className="text-xs text-[var(--color-accent)] font-extrabold">
                    🏆 +{currentStep.reward?.wood || 25} балів
                  </span>
                </div>
              </div>

              <BlueprintDiagramCard
                blueprint={currentStep.blueprint}
                geometry={currentStep.geometry}
                maskedKeys={bpState.maskedKeys}
                unlockedKeys={bpState.unlockedKeys}
              />

              <div className="p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2.5">
                <span className="text-xs font-extrabold text-[var(--primary-dark)] block">
                  {currentStep.title || 'Вправа для розрахунків у чорновику'}
                </span>
                <div className="text-[14px] font-semibold text-[var(--text)] leading-relaxed">
                  <RichBlockText
                    text={currentStep.notebookPrompt || (currentStep as any).prompt || (currentStep as any).text}
                    codeSnippet={currentStep.codeSnippet}
                    codeLanguage={currentStep.codeLanguage}
                    vars={resolvedVars}
                    interactiveWidgets={true}
                    resetSignal={resetSignal}
                  />
                </div>

                {bpState.calcSteps.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <div className="flex flex-wrap gap-1.5">
                      {bpState.calcSteps.map((cs, cIdx) => {
                        const isDone = bpState.unlockedKeys.includes(cs.fieldKey);
                        const isNow = cIdx === bpState.activeCalcStepIndex;
                        return (
                          <div
                            key={cs.id || cs.fieldKey}
                            className={`px-2.5 py-1 rounded-[var(--radius-sm)] border text-[11px] font-bold flex items-center gap-1.5 ${
                              isDone
                                ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                                : isNow
                                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
                            }`}
                          >
                            <span className="font-mono">{cIdx + 1}.</span>
                            <span>{cs.label}</span>
                            {isDone && <span>✓</span>}
                          </div>
                        );
                      })}
                    </div>

                    {bpState.activeCalcStep && (
                      <div className="p-3 bg-[var(--surface)] border border-[var(--border-hover)] rounded-[var(--radius-sm)] text-[13px] font-bold text-[var(--text)]">
                        <RichBlockText text={bpState.activeCalcStep.prompt} vars={resolvedVars} />
                      </div>
                    )}
                  </div>
                )}

                {currentStep.scaffoldTemplate && (
                  <div className="p-2.5 bg-[var(--surface)] rounded border border-[var(--border)] font-mono text-xs text-[var(--primary-dark)] flex items-start gap-1.5">
                    <span className="shrink-0">Шаблон запису:</span>
                    <RichBlockText text={currentStep.scaffoldTemplate} vars={resolvedVars} className="flex-1 min-w-0" />
                  </div>
                )}
                <p className="text-[11px] font-medium text-[var(--text-muted)] italic pt-1 border-t border-[var(--border)]">
                  ℹ️ Виконуйте проміжні обчислення в особистому чорновику чи блокноті.
                </p>
              </div>

              {localFeedback && (
                <div className={`status-panel ${localFeedback.isError ? 'status-panel--warning' : 'status-panel--success'}`}>
                  {localFeedback.text}
                </div>
              )}

              {bpState.calcSteps.length > 0 ? (
                bpState.activeCalcStep ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                          onSetInputDraft(blockId, e.target.value);
                          onSetStepFeedback(null);
                        }}
                        placeholder={`Введіть значення (${bpState.activeCalcStep.label})...`}
                        className="input-field text-sm font-mono flex-1"
                      />
                      {(bpState.activeCalcStep.unit || currentStep.unit) && (
                        <span className="text-xs font-bold text-[var(--color-muted)] shrink-0">
                          {bpState.activeCalcStep.unit || currentStep.unit}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => {
                        const sub = bpState.activeCalcStep!;
                        const expectedStr = String(sub.correctAnswer).trim().toLowerCase();
                        const actualStr = String(inputValue).trim().toLowerCase();
                        if (actualStr === expectedStr) {
                          const nextUnlocked = Array.from(new Set([...bpState.unlockedKeys, sub.fieldKey]));
                          onPlaySuccess();
                          onSetInputDraft(`${blockId}__unlocked`, nextUnlocked.join(','));
                          onSetInputDraft(blockId, '');
                          if (nextUnlocked.length < bpState.calcSteps.length) {
                            onSetStepFeedback({
                              stepIndex,
                              isError: false,
                              text: `✅ «${sub.label}» знайдено та відкрито на кресленні! Переходьте до наступного етапу.`,
                            });
                          } else {
                            onCorrectAttempt(blockId);
                            onAddResilienceXp(25);
                            onAddTraitPoints('analytics', 18);
                            onCompleteTask(
                              blockId,
                              currentStep.reward || { wood: 25, stone: 10, energy: 15 },
                              currentStep.title,
                              { variantNonce, hasVars: hasBlockVars }
                            );
                            handleStepAdvance();
                          }
                        } else {
                          onPlayError();
                          onSetStepFeedback({
                            stepIndex,
                            isError: true,
                            text: 'Значення для цього компонента потребує уточнення. Перевірте розміри на кресленні або натисніть «💡 Підказка».',
                          });
                          onWrongAttempt(
                            blockId,
                            activeHintStep,
                            nearestTheoryStepIndex,
                            `${sub.fieldKey}:${inputValue}`
                          );
                        }
                      }}
                      className="text-xs font-bold px-6"
                    >
                      {bpState.activeCalcStepIndex < bpState.calcSteps.length - 1
                        ? 'Відкрити на кресленні →'
                        : 'Перевірити та завершити'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="status-panel status-panel--success text-xs font-bold">
                      ✅ Усі приховані виміри креслення успішно обчислені та відкриті!
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleStepAdvance}
                      className="w-full text-xs font-bold py-2.5"
                    >
                      {isLast ? 'Завершити завдання 🎯' : 'Продовжити далі →'}
                    </Button>
                  </div>
                )
              ) : singleTargetAns !== undefined && String(singleTargetAns).trim() !== '' ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => {
                        onSetInputDraft(blockId, e.target.value);
                        onSetStepFeedback(null);
                      }}
                      placeholder="Введіть відповідь з чорновика..."
                      className="input-field text-sm font-mono flex-1"
                    />
                    {currentStep.unit && (
                      <span className="text-xs font-bold text-[var(--color-muted)] shrink-0">
                        {currentStep.unit}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (
                        String(inputValue).trim().toLowerCase() ===
                        String(singleTargetAns).trim().toLowerCase()
                      ) {
                        onPlaySuccess();
                        onCorrectAttempt(blockId);
                        onAddResilienceXp(20);
                        onAddTraitPoints('analytics', 15);
                        onCompleteTask(
                          blockId,
                          currentStep.reward || { wood: 25, stone: 10, energy: 15 },
                          currentStep.title,
                          { variantNonce, hasVars: hasBlockVars }
                        );
                        handleStepAdvance();
                      } else {
                        onPlayError();
                        onSetStepFeedback({
                          stepIndex,
                          isError: true,
                          text: 'Результат потребує уточнення. Перегляньте правило теорії або натисніть «💡 Підказка».',
                        });
                        handleStepWrong(String(inputValue));
                      }
                    }}
                    className="text-xs font-bold px-6"
                  >
                    Перевірити
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    onPlaySuccess();
                    onAddResilienceXp(20);
                    onAddTraitPoints('analytics', 10);
                    onCompleteTask(
                      blockId,
                      currentStep.reward || { wood: 25, stone: 10, energy: 15 },
                      currentStep.title,
                      { variantNonce, hasVars: hasBlockVars }
                    );
                    handleStepAdvance();
                  }}
                  className="w-full text-xs font-bold py-2.5"
                >
                  {isLast ? 'Завершити завдання 🎯' : 'Позначити виконаним та далі →'}
                </Button>
              )}
            </div>
          );
        })()}

      {/* 7. INDEPENDENT WORK BLOCK (block_boss_challenge) */}
      {currentStep.type === 'block_boss_challenge' &&
        (() => {
          const bossTargetAns =
            currentStep.correctAnswer !== undefined
              ? currentStep.correctAnswer
              : (currentStep as any).expected ?? (currentStep as any).validation?.expected;
          const bossBpState = resolveBlueprintProgression(
            currentStep,
            bossTargetAns,
            unlockedKeysRaw,
            isCompleted
          );
          const activeBossHintStep =
            bossBpState.activeCalcStep?.hint
              ? ({ ...currentStep, hint: bossBpState.activeCalcStep.hint } as StoryBlock)
              : currentStep;

          return (
            <div className="p-5 sm:p-6 bg-[var(--color-boss-bg)] border-2 border-[var(--color-boss-border)] rounded-[var(--radius-md)] shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[var(--color-primary-dark)]">
                  <span aria-hidden="true">🎯</span> Самостійна робота
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {nearestTheoryStepIndex !== null && (
                    <Button type="button" variant="outline" size="sm" onClick={handleStepJumpTheory}>
                      📖 Теорія (0 ₴)
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenHint(blockId, activeBossHintStep, nearestTheoryStepIndex)}
                  >
                    💡 Підказка
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-[var(--color-text)]">
                  {currentStep.title === 'Виклик Майстра' || !currentStep.title
                    ? 'Самостійна робота'
                    : currentStep.title}
                </h4>
                {currentStep.contextStory && (
                  <div className="text-xs text-[var(--color-muted)] font-medium">
                    <RichBlockText text={currentStep.contextStory} vars={resolvedVars} />
                  </div>
                )}
              </div>

              <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-sm)] border border-[var(--color-border)] text-center font-semibold text-base sm:text-lg text-[var(--color-text)] shadow-xs">
                <RichBlockText
                  text={
                    currentStep.notebookPrompt ||
                    currentStep.instruction ||
                    'Виконайте підсумковий розрахунок у чорновику'
                  }
                  codeSnippet={currentStep.codeSnippet}
                  codeLanguage={currentStep.codeLanguage}
                  vars={resolvedVars}
                  interactiveWidgets={true}
                  resetSignal={resetSignal}
                />
              </div>

              <BlueprintDiagramCard
                blueprint={currentStep.blueprint}
                geometry={currentStep.geometry}
                maskedKeys={bossBpState.maskedKeys}
                unlockedKeys={bossBpState.unlockedKeys}
              />

              {/* Interactive STEM Engine Integration */}
              {(() => {
                const engineId = currentStep.engineId;
                if (engineId) {
                  const EngineComp = EngineRegistry.getComponent(engineId);
                  if (EngineComp) {
                    const numericTarget = Number(bossTargetAns);
                    const engineConfig = {
                      ...(currentStep.engineConfig || {}),
                      ...(currentStep.reactionZones ? { reactionZones: currentStep.reactionZones } : {}),
                      ...(Number.isFinite(numericTarget) && bossTargetAns !== ''
                        ? { targetValue: numericTarget, targetNumber: numericTarget, targetSum: numericTarget }
                        : {}),
                    };
                    return (
                      <EngineComp
                        config={engineConfig}
                        onSubmitAnswer={() => {
                          onPlaySuccess();
                          onCorrectAttempt(blockId);
                          onAddResilienceXp(35);
                          onAddTraitPoints('engineering', 15);
                          onAddTraitPoints('spatial', 10);
                          onCompleteTask(
                            blockId,
                            currentStep.reward || { wood: 40, stone: 20, energy: 25 },
                            currentStep.title,
                            { variantNonce, hasVars: hasBlockVars }
                          );
                          handleStepAdvance();
                        }}
                      />
                    );
                  }
                }
                return null;
              })()}

              {localFeedback && (
                <div className={`status-panel ${localFeedback.isError ? 'status-panel--warning' : 'status-panel--success'}`}>
                  {localFeedback.text}
                </div>
              )}

              {!currentStep.engineId &&
                (bossBpState.calcSteps.length > 0 ? (
                  bossBpState.activeCalcStep ? (
                    <div className="space-y-2.5">
                      <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-xs font-bold text-[var(--color-text)]">
                        <RichBlockText text={bossBpState.activeCalcStep.prompt} vars={resolvedVars} />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => {
                            onSetInputDraft(blockId, e.target.value);
                            onSetStepFeedback(null);
                          }}
                          placeholder={`Введіть значення (${bossBpState.activeCalcStep.label})...`}
                          className="input-field text-sm font-mono flex-1"
                        />
                        <Button
                          variant="primary"
                          onClick={() => {
                            const sub = bossBpState.activeCalcStep!;
                            if (
                              String(inputValue).trim().toLowerCase() ===
                              String(sub.correctAnswer).trim().toLowerCase()
                            ) {
                              const nextUnlocked = Array.from(
                                new Set([...bossBpState.unlockedKeys, sub.fieldKey])
                              );
                              onPlaySuccess();
                              onSetInputDraft(`${blockId}__unlocked`, nextUnlocked.join(','));
                              onSetInputDraft(blockId, '');
                              if (nextUnlocked.length < bossBpState.calcSteps.length) {
                                onSetStepFeedback({
                                  stepIndex,
                                  isError: false,
                                  text: `✅ «${sub.label}» відкрито на кресленні! Переходьте до наступної частини.`,
                                });
                              } else {
                                onCorrectAttempt(blockId);
                                onAddResilienceXp(35);
                                onAddTraitPoints('analytics', 20);
                                onCompleteTask(
                                  blockId,
                                  currentStep.reward || { wood: 40, stone: 20, energy: 25 },
                                  currentStep.title,
                                  { variantNonce, hasVars: hasBlockVars }
                                );
                                handleStepAdvance();
                              }
                            } else {
                              onPlayError();
                              onSetStepFeedback({
                                stepIndex,
                                isError: true,
                                text: 'Перевірте розрахунки ще раз, перегляньте правило теорії або відкрийте «💡 Підказка».',
                              });
                              onWrongAttempt(
                                blockId,
                                activeBossHintStep,
                                nearestTheoryStepIndex,
                                `${sub.fieldKey}:${inputValue}`
                              );
                            }
                          }}
                          className="text-xs font-bold px-6"
                        >
                          {bossBpState.activeCalcStepIndex < bossBpState.calcSteps.length - 1
                            ? 'Відкрити на кресленні →'
                            : isLast
                            ? 'Завершити урок 🏆'
                            : 'Перевірити відповідь'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleStepAdvance}
                      className="w-full text-xs font-bold py-2.5"
                    >
                      {isLast ? 'Завершити урок 🏆' : 'Продовжити далі →'}
                    </Button>
                  )
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => {
                        onSetInputDraft(blockId, e.target.value);
                        onSetStepFeedback(null);
                      }}
                      placeholder="Введіть підсумковий результат..."
                      className="input-field text-sm font-mono flex-1"
                    />
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (
                          bossTargetAns === undefined ||
                          String(bossTargetAns).trim() === '' ||
                          String(inputValue).trim().toLowerCase() ===
                            String(bossTargetAns).trim().toLowerCase()
                        ) {
                          onPlaySuccess();
                          onCorrectAttempt(blockId);
                          onAddResilienceXp(35);
                          onAddTraitPoints('analytics', 20);
                          onCompleteTask(
                            blockId,
                            currentStep.reward || { wood: 40, stone: 20, energy: 25 },
                            currentStep.title,
                            { variantNonce, hasVars: hasBlockVars }
                          );
                          handleStepAdvance();
                        } else {
                          onPlayError();
                          onSetStepFeedback({
                            stepIndex,
                            isError: true,
                            text: 'Перевірте розрахунки ще раз, перегляньте правило теорії або відкрийте «💡 Підказка».',
                          });
                          handleStepWrong(String(inputValue));
                        }
                      }}
                      className="text-xs font-bold px-6"
                    >
                      {isLast ? 'Завершити урок 🏆' : 'Перевірити відповідь'}
                    </Button>
                  </div>
                ))}
            </div>
          );
        })()}

      {/* 8. SOMATIC PAUSE MODAL (Active only when current step; inline preview in stacked modes) */}
      {(currentStep.type === 'block_somatic_pause' || currentStep.type === 'somatic_break') &&
        (isCurrent ? (
          <SomaticPauseModal
            isOpen={true}
            activityId={(currentStep.activityId || currentStep.activity || 'double_sigh') as any}
            durationSec={currentStep.durationSec || (currentStep as any).duration || 30}
            guideVoiceText={currentStep.guideVoiceText}
            inhaleSec={currentStep.inhaleSec}
            holdSec={currentStep.holdSec}
            exhaleSec={currentStep.exhaleSec}
            restSec={currentStep.restSec}
            cues={currentStep.cues}
            onComplete={() => {
              onAddResilienceXp(15);
              onAddTraitPoints('selfRegulation', 15);
              handleStepAdvance();
            }}
          />
        ) : (
          <div className="p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-md)] flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-extrabold text-[var(--primary-dark)]">
                🌬️ Дихальна пауза ({currentStep.durationSec || (currentStep as any).duration || 30} с)
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {currentStep.guideVoiceText || 'Спокійне відновлення концентрації перед наступним блоком.'}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onFocusStep(stepIndex)}>
              ▶ Розпочати вправу
            </Button>
          </div>
        ))}

      {/* 8.5 INTERACTIVE TEXT MARKING BLOCK (Deferred Check) */}
      {currentStep.type === 'block_text_marking' && (
        <TextMarkingBlock
          title={currentStep.title}
          prompt={currentStep.prompt}
          sentence={currentStep.sentence}
          availableTools={currentStep.availableTools}
          toleranceMode={currentStep.toleranceMode}
          targetTokens={currentStep.targetTokens}
          explanation={currentStep.explanation}
          rewardWood={currentStep.reward?.wood || 20}
          isLastStep={isLast}
          onOpenTheory={nearestTheoryStepIndex !== null ? handleStepJumpTheory : undefined}
          onOpenHint={() => handleStepHint()}
          onWrongAttempt={(sig) => handleStepWrong(`mark:${sig}`)}
          onSuccessSound={onPlaySuccess}
          onErrorSound={onPlayError}
          onSolved={() => {
            onCorrectAttempt(blockId);
            onAddResilienceXp(20);
            onAddTraitPoints('linguistic', 15);
            onCompleteTask(
              blockId,
              currentStep.reward || { wood: 20, stone: 10, energy: 15 },
              currentStep.title || currentStep.prompt,
              { variantNonce, hasVars: hasBlockVars }
            );
            handleStepAdvance();
          }}
        />
      )}

      {/* 8.6 LOGICAL EVALUATION & CRITICAL CHECK BLOCK (block_logic_review) */}
      {currentStep.type === 'block_logic_review' &&
        (() => {
          const verdictChoices =
            currentStep.verdictOptions && currentStep.verdictOptions.length > 0
              ? currentStep.verdictOptions
              : [
                  {
                    id: 'already_solved' as const,
                    label: '✅ Дані точні — запитувана відповідь уже готова (без обчислень)',
                  },
                  {
                    id: 'error_found' as const,
                    label: '⚠️ У твердженні або записі є помилка / суперечність',
                  },
                  {
                    id: 'missing_data' as const,
                    label: '❓ Даних недостатньо — визначити значення неможливо',
                  },
                ];

          const verdictPassed = verdictDraft === currentStep.expectedVerdict;
          const requiresFollowUp =
            currentStep.followUpAnswer !== undefined &&
            String(currentStep.followUpAnswer).trim() !== '';

          return (
            <div className="p-5 bg-[var(--color-surface)] border-2 border-[var(--border-hover)] rounded-[var(--radius-md)] shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[var(--color-primary-dark)] uppercase tracking-wide">
                  🧠 Логічна оцінка та перевірка даних
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {nearestTheoryStepIndex !== null && (
                    <Button type="button" variant="outline" size="sm" onClick={handleStepJumpTheory}>
                      📖 Теорія (0 ₴)
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => handleStepHint()}>
                    💡 Підказка
                  </Button>
                  <span className="text-xs text-[var(--color-accent)] font-extrabold">
                    🏆 +{currentStep.reward?.wood || 25} балів
                  </span>
                </div>
              </div>

              {currentStep.title && (
                <h4 className="text-base font-extrabold text-[var(--color-text)]">{currentStep.title}</h4>
              )}

              <BlueprintDiagramCard
                blueprint={currentStep.blueprint}
                geometry={currentStep.geometry}
                maskedKeys={[]}
                claimedBanner={
                  currentStep.claimedValue !== undefined
                    ? { label: currentStep.claimedLabel, value: currentStep.claimedValue }
                    : undefined
                }
              />

              <div className="p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[14px] font-semibold text-[var(--text)] leading-relaxed">
                <RichBlockText text={currentStep.scenarioPrompt} vars={resolvedVars} />
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
                  Крок 1. Оберіть критичну оцінку ситуації:
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {verdictChoices.map((opt) => {
                    const isSelected = verdictDraft === opt.id;
                    const isRight = opt.id === currentStep.expectedVerdict;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onSetInputDraft(`${blockId}__verdict`, opt.id);
                          onSetStepFeedback(null);
                          if (isRight) {
                            onPlaySuccess();
                            onCorrectAttempt(blockId);
                          } else {
                            onPlayError();
                            onSetStepFeedback({
                              stepIndex,
                              isError: true,
                              text: 'Не поспішайте погоджуватися! Уважно звірте запис із розмірами на кресленні або натисніть «💡 Підказка».',
                            });
                            handleStepWrong(`verdict:${opt.id}`);
                          }
                        }}
                        className={`p-3 text-left rounded-[var(--radius-sm)] text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? isRight
                              ? 'bg-[var(--color-quiz-correct-bg)] border-[var(--color-quiz-correct-border)] text-[var(--color-success-text)]'
                              : 'bg-[var(--color-quiz-wrong-bg)] border-[var(--color-quiz-wrong-border)] text-[var(--color-danger-text)]'
                            : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border-[var(--color-border)]'
                        }`}
                      >
                        <RichBlockText text={opt.label} vars={resolvedVars} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {localFeedback && (
                <div className={`status-panel ${localFeedback.isError ? 'status-panel--warning' : 'status-panel--success'}`}>
                  {localFeedback.text}
                </div>
              )}

              {verdictPassed && (
                <div className="p-4 bg-[var(--ok-bg)] border border-[var(--ok-border)] text-[var(--ok-text)] rounded-[var(--radius-sm)] space-y-3">
                  <div className="text-xs font-extrabold">
                    ✅ Оцінка вірна! {requiresFollowUp ? 'Уточніть істинне значення за кресленням:' : ''}
                  </div>

                  {requiresFollowUp ? (
                    <div className="space-y-2">
                      {currentStep.followUpQuestion && (
                        <div className="text-[13px] font-bold">
                          <RichBlockText text={currentStep.followUpQuestion} vars={resolvedVars} />
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                              onSetInputDraft(blockId, e.target.value);
                              onSetStepFeedback(null);
                            }}
                            placeholder="Введіть правильне значення..."
                            className="input-field text-sm font-mono flex-1"
                          />
                          {currentStep.followUpUnit && (
                            <span className="text-xs font-bold shrink-0">{currentStep.followUpUnit}</span>
                          )}
                        </div>
                        <Button
                          variant="primary"
                          onClick={() => {
                            if (
                              String(inputValue).trim().toLowerCase() ===
                              String(currentStep.followUpAnswer).trim().toLowerCase()
                            ) {
                              onPlaySuccess();
                              onCorrectAttempt(blockId);
                              onAddResilienceXp(25);
                              onAddTraitPoints('criticalThinking', 18);
                              onCompleteTask(
                                blockId,
                                currentStep.reward || { wood: 25, stone: 15, energy: 15 },
                                currentStep.title,
                                { variantNonce, hasVars: hasBlockVars }
                              );
                              handleStepAdvance();
                            } else {
                              onPlayError();
                              onSetStepFeedback({
                                stepIndex,
                                isError: true,
                                text: 'Перевірте значення на кресленні ще раз або відкрийте «💡 Підказка».',
                              });
                              handleStepWrong(`followup:${inputValue}`);
                            }
                          }}
                          className="text-xs font-bold px-6"
                        >
                          {isLast ? 'Завершити перевірку 🎯' : 'Підтвердити висновок'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {currentStep.explanation && (
                        <p className="text-xs leading-relaxed font-semibold">{currentStep.explanation}</p>
                      )}
                      <Button
                        variant="primary"
                        onClick={() => {
                          onPlaySuccess();
                          onAddResilienceXp(25);
                          onAddTraitPoints('criticalThinking', 18);
                          onCompleteTask(
                            blockId,
                            currentStep.reward || { wood: 25, stone: 15, energy: 15 },
                            currentStep.title,
                            { variantNonce, hasVars: hasBlockVars }
                          );
                          handleStepAdvance();
                        }}
                        className="w-full text-xs font-bold py-2.5"
                      >
                        {isLast ? 'Завершити урок 🎯' : 'Зафіксувати висновок та далі →'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {/* 9. UNIVERSAL FALLBACK BLOCK */}
      {![
        'block_dialogue',
        'dialogue',
        'block_anchor_fact',
        'block_theory_rule',
        'block_interactive_sandbox',
        'sandbox',
        'block_recognition_quiz',
        'block_notebook_task',
        'block_boss_challenge',
        'block_somatic_pause',
        'somatic_break',
        'block_text_marking',
        'block_logic_review',
      ].includes(currentStep.type) && (
        <div className="p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-card space-y-3">
          <h3 className="text-base font-extrabold text-[var(--color-text)]">
            {(currentStep as any).title || (currentStep as any).headline || 'Навчальний етап'}
          </h3>
          <div className="text-[14px] text-[var(--color-text)] leading-relaxed">
            <RichBlockText
              text={
                (currentStep as any).ruleSummary ||
                (currentStep as any).contentSummary ||
                (currentStep as any).text ||
                (currentStep as any).content ||
                (currentStep as any).description ||
                (currentStep as any).instruction ||
                (currentStep as any).notebookPrompt ||
                (currentStep as any).title ||
                'Матеріал етапу'
              }
              codeSnippet={(currentStep as any).codeSnippet}
              codeLanguage={(currentStep as any).codeLanguage}
              vars={resolvedVars}
            />
          </div>
          {(!isStacked || isCurrent) && (
            <Button variant="primary" onClick={handleStepAdvance} className="w-full text-xs font-bold py-3">
              {isLast ? 'Завершити урок 🎯' : 'Продовжити далі →'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

export const QuestPipeline: React.FC<QuestPipelineProps> = ({
  questId,
  questTitle,
  subjectId = '',
  steps,
  hasNextChapter = false,
  nextChapterTitle,
  onNextChapter,
  onBackToSubject,
  hasContext = false,
  showContextPanel = false,
  onToggleContextPanel,
}) => {
  const {
    currentStepIndex,
    nextStep,
    goToStep,
    inputDrafts,
    completedBlockIds,
    setInputDraft,
    markBlockCompleted,
    isPracticeModeOnly,
    setPracticeModeOnly,
    isQuestCompletedSummaryVisible,
    setQuestCompletedSummaryVisible,
    variantNonce,
    bumpVariantNonce,
    returnFromTheoryStep,
    jumpToTheoryAndRemember,
    returnFromTheory,
    activeTextLens,
    setActiveTextLens,
    openRewardGame,
  } = useSessionStore();

  const initLessonScope = useLessonScopeStore((s) => s.initScope);
  const resetLessonScope = useLessonScopeStore((s) => s.resetScope);
  const lessonScopeChanged = useLessonScopeStore((s) => s.hasChanges());

  const { profile, addResilienceXp, addTraitPoints, completeQuest, completeTask } = useProfileStore();
  const { captchaErrorThreshold, captchaMaxCycles } = useSettingsStore();
  const {
    densityMode,
    setDensityMode,
    isDocumentExpanded,
    toggleDocumentExpanded,
    autoPlayDialoguesInDoc,
    toggleAutoPlayDialoguesInDoc,
    docScrollPercent,
    docActiveStepIndex,
    setDocReadingProgress,
  } = useLayoutPrefsStore();
  const audio = useAudioEngine();
  const { openGate } = useHintGate();
  const { byBlock, recordWrongAttempt, recordCorrectAttempt } = useAttemptTracker();

  const [stepFeedback, setStepFeedback] = useState<StepFeedbackState | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const docContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveDensity = resolveEffectiveDensity(densityMode, viewportWidth);

  const activePipelineSteps = useMemo(() => {
    const rawList = steps || [];
    const canonicalSet = new Set([
      'block_dialogue',
      'block_anchor_fact',
      'block_theory_rule',
      'block_interactive_sandbox',
      'block_recognition_quiz',
      'block_notebook_task',
      'block_boss_challenge',
      'block_somatic_pause',
      'block_text_marking',
      'block_logic_review',
    ]);
    const normalizedSteps: StoryBlock[] = [];
    rawList.forEach((step, idx) => {
      if (!step || typeof step !== 'object') return;
      if (canonicalSet.has(step.type)) {
        normalizedSteps.push(step);
      } else {
        const mapped = YamlCurriculumParser.mapObjectBlocks(step, idx);
        if (mapped.length > 0) {
          normalizedSteps.push(...mapped);
        } else {
          normalizedSteps.push(step);
        }
      }
    });

    if (!isPracticeModeOnly) return normalizedSteps;
    const practiceOnly = normalizedSteps.filter(
      (s) =>
        s.type === 'block_recognition_quiz' ||
        s.type === 'block_notebook_task' ||
        s.type === 'block_interactive_sandbox' ||
        s.type === 'sandbox' ||
        s.type === 'block_boss_challenge' ||
        s.type === 'block_text_marking' ||
        s.type === 'block_logic_review'
    );
    return practiceOnly.length > 0 ? practiceOnly : normalizedSteps;
  }, [steps, isPracticeModeOnly]);

  useEffect(() => {
    setStepFeedback(null);
  }, [currentStepIndex, questId]);

  useEffect(() => {
    initLessonScope(questId, {});
  }, [questId, initLessonScope]);

  const totalSteps = activePipelineSteps.length;
  const safeIndex = totalSteps > 0 ? Math.min(currentStepIndex, totalSteps - 1) : 0;
  const activeRawStep = totalSteps > 0 ? activePipelineSteps[safeIndex] || activePipelineSteps[0] : null;

  // Live scroll + active section tracking for full-lesson Конспект mode
  useEffect(() => {
    if (effectiveDensity !== 'document' || totalSteps === 0 || typeof window === 'undefined') {
      return;
    }

    let rafId: number | null = null;

    const measureDocProgress = () => {
      rafId = null;
      const container = docContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportH = window.innerHeight || 800;
      const totalScrollable = Math.max(1, container.offsetHeight - viewportH * 0.55);
      const passed = Math.max(0, 120 - rect.top);
      const rawPct = Math.min(100, Math.max(0, Math.round((passed / totalScrollable) * 100)));

      let activeSection = 0;
      for (let i = 0; i < totalSteps; i++) {
        const secEl = document.getElementById(`lesson-step-${i}`);
        if (!secEl) continue;
        if (secEl.getBoundingClientRect().top <= 170) {
          activeSection = i;
        }
      }

      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 36;
      const finalPct = nearBottom ? 100 : rawPct;
      const finalSection = nearBottom ? totalSteps - 1 : activeSection;

      setDocReadingProgress(finalPct, finalSection);
    };

    const scheduleMeasure = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(measureDocProgress);
      }
    };

    measureDocProgress();
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [effectiveDensity, totalSteps, questId, setDocReadingProgress]);

  const findNearestTheoryIndex = (fromIndex: number): number | null => {
    for (let i = fromIndex - 1; i >= 0; i--) {
      const t = activePipelineSteps[i]?.type;
      if (t === 'block_theory_rule' || t === 'block_anchor_fact') return i;
    }
    for (let i = 0; i < activePipelineSteps.length; i++) {
      const t = activePipelineSteps[i]?.type;
      if (i !== fromIndex && (t === 'block_theory_rule' || t === 'block_anchor_fact')) return i;
    }
    return null;
  };

  const activeNearestTheoryIndex = totalSteps > 0 ? findNearestTheoryIndex(safeIndex) : null;

  const visibleStepIndices = useMemo(() => {
    if (totalSteps === 0) return [];
    if (effectiveDensity === 'document') {
      return activePipelineSteps.map((_, idx) => idx);
    }
    if (effectiveDensity === 'cascade') {
      const { start, end } = computeCascadeWindow(safeIndex, totalSteps);
      const windowIndices: number[] = [];
      for (let i = start; i <= end; i++) {
        windowIndices.push(i);
      }
      return windowIndices;
    }
    return [safeIndex];
  }, [activePipelineSteps, effectiveDensity, safeIndex, totalSteps]);

  if (!activeRawStep || totalSteps === 0) {
    return null;
  }

  const handleAdvanceStep = (stepIndex: number, blockId: string) => {
    setStepFeedback(null);
    markBlockCompleted(blockId);
    const stepIsLast = stepIndex >= totalSteps - 1;
    if (stepIsLast) {
      completeQuest(questId, questTitle);
      setQuestCompletedSummaryVisible(true);
    } else if (stepIndex !== safeIndex) {
      goToStep(stepIndex + 1);
    } else {
      nextStep();
    }
  };

  const handleJumpToTheory = (fromIndex: number) => {
    const theoryIdx = findNearestTheoryIndex(fromIndex);
    if (theoryIdx === null) return;
    addTraitPoints('curiosity', 3);
    jumpToTheoryAndRemember(theoryIdx, fromIndex);
  };

  const handleOpenHint = (
    blockId: string,
    step: StoryBlock,
    theoryStepIndex: number | null,
    forcedMode?: 'standard' | 'captcha' | 'alternatives'
  ) => {
    const stats = byBlock[blockId];
    const autoMode =
      forcedMode ||
      (stats && stats.captchaCyclesCompleted >= captchaMaxCycles ? 'alternatives' : 'standard');
    openGate({
      blockId,
      hintText: (step as any).hint || (step as any).hints?.[0]?.explanation,
      hints: (step as any).hints,
      mode: autoMode,
      theoryStepIndex,
      subjectId,
      bruteForceReason: stats?.bruteForceReason ?? null,
    });
  };

  const handleTaskWrongAttempt = (
    blockId: string,
    step: StoryBlock,
    theoryStepIndex: number | null,
    signature: string
  ) => {
    const outcome = recordWrongAttempt(blockId, signature, {
      captchaErrorThreshold,
      captchaMaxCycles,
    });

    if (outcome.action === 'captcha') {
      openGate({
        blockId,
        hintText: (step as any).hint || (step as any).hints?.[0]?.explanation,
        hints: (step as any).hints,
        mode: 'captcha',
        theoryStepIndex,
        subjectId,
        bruteForceReason: outcome.bruteForceReason,
      });
    } else if (outcome.action === 'alternatives') {
      openGate({
        blockId,
        hintText: (step as any).hint || (step as any).hints?.[0]?.explanation,
        hints: (step as any).hints,
        mode: 'alternatives',
        theoryStepIndex,
        subjectId,
        bruteForceReason: outcome.bruteForceReason,
      });
    }
  };

  if (isQuestCompletedSummaryVisible) {
    return (
      <div className="p-6 bg-[var(--color-surface)] border-2 border-[var(--color-success)] rounded-[var(--radius-md)] shadow-card space-y-4 text-center animate-fadeIn">
        <div className="text-3xl">🎉</div>
        <div className="space-y-1">
          <h3 className="text-lg font-extrabold text-[var(--color-primary-dark)]">
            Урок «{questTitle || 'Навчальна тема'}» успішно завершено!
          </h3>
          <p className="text-xs text-[var(--color-muted)] max-w-md mx-auto leading-relaxed">
            Усі етапи цієї теми зафіксовано у вашому профілі та щоденнику дослідника.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 justify-center pt-2">
          {hasNextChapter && onNextChapter && (
            <Button
              variant="primary"
              onClick={onNextChapter}
              className="text-xs font-extrabold py-2.5 px-5"
            >
              ➡️ Наступна тема{nextChapterTitle ? `: ${nextChapterTitle}` : ''}
            </Button>
          )}
          <Button
            variant="accent"
            onClick={() => openRewardGame(`quest::${questId}`)}
            className="text-xs font-extrabold py-2.5 px-4"
          >
            🎮 Коротка гра-нагорода
          </Button>
          {onBackToSubject && (
            <Button
              variant="outline"
              onClick={onBackToSubject}
              className="text-xs font-bold py-2.5 px-4"
            >
              📋 До списку тем
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => goToStep(0)}
            className="text-xs font-bold py-2.5 px-4"
          >
            🔄 Переглянути спочатку
          </Button>
        </div>

        <RealWorldBridgeCard
          questId={questId}
          questTitle={questTitle}
          subjectId={subjectId}
        />
      </div>
    );
  }

  const isInteractiveTaskStep = [
    'block_recognition_quiz',
    'block_notebook_task',
    'block_boss_challenge',
    'block_interactive_sandbox',
    'sandbox',
    'block_text_marking',
    'block_logic_review',
  ].includes(activeRawStep.type);

  const microAnchorLabel =
    (activeRawStep as any).formulaText ||
    (activeNearestTheoryIndex !== null
      ? (activePipelineSteps[activeNearestTheoryIndex] as any)?.formulaText
      : '') ||
    (activeRawStep as any).title ||
    (activeRawStep as any).question ||
    (activeRawStep as any).instruction ||
    questTitle ||
    'Поточне завдання';

  const DENSITY_OPTIONS: Array<{ id: DensityPreference; label: string }> = [
    { id: 'auto', label: 'Авто' },
    { id: 'slides', label: 'Слайди' },
    { id: 'cascade', label: 'Каскад' },
    { id: 'document', label: 'Конспект' },
  ];

  const profileSeed = String((profile as any).profileSeed || profile.id);

  return (
    <div className="space-y-4">
      {/* Desktop Unified Toolbar (hidden on mobile where BottomDock takes over) */}
      <div className="density-toolbar" role="region" aria-label="Панель режимів та контексту уроку">
        <div className="density-seg-group">
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDensityMode(opt.id)}
              className={`density-seg-btn ${densityMode === opt.id ? 'density-seg-btn--active' : ''}`}
              aria-pressed={densityMode === opt.id}
            >
              {opt.label}
              {opt.id === 'auto'
                ? ` (${effectiveDensity === 'slides' ? 'сл.' : effectiveDensity === 'cascade' ? 'каск.' : 'консп.'})`
                : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {effectiveDensity === 'document' && (
            <button
              type="button"
              onClick={toggleAutoPlayDialoguesInDoc}
              className={`density-seg-btn ${autoPlayDialoguesInDoc ? 'density-seg-btn--active' : ''}`}
              title={
                autoPlayDialoguesInDoc
                  ? 'Діалоги друкуються поступово. Натисніть, щоб показувати одразу.'
                  : 'Діалоги розгорнуті одразу без анімації друку.'
              }
              aria-pressed={autoPlayDialoguesInDoc}
            >
              {autoPlayDialoguesInDoc ? '💬 Друк: Авто' : '💬 Друк: Одразу'}
            </button>
          )}

          {hasContext && onToggleContextPanel && (
            <button
              type="button"
              onClick={onToggleContextPanel}
              className={`density-seg-btn ${showContextPanel ? 'density-seg-btn--active' : ''}`}
              aria-pressed={showContextPanel}
              title={showContextPanel ? 'Сховати контекст уроку' : 'Показати контекст та деталі уроку'}
            >
              {showContextPanel ? '🙈 Сховати контекст' : '📖 Контекст'}
            </button>
          )}

          <button
            type="button"
            onClick={toggleDocumentExpanded}
            className={`density-seg-btn ${isDocumentExpanded ? 'density-seg-btn--active' : ''}`}
            title="Розширити область читання"
            aria-pressed={isDocumentExpanded}
          >
            {isDocumentExpanded ? '⤡ Стандарт' : '⤢ Ширше'}
          </button>
        </div>

        <div className="w-full pt-1.5 mt-1 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
          <TextLensSwitch
            activeLens={activeTextLens}
            onChangeLens={setActiveTextLens}
          />
          {lessonScopeChanged && (
            <button
              type="button"
              onClick={resetLessonScope}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--hl-border)] bg-[var(--hl-bg)] text-[var(--hl-text)] text-[11px] font-extrabold cursor-pointer hover:opacity-90"
              title="Повернути числа та формули до початкового зразка"
            >
              ↺ Скинути до прикладу
            </button>
          )}
        </div>
      </div>

      {/* Mobile Text Lens + Scope Reset Row (when reading facts/theory/doc on mobile) */}
      {(effectiveDensity === 'document' ||
        activeRawStep.type === 'block_anchor_fact' ||
        activeRawStep.type === 'block_theory_rule') && (
        <div className="md:hidden p-2 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-1.5">
          <TextLensSwitch
            activeLens={activeTextLens}
            onChangeLens={setActiveTextLens}
            compact={true}
          />
          {lessonScopeChanged && (
            <button
              type="button"
              onClick={resetLessonScope}
              className="px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--hl-border)] bg-[var(--hl-bg)] text-[var(--hl-text)] text-[10px] font-extrabold cursor-pointer"
            >
              ↺ Скинути до прикладу
            </button>
          )}
        </div>
      )}

      {/* Document Mode: Compact Sequential Jump Strip synchronized with live scroll */}
      {effectiveDensity === 'document' && totalSteps > 1 && (
        <div className="p-2.5 sm:p-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
            <span>📑 Послідовний конспект уроку</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAutoPlayDialoguesInDoc}
                className="md:hidden px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text)] font-bold normal-case cursor-pointer"
              >
                {autoPlayDialoguesInDoc ? '💬 Друк: Авто' : '💬 Діалоги одразу'}
              </button>
              <span className="tabular-nums font-mono text-[var(--text-muted)]">
                {docScrollPercent}% · {Math.min(docActiveStepIndex + 1, totalSteps)} / {totalSteps}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activePipelineSteps.map((st, idx) => {
              const isCurrentSection = idx === Math.min(docActiveStepIndex, totalSteps - 1);
              const title =
                (st as any).title ||
                (st as any).headline ||
                (st as any).question ||
                (st as any).speaker ||
                `Крок ${idx + 1}`;
              return (
                <button
                  key={st.id || idx}
                  type="button"
                  onClick={() => {
                    goToStep(idx);
                    const el = document.getElementById(`lesson-step-${idx}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`text-left px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] transition-all cursor-pointer max-w-[200px] truncate ${
                    isCurrentSection
                      ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)] font-extrabold'
                      : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] font-semibold'
                  }`}
                  title={String(title)}
                >
                  <span className="font-mono opacity-75 mr-1">{idx + 1}.</span>
                  <span>{String(title)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Micro-Anchor (~74px max height) only during active interactive tasks in slides/cascade */}
      {isInteractiveTaskStep && effectiveDensity !== 'document' && (
        <div className="mobile-micro-anchor" aria-label="Закріплений орієнтир завдання">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wide opacity-80">
              📌 Орієнтир · Крок {safeIndex + 1}
            </div>
            <div className="text-xs font-extrabold truncate">{String(microAnchorLabel)}</div>
          </div>
          {activeNearestTheoryIndex !== null && (
            <Button type="button" variant="outline" size="sm" onClick={() => handleJumpToTheory(safeIndex)}>
              📖 Теорія
            </Button>
          )}
        </div>
      )}

      {returnFromTheoryStep !== null && (
        <div className="status-panel status-panel--success flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            📖 Ви переглядаєте правило теорії — ваша чернетка до попереднього завдання збережена.
          </span>
          <Button type="button" variant="primary" size="sm" onClick={returnFromTheory}>
            ↩️ Повернутися до завдання
          </Button>
        </div>
      )}

      {isPracticeModeOnly && (
        <div className="status-panel status-panel--warning flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <span>🎯</span> Режим тренувальних завдань (тільки вправи та розрахунки)
          </span>
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={() => setPracticeModeOnly(false)}
          >
            📖 Відкрити теорію та сюжет
          </Button>
        </div>
      )}

      {/* Chronologically Ordered Steps (1 in Slides, 2-3 Window in Cascade, All 0->N in Document) */}
      <div ref={docContainerRef} className="space-y-4">
        {visibleStepIndices.map((idx) => {
          const stepItem = activePipelineSteps[idx];
          if (!stepItem) return null;
          const bId = stepItem.id || `step_${idx}`;
          const draftVal = inputDrafts[bId] !== undefined ? String(inputDrafts[bId]) : '';
          const unlockedDraft =
            inputDrafts[`${bId}__unlocked`] !== undefined
              ? String(inputDrafts[`${bId}__unlocked`])
              : '';
          const verdictDraft =
            inputDrafts[`${bId}__verdict`] !== undefined
              ? String(inputDrafts[`${bId}__verdict`])
              : '';
          return (
            <StepBlockCard
              key={`${questId}_${bId}_${idx}`}
              questId={questId}
              rawStep={stepItem}
              stepIndex={idx}
              totalSteps={totalSteps}
              isCurrent={idx === safeIndex}
              effectiveDensity={effectiveDensity}
              autoPlayDialoguesInDoc={autoPlayDialoguesInDoc}
              activeLens={activeTextLens}
              nearestTheoryStepIndex={findNearestTheoryIndex(idx)}
              inputValue={draftVal}
              isCompleted={completedBlockIds.includes(bId)}
              unlockedKeysRaw={unlockedDraft}
              verdictDraft={verdictDraft}
              stepFeedback={stepFeedback}
              profileSeed={profileSeed}
              variantNonce={variantNonce}
              onSetInputDraft={setInputDraft}
              onSetStepFeedback={setStepFeedback}
              onBumpVariantNonce={bumpVariantNonce}
              onFocusStep={goToStep}
              onAdvance={handleAdvanceStep}
              onJumpToTheory={handleJumpToTheory}
              onOpenHint={handleOpenHint}
              onWrongAttempt={handleTaskWrongAttempt}
              onCorrectAttempt={recordCorrectAttempt}
              onAddResilienceXp={addResilienceXp}
              onAddTraitPoints={addTraitPoints}
              onCompleteTask={completeTask}
              onPlaySuccess={audio.playSuccess}
              onPlayError={audio.playError}
            />
          );
        })}
      </div>

      {/* CO-PILOT BAR for active step */}
      <CopilotBar guideText={(activeRawStep as any).copilotAdvice || (activeRawStep as any).copilotHint} />
    </div>
  );
};
