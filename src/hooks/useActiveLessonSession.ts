import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppNavigation } from './useAppNavigation';
import { useSessionStore } from '../core/state/useSessionStore';
import {
  useLayoutPrefsStore,
  resolveEffectiveDensity,
} from '../core/state/useLayoutPrefsStore';
import { ContentLoaderService } from '../services/contentLoaderService';
import { ScenarioBuilderService } from '../services/scenarioBuilderService';

export function computeCascadeWindow(
  activeIndex: number,
  totalSteps: number
): { start: number; end: number } {
  if (totalSteps <= 0) return { start: 0, end: 0 };
  if (totalSteps <= 3) return { start: 0, end: totalSteps - 1 };
  const start = Math.max(0, Math.min(activeIndex - 1, totalSteps - 3));
  const end = Math.min(totalSteps - 1, start + 2);
  return { start, end };
}

export function useActiveLessonSession() {
  const nav = useAppNavigation();
  const {
    currentQuestId,
    activeSteps,
    currentStepIndex,
    completedBlockIds,
    showLeftPanel,
    setShowLeftPanel,
    goToStep,
  } = useSessionStore();

  const densityMode = useLayoutPrefsStore((s) => s.densityMode);
  const docScrollPercent = useLayoutPrefsStore((s) => s.docScrollPercent);
  const docActiveStepIndex = useLayoutPrefsStore((s) => s.docActiveStepIndex);

  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const steps = useMemo(() => {
    if (nav.activeView !== 'game') return [];
    const hasMatchingActiveSteps =
      activeSteps.length > 0 &&
      (!nav.currentChapter?.id || currentQuestId === nav.currentChapter.id);

    return hasMatchingActiveSteps
      ? ContentLoaderService.sanitizePipelineBlocks(activeSteps, nav.currentChapter?.id || 'ch').blocks
      : ScenarioBuilderService.buildStepsForChapter(nav.currentChapter, nav.selectedSubjectId);
  }, [nav.activeView, nav.currentChapter, nav.selectedSubjectId, activeSteps, currentQuestId]);

  const effectiveDensity = resolveEffectiveDensity(densityMode, viewportWidth);
  const safeTotal = Math.max(1, steps.length);
  const safeIndex = Math.min(Math.max(0, currentStepIndex), safeTotal - 1);
  const safeCurrentStep = safeIndex + 1;

  const cascadeWindow = useMemo(() => {
    if (effectiveDensity === 'document') {
      return { start: 0, end: Math.max(0, safeTotal - 1) };
    }
    if (effectiveDensity === 'cascade') {
      return computeCascadeWindow(safeIndex, safeTotal);
    }
    return { start: safeIndex, end: safeIndex };
  }, [effectiveDensity, safeIndex, safeTotal]);

  const navigateAndScrollToStep = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, safeTotal - 1));
      goToStep(clamped);
      if (effectiveDensity !== 'slides' && typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          const el = document.getElementById(`lesson-step-${clamped}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [goToStep, safeTotal, effectiveDensity]
  );

  const hasContext = Boolean(
    nav.currentChapter?.islandStageName ||
      nav.currentChapter?.description ||
      nav.currentChapter?.lesson?.storyText
  );

  return {
    nav,
    steps,
    safeTotal,
    safeCurrentStep,
    currentStepIndex: safeIndex,
    completedBlockIds,
    chapterTitle: nav.currentChapter?.title || 'Урок',
    hasContext,
    showLeftPanel,
    setShowLeftPanel,
    goToStep,
    navigateAndScrollToStep,
    effectiveDensity,
    cascadeStart: cascadeWindow.start,
    cascadeEnd: cascadeWindow.end,
    docScrollPercent,
    docActiveStepIndex: Math.min(docActiveStepIndex, safeTotal - 1),
  };
}
