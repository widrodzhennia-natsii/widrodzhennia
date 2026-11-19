import React, { useEffect, useMemo, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';
import type { PixelEmbroiderySpec } from './pixelEmbroidery.types';

export interface PixelEmbroideryEngineConfig extends Partial<PixelEmbroiderySpec> {
  targetMinActiveCells?: number;
  instruction?: string;
}

type StitchType = 0 | 1 | 2; // 0 = empty, 1 = primary cross, 2 = accent cross

const createEmptyGrid = (rows: number, cols: number): StitchType[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

const createRhombusPreset = (rows: number, cols: number): StitchType[][] => {
  const g = createEmptyGrid(rows, cols);
  const mr = (rows - 1) / 2;
  const mc = (cols - 1) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dist = Math.abs(r - mr) + Math.abs(c - mc);
      if (Math.abs(dist - Math.floor(Math.min(rows, cols) / 2.2)) < 0.75) g[r][c] = 1;
      else if (dist < 1.2) g[r][c] = 2;
    }
  }
  return g;
};

export const PixelEmbroideryGridEngine: React.FC<EngineProps<PixelEmbroideryEngineConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const rows = Math.max(4, Math.min(12, config.rows ?? 8));
  const cols = Math.max(4, Math.min(12, config.cols ?? 8));
  const minCells = config.targetMinActiveCells ?? 8;

  const [symmetry, setSymmetry] = useState<'none' | 'mirror_x' | 'mirror_xy'>(
    config.symmetry ?? 'mirror_xy'
  );
  const [brush, setBrush] = useState<StitchType>(1);
  const [grid, setGrid] = useState<StitchType[][]>(() => createEmptyGrid(rows, cols));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setGrid(createEmptyGrid(rows, cols));
    setSymmetry(config.symmetry ?? 'mirror_xy');
    setFeedback(null);
    setIsDone(false);
  }, [rows, cols, config.symmetry]);

  const activeCount = useMemo(
    () => grid.reduce((sum, row) => sum + row.filter((v) => v > 0).length, 0),
    [grid]
  );

  const rleCode = useMemo(() => {
    return grid.map((row) => row.join('')).join('/');
  }, [grid]);

  useEffect(() => {
    onStateChange?.({ activeCount, symmetry, rleCode });
  }, [activeCount, symmetry, rleCode, onStateChange]);

  const paintCell = (r: number, c: number) => {
    if (isReadOnly) return;
    setFeedback(null);
    setIsDone(false);
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      const val = next[r][c] === brush ? 0 : brush;
      next[r][c] = val;
      const mirrorC = cols - 1 - c;
      const mirrorR = rows - 1 - r;
      if (symmetry === 'mirror_x' || symmetry === 'mirror_xy') {
        next[r][mirrorC] = val;
      }
      if (symmetry === 'mirror_xy') {
        next[mirrorR][c] = val;
        next[mirrorR][mirrorC] = val;
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (activeCount < minCells) {
      setIsDone(false);
      setFeedback(`🧵 Додайте ще хрестиків (зараз ${activeCount}, мінімум ${minCells}), щоб сформувати виразний орнамент.`);
      return;
    }
    setIsDone(true);
    setFeedback(`✅ Орнамент закодовано! Заповнено ${activeCount} хрестиків у режимі симетрії.`);
    onSubmitAnswer?.({ activeCount, symmetry, rleCode });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🪡 Створіть геометричний орнамент вишиванки (${rows}×${cols}), використовуючи симетрію та цифрове кодування рядків.`}
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={brush === 1 ? 'primary' : 'outline'}
            disabled={isReadOnly}
            onClick={() => setBrush(1)}
          >
            ✕ Основний хрестик
          </Button>
          <Button
            type="button"
            size="sm"
            variant={brush === 2 ? 'accent' : 'outline'}
            disabled={isReadOnly}
            onClick={() => setBrush(2)}
          >
            ◆ Другорядний стібок
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(['none', 'mirror_x', 'mirror_xy'] as const).map((sym) => (
            <Button
              key={sym}
              type="button"
              size="sm"
              variant={symmetry === sym ? 'primary' : 'outline'}
              disabled={isReadOnly}
              onClick={() => setSymmetry(sym)}
              className="text-[11px]"
            >
              {sym === 'none' ? 'Без симетрії' : sym === 'mirror_x' ? '◫ Дзеркало X' : '❖ Симетрія 4×'}
            </Button>
          ))}
        </div>
      </div>

      {/* Interactive Cross-Stitch Grid */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div
          className="grid gap-1 p-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] mx-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(26px, 34px))` }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}_${c}`}
                type="button"
                disabled={isReadOnly}
                onClick={() => paintCell(r, c)}
                aria-label={`Клітинка ${r + 1}, ${c + 1}`}
                className="aspect-square rounded-sm border border-[var(--border)] flex items-center justify-center text-sm font-black cursor-pointer transition-colors"
                style={{
                  backgroundColor:
                    cell === 1
                      ? 'var(--accent)'
                      : cell === 2
                      ? 'var(--hl-bg)'
                      : 'var(--surface-alt)',
                  color:
                    cell === 1
                      ? 'var(--accent-text)'
                      : cell === 2
                      ? 'var(--hl-text)'
                      : 'var(--text-muted)',
                }}
              >
                {cell === 1 ? '✕' : cell === 2 ? '◆' : ''}
              </button>
            ))
          )}
        </div>

        <div className="w-full sm:w-56 space-y-2 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)]">
          <div className="text-xs font-extrabold text-[var(--primary-dark)]">
            Кодування рядків (0 / 1 / 2)
          </div>
          <div className="font-mono text-[11px] leading-relaxed text-[var(--text)] space-y-0.5 break-all">
            {grid.map((row, idx) => (
              <div key={idx}>
                <span className="text-[var(--text-muted)] mr-1.5">R{idx + 1}:</span>
                <span>{row.join('')}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isReadOnly}
              onClick={() => setGrid(createRhombusPreset(rows, cols))}
            >
              ❖ Берегиня
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isReadOnly}
              onClick={() => setGrid(createEmptyGrid(rows, cols))}
            >
              Очистити
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[var(--text-muted)]">
          Заповнено стібків: <strong className="text-[var(--text)]">{activeCount}</strong>
        </span>
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleConfirm}>
          ✓ Зберегти й перевірити код візерунка
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isDone
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
