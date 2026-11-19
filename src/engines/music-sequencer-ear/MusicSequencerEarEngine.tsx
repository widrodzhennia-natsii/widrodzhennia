import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { EngineProps } from '../adapter';
import { soundEngine } from '../../services/soundEngineService';
import { musicalSynth } from '../../core/audio/musical-synth';
import {
  ACTIVE_INSTRUMENTS,
  ActiveInstrumentTimbreId,
  DURATION_DEFAULT_BY_SUBDIVISION,
  findNoteDef,
  getScaleNotes,
  GRADE_MUSIC_PROFILES,
  GradeBandId,
  inferGradeBandFromId,
  MusicNoteDef,
  MusicScaleId,
  NOTE_DURATION_DEFS,
  NoteDurationId,
  normalizeNoteId,
  RHYTHM_BEAT_META,
  RhythmBeatType,
  SubdivisionId,
  TimeSignatureId,
} from '../../core/audio/musicTheory';
import { Button } from '../../components/ui/Button';
import { BeatNotationSvg, MiniStaffNoteSvg } from '../../components/widgets/MusicNotationSvg';
import { createDefaultMusicState, useMusicEngineStore } from '../../core/state/useMusicEngineStore';
import { useSessionStore } from '../../core/state/useSessionStore';

export type { RhythmBeatType };

export type MusicDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface MusicStepSpec {
  note?: string;
  notes?: string[];
  duration?: NoteDurationId;
}

export interface MusicSequencerConfig {
  mode?: 'ear_melody' | 'rhythm_grid';
  title?: string;
  instruction?: string;
  gradeBand?: GradeBandId;
  scale?: MusicScaleId;
  difficulty?: MusicDifficulty;
  timbre?: ActiveInstrumentTimbreId;
  timeSignature?: TimeSignatureId;
  subdivision?: SubdivisionId;
  targetNotes?: string[];
  targetSteps?: MusicStepSpec[];
  beats?: number;
  targetPattern?: RhythmBeatType[];
  tempoBpm?: number;
  noteDurationSec?: number;
  strictSequential?: boolean;
  allowTempoControl?: boolean;
  metronomeEnabled?: boolean;
  successMessage?: string;
}

const nextBeatType = (cur: RhythmBeatType, allowSub: boolean): RhythmBeatType => {
  if (cur === 'rest') return 'strong';
  if (cur === 'strong') return 'weak';
  if (cur === 'weak') return allowSub ? 'sub' : 'rest';
  return 'rest';
};

interface ScheduledStepEvent {
  slotIdx: number;
  offsetSec: number;
  durationSec: number;
  freqs: number[];
  beatKind?: RhythmBeatType;
}

export const MusicSequencerEarEngine: React.FC<EngineProps<MusicSequencerConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const selectedGradeId = useSessionStore((s) => s.selectedGradeId);
  const gradeBand: GradeBandId = config.gradeBand || inferGradeBandFromId(selectedGradeId);
  const gradeProfile = GRADE_MUSIC_PROFILES[gradeBand] || GRADE_MUSIC_PROFILES['5-7'];

  const mode = config.mode === 'rhythm_grid' ? 'rhythm_grid' : 'ear_melody';
  const scaleType: MusicScaleId =
    config.scale === 'major' || config.scale === 'minor' || config.scale === 'pentatonic'
      ? config.scale
      : gradeProfile.defaultScale;

  const difficulty: MusicDifficulty =
    config.difficulty === 'advanced'
      ? 'advanced'
      : config.difficulty === 'intermediate'
      ? 'intermediate'
      : 'beginner';

  const subdivision: SubdivisionId =
    config.subdivision === 'eighth' || config.subdivision === 'mixed'
      ? config.subdivision
      : 'quarter';

  const timeSignature: TimeSignatureId =
    config.timeSignature === '2/4' ||
    config.timeSignature === '3/4' ||
    config.timeSignature === '4/4' ||
    config.timeSignature === '6/8'
      ? config.timeSignature
      : gradeProfile.allowedMeters[0] || '4/4';

  const allowTempoControl = config.allowTempoControl !== false && gradeProfile.allowSpeedControl;
  const [speedMultiplier, setSpeedMultiplier] = useState<0.75 | 1 | 1.25>(1);
  const [timbre, setTimbre] = useState<ActiveInstrumentTimbreId>(
    config.timbre === 'marimba' ? 'marimba' : 'piano'
  );
  const [metronomeOn, setMetronomeOn] = useState<boolean>(Boolean(config.metronomeEnabled));

  useEffect(() => {
    setTimbre(config.timbre === 'marimba' ? 'marimba' : 'piano');
  }, [config.timbre]);

  const baseTempoBpm = Math.max(
    gradeProfile.minBpm,
    Math.min(gradeProfile.maxBpm, Number(config.tempoBpm || gradeProfile.defaultTempoBpm))
  );
  const effectiveTempoBpm = Math.round(baseTempoBpm * speedMultiplier);
  const beatIntervalSec = 60 / effectiveTempoBpm;

  const availableNotes = useMemo(() => getScaleNotes(scaleType), [scaleType]);

  const targetStepSpecs = useMemo<
    Array<{ noteId: string; freqs: number[]; durationId: NoteDurationId }>
  >(() => {
    const defaultDur = DURATION_DEFAULT_BY_SUBDIVISION[subdivision];
    if (Array.isArray(config.targetSteps) && config.targetSteps.length > 0) {
      return config.targetSteps.map((step) => {
        const rawList =
          Array.isArray(step.notes) && step.notes.length > 0
            ? step.notes
            : [step.note || 'До'];
        const normList = rawList.map(normalizeNoteId);
        const freqs = normList
          .map((id) => findNoteDef(id)?.freq)
          .filter((f): f is number => Number.isFinite(f));
        const durId =
          step.duration && NOTE_DURATION_DEFS[step.duration] ? step.duration : defaultDur;
        return {
          noteId: normList[0],
          freqs,
          durationId: durId,
        };
      });
    }

    const raw =
      Array.isArray(config.targetNotes) && config.targetNotes.length > 0
        ? config.targetNotes
        : ['До', 'Мі', 'Соль', 'До5'];
    return raw.map((r) => {
      const id = normalizeNoteId(r);
      const found = findNoteDef(id);
      return {
        noteId: id,
        freqs: found ? [found.freq] : [],
        durationId: defaultDur,
      };
    });
  }, [config.targetSteps, config.targetNotes, subdivision]);

  const targetNotes = useMemo(
    () => targetStepSpecs.map((s) => s.noteId),
    [targetStepSpecs]
  );

  const targetPattern = useMemo<RhythmBeatType[]>(() => {
    if (Array.isArray(config.targetPattern) && config.targetPattern.length > 0) {
      return config.targetPattern.map((b) =>
        b === 'strong' || b === 'weak' || b === 'sub' || b === 'rest' ? b : 'rest'
      );
    }
    const count = Math.max(2, Math.min(8, Number(config.beats || 4)));
    return Array.from({ length: count }, (_, idx) =>
      idx === 0 ? 'strong' : idx % 2 === 1 ? 'weak' : 'rest'
    );
  }, [config.targetPattern, config.beats]);

  const allowSubdivisionBeat = useMemo(
    () =>
      gradeProfile.allowSubdivisionBeat ||
      subdivision !== 'quarter' ||
      targetPattern.includes('sub'),
    [gradeProfile.allowSubdivisionBeat, subdivision, targetPattern]
  );

  const baseNoteDurationSec = useMemo(() => {
    const raw = Number(config.noteDurationSec);
    if (Number.isFinite(raw) && raw > 0.15) {
      return Math.max(0.22, Math.min(1.4, raw / speedMultiplier));
    }
    return Number(Math.max(0.26, Math.min(1.05, beatIntervalSec * 0.92)).toFixed(2));
  }, [config.noteDurationSec, beatIntervalSec, speedMultiplier]);

  const configSignature = useMemo(() => JSON.stringify(config ?? {}), [config]);

  const strictSequential =
    config.strictSequential !== undefined
      ? Boolean(config.strictSequential)
      : difficulty === 'advanced';

  const storeKey = `music::${mode}::${configSignature}`;
  const storedInstance = useMusicEngineStore((s) => s.instances[storeKey]);
  const ensureInstance = useMusicEngineStore((s) => s.ensureInstance);
  const setStoredSlotNotes = useMusicEngineStore((s) => s.setSlotNotes);
  const setStoredActiveSlotIdx = useMusicEngineStore((s) => s.setActiveSlotIdx);
  const setStoredBeatPattern = useMusicEngineStore((s) => s.setBeatPattern);
  const setStoredStatus = useMusicEngineStore((s) => s.setStatus);

  const fallbackState = useMemo(
    () => createDefaultMusicState(targetNotes.length, targetPattern.length),
    [targetNotes.length, targetPattern.length]
  );
  const engineState = storedInstance ?? fallbackState;
  const slotNotes =
    engineState.slotNotes.length === targetNotes.length
      ? engineState.slotNotes
      : fallbackState.slotNotes;
  const activeSlotIdx = Math.max(
    0,
    Math.min(Math.max(0, targetNotes.length - 1), engineState.activeSlotIdx)
  );
  const beatPattern =
    engineState.beatPattern.length === targetPattern.length
      ? engineState.beatPattern
      : fallbackState.beatPattern;
  const statusMsg = engineState.statusMsg;
  const isSolved = engineState.isSolved;

  const [auditioningNoteId, setAuditioningNoteId] = useState<string | null>(null);
  const [playingSlotIdx, setPlayingSlotIdx] = useState<number | null>(null);
  const [playingKind, setPlayingKind] = useState<'none' | 'reference' | 'user' | 'compare'>('none');

  const lookaheadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafHighlightRef = useRef<number | null>(null);
  const auditionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSynthSettings = useCallback(() => {
    musicalSynth.setVolume(soundEngine.getVolume());
    musicalSynth.setMuted(soundEngine.getIsMuted());
  }, []);

  const clearPlaybackTimers = useCallback(() => {
    if (lookaheadTimerRef.current) {
      clearInterval(lookaheadTimerRef.current);
      lookaheadTimerRef.current = null;
    }
    if (rafHighlightRef.current !== null) {
      cancelAnimationFrame(rafHighlightRef.current);
      rafHighlightRef.current = null;
    }
    if (auditionTimerRef.current) {
      clearTimeout(auditionTimerRef.current);
      auditionTimerRef.current = null;
    }
    musicalSynth.stopAll();
    setPlayingSlotIdx(null);
    setPlayingKind('none');
    setAuditioningNoteId(null);
  }, []);

  useEffect(() => {
    ensureInstance(storeKey, targetNotes.length, targetPattern.length);
  }, [ensureInstance, storeKey, targetNotes.length, targetPattern.length]);

  useEffect(() => {
    clearPlaybackTimers();
  }, [storeKey, clearPlaybackTimers]);

  useEffect(() => {
    return () => {
      clearPlaybackTimers();
    };
  }, [clearPlaybackTimers]);

  /**
   * Lookahead Web Audio scheduler: schedules notes & percussion ahead using
   * AudioContext.currentTime while smoothly tracking UI active slot via rAF.
   */
  const runLookaheadSchedule = useCallback(
    (events: ScheduledStepEvent[], kind: 'reference' | 'user', totalDurationSec: number) => {
      clearPlaybackTimers();
      syncSynthSettings();
      musicalSynth.warmupScale(
        availableNotes.map((n) => n.freq),
        baseNoteDurationSec,
        timbre
      );

      const audioOrigin = musicalSynth.getAudioTime();
      setPlayingKind(kind);

      if (audioOrigin === null) {
        return;
      }

      const startAudioTime = audioOrigin + 0.035;
      const startPerfMs = performance.now() + 35;
      let nextIdx = 0;

      // Optional subtle metronome ticks aligned to each quarter beat
      let nextMetronomeBeat = 0;
      const totalBeats = Math.ceil(totalDurationSec / beatIntervalSec);

      const pumpSchedule = () => {
        const nowAudio = musicalSynth.getAudioTime();
        if (nowAudio === null) return;
        const horizonAudio = nowAudio + 0.14; // 140 ms lookahead window

        while (nextIdx < events.length) {
          const ev = events[nextIdx];
          const evAudioTime = startAudioTime + ev.offsetSec;
          if (evAudioTime > horizonAudio) break;

          if (ev.beatKind && ev.beatKind !== 'rest') {
            musicalSynth.schedulePercussion(ev.beatKind, 0, {
              absoluteAudioTime: evAudioTime,
            });
          }
          if (ev.freqs.length > 0) {
            const gainScale = ev.freqs.length > 1 ? 0.72 : 0.92;
            ev.freqs.forEach((f) => {
              musicalSynth.scheduleSequenceNote(f, 0, ev.durationSec, {
                absoluteAudioTime: evAudioTime,
                timbre,
                gainScale,
              });
            });
          }
          nextIdx += 1;
        }

        if (metronomeOn) {
          while (nextMetronomeBeat < totalBeats) {
            const metTime = startAudioTime + nextMetronomeBeat * beatIntervalSec;
            if (metTime > horizonAudio) break;
            musicalSynth.schedulePercussion('sub', 0, {
              absoluteAudioTime: metTime,
              gainScale: nextMetronomeBeat % 4 === 0 ? 0.52 : 0.32,
            });
            nextMetronomeBeat += 1;
          }
        }
      };

      pumpSchedule();
      lookaheadTimerRef.current = setInterval(pumpSchedule, 25);

      const trackVisual = () => {
        const elapsedSec = (performance.now() - startPerfMs) / 1000;
        if (elapsedSec >= totalDurationSec + 0.14) {
          if (lookaheadTimerRef.current) {
            clearInterval(lookaheadTimerRef.current);
            lookaheadTimerRef.current = null;
          }
          rafHighlightRef.current = null;
          setPlayingSlotIdx(null);
          setPlayingKind('none');
          return;
        }

        let active: number | null = null;
        for (let i = events.length - 1; i >= 0; i -= 1) {
          if (elapsedSec >= events[i].offsetSec - 0.015) {
            active = events[i].slotIdx;
            break;
          }
        }
        setPlayingSlotIdx(active);
        rafHighlightRef.current = requestAnimationFrame(trackVisual);
      };

      rafHighlightRef.current = requestAnimationFrame(trackVisual);
    },
    [
      availableNotes,
      baseNoteDurationSec,
      beatIntervalSec,
      clearPlaybackTimers,
      metronomeOn,
      syncSynthSettings,
      timbre,
    ]
  );

  const playSingleNote = useCallback(
    (freq: number, durOverride?: number) => {
      syncSynthSettings();
      const targetDur = Math.max(0.55, durOverride ?? baseNoteDurationSec);
      musicalSynth.warmupScale(
        availableNotes.map((n) => n.freq),
        targetDur,
        timbre
      );
      musicalSynth.playAuditionNote(freq, targetDur, timbre);
    },
    [availableNotes, baseNoteDurationSec, syncSynthSettings, timbre]
  );

  const playPercussion = (kind: RhythmBeatType) => {
    if (kind === 'rest') return;
    syncSynthSettings();
    musicalSynth.schedulePercussion(kind, 0);
  };

  const playNoteSequence = (notes: Array<string | null>, kind: 'reference' | 'user') => {
    if (!notes.some(Boolean)) return;
    let cursorSec = 0;
    const events: ScheduledStepEvent[] = [];

    notes.forEach((nId, idx) => {
      const spec = targetStepSpecs[idx];
      const durDef = NOTE_DURATION_DEFS[spec?.durationId || 'quarter'];
      const stepDur = durDef.beats * beatIntervalSec;
      const notePlayDur = Math.max(0.24, Math.min(1.8, stepDur * 0.94));

      let freqs: number[] = [];
      if (kind === 'reference' && spec && spec.freqs.length > 0 && nId === spec.noteId) {
        freqs = spec.freqs;
      } else if (nId) {
        const found = findNoteDef(nId);
        if (found) freqs = [found.freq];
      }

      events.push({
        slotIdx: idx,
        offsetSec: cursorSec,
        durationSec: notePlayDur,
        freqs,
      });
      cursorSec += stepDur;
    });

    runLookaheadSchedule(events, kind, cursorSec);
  };

  const playRhythmSequence = (pattern: RhythmBeatType[], kind: 'reference' | 'user') => {
    let cursorSec = 0;
    const events: ScheduledStepEvent[] = pattern.map((beat, idx) => {
      const meta = RHYTHM_BEAT_META[beat];
      const stepSec = meta.beats * beatIntervalSec;
      const ev: ScheduledStepEvent = {
        slotIdx: idx,
        offsetSec: cursorSec,
        durationSec: stepSec,
        freqs: [],
        beatKind: beat,
      };
      cursorSec += stepSec;
      return ev;
    });

    runLookaheadSchedule(events, kind, cursorSec);
  };

  const filledNotesCount = useMemo(
    () => slotNotes.filter((n): n is string => Boolean(n)).length,
    [slotNotes]
  );

  const findNextEmptyIdx = (arr: Array<string | null>, fromIdx: number): number => {
    for (let i = fromIdx + 1; i < arr.length; i += 1) {
      if (!arr[i]) return i;
    }
    for (let i = 0; i < fromIdx; i += 1) {
      if (!arr[i]) return i;
    }
    return fromIdx;
  };

  const handleAuditionNote = useCallback(
    (note: MusicNoteDef) => {
      playSingleNote(note.freq);
      setAuditioningNoteId(note.id);
      if (auditionTimerRef.current) clearTimeout(auditionTimerRef.current);
      auditionTimerRef.current = setTimeout(() => {
        setAuditioningNoteId(null);
      }, 280);
    },
    [playSingleNote]
  );

  // Real-time keyboard playing (A S D F G H J K) for rapid natural auditioning
  useEffect(() => {
    if (mode !== 'ear_melody') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const key = e.key.toUpperCase();
      const matched = availableNotes.find((n) => n.keyHint === key);
      if (matched) {
        handleAuditionNote(matched);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [availableNotes, handleAuditionNote, mode]);

  const handleAuditionReferenceSlot = (idx: number) => {
    if (difficulty !== 'beginner') return;
    const spec = targetStepSpecs[idx];
    if (!spec || spec.freqs.length === 0) return;

    const durDef = NOTE_DURATION_DEFS[spec.durationId];
    const playDur = Math.max(0.28, durDef.beats * beatIntervalSec * 0.94);

    if (!strictSequential) {
      setActiveSlotIdx(idx);
    }

    runLookaheadSchedule(
      [
        {
          slotIdx: idx,
          offsetSec: 0,
          durationSec: playDur,
          freqs: spec.freqs,
        },
      ],
      'reference',
      playDur
    );
  };

  const handleCompareActiveSlot = () => {
    if (difficulty !== 'beginner') return;
    const idx = Math.max(0, Math.min(targetNotes.length - 1, activeSlotIdx));
    const spec = targetStepSpecs[idx];
    const userFound = slotNotes[idx] ? findNoteDef(slotNotes[idx]!) : null;
    if (!spec || spec.freqs.length === 0) return;

    const durDef = NOTE_DURATION_DEFS[spec.durationId];
    const stepDur = Math.max(0.28, durDef.beats * beatIntervalSec * 0.94);
    const gapSec = Math.max(stepDur * 1.2, beatIntervalSec * 1.05);

    const events: ScheduledStepEvent[] = [
      {
        slotIdx: idx,
        offsetSec: 0,
        durationSec: stepDur,
        freqs: spec.freqs,
      },
    ];

    if (userFound) {
      events.push({
        slotIdx: idx,
        offsetSec: gapSec,
        durationSec: stepDur,
        freqs: [userFound.freq],
      });
    }

    runLookaheadSchedule(events, 'reference', userFound ? gapSec + stepDur : stepDur);
  };

  const setSlotNotes = (next: Array<string | null>) =>
    setStoredSlotNotes(storeKey, targetNotes.length, targetPattern.length, next);
  const setActiveSlotIdx = (idx: number) =>
    setStoredActiveSlotIdx(storeKey, targetNotes.length, targetPattern.length, idx);
  const setBeatPattern = (next: RhythmBeatType[]) =>
    setStoredBeatPattern(storeKey, targetNotes.length, targetPattern.length, next);
  const setStatus = (msg: string | null, solved?: boolean) =>
    setStoredStatus(storeKey, targetNotes.length, targetPattern.length, msg, solved);

  const handleAssignNoteToSlot = (note: MusicNoteDef) => {
    if (isReadOnly || isSolved) return;
    playSingleNote(note.freq);
    setStatus(null);

    if (strictSequential) {
      const nextAppendIdx = slotNotes.findIndex((n) => !n);
      const targetIdx = nextAppendIdx === -1 ? targetNotes.length - 1 : nextAppendIdx;
      const updated = [...slotNotes];
      updated[targetIdx] = note.id;
      setSlotNotes(updated);
      const upcomingEmpty = updated.findIndex((n) => !n);
      setActiveSlotIdx(upcomingEmpty === -1 ? targetNotes.length - 1 : upcomingEmpty);
      return;
    }

    const safeIdx = Math.max(0, Math.min(targetNotes.length - 1, activeSlotIdx));
    const wasEmpty = !slotNotes[safeIdx];
    const updated = [...slotNotes];
    updated[safeIdx] = note.id;
    setSlotNotes(updated);

    if (wasEmpty) {
      setActiveSlotIdx(findNextEmptyIdx(updated, safeIdx));
    }
  };

  const handleSelectSlot = (idx: number) => {
    const existingId = slotNotes[idx];
    if (existingId) {
      const found = findNoteDef(existingId);
      if (found) playSingleNote(found.freq);
    }
    if (!isReadOnly && !isSolved && !strictSequential) {
      setActiveSlotIdx(idx);
    }
  };

  const handleClearSlot = (idx: number) => {
    if (isReadOnly || isSolved || strictSequential) return;
    const next = [...slotNotes];
    next[idx] = null;
    setSlotNotes(next);
    setStatus(null);
    setActiveSlotIdx(idx);
  };

  const handleClearLastFilled = () => {
    if (isReadOnly || isSolved) return;
    let lastFilled = -1;
    for (let i = slotNotes.length - 1; i >= 0; i -= 1) {
      if (slotNotes[i]) {
        lastFilled = i;
        break;
      }
    }
    if (lastFilled === -1) return;
    const next = [...slotNotes];
    next[lastFilled] = null;
    setSlotNotes(next);
    setStatus(null);
    setActiveSlotIdx(lastFilled);
  };

  const handleVerifyMelody = () => {
    const emptyPositions = slotNotes
      .map((n, idx) => (!n ? idx + 1 : null))
      .filter((n): n is number => n !== null);

    if (emptyPositions.length > 0) {
      soundEngine.playError();
      setActiveSlotIdx(emptyPositions[0] - 1);
      setStatus(
        `Заповніть порожні позиції (${emptyPositions.map((n) => `#${n}`).join(', ')}), щоб завершити всі ${targetNotes.length} нот.`
      );
      return;
    }

    const matchedCount = targetNotes.reduce(
      (sum, target, idx) => sum + (slotNotes[idx] === target ? 1 : 0),
      0
    );

    if (matchedCount === targetNotes.length) {
      soundEngine.playSuccess();
      const dualChain = targetNotes
        .map((id) => findNoteDef(id)?.dualLabel || id)
        .join(' — ');
      setStatus(
        config.successMessage ||
          `🎵 Чудовий слух! Мелодію (${dualChain}) відтворено безпомилково.`,
        true
      );
      onSubmitAnswer?.(slotNotes.filter((n): n is string => Boolean(n)));
    } else {
      soundEngine.playError();
      const firstDiffIdx = targetNotes.findIndex((t, idx) => slotNotes[idx] !== t);
      if (!strictSequential && firstDiffIdx >= 0) {
        setActiveSlotIdx(firstDiffIdx);
      }
      setStatus(
        `Збіглося ${matchedCount} з ${targetNotes.length} нот. Переслухайте зразок і перевірте позицію №${firstDiffIdx + 1} (вона вже вибрана для заміни).`
      );
    }
  };

  const handleToggleBeat = (idx: number) => {
    if (isReadOnly || isSolved) return;
    const next = [...beatPattern];
    const updated = nextBeatType(next[idx] || 'rest', allowSubdivisionBeat);
    next[idx] = updated;
    playPercussion(updated);
    setBeatPattern(next);
    setStatus(null);
  };

  const handleVerifyRhythm = () => {
    const matched = targetPattern.reduce(
      (sum, target, idx) => sum + (beatPattern[idx] === target ? 1 : 0),
      0
    );

    if (matched === targetPattern.length) {
      soundEngine.playSuccess();
      setStatus(
        config.successMessage ||
          `🥁 Точний ритмічний малюнок! Усі ${targetPattern.length} долі такту збігаються.`,
        true
      );
      onSubmitAnswer?.(beatPattern);
    } else {
      soundEngine.playError();
      setStatus(
        `Правильно виставлено ${matched} з ${targetPattern.length} долей. Порівняйте свій такт зі звучанням зразка.`
      );
    }
  };

  const scaleLabel =
    scaleType === 'major'
      ? 'Мажор / Major (8)'
      : scaleType === 'minor'
      ? 'Мінор / Minor (8)'
      : 'Пентатоніка / Pentatonic (6)';

  return (
    <div className="p-4 sm:p-5 bg-[var(--surface)] border-2 border-[var(--border)] rounded-[var(--radius-md)] shadow-card space-y-4 text-[var(--text)]">
      {/* Header + Clean Unboxed Metadata */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-[var(--border)]">
        <div className="space-y-1 min-w-0">
          <h4 className="text-sm font-extrabold text-[var(--primary-dark)] flex items-center gap-1.5">
            <span aria-hidden="true">{mode === 'rhythm_grid' ? '🥁' : '🎹'}</span>
            <span>
              {config.title ||
                (mode === 'rhythm_grid'
                  ? 'Конструктор музичного ритму'
                  : 'Музичний слуховий тренажер')}
            </span>
          </h4>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            {config.instruction ||
              (mode === 'rhythm_grid'
                ? 'Послухайте ритм-зразок і відтворіть чергування сильних, легких долей та пауз.'
                : 'Прослухайте мелодію та зберіть її у подвійному українсько-міжнародному позначенні.')}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono font-bold text-[var(--text-muted)] tabular-nums">
            <span>{gradeProfile.band} кл.</span>
            <span aria-hidden="true">·</span>
            <span>
              {mode === 'rhythm_grid'
                ? `Розмір ${timeSignature}`
                : scaleLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>♩ = {effectiveTempoBpm} BPM</span>
            {mode === 'ear_melody' && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {difficulty === 'beginner'
                    ? 'Початковий (за прикладом)'
                    : difficulty === 'intermediate'
                    ? 'Середній (на слух)'
                    : 'Складний (сліпий диктант)'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Interactive Timbre, Speed & Metronome Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
          {mode === 'ear_melody' && (
            <div className="inline-flex flex-wrap max-w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-0.5">
              {ACTIVE_INSTRUMENTS.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => setTimbre(inst.id)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-[4px] whitespace-nowrap cursor-pointer transition-colors ${
                    timbre === inst.id
                      ? 'bg-[var(--surface)] text-[var(--primary-dark)] shadow-xs border border-[var(--border)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                  title={`${inst.uaName} / ${inst.intlName}: ${inst.description}`}
                >
                  {inst.uaName}
                </button>
              ))}
            </div>
          )}

          {allowTempoControl && (
            <div
              className="inline-flex flex-wrap max-w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] p-0.5 tabular-nums"
              title="Швидкість відтворення в реальному часі"
            >
              {([0.75, 1, 1.25] as const).map((mult) => (
                <button
                  key={mult}
                  type="button"
                  onClick={() => setSpeedMultiplier(mult)}
                  className={`px-2 py-1 text-[11px] font-mono font-bold rounded-[4px] whitespace-nowrap cursor-pointer transition-colors ${
                    speedMultiplier === mult
                      ? 'bg-[var(--surface)] text-[var(--primary-dark)] shadow-xs border border-[var(--border)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {mult}×
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setMetronomeOn((prev) => !prev)}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-[var(--radius-sm)] border whitespace-nowrap cursor-pointer transition-colors ${
              metronomeOn
                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
            title="Супровідний пульс метронома під час програвання послідовності"
          >
            ⏱ Метроном
          </button>
        </div>
      </div>

      {/* Reference Audio Bar: Stacked two-row bar prevents any button jitter */}
      <div className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-xs font-bold min-h-[1.25rem] leading-5 tabular-nums">
          <span aria-hidden="true" className="shrink-0">🔊</span>
          <span className="truncate">
            {playingKind === 'reference' && playingSlotIdx !== null
              ? `Звучить зразок: крок ${playingSlotIdx + 1} з ${
                  mode === 'rhythm_grid' ? targetPattern.length : targetNotes.length
                }`
              : playingKind === 'user' && playingSlotIdx !== null
              ? `Звучить ваш варіант: крок ${playingSlotIdx + 1} з ${
                  mode === 'rhythm_grid' ? targetPattern.length : targetNotes.length
                }`
              : mode === 'ear_melody'
              ? 'Натисніть «Послухати зразок» або спробуйте звукоряд клавішами A–K'
              : 'Натисніть «Послухати зразок», щоб почути ритмічний малюнок'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() =>
              mode === 'rhythm_grid'
                ? playRhythmSequence(targetPattern, 'reference')
                : playNoteSequence(targetNotes, 'reference')
            }
          >
            🔊 Послухати зразок
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              mode === 'rhythm_grid'
                ? playRhythmSequence(beatPattern, 'user')
                : playNoteSequence(slotNotes, 'user')
            }
            disabled={mode === 'ear_melody' && filledNotesCount === 0}
          >
            ▶ Мій варіант
          </Button>
          {mode === 'ear_melody' && difficulty === 'beginner' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-[8.75rem] tabular-nums"
              disabled={!slotNotes[activeSlotIdx]}
              onClick={handleCompareActiveSlot}
              title="Звучить спочатку еталонна нота позиції, потім ваша для прямого порівняння"
            >
              ⚖️ Порівняти #{activeSlotIdx + 1}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={playingKind === 'none' && !auditioningNoteId}
            onClick={clearPlaybackTimers}
            title="Плавно заглушити звук"
          >
            ⏹ Стоп
          </Button>
        </div>
      </div>

      {mode === 'ear_melody' ? (
        <>
          {/* Reference Visual Example Track */}
          {difficulty !== 'advanced' && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-extrabold text-[var(--text-muted)] min-h-[1.25rem]">
                <span>
                  {difficulty === 'beginner'
                    ? 'Приклад мелодії (нотний стан, тривалість і покрокове прослуховування):'
                    : 'Індикатор кроків зразка (без підказки висоти):'}
                </span>
                {difficulty === 'beginner' && (
                  <span className="font-normal">
                    Натискайте «🔊 #N» для прослуховування окремої ноти
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {targetStepSpecs.map((spec, idx) => {
                  const refNote = findNoteDef(spec.noteId);
                  const prevNote = idx > 0 ? findNoteDef(targetStepSpecs[idx - 1].noteId) : null;
                  const durDef = NOTE_DURATION_DEFS[spec.durationId];
                  const contour =
                    refNote && prevNote
                      ? refNote.freq > prevNote.freq
                        ? '↗ вище'
                        : refNote.freq < prevNote.freq
                        ? '↘ нижче'
                        : '→ рівно'
                      : '● старт';
                  const isRefPlaying = playingKind === 'reference' && playingSlotIdx === idx;
                  const isTargetActive = !strictSequential && activeSlotIdx === idx && !isSolved;

                  return difficulty === 'beginner' ? (
                    <button
                      key={`ref_${idx}`}
                      type="button"
                      onClick={() => handleAuditionReferenceSlot(idx)}
                      className={`h-[6.5rem] p-1.5 rounded-[var(--radius-sm)] border-2 flex flex-col justify-between transition-colors cursor-pointer tabular-nums ${
                        isRefPlaying
                          ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)] ring-2 ring-[var(--accent)]'
                          : isTargetActive
                          ? 'bg-[var(--surface-alt)] border-[var(--accent)] text-[var(--primary-dark)]'
                          : 'bg-[var(--surface-alt)] border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)]'
                      }`}
                      title={`Послухати крок #${idx + 1}: ${durDef.uaName} / ${durDef.intlName}`}
                    >
                      <div className="w-full flex items-center justify-between text-[10px] font-mono font-bold px-0.5">
                        <span>🔊 #{idx + 1}</span>
                        <span className="opacity-85">{contour}</span>
                      </div>
                      {refNote && (
                        <MiniStaffNoteSvg
                          staffStep={refNote.staffStep}
                          isFlat={refNote.isFlat}
                          active={isRefPlaying}
                        />
                      )}
                      <span className="text-[10px] font-bold text-[var(--text-muted)] truncate w-full">
                        {durDef.symbolText} {durDef.uaName} · {durDef.ratioLabel}
                      </span>
                    </button>
                  ) : (
                    <div
                      key={`ref_${idx}`}
                      className={`min-h-[2.75rem] py-2 px-2.5 rounded-[var(--radius-sm)] border flex items-center justify-between gap-1 text-[11px] font-mono font-bold transition-colors tabular-nums ${
                        isRefPlaying
                          ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                          : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)]'
                      }`}
                    >
                      <span>{isRefPlaying ? `🔊 #${idx + 1}` : `Крок #${idx + 1}`}</span>
                      <span>{durDef.ratioLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Target / Entered Slots */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-extrabold text-[var(--text-muted)] min-h-[1.25rem] tabular-nums">
              <span>
                Ваша мелодія ({filledNotesCount}/{targetNotes.length})
                {!strictSequential && !isSolved && !isReadOnly && (
                  <> · активна позиція #{activeSlotIdx + 1}</>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={filledNotesCount === 0 || isReadOnly || isSolved}
                  onClick={handleClearLastFilled}
                  className="underline hover:text-[var(--accent)] disabled:opacity-40 cursor-pointer"
                >
                  ← Стерти останню
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  disabled={filledNotesCount === 0 || isReadOnly || isSolved}
                  onClick={() => {
                    setSlotNotes(Array.from({ length: targetNotes.length }, () => null));
                    setActiveSlotIdx(0);
                    setStatus(null);
                  }}
                  className="underline hover:text-[var(--accent)] disabled:opacity-40 cursor-pointer"
                >
                  Очистити все
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {targetStepSpecs.map((spec, idx) => {
                const chosenId = slotNotes[idx];
                const noteObj = chosenId ? findNoteDef(chosenId) : null;
                const durDef = NOTE_DURATION_DEFS[spec.durationId];
                const isActivePlay = playingKind === 'user' && playingSlotIdx === idx;
                const isSelectedSlot =
                  !isSolved && !isReadOnly && !strictSequential && activeSlotIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`h-28 rounded-[var(--radius-sm)] border-2 flex flex-col overflow-hidden transition-colors tabular-nums ${
                      isActivePlay
                        ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)] ring-2 ring-[var(--accent)]'
                        : isSelectedSlot
                        ? 'bg-[var(--hl-bg)] border-[var(--accent)] text-[var(--primary-dark)] ring-2 ring-[var(--accent)]/35'
                        : noteObj
                        ? 'bg-[var(--surface-alt)] border-[var(--accent)] text-[var(--primary-dark)]'
                        : 'bg-[var(--bg)] border-dashed border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between px-2 pt-1 h-6 shrink-0 text-[10px] font-mono font-bold">
                      <span>
                        #{idx + 1} · {durDef.ratioLabel}
                        {isSelectedSlot ? ' · ✎' : ''}
                      </span>
                      {noteObj && !isReadOnly && !isSolved && !strictSequential ? (
                        <button
                          type="button"
                          onClick={() => handleClearSlot(idx)}
                          aria-label={`Очистити позицію #${idx + 1}`}
                          title={`Прибрати ноту з #${idx + 1}`}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--primary-dark)] cursor-pointer leading-none"
                        >
                          ✕
                        </button>
                      ) : (
                        <span className="w-5 h-5 shrink-0" aria-hidden="true" />
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isReadOnly && !noteObj}
                      onClick={() => handleSelectSlot(idx)}
                      className="flex-1 px-1.5 pb-1.5 flex flex-col items-center justify-between cursor-pointer w-full text-center"
                      title={
                        strictSequential
                          ? noteObj
                            ? `Прослухати ноту #${idx + 1} (${noteObj.dualLabel})`
                            : `Позиція #${idx + 1}`
                          : noteObj
                          ? `Натисніть, щоб послухати й замінити ноту у #${idx + 1}`
                          : `Обрати позицію #${idx + 1} для запису`
                      }
                    >
                      {noteObj ? (
                        <>
                          <MiniStaffNoteSvg
                            staffStep={noteObj.staffStep}
                            isFlat={noteObj.isFlat}
                            active={isActivePlay}
                          />
                          <span className="text-[11px] font-extrabold leading-tight">
                            {noteObj.dualLabel}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold my-auto opacity-80">
                          {isSelectedSlot ? 'Оберіть ноту' : 'Порожньо'}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Dual-Notation Keyboard / Sound Pad */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[var(--text-muted)] min-h-[1.25rem] tabular-nums">
              <span className="font-extrabold">
                Звукоряд · слухайте наживо (🔊 / клавіші A–K), потім додайте у #{activeSlotIdx + 1}:
              </span>
              {strictSequential && (
                <span className="font-mono text-[10px]">
                  Складний режим: послідовний запис
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {availableNotes.map((note) => {
                const isAuditioning = auditioningNoteId === note.id;
                const currentSlotHasSame = slotNotes[activeSlotIdx] === note.id;
                const targetSlotFilled = Boolean(slotNotes[activeSlotIdx]);
                return (
                  <div
                    key={note.id}
                    className={`rounded-[var(--radius-sm)] border-2 flex flex-col overflow-hidden transition-colors ${
                      isAuditioning
                        ? 'bg-[var(--hl-bg)] border-[var(--hl-border)]'
                        : currentSlotHasSame && !strictSequential
                        ? 'bg-[var(--surface-alt)] border-[var(--accent)]'
                        : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleAuditionNote(note)}
                      className="p-1.5 flex flex-col items-center gap-1 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors flex-1 text-center"
                      title={`Прослухати ${note.dualLabel} (клавіша ${note.keyHint || ''})`}
                    >
                      <div className="w-full flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] px-0.5">
                        <span>{note.degree}</span>
                        <span>{note.keyHint ? `[${note.keyHint}]` : '🔊'}</span>
                      </div>
                      <MiniStaffNoteSvg
                        staffStep={note.staffStep}
                        isFlat={note.isFlat}
                        active={isAuditioning}
                      />
                      <div className="leading-tight">
                        <div className="text-xs font-extrabold text-[var(--primary-dark)]">
                          {note.uaLabel}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-[var(--text-muted)]">
                          {note.intlLabel} · 🔊
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isReadOnly || isSolved}
                      onClick={() => handleAssignNoteToSlot(note)}
                      className={`min-h-[2.25rem] px-2 text-[11px] font-extrabold border-t border-[var(--border)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-45 tabular-nums whitespace-nowrap ${
                        currentSlotHasSame && !strictSequential
                          ? 'bg-[var(--hl-bg)] text-[var(--hl-text)]'
                          : 'bg-[var(--surface-alt)] hover:bg-[var(--accent)] hover:text-[var(--accent-text)] text-[var(--primary-dark)]'
                      }`}
                    >
                      {strictSequential
                        ? '+ Додати'
                        : targetSlotFilled
                        ? `↻ В #${activeSlotIdx + 1}`
                        : `+ В #${activeSlotIdx + 1}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="accent"
              disabled={isReadOnly || isSolved}
              onClick={handleVerifyMelody}
            >
              ✓ Перевірити мелодію
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Rhythm Beat Grid with Real Musical SVG Symbols & Dual Labels */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[var(--text-muted)]">
              <span>Натискайте на долі такту, щоб змінити тривалість / акцент:</span>
              <span className="font-mono">
                {allowSubdivisionBeat
                  ? '> ♩ Сильна → ♩ Легка (1/4) → ♪ Дрібна (1/8) → 𝄽 Пауза'
                  : '> ♩ Сильна → ♩ Легка (1/4) → 𝄽 Пауза'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {beatPattern.map((beat, idx) => {
                const meta = RHYTHM_BEAT_META[beat] || RHYTHM_BEAT_META.rest;
                const isPlayingBeat = playingSlotIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isReadOnly || isSolved}
                    onClick={() => handleToggleBeat(idx)}
                    className={`p-3 rounded-[var(--radius-sm)] border-2 flex flex-col items-center justify-center gap-1 min-h-[104px] cursor-pointer transition-colors tabular-nums ${
                      isPlayingBeat
                        ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)] ring-2 ring-[var(--accent)]'
                        : beat === 'strong'
                        ? 'bg-[var(--surface-alt)] border-[var(--accent)] text-[var(--primary-dark)]'
                        : beat === 'weak' || beat === 'sub'
                        ? 'bg-[var(--bg)] border-[var(--border-hover)] text-[var(--text)]'
                        : 'bg-[var(--surface)] border-dashed border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold">
                      Доля {idx + 1} · {meta.beats}×
                    </span>
                    <BeatNotationSvg kind={beat} active={isPlayingBeat} size={30} />
                    <span className="text-xs font-extrabold">{meta.uaLabel}</span>
                    <span className="text-[10px] font-mono font-medium opacity-85">
                      {meta.intlLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isReadOnly || isSolved}
              onClick={() => {
                setBeatPattern(Array.from({ length: targetPattern.length }, () => 'rest'));
                setStatus(null);
              }}
            >
              ↺ Скинути такт
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={isReadOnly || isSolved}
              onClick={handleVerifyRhythm}
            >
              ✓ Перевірити ритм
            </Button>
          </div>
        </>
      )}

      <div
        className={`status-panel min-h-[3rem] flex items-center ${
          statusMsg
            ? isSolved
              ? 'status-panel--success'
              : 'status-panel--warning'
            : 'status-panel--neutral'
        }`}
      >
        <span>
          {statusMsg ||
            (mode === 'rhythm_grid'
              ? 'Налаштуйте долі такту й натисніть «Перевірити ритм».'
              : 'Прослухайте ноти (також працюють клавіші A–K), заповніть усі позиції й натисніть «Перевірити мелодію».')}
        </span>
      </div>
    </div>
  );
};
