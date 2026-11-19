import React, { useState } from 'react';
import { RecognitionQuestion } from '../../curriculum/types';
import { Button } from '../ui/Button';

interface MultipleChoiceTaskProps {
  task: RecognitionQuestion;
  onSuccess: () => void;
  playSuccessSound: () => void;
  playErrorSound: () => void;
}

export const MultipleChoiceTask: React.FC<MultipleChoiceTaskProps> = ({
  task,
  onSuccess,
  playSuccessSound,
  playErrorSound,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);

  const handleSubmit = () => {
    if (selectedIdx === null) return;

    const correct = selectedIdx === task.correctIndex;
    setIsSubmitted(true);
    setIsCorrect(correct);

    if (correct) {
      playSuccessSound();
      onSuccess();
    } else {
      playErrorSound();
    }
  };

  return (
    <div className="p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] space-y-3">
      <h4 className="font-extrabold text-sm text-[var(--color-text)]">
        {task.question}
      </h4>

      <div className="space-y-2">
        {task.options.map((option, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (!isSubmitted || !isCorrect) {
                  setSelectedIdx(idx);
                  setIsSubmitted(false);
                }
              }}
              className={`w-full text-left p-3 rounded-[var(--radius-sm)] text-xs font-bold transition-all border ${
                isSelected
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)] shadow-xs'
                  : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {isSubmitted && (
        <div
          className={`p-3 rounded-[var(--radius-sm)] text-xs font-bold border ${
            isCorrect
              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-border)]'
              : 'bg-[var(--color-guidance-bg)] text-[var(--color-guidance-text)] border-[var(--color-guidance-border)]'
          }`}
        >
          {isCorrect ? `✓ Правильно! ${task.explanation}` : '💡 Випробуйте іншу гіпотезу!'}
        </div>
      )}

      {(!isSubmitted || !isCorrect) && (
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={selectedIdx === null}
          className="w-full text-xs font-bold mt-2"
        >
          Підтвердити вибір
        </Button>
      )}
    </div>
  );
};
