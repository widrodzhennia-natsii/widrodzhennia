import { DialogueEmote, SpeechAudioInterface } from './speech-audio.interface';

export interface CharacterVoiceProfile {
  speakerId: string;
  pitchMultiplier: number;
  speedMultiplier?: number;
  toneLabel?: string;
}

class AdvancedFormantSynthesizer implements SpeechAudioInterface {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.75;
  private prebakedBuffers: Map<string, AudioBuffer> = new Map();
  private voiceProfiles: Map<string, CharacterVoiceProfile> = new Map();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private activeAudioEl: HTMLAudioElement | null = null;

  constructor() {
    // Voice profiles are dynamically registered from loaded character/lesson content.
  }

  public registerVoiceProfile(speakerName: string, profile: Partial<CharacterVoiceProfile>): void {
    const key = speakerName.toLowerCase().trim();
    if (!key) return;
    const existing = this.voiceProfiles.get(key) || { speakerId: key, pitchMultiplier: 1.0 };
    this.voiceProfiles.set(key, { ...existing, ...profile });
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number): void {
    const safeVol = Math.min(1, Math.max(0, Number(volume)));
    this.volume = Number.isFinite(safeVol) ? safeVol : 0.75;
    if (this.activeAudioEl) {
      this.activeAudioEl.volume = this.volume;
    }
  }

  /**
   * Pre-bakes formant vowel buffers at startup to eliminate CPU overhead and Garbage Collection lag.
   */
  public bakeBuffers(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (this.prebakedBuffers.size > 0) return;

    const vowels: Record<string, [number, number]> = {
      а: [800, 1250],
      о: [500, 900],
      у: [350, 850],
      і: [280, 2300],
      е: [550, 1750],
      и: [400, 1900],
      default: [450, 1100],
    };

    for (const [vowel, [f1, f2]] of Object.entries(vowels)) {
      try {
        const sampleRate = ctx.sampleRate;
        const duration = 0.07;
        const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        const omega1 = (2 * Math.PI * f1) / sampleRate;
        const omega2 = (2 * Math.PI * f2) / sampleRate;

        for (let i = 0; i < data.length; i++) {
          const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / data.length));
          const wave = Math.sin(omega1 * i) * 0.6 + Math.sin(omega2 * i) * 0.4;
          data[i] = wave * hann * 0.15;
        }

        this.prebakedBuffers.set(vowel, buffer);
      } catch {
        // Fallback if baking fails
      }
    }
  }

  public playSyllable(char: string, speakerName?: string, emote?: DialogueEmote): void {
    this.playMumbleSyllable(char, speakerName, emote);
  }

  /**
   * Plays a prebaked formant vowel sound with pitch jitter and registered character voice multiplier.
   */
  public playMumbleSyllable(char: string, speakerName?: string, emote?: DialogueEmote): void {
    if (this.isMuted || this.volume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (this.prebakedBuffers.size === 0) {
      this.bakeBuffers();
    }

    const lower = char.toLowerCase();
    const vowelKey = ['а', 'о', 'у', 'і', 'е', 'и'].includes(lower) ? lower : 'default';
    const buffer = this.prebakedBuffers.get(vowelKey) || this.prebakedBuffers.get('default');
    if (!buffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      let pitchMult = 1.0;
      if (speakerName) {
        const key = speakerName.toLowerCase().trim();
        const prof =
          this.voiceProfiles.get(key) ||
          Array.from(this.voiceProfiles.entries()).find(([k]) => key.includes(k))?.[1];
        if (prof) {
          pitchMult = prof.pitchMultiplier;
        }
      }

      if (emote === 'joy') pitchMult *= 1.06;
      else if (emote === 'question') pitchMult *= 1.04;
      else if (emote === 'sweat') pitchMult *= 0.94;

      source.playbackRate.value = (0.85 + Math.random() * 0.3) * pitchMult;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7 * this.volume, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);

      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
      };

      source.start();
    } catch {
      // Audio play safety
    }
  }

  public async playSpeechBuffer(source: AudioBuffer | string): Promise<void> {
    if (this.isMuted || this.volume <= 0.01) return;
    this.stop();

    if (typeof source === 'string') {
      if (typeof Audio === 'undefined') return;
      try {
        const el = new Audio(source);
        el.volume = this.volume;
        this.activeAudioEl = el;
        el.onended = () => {
          if (this.activeAudioEl === el) this.activeAudioEl = null;
        };
        await el.play();
      } catch {
        this.activeAudioEl = null;
      }
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const bufferNode = ctx.createBufferSource();
      bufferNode.buffer = source;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this.volume, ctx.currentTime);
      bufferNode.connect(gain);
      gain.connect(ctx.destination);
      this.activeSources.add(bufferNode);
      bufferNode.onended = () => {
        this.activeSources.delete(bufferNode);
      };
      bufferNode.start();
    } catch {
      // Audio buffer safety
    }
  }

  public stop(): void {
    this.activeSources.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore already stopped source
      }
    });
    this.activeSources.clear();

    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.currentTime = 0;
      } catch {
        // Ignore media stop error
      }
      this.activeAudioEl = null;
    }
  }
}

export const advancedFormantSynth = new AdvancedFormantSynthesizer();
export const speechAudio: SpeechAudioInterface = advancedFormantSynth;
