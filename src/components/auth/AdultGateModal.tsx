import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuthorGateStore } from '../../core/state/useAuthorGateStore';

interface MathChallenge {
  prompt: string;
  answer: number;
}

const generateAdultMathChallenge = (): MathChallenge => {
  const variant = Math.floor(Math.random() * 3);
  if (variant === 0) {
    const a = 12 + Math.floor(Math.random() * 7); // 12..18
    const b = 6 + Math.floor(Math.random() * 4);  // 6..9
    const c = 11 + Math.floor(Math.random() * 14);
    return { prompt: `${a} × ${b} − ${c}`, answer: a * b - c };
  }
  if (variant === 1) {
    const b = 4 + Math.floor(Math.random() * 5); // 4..8
    const q = 14 + Math.floor(Math.random() * 11);
    const a = b * q;
    const c = 15 + Math.floor(Math.random() * 15);
    return { prompt: `${a} ÷ ${b} + ${c}`, answer: q + c };
  }
  const base = 7 + Math.floor(Math.random() * 5); // 7..11
  const sub = 12 + Math.floor(Math.random() * 18);
  return { prompt: `${base}² − ${sub}`, answer: base * base - sub };
};

export const AdultGateModal: React.FC = () => {
  const {
    isGateModalOpen,
    gateMode,
    pinCode,
    closeGateModal,
    unlockAuthorSession,
  } = useAuthorGateStore();

  const [challenge, setChallenge] = useState<MathChallenge>(() => generateAdultMathChallenge());
  const [inputValue, setInputValue] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (isGateModalOpen) {
      setChallenge(generateAdultMathChallenge());
      setInputValue('');
      setErrorText(null);
    }
  }, [isGateModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputValue.trim();

    if (gateMode === 'pin') {
      if (cleaned === pinCode) {
        unlockAuthorSession();
      } else {
        setErrorText('Невірний PIN-код дорослого. Перевірте 4 цифри та спробуйте ще раз.');
      }
      return;
    }

    const numeric = Number(cleaned.replace(',', '.'));
    if (Number.isFinite(numeric) && Math.abs(numeric - challenge.answer) < 0.001) {
      unlockAuthorSession();
    } else {
      setErrorText('Відповідь не збігається. Обчисліть уважно або оновіть приклад.');
    }
  };

  return (
    <Modal
      isOpen={isGateModalOpen}
      onClose={closeGateModal}
      title="Перевірка доступу (Режим вчителя / батьків)"
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 bg-[var(--hl-bg)] border border-[var(--hl-border)] rounded-[var(--radius-sm)] text-xs text-[var(--hl-text)] leading-relaxed">
          🔐 <strong>Студія автора та керування курсами</strong> захищені від випадкових змін чи видалення уроків дитиною.
        </div>

        {gateMode === 'math' ? (
          <div className="p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2.5 text-center">
            <span className="text-xs font-bold text-[var(--text-muted)] block">
              Розв&apos;яжіть вираз, щоб увійти в режим автора:
            </span>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-[var(--primary-dark)]">
              {challenge.prompt} = ?
            </div>
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setChallenge(generateAdultMathChallenge());
                  setInputValue('');
                  setErrorText(null);
                }}
              >
                ↻ Інший приклад
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-1 text-center">
            <span className="text-xs font-bold text-[var(--text-muted)] block">
              Введіть встановлений 4-значний PIN-код дорослого:
            </span>
          </div>
        )}

        <div>
          <input
            type={gateMode === 'pin' ? 'password' : 'text'}
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setErrorText(null);
            }}
            placeholder={gateMode === 'pin' ? '4 цифри PIN...' : 'Введіть число...'}
            className="input-field w-full text-center font-mono tabular-nums text-base"
            autoFocus
            required
          />
        </div>

        {errorText && (
          <div className="status-panel status-panel--warning text-xs">{errorText}</div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={closeGateModal} className="flex-1">
            Скасувати
          </Button>
          <Button type="submit" variant="primary" size="sm" className="flex-1">
            Увійти в Студію автора
          </Button>
        </div>
      </form>
    </Modal>
  );
};
