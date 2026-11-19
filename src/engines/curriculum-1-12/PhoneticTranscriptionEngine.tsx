import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface PhoneticTranscriptionConfig {
  word?: string;
  targetSyllables?: string; // e.g. 'укра-ї-на' or 'міс-то'
  targetStressedIndex?: number; // 0-based char index in clean word
  targetTranscription?: string; // e.g. '[м і с т о]'
  phonemeBank?: string[];
  instruction?: string;
}

const DEFAULT_PHONEME_BANK = [
  'м', "м'", 'і', 'с', 'т', 'о', 'а', 'у', 'к', 'р', 'й', 'н', 'л', "л'", 'ь', 'д', 'ж', 'ч',
];

export const PhoneticTranscriptionEngine: React.FC<EngineProps<PhoneticTranscriptionConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const word = config.word || 'місто';
  const letters = word.split('');
  const bank = config.phonemeBank && config.phonemeBank.length > 0 ? config.phonemeBank : DEFAULT_PHONEME_BANK;

  // breaks[i] = true means a syllable break after letter i
  const [breaks, setBreaks] = useState<boolean[]>(() => Array(Math.max(0, letters.length - 1)).fill(false));
  const [stressedIdx, setStressedIdx] = useState<number | null>(null);
  const [transcriptionChips, setTranscriptionChips] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setBreaks(Array(Math.max(0, word.length - 1)).fill(false));
    setStressedIdx(null);
    setTranscriptionChips([]);
    setFeedback(null);
    setIsDone(false);
  }, [word]);

  const syllabified = letters
    .map((ch, idx) => (idx < breaks.length && breaks[idx] ? `${ch}-` : ch))
    .join('')
    .toLowerCase();

  const transcriptionText = `[${transcriptionChips.join('')}]`;

  useEffect(() => {
    onStateChange?.({ syllabified, stressedIdx, transcriptionText });
  }, [syllabified, stressedIdx, transcriptionText, onStateChange]);

  const toggleBreak = (idx: number) => {
    if (isReadOnly) return;
    setBreaks((prev) => prev.map((v, i) => (i === idx ? !v : v)));
    setFeedback(null);
  };

  const addChip = (chip: string) => {
    if (isReadOnly) return;
    setTranscriptionChips((prev) => [...prev, chip]);
    setFeedback(null);
  };

  const handleCheck = () => {
    const targetSyl = (config.targetSyllables || 'міс-то').toLowerCase();
    const targetStress = config.targetStressedIndex ?? 1;
    const targetTr = (config.targetTranscription || '[місто]').replace(/\s+/g, '').toLowerCase();
    const actualTr = transcriptionText.replace(/\s+/g, '').toLowerCase();

    const sylOk = syllabified === targetSyl;
    const stressOk = stressedIdx === targetStress;
    const trOk = actualTr === targetTr;

    if (sylOk && stressOk && trOk) {
      setIsDone(true);
      setFeedback(`✅ Бездоганний фонетичний розбір: ${syllabified}, наголос на «${letters[targetStress]}», ${transcriptionText}!`);
      onSubmitAnswer?.({ syllabified, stressedIdx, transcriptionText });
    } else {
      setIsDone(false);
      const issues: string[] = [];
      if (!sylOk) issues.push(`поділ на склади (${targetSyl})`);
      if (!stressOk) issues.push('позиція наголосу (натисніть на наголошену голосну)');
      if (!trOk) issues.push(`транскрипція (очікується ${targetTr})`);
      setFeedback(`📖 Перевірте: ${issues.join('; ')}.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🔤 Виконайте фонетичний розбір слова «${word}»: розставте складоподіли (|), позначте наголошену літеру (́) та зберіть транскрипцію у [...].`}
      </div>

      {/* Syllable & Stress selector */}
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2">
        <div className="text-[11px] font-extrabold text-[var(--primary-dark)] uppercase">
          1. Складоподіл і наголос (натисніть літеру для наголосу або «|» між літерами)
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1 py-2">
          {letters.map((ch, idx) => (
            <React.Fragment key={`${ch}_${idx}`}>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => {
                  setStressedIdx(idx);
                  setFeedback(null);
                }}
                className="w-10 h-11 rounded-[var(--radius-sm)] border-2 text-lg font-black cursor-pointer transition-colors relative"
                style={{
                  borderColor: stressedIdx === idx ? 'var(--accent)' : 'var(--border)',
                  backgroundColor: stressedIdx === idx ? 'var(--hl-bg)' : 'var(--surface-alt)',
                  color: stressedIdx === idx ? 'var(--hl-text)' : 'var(--text)',
                }}
              >
                {ch}
                {stressedIdx === idx && (
                  <span className="absolute -top-2 right-1 text-xs font-black text-[var(--accent)]">́</span>
                )}
              </button>

              {idx < breaks.length && (
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => toggleBreak(idx)}
                  title="Розділити склад"
                  className="w-6 h-11 rounded border text-xs font-black cursor-pointer"
                  style={{
                    borderColor: breaks[idx] ? 'var(--accent)' : 'var(--border)',
                    backgroundColor: breaks[idx] ? 'var(--accent)' : 'transparent',
                    color: breaks[idx] ? 'var(--accent-text)' : 'var(--text-muted)',
                  }}
                >
                  {breaks[idx] ? '-' : '·'}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="text-center text-xs font-mono font-bold text-[var(--text-muted)]">
          Склади: <strong className="text-[var(--text)]">{syllabified}</strong>
        </div>
      </div>

      {/* Phonetic transcription builder */}
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-[var(--primary-dark)] uppercase">
            2. Звукова транскрипція
          </span>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isReadOnly || transcriptionChips.length === 0}
              onClick={() => setTranscriptionChips((prev) => prev.slice(0, -1))}
            >
              ⌫
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isReadOnly || transcriptionChips.length === 0}
              onClick={() => setTranscriptionChips([])}
            >
              Очистити
            </Button>
          </div>
        </div>

        <div className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] font-mono text-base font-black text-center text-[var(--primary-dark)] min-h-[2.75rem]">
          {transcriptionText}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {bank.map((ph) => (
            <Button
              key={ph}
              type="button"
              size="sm"
              variant="outline"
              disabled={isReadOnly}
              onClick={() => addChip(ph)}
              className="font-mono text-xs min-w-[2.25rem]"
            >
              {ph}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
          ✓ Перевірити фонетичний розбір
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
