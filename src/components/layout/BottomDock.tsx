import React, { useEffect, useState } from 'react';
import { ActiveView } from '../../app/appTypes';
import { useActiveLessonSession } from '../../hooks/useActiveLessonSession';
import { useLayoutPrefsStore, DensityPreference } from '../../core/state/useLayoutPrefsStore';

interface BottomDockProps {
  activeView: ActiveView;
  onBackView: () => void;
  onOpenProfile: () => void;
}

const DENSITY_SHORT_LABELS: Record<DensityPreference, string> = {
  auto: 'Авто',
  slides: 'Слайди',
  cascade: 'Каскад',
  document: 'Конспект',
};

export const BottomDock: React.FC<BottomDockProps> = ({
  activeView,
  onBackView,
  onOpenProfile,
}) => {
  const lesson = useActiveLessonSession();
  const { densityMode, cycleDensityMode } = useLayoutPrefsStore();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  // Auto-hide BottomDock whenever focus enters an input/textarea or mobile keyboard shrinks viewport
  useEffect(() => {
    const isInputTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'select') return true;
      if (tag === 'input') {
        const type = (el as HTMLInputElement).type;
        return !['range', 'checkbox', 'radio', 'button', 'submit'].includes(type);
      }
      return el.isContentEditable;
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isInputTarget(e.target)) setIsKeyboardActive(true);
    };
    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (!isInputTarget(document.activeElement)) {
          setIsKeyboardActive(false);
        }
      }, 60);
    };

    const baseHeight = window.innerHeight;
    const handleViewportResize = () => {
      if (window.visualViewport) {
        const shrunkBy = baseHeight - window.visualViewport.height;
        if (shrunkBy > 160 && isInputTarget(document.activeElement)) {
          setIsKeyboardActive(true);
        } else if (shrunkBy < 80 && !isInputTarget(document.activeElement)) {
          setIsKeyboardActive(false);
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  if (isKeyboardActive || activeView !== 'game') return null;

  const activeIdxForNav =
    lesson.effectiveDensity === 'document' ? lesson.docActiveStepIndex : lesson.currentStepIndex;
  const canPrev = activeIdxForNav > 0;
  const canNext = activeIdxForNav < lesson.safeTotal - 1;

  const dockCounterText =
    lesson.effectiveDensity === 'document'
      ? `${lesson.docScrollPercent}%`
      : lesson.effectiveDensity === 'cascade' && lesson.cascadeEnd > lesson.cascadeStart
      ? `${lesson.cascadeStart + 1}–${lesson.cascadeEnd + 1}/${lesson.safeTotal}`
      : `${lesson.safeCurrentStep}/${lesson.safeTotal}`;

  return (
    <nav
      className="bottom-dock md:hidden"
      aria-label="Мобільна навігація уроку"
    >
      <button
        type="button"
        onClick={() =>
          canPrev ? lesson.navigateAndScrollToStep(activeIdxForNav - 1) : onBackView()
        }
        className="bottom-dock-btn"
        aria-label={canPrev ? 'Попередній крок' : 'Вийти до списку тем'}
        title={canPrev ? 'Попередній крок' : 'До тем'}
      >
        <span aria-hidden="true">←</span>
        <span className="hidden min-[420px]:inline">{canPrev ? 'Назад' : 'Теми'}</span>
      </button>

      {lesson.hasContext && (
        <button
          type="button"
          onClick={() => {
            const nextOpen = !lesson.showLeftPanel;
            lesson.setShowLeftPanel(nextOpen);
            if (nextOpen) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className={`bottom-dock-btn ${lesson.showLeftPanel ? 'bottom-dock-btn--active' : ''}`}
          aria-pressed={lesson.showLeftPanel}
          aria-label={lesson.showLeftPanel ? 'Сховати контекст уроку' : 'Показати контекст уроку'}
          title="Контекст уроку"
        >
          <span aria-hidden="true">📖</span>
          <span className="hidden min-[380px]:inline">Контекст</span>
        </button>
      )}

      <button
        type="button"
        onClick={cycleDensityMode}
        className="bottom-dock-btn"
        title="Перемкнути режим: Слайди / Каскад / Конспект"
        aria-label={`Режим відображення: ${DENSITY_SHORT_LABELS[densityMode]}`}
      >
        <span aria-hidden="true">☷</span>
        <span>{DENSITY_SHORT_LABELS[densityMode]}</span>
      </button>

      <div className="bottom-dock-step tabular-nums" title="Поточний прогрес">
        {dockCounterText}
      </div>

      <button
        type="button"
        onClick={
          canNext
            ? () => lesson.navigateAndScrollToStep(activeIdxForNav + 1)
            : onOpenProfile
        }
        className="bottom-dock-btn bottom-dock-btn--primary"
        aria-label={canNext ? 'Наступний крок' : 'Відкрити профіль'}
      >
        <span>{canNext ? 'Далі' : 'Профіль'}</span>
        <span aria-hidden="true">{canNext ? '→' : '👤'}</span>
      </button>
    </nav>
  );
};
