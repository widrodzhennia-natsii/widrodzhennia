import React, { useState, useEffect } from 'react';
import { validateTextAnswer } from '../../services/validationService';
import { Button } from '../ui/Button';
import { HintGateQuestion } from '../../hooks/useHintGate';

interface HistoryQuestionProps {
  question: HintGateQuestion;
  onSuccess: () => void;
  onFail?: () => void;
}

export const HistoryQuestion: React.FC<HistoryQuestionProps> = ({
  question,
  onSuccess,
  onFail,
}) => {
  const [answer, setAnswer] = useState('');
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setAnswer('');
    setFeedbackText(null);
    setIsSuccess(false);
  }, [question.question, question.correctAnswer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;

    const isCorrect = validateTextAnswer(answer, question.correctAnswer);
    if (isCorrect) {
      setIsSuccess(true);
      setFeedbackText(
        `✅ Вірно! ${question.explanation ? question.explanation : 'Підказка відкрита.'}`
      );
      setTimeout(() => {
        onSuccess();
      }, 650);
    } else {
      setIsSuccess(false);
      setFeedbackText('Подумайте ще раз або перегляньте теоретичний блок уроку (альтернатива — спокійна міні-гра).');
      onFail?.();
    }
  };

  return (
    <div className="space-y-3 p-4 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between text-xs font-bold text-[var(--color-muted)]">
        <span>📝 Контрольне запитання</span>
        {question.era && <span>{question.era}</span>}
      </div>

      <p className="text-sm font-bold text-[var(--color-text)]">
        {question.question}
      </p>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={`Введіть відповідь (наприклад: ${question.correctAnswer === 'Так' ? 'Так' : 'значення або слово'})...`}
          className="input-field text-sm"
          required
        />
        <Button type="submit" variant="accent" size="sm" className="w-full">
          Відкрити підказку
        </Button>
      </form>

      {feedbackText && (
        <p
          className="text-xs font-bold mt-2"
          style={{ color: isSuccess ? 'var(--color-success-text)' : 'var(--color-muted)' }}
        >
          {feedbackText}
        </p>
      )}
    </div>
  );
};
