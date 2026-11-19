import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface LogicGatesTracerConfig {
  mode?: 'gates' | 'tracer';
  targetGateOutput?: 0 | 1;
  targetInputs?: [0 | 1, 0 | 1];
  instruction?: string;
}

type GateKind = 'AND' | 'OR' | 'XOR' | 'NAND';

const TRACE_STEPS = [
  { line: 1, code: 'let sum = 0;', vars: { sum: 0, i: '-' } },
  { line: 2, code: 'for (let i = 1; i <= 3; i++) {', vars: { sum: 0, i: 1 } },
  { line: 3, code: '  sum += i * 2;', vars: { sum: 2, i: 1 } },
  { line: 4, code: '} // ітерація i = 2', vars: { sum: 6, i: 2 } },
  { line: 5, code: '} // ітерація i = 3', vars: { sum: 12, i: 3 } },
  { line: 6, code: 'return sum;', vars: { sum: 12, i: 3 } },
];

export const LogicGatesTracerEngine: React.FC<EngineProps<LogicGatesTracerConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const [tab, setTab] = useState<'gates' | 'tracer'>(config.mode ?? 'gates');
  const [inA, setInA] = useState<0 | 1>(1);
  const [inB, setInB] = useState<0 | 1>(0);
  const [gate1, setGate1] = useState<GateKind>('XOR');
  const [invertOut, setInvertOut] = useState(false);

  const [traceIdx, setTraceIdx] = useState(0);
  const [guessedFinalSum, setGuessedFinalSum] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const evalGate = (g: GateKind, a: 0 | 1, b: 0 | 1): 0 | 1 => {
    switch (g) {
      case 'AND':
        return a === 1 && b === 1 ? 1 : 0;
      case 'OR':
        return a === 1 || b === 1 ? 1 : 0;
      case 'XOR':
        return a !== b ? 1 : 0;
      case 'NAND':
        return a === 1 && b === 1 ? 0 : 1;
    }
  };

  const midOut = evalGate(gate1, inA, inB);
  const finalOut: 0 | 1 = invertOut ? (midOut === 1 ? 0 : 1) : midOut;

  useEffect(() => {
    onStateChange?.({ tab, inA, inB, gate1, invertOut, finalOut, traceIdx });
  }, [tab, inA, inB, gate1, invertOut, finalOut, traceIdx, onStateChange]);

  const handleCheck = () => {
    if (tab === 'gates') {
      const targetOut = config.targetGateOutput ?? 1;
      if (finalOut === targetOut) {
        setIsDone(true);
        setFeedback(`✅ Логічна схема працює! На виході сигнал ${finalOut} (${gate1}(${inA}, ${inB})${invertOut ? ' → NOT' : ''}).`);
        onSubmitAnswer?.(finalOut);
      } else {
        setIsDone(false);
        setFeedback(`⚡ Зараз вихід = ${finalOut}. Налаштуйте входи A/B або логічний вентиль для отримання ${targetOut}.`);
      }
    } else {
      const val = Number(guessedFinalSum);
      if (val === 12) {
        setIsDone(true);
        setFeedback('✅ Трасування підтверджено! 2 + 4 + 6 = 12.');
        onSubmitAnswer?.(12);
      } else {
        setIsDone(false);
        setFeedback('💻 Пройдіть усі кроки циклу кнопкою «Крок вперед» і подивіться фінальне значення змінної sum.');
      }
    }
  };

  const activeTrace = TRACE_STEPS[traceIdx] || TRACE_STEPS[0];

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          '💻 Дослідіть цифрові логічні вентилі (AND / OR / XOR / NOT) та покроково протрасуйте змінні циклу.'}
      </div>

      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant={tab === 'gates' ? 'primary' : 'outline'} onClick={() => setTab('gates')}>
          🔌 Логічні вентилі
        </Button>
        <Button type="button" size="sm" variant={tab === 'tracer' ? 'primary' : 'outline'} onClick={() => setTab('tracer')}>
          🪜 Трасувальник коду
        </Button>
      </div>

      {tab === 'gates' ? (
        <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div className="space-y-2">
              <Button
                type="button"
                size="sm"
                variant={inA === 1 ? 'accent' : 'outline'}
                className="w-full font-mono"
                disabled={isReadOnly}
                onClick={() => setInA((v) => (v === 1 ? 0 : 1))}
              >
                Вхід A = {inA}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={inB === 1 ? 'accent' : 'outline'}
                className="w-full font-mono"
                disabled={isReadOnly}
                onClick={() => setInB((v) => (v === 1 ? 0 : 1))}
              >
                Вхід B = {inB}
              </Button>
            </div>

            <div className="space-y-2 text-center">
              <div className="text-[11px] font-bold text-[var(--text-muted)]">Оберіть вентиль:</div>
              <div className="grid grid-cols-2 gap-1">
                {(['AND', 'OR', 'XOR', 'NAND'] as GateKind[]).map((g) => (
                  <Button
                    key={g}
                    type="button"
                    size="sm"
                    variant={gate1 === g ? 'primary' : 'outline'}
                    disabled={isReadOnly}
                    onClick={() => setGate1(g)}
                    className="font-mono text-xs"
                  >
                    {g}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant={invertOut ? 'accent' : 'outline'}
                disabled={isReadOnly}
                onClick={() => setInvertOut((v) => !v)}
                className="w-full font-mono text-xs"
              >
                {invertOut ? 'NOT (інвертор УВІМК)' : 'Без NOT'}
              </Button>
            </div>

            <div
              className="p-4 rounded-[var(--radius-md)] border-2 text-center"
              style={{
                borderColor: finalOut === 1 ? 'var(--ok-border)' : 'var(--border)',
                backgroundColor: finalOut === 1 ? 'var(--ok-bg)' : 'var(--surface-alt)',
                color: finalOut === 1 ? 'var(--ok-text)' : 'var(--text-muted)',
              }}
            >
              <div className="text-[11px] font-bold uppercase">Вихід Q</div>
              <div className="text-3xl font-black font-mono">{finalOut}</div>
              <div className="text-[10px] font-bold">{finalOut === 1 ? 'HIGH (1)' : 'LOW (0)'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="space-y-1 font-mono text-xs">
            {TRACE_STEPS.map((st, idx) => (
              <div
                key={st.line}
                className="px-2 py-1 rounded border"
                style={{
                  borderColor: idx === traceIdx ? 'var(--accent)' : 'transparent',
                  backgroundColor: idx === traceIdx ? 'var(--hl-bg)' : 'var(--surface-alt)',
                  color: idx === traceIdx ? 'var(--hl-text)' : 'var(--text)',
                }}
              >
                <span className="opacity-60 mr-2">{st.line}.</span>
                <span>{st.code}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] space-y-1">
              <div className="text-[11px] font-extrabold text-[var(--primary-dark)] uppercase">Стек змінних на кроці {traceIdx + 1}</div>
              <div className="font-mono text-xs">sum = <strong>{activeTrace.vars.sum}</strong></div>
              <div className="font-mono text-xs">i = <strong>{String(activeTrace.vars.i)}</strong></div>
            </div>

            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={traceIdx <= 0}
                onClick={() => setTraceIdx((i) => Math.max(0, i - 1))}
              >
                ◀ Крок назад
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={traceIdx >= TRACE_STEPS.length - 1}
                onClick={() => setTraceIdx((i) => Math.min(TRACE_STEPS.length - 1, i + 1))}
              >
                Крок вперед ▶
              </Button>
            </div>

            <label className="block space-y-1 text-xs font-bold">
              <span>Фінальне значення sum:</span>
              <input
                type="number"
                disabled={isReadOnly}
                value={guessedFinalSum}
                onChange={(e) => setGuessedFinalSum(e.target.value)}
                placeholder="Введіть число..."
                className="w-full p-2 rounded border border-[var(--border)] bg-[var(--surface-alt)] font-mono text-sm font-black"
              />
            </label>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Перевірити {tab === 'gates' ? 'схему' : 'трасування'}
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
