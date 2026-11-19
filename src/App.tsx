import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { MainHubRouter } from './features/shell/MainHubRouter';
import { ModalsContainer } from './features/shell/ModalsContainer';
import { FeedbackHost } from './components/ui/FeedbackHost';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useSessionStore } from './core/state/useSessionStore';
import { useProfileStore } from './core/state/useProfileStore';
import { CrashGuard } from './core/storage/crash-guard';

export default function App() {
  const audio = useAudioEngine();
  const nav = useAppNavigation();
  const { activeView, currentQuestId, currentStepIndex } = useSessionStore();
  const { profile } = useProfileStore();

  useEffect(() => {
    CrashGuard.init(() => ({
      questId: currentQuestId || 'none',
      stepIndex: currentStepIndex,
      sandboxState: {},
      timestamp: Date.now(),
    }));
  }, [currentQuestId, currentStepIndex]);

  return (
    <AppShell
      resources={profile.resources}
      isMuted={audio.isMuted}
      isAmbientPlaying={audio.isAmbientPlaying}
      onToggleMute={audio.toggleMute}
      onToggleAmbient={audio.toggleAmbient}
      onOpenProfile={() => nav.toggleProfile(true)}
      onOpenSelector={() => nav.navigateBack()}
      activeView={activeView}
    >
      <MainHubRouter />
      <ModalsContainer />
      <FeedbackHost />
    </AppShell>
  );
}
