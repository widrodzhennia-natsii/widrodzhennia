import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { PersonalityRadarChart } from '../profile/PersonalityRadarChart';
import { StudentProfile } from '../../core/contracts/profile.contract';
import { useSessionStore } from '../../core/state/useSessionStore';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';
import { useAuthorGateStore } from '../../core/state/useAuthorGateStore';
import {
  BUCKET_LABELS,
  useEconomyAccountsStore,
} from '../../features/economy/useEconomyAccountsStore';
import { CURRENT_APP_VERSION, LAST_UPDATED_DATE } from '../../resources/versionInfo';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StudentProfile;
  onUpdateName: (name: string) => void;
  onImportProfile: (imported: Partial<StudentProfile>) => void;
  onResetProgress: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateName,
  onImportProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'radar' | 'journal' | 'studio'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(profile.studentName);
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  const { setActiveView, openRewardGame } = useSessionStore();
  const { requestAuthorAccess } = useAuthorGateStore();
  const { notify } = useFeedbackStore();
  const { accounts, practical, transactions, transferBetweenBuckets } = useEconomyAccountsStore();
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInput(profile.studentName);
  }, [profile.studentName]);

  const handleOpenAuthorStudio = () => {
    onClose();
    requestAuthorAccess(() => {
      setActiveView('author_studio');
    });
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateName(nameInput.trim());
      setIsEditing(false);
      notify('Ім’я дослідника оновлено.', 'success');
    }
  };

  const handleExportProfile = () => {
    try {
      const jsonStr = JSON.stringify(profile, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nush_profile_${profile.studentName.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Файл профілю збережено на пристрій.', 'success');
    } catch {
      notify('Не вдалося експортувати профіль.', 'error');
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.studentName) {
        notify('Файл не відповідає формату профілю учня.', 'error');
        return;
      }
      onImportProfile(parsed);
      notify(`Профіль «${parsed.studentName}» успішно відновлено!`, 'success');
    } catch {
      notify('Помилка читання JSON-файлу профілю.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Профіль Дослідника та Налаштування" maxWidthClass="max-w-xl">
      <div className="space-y-4">
        {/* Name Header */}
        <div className="p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wide">
              Ім&apos;я дослідника:
            </span>
            {isEditing ? (
              <form onSubmit={handleSaveName} className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="input-field text-xs py-1"
                  required
                />
                <Button type="submit" variant="primary" size="sm">
                  Зберегти
                </Button>
              </form>
            ) : (
              <h3 className="font-extrabold text-base text-[var(--color-primary-dark)]">
                {profile.studentName}
              </h3>
            )}
          </div>

          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              ✏️ Змінити
            </Button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-[var(--color-bg)] rounded border border-[var(--color-border)] text-xs font-bold flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 px-2 rounded transition-all min-w-[78px] cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs font-extrabold'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            🏰 Огляд
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 py-1.5 px-2 rounded transition-all min-w-[85px] cursor-pointer ${
              activeTab === 'accounts'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs font-extrabold'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            💳 Рахунки
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={`flex-1 py-1.5 px-2 rounded transition-all min-w-[78px] cursor-pointer ${
              activeTab === 'radar'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs font-extrabold'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            📊 Радар
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('journal')}
            className={`flex-1 py-1.5 px-2 rounded transition-all min-w-[88px] cursor-pointer ${
              activeTab === 'journal'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs font-extrabold'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            📖 Щоденник
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`flex-1 py-1.5 px-2 rounded transition-all min-w-[100px] cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs font-extrabold'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            🔐 Вчителю
          </button>
        </div>

        {/* TAB 1: OVERVIEW & RESOURCES */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
              <div
                className="p-2.5 border rounded-[var(--radius-sm)]"
                style={{
                  backgroundColor: 'var(--color-warning-bg)',
                  borderColor: 'var(--color-warning-border)',
                  color: 'var(--color-warning-text)',
                }}
              >
                <span className="text-lg block">🪵</span>
                <span className="font-bold tabular-nums">{profile.resources.wood} балів</span>
              </div>
              <div
                className="p-2.5 border rounded-[var(--radius-sm)]"
                style={{
                  backgroundColor: 'var(--color-neutral-bg)',
                  borderColor: 'var(--color-neutral-border)',
                  color: 'var(--color-neutral-text)',
                }}
              >
                <span className="text-lg block">🪨</span>
                <span className="font-bold tabular-nums">{profile.resources.stone} каміння</span>
              </div>
              <div
                className="p-2.5 border rounded-[var(--radius-sm)]"
                style={{
                  backgroundColor: 'var(--color-success-bg)',
                  borderColor: 'var(--color-success-border)',
                  color: 'var(--color-success-text)',
                }}
              >
                <span className="text-lg block">⚡</span>
                <span className="font-bold tabular-nums">{profile.resources.energy} енергії</span>
              </div>
              <div className="p-2.5 border rounded-[var(--radius-sm)] bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]">
                <span className="text-lg block">🔩</span>
                <span className="font-bold tabular-nums">{practical.details} деталей</span>
              </div>
              <div className="p-2.5 border rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)]">
                <span className="text-lg block">🪙</span>
                <span className="font-bold tabular-nums">{practical.tokens} жетонів</span>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-sm)] border border-[var(--color-border)] text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[var(--color-primary-dark)]">🏆 Статистика досягнень:</span>
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  onClick={() => {
                    onClose();
                    openRewardGame('profile_calm_break');
                  }}
                >
                  🎮 Гра-нагорода
                </Button>
              </div>
              <p className="text-[var(--color-muted)] tabular-nums">
                Завершено тем: <strong className="text-[var(--color-text)]">{profile.completedQuestIds.length}</strong> · Виконано вправ: <strong className="text-[var(--color-text)]">{profile.completedTaskIds.length}</strong> · Досвід: <strong className="text-[var(--color-text)]">{profile.totalXp} XP</strong>
              </p>
            </div>
          </div>
        )}

        {/* TAB 1.5: SEPARATED ECONOMY ACCOUNTS */}
        {activeTab === 'accounts' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] space-y-1">
                <div className="font-extrabold text-[var(--primary-dark)]">🪙 Операційний</div>
                <div className="text-lg font-mono font-extrabold tabular-nums text-[var(--text)]">
                  {accounts.operating}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">Витрати на прямі підказки у практиці</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)] space-y-1">
                <div className="font-extrabold">🛡️ Резервний фонд</div>
                <div className="text-lg font-mono font-extrabold tabular-nums">
                  {accounts.reserve}
                </div>
                <p className="text-[11px] opacity-90">Захищений запас безпеки учня</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--hl-border)] bg-[var(--hl-bg)] text-[var(--hl-text)] space-y-1">
                <div className="font-extrabold">📈 Інвестиційний</div>
                <div className="text-lg font-mono font-extrabold tabular-nums">
                  {accounts.investment}
                </div>
                <p className="text-[11px] opacity-90">Довгі проєкти та бонуси</p>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] space-y-2 text-xs">
              <div className="font-extrabold text-[var(--primary-dark)]">Швидкі перекази (крок 10 балів):</div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={accounts.operating < 10}
                  onClick={() => {
                    const r = transferBetweenBuckets('operating', 'reserve', 10);
                    setTransferMsg(r.message);
                  }}
                >
                  🪙 → 🛡️ Відкласти 10 у резерв
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={accounts.operating < 10}
                  onClick={() => {
                    const r = transferBetweenBuckets('operating', 'investment', 10);
                    setTransferMsg(r.message);
                  }}
                >
                  🪙 → 📈 Інвестувати 10
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={accounts.investment < 10}
                  onClick={() => {
                    const r = transferBetweenBuckets('investment', 'operating', 10);
                    setTransferMsg(r.message);
                  }}
                >
                  📈 → 🪙 Поповнити операційний (+10)
                </Button>
              </div>
              {transferMsg && <p className="text-[11px] font-semibold text-[var(--primary-dark)]">{transferMsg}</p>}
              <p className="text-[11px] text-[var(--text-muted)]">
                Анти-фармінг активний: повторне виконання вже закритого блоку без нового варіанта чисел не дублює нарахування.
              </p>
            </div>

            {transactions.length > 0 && (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto p-1">
                <div className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase">Останні операції:</div>
                {[...transactions].reverse().slice(0, 6).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[11px]"
                  >
                    <span className="truncate text-[var(--text)]">
                      {BUCKET_LABELS[tx.bucket]} · {tx.label}
                    </span>
                    <span className="font-mono font-bold tabular-nums shrink-0 text-[var(--primary-dark)]">
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RADAR */}
        {activeTab === 'radar' && (
          <PersonalityRadarChart
            traits={profile.traits}
            gradeNumber={profile.currentGrade}
            profileSeed={profile.profileSeed}
          />
        )}

        {/* TAB 3: JOURNAL */}
        {activeTab === 'journal' && (
          <div className="space-y-2 max-h-[240px] overflow-y-auto p-1">
            {profile.journal && profile.journal.length > 0 ? (
              [...profile.journal].reverse().map((entry) => (
                <div key={entry.id} className="p-3 bg-[var(--color-bg)] rounded border border-[var(--color-border)] text-xs space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-[var(--color-muted)] font-mono">
                    <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                    <span className="font-bold" style={{ color: 'var(--color-success)' }}>
                      +{entry.traitBoosted}
                    </span>
                  </div>
                  <h4 className="font-bold text-[var(--color-text)]">{entry.taskTitle}</h4>
                  <p className="text-[var(--color-muted)] italic">{entry.reflectionText}</p>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-[var(--color-muted)] bg-[var(--color-bg)] rounded border border-[var(--color-border)]">
                📖 Щоденник поки що порожній. Виконуйте практичні вправи та завершуйте уроки, щоб фіксувати свої досягнення.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PROTECTED AUTHOR STUDIO PORTAL */}
        {activeTab === 'studio' && (
          <div className="space-y-3 p-4 bg-[var(--hl-bg)] border border-[var(--hl-border)] rounded-[var(--radius-sm)]">
            <h4 className="text-sm font-extrabold text-[var(--hl-text)]">
              🔐 Захищений простір вчителя та автора
            </h4>
            <p className="text-xs text-[var(--text)] leading-relaxed">
              Створення, імпорт, експорт, редагування курсів і скидання прогресу перенесено до захищеної Студії автора, щоб учень випадково не видалив матеріали або досягнення.
            </p>
            <Button type="button" variant="primary" size="sm" onClick={handleOpenAuthorStudio}>
              🛠️ Відкрити Студію автора
            </Button>
          </div>
        )}

        {/* Export / Import Footer (safe non-destructive actions only) */}
        <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportProfile} className="text-xs font-bold">
              💾 Експорт (JSON)
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              className="text-xs font-bold"
            >
              📥 Імпорт профілю
            </Button>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleOpenAuthorStudio}>
            🔐 Студія автора
          </Button>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span>Версія платформи: v{CURRENT_APP_VERSION} ({LAST_UPDATED_DATE})</span>
          <span>Код: MPL-2.0 · Контент: CC BY-NC-SA 4.0</span>
        </div>
      </div>
    </Modal>
  );
};
