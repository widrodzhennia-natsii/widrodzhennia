import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
  fullScreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-lg',
  fullScreen = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${fullScreen ? 'modal-overlay--fullscreen' : 'p-3 sm:p-4'}`}
      onClick={fullScreen ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal-content w-full ${
          fullScreen
            ? 'modal-content--fullscreen'
            : `${maxWidthClass} max-h-[90vh] overflow-y-auto`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-[var(--color-border)] gap-2 min-w-0">
          <h3 className="text-base sm:text-xl font-bold text-[var(--color-text)] min-w-0 flex-1">
            {title}
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="inline-flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] px-2.5 py-1.5 font-bold text-sm sm:text-base bg-[var(--surface-alt)] border border-[var(--border)] hover:border-[var(--accent)] rounded-[var(--radius-sm)] transition-colors cursor-pointer shrink-0"
            aria-label="Закрити модальне вікно"
          >
            <span>✕</span>
            {fullScreen && <span className="text-xs font-extrabold">Закрити</span>}
          </button>
        </div>
        <div className={fullScreen ? 'flex-1 min-h-0 overflow-y-auto pr-0.5' : ''}>
          {children}
        </div>
      </div>
    </div>
  );
};
