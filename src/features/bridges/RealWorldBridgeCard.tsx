import React, { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useProfileStore } from '../../core/state/useProfileStore';

export interface RealWorldBridgeSpec {
  kind: 'ask_teacher' | 'family_mission';
  prompt: string;
}

interface RealWorldBridgeCardProps {
  questId: string;
  questTitle?: string;
  subjectId?: string;
  customTeacherHook?: string;
  customFamilyMission?: string;
}

function getContextualBridges(
  subjectId: string,
  questTitle: string,
  customTeacher?: string,
  customFamily?: string
): { teacherPrompts: string[]; familyMission: string; familySteps: string[] } {
  const subj = subjectId.toLowerCase();

  if (subj.includes('math')) {
    return {
      teacherPrompts: [
        customTeacher ||
          `Які нестандартні реальні конструкції з теми «${questTitle}» трапляються у будівництві чи архітектурі нашого міста?`,
        'Чи завжди виміри на кресленні подають в однакових одиницях, як перевіряють інженери похибку рулетки?',
      ],
      familyMission:
        customFamily ||
        'Візьміть разом із рідними рулетку або лінійку та виміряйте дверний отвір, стіл або вікно вдома, обчисливши периметр і площу у сантиметрах.',
      familySteps: [
        'Виміряти ширину та висоту реального предмета вдома',
        'Перевести метри у сантиметри та перевірити суму на калькуляторі або у чорновику',
        'Порівняти результат із приблизною оцінкою «на око»',
      ],
    };
  }

  if (subj.includes('ukrainian')) {
    return {
      teacherPrompts: [
        customTeacher ||
          `Які живі приклади орфограм із теми «${questTitle}» найчастіше плутають у рекламі або вивісках?`,
        'Як швидко знаходити перевірне слово для іншомовних запозичень?',
      ],
      familyMission:
        customFamily ||
        'Разом із родиною знайдіть 3 цікаві слова на етикетках продуктів або міських вивісках і перевірте кожну орфограму чи будову слова.',
      familySteps: [
        'Обрати 3 вивіски, заголовки або написи на пакованні',
        'Розібрати одне слово за будовою (префікс, корінь, суфікс, закінчення)',
        'Перевірити сумнівні приголосні/голосні спільнокореневим словом',
      ],
    };
  }

  if (subj.includes('history')) {
    return {
      teacherPrompts: [
        customTeacher ||
          `Які артефакти або свідчення збереглися з подій теми «${questTitle}» у музеях України?`,
        'Який альтернативний варіант розвитку подій могли обрати тогочасні діячі?',
      ],
      familyMission:
        customFamily ||
        'Розпитайте старших у родині про одну пам’ятну дату чи сімейну історію вашого краю та запишіть 2 ключові факти на часовій стрічці.',
      familySteps: [
        'Поставити 2 уточнювальні запитання про історію родини або громади',
        'Зафіксувати точний рік і причинно-наслідковий зв’язок події',
      ],
    };
  }

  if (subj.includes('cyber') || subj.includes('info')) {
    return {
      teacherPrompts: [
        customTeacher ||
          `Як на практиці розпізнати нові схеми маніпуляцій у темі «${questTitle}» без технічних інструментів?`,
        'Які налаштування приватності варто перевірити на домашньому роутері чи смартфоні?',
      ],
      familyMission:
        customFamily ||
        'Проведіть короткий «сімейний аудит безпеки»: перевірте разом із батьками налаштування 2FA на важливому акаунті або обговоріть правило кодового слова.',
      familySteps: [
        'Перевірити наявність двоетапного захисту на пошті/месенджері',
        'Домовитися про родинне контрольне запитання на випадок підозрілих дзвінків',
      ],
    };
  }

  return {
    teacherPrompts: [
      customTeacher ||
        `Як знання з теми «${questTitle}» допомагають у реальних професіях або повсякденних рішеннях?`,
      'Який практичний дослід або спостереження можна показати класу на наступному уроці?',
    ],
    familyMission:
      customFamily ||
      `Поясніть комусь із рідних за 60 секунд головне відкриття теми «${questTitle}» та проведіть маленьке спостереження вдома.`,
    familySteps: [
      'Стисло розповісти головну ідею уроку своїми словами',
      'Знайти 1 реальний приклад застосування правила вдома або на прогулянці',
    ],
  };
}

export const RealWorldBridgeCard: React.FC<RealWorldBridgeCardProps> = ({
  questId,
  questTitle = 'Урок',
  subjectId = '',
  customTeacherHook,
  customFamilyMission,
}) => {
  const { addJournalEntry, addResilienceXp, addTraitPoints } = useProfileStore();
  const [activeBridge, setActiveBridge] = useState<'teacher' | 'family'>('teacher');

  const content = useMemo(
    () => getContextualBridges(subjectId, questTitle, customTeacherHook, customFamilyMission),
    [subjectId, questTitle, customTeacherHook, customFamilyMission]
  );

  const [teacherDraft, setTeacherDraft] = useState(content.teacherPrompts[0]);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [savedTeacher, setSavedTeacher] = useState(false);
  const [familyChecks, setFamilyChecks] = useState<boolean[]>(() =>
    content.familySteps.map(() => false)
  );
  const [missionDone, setMissionDone] = useState(false);

  const handleCopyQuestion = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(teacherDraft);
        setCopiedMsg(true);
        window.setTimeout(() => setCopiedMsg(false), 1800);
      }
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSaveTeacherQuestion = () => {
    if (!teacherDraft.trim() || savedTeacher) return;
    addJournalEntry({
      taskTitle: `Запитання до вчителя (${questTitle})`,
      reflectionText: teacherDraft.trim(),
      traitBoosted: 'Допитливість +5',
    });
    addTraitPoints('curiosity', 5);
    setSavedTeacher(true);
  };

  const handleCompleteFamilyMission = () => {
    if (missionDone) return;
    addJournalEntry({
      taskTitle: `Сімейна місія (${questTitle})`,
      reflectionText: content.familyMission,
      traitBoosted: 'Співпраця +8 · Стійкість +15 XP',
    });
    addTraitPoints('collaboration', 8);
    addResilienceXp(15);
    setMissionDone(true);
  };

  return (
    <div
      className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-alt)] border border-[var(--border-hover)] text-left space-y-3 no-print"
      aria-label="Живі містки у реальний світ"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--primary-dark)]">
            🌉 Живий місток у реальний світ
          </div>
          <p className="text-[11px] text-[var(--text-muted)] font-semibold">
            Перенесіть ідеї уроку в клас і родинну практику поза екраном
          </p>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-extrabold">
          <button
            type="button"
            onClick={() => setActiveBridge('teacher')}
            className={`px-2.5 py-1 rounded-[var(--radius-sm)] border cursor-pointer transition-colors ${
              activeBridge === 'teacher'
                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            🙋 Запитай у вчителя
          </button>
          <button
            type="button"
            onClick={() => setActiveBridge('family')}
            className={`px-2.5 py-1 rounded-[var(--radius-sm)] border cursor-pointer transition-colors ${
              activeBridge === 'family'
                ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            🏡 Сімейна місія
          </button>
        </div>
      </div>

      {activeBridge === 'teacher' ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {content.teacherPrompts.map((prompt, idx) => (
              <button
                key={`${questId}_tp_${idx}`}
                type="button"
                onClick={() => {
                  setTeacherDraft(prompt);
                  setSavedTeacher(false);
                }}
                className="text-left px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[11px] font-semibold text-[var(--text)] cursor-pointer"
              >
                💬 Ідея {idx + 1}: {prompt.slice(0, 68)}…
              </button>
            ))}
          </div>

          <textarea
            value={teacherDraft}
            onChange={(e) => {
              setTeacherDraft(e.target.value);
              setSavedTeacher(false);
            }}
            rows={2}
            className="input-field text-xs py-2 px-3"
            aria-label="Текст запитання для обговорення з учителем"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCopyQuestion}>
              {copiedMsg ? '✓ Скопійовано' : '📋 Копіювати запитання'}
            </Button>
            <Button
              type="button"
              variant={savedTeacher ? 'outline' : 'primary'}
              size="sm"
              disabled={savedTeacher || !teacherDraft.trim()}
              onClick={handleSaveTeacherQuestion}
            >
              {savedTeacher ? '✓ Збережено в щоденник' : '📓 Зберегти у щоденник (+5 Допитливість)'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text)] leading-relaxed">
            {content.familyMission}
          </div>

          <div className="space-y-1.5">
            {content.familySteps.map((stepText, idx) => (
              <label
                key={idx}
                className="flex items-start gap-2 text-xs font-semibold text-[var(--text)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(familyChecks[idx])}
                  onChange={() =>
                    setFamilyChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                  }
                  className="accent-[var(--accent)] w-4 h-4 mt-0.5 cursor-pointer"
                />
                <span>{stepText}</span>
              </label>
            ))}
          </div>

          <Button
            type="button"
            variant={missionDone ? 'outline' : 'primary'}
            size="sm"
            disabled={missionDone}
            onClick={handleCompleteFamilyMission}
          >
            {missionDone
              ? '✅ Родинну місію зафіксовано!'
              : '🏡 Зафіксувати виконання поза екраном (+15 XP)'}
          </Button>
        </div>
      )}
    </div>
  );
};
