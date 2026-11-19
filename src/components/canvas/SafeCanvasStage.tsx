import React, { useEffect, useRef, useState } from 'react';

interface SafeCanvasStageProps {
  children: React.ReactNode;
  /** External HTML/React overlay rendered cleanly OUTSIDE <canvas> bounds so bubbles never clip */
  overlaySlot?: React.ReactNode;
  /** Single-line concise mobile prompt shown cleanly below or above canvas without clipping */
  mobileHint?: string;
  /** Detailed prompt text revealed in an accessible mobile Bottom Sheet drawer */
  mobileFullHelp?: string;
  /** Fires false when tab is hidden or container is offscreen so engines sleep at 0% CPU */
  onVisibilityChange?: (isVisible: boolean) => void;
  /** Optional subtle status tag when physics/animation loop is sleeping */
  isIdleSleeping?: boolean;
  className?: string;
}

export const SafeCanvasStage: React.FC<SafeCanvasStageProps> = ({
  children,
  overlaySlot,
  mobileHint,
  mobileFullHelp,
  onVisibilityChange,
  isIdleSleeping = true,
  className = '',
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(640);
  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);

  // Measure adaptive Safe Bounding Box cleanly without layout thrashing
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && Math.abs(w - stageWidth) >= 2) {
        setStageWidth(Math.round(w));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageWidth]);

  // 0% CPU Idle Sleep guard on tab switch or viewport exit
  useEffect(() => {
    if (!onVisibilityChange) return;
    let isDocVisible = typeof document !== 'undefined' ? !document.hidden : true;
    let isIntersecting = true;

    const emit = () => onVisibilityChange(isDocVisible && isIntersecting);

    const handleVisibility = () => {
      isDocVisible = !document.hidden;
      emit();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let io: IntersectionObserver | null = null;
    if (stageRef.current && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          isIntersecting = entries[0]?.isIntersecting ?? true;
          emit();
        },
        { threshold: 0.05 }
      );
      io.observe(stageRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      io?.disconnect();
    };
  }, [onVisibilityChange]);

  const isNarrow = stageWidth < 520;

  return (
    <div ref={stageRef} className={`safe-canvas-stage space-y-2.5 ${className}`} data-narrow={isNarrow ? 'true' : 'false'}>
      {/* Pure Canvas Viewport Box */}
      <div className="safe-canvas-frame relative rounded-[var(--radius-md)] overflow-hidden border-2 border-[var(--border)] shadow-inner bg-[var(--surface-alt)]">
        {children}

        {isIdleSleeping && (
          <span
            className="sr-only"
            aria-live="off"
          >
            Сцена у режимі енергозбереження (0% CPU)
          </span>
        )}
      </div>

      {/* 1-Line Mobile Hint + Bottom Sheet Trigger (prevents verbose clutter) */}
      {(mobileHint || mobileFullHelp) && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] text-xs">
          <span className="truncate font-semibold text-[var(--text)] flex-1 min-w-0">
            {mobileHint || mobileFullHelp}
          </span>
          {mobileFullHelp && (
            <button
              type="button"
              onClick={() => setIsSheetOpen(true)}
              className="shrink-0 font-extrabold text-[var(--primary-dark)] hover:text-[var(--accent)] underline cursor-pointer whitespace-nowrap"
            >
              Деталі ▴
            </button>
          )}
        </div>
      )}

      {/* External React Overlay OUTSIDE <canvas> so reaction bubbles never clip */}
      {overlaySlot && (
        <div className="safe-canvas-external-overlay space-y-2">
          {overlaySlot}
        </div>
      )}

      {/* Mobile Bottom Sheet Drawer */}
      {isSheetOpen && mobileFullHelp && (
        <div
          className="bottom-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Деталі симуляції"
          onClick={() => setIsSheetOpen(false)}
        >
          <div
            className="bottom-sheet-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--primary-dark)]">
                📋 Пояснення до сцени
              </span>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="btn btn-outline btn-sm"
                aria-label="Закрити пояснення"
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text)] font-medium pt-2">
              {mobileFullHelp}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
