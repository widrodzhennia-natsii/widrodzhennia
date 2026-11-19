/**
 * Clean audio interface separating Dialogue UI from underlying synthesis or
 * pre-recorded/buffered voice playback engines.
 */

export type DialogueEmote = 'idea' | 'sweat' | 'question' | 'joy';

export interface SpeechAudioInterface {
  /**
   * Plays a short syllable cue for typewriter character rendering.
   */
  playSyllable(char: string, speaker?: string, emote?: DialogueEmote): void;

  /**
   * Reserved adapter hook for full speech AudioBuffer / audio URL playback on later stages.
   */
  playSpeechBuffer(source: AudioBuffer | string, speaker?: string): Promise<void>;

  /**
   * Immediately stops any currently playing syllable or speech buffer.
   */
  stop(): void;

  /**
   * Sets normalized output volume (0.0 to 1.0).
   */
  setVolume(volume: number): void;

  /**
   * Toggles mute state.
   */
  setMuted(muted: boolean): void;

  /**
   * Returns current mute state.
   */
  getIsMuted(): boolean;
}
