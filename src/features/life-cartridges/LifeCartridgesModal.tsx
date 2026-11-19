import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { EcoBalanceSimEngine } from '../../engines/base-extension/BaseExtensionEngines';
import { useProfileStore } from '../../core/state/useProfileStore';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';
import type { ResilienceArenaChallengeSpec } from './resilience/resilienceArena.types';

export type LifeCartridgeTabId = 'law' | 'valeology' | 'ecology' | 'diction' | 'resilience';

interface LifeCartridgesModalProps {
  isOpen: boolean;
  initialTab?: LifeCartridgeTabId;
  onClose: () => void;
}

interface CaseQuestion {
  id: string;
  title: string;
  prompt: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

const LAW_CASES: CaseQuestion[] = [
  {
    id: 'law_1',
    title: 'Дрібні побутові правочини (з 14 років)',
    prompt:
      '14-річний учень хоче самостійно купити на власні кишенькові гроші навушники або розпоряджатися премією за олімпіаду. Чи має він право за Цивільним кодексом України?',
    options: [
      'Ні, до 18 років заборонені будь-які покупки',
      'Так, з 14 років (неповна цивільна дієздатність) може розпоряджатися заробітком/стипендією та дрібними покупками',
      'Лише за нотаріальною довіреністю школи',
    ],
    correctIdx: 1,
    explanation:
      'З 14 до 18 років особа має неповну цивільну дієздатність (ст. 32 ЦКУ): може самостійно розпоряджатися своїм заробітком, стипендією та укладати дрібні побутові правочини.',
  },
  {
    id: 'law_2',
    title: 'Цифрові права та приватність',
    prompt:
      'Хтось опублікував ваше фото у групі без дозволу і відмовляється видаляти, хоча це створює приниження. Який перший правильний крок?',
    options: [
      'Зробити скриншот-фіксацію з датою/посиланням, подати скаргу адміністратору платформи й звернутися до дорослих або кіберполіції',
      'Опублікувати у відповідь образливий коментар',
      'Видалити власний акаунт і нікому не казати',
    ],
    correctIdx: 0,
    explanation:
      'Цифрова фіксація доказів (скриншоти + URL), офіційна скарга на платформі та повідомлення батькам/педагогу захищають ваші особисті немайнові права (ст. 307 ЦКУ).',
  },
];

const VALEOLOGY_CASES: CaseQuestion[] = [
  {
    id: 'val_1',
    title: 'Правило зору 20–20–20',
    prompt: 'Як правильно знімати напругу очей при роботі за екраном планшета або ноутбука?',
    options: [
      'Кожні 20 хвилин дивитися на об’єкт за ~6 метрів (20 футів) протягом 20 секунд',
      'Збільшити яскравість екрана до 100% у темній кімнаті',
      'Працювати 3 години поспіль без перерв',
    ],
    correctIdx: 0,
    explanation:
      'Правило 20–20–20 розслабляє циліарний м’яз ока та запобігає втомі й головному болю.',
  },
  {
    id: 'val_2',
    title: 'Перша допомога при незначному термічному опіку',
    prompt: 'Якщо людина випадково обпекла палець гарячим посудом без пошкодження шкіри, що зробити першочергово?',
    options: [
      'Одразу намастити олією або сметаною',
      'Охолоджувати прохолодною проточною водою 10–15 хвилин',
      'Прикласти лід напряму без тканини',
    ],
    correctIdx: 1,
    explanation:
      'Прохолодна проточна вода (не крижана й не олія!) ефективно відводить тепло з тканин і зупиняє поглиблення опіку.',
  },
];

const TONGUE_TWISTERS = [
  'Ворона проворонила вороненя, а перепел перепеленя.',
  'Карл у Клари вкрав корали, а Клара у Карла вкрала кларнет.',
  'Хитру сороку спіймати морока, а на сорок сорок — сорок морок.',
  'Усім по сім, а всьому сьому — ще по сьомому слову.',
];

interface ArenaChallenge extends ResilienceArenaChallengeSpec {
  title: string;
  task: string;
  options: string[];
  correctIdx: number;
  clue: string;
}

const ARENA_CHALLENGES: ArenaChallenge[] = [
  {
    id: 'res_1',
    difficultyTier: 'adaptive',
    title: 'Бар’єр імпульсивності',
    task: 'Равлик піднімається на стовп висотою 10 м: за день +3 м, за ніч з’їжджає на −2 м. На який день він вперше досягне вершини 10 м?',
    options: ['На 10-й день', 'На 8-й день', 'На 7-й день'],
    correctIdx: 1,
    clue: 'Наприкінці 7-го дня після ночі він буде на 7 м, а впродовж 8-го дня підніметься +3 м і одразу торкнеться 10 м!',
  },
  {
    id: 'res_2',
    difficultyTier: 'resilience_arena',
    title: 'Бажане зусилля: зворотний порядок',
    task: 'Поїзд їде зі швидкістю 60 км/год. За 2 години він подолав половину шляху, а другу половину їхав зі швидкістю 40 км/год. Яка середня швидкість на всьому шляху?',
    options: ['50 км/год', '48 км/год', '45 км/год'],
    correctIdx: 1,
    clue: 'Весь шлях: 120 + 120 = 240 км. Час: 2 год + 3 год = 5 год. Середня швидкість = 240 / 5 = 48 км/год!',
  },
];

const TAB_LIST: Array<{ id: LifeCartridgeTabId; icon: string; label: string }> = [
  { id: 'law', icon: '⚖️', label: 'Право' },
  { id: 'valeology', icon: '🩺', label: 'Валеологія' },
  { id: 'ecology', icon: '🌿', label: 'Екологія' },
  { id: 'diction', icon: '🎙️', label: 'Дикція' },
  { id: 'resilience', icon: '🛡️', label: 'Арена Стресостійкості' },
];

export const LifeCartridgesModal: React.FC<LifeCartridgesModalProps> = ({
  isOpen,
  initialTab = 'resilience',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LifeCartridgeTabId>(initialTab);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // Diction metronome state
  const [twisterIdx, setTwisterIdx] = useState(0);
  const [dictionBpm, setDictionBpm] = useState(72);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [beatTick, setBeatTick] = useState(0);
  const [speechThesis, setSpeechThesis] = useState('');

  // Resilience Arena somatic breath phase
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Вдих (4с)' | 'Тримай (4с)' | 'Видих (4с)'>('Вдих (4с)');
  const [breathCompletedCount, setBreathCompletedCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addTraitPoints } = useProfileStore();
  const { notify } = useFeedbackStore();

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    } else {
      setMetronomeOn(false);
      setIsBreathingActive(false);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!metronomeOn) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const intervalMs = Math.round((60 / dictionBpm) * 1000);
    timerRef.current = setInterval(() => {
      setBeatTick((t) => (t + 1) % 4);
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [metronomeOn, dictionBpm]);

  useEffect(() => {
    if (!isBreathingActive) return;
    const phases: Array<'Вдих (4с)' | 'Тримай (4с)' | 'Видих (4с)'> = [
      'Вдих (4с)',
      'Тримай (4с)',
      'Видих (4с)',
    ];
    let step = 0;
    setBreathPhase(phases[0]);
    const id = setInterval(() => {
      step = (step + 1) % phases.length;
      setBreathPhase(phases[step]);
      if (step === 0) {
        setBreathCompletedCount((c) => c + 1);
        addTraitPoints('selfRegulation', 2);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [isBreathingActive, addTraitPoints]);

  const handleSelectCaseOption = (q: CaseQuestion, optIdx: number, trait: 'wisdom' | 'selfRegulation' | 'resilience') => {
    const prev = answers[q.id];
    setAnswers((p) => ({ ...p, [q.id]: optIdx }));
    if (prev !== q.correctIdx && optIdx === q.correctIdx) {
      addTraitPoints(trait, 4);
      notify(`✅ Правильно! +4 до риси характеру`, 'success');
    }
  };

  const renderCaseList = (list: CaseQuestion[], trait: 'wisdom' | 'selfRegulation') => (
    <div className="space-y-3">
      {list.map((q) => {
        const chosen = answers[q.id];
        const isCorrect = chosen === q.correctIdx;
        return (
          <div
            key={q.id}
            className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2.5"
          >
            <div className="text-xs font-extrabold text-[var(--primary-dark)]">{q.title}</div>
            <p className="text-xs font-semibold text-[var(--text)] leading-relaxed">{q.prompt}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectCaseOption(q, idx, trait)}
                  className="w-full text-left p-2.5 rounded-[var(--radius-sm)] border text-xs font-bold cursor-pointer transition-colors"
                  style={{
                    borderColor:
                      chosen === idx
                        ? idx === q.correctIdx
                          ? 'var(--ok-border)'
                          : 'var(--err-border)'
                        : 'var(--border)',
                    backgroundColor:
                      chosen === idx
                        ? idx === q.correctIdx
                          ? 'var(--ok-bg)'
                          : 'var(--err-bg)'
                        : 'var(--surface-alt)',
                    color: 'var(--text)',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            {chosen !== undefined && (
              <div
                className={`p-2.5 rounded-[var(--radius-sm)] border text-xs font-medium ${
                  isCorrect
                    ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                    : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                }`}
              >
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🧭 Життєві картриджі та «Арена Стресостійкості»"
      fullScreen={true}
    >
      <div className="space-y-4 max-w-[1320px] mx-auto w-full">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] pb-3">
          {TAB_LIST.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={activeTab === tab.id ? 'primary' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
              className="text-xs font-bold"
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Tab Bodies */}
        {activeTab === 'law' && (
          <div className="space-y-3">
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold">
              ⚖️ Автономний картридж правової грамотності: ситуаційні кейси про дієздатність, права в школі та цифрову безпеку.
            </div>
            {renderCaseList(LAW_CASES, 'wisdom')}
          </div>
        )}

        {activeTab === 'valeology' && (
          <div className="space-y-3">
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold">
              🩺 Картридж здоров’я (валеологія): постава, правило зору 20–20–20 та протоколи першої допомоги.
            </div>
            {renderCaseList(VALEOLOGY_CASES, 'selfRegulation')}
          </div>
        )}

        {activeTab === 'ecology' && (
          <div className="space-y-3">
            <EcoBalanceSimEngine
              config={{
                minStability: 80,
                instruction: '🌿 Практика екологічного сліду: виведіть біом на стабільність ≥ 80% без виснаження води.',
              }}
              onSubmitAnswer={() => {
                addTraitPoints('wisdom', 5);
                notify('🌿 Екобаланс досягнуто! +5 до мудрості.', 'success');
              }}
            />
          </div>
        )}

        {activeTab === 'diction' && (
          <div className="space-y-4">
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[var(--primary-dark)]">
                  🎙️ Тренажер артикуляції під візуальний метроном
                </span>
                <span className="font-mono text-xs font-black">{dictionBpm} уд/хв</span>
              </div>

              <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--hl-border)] bg-[var(--hl-bg)] text-[var(--hl-text)] text-sm font-black text-center">
                «{TONGUE_TWISTERS[twisterIdx]}»
              </div>

              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2, 3].map((dot) => (
                  <span
                    key={dot}
                    className="w-4 h-4 rounded-full border border-[var(--border)] transition-transform"
                    style={{
                      backgroundColor:
                        metronomeOn && beatTick === dot ? 'var(--accent)' : 'var(--surface-alt)',
                      transform: metronomeOn && beatTick === dot ? 'scale(1.25)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="range"
                  min={50}
                  max={120}
                  step={4}
                  value={dictionBpm}
                  onChange={(e) => setDictionBpm(Number(e.target.value))}
                  className="settings-range max-w-[200px]"
                  aria-label="Темп метронома"
                />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={metronomeOn ? 'accent' : 'primary'}
                    onClick={() => setMetronomeOn((v) => !v)}
                  >
                    {metronomeOn ? '⏹ Зупинити метроном' : '▶ Запустити ритм'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTwisterIdx((i) => (i + 1) % TONGUE_TWISTERS.length)}
                  >
                    ↻ Інша скоромовка
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2">
              <div className="text-xs font-extrabold text-[var(--primary-dark)]">
                Конструктор короткої промови (15 секунд):
              </div>
              <textarea
                rows={2}
                value={speechThesis}
                onChange={(e) => setSpeechThesis(e.target.value)}
                placeholder="Теза (1 речення) → Конкретний приклад → Заклик до дії..."
                className="w-full p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-medium"
              />
            </div>
          </div>
        )}

        {activeTab === 'resilience' && (
          <div className="space-y-4">
            {/* Somatic Recovery Panel */}
            <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--hl-border)] bg-[var(--hl-bg)] text-[var(--hl-text)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-extrabold uppercase">
                  🌬️ Соматичне відновлення перед викликом (пауза 4–4–4)
                </div>
                <p className="text-xs font-medium">
                  Складна задача — це тренування «бажаного зусилля». Поточна фаза:{' '}
                  <strong>{isBreathingActive ? breathPhase : 'Готовий до фокусування'}</strong> (циклів:{' '}
                  {breathCompletedCount}).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isBreathingActive ? 'accent' : 'primary'}
                onClick={() => setIsBreathingActive((v) => !v)}
              >
                {isBreathingActive ? '⏸ Завершити дихання' : '🌬️ 12-сек дихальна пауза'}
              </Button>
            </div>

            {/* Desirable Difficulty Arena Challenges */}
            <div className="space-y-3">
              {ARENA_CHALLENGES.map((ch) => {
                const chosen = answers[ch.id];
                const isRight = chosen === ch.correctIdx;
                return (
                  <div
                    key={ch.id}
                    className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[var(--primary-dark)]">{ch.title}</span>
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-[var(--surface-alt)] border border-[var(--border)]">
                        {ch.difficultyTier === 'resilience_arena' ? 'Рівень: Арена' : 'Рівень: Адаптивний'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[var(--text)] leading-relaxed">{ch.task}</p>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {ch.options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const prev = answers[ch.id];
                            setAnswers((p) => ({ ...p, [ch.id]: idx }));
                            if (prev !== ch.correctIdx && idx === ch.correctIdx) {
                              addTraitPoints('resilience', 6);
                              notify('🛡️ Задача «Бажаного зусилля» подолана! +6 до стійкості.', 'success');
                            }
                          }}
                          className="p-2.5 rounded-[var(--radius-sm)] border text-xs font-bold cursor-pointer"
                          style={{
                            borderColor:
                              chosen === idx
                                ? idx === ch.correctIdx
                                  ? 'var(--ok-border)'
                                  : 'var(--err-border)'
                                : 'var(--border)',
                            backgroundColor:
                              chosen === idx
                                ? idx === ch.correctIdx
                                  ? 'var(--ok-bg)'
                                  : 'var(--err-bg)'
                                : 'var(--surface-alt)',
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {chosen !== undefined && (
                      <div
                        className={`p-2.5 rounded-[var(--radius-sm)] border text-xs font-medium ${
                          isRight
                            ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                            : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                        }`}
                      >
                        {ch.clue}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
