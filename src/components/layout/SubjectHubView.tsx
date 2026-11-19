import React from 'react';
import { Button } from '../ui/Button';
import { WorldMapView } from './WorldMapView';
import { ClassicTopicListView } from './ClassicTopicListView';
import { SubjectViewMode } from '../../app/appTypes';
import { ContentLoaderService } from '../../services/contentLoaderService';
import { useProfileStore } from '../../core/state/useProfileStore';

interface SubjectHubViewProps {
  selectedGradeId: string;
  selectedSubjectId: string;
  viewMode: SubjectViewMode;
  currentChapterIndex: number;
  onToggleViewMode: (mode?: SubjectViewMode) => void;
  onBackToBookshelf: () => void;
  onSelectChapter: (index: number) => void;
  onSelectChapterPractice: (index: number) => void;
  onOpenYamlImporter: () => void;
  onOpenQuestionBank?: () => void;
}

export const SubjectHubView: React.FC<SubjectHubViewProps> = ({
  selectedGradeId,
  selectedSubjectId,
  viewMode,
  currentChapterIndex,
  onToggleViewMode,
  onBackToBookshelf,
  onSelectChapter,
  onSelectChapterPractice,
  onOpenYamlImporter,
  onOpenQuestionBank,
}) => {
  const { profile } = useProfileStore();
  const grades = ContentLoaderService.getGrades();
  const currentGrade = grades.find((g) => g.id === selectedGradeId);
  const subject = ContentLoaderService.getSubjectById(selectedSubjectId, selectedGradeId);
  const chapters = ContentLoaderService.getChaptersForSubject(selectedSubjectId, selectedGradeId);

  const gradeLabel = currentGrade ? currentGrade.name : 'Клас';
  const subjectCategoryName = ContentLoaderService.getSubjectCategoryName(
    subject?.subjectCategory || subject?.id
  );
  const subjectTitle = subject ? subject.name : 'Навчальний предмет';
  const hasSeparateTitle = subjectTitle.trim().toLowerCase() !== subjectCategoryName.trim().toLowerCase();

  return (
    <div className="space-y-3 sm:space-y-4 max-w-[1020px] mx-auto py-1 sm:py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-xs">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Button variant="outline" size="sm" onClick={onBackToBookshelf} className="text-xs font-bold py-1">
            ← До полиці
          </Button>
          <span className="text-[var(--color-muted)]" aria-hidden="true">·</span>
          <div className="flex flex-wrap items-center gap-1.5 font-extrabold text-[var(--color-primary-dark)]">
            <span>🚪 {gradeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{subject?.iconName || '📘'} {subjectCategoryName}</span>
            {hasSeparateTitle && (
              <>
                <span aria-hidden="true">—</span>
                <span className="text-[var(--color-text)]">{subjectTitle}</span>
              </>
            )}
            {subject?.authorLabel && (
              <span className="hidden sm:inline font-semibold text-[var(--color-muted)]">
                ({subject.authorLabel})
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0 max-w-full">
          <div className="flex flex-wrap gap-1 p-0.5 sm:p-1 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] text-[11px] font-bold max-w-full">
            <button
              type="button"
              onClick={() => onToggleViewMode('map')}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              🗺️ Мапа
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('topic_list')}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'topic_list'
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              📋 Теми
            </button>
          </div>

          {onOpenQuestionBank && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenQuestionBank}
              className="font-bold text-xs py-1 sm:py-1.5"
            >
              🧠 Банк задач
            </Button>
          )}

          <Button
            variant="accent"
            size="sm"
            onClick={onOpenYamlImporter}
            className="font-bold text-xs py-1 sm:py-1.5"
          >
            🔐 Студія автора
          </Button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <WorldMapView
          selectedGradeId={selectedGradeId}
          selectedSubjectId={selectedSubjectId}
          currentChapterIndex={currentChapterIndex}
          startedQuestIds={profile.startedQuestIds}
          completedQuestIds={profile.completedQuestIds}
          onBackToBookshelf={onBackToBookshelf}
          onSelectChapter={onSelectChapter}
          onOpenYamlImporter={onOpenYamlImporter}
        />
      ) : (
        <ClassicTopicListView
          subjectName={hasSeparateTitle ? `${subjectCategoryName} — ${subjectTitle}` : subjectCategoryName}
          chapters={chapters}
          currentChapterIndex={currentChapterIndex}
          startedQuestIds={profile.startedQuestIds}
          completedQuestIds={profile.completedQuestIds}
          onSelectChapter={onSelectChapter}
          onSelectChapterPractice={onSelectChapterPractice}
        />
      )}
    </div>
  );
};
