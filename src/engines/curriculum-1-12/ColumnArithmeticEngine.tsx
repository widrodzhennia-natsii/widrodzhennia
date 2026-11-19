import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface ColumnArithmeticConfig {
  a?: number;
  b?: number;
  operator?: '+' | '-';
  instruction?: string;
}

export const ColumnArithmeticEngine: React.FC<EngineProps<ColumnArithmeticConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const op = config.operator ?? '+';
  const rawA = Math.max(10, Math.min(9999, Math.abs(Math.round(config.a ?? 478))));
  const rawB = Math.max(1, Math.min(9999, Math.abs(Math.round(config.b ?? 365))));
  const a = op === '-' && rawB > rawA ? rawB : rawA;
  const b = op === '-' && rawB > rawA ? rawA : rawB;

  const expected = op === '+' ? a + b : a - b;
  const cols = Math.max(String(a).length, String(b).length, String(expected).length);

  const padDigits = (num: number) => String(num).padStart(cols, '0').split('');
  const aDigits = String(a).padStart(cols, ' ').split('');
  const bDigits = String(b).padStart(cols, ' ').split('');

  const [carries, setCarries] = useState<boolean[]>(() => Array(cols).fill(false));
  const [answerDigits, setAnswerDigits] = useState<string[]>(() => Array(cols).fill(''));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    setCarries(Array(cols).fill(false));
    setAnswerDigits(Array(cols).fill(''));
    setFeedback(null);
    setIsCorrect(false);
  }, [a, b, op, cols]);

  const studentNumber = Number(answerDigits.map((d) => (d === '' ? '0' : d)).join(''));

  useEffect(() => {
    onStateChange?.({ a, b, op, studentNumber, carries });
  }, [a, b, op, studentNumber, carries, onStateChange]);

  const toggleCarry = (idx: number) => {
    if (isReadOnly) return;
    setCarries((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const setDigit = (idx: number, raw: string) => {
    if (isReadOnly) return;
    const clean = raw.replace(/\D/g, '').slice(-1);
    setAnswerDigits((prev) => prev.map((d, i) => (i === idx ? clean : d)));
    setFeedback(null);
    setIsCorrect(false);
  };

  const handleCheck = () => {
    const filled = answerDigits.some((d) => d !== '');
    if (!filled) {
      setFeedback('✏️ Заповніть цифри відповіді справа наліво (від одиниць до старших розрядів).');
      return;
    }
    if (studentNumber === expected) {
      setIsCorrect(true);
      setFeedback(`✅ Правильно! ${a} ${op} ${b} = ${expected}.`);
      onSubmitAnswer?.(expected);
    } else {
      setIsCorrect(false);
      const expectedStr = padDigits(expected).join('');
      const userStr = answerDigits.map((d) => (d === '' ? '0' : d)).join('');
      let mismatchCol = cols - 1;
      for (let i = cols - 1; i >= 0; i--) {
        if (expectedStr[i] !== userStr[i]) {
          mismatchCol = i;
          break;
        }
      }
      const rankNames = ['одиниць', 'десятків', 'сотень', 'тисяч'];
      const rankLabel = rankNames[cols - 1 - mismatchCol] || `розряду №${cols - mismatchCol}`;
      setFeedback(
        `🧮 Перевірте обчислення у розряді ${rankLabel} (не забудьте позначити ${
          op === '+' ? 'перенесення «+1»' : 'позичання «•»'
        } зверху).`
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🧮 Обчисліть у стовпчик: ${a} ${op} ${b}. Натисніть над розрядом, щоб позначити ${
            op === '+' ? 'перенесення (+1)' : 'позику (•)'
          }, і введіть цифри справа наліво.`}
      </div>

      <div className="flex justify-center">
        <div className="inline-block p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] font-mono">
          {/* Carry / Borrow row */}
          <div className="flex items-center justify-end gap-1.5 mb-1 pl-8">
            {carries.map((active, idx) => (
              <button
                key={`c_${idx}`}
                type="button"
                disabled={isReadOnly}
                onClick={() => toggleCarry(idx)}
                title={op === '+' ? 'Позначити +1' : 'Позначити позику'}
                className="w-10 h-6 rounded border text-[11px] font-black cursor-pointer transition-colors"
                style={{
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  backgroundColor: active ? 'var(--hl-bg)' : 'var(--surface-alt)',
                  color: active ? 'var(--hl-text)' : 'var(--text-muted)',
                }}
              >
                {active ? (op === '+' ? '+1' : '−1•') : '·'}
              </button>
            ))}
          </div>

          {/* First operand */}
          <div className="flex items-center justify-end gap-1.5 pl-8">
            {aDigits.map((ch, idx) => (
              <div key={`a_${idx}`} className="w-10 h-10 flex items-center justify-center text-xl font-black text-[var(--text)]">
                {ch}
              </div>
            ))}
          </div>

          {/* Operator + Second operand */}
          <div className="flex items-center justify-end gap-1.5">
            <div className="w-6 text-xl font-black text-[var(--accent)] text-center">{op}</div>
            {bDigits.map((ch, idx) => (
              <div key={`b_${idx}`} className="w-10 h-10 flex items-center justify-center text-xl font-black text-[var(--text)]">
                {ch}
              </div>
            ))}
          </div>

          <div className="border-t-2 border-[var(--text)] my-1.5" />

          {/* Result inputs */}
          <div className="flex items-center justify-end gap-1.5 pl-8">
            {answerDigits.map((val, idx) => (
              <input
                key={`ans_${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                disabled={isReadOnly}
                value={val}
                onChange={(e) => setDigit(idx, e.target.value)}
                aria-label={`Цифра розряду ${cols - idx}`}
                className="w-10 h-11 text-center text-xl font-black rounded border-2 border-[var(--border)] bg-[var(--surface-alt)] text-[var(--primary-dark)] focus:border-[var(--accent)] focus:outline-none"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Перевірити стовпчик
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
