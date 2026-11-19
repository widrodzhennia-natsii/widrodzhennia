import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ContentLoaderService } from '../../services/contentLoaderService';
import { useMusicStudioStore } from '../../features/music-studio/useMusicStudioStore';
import { useSessionStore } from '../../core/state/useSessionStore';

interface ClassDoorsHallProps {
  studentName: string;
  onOpenDoor: (gradeId: string) => void;
  onOpenProfile: () => void;
}

export const ClassDoorsHall: React.FC<ClassDoorsHallProps> = ({
  studentName,
  onOpenDoor,
  onOpenProfile,
}) => {
  const grades = ContentLoaderService.getGrades();
  const { setStudioModalOpen } = useMusicStudioStore();
  const { openCartridges, openCoop } = useSessionStore();

  return (
    <div className="space-y-5 max-w-[1120px] w-full min-w-0 mx-auto py-2">
      <div
        className="text-[var(--accent-text)] p-4 sm:p-5 rounded-[var(--radius-lg)] shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 border border-[var(--border)] min-w-0 max-w-full overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)' }}
      >
        <div className="space-y-1 text-center lg:text-left min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight break-words">
            Вітаємо, {studentName}!
          </h1>
          <p className="text-xs sm:text-sm opacity-90 max-w-xl mx-auto lg:mx-0">
            Оберіть клас (1–12), щоб переглянути предмети або відкрийте вільну творчість чи життєві навички:
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 min-w-0 max-w-full">
          <Button
            variant="outline"
            onClick={() => openCoop()}
            size="sm"
            className="font-bold text-xs bg-[var(--surface)] text-[var(--text)] px-3 py-2"
          >
            🤝 Сімейний Co-op
          </Button>
          <Button
            variant="outline"
            onClick={() => openCartridges('resilience')}
            size="sm"
            className="font-bold text-xs bg-[var(--surface)] text-[var(--text)] px-3 py-2"
          >
            🛡️ Життєві навички й Арена
          </Button>
          <Button
            variant="outline"
            onClick={() => setStudioModalOpen(true)}
            size="sm"
            className="font-bold text-xs bg-[var(--surface)] text-[var(--text)] px-3 py-2"
          >
            🎼 Музична майстерня
          </Button>
          <Button
            variant="accent"
            onClick={onOpenProfile}
            size="sm"
            className="font-bold text-xs px-3 py-2"
          >
            👤 Мій Профіль
          </Button>
        </div>
      </div>

      <Card title="🚪 Двері Класів (1–12)">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-1">
          {grades.map((grade) => {
            const chaptersCount = grade.subjects.reduce((sum, s) => sum + (s.chapters?.length || 0), 0);
            const hasSubjects = grade.subjects.length > 0;

            return (
              <div
                key={grade.id}
                onClick={() => onOpenDoor(grade.id)}
                className="door-card flex flex-col items-center justify-between gap-2 p-3.5 min-h-[148px]"
                style={{
                  borderColor: grade.isAvailable
                    ? 'var(--color-success-border)'
                    : grade.hasPartialMaterials
                    ? 'var(--color-warning-border)'
                    : 'var(--color-border)',
                  backgroundColor: grade.isAvailable
                    ? 'var(--color-success-bg)'
                    : grade.hasPartialMaterials
                    ? 'var(--color-warning-bg)'
                    : 'var(--color-surface)',
                }}
              >
                <div className="text-2xl">🚪</div>

                <div className="text-center">
                  <span className="text-2xl font-black font-mono text-[var(--color-primary-dark)] block leading-none">
                    {grade.gradeNumber}
                  </span>
                  <span className="text-[11px] font-extrabold text-[var(--color-text)] block mt-0.5">
                    клас
                  </span>
                </div>

                {grade.isAvailable ? (
                  <span
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-[var(--radius-sm)] border text-center"
                    style={{
                      color: 'var(--color-success-text)',
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-success-border)',
                    }}
                  >
                    {grade.subjects.length} предм. · {chaptersCount} тем
                  </span>
                ) : grade.hasPartialMaterials || hasSubjects ? (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-sm)] border text-center"
                    style={{
                      color: 'var(--color-warning-text)',
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-warning-border)',
                    }}
                  >
                    Неповні матеріали
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-sm)] border text-center"
                    style={{
                      color: 'var(--color-neutral-text)',
                      backgroundColor: 'var(--color-neutral-bg)',
                      borderColor: 'var(--color-neutral-border)',
                    }}
                  >
                    Матеріали відсутні
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
