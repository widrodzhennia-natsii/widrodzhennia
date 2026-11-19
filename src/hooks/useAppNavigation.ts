import { useSessionStore } from '../core/state/useSessionStore';
import { useProfileStore } from '../core/state/useProfileStore';
import { useAudioEngine } from './useAudioEngine';
import { ScenarioBuilderService } from '../services/scenarioBuilderService';
import { ContentLoaderService } from '../services/contentLoaderService';
import { useAuthorGateStore } from '../core/state/useAuthorGateStore';
import { SubjectViewMode } from '../app/appTypes';

export function useAppNavigation() {
  const audio = useAudioEngine();

  const {
    activeView,
    selectedGradeId,
    selectedSubjectId,
    subjectViewMode,
    isMapExpanded,
    isProfileOpen,
    isYamlImporterOpen,
    setActiveView,
    setSelectedGradeId,
    setSelectedSubjectId,
    setSubjectViewMode,
    setMapExpanded,
    setProfileOpen,
    setYamlImporterOpen,
    setPracticeModeOnly,
  } = useSessionStore();

  const {
    profile,
    markQuestStarted,
    setSubjectChapterIndex,
    setSelectedSubject,
  } = useProfileStore();

  const grades = ContentLoaderService.getGrades();
  const currentGrade = grades.find((g) => g.id === selectedGradeId) || grades[4] || grades[0];
  const activeSubject = ContentLoaderService.getSubjectById(selectedSubjectId, selectedGradeId);
  const chapters = ContentLoaderService.getChaptersForSubject(selectedSubjectId, selectedGradeId);
  const subjectProgress = profile.chapterProgressBySubject[selectedSubjectId] || {
    currentChapterIndex: 0,
    currentTaskIndex: 0,
  };
  const currentChapterIndex = Math.min(
    subjectProgress.currentChapterIndex,
    Math.max(0, chapters.length - 1)
  );
  const currentChapter = chapters[currentChapterIndex];

  const openDoor = (gradeId: string) => {
    audio.playClick();
    setSelectedGradeId(gradeId);
    setSelectedSubjectId('');
    setActiveView('bookshelf');
  };

  const openSubject = (subjectId: string) => {
    audio.playClick();
    const subj = ContentLoaderService.getSubjectById(subjectId, selectedGradeId);
    const resolvedId = subj ? subj.id : subjectId;
    setSelectedSubjectId(resolvedId);
    setSelectedSubject(currentGrade.gradeNumber, resolvedId);
    setActiveView('subject_hub');
  };

  const launchChapter = (index: number, practiceOnly: boolean) => {
    audio.playClick();
    setPracticeModeOnly(practiceOnly);
    const targetChapter = chapters[index] || currentChapter;
    if (selectedSubjectId) {
      setSubjectChapterIndex(selectedSubjectId, index, 0);
    }
    if (targetChapter) {
      markQuestStarted(targetChapter.id);
      ScenarioBuilderService.loadChapterScenario(targetChapter, selectedSubjectId);
    }
    setActiveView('game');
  };

  const selectChapter = (index: number) => launchChapter(index, false);
  const selectChapterPractice = (index: number) => launchChapter(index, true);

  const goToNextChapter = () => {
    const nextIdx = currentChapterIndex + 1;
    if (nextIdx < chapters.length) {
      launchChapter(nextIdx, false);
      return true;
    }
    return false;
  };

  const toggleSubjectViewMode = (mode?: SubjectViewMode) => {
    audio.playClick();
    if (mode) {
      setSubjectViewMode(mode);
    } else {
      setSubjectViewMode(subjectViewMode === 'map' ? 'topic_list' : 'map');
    }
  };

  const toggleMapExpand = (isExpanded?: boolean) => {
    audio.playClick();
    setMapExpanded(isExpanded !== undefined ? isExpanded : !isMapExpanded);
  };

  const navigateBack = () => {
    audio.playClick();
    if (isMapExpanded) {
      setMapExpanded(false);
      return;
    }

    if (activeView === 'game' || activeView === 'question_bank') {
      setActiveView('subject_hub');
    } else if (activeView === 'subject_hub' || activeView === 'chapter_map' || activeView === 'author_studio') {
      setActiveView('bookshelf');
    } else if (activeView === 'bookshelf') {
      setActiveView('doors');
    } else {
      setActiveView('doors');
    }
  };

  const toggleProfile = (isOpen?: boolean) => {
    audio.playClick();
    setProfileOpen(isOpen !== undefined ? isOpen : !isProfileOpen);
  };

  const toggleYamlImporter = (isOpen?: boolean) => {
    audio.playClick();
    setYamlImporterOpen(isOpen !== undefined ? isOpen : !isYamlImporterOpen);
  };

  const openAuthorStudio = () => {
    audio.playClick();
    useAuthorGateStore.getState().requestAuthorAccess(() => {
      setActiveView('author_studio');
    });
  };

  const openQuestionBank = () => {
    audio.playClick();
    setActiveView('question_bank');
  };

  return {
    activeView,
    selectedGradeId,
    selectedSubjectId,
    subjectViewMode,
    isMapExpanded,
    isProfileOpen,
    isYamlImporterOpen,
    currentGrade,
    activeSubject,
    chapters,
    currentChapterIndex,
    currentChapter,
    openDoor,
    openSubject,
    selectChapter,
    selectChapterPractice,
    goToNextChapter,
    toggleSubjectViewMode,
    toggleMapExpand,
    navigateBack,
    toggleProfile,
    toggleYamlImporter,
    openAuthorStudio,
    openQuestionBank,
  };
}
