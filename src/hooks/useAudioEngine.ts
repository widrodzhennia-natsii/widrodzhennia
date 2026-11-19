import { useState, useCallback, useEffect } from 'react';
import { soundEngine } from '../services/soundEngineService';
import { speechAudio } from '../core/audio/formant-synth';
import { musicalSynth } from '../core/audio/musical-synth';
import { useSettingsStore } from '../core/state/useSettingsStore';

export function useAudioEngine() {
  const [isMuted, setIsMuted] = useState(soundEngine.getIsMuted());
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(soundEngine.getIsAmbientPlaying());
  const volume = useSettingsStore((s) => s.volume);
  const setSettingsVolume = useSettingsStore((s) => s.setVolume);

  useEffect(() => {
    soundEngine.setVolume(volume);
    speechAudio.setVolume(volume);
    musicalSynth.setVolume(volume);
  }, [volume]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
    speechAudio.setMuted(nextMuted);
    musicalSynth.setMuted(nextMuted);
    setIsAmbientPlaying(soundEngine.getIsAmbientPlaying());
  }, [isMuted]);

  const toggleAmbient = useCallback(() => {
    const active = soundEngine.toggleAmbient();
    setIsAmbientPlaying(active);
  }, []);

  const playClick = useCallback(() => soundEngine.playClick(), []);
  const playSuccess = useCallback(() => soundEngine.playSuccess(), []);
  const playError = useCallback(() => soundEngine.playError(), []);
  const playHintUnlocked = useCallback(() => soundEngine.playHintUnlocked(), []);
  const playTheoryFocus = useCallback(() => soundEngine.playTheoryFocus(), []);

  return {
    isMuted,
    isAmbientPlaying,
    volume,
    setVolume: setSettingsVolume,
    toggleMute,
    toggleAmbient,
    playClick,
    playSuccess,
    playError,
    playHintUnlocked,
    playTheoryFocus,
    speechAudio,
  };
}
