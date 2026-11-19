import React from 'react';
import { Header } from './Header';
import { ProgressBar } from './ProgressBar';
import { BottomDock } from './BottomDock';
import { ActiveView } from '../../app/appTypes';
import { useActiveLessonSession } from '../../hooks/useActiveLessonSession';
import { useLayoutPrefsStore } from '../../core/state/useLayoutPrefsStore';

interface AppShellProps {
  resources: { wood: number; stone: number; energy: number };
  isMuted: boolean;
  isAmbientPlaying: boolean;
  onToggleMute: () => void;
  onToggleAmbient: () => void;
  onOpenProfile: () => void;
  onOpenSelector: () => void;
  activeView: ActiveView;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  resources,
  isMuted,
  isAmbientPlaying,
  onToggleMute,
  onToggleAmbient,
  onOpenProfile,
  onOpenSelector,
  activeView,
  children,
}) => {
  const lesson = useActiveLessonSession();
  const isDocumentExpanded = useLayoutPrefsStore((s) => s.isDocumentExpanded);

  return (
    <div className="app-shell">
      <div className="sticky-top-chrome">
        <Header
          resources={resources}
          isMuted={isMuted}
          isAmbientPlaying={isAmbientPlaying}
          onToggleMute={onToggleMute}
          onToggleAmbient={onToggleAmbient}
          onOpenProfile={onOpenProfile}
          onOpenSelector={onOpenSelector}
          activeView={activeView}
        />

        {activeView === 'game' && (
          <ProgressBar
            currentStep={lesson.safeCurrentStep}
            totalSteps={lesson.safeTotal}
            chapterTitle={lesson.chapterTitle}
            steps={lesson.steps}
            completedBlockIds={lesson.completedBlockIds}
            onSelectStep={lesson.navigateAndScrollToStep}
            effectiveDensity={lesson.effectiveDensity}
            cascadeStart={lesson.cascadeStart}
            cascadeEnd={lesson.cascadeEnd}
            docScrollPercent={lesson.docScrollPercent}
            docActiveStepIndex={lesson.docActiveStepIndex}
          />
        )}
      </div>

      <main
        className={`main-container ${
          activeView === 'game' && isDocumentExpanded ? 'main-container--document-expanded' : ''
        }`}
      >
        {children}
      </main>

      <BottomDock
        activeView={activeView}
        onBackView={onOpenSelector}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
};
