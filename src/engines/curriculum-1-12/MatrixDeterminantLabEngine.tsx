import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface MatrixDeterminantConfig {
  size?: 2 | 3;
  targetDet?: number;
  instruction?: string;
}

const calcDet2 = (m: number[][]) => m[0][0] * m[1][1] - m[0][1] * m[1][0];

const calcDet3 = (m: number[][]) =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

export const MatrixDeterminantLabEngine: React.FC<EngineProps<MatrixDeterminantConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const [size, setSize] = useState<2 | 3>(config.size ?? 2);
  const targetDet = config.targetDet ?? 10;
  const [matrix, setMatrix] = useState<number[][]>(() =>
    size === 2
      ? [
          [4, 1],
          [2, 3],
        ]
      : [
          [2, 1, 0],
          [1, 3, 1],
          [0, 1, 2],
        ]
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);

  const switchSize = (nextSize: 2 | 3) => {
    setSize(nextSize);
    setMatrix(
      nextSize === 2
        ? [
            [4, 1],
            [2, 3],
          ]
        : [
            [2, 1, 0],
            [1, 3, 1],
            [0, 1, 2],
          ]
    );
    setFeedback(null);
    setIsCorrect(false);
  };

  const det = size === 2 ? calcDet2(matrix) : calcDet3(matrix);

  useEffect(() => {
    onStateChange?.({ size, matrix, det });
  }, [size, matrix, det, onStateChange]);

  const setCell = (r: number, c: number, val: number) => {
    if (isReadOnly) return;
    setMatrix((prev) =>
      prev.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? val : v)) : row))
    );
    setFeedback(null);
    setIsCorrect(false);
  };

  const handleCheck = () => {
    const ok = det === targetDet;
    setIsCorrect(ok);
    if (ok) {
      setFeedback(`✅ Визначник det(A) = ${det} точно відповідає цілі (${targetDet})!`);
      onSubmitAnswer?.({ det, matrix });
    } else {
      setFeedback(`📐 Зараз det(A) = ${det}. Відкоригуйте елементи матриці, щоб отримати det(A) = ${targetDet}.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🔢 Змінюйте елементи матриці ${size}×${size}, щоб отримати визначник det(A) = ${targetDet}.`}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant={size === 2 ? 'primary' : 'outline'} onClick={() => switchSize(2)}>
            Матриця 2×2
          </Button>
          <Button type="button" size="sm" variant={size === 3 ? 'primary' : 'outline'} onClick={() => switchSize(3)}>
            Матриця 3×3
          </Button>
        </div>

        <div className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] font-mono text-sm font-black">
          det(A) = <span className="text-[var(--primary-dark)]">{det}</span>
        </div>
      </div>

      <div className="flex justify-center p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <span className="text-4xl font-light text-[var(--text-muted)]">|</span>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(52px, 64px))` }}
          >
            {matrix.map((row, r) =>
              row.map((val, c) => {
                const isMainDiag = r === c;
                return (
                  <input
                    key={`${r}_${c}`}
                    type="number"
                    disabled={isReadOnly}
                    value={val}
                    onChange={(e) => setCell(r, c, Number(e.target.value) || 0)}
                    className="w-full p-2 text-center font-mono text-base font-black rounded border-2 focus:outline-none"
                    style={{
                      borderColor: isMainDiag ? 'var(--accent)' : 'var(--border)',
                      backgroundColor: isMainDiag ? 'var(--hl-bg)' : 'var(--surface-alt)',
                      color: isMainDiag ? 'var(--hl-text)' : 'var(--text)',
                    }}
                  />
                );
              })
            )}
          </div>
          <span className="text-4xl font-light text-[var(--text-muted)]">|</span>
        </div>
      </div>

      {size === 2 && (
        <div className="text-xs font-mono text-center text-[var(--text-muted)]">
          det(A) = ({matrix[0][0]}·{matrix[1][1]}) − ({matrix[0][1]}·{matrix[1][0]}) = {matrix[0][0] * matrix[1][1]} − {matrix[0][1] * matrix[1][0]} = {det}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Перевірити визначник
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isCorrect
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};
