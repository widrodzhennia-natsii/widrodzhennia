import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

interface FormulaPiece {
  id: string;
  label: string;
  order: number;
}

interface CatchFormulaMiniGameProps {
  steps?: string[];
  onUnlockHint: () => void;
  playSuccessSound?: () => void;
}

const DEFAULT_CALM_STEPS = [
  '1. Уважно прочитати умову та вихідні дані',
  '2. Виконати покроковий розрахунок у чернетці',
  '3. Звірити одиниці вимірювання та підсумок',
];

export const CatchFormulaMiniGame: React.FC<CatchFormulaMiniGameProps> = ({
  steps,
  onUnlockHint,
  playSuccessSound,
}) => {
  const buildPieces = (srcSteps?: string[]): FormulaPiece[] => {
    const activeSteps = srcSteps && srcSteps.length >= 2 ? srcSteps : DEFAULT_CALM_STEPS;
    return activeSteps.map((label, idx) => ({
      id: `piece_${idx + 1}`,
      label,
      order: idx + 1,
    }));
  };

  const [pieces, setPieces] = useState<FormulaPiece[]>(() => buildPieces(steps));
  const [placedPieces, setPlacedPieces] = useState<FormulaPiece[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setPieces(buildPieces(steps));
    setPlacedPieces([]);
    setIsCompleted(false);
  }, [steps]);

  const totalCount = (steps && steps.length >= 2 ? steps.length : DEFAULT_CALM_STEPS.length);

  const handleSelectPiece = (piece: FormulaPiece) => {
    if (isCompleted) return;

    const nextOrder = placedPieces.length + 1;
    if (piece.order === nextOrder) {
      const nextPlaced = [...placedPieces, piece];
      setPlacedPieces(nextPlaced);
      setPieces((prev) => prev.filter((p) => p.id !== piece.id));

      if (nextPlaced.length === totalCount) {
        setIsCompleted(true);
        playSuccessSound?.();
        setTimeout(() => {
          onUnlockHint();
        }, 650);
      }
    }
  };

  return (
    <div className="space-y-3 p-4 bg-[var(--color-guidance-bg)] border border-[var(--color-guidance-border)] rounded-[var(--radius-sm)] shadow-sm">
      <div className="flex items-center justify-between text-xs font-bold text-[var(--color-guidance-text)]">
        <span>🧩 Спокійне впорядкування кроків</span>
        <span>Крок {placedPieces.length} з {totalCount}</span>
      </div>

      <p className="text-xs text-[var(--hl-text)]">
        Натисніть на етапи розв&apos;язання по черзі, щоб спокійно налаштуватися та відкрити підказку:
      </p>

      <div className="flex flex-wrap items-center gap-2 min-h-[44px] p-2 bg-[var(--color-surface)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
        {placedPieces.length === 0 ? (
          <span className="text-xs text-[var(--color-muted)] italic">
            Оберіть перший крок нижче...
          </span>
        ) : (
          placedPieces.map((p) => (
            <span
              key={p.id}
              className="px-2.5 py-1 status-panel--success border rounded-[var(--radius-sm)] font-bold text-xs"
            >
              ✓ {p.label}
            </span>
          ))
        )}
      </div>

      {!isCompleted && (
        <div className="flex flex-wrap gap-2 pt-1">
          {pieces.map((piece) => (
            <Button
              key={piece.id}
              variant="outline"
              size="sm"
              onClick={() => handleSelectPiece(piece)}
              className="font-semibold text-left"
            >
              ✨ {piece.label}
            </Button>
          ))}
        </div>
      )}

      {isCompleted && (
        <div className="status-panel status-panel--success text-center">
          Послідовність зібрано! Підказка відкрита.
        </div>
      )}
    </div>
  );
};
