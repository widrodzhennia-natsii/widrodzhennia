import React from 'react';
import { HintGate } from '../../components/learning/HintGate';
import { ProfileModal } from '../../components/layout/ProfileModal';
import { DropZoneModal } from '../importer/DropZoneModal';
import { AdultGateModal } from '../../components/auth/AdultGateModal';
import { OfflineGlossaryModal } from '../glossary/OfflineGlossaryModal';
import { RewardMiniGameModal } from '../rewards/RewardMiniGameModal';
import { Modal } from '../../components/ui/Modal';
import { MusicStudioWorkspace } from '../music-studio/MusicStudioWorkspace';
import { useMusicStudioStore } from '../music-studio/useMusicStudioStore';
import { LifeCartridgesModal } from '../life-cartridges/LifeCartridgesModal';
import { CoopTableView } from '../coop/CoopTableView';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { useHintGate, defaultNeutralHint } from '../../hooks/useHintGate';
import { useProfileStore } from '../../core/state/useProfileStore';
import { useSettingsStore } from '../../core/state/useSettingsStore';
import { useAttemptTracker } from '../../hooks/useAttemptTracker';
import { useSessionStore } from '../../core/state/useSessionStore';

export const ModalsContainer: React.FC = () => {
  const nav = useAppNavigation();
  const audio = useAudioEngine();
  const hintGate = useHintGate();
  const { captchaDurationSec, captchaMaxCycles } = useSettingsStore();
  const { byBlock, recordCaptchaCompleted } = useAttemptTracker();
  const { isStudioModalOpen, setStudioModalOpen } = useMusicStudioStore();
  const {
    currentStepIndex,
    jumpToTheoryAndRemember,
    isGlossaryOpen,
    glossaryInitialQuery,
    glossarySubjectId,
    closeGlossary,
    selectedSubjectId,
    isRewardGameOpen,
    rewardGameSourceKey,
    closeRewardGame,
    isCartridgesOpen,
    cartridgesInitialTab,
    closeCartridges,
    isCoopOpen,
    closeCoop,
  } = useSessionStore();

  const {
    profile,
    setStudentName,
    unlockHintForTask,
    spendResources,
    addTraitPoints,
    importProfile,
    resetProfile,
  } = useProfileStore();

  const currentQuestion =
    hintGate.activeHints[hintGate.currentQuestionIndex] ||
    hintGate.activeHints[0] ||
    defaultNeutralHint;

  const isHintUnlockedForTask = Boolean(
    hintGate.activeBlockId && profile.unlockedHintTaskIds.includes(hintGate.activeBlockId)
  );

  const attemptStats = hintGate.activeBlockId ? byBlock[hintGate.activeBlockId] : undefined;

  return (
    <>
      <HintGate
        isOpen={hintGate.isOpen}
        onClose={hintGate.closeGate}
        mode={hintGate.mode}
        onChangeMode={hintGate.setMode}
        blockId={hintGate.activeBlockId}
        subjectId={hintGate.subjectId || selectedSubjectId}
        hintText={hintGate.activeHintText || currentQuestion.explanation || 'Перевірте умову та формулу уроку.'}
        question={currentQuestion}
        isUnlocked={isHintUnlockedForTask}
        onUnlock={() => {
          if (hintGate.activeBlockId) {
            unlockHintForTask(hintGate.activeBlockId);
          }
        }}
        playHintUnlockedSound={audio.playHintUnlocked}
        captchaDurationSec={captchaDurationSec}
        captchaCyclesCompleted={attemptStats?.captchaCyclesCompleted ?? 0}
        captchaMaxCycles={captchaMaxCycles}
        bruteForceReason={hintGate.bruteForceReason ?? attemptStats?.bruteForceReason ?? null}
        onCompleteCaptcha={() => {
          if (hintGate.activeBlockId) {
            recordCaptchaCompleted(hintGate.activeBlockId);
          }
          addTraitPoints('selfRegulation', 5);
        }}
        canReturnToTheory={
          hintGate.theoryStepIndex !== null && hintGate.theoryStepIndex >= 0
        }
        onJumpToTheory={() => {
          if (hintGate.theoryStepIndex !== null && hintGate.theoryStepIndex >= 0) {
            addTraitPoints('curiosity', 3);
            jumpToTheoryAndRemember(hintGate.theoryStepIndex, currentStepIndex);
          }
        }}
        resources={profile.resources}
        onSpendForHint={(cost) => spendResources(cost)}
      />

      <ProfileModal
        isOpen={nav.isProfileOpen}
        onClose={() => nav.toggleProfile(false)}
        profile={profile}
        onUpdateName={setStudentName}
        onImportProfile={importProfile}
        onResetProgress={resetProfile}
      />

      <DropZoneModal
        isOpen={nav.isYamlImporterOpen}
        onClose={() => nav.toggleYamlImporter(false)}
      />

      <OfflineGlossaryModal
        isOpen={isGlossaryOpen}
        initialQuery={glossaryInitialQuery}
        initialSubjectId={glossarySubjectId}
        onClose={closeGlossary}
      />

      <RewardMiniGameModal
        isOpen={isRewardGameOpen}
        sourceKey={rewardGameSourceKey}
        onClose={closeRewardGame}
      />

      <Modal
        isOpen={isStudioModalOpen}
        onClose={() => setStudioModalOpen(false)}
        title="🎼 Вільна музична майстерня"
        fullScreen={true}
      >
        <div className="max-w-[1440px] mx-auto w-full">
          <MusicStudioWorkspace />
        </div>
      </Modal>

      <LifeCartridgesModal
        isOpen={isCartridgesOpen}
        initialTab={cartridgesInitialTab}
        onClose={closeCartridges}
      />

      <Modal
        isOpen={isCoopOpen}
        onClose={closeCoop}
        title="🤝 Сімейний Co-op «Пілот і Штурман» та Командний стіл"
        fullScreen={true}
      >
        <div className="max-w-[1440px] mx-auto w-full">
          <CoopTableView />
        </div>
      </Modal>

      <AdultGateModal />
    </>
  );
};
