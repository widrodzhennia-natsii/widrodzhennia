import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { HistoryQuestion } from './HistoryQuestion';
import { CatchFormulaMiniGame } from './CatchFormulaMiniGame';
import {
  ConceptMatchMiniGame,
  PatternSequenceMiniGame,
  FocusSortMiniGame,
} from './CalmMiniGames';
import { HintGateMode, HintGateQuestion } from '../../hooks/useHintGate';
import { BruteForceReason } from '../../hooks/useAttemptTracker';
import { RichBlockText } from '../ui/RichBlockText';
import { VisualAssociativeCaptcha } from '../../features/captcha/VisualAssociativeCaptcha';
import {
  DEFAULT_HINT_OPERATING_COST,
  useEconomyAccountsStore,
} from '../../features/economy/useEconomyAccountsStore';

interface HintGateProps {
  isOpen: boolean;
  onClose: () => void;
  mode: HintGateMode;
  onChangeMode: (mode: HintGateMode) => void;
  blockId: string;
  subjectId?: string;
  hintText: string;
  question: HintGateQuestion;
  customSteps?: string[];
  isUnlocked: boolean;
  onUnlock: () => void;
  playHintUnlockedSound?: () => void;
  captchaDurationSec: number;
  captchaCyclesCompleted: number;
  captchaMaxCycles: number;
  bruteForceReason: BruteForceReason;
  onCompleteCaptcha: () => void;
  canReturnToTheory: boolean;
  onJumpToTheory?: () => void;
  resources: { wood: number; stone: number; energy: number };
  onSpendForHint?: (cost: { wood?: number; energy?: number }) => boolean;
}

type MiniGameKind = 'algorithm' | 'pairs' | 'pattern' | 'sort';
type AlternativesTab = 'resources' | 'minigame' | 'question';

export const HintGate: React.FC<HintGateProps> = ({
  isOpen,
  onClose,
  mode,
  onChangeMode,
  blockId,
  subjectId = '',
  hintText,
  question,
  customSteps,
  isUnlocked,
  onUnlock,
  playHintUnlockedSound,
  captchaDurationSec,
  captchaCyclesCompleted,
  captchaMaxCycles,
  bruteForceReason,
  onCompleteCaptcha,
  canReturnToTheory,
  onJumpToTheory,
  resources,
  onSpendForHint,
}) => {
  const [unlockedState, setUnlockedState] = useState(isUnlocked);
  const [activeTab, setActiveTab] = useState<AlternativesTab>('resources');
  const [miniGameKind, setMiniGameKind] = useState<MiniGameKind>('pairs');
  const [resourceFeedback, setResourceFeedback] = useState<string | null>(null);

  const { accounts, spendOperatingForHint } = useEconomyAccountsStore();

  useEffect(() => {
    setUnlockedState(isUnlocked);
    setResourceFeedback(null);
    if (isOpen) {
      setActiveTab(mode === 'alternatives' ? 'minigame' : 'resources');
    }
  }, [isUnlocked, isOpen, question.id, mode]);

  const handleSuccess = () => {
    setUnlockedState(true);
    onUnlock();
    playHintUnlockedSound?.();
  };

  const handleOperatingUnlock = () => {
    const res = spendOperatingForHint(
      DEFAULT_HINT_OPERATING_COST,
      'Пряма підказка до завдання'
    );
    if (res.ok) {
      setResourceFeedback(null);
      handleSuccess();
    } else {
      setResourceFeedback(
        `На операційному рахунку недостатньо балів (${accounts.operating} із ${DEFAULT_HINT_OPERATING_COST}). Резервний фонд (${accounts.reserve}) захищено — перегляньте теорію безкоштовно (0 ₴) або відкрийте підказку через міні-гру.`
      );
    }
  };

  const handleResourceUnlock = (cost: { wood?: number; energy?: number }, label: string) => {
    if (!onSpendForHint) return;
    const paid = onSpendForHint(cost);
    if (paid) {
      setResourceFeedback(null);
      handleSuccess();
    } else {
      setResourceFeedback(
        `Недостатньо ресурсу для обміну (${label}). Оберіть повернення до теорії (0 ₴) або спокійну міні-гру.`
      );
    }
  };

  const handleConfirmCaptcha = () => {
    onCompleteCaptcha();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={mode === 'captcha' ? () => {} : onClose}
      title={
        unlockedState
          ? 'Відкрита підказка'
          : mode === 'captcha'
          ? 'Когнітивна пауза осмислення'
          : 'Підказки та безкоштовний конспект'
      }
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {/* Always-free return to nearest theory rule */}
        {canReturnToTheory && onJumpToTheory && (
          <div className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-border)] rounded-[var(--radius-sm)] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--ok-text)]">
              📖 Повернення до правила теорії завжди безкоштовне (0 ₴ · чернетка збережеться)
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onJumpToTheory();
              }}
            >
              Переглянути теорію (0 ₴)
            </Button>
          </div>
        )}

        {unlockedState ? (
          <div className="p-4 bg-[var(--hl-bg)] border border-[var(--hl-border)] rounded-[var(--radius-sm)] space-y-2">
            <h4 className="text-xs font-extrabold text-[var(--hl-text)] uppercase tracking-wide">
              💡 Підказка відкрита:
            </h4>
            <div className="text-sm font-semibold text-[var(--text)] leading-relaxed">
              <RichBlockText text={hintText} />
            </div>
            {question.explanation && question.explanation !== hintText && (
              <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                <RichBlockText text={question.explanation} />
              </div>
            )}
            <div className="pt-2">
              <Button type="button" variant="primary" size="sm" onClick={onClose} className="w-full">
                Повернутися до завдання
              </Button>
            </div>
          </div>
        ) : mode === 'captcha' ? (
          <VisualAssociativeCaptcha
            blockId={blockId || question.id || 'hint_captcha'}
            subjectId={subjectId}
            durationSec={captchaDurationSec}
            bruteForceReason={bruteForceReason}
            captchaCyclesCompleted={captchaCyclesCompleted}
            captchaMaxCycles={captchaMaxCycles}
            onComplete={handleConfirmCaptcha}
            onSwitchToAlternatives={() => onChangeMode('alternatives')}
          />
        ) : (
          <div className="space-y-3">
            {mode === 'alternatives' && (
              <div className="status-panel status-panel--warning text-xs">
                Ви вже доклали чимало зусиль! Оберіть спосіб відкрити підказку: спокійну міні-гру без витрат, контрольне запитання або оплату з операційного рахунку.
              </div>
            )}

            {/* Path selector tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('resources')}
                className={`flex-1 py-1.5 px-2 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'resources'
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                🪙 Пряма підказка ({DEFAULT_HINT_OPERATING_COST})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('minigame')}
                className={`flex-1 py-1.5 px-2 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'minigame'
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                🧩 Міні-гра (0 ₴)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('question')}
                className={`flex-1 py-1.5 px-2 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'question'
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                📝 Запитання
              </button>
            </div>

            {activeTab === 'resources' && (
              <div className="p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--text)]">
                  <span>Операційний бюджет для прямої підказки</span>
                  <span className="font-mono tabular-nums text-[var(--primary-dark)]">
                    Операційний: {accounts.operating} · 🛡️ Резерв: {accounts.reserve}
                  </span>
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Пряма підказка списується виключно з операційного рахунку ({DEFAULT_HINT_OPERATING_COST} опер.) або базових ресурсів. Ваш резервний фонд не витрачається автоматично, а повернення до конспекту завжди безкоштовне.
                </p>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={accounts.operating < DEFAULT_HINT_OPERATING_COST}
                  onClick={handleOperatingUnlock}
                  className="w-full"
                >
                  🪙 Відкрити пряму підказку за {DEFAULT_HINT_OPERATING_COST} балів операційного бюджету
                </Button>

                <div className="pt-2 border-t border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
                    <span>Або обміняти базові ресурси:</span>
                    <span className="font-mono tabular-nums">
                      🪵 {resources.wood} · ⚡ {resources.energy}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={resources.energy < 15}
                      onClick={() => handleResourceUnlock({ energy: 15 }, '15⚡')}
                    >
                      ⚡ Обміняти 15 енергії
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={resources.wood < 20}
                      onClick={() => handleResourceUnlock({ wood: 20 }, '20🪵')}
                    >
                      🪵 Обміняти 20 деревини
                    </Button>
                  </div>
                </div>

                {resourceFeedback && (
                  <div className="status-panel status-panel--warning text-xs">{resourceFeedback}</div>
                )}
              </div>
            )}

            {activeTab === 'minigame' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant={miniGameKind === 'pairs' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setMiniGameKind('pairs')}
                  >
                    🔗 Сенсові пари
                  </Button>
                  <Button
                    type="button"
                    variant={miniGameKind === 'pattern' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setMiniGameKind('pattern')}
                  >
                    🔢 Логічний патерн
                  </Button>
                  <Button
                    type="button"
                    variant={miniGameKind === 'sort' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setMiniGameKind('sort')}
                  >
                    ⚖️ Баланс уваги
                  </Button>
                  <Button
                    type="button"
                    variant={miniGameKind === 'algorithm' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setMiniGameKind('algorithm')}
                  >
                    🧩 Алгоритм
                  </Button>
                </div>

                {miniGameKind === 'pairs' && (
                  <ConceptMatchMiniGame
                    onUnlockHint={handleSuccess}
                    playSuccessSound={playHintUnlockedSound}
                  />
                )}
                {miniGameKind === 'pattern' && (
                  <PatternSequenceMiniGame
                    onUnlockHint={handleSuccess}
                    playSuccessSound={playHintUnlockedSound}
                  />
                )}
                {miniGameKind === 'sort' && (
                  <FocusSortMiniGame
                    onUnlockHint={handleSuccess}
                    playSuccessSound={playHintUnlockedSound}
                  />
                )}
                {miniGameKind === 'algorithm' && (
                  <CatchFormulaMiniGame
                    steps={customSteps}
                    onUnlockHint={handleSuccess}
                    playSuccessSound={playHintUnlockedSound}
                  />
                )}
              </div>
            )}

            {activeTab === 'question' && (
              <HistoryQuestion question={question} onSuccess={handleSuccess} />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
