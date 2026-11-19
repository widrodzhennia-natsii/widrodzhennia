import React from 'react';
import { Button } from '../ui/Button';

interface AnswerInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenHint: () => void;
  isDisabled?: boolean;
  isCompleted?: boolean;
}

export const AnswerInput: React.FC<AnswerInputProps> = ({
  value,
  onChange,
  onSubmit,
  onOpenHint,
  isDisabled = false,
  isCompleted = false,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-xs font-bold text-[var(--color-primary-dark)] uppercase tracking-wider">
        Введіть обчислену відповідь із зошита:
      </label>

      <div className="flex flex-wrap gap-2 min-w-0 max-w-full">
        <input
          type="number"
          step="any"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Наприклад: 14"
          disabled={isDisabled || isCompleted}
          className="input-field flex-1 min-w-[140px]"
          aria-label="Числова відповідь"
        />

        {!isCompleted && (
          <Button type="submit" variant="primary" disabled={isDisabled}>
            Перевірити
          </Button>
        )}
      </div>

      {!isCompleted && (
        <div className="flex justify-between items-center pt-1">
          <button
            type="button"
            onClick={onOpenHint}
            className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1"
          >
            💡 Попросити підказку (через питання з Історії України)
          </button>
        </div>
      )}
    </form>
  );
};
