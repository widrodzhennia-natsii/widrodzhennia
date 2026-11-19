import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { RadialThemeMenu } from './RadialThemeMenu';
import { THEME_OPTIONS, useThemeStore } from '../../core/state/useThemeStore';
import { useSettingsStore } from '../../core/state/useSettingsStore';
import { useLayoutPrefsStore } from '../../core/state/useLayoutPrefsStore';
import { useAuthorGateStore } from '../../core/state/useAuthorGateStore';
import { useSessionStore } from '../../core/state/useSessionStore';
import { useMusicStudioStore } from '../../features/music-studio/useMusicStudioStore';
import { ActiveView } from '../../app/appTypes';

interface HeaderProps {
  resources: { wood: number; stone: number; energy: number };
  isMuted: boolean;
  isAmbientPlaying: boolean;
  onToggleMute: () => void;
  onToggleAmbient: () => void;
  onOpenProfile: () => void;
  onOpenSelector: () => void;
  activeView: ActiveView;
}

export const Header: React.FC<HeaderProps> = ({
  resources,
  isMuted,
  isAmbientPlaying,
  onToggleMute,
  onToggleAmbient,
  onOpenProfile,
  onOpenSelector,
  activeView,
}) => {
  const isGameMode = activeView === 'game';
  const { themeMode, setThemeMode } = useThemeStore();
  const {
    typingSpeedMs,
    volume,
    captchaDurationSec,
    captchaErrorThreshold,
    captchaMaxCycles,
    setTypingSpeedMs,
    setVolume,
    setCaptchaDurationSec,
    setCaptchaErrorThreshold,
    setCaptchaMaxCycles,
  } = useSettingsStore();
  const { prolongedAnimations, toggleProlongedAnimations } = useLayoutPrefsStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsWrapRef = useRef<HTMLDivElement | null>(null);
  const { requestAuthorAccess } = useAuthorGateStore();
  const { setActiveView, openGlossary, selectedSubjectId } = useSessionStore();
  const { setStudioModalOpen } = useMusicStudioStore();

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (settingsWrapRef.current && !settingsWrapRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSettingsOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isSettingsOpen]);

  const getBackTitle = () => {
    switch (activeView) {
      case 'game':
        return 'Повернутися до тем предмета';
      case 'subject_hub':
      case 'chapter_map':
        return 'Повернутися до предметів';
      case 'bookshelf':
        return 'Повернутися до класів';
      default:
        return 'На головну';
    }
  };

  return (
    <header className="relative">
      <div className="app-header-bar">
        {/* Compact Brand / Navigation Home */}
        <button
          type="button"
          onClick={onOpenSelector}
          className="header-brand-btn min-w-0"
          title={getBackTitle()}
          aria-label={getBackTitle()}
        >
          {activeView !== 'doors' && <span aria-hidden="true">←</span>}
          <span aria-hidden="true">🏛️</span>
          <span className="hidden sm:inline truncate">НУШ Навчальний Простір</span>
          <span className="sm:hidden">НУШ</span>
        </button>

        {/* Compact Resource Strip in Game Mode */}
        {isGameMode && (
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" aria-label="Ресурси учня">
            <span className="header-resource-pill" title="Деревина">
              <span>🪵</span>
              <span>{resources.wood}</span>
            </span>
            <span className="header-resource-pill" title="Камінь">
              <span>🪨</span>
              <span>{resources.stone}</span>
            </span>
            <span className="header-resource-pill" title="Енергія">
              <span>⚡</span>
              <span>{resources.energy}</span>
            </span>
          </div>
        )}

        {/* Single-Row Right Controls: Radial Theme Picker + Glossary + Profile + Unified [⚙️] Settings */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0" ref={settingsWrapRef}>
          <RadialThemeMenu />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStudioModalOpen(true)}
            aria-label="Вільна музична майстерня"
            title="Вільна музична майстерня"
            className="hidden sm:inline-flex"
          >
            <span>🎼</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openGlossary('', selectedSubjectId)}
            aria-label="Офлайн-довідник орфограм, формул та Фейнман SRS"
            title="Офлайн-довідник і повторення"
          >
            <span>📚</span>
            <span className="hidden md:inline">Довідник</span>
          </Button>

          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={onOpenProfile}
            aria-label="Відкрити профіль учня"
          >
            <span>👤</span>
            <span className="hidden sm:inline">Профіль</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            aria-expanded={isSettingsOpen}
            aria-label="Налаштування інтерфейсу та звуку"
            title="Налаштування"
          >
            <span>⚙️</span>
            <span className="hidden md:inline">Налаштування</span>
          </Button>

          {isSettingsOpen && (
            <div
              className="settings-popover"
              role="dialog"
              aria-label="Панель налаштувань"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
                  ⚙️ Налаштування
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Закрити налаштування"
                >
                  ✕
                </Button>
              </div>

              {/* 1. Theme Palettes (8 global themes) */}
              <div className="settings-section">
                <div className="settings-section-title">Палітра оформлення (8 тем)</div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Світлі комфортні
                    </div>
                    <div className="theme-choice-grid">
                      {THEME_OPTIONS.filter((t) => t.group === 'light').map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setThemeMode(opt.id)}
                          className={`theme-choice-btn ${
                            themeMode === opt.id ? 'theme-choice-btn--active' : ''
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {themeMode === opt.id && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Темні та монохром (0% кольору)
                    </div>
                    <div className="theme-choice-grid">
                      {THEME_OPTIONS.filter((t) => t.group !== 'light').map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setThemeMode(opt.id)}
                          className={`theme-choice-btn ${
                            themeMode === opt.id ? 'theme-choice-btn--active' : ''
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {themeMode === opt.id && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Audio & Volume */}
              <div className="settings-section space-y-2.5">
                <div className="settings-section-title">Звук та музика</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant={isAmbientPlaying ? 'primary' : 'outline'}
                    size="sm"
                    onClick={onToggleAmbient}
                  >
                    {isAmbientPlaying ? '🎵 Музика: Увімк' : '🔇 Музика: Вимк'}
                  </Button>
                  <Button
                    type="button"
                    variant={isMuted ? 'outline' : 'primary'}
                    size="sm"
                    onClick={onToggleMute}
                  >
                    {isMuted ? '🔕 Ефекти: Вимк' : '🔔 Ефекти: Увімк'}
                  </Button>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Гучність аудіо</span>
                    <span className="tabular-nums font-mono">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="settings-range"
                    aria-label="Гучність аудіо"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setStudioModalOpen(true);
                  }}
                >
                  🎼 Відкрити Вільну музичну майстерню
                </Button>
              </div>

              {/* 3. Dialogue Typing Speed */}
              <div className="settings-section">
                <div className="settings-section-title">Читання та діалоги</div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Темп друку тексту</span>
                  <span className="tabular-nums font-mono">{typingSpeedMs} мс</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  step="5"
                  value={typingSpeedMs}
                  onChange={(e) => setTypingSpeedMs(Number(e.target.value))}
                  className="settings-range"
                  aria-label="Темп друку тексту"
                />
                <div className="flex justify-between text-[10px] font-semibold text-[var(--text-muted)]">
                  <span>Швидше</span>
                  <span>Спокійніше</span>
                </div>
              </div>

              {/* 4. Cognitive Captcha & Hints Tuning */}
              <div className="settings-section space-y-2.5">
                <div className="settings-section-title">Когнітивна пауза та підказки</div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Таймер роздумів</span>
                    <span className="tabular-nums font-mono">{captchaDurationSec} с</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="45"
                    step="5"
                    value={captchaDurationSec}
                    onChange={(e) => setCaptchaDurationSec(Number(e.target.value))}
                    className="settings-range"
                    aria-label="Тривалість когнітивної паузи"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Поріг повторних помилок</span>
                    <span className="tabular-nums font-mono">{captchaErrorThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={captchaErrorThreshold}
                    onChange={(e) => setCaptchaErrorThreshold(Number(e.target.value))}
                    className="settings-range"
                    aria-label="Поріг повторних помилок"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Циклів до альтернатив</span>
                    <span className="tabular-nums font-mono">{captchaMaxCycles}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={captchaMaxCycles}
                    onChange={(e) => setCaptchaMaxCycles(Number(e.target.value))}
                    className="settings-range"
                    aria-label="Кількість циклів до альтернативних пропозицій"
                  />
                </div>
              </div>

              {/* 4.5 Animation & Energy Saving Preferences */}
              <div className="settings-section space-y-2">
                <div className="settings-section-title">Енергія та анімації полотна</div>
                <label className="flex items-center justify-between gap-2 text-xs font-bold cursor-pointer">
                  <span>Подовжені сповільнені анімації</span>
                  <input
                    type="checkbox"
                    checked={prolongedAnimations}
                    onChange={toggleProlongedAnimations}
                    className="accent-[var(--accent)] w-4 h-4 cursor-pointer"
                  />
                </label>
                <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                  Неактивні сцени автоматично переходять у сон (0% CPU).
                </p>
              </div>

              {/* 5. Protected Author Studio Access */}
              <div className="settings-section pt-2 border-t border-[var(--border)]">
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    requestAuthorAccess(() => {
                      setActiveView('author_studio');
                    });
                  }}
                >
                  🔐 Студія автора (для вчителів)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
