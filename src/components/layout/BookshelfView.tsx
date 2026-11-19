import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ContentLoaderService } from '../../services/contentLoaderService';
import { SubjectConfig } from '../../curriculum/types';
import { useMusicStudioStore } from '../../features/music-studio/useMusicStudioStore';
import { useSessionStore } from '../../core/state/useSessionStore';

interface BookshelfViewProps {
  selectedGradeId: string;
  onBackToDoors: () => void;
  onOpenSubject: (subjectId: string) => void;
  onOpenYamlImporter?: () => void;
}

export const BookshelfView: React.FC<BookshelfViewProps> = ({
  selectedGradeId,
  onBackToDoors,
  onOpenSubject,
  onOpenYamlImporter,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { setStudioModalOpen } = useMusicStudioStore();
  const { openCartridges, openCoop } = useSessionStore();

  useEffect(() => {
    const handleStorageChange = () => setRefreshKey((prev) => prev + 1);
    window.addEventListener('nush_storage_change', handleStorageChange);
    return () => window.removeEventListener('nush_storage_change', handleStorageChange);
  }, []);

  const grades = ContentLoaderService.getGrades();
  const grade = grades.find((g) => g.id === selectedGradeId) || grades[4] || grades[0];

  const getSubjectIcon = (subject: SubjectConfig) => {
    if (subject.iconName) return subject.iconName;
    const cat = (subject.subjectCategory || subject.id).toLowerCase();
    if (cat.includes('math')) return '📐';
    if (cat.includes('history')) return '📜';
    if (cat.includes('science')) return '🌿';
    if (cat.includes('physics')) return '⚛️';
    if (cat.includes('ukrainian')) return '📖';
    if (cat.includes('informatics') || cat.includes('cyber')) return cat.includes('cyber') ? '🛡️' : '💻';
    if (cat.includes('music')) return '🎵';
    if (cat.includes('art') || cat.includes('draw')) return '🎨';
    return '📘';
  };

  const getSubjectStyle = (subject: SubjectConfig): React.CSSProperties => {
    const cat = (subject.subjectCategory || subject.id).toLowerCase();
    if (cat.includes('math')) {
      return { backgroundColor: 'var(--color-math-bg)', borderColor: 'var(--color-math-border)' };
    }
    if (cat.includes('history')) {
      return { backgroundColor: 'var(--color-history-bg)', borderColor: 'var(--color-history-border)' };
    }
    if (cat.includes('science')) {
      return { backgroundColor: 'var(--color-science-bg)', borderColor: 'var(--color-science-border)' };
    }
    if (cat.includes('ukrainian')) {
      return { backgroundColor: 'var(--color-ukrainian-bg)', borderColor: 'var(--color-ukrainian-border)' };
    }
    if (cat.includes('physics')) {
      return { backgroundColor: 'var(--color-physics-bg)', borderColor: 'var(--color-physics-border)' };
    }
    if (cat.includes('informatics') || cat.includes('cyber')) {
      return { backgroundColor: 'var(--color-informatics-bg)', borderColor: 'var(--color-informatics-border)' };
    }
    if (cat.includes('music')) {
      return { backgroundColor: 'var(--color-history-bg)', borderColor: 'var(--color-history-border)' };
    }
    if (cat.includes('art') || cat.includes('draw')) {
      return { backgroundColor: 'var(--color-ukrainian-bg)', borderColor: 'var(--color-ukrainian-border)' };
    }
    return { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' };
  };

  return (
    <div key={refreshKey} className="space-y-4 max-w-[960px] mx-auto py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onBackToDoors} className="text-xs font-bold">
          ← До вибору класу
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-extrabold text-[var(--color-primary-dark)]">
            🚪 {grade.name}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCoop()}
            className="text-xs font-bold"
          >
            🤝 Co-op
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCartridges('law')}
            className="text-xs font-bold"
          >
            🧭 Життєві навички
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStudioModalOpen(true)}
            className="text-xs font-bold"
          >
            🎼 Музична майстерня
          </Button>
          {onOpenYamlImporter && (
            <Button variant="accent" size="sm" onClick={onOpenYamlImporter} className="text-xs font-bold">
              🔐 Студія автора та курси
            </Button>
          )}
        </div>
      </div>

      <Card title={`📚 Навчальна полиця (${grade.gradeNumber} клас)`}>
        <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed font-medium">
          Оберіть предмет для навчання або додайте власні навчальні матеріали.
        </p>

        {grade.subjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            {grade.subjects.map((subject) => {
              const icon = getSubjectIcon(subject);
              const chaptersCount = subject.chapters ? subject.chapters.length : 0;
              const subjectCategoryTitle = ContentLoaderService.getSubjectCategoryName(
                subject.subjectCategory || subject.id
              );
              const isSeparateCourseTitle =
                subject.name.trim().toLowerCase() !== subjectCategoryTitle.trim().toLowerCase();

              return (
                <div
                  key={subject.id}
                  style={getSubjectStyle(subject)}
                  className="border-2 rounded-[var(--radius-md)] p-4 flex flex-col justify-between transition-all duration-150 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-11 h-11 rounded-xl bg-[var(--color-surface)] shadow-xs border border-[var(--color-border)] flex items-center justify-center text-2xl shrink-0">
                        {icon}
                      </div>

                      <div className="text-right text-[11px] font-bold text-[var(--color-muted)] leading-snug">
                        <span>{chaptersCount > 0 ? `${chaptersCount} тем(и)` : 'Матеріали неповні'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--color-primary-dark)]">
                        Предмет: {subjectCategoryTitle}
                      </div>

                      {isSeparateCourseTitle ? (
                        <h3 className="font-extrabold text-sm text-[var(--color-text)] leading-snug">
                          {subject.name}
                        </h3>
                      ) : (
                        <h3 className="font-extrabold text-sm text-[var(--color-text)] leading-snug">
                          {subjectCategoryTitle}
                        </h3>
                      )}

                      <div className="text-[11px] font-semibold text-[var(--color-muted)]">
                        {subject.authorLabel || (subject.isCustom ? 'Авторський імпортований курс' : 'Базова програма курсу')}
                      </div>

                      <p className="text-xs text-[var(--color-muted)] line-clamp-2 pt-1 leading-relaxed">
                        {subject.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[var(--color-border)] flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onOpenSubject(subject.id)}
                      className="w-full text-xs font-bold"
                    >
                      📖 Відкрити предмет
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 bg-[var(--color-bg)] text-center rounded-[var(--radius-md)] space-y-2 border border-[var(--color-border)]">
            <span className="text-2xl block">📭</span>
            <h4 className="font-bold text-sm text-[var(--color-text)]">
              Для {grade.gradeNumber} класу навчальні матеріали ще відсутні
            </h4>
            <p className="text-xs text-[var(--color-muted)] max-w-md mx-auto">
              Учителі та батьки можуть створити або імпортувати уроки у захищеній Студії автора.
            </p>
            {onOpenYamlImporter && (
              <Button variant="accent" size="sm" onClick={onOpenYamlImporter} className="text-xs font-bold mt-1">
                🔐 Відкрити Студію автора
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
