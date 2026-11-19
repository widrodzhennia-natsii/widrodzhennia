import React from 'react';
import { ValidationResult } from '../../services/validationService';

interface FeedbackMessageProps {
  result: ValidationResult | null;
  onNextStage?: () => void;
  isCompleted?: boolean;
}

export const FeedbackMessage: React.FC<FeedbackMessageProps> = ({
  result,
  onNextStage,
  isCompleted,
}) => {
  if (!result && !isCompleted) return null;

  if (isCompleted) {
    return (
      <div className="p-4 bg-[var(--color-success-bg)] border border-[var(--color-success)] rounded-[var(--radius-sm)] space-y-2">
        <div className="flex items-center gap-2 text-[var(--color-success)] font-bold text-sm">
          <span>🎉 Завдання успішно виконано!</span>
        </div>
        <p className="text-xs text-[var(--color-text)]">
          Матеріали підготолено, острів відбудовується. Можна переходити до наступного етапу!
        </p>
        {onNextStage && (
          <button
            onClick={onNextStage}
            className="btn btn-accent text-xs font-bold py-2 px-4 mt-2"
          >
            ▶ Перейти до наступного етапу
          </button>
        )}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div
      className={`p-3 rounded-[var(--radius-sm)] border text-xs font-semibold ${
        result.isValid
          ? 'bg-[var(--color-success-bg)] border-[var(--color-success)] text-[var(--color-success)]'
          : 'bg-[var(--color-error-bg)] border-[var(--color-error)] text-[var(--color-error)]'
      }`}
    >
      <p>{result.message}</p>
    </div>
  );
};
