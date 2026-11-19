/**
 * Dedicated Musical & Exercise Audio Synthesizer (`MusicalSynthEngine`)
 *
 * Engineered for zero clicks, zero pops, zero hiss, and natural instrument polyphony:
 * - 24-voice polyphonic pool: rapid audition switching NEVER interrupts or hard-cuts prior notes;
 *   previous voices complete their natural acoustic envelope gracefully, eliminating phase cuts.
 * - Explicit Stop / Voice-Pool overflow uses smooth exponential damping (`setTargetAtTime(0, now, 0.045)`)
 *   instead of abrupt step truncation.
 * - Master Signal Chain: Voice Sum -> DC-Block HPF (38 Hz) -> Warm Body EQ (250 Hz)
 *   -> Anti-Hiss LPF (4800 Hz) -> Soft-Clipper Saturation Guard -> DynamicsCompressor -> Smoothed Master Gain.
 * - Pre-baked 32-bit float AudioBuffers with zero-crossing start/end, raised-cosine attack/release,
 *   equal-loudness pitch compensation, and active timbres ('piano', 'marimba') plus extensible registry hooks.
 */

import { ActiveInstrumentTimbreId, PlannedInstrumentTimbreId, RhythmBeatType } from './musicTheory';

export type MusicalVoiceGroup = 'audition' | 'sequence' | 'percussion' | 'cue';
export type PercussionKind = RhythmBeatType | 'tom_high' | 'tom_mid' | 'shaker';

interface ActiveVoice {
  id: number;
  group: MusicalVoiceGroup;
  source: AudioBufferSourceNode;
  voiceGain: GainNode;
  endsAt: number;
  isDamping: boolean;
}

const MAX_VOICES = 24;
const MAX_BUFFER_CACHE = 96;

class MusicalSynthEngine {
  private ctx: AudioContext | null = null;
  private voiceSumBus: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private isMuted = false;
  private volume = 0.75;

  private noteBufferCache: Map<string, AudioBuffer> = new Map();
  private percussionBuffers: Map<string, AudioBuffer> = new Map();
  private cueBuffers: Map<'launch' | 'impact', AudioBuffer> = new Map();

  private voiceQueue: ActiveVoice[] = [];
  private nextVoiceId = 1;

  public setVolume(volume: number): void {
    const safeVol = Math.min(1, Math.max(0, Number(volume)));
    this.volume = Number.isFinite(safeVol) ? safeVol : 0.75;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.getMasterTargetGain();
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.025);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.getMasterTargetGain();
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    if (this.isMuted) {
      this.stopAll();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /** Returns the current AudioContext time when active, useful for Web Audio lookahead scheduling. */
  public getAudioTime(): number | null {
    const ctx = this.ensureMasterBus();
    return ctx ? ctx.currentTime : null;
  }

  private getMasterTargetGain(): number {
    return Math.max(0.0, Math.min(1.0, this.volume)) * 0.76;
  }

  private resolveActiveTimbre(timbre?: PlannedInstrumentTimbreId): ActiveInstrumentTimbreId {
    if (
      timbre === 'marimba' ||
      timbre === 'plucked_bandura' ||
      timbre === 'bass_acoustic' ||
      timbre === 'bass_synth' ||
      timbre === 'flute_woodwind' ||
      timbre === 'brass_horn'
    ) {
      return timbre;
    }
    return 'piano';
  }

  private buildSoftClipCurve(): Float32Array<ArrayBuffer> {
    const samples = 1024;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / (samples - 1) - 1;
      // Gentle analog tanh soft-clipping prevents harsh digital peaks during chords
      curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15);
    }
    return curve;
  }

  private ensureMasterBus(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.voiceSumBus || !this.masterGain) {
      const ctx = this.ctx;
      const sumBus = ctx.createGain();
      sumBus.gain.setValueAtTime(1.0, ctx.currentTime);

      // 1. Sub-sonic DC-blocker High-Pass Filter
      const dcBlockHpf = ctx.createBiquadFilter();
      dcBlockHpf.type = 'highpass';
      dcBlockHpf.frequency.setValueAtTime(38, ctx.currentTime);
      dcBlockHpf.Q.setValueAtTime(0.707, ctx.currentTime);

      // 2. Warm acoustic body emphasis
      const warmBodyEq = ctx.createBiquadFilter();
      warmBodyEq.type = 'peaking';
      warmBodyEq.frequency.setValueAtTime(250, ctx.currentTime);
      warmBodyEq.Q.setValueAtTime(0.8, ctx.currentTime);
      warmBodyEq.gain.setValueAtTime(1.5, ctx.currentTime);

      // 3. Anti-hiss / anti-aliasing Low-Pass Filter
      const antiHissLpf = ctx.createBiquadFilter();
      antiHissLpf.type = 'lowpass';
      antiHissLpf.frequency.setValueAtTime(4800, ctx.currentTime);
      antiHissLpf.Q.setValueAtTime(0.65, ctx.currentTime);

      // 4. Gentle soft-clipping guard for multi-voice polyphony
      const softClipper = ctx.createWaveShaper();
      softClipper.curve = this.buildSoftClipCurve();
      softClipper.oversample = '2x';

      // 5. Soft-knee Dynamics Compressor to stabilize levels across rapid passages
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, ctx.currentTime);
      compressor.knee.setValueAtTime(20, ctx.currentTime);
      compressor.ratio.setValueAtTime(3.2, ctx.currentTime);
      compressor.attack.setValueAtTime(0.008, ctx.currentTime);
      compressor.release.setValueAtTime(0.18, ctx.currentTime);

      // 6. Master Gain
      const master = ctx.createGain();
      master.gain.setValueAtTime(
        this.isMuted ? 0 : this.getMasterTargetGain(),
        ctx.currentTime
      );

      sumBus.connect(dcBlockHpf);
      dcBlockHpf.connect(warmBodyEq);
      warmBodyEq.connect(antiHissLpf);
      antiHissLpf.connect(softClipper);
      softClipper.connect(compressor);
      compressor.connect(master);
      master.connect(ctx.destination);

      this.voiceSumBus = sumBus;
      this.masterGain = master;
    }

    return this.ctx;
  }

  /**
   * Removes DC offset and guarantees smooth raised-cosine zero endpoints at start and end.
   */
  private finalizeCleanBuffer(
    data: Float32Array,
    sampleRate: number,
    fadeInSec: number,
    fadeOutSec: number,
    targetRms: number
  ): void {
    const len = data.length;
    if (len < 8) return;

    let mean = 0;
    for (let i = 0; i < len; i += 1) {
      mean += data[i];
    }
    mean /= len;
    for (let i = 0; i < len; i += 1) {
      data[i] -= mean;
    }

    const fadeInSamples = Math.min(Math.floor(len * 0.2), Math.max(12, Math.round(fadeInSec * sampleRate)));
    const fadeOutSamples = Math.min(Math.floor(len * 0.55), Math.max(24, Math.round(fadeOutSec * sampleRate)));

    for (let i = 0; i < fadeInSamples; i += 1) {
      const w = 0.5 * (1 - Math.cos((Math.PI * i) / fadeInSamples));
      data[i] *= w;
    }
    for (let i = 0; i < fadeOutSamples; i += 1) {
      const idx = len - 1 - i;
      const w = 0.5 * (1 - Math.cos((Math.PI * i) / fadeOutSamples));
      data[idx] *= w;
    }

    data[0] = 0;
    data[len - 1] = 0;

    let sumSq = 0;
    for (let i = 0; i < len; i += 1) {
      sumSq += data[i] * data[i];
    }
    const rms = Math.sqrt(sumSq / len);
    if (rms > 1e-6) {
      let scale = targetRms / rms;
      let peak = 0;
      for (let i = 0; i < len; i += 1) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
      }
      if (peak * scale > 0.78) {
        scale = 0.78 / peak;
      }
      for (let i = 0; i < len; i += 1) {
        data[i] *= scale;
      }
    }
  }

  private getOrBakeNoteBuffer(
    ctx: AudioContext,
    freq: number,
    durationSec: number,
    timbre: ActiveInstrumentTimbreId = 'piano'
  ): AudioBuffer {
    const safeFreq = Math.max(80, Math.min(2600, freq));
    const safeDur = Math.max(0.22, Math.min(2.2, durationSec));
    const key = `${timbre}_${Math.round(safeFreq * 100)}_${Math.round(safeDur * 1000)}`;

    const existing = this.noteBufferCache.get(key);
    if (existing) {
      this.noteBufferCache.delete(key);
      this.noteBufferCache.set(key, existing);
      return existing;
    }

    const sampleRate = ctx.sampleRate;
    const totalSamples = Math.max(256, Math.round(safeDur * sampleRate));
    const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    const effectiveFreq =
      timbre === 'bass_acoustic' || timbre === 'bass_synth'
        ? Math.max(65, safeFreq * 0.5)
        : safeFreq;
    const nyquistLimit = sampleRate * 0.42;
    const pitchLoudnessScale = Math.min(1.2, Math.max(0.76, Math.pow(329.63 / effectiveFreq, 0.2)));

    if (timbre === 'marimba') {
      // Woody bar acoustic model: strong pure fundamental + crisp fast-decaying mallet overtone
      const hasOvertone = effectiveFreq * 3.98 < nyquistLimit;
      const has2nd = effectiveFreq * 2 < nyquistLimit;
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const fundEnv = Math.exp(-t * 3.8);
        let sample = Math.sin(2 * Math.PI * effectiveFreq * t) * 0.88 * fundEnv;
        if (has2nd) {
          sample += Math.sin(2 * Math.PI * effectiveFreq * 2 * t) * 0.14 * Math.exp(-t * 9.5);
        }
        if (hasOvertone) {
          sample += Math.sin(2 * Math.PI * effectiveFreq * 3.98 * t) * 0.22 * Math.exp(-t * 36.0);
        }
        data[i] = sample * pitchLoudnessScale;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.008, Math.min(0.14, safeDur * 0.45), 0.2 * pitchLoudnessScale);
    } else if (timbre === 'plucked_bandura') {
      // Plucked strings (Bandura / Harp): rich upper harmonics decaying naturally + subtle string shimmer
      const harmonics = [
        { mult: 1, amp: 0.65, damp: 1.5 },
        { mult: 2, amp: 0.34, damp: 2.9 },
        { mult: 3, amp: 0.18, damp: 4.6 },
        { mult: 4, amp: 0.09, damp: 7.2 },
        { mult: 5, amp: 0.04, damp: 10.5 },
      ].filter((h) => effectiveFreq * h.mult < nyquistLimit);

      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        let sample = 0;
        for (let h = 0; h < harmonics.length; h += 1) {
          const { mult, amp, damp } = harmonics[h];
          sample += Math.sin(2 * Math.PI * effectiveFreq * mult * t) * amp * Math.exp(-t * damp);
        }
        // Subtle 12ms finger-pluck transient
        sample += Math.sin(2 * Math.PI * effectiveFreq * 2.5 * t) * 0.12 * Math.exp(-t * 42);
        data[i] = sample * pitchLoudnessScale;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.006, Math.min(0.18, safeDur * 0.48), 0.21 * pitchLoudnessScale);
    } else if (timbre === 'bass_acoustic') {
      // Deep warm upright bass (C2-G3 register): strong fundamental, gentle 15ms pluck, warm decay
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const fund = Math.sin(2 * Math.PI * effectiveFreq * t) * 0.85 * Math.exp(-t * 2.4);
        const h2 = Math.sin(2 * Math.PI * effectiveFreq * 2 * t) * 0.28 * Math.exp(-t * 5.2);
        const h3 = Math.sin(2 * Math.PI * effectiveFreq * 3 * t) * 0.1 * Math.exp(-t * 14.0);
        const pluck = Math.sin(2 * Math.PI * Math.min(540, effectiveFreq * 4) * t) * 0.14 * Math.exp(-t * 55);
        data[i] = (fund + h2 + h3 + pluck) * pitchLoudnessScale;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.01, Math.min(0.15, safeDur * 0.4), 0.24 * pitchLoudnessScale);
    } else if (timbre === 'bass_synth') {
      // Warm sub-bass: smoothed fundamental + octave + filtered analog warmth
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const env = 1 - Math.exp(-t * 45);
        const tail = Math.exp(-t * 1.9);
        const s1 = Math.sin(2 * Math.PI * effectiveFreq * t) * 0.86;
        const s2 = Math.sin(2 * Math.PI * effectiveFreq * 2 * t) * 0.3 * Math.exp(-t * 3.5);
        const s3 = Math.sin(2 * Math.PI * effectiveFreq * 3 * t) * 0.08 * Math.exp(-t * 7.5);
        data[i] = (s1 + s2 + s3) * env * tail * pitchLoudnessScale;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.012, Math.min(0.14, safeDur * 0.4), 0.24 * pitchLoudnessScale);
    } else if (timbre === 'flute_woodwind') {
      // Sopilka / Flute: soft 25ms breath attack + gentle vibrato + expressive sustain
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const attack = Math.min(1, t / 0.028);
        const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t * 3);
        const sustain = Math.exp(-t * 0.65);
        const f = effectiveFreq * vibrato;
        const fund = Math.sin(2 * Math.PI * f * t) * 0.84;
        const h2 = Math.sin(2 * Math.PI * f * 2 * t) * 0.16;
        const h3 = Math.sin(2 * Math.PI * f * 3 * t) * 0.05;
        data[i] = (fund + h2 + h3) * attack * sustain * pitchLoudnessScale;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.025, Math.min(0.18, safeDur * 0.42), 0.19 * pitchLoudnessScale);
    } else if (timbre === 'brass_horn') {
      // Soft French Horn: gentle brass swell + rich 2nd/3rd/4th brass partials
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const attack = Math.min(1, t / 0.036);
        const bloom = 0.6 + 0.4 * Math.min(1, t / 0.09);
        const sustain = Math.exp(-t * 0.85);
        const h1 = Math.sin(2 * Math.PI * effectiveFreq * t) * 0.68;
        const h2 = Math.sin(2 * Math.PI * effectiveFreq * 2 * t) * 0.34 * bloom;
        const h3 = Math.sin(2 * Math.PI * effectiveFreq * 3 * t) * 0.16 * bloom;
        const h4 = Math.sin(2 * Math.PI * effectiveFreq * 4 * t) * 0.06 * bloom;
        data[i] = (h1 + h2 + h3 + h4) * attack * sustain * pitchLoudnessScale;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.028, Math.min(0.18, safeDur * 0.42), 0.21 * pitchLoudnessScale);
    } else {
      // Warm acoustic piano model: progressive harmonic decay + soft string warmth
      const harmonics: Array<{ mult: number; amp: number; damp: number }> = [
        { mult: 1, amp: 0.72, damp: 1.35 },
        { mult: 2, amp: 0.23, damp: 2.85 },
        { mult: 3, amp: 0.08, damp: 4.9 },
        { mult: 4, amp: 0.024, damp: 7.4 },
      ].filter((h) => effectiveFreq * h.mult < nyquistLimit);

      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const bodyEnv = 0.62 * Math.exp(-t * 1.35) + 0.38 * Math.exp(-t * 0.48);
        let sample = 0;
        for (let h = 0; h < harmonics.length; h += 1) {
          const { mult, amp, damp } = harmonics[h];
          sample += Math.sin(2 * Math.PI * effectiveFreq * mult * t) * amp * Math.exp(-t * damp);
        }
        data[i] = sample * bodyEnv * pitchLoudnessScale;
      }
      this.finalizeCleanBuffer(
        data,
        sampleRate,
        0.011,
        Math.min(0.16, safeDur * 0.42),
        0.2 * pitchLoudnessScale
      );
    }

    if (this.noteBufferCache.size >= MAX_BUFFER_CACHE) {
      const oldestKey = this.noteBufferCache.keys().next().value;
      if (oldestKey !== undefined) this.noteBufferCache.delete(oldestKey);
    }
    this.noteBufferCache.set(key, buffer);
    return buffer;
  }

  private getOrBakePercussionBuffer(
    ctx: AudioContext,
    kind: 'strong' | 'weak' | 'sub' | 'tom_high' | 'tom_mid' | 'shaker'
  ): AudioBuffer {
    const cached = this.percussionBuffers.get(kind);
    if (cached) return cached;

    const sampleRate = ctx.sampleRate;
    const dur = kind === 'strong' ? 0.24 : kind === 'tom_mid' ? 0.2 : kind === 'tom_high' ? 0.16 : kind === 'weak' ? 0.14 : 0.095;
    const totalSamples = Math.round(dur * sampleRate);
    const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    if (kind === 'strong') {
      let phaseMain = 0;
      let phaseHarm = 0;
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const instFreq = 58 + 94 * Math.exp(-t * 28);
        phaseMain += (2 * Math.PI * instFreq) / sampleRate;
        phaseHarm += (2 * Math.PI * instFreq * 2.0) / sampleRate;
        const body = Math.sin(phaseMain) * Math.exp(-t * 13.5);
        const warm2nd = Math.sin(phaseHarm) * 0.24 * Math.exp(-t * 24);
        const malletTap = Math.sin(2 * Math.PI * 340 * t) * 0.2 * Math.exp(-t * 85);
        data[i] = body + warm2nd + malletTap;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.004, 0.055, 0.23);
    } else if (kind === 'tom_high' || kind === 'tom_mid') {
      const baseF = kind === 'tom_high' ? 165 : 115;
      let phase = 0;
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const f = baseF + 70 * Math.exp(-t * 24);
        phase += (2 * Math.PI * f) / sampleRate;
        data[i] = (Math.sin(phase) + 0.22 * Math.sin(phase * 1.5)) * Math.exp(-t * 12);
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.004, 0.05, 0.21);
    } else if (kind === 'shaker') {
      // Hiss-free harmonic soft shaker cluster
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const env = Math.sin(Math.min(1, t / 0.02) * (Math.PI / 2)) * Math.exp(-t * 32);
        const cluster =
          Math.sin(2 * Math.PI * 2240 * t) * 0.45 +
          Math.sin(2 * Math.PI * 2970 * t) * 0.35 +
          Math.sin(2 * Math.PI * 3620 * t) * 0.25;
        data[i] = cluster * env;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.004, 0.03, 0.13);
    } else if (kind === 'weak') {
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const p1 = Math.sin(2 * Math.PI * 690 * t) * Math.exp(-t * 26);
        const p2 = Math.sin(2 * Math.PI * 1190 * t) * 0.4 * Math.exp(-t * 42);
        const p3 = Math.sin(2 * Math.PI * 345 * t) * 0.28 * Math.exp(-t * 30);
        data[i] = p1 + p2 + p3;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.003, 0.04, 0.18);
    } else {
      for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        const p1 = Math.sin(2 * Math.PI * 1080 * t) * Math.exp(-t * 46);
        const p2 = Math.sin(2 * Math.PI * 1620 * t) * 0.35 * Math.exp(-t * 68);
        data[i] = p1 + p2;
      }
      this.finalizeCleanBuffer(data, sampleRate, 0.0025, 0.03, 0.14);
    }

    this.percussionBuffers.set(kind, buffer);
    return buffer;
  }

  private getOrBakeCueBuffer(ctx: AudioContext, kind: 'launch' | 'impact'): AudioBuffer {
    const cached = this.cueBuffers.get(kind);
    if (cached) return cached;

    const sampleRate = ctx.sampleRate;
    const dur = kind === 'launch' ? 0.28 : 0.38;
    const totalSamples = Math.round(dur * sampleRate);
    const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    let phase = 0;
    for (let i = 0; i < totalSamples; i += 1) {
      const t = i / sampleRate;
      if (kind === 'launch') {
        const f = 48 + 86 * Math.exp(-t * 14);
        phase += (2 * Math.PI * f) / sampleRate;
        data[i] = (Math.sin(phase) + 0.32 * Math.sin(phase * 2) * Math.exp(-t * 20)) * Math.exp(-t * 10.5);
      } else {
        const f = 36 + 58 * Math.exp(-t * 11);
        phase += (2 * Math.PI * f) / sampleRate;
        data[i] = (Math.sin(phase) + 0.38 * Math.sin(phase * 1.5) * Math.exp(-t * 16)) * Math.exp(-t * 8.2);
      }
    }

    this.finalizeCleanBuffer(data, sampleRate, 0.008, 0.07, 0.2);
    this.cueBuffers.set(kind, buffer);
    return buffer;
  }

  public warmupScale(
    frequencies: number[],
    noteDurationSec: number,
    timbre?: PlannedInstrumentTimbreId
  ): void {
    const ctx = this.ensureMasterBus();
    if (!ctx) return;
    const resolvedTimbre = this.resolveActiveTimbre(timbre);
    try {
      frequencies.forEach((f) => this.getOrBakeNoteBuffer(ctx, f, noteDurationSec, resolvedTimbre));
      this.getOrBakePercussionBuffer(ctx, 'strong');
      this.getOrBakePercussionBuffer(ctx, 'weak');
      this.getOrBakePercussionBuffer(ctx, 'sub');
    } catch {
      // Safe no-op
    }
  }

  private pruneEndedVoices(now: number): void {
    this.voiceQueue = this.voiceQueue.filter((v) => v.endsAt > now - 0.02);
  }

  /**
   * Uses true exponential damping (`setTargetAtTime`) so stopped voices never create
   * phase discontinuities or linear-ramp boundary clicks.
   */
  private smoothDampVoice(voice: ActiveVoice, timeConstantSec = 0.042): void {
    if (voice.isDamping || !this.ctx) return;
    voice.isDamping = true;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const g = voice.voiceGain.gain;

    try {
      const paramWithHold = g as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
      if (typeof paramWithHold.cancelAndHoldAtTime === 'function') {
        paramWithHold.cancelAndHoldAtTime(now);
      } else {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
      }
      g.setTargetAtTime(0, now, timeConstantSec);
      const stopAt = now + timeConstantSec * 5.0; // ~99.3% silent
      voice.source.stop(stopAt);
      voice.endsAt = Math.min(voice.endsAt, stopAt);
    } catch {
      // Already ended
    }
  }

  private enqueueBuffer(
    buffer: AudioBuffer,
    group: MusicalVoiceGroup,
    opts?: { absoluteAudioTime?: number; startOffsetSec?: number; gainMultiplier?: number }
  ): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.ensureMasterBus();
    if (!ctx || !this.voiceSumBus) return;

    const now = ctx.currentTime;
    this.pruneEndedVoices(now);

    while (this.voiceQueue.length >= MAX_VOICES) {
      const oldest = this.voiceQueue.find((v) => !v.isDamping) || this.voiceQueue[0];
      if (!oldest) break;
      this.smoothDampVoice(oldest, 0.03);
      this.voiceQueue = this.voiceQueue.filter((v) => v.id !== oldest.id);
    }

    try {
      const startTime =
        opts?.absoluteAudioTime !== undefined
          ? Math.max(now + 0.004, opts.absoluteAudioTime)
          : now + Math.max(0.006, (opts?.startOffsetSec ?? 0) + 0.006);
      const endsAt = startTime + buffer.duration + 0.02;
      const targetGain = opts?.gainMultiplier ?? 0.92;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.setValueAtTime(0.0001, startTime);
      voiceGain.gain.linearRampToValueAtTime(targetGain, startTime + 0.006);

      source.connect(voiceGain);
      voiceGain.connect(this.voiceSumBus);

      const voiceId = this.nextVoiceId++;
      const voice: ActiveVoice = {
        id: voiceId,
        group,
        source,
        voiceGain,
        endsAt,
        isDamping: false,
      };

      this.voiceQueue.push(voice);
      source.onended = () => {
        try {
          source.disconnect();
          voiceGain.disconnect();
        } catch {
          // ignore
        }
        this.voiceQueue = this.voiceQueue.filter((v) => v.id !== voiceId);
      };

      source.start(startTime);
    } catch {
      // Ignore autoplay blocks
    }
  }

  /**
   * Natural polyphonic audition: lets previous audition notes decay naturally across the 24-voice
   * pool instead of hard-chopping them, preventing clicks/crackles on fast note switching.
   */
  public playAuditionNote(
    freq: number,
    durationSec = 0.72,
    timbre?: PlannedInstrumentTimbreId
  ): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.ensureMasterBus();
    if (!ctx) return;

    const resolvedTimbre = this.resolveActiveTimbre(timbre);
    // Use comfortable natural acoustic decay duration (>= 0.68s) for fluid ringing
    const naturalDur = Math.max(0.68, durationSec);
    const buffer = this.getOrBakeNoteBuffer(ctx, freq, naturalDur, resolvedTimbre);
    this.enqueueBuffer(buffer, 'audition', { gainMultiplier: 0.88 });
  }

  /** Schedules a note at an exact AudioContext clock timestamp (for lookahead sequencer) or relative offset. */
  public scheduleSequenceNote(
    freq: number,
    startOffsetSec: number,
    durationSec: number,
    opts?: { absoluteAudioTime?: number; timbre?: PlannedInstrumentTimbreId; gainScale?: number }
  ): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.ensureMasterBus();
    if (!ctx) return;

    const resolvedTimbre = this.resolveActiveTimbre(opts?.timbre);
    const buffer = this.getOrBakeNoteBuffer(ctx, freq, durationSec, resolvedTimbre);
    this.enqueueBuffer(buffer, 'sequence', {
      absoluteAudioTime: opts?.absoluteAudioTime,
      startOffsetSec,
      gainMultiplier: opts?.gainScale ?? 0.9,
    });
  }

  public schedulePercussion(
    kind: PercussionKind,
    startOffsetSec = 0,
    opts?: { absoluteAudioTime?: number; gainScale?: number }
  ): void {
    if (kind === 'rest' || this.isMuted || this.volume <= 0.01) return;
    const ctx = this.ensureMasterBus();
    if (!ctx) return;
    const buffer = this.getOrBakePercussionBuffer(ctx, kind);
    const baseGain = kind === 'strong' ? 0.95 : kind === 'weak' ? 0.84 : 0.65;
    this.enqueueBuffer(buffer, 'percussion', {
      absoluteAudioTime: opts?.absoluteAudioTime,
      startOffsetSec,
      gainMultiplier: baseGain * (opts?.gainScale ?? 1.0),
    });
  }

  public playExerciseCue(kind: 'launch' | 'impact'): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.ensureMasterBus();
    if (!ctx) return;
    const buffer = this.getOrBakeCueBuffer(ctx, kind);
    this.enqueueBuffer(buffer, 'cue', { gainMultiplier: 0.88 });
  }

  public stopGroup(group: MusicalVoiceGroup): void {
    this.voiceQueue.forEach((v) => {
      if (v.group === group) {
        this.smoothDampVoice(v, 0.042);
      }
    });
  }

  public stopAll(): void {
    this.voiceQueue.forEach((v) => {
      this.smoothDampVoice(v, 0.042);
    });
  }
}

export const musicalSynth = new MusicalSynthEngine();
