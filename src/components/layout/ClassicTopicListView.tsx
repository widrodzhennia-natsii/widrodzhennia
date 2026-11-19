import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chapter } from '../../curriculum/types';
import { stripInlineMarkup } from '../../core/utils/stripInlineMarkup';

interface ClassicTopicListViewProps {
  subjectName?: string;
  chapters: Chapter[];
  currentChapterIndex: number;
  startedQuestIds: string[];
  completedQuestIds: string[];
  onSelectChapter: (index: number) => void;
  onSelectChapterPractice?: (index: number) => void;
}

export const ClassicTopicListView: React.FC<ClassicTopicListViewProps> = ({
  subjectName,
  chapters,
  currentChapterIndex,
  startedQuestIds,
  completedQuestIds,
  onSelectChapter,
  onSelectChapterPractice,
}) => {
  return (
    <Card title={`📋 Список Тем: ${subjectName || 'Навчальний предмет'}`}>
      <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed">
        Усі теми відкриті для вільного вивчення. Розпочаті та пройдені теми виділені яскравіше.
      </p>

      <div className="space-y-3">
        {chapters.length === 0 ? (
          <div className="p-10 text-center bg-[var(--color-bg)] border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-md)]">
            <span className="text-3xl block mb-2">📚</span>
            <p className="text-xs text-[var(--color-muted)] font-bold">
              Для цього предмета ще немає доданих уроків чи тем.
            </p>
          </div>
        ) : (
          chapters.map((chapter, idx) => {
            const isCompleted = completedQuestIds.includes(chapter.id);
            const isStarted = startedQuestIds.includes(chapter.id);
            const isCurrent = idx === currentChapterIndex && isStarted && !isCompleted;

            return (
              <div
                key={chapter.id}
                className="p-4 border-2 rounded-[var(--radius-md)] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                style={{
                  borderColor: isCompleted
                    ? 'var(--color-success-border)'
                    : isCurrent || isStarted
                    ? 'var(--color-primary)'
                    : 'var(--color-border)',
                  backgroundColor: isCompleted
                    ? 'var(--color-success-bg)'
                    : 'var(--color-surface)',
                }}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[var(--color-primary-dark)]">
                      Тема {idx + 1}.
                    </span>
                    {isCompleted ? (
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-sm)] border"
                        style={{
                          color: 'var(--color-success-text)',
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-success-border)',
                        }}
                      >
                        ✓ Пройдено
                      </span>
                    ) : isStarted ? (
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--radius-sm)] border"
                        style={{
                          color: 'var(--color-warning-text)',
                          backgroundColor: 'var(--color-warning-bg)',
                          borderColor: 'var(--color-warning-border)',
                        }}
                      >
                        ▶ Розпочато
                      </span>
                    ) : (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)] border"
                        style={{
                          color: 'var(--color-neutral-text)',
                          backgroundColor: 'var(--color-neutral-bg)',
                          borderColor: 'var(--color-neutral-border)',
                        }}
                      >
                        Доступно
                      </span>
                    )}

                    {chapter.islandStageName && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)] border"
                        style={{
                          color: 'var(--color-muted)',
                          backgroundColor: 'var(--color-surface-subtle)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        📍 {chapter.islandStageName}
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-sm text-[var(--color-text)] leading-snug">
                    {chapter.title}
                  </h3>

                  <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                    {stripInlineMarkup(chapter.description || '') ||
                      'Навчальний епізод із теоретичним матеріалом та інтерактивними вправами.'}
                  </p>
                </div>

                <div className="w-full sm:w-auto flex flex-wrap flex-col sm:flex-row gap-2 min-w-0 max-w-full">
                  <Button
                    variant={isCurrent || isStarted ? 'accent' : 'primary'}
                    size="sm"
                    onClick={() => onSelectChapter(idx)}
                    className="w-full sm:w-auto text-xs font-bold px-3 py-2"
                  >
                    📖 Відкрити урок
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onSelectChapterPractice ? onSelectChapterPractice(idx) : onSelectChapter(idx)
                    }
                    className="w-full sm:w-auto text-xs font-bold px-3 py-2"
                  >
                    🎯 Тільки вправи
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
