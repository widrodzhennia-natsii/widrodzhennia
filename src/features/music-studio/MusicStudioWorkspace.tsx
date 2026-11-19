// Повна реалізація: Вільна музична майстерня (Piano Roll + Rhythm Lane + Клавіатура + YAML-експорт)
// Детальний план: fix_tech_patch/future_plans/MUSIC_STUDIO_FUTURE_PLAN.md

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import {
  INSTRUMENT_REGISTRY,
  MusicScaleId,
  NoteDurationId,
  PlannedInstrumentTimbreId,
  RhythmBeatType,
  TimeSignatureId,
  findNoteDef,
  getScaleNotes,
} from '../../core/audio/musicTheory';
import { musicalSynth } from '../../core/audio/musical-synth';
import { useMusicStudioStore } from './useMusicStudioStore';
import type { MusicStudioComposition, MusicStudioStep } from './musicStudio.types';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';

interface MusicStudioWorkspaceProps {
  onClose?: () => void;
}

const STEP_COUNTS = [4, 8, 12, 16];
const METERS: TimeSignatureId[] = ['2/4', '3/4', '4/4', '6/8'];
const RHYTHM_OPTIONS: Array<{ id: RhythmBeatType; symbol: string; title: string }> = [
  { id: 'strong', symbol: '>♩', title: 'Сильна доля' },
  { id: 'weak', symbol: '♩', title: 'Легка доля' },
  { id: 'sub', symbol: '♪', title: 'Восьма доля' },
  { id: 'rest', symbol: '𝄽', title: 'Пауза' },
];

export const MusicStudioWorkspace: React.FC<MusicStudioWorkspaceProps> = ({ onClose }) => {
  const {
    compositions,
    activeCompositionId,
    setActiveCompositionId,
    saveComposition,
    deleteComposition,
  } = useMusicStudioStore();
  const { notify } = useFeedbackStore();

  const activeComp = useMemo(
    () => compositions.find((c) => c.id === activeCompositionId) || compositions[0],
    [compositions, activeCompositionId]
  );

  const [title, setTitle] = useState(activeComp?.title || 'Нова мелодія');
  const [scale, setScale] = useState<MusicScaleId>(activeComp?.scale || 'pentatonic');
  const [timbre, setTimbre] = useState<PlannedInstrumentTimbreId>(activeComp?.timbre || 'piano');
  const [timeSignature, setTimeSignature] = useState<TimeSignatureId>(activeComp?.timeSignature || '4/4');
  const [tempoBpm, setTempoBpm] = useState<number>(activeComp?.tempoBpm || 96);
  const [steps, setSteps] = useState<MusicStudioStep[]>(activeComp?.steps || []);
  const [isLoop, setIsLoop] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordCursor, setRecordCursor] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playStepIdx, setPlayStepIdx] = useState<number>(-1);
  const [yamlPreview, setYamlPreview] = useState<string>('');

  const rafRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Sync local editor when user switches saved composition
  useEffect(() => {
    if (!activeComp) return;
    setTitle(activeComp.title);
    setScale(activeComp.scale);
    setTimbre(activeComp.timbre);
    setTimeSignature(activeComp.timeSignature);
    setTempoBpm(activeComp.tempoBpm);
    setSteps(activeComp.steps);
    setYamlPreview('');
  }, [activeComp?.id]);

  const scaleNotes = useMemo(() => getScaleNotes(scale), [scale]);

  // Warmup AudioBuffers cleanly when scale or instrument changes
  useEffect(() => {
    musicalSynth.warmupScale(
      scaleNotes.map((n) => n.freq),
      0.7,
      timbre
    );
  }, [scaleNotes, timbre]);

  const stopPlayback = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setPlayStepIdx(-1);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    musicalSynth.stopGroup('sequence');
    musicalSynth.stopGroup('percussion');
  };

  useEffect(() => stopPlayback, []);

  // Lookahead AudioContext playback loop
  const startPlayback = () => {
    if (steps.length === 0) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    const stepDurSec = 60 / Math.max(50, Math.min(180, tempoBpm));
    let nextIdx = 0;
    let nextTime = (musicalSynth.getAudioTime() ?? 0) + 0.05;

    const tick = () => {
      if (!isPlayingRef.current) return;
      const now = musicalSynth.getAudioTime() ?? 0;

      while (nextTime < now + 0.14) {
        if (nextIdx >= steps.length) {
          if (isLoop) {
            nextIdx = 0;
          } else {
            stopPlayback();
            return;
          }
        }

        const currentStep = steps[nextIdx];
        const scheduledIdx = nextIdx;
        if (currentStep) {
          currentStep.notes.forEach((nId) => {
            const def = findNoteDef(nId);
            if (def) {
              musicalSynth.scheduleSequenceNote(def.freq, 0, Math.max(0.4, stepDurSec * 0.95), {
                absoluteAudioTime: nextTime,
                timbre,
                gainScale: currentStep.notes.length > 1 ? 0.65 : 0.88,
              });
            }
          });
          if (currentStep.rhythmBeat && currentStep.rhythmBeat !== 'rest') {
            musicalSynth.schedulePercussion(currentStep.rhythmBeat, 0, {
              absoluteAudioTime: nextTime,
              gainScale: 0.72,
            });
          }
        }

        setPlayStepIdx(scheduledIdx);
        nextTime += stepDurSec;
        nextIdx += 1;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  // Keyboard live step recording
  useEffect(() => {
    if (!isRecording) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const keyChar = e.key.toUpperCase();
      const matchedNote = scaleNotes.find((n) => n.keyHint?.toUpperCase() === keyChar);
      if (!matchedNote) return;

      e.preventDefault();
      musicalSynth.playAuditionNote(matchedNote.freq, 0.72, timbre);
      setSteps((prev) => {
        if (prev.length === 0) return prev;
        const idx = recordCursor % prev.length;
        return prev.map((st, i) => (i === idx ? { ...st, notes: [matchedNote.id] } : st));
      });
      setRecordCursor((c) => (steps.length > 0 ? (c + 1) % steps.length : 0));
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRecording, scaleNotes, timbre, recordCursor, steps.length]);

  const toggleNoteInStep = (stepIdx: number, noteId: string) => {
    const def = findNoteDef(noteId);
    if (def) {
      musicalSynth.playAuditionNote(def.freq, 0.68, timbre);
    }
    setSteps((prev) =>
      prev.map((st, i) => {
        if (i !== stepIdx) return st;
        const exists = st.notes.includes(noteId);
        const nextNotes = exists ? st.notes.filter((n) => n !== noteId) : [...st.notes, noteId];
        return { ...st, notes: nextNotes };
      })
    );
  };

  const cycleRhythmBeat = (stepIdx: number) => {
    setSteps((prev) =>
      prev.map((st, i) => {
        if (i !== stepIdx) return st;
        const curOrder: RhythmBeatType[] = ['strong', 'weak', 'sub', 'rest'];
        const curIdx = curOrder.indexOf(st.rhythmBeat || 'weak');
        const nextBeat = curOrder[(curIdx + 1) % curOrder.length];
        if (nextBeat !== 'rest') {
          musicalSynth.schedulePercussion(nextBeat, 0);
        }
        return { ...st, rhythmBeat: nextBeat };
      })
    );
  };

  const handleStepCountChange = (count: number) => {
    stopPlayback();
    setSteps((prev) => {
      if (prev.length === count) return prev;
      if (prev.length > count) return prev.slice(0, count);
      const padded = [...prev];
      while (padded.length < count) {
        padded.push({
          id: `st_${padded.length + 1}_${Date.now().toString(36)}`,
          notes: [],
          duration: 'quarter' as NoteDurationId,
          rhythmBeat: padded.length % 4 === 0 ? 'strong' : 'weak',
        });
      }
      return padded;
    });
  };

  const buildCurrentComposition = (asCopy = false): MusicStudioComposition => {
    const now = Date.now();
    return {
      id: asCopy ? `comp_${now}` : activeComp?.id || `comp_${now}`,
      title: asCopy ? `${title.trim() || 'Мелодія'} (копія)` : title.trim() || 'Мелодія',
      gradeBand: '5-7',
      scale,
      timbre,
      timeSignature,
      tempoBpm,
      steps,
      createdAt: asCopy ? now : activeComp?.createdAt || now,
      updatedAt: now,
    };
  };

  const handleSave = (asCopy = false) => {
    const comp = buildCurrentComposition(asCopy);
    saveComposition(comp);
    notify(asCopy ? `Створено копію «${comp.title}»!` : `Мелодію «${comp.title}» збережено.`, 'success');
  };

  const handleExportYaml = () => {
    const yamlLines = [
      `id: "music_${Date.now()}"`,
      `title: "${title.replace(/"/g, '')}"`,
      `engineId: "music-sequencer-ear"`,
      `engineConfig:`,
      `  scale: "${scale}"`,
      `  timbre: "${timbre}"`,
      `  timeSignature: "${timeSignature}"`,
      `  tempoBpm: ${tempoBpm}`,
      `  targetSteps:`,
      ...steps.map((st, idx) => {
        const noteStr = st.notes.length > 0 ? st.notes[0] : 'Пауза';
        return `    - { step: ${idx + 1}, note: "${noteStr}", beat: "${st.rhythmBeat || 'weak'}" }`;
      }),
    ].join('\n');
    setYamlPreview(yamlLines);
    try {
      navigator.clipboard?.writeText(yamlLines);
      notify('Конфігурацію YAML сформовано та скопійовано!', 'success');
    } catch {
      notify('YAML сформовано нижче для копіювання.', 'info');
    }
  };

  return (
    <div className="p-4 sm:p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-card space-y-4 text-[var(--text)]">
      {/* Header & Composition Picker */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
        <div className="space-y-0.5">
          <h3 className="text-base sm:text-lg font-extrabold text-[var(--primary-dark)]">
            🎼 Вільна музична майстерня
          </h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            Поліфонічний конструктор мелодій (7 активних тембрів), ритмічна доріжка й запис із клавіатури без скидання уроку.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button type="button" variant="primary" size="sm" onClick={() => handleSave(false)}>
            💾 Зберегти
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleSave(true)}>
            📑 Нова копія
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExportYaml}>
            📤 YAML для вчителя
          </Button>
          {onClose && (
            <Button type="button" variant="outline" size="sm" onClick={() => { stopPlayback(); onClose(); }}>
              ✕ Закрити
            </Button>
          )}
        </div>
      </div>

      {/* Saved Compositions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold text-[var(--text-muted)] mr-1">Збережені:</span>
          {compositions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                stopPlayback();
                setActiveCompositionId(c.id);
              }}
              className={`px-2.5 py-1 rounded-[var(--radius-sm)] border text-xs font-bold cursor-pointer transition-colors ${
                c.id === activeComp?.id
                  ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>

        {compositions.length > 1 && activeComp && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => deleteComposition(activeComp.id)}
          >
            🗑️ Видалити поточну
          </Button>
        )}
      </div>

      {/* Studio Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
        <label className="space-y-1 font-bold">
          <span className="text-[11px] text-[var(--text-muted)]">Назва композиції</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field py-1.5 text-xs w-full"
          />
        </label>

        <label className="space-y-1 font-bold">
          <span className="text-[11px] text-[var(--text-muted)]">Інструмент (усі 7 тембрів)</span>
          <select
            value={timbre}
            onChange={(e) => setTimbre(e.target.value as PlannedInstrumentTimbreId)}
            className="input-field py-1.5 text-xs w-full"
          >
            {INSTRUMENT_REGISTRY.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.uaName} ({inst.intlName})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 font-bold">
          <span className="text-[11px] text-[var(--text-muted)]">Лад (Гама)</span>
          <select
            value={scale}
            onChange={(e) => setScale(e.target.value as MusicScaleId)}
            className="input-field py-1.5 text-xs w-full"
          >
            <option value="pentatonic">Пентатоніка (5 нот)</option>
            <option value="major">Мажор (7 нот)</option>
            <option value="minor">Мінор (натуральний)</option>
          </select>
        </label>

        <div className="space-y-1 font-bold">
          <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
            <span>Темп (BPM)</span>
            <span className="font-mono tabular-nums text-[var(--primary-dark)]">{tempoBpm} BPM</span>
          </div>
          <input
            type="range"
            min={50}
            max={180}
            step={2}
            value={tempoBpm}
            onChange={(e) => setTempoBpm(Number(e.target.value))}
            className="settings-range"
          />
        </div>
      </div>

      {/* Playback, Recording, Meter, Step Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="primary" size="sm" onClick={startPlayback}>
            {isPlaying ? '⏹️ Стоп' : '▶ Слухати'}
          </Button>
          <Button
            type="button"
            variant={isLoop ? 'accent' : 'outline'}
            size="sm"
            onClick={() => setIsLoop((l) => !l)}
          >
            🔁 Цикл: {isLoop ? 'Увімк' : 'Вимк'}
          </Button>
          <Button
            type="button"
            variant={isRecording ? 'accent' : 'outline'}
            size="sm"
            onClick={() => setIsRecording((r) => !r)}
          >
            {isRecording ? `⏺ Запис (крок ${recordCursor + 1}) — тисніть клавіші` : '🎙️ Запис із клавіатури'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)]">Розмір:</span>
            {METERS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTimeSignature(m)}
                className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold cursor-pointer ${
                  timeSignature === m
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--primary-dark)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)]">Кроків:</span>
            {STEP_COUNTS.map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => handleStepCountChange(cnt)}
                className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold cursor-pointer tabular-nums ${
                  steps.length === cnt
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--primary-dark)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Piano Roll + Rhythm Lane */}
      <div className="overflow-x-auto border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--surface-alt)] border-b border-[var(--border)]">
              <th className="p-2 text-left font-extrabold text-[var(--primary-dark)] min-w-[96px] sticky left-0 bg-[var(--surface-alt)] border-r border-[var(--border)]">
                Нота / Клавіша
              </th>
              {steps.map((st, idx) => (
                <th
                  key={st.id}
                  className={`p-1.5 text-center font-mono tabular-nums min-w-[44px] ${
                    playStepIdx === idx
                      ? 'bg-[var(--hl-bg)] text-[var(--hl-text)] font-extrabold'
                      : isRecording && recordCursor === idx
                      ? 'bg-[var(--ok-bg)] text-[var(--ok-text)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {idx + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...scaleNotes].reverse().map((note) => (
              <tr key={note.id} className="border-b border-[var(--border)]">
                <td className="px-2 py-1.5 font-bold whitespace-nowrap sticky left-0 bg-[var(--surface)] border-r border-[var(--border)] flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => musicalSynth.playAuditionNote(note.freq, 0.72, timbre)}
                    className="text-left hover:text-[var(--primary-dark)] cursor-pointer"
                    title="Прослухати ноту"
                  >
                    {note.dualLabel}
                  </button>
                  {note.keyHint && (
                    <span className="font-mono text-[10px] px-1 rounded bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)]">
                      {note.keyHint}
                    </span>
                  )}
                </td>
                {steps.map((st, idx) => {
                  const active = st.notes.includes(note.id);
                  const isPlayCol = playStepIdx === idx;
                  return (
                    <td
                      key={`${note.id}_${st.id}`}
                      className={`p-1 text-center ${isPlayCol ? 'bg-[var(--hl-bg)]' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleNoteInStep(idx, note.id)}
                        className={`w-8 h-7 rounded-[var(--radius-sm)] border text-[11px] font-extrabold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[var(--accent)] border-[var(--primary-dark)] text-[var(--accent-text)]'
                            : 'bg-[var(--bg)] border-[var(--border)] text-transparent hover:border-[var(--accent)]'
                        }`}
                        aria-label={`Крок ${idx + 1}, нота ${note.dualLabel}`}
                      >
                        {active ? '●' : '·'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Rhythm Percussion Lane */}
            <tr className="bg-[var(--surface-alt)]">
              <td className="px-2 py-2 font-extrabold text-[var(--primary-dark)] whitespace-nowrap sticky left-0 bg-[var(--surface-alt)] border-r border-[var(--border)]">
                🥁 Ритм (доля)
              </td>
              {steps.map((st, idx) => {
                const beatMeta =
                  RHYTHM_OPTIONS.find((o) => o.id === (st.rhythmBeat || 'weak')) || RHYTHM_OPTIONS[1];
                return (
                  <td key={`beat_${st.id}`} className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => cycleRhythmBeat(idx)}
                      title={`${beatMeta.title} (натисніть для зміни)`}
                      className="w-8 h-7 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[11px] font-mono font-bold hover:border-[var(--accent)] cursor-pointer"
                    >
                      {beatMeta.symbol}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {yamlPreview && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-extrabold text-[var(--primary-dark)]">
            Експортована YAML-конфігурація для уроку:
          </div>
          <pre className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-[11px] font-mono overflow-x-auto text-[var(--text)]">
            {yamlPreview}
          </pre>
        </div>
      )}
    </div>
  );
};
