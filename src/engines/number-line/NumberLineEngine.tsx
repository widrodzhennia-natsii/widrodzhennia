import React, { useState, useEffect } from 'react';
import { EngineProps } from '../adapter';

interface NumberLineConfig {
  startNumber?: number;
  addend?: number;
  instruction?: string;
}

export const NumberLineEngine: React.FC<EngineProps<NumberLineConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const startNumber = config.startNumber ?? 0;
  const addend = config.addend ?? 10;

  const [jumpStep, setJumpStep] = useState(0);

  useEffect(() => {
    setJumpStep(0);
  }, [config, startNumber, addend]);

  const targetResult = startNumber + addend;
  const currentPosition = startNumber + jumpStep;

  const handleJump = (step: number) => {
    if (isReadOnly) return;
    setJumpStep((prev) => Math.max(0, prev + step));
  };

  const handleCheck = () => {
    if (onSubmitAnswer) {
      onSubmitAnswer(currentPosition);
    }
  };

  return (
    <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-sm">
      <div className="text-center space-y-1">
        <h4 className="text-xs font-bold text-[var(--primary-dark)] uppercase tracking-wide">
          📏 Числова променева вісь
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction || `Зробіть стрибок від числа ${startNumber} на +${addend}:`}
        </p>
      </div>

      <div className="p-4 bg-[var(--bg)] rounded-[var(--radius-sm)] border border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between font-mono font-bold text-xs text-[var(--primary-dark)] border-b border-[var(--border)] pb-2">
          <span>Старт: {startNumber}</span>
          <span>Позиція: {currentPosition}</span>
          <span>Ціль: {targetResult}</span>
        </div>

        <div className="relative w-full h-8 bg-[var(--surface-alt)] border border-[var(--border)] rounded-full flex items-center px-4 overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              backgroundColor: 'var(--ok-border)',
              width: `${Math.min(100, (jumpStep / Math.max(1, addend)) * 100)}%`,
            }}
          />
          <span className="absolute left-4 text-xs font-bold font-mono text-[var(--text)]">
            {startNumber}
          </span>
          <span className="absolute right-4 text-xs font-bold font-mono text-[var(--text)]">
            {targetResult}
          </span>
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => handleJump(10)}
            className="btn btn-primary px-3.5 py-1.5 text-xs font-bold"
          >
            Стрибок +10
          </button>
          <button
            type="button"
            onClick={() => handleJump(1)}
            className="btn btn-accent px-3.5 py-1.5 text-xs font-bold"
          >
            Стрибок +1
          </button>
          <button
            type="button"
            onClick={() => setJumpStep(0)}
            className="btn btn-outline px-3 py-1.5 text-xs font-bold"
          >
            Скинути
          </button>
        </div>
      )}

      {!isReadOnly && onSubmitAnswer && (
        <button
          type="button"
          onClick={handleCheck}
          className="btn btn-primary w-full text-xs font-bold py-2.5"
        >
          Підтвердити точний результат ({currentPosition})
        </button>
      )}
    </div>
  );
};
