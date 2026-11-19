import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

type AllelePair = 'AA' | 'Aa' | 'aa';

export interface PunnettGeneticsConfig {
  targetDominantPct?: number; // e.g. 75 for Aa × Aa, 50 for Aa × aa, 100 for AA × anything
  instruction?: string;
}

const normalizeGenotype = (a1: string, a2: string): AllelePair => {
  if (a1 === 'A' && a2 === 'A') return 'AA';
  if (a1 === 'a' && a2 === 'a') return 'aa';
  return 'Aa';
};

export const PunnettGeneticsLabEngine: React.FC<EngineProps<PunnettGeneticsConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const [parent1, setParent1] = useState<AllelePair>('Aa');
  const [parent2, setParent2] = useState<AllelePair>('Aa');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const p1 = parent1.split('');
  const p2 = parent2.split('');

  const grid: AllelePair[][] = [
    [normalizeGenotype(p1[0], p2[0]), normalizeGenotype(p1[0], p2[1])],
    [normalizeGenotype(p1[1], p2[0]), normalizeGenotype(p1[1], p2[1])],
  ];
  const flat = [...grid[0], ...grid[1]];
  const counts = {
    AA: flat.filter((g) => g === 'AA').length,
    Aa: flat.filter((g) => g === 'Aa').length,
    aa: flat.filter((g) => g === 'aa').length,
  };
  const dominantPct = ((counts.AA + counts.Aa) / 4) * 100;
  const recessivePct = (counts.aa / 4) * 100;
  const targetPct = config.targetDominantPct ?? 50;

  useEffect(() => {
    onStateChange?.({ parent1, parent2, dominantPct, counts });
  }, [parent1, parent2, dominantPct, counts, onStateChange]);

  const handleCheck = () => {
    const ok = dominantPct === targetPct;
    setIsDone(ok);
    if (ok) {
      setFeedback(`🧬 Схрещування ${parent1} × ${parent2} дає ${dominantPct}% домінантного фенотипу!`);
      onSubmitAnswer?.({ parent1, parent2, dominantPct });
    } else {
      setFeedback(
        `🧬 Зараз домінантний фенотип складає ${dominantPct}% (${counts.AA + counts.Aa}/4). Доберіть пару батьків для отримання ${targetPct}%.`
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🧬 Доберіть генотипи батьків у решітці Пеннета, щоб отримати ${targetPct}% домінантного фенотипу (A_).`}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2">
          <div className="text-xs font-extrabold text-[var(--primary-dark)]">Батько / Мати 1: {parent1}</div>
          <div className="flex gap-1.5">
            {(['AA', 'Aa', 'aa'] as AllelePair[]).map((g) => (
              <Button
                key={`p1_${g}`}
                type="button"
                size="sm"
                variant={parent1 === g ? 'primary' : 'outline'}
                disabled={isReadOnly}
                onClick={() => {
                  setParent1(g);
                  setFeedback(null);
                }}
              >
                {g}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2">
          <div className="text-xs font-extrabold text-[var(--primary-dark)]">Батько / Мати 2: {parent2}</div>
          <div className="flex gap-1.5">
            {(['AA', 'Aa', 'aa'] as AllelePair[]).map((g) => (
              <Button
                key={`p2_${g}`}
                type="button"
                size="sm"
                variant={parent2 === g ? 'primary' : 'outline'}
                disabled={isReadOnly}
                onClick={() => {
                  setParent2(g);
                  setFeedback(null);
                }}
              >
                {g}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 items-center">
        {/* 2x2 Punnett grid */}
        <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="grid grid-cols-3 gap-1.5 font-mono text-sm font-black text-center max-w-[230px] mx-auto">
            <div className="p-2 text-[var(--text-muted)]">×</div>
            <div className="p-2 rounded bg-[var(--surface-alt)] border border-[var(--border)]">{p2[0]}</div>
            <div className="p-2 rounded bg-[var(--surface-alt)] border border-[var(--border)]">{p2[1]}</div>

            <div className="p-2 rounded bg-[var(--surface-alt)] border border-[var(--border)]">{p1[0]}</div>
            {grid[0].map((cell, idx) => (
              <div
                key={`r0_${idx}`}
                className="p-2.5 rounded border-2"
                style={{
                  borderColor: cell === 'aa' ? 'var(--border)' : 'var(--accent)',
                  backgroundColor: cell === 'aa' ? 'var(--surface-alt)' : 'var(--hl-bg)',
                  color: cell === 'aa' ? 'var(--text)' : 'var(--hl-text)',
                }}
              >
                {cell}
              </div>
            ))}

            <div className="p-2 rounded bg-[var(--surface-alt)] border border-[var(--border)]">{p1[1]}</div>
            {grid[1].map((cell, idx) => (
              <div
                key={`r1_${idx}`}
                className="p-2.5 rounded border-2"
                style={{
                  borderColor: cell === 'aa' ? 'var(--border)' : 'var(--accent)',
                  backgroundColor: cell === 'aa' ? 'var(--surface-alt)' : 'var(--hl-bg)',
                  color: cell === 'aa' ? 'var(--text)' : 'var(--hl-text)',
                }}
              >
                {cell}
              </div>
            ))}
          </div>
        </div>

        {/* Distribution stats */}
        <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] space-y-2 text-xs font-bold">
          <div>Розщеплення генотипів:</div>
          <div className="font-mono">AA: {counts.AA}/4 ({counts.AA * 25}%)</div>
          <div className="font-mono">Aa: {counts.Aa}/4 ({counts.Aa * 25}%)</div>
          <div className="font-mono">aa: {counts.aa}/4 ({counts.aa * 25}%)</div>
          <div className="pt-2 border-t border-[var(--border)] flex justify-between">
            <span>Домінантна ознака (A_):</span>
            <span className="font-mono font-black text-[var(--primary-dark)]">{dominantPct}%</span>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Рецесивна (aa):</span>
            <span className="font-mono">{recessivePct}%</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Підтвердити схрещування
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
