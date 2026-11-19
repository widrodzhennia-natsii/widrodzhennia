/**
 * Web Audio API Procedural Sound Engine
 * Synthesizes sound effects and long-form generative ambient melodies using GainNode ramps
 * and harmonic oscillator permutations to prevent clicks, pops, and short loops.
 */

class SoundEngineService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.75;
  private isAmbientPlaying: boolean = false;
  private ambientGainNode: GainNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  private ambientTimer: ReturnType<typeof setInterval> | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(volume: number): void {
    const safeVol = Math.min(1, Math.max(0, Number(volume)));
    this.volume = Number.isFinite(safeVol) ? safeVol : 0.75;
    if (this.ambientGainNode && this.ctx) {
      this.ambientGainNode.gain.setValueAtTime(0.025 * this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopAmbient();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public playClick(): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08 * this.volume, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  }

  public playSuccess(): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      const startTime = ctx.currentTime + idx * 0.08;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.12 * this.volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  /* Gentle Non-Stressful Soft Chime (Replaces Harsh Error Alarm) */
  public playSoftAttention(): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Gentle warm double-chime (F4 -> A4)
    const notes = [349.23, 440.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

      const startTime = ctx.currentTime + idx * 0.1;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.05 * this.volume, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  public playError(): void {
    this.playSoftAttention();
  }

  public playHintUnlocked(): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);

      const startTime = ctx.currentTime + idx * 0.06;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.1 * this.volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  public playTheoryFocus(): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08 * this.volume, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  public toggleAmbient(): boolean {
    if (this.isAmbientPlaying) {
      this.stopAmbient();
      return false;
    } else {
      this.startAmbient();
      return true;
    }
  }

  public startAmbient(): void {
    if (this.isMuted || this.isAmbientPlaying) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopAmbient();

    this.ambientGainNode = ctx.createGain();
    this.ambientGainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    this.ambientGainNode.gain.linearRampToValueAtTime(0.025 * this.volume, ctx.currentTime + 2.0); // Smooth fade in

    // Generative chord scale: F3, A3, C4, E4
    const freqs = [174.61, 220.0, 261.63, 329.63];
    this.ambientOscillators = freqs.map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(this.ambientGainNode!);
      osc.start();
      return osc;
    });

    this.ambientGainNode.connect(ctx.destination);
    this.isAmbientPlaying = true;

    // Generative pitch modulation every 8 seconds for continuous harmonic evolution
    this.ambientTimer = setInterval(() => {
      if (!this.isAmbientPlaying || !this.ctx) return;
      const targetOsc = this.ambientOscillators[Math.floor(Math.random() * this.ambientOscillators.length)];
      const nextFreq = freqs[Math.floor(Math.random() * freqs.length)];
      if (targetOsc && nextFreq) {
        targetOsc.frequency.exponentialRampToValueAtTime(nextFreq, this.ctx.currentTime + 3.0);
      }
    }, 8000);
  }

  public stopAmbient(): void {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }

    if (!this.isAmbientPlaying || !this.ctx || !this.ambientGainNode) return;

    const ctx = this.ctx;
    const gain = this.ambientGainNode;
    const oscs = [...this.ambientOscillators];

    // Smooth fade out
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.0);

    setTimeout(() => {
      oscs.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch { /* ignore */ }
      });
      try { gain.disconnect(); } catch { /* ignore */ }
    }, 1100);

    this.ambientOscillators = [];
    this.ambientGainNode = null;
    this.isAmbientPlaying = false;
  }

  public getIsAmbientPlaying(): boolean {
    return this.isAmbientPlaying;
  }
}

export const soundEngine = new SoundEngineService();
