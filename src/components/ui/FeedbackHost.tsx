import React from 'react';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';
import { Modal } from './Modal';
import { Button } from './Button';

export const FeedbackHost: React.FC = () => {
  const { toasts, dismissToast, confirmRequest, resolveConfirm } = useFeedbackStore();

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'status-panel--success';
      case 'warning':
        return 'status-panel--warning';
      case 'error':
        return 'status-panel--danger';
      default:
        return 'bg-[var(--color-surface)] border-[var(--color-primary)] text-[var(--color-text)]';
    }
  };

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '💡';
      case 'error':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <>
      {/* In-app Toast Stack */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-[var(--radius-md)] border-2 shadow-lg flex items-start justify-between gap-3 text-xs font-bold animate-fadeIn ${getToastStyles(toast.type)}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-none shrink-0">{getToastIcon(toast.type)}</span>
                <span className="leading-relaxed">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="opacity-75 hover:opacity-100 text-xs font-bold px-1 shrink-0 cursor-pointer"
                aria-label="Закрити сповіщення"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* In-app Confirmation Modal */}
      {confirmRequest && (
        <Modal
          isOpen={true}
          onClose={() => resolveConfirm(false)}
          title={confirmRequest.title}
        >
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-[var(--color-text)] leading-relaxed font-medium">
              {confirmRequest.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveConfirm(false)}
                className="text-xs font-bold"
              >
                {confirmRequest.cancelLabel || 'Скасувати'}
              </Button>
              <Button
                variant={confirmRequest.danger ? 'outline' : 'primary'}
                size="sm"
                onClick={() => resolveConfirm(true)}
                className="text-xs font-bold"
                style={
                  confirmRequest.danger
                    ? {
                        color: 'var(--color-danger-text)',
                        borderColor: 'var(--color-danger-border)',
                        backgroundColor: 'var(--color-danger-bg)',
                      }
                    : undefined
                }
              >
                {confirmRequest.confirmLabel || 'Підтвердити'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
