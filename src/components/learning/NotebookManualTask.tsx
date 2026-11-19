import React, { useState } from 'react';
import { ManualTask } from '../../curriculum/types';
import { Button } from '../ui/Button';

interface NotebookManualTaskProps {
  task: ManualTask;
  onSuccess: (reward: { wood: number; stone: number; energy: number }) => void;
  onOpenHintGate: () => void;
  playSuccessSound: () => void;
  playErrorSound: () => void;
}

export const NotebookManualTask: React.FC<NotebookManualTaskProps> = ({
  task,
  onSuccess,
  onOpenHintGate,
  playSuccessSound,
  playErrorSound,
}) => {
  const [answerInput, setAnswerInput] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericVal = parseInt(answerInput.trim(), 10);
    if (isNaN(numericVal)) return;

    const correct = numericVal === task.correctAnswer;
    setIsSubmitted(true);
    setIsCorrect(correct);

    if (correct) {
      playSuccessSound();
      onSuccess(task.reward);
    } else {
      playErrorSound();
    }
  };

  return (
    <div className="p-4 bg-[var(--color-notebook-bg)] border border-[var(--color-notebook-line)] rounded-[var(--radius-sm)] space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-extrabold text-sm text-[var(--color-primary-dark)]">
          {task.title}
        </h4>
        <button
          type="button"
          onClick={onOpenHintGate}
          className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1"
        >
          💡 Шпаргалка-підказка
        </button>
      </div>

      <p className="text-xs text-[var(--color-muted)] font-medium leading-relaxed">
        {task.contextStory}
      </p>

      {/* Notebook Paper Box */}
      <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded font-mono text-xs font-extrabold text-[var(--color-text)]">
        ✏️ {task.notebookPrompt}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block text-xs font-bold text-[var(--color-text)]">
          {task.question}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            placeholder="Введіть число..."
            className="input-field flex-1 text-xs py-2 bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]"
            disabled={isSubmitted && isCorrect}
            required
          />
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitted && isCorrect}
            className="text-xs font-bold shrink-0"
          >
            Відповісти
          </Button>
        </div>
      </form>

      {isSubmitted && (
        <div
          className={`p-3 rounded-[var(--radius-sm)] text-xs font-bold border ${
            isCorrect
              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-border)]'
              : 'bg-[var(--color-guidance-bg)] text-[var(--color-guidance-text)] border-[var(--color-guidance-border)]'
          }`}
        >
          {isCorrect
            ? `🎉 Чудово! Додано ресурси: +${task.reward.wood}🪵, +${task.reward.stone}🪨, +${task.reward.energy}⚡`
            : '💡 Перевірте обчислення у зошиті та спробуйте іншу гіпотезу! (+15 XP Стійкості за спробу)'}
        </div>
      )}
    </div>
  );
};
