import React from 'react';
import { ClassDoorsHall } from '../../components/layout/ClassDoorsHall';
import { BookshelfView } from '../../components/layout/BookshelfView';
import { SubjectHubView } from '../../components/layout/SubjectHubView';
import { IslandScene } from '../../components/story/IslandScene';
import { StoryPanel } from '../../components/story/StoryPanel';
import { QuestPipeline } from '../story-player/QuestPipeline';
import { AuthorStudio } from '../author-studio/AuthorStudio';
import { QuestionBankView } from '../question-bank/QuestionBankView';
import { useActiveLessonSession } from '../../hooks/useActiveLessonSession';
import { useSessionStore } from '../../core/state/useSessionStore';
import { useProfileStore } from '../../core/state/useProfileStore';

export const MainHubRouter: React.FC = () => {
  const { nav, steps } = useActiveLessonSession();
  const { profile } = useProfileStore();
  const {
    subjectViewMode,
    showLeftPanel,
    setShowLeftPanel,
  } = useSessionStore();

  switch (nav.activeView) {
    case 'doors':
      return (
        <ClassDoorsHall
          studentName={profile.studentName}
          onOpenDoor={nav.openDoor}
          onOpenProfile={() => nav.toggleProfile(true)}
        />
      );

    case 'bookshelf':
      return (
        <BookshelfView
          selectedGradeId={nav.selectedGradeId}
          onBackToDoors={() => nav.navigateBack()}
          onOpenSubject={nav.openSubject}
          onOpenYamlImporter={nav.openAuthorStudio}
        />
      );

    case 'subject_hub':
    case 'chapter_map':
      return (
        <SubjectHubView
          selectedGradeId={nav.selectedGradeId}
          selectedSubjectId={nav.selectedSubjectId}
          viewMode={subjectViewMode}
          currentChapterIndex={nav.currentChapterIndex}
          onToggleViewMode={nav.toggleSubjectViewMode}
          onBackToBookshelf={nav.navigateBack}
          onSelectChapter={nav.selectChapter}
          onSelectChapterPractice={nav.selectChapterPractice}
          onOpenYamlImporter={nav.openAuthorStudio}
          onOpenQuestionBank={nav.openQuestionBank}
        />
      );

    case 'question_bank':
      return (
        <QuestionBankView
          selectedGradeId={nav.selectedGradeId}
          selectedSubjectId={nav.selectedSubjectId}
          onBackToSubject={() => nav.navigateBack()}
          onSelectSubject={(subjId) => nav.openSubject(subjId)}
        />
      );

    case 'author_studio':
      return (
        <AuthorStudio
          initialGradeId={nav.selectedGradeId}
          initialSubjectId={nav.selectedSubjectId}
          onExitStudio={() => nav.navigateBack()}
          onOpenImportModal={() => nav.toggleYamlImporter(true)}
        />
      );

    case 'game': {
      const hasNextChapter = nav.currentChapterIndex + 1 < nav.chapters.length;
      const nextChapter = hasNextChapter ? nav.chapters[nav.currentChapterIndex + 1] : undefined;

      const hasLeftContent = Boolean(
        nav.currentChapter?.islandStageName ||
          nav.currentChapter?.description ||
          nav.currentChapter?.lesson?.storyText
      );
      const isLeftPanelVisible = showLeftPanel && hasLeftContent;

      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="hidden md:flex flex-wrap justify-between items-center gap-2 text-xs">
            <button
              type="button"
              onClick={nav.navigateBack}
              className="font-bold text-[var(--primary-dark)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              ← Повернутися до тем предмета
            </button>

            <span className="font-semibold text-[var(--text-muted)] truncate max-w-[460px]">
              🚪 {nav.currentGrade?.name || 'Клас'} ➔ {nav.activeSubject?.iconName || '📘'}{' '}
              {nav.activeSubject?.name || 'Предмет'} ➔ {nav.currentChapter?.title || 'Урок'}
            </span>
          </div>

          <div className={isLeftPanelVisible ? 'two-zone-layout' : 'max-w-[960px] mx-auto w-full'}>
            {isLeftPanelVisible && (
              <div className="scene-column">
                {nav.currentChapter?.islandStageName && (
                  <IslandScene stageName={nav.currentChapter.islandStageName} />
                )}

                <StoryPanel
                  chapterTitle={nav.currentChapter?.title || 'Матеріали уроку'}
                  chapterDescription={nav.currentChapter?.description}
                  contextStory={nav.currentChapter?.lesson?.storyText}
                />
              </div>
            )}

            <div className="learning-column space-y-4 min-w-0">
              <QuestPipeline
                questId={nav.currentChapter?.id || 'lesson'}
                questTitle={nav.currentChapter?.title}
                subjectId={nav.selectedSubjectId}
                steps={steps}
                hasNextChapter={hasNextChapter}
                nextChapterTitle={nextChapter?.title}
                onNextChapter={() => nav.goToNextChapter()}
                onBackToSubject={() => nav.navigateBack()}
                hasContext={hasLeftContent}
                showContextPanel={showLeftPanel}
                onToggleContextPanel={() => setShowLeftPanel(!showLeftPanel)}
              />
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
};
