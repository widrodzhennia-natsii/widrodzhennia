import React, { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RichBlockText } from '../../components/ui/RichBlockText';

type SubjectFilterId =
  | 'all'
  | 'math'
  | 'ukrainian'
  | 'history'
  | 'informatics'
  | 'cybersecurity'
  | 'physics'
  | 'science'
  | 'music'
  | 'art';

interface GuideWidgetExample {
  id: string;
  title: string;
  subjects: SubjectFilterId[];
  snippet: string;
  notes: string;
}

interface AuthorGuidePanelProps {
  onCopySnippet: (snippet: string) => void;
  onInsertIntoEditor?: (snippet: string) => void;
}

const SUBJECT_FILTERS: Array<{ id: SubjectFilterId; label: string }> = [
  { id: 'all', label: 'Усі предмети' },
  { id: 'math', label: '📐 Математика' },
  { id: 'ukrainian', label: '📖 Українська мова' },
  { id: 'history', label: '📜 Історія' },
  { id: 'informatics', label: '💻 Інформатика' },
  { id: 'cybersecurity', label: '🛡️ Кібербезпека' },
  { id: 'physics', label: '⚛️ Фізика' },
  { id: 'science', label: '🌿 Природознавство' },
  { id: 'music', label: '🎵 Музичне мистецтво' },
  { id: 'art', label: '🎨 Образотворче мистецтво' },
];

const GUIDE_WIDGET_EXAMPLES: GuideWidgetExample[] = [
  {
    id: 'compare',
    title: 'Порівняння величин ({{compare}})',
    subjects: ['math', 'science', 'history'],
    snippet: '{{compare:a=480;b=540;labelA="Ширина (см)";labelB="Висота (см)"}}',
    notes: 'Порівнює дві величини у вигляді штрихованих смуг із табличними числами.',
  },
  {
    id: 'split',
    title: 'Декомпозиція цілого ({{split}})',
    subjects: ['math', 'science'],
    snippet: '{{split:total=100;left=71}}',
    notes: 'Показує розклад цілого на дві частини; у теорії відкриває повзунки.',
  },
  {
    id: 'rect_geo',
    title: 'Прямокутник: площа і периметр ({{rect_geo}})',
    subjects: ['math'],
    snippet: '{{rect_geo:w=8;h=5;unit="см"}}',
    notes: 'Автоматично обчислює S = a · b та P = 2 · (a + b), підтримує повзунки.',
  },
  {
    id: 'tape',
    title: 'Стрічкова модель задачі ({{tape}})',
    subjects: ['math'],
    snippet: '{{tape:parts="160|160|160";labels="Ліва|Опора|Права";whole="Усього 480 см"}}',
    notes: 'Складена стрічка довільної кількості відрізків через «|».',
  },
  {
    id: 'fraction',
    title: 'Модель дробу ({{fraction}})',
    subjects: ['math', 'science'],
    snippet: '{{fraction:num=3;den=4;mode="pie"}}',
    notes: 'mode="pie" (кругова) або mode="bar" (стрічкова); підтримує слайдери.',
  },
  {
    id: 'angle',
    title: 'Кутомірна дуга ({{angle}})',
    subjects: ['math', 'physics'],
    snippet: '{{angle:deg=45}}',
    notes: 'Визначає тип кута (гострий, прямий, тупий, розгорнутий) зі слайдером.',
  },
  {
    id: 'axis',
    title: 'Числова вісь зі стрибками ({{axis}})',
    subjects: ['math'],
    snippet: '{{axis:min=0;max=10;start=2;jump=5}}',
    notes: 'Ілюструє додавання/віднімання стрибками на числовій прямій.',
  },
  {
    id: 'balance',
    title: 'Важільні терези ({{balance}})',
    subjects: ['math', 'physics'],
    snippet: '{{balance:leftVal=12;rightVal=12;leftExpr="x + 4";rightExpr="12"}}',
    notes: 'Динамічно нахиляється при нерівності; підтримує повзунки.',
  },
  {
    id: 'grid',
    title: 'Координатна сітка ({{grid}})',
    subjects: ['math', 'informatics'],
    snippet: '{{grid:rows=3;cols=4;points="1:2|3:1"}}',
    notes: 'Малює матрицю клітинок та опорні точки x:y через «|».',
  },
  {
    id: 'formula',
    title: 'Картка формули ({{formula}})',
    subjects: ['math', 'physics'],
    snippet: '{{formula:expr="I = U / R";legend="I — струм (А); U — напруга (В); R — опір (Ом)"}}',
    notes: 'Акцентна формула з поясненням кожної змінної.',
  },
  {
    id: 'vectors',
    title: 'Вектори сил і швидкостей ({{vectors}})',
    subjects: ['physics', 'math'],
    snippet: '{{vectors:f1=16;f2=7;dir="opposite"}}',
    notes: 'dir="opposite" або dir="same"; рахує рівнодійну силу R.',
  },
  {
    id: 'machine',
    title: 'Функція-автомат «Вхід → Вихід» ({{machine}})',
    subjects: ['math', 'informatics'],
    snippet: '{{machine:in=5;factor=3;add=2}}',
    notes: 'Підтримує формулу op="3 * x + 2" через безпечний обчислювач.',
  },
  {
    id: 'timeline',
    title: 'Хронологічна стрічка ({{timeline}})',
    subjects: ['history'],
    snippet: '{{timeline:events="1556:Заснування Січі|січ. 1557:24-денна облога|осінь 1557:Велика облога"}}',
    notes: 'Події у форматі Дата:Підпис розділяються вертикальною рискою «|».',
  },
  {
    id: 'venn',
    title: 'Діаграма Ейлера-Венна ({{venn}})',
    subjects: ['science', 'ukrainian', 'math'],
    snippet: '{{venn:a="Жива природа";b="Нежива природа";both="Вода й повітря"}}',
    notes: 'Використовує окремі штриховки <pattern> для Ч/Б тем.',
  },
  {
    id: 'tree',
    title: 'Ієрархічне дерево ({{tree}})',
    subjects: ['ukrainian', 'history', 'science'],
    snippet: '{{tree:root="Члени речення";children="Підмет|Присудок|Означення|Додаток"}}',
    notes: 'Показує головне поняття та дочірні гілки через «|».',
  },
  {
    id: 'flow',
    title: 'Ланцюжок алгоритму ({{flow}})',
    subjects: ['informatics', 'history', 'science'],
    snippet: '{{flow:steps="Старт|Умова x > 3?|Так: y = x * 2|Вивід y"}}',
    notes: 'Послідовні етапи процесу чи причинно-наслідкових зв’язків.',
  },
  {
    id: 'deep_dive',
    title: 'Розкривна довідка ({{deep_dive}})',
    subjects: ['history', 'science', 'ukrainian'],
    snippet: '{{deep_dive:title="Цікава деталь";body="Додатковий матеріал, прихований за акордеоном."}}',
    notes: 'Розкривається за кліком, не перевантажуючи мобільний екран.',
  },
  {
    id: 'algorithm_trace',
    title: 'Таблиця трасування ({{algorithm_trace}})',
    subjects: ['informatics'],
    snippet: '{{algorithm_trace:vars="x = 4";steps="x = x + 3:x = 7|y = x * 2:y = 14|Вивід y:14"}}',
    notes: 'Покроковий стан змінних алгоритму (Команда:Значення через «|»).',
  },
  {
    id: 'binary_bits',
    title: 'Інтерактивний 8-бітний регістр ({{binary_bits}})',
    subjects: ['informatics'],
    snippet: '{{binary_bits:value=13}}',
    notes: 'У теорії дозволяє вмикати/вимикати окремі біти кліком.',
  },
  {
    id: 'circuit',
    title: 'Електричне коло ({{circuit}})',
    subjects: ['physics'],
    snippet: '{{circuit:voltage=12;resistance=4;closed=1}}',
    notes: 'Живі повзунки напруги, опору та вимикача (закон Ома I = U / R).',
  },
  {
    id: 'cycle_diagram',
    title: 'Замкнутий природний цикл ({{cycle_diagram}})',
    subjects: ['science'],
    snippet: '{{cycle_diagram:nodes="Випаровування|Конденсація|Опади|Стік";title="Вода"}}',
    notes: 'Відображає до 4 етапів циклічного процесу.',
  },
  {
    id: 'atom_shell',
    title: 'Модель електронних оболонок ({{atom_shell}})',
    subjects: ['science', 'physics'],
    snippet: '{{atom_shell:element="Кисень (O)";protons=8;electrons="2|6"}}',
    notes: 'Будує ядро та орбіти з вказаною кількістю електронів на шарах.',
  },
  {
    id: 'morpheme_builder',
    title: 'Морфемна будова слова ({{morpheme_builder}})',
    subjects: ['ukrainian'],
    snippet: '{{morpheme_builder:parts="prefix:при|root:кордон|suffix:н|ending:ий"}}',
    notes: 'Типи частин: prefix, root, suffix, ending через «|».',
  },
  {
    id: 'scale_gauge',
    title: 'Шкала приладу: термометр / мензурка ({{scale_gauge}})',
    subjects: ['science', 'physics', 'math'],
    snippet: '{{scale_gauge:type="beaker";min=0;max=100;value=60;step=10;unit="мл"}}',
    notes: 'type="thermometer" або "beaker"; живий повзунок показань і підпис ціни поділки.',
  },
  {
    id: 'clock_face',
    title: 'Аналоговий годинник ({{clock_face}})',
    subjects: ['math'],
    snippet: '{{clock_face:hour=3;minute=15}}',
    notes: 'Живий циферблат зі стрілками, який рахує кут між годинною й хвилинною стрілками.',
  },
  {
    id: 'protocol_steps',
    title: 'Протокол кроків безпеки ({{protocol_steps}})',
    subjects: ['cybersecurity', 'informatics', 'science'],
    snippet: '{{protocol_steps:title="Захист від фішингу";steps="Перевірте домен відправника|Не переходьте за підозрілим посиланням|Повідомте дорослих"}}',
    notes: 'Пронумерований картковий список дій для кібергігієни, лабораторних інструкцій чи правил.',
  },
  {
    id: 'music_rhythm',
    title: 'Схема музичного ритму і такту ({{music_rhythm}})',
    subjects: ['music'],
    snippet: '{{music_rhythm:pattern="2|1|0|1";bpm=96}}',
    notes: 'pattern: 2 (сильна ● ТУК), 1 (слабка ▲ ТА), 0 (пауза 𝄽); живий повзунок темпу bpm.',
  },
  {
    id: 'perspective_guide',
    title: 'Схема лінійної перспективи ({{perspective_guide}})',
    subjects: ['art'],
    snippet: '{{perspective_guide:horizon=40;vanishing=50}}',
    notes: 'Живі повзунки лінії горизонту та точки сходу F для пояснення глибини простору.',
  },
];

const YAML_PATTERNS = [
  {
    title: '1. Динамічні змінні (vars) — детермінована генерація для кожного учня',
    subjects: ['math', 'informatics', 'physics'] as SubjectFilterId[],
    code: `id: "task-vars-demo"
type: "block_notebook_task"
title: "Індивідуальний розрахунок"
vars:
  w: "randInt(4, 9)"
  h: "randInt(3, 6)"
  area: "w * h"
notebookPrompt: "Знайдіть площу: {{rect_geo:w={{w}};h={{h}};unit=\\"см\\"}}"
correctAnswer: "{{area}}"
unit: "см²"`,
  },
  {
    title: '2. Розбір речень і морфем усередині слова (block_text_marking)',
    subjects: ['ukrainian', 'cybersecurity'] as SubjectFilterId[],
    code: `id: "ukr-morpheme-marking"
type: "block_text_marking"
title: "Морфемний розбір слова"
prompt: "Позначте префікс, корінь, суфікс і закінчення у слові:"
sentence: "[[morpheme_parts:prefix:при|root:кордон|suffix:н|ending:ий]]"
availableTools: ["prefix", "root", "suffix", "ending"]
toleranceMode: "exact"`,
  },
  {
    title: '3. Шкали й прилади: термометр, мензурка, годинник (number-line-scales)',
    subjects: ['math', 'science', 'physics'] as SubjectFilterId[],
    code: `id: "scale-beaker-demo"
type: "block_interactive_sandbox"
engineId: "number-line-scales"
instruction: "Налийте в мензурку рівно 140 мл води (ціна поділки — 20 мл)."
engineConfig:
  scaleType: "beaker"
  min: 0
  max: 200
  step: 20
  initialValue: 40
  targetValue: 140
  unit: "мл"`,
  },
  {
    title: '4. Сортувальник категорій і протокол безпеки (drag-sorter-protocol)',
    subjects: ['cybersecurity', 'informatics', 'science'] as SubjectFilterId[],
    code: `id: "cyber-sorter-demo"
type: "block_interactive_sandbox"
engineId: "drag-sorter-protocol"
instruction: "Розподіліть повідомлення на безпечні та шахрайські (фішинг):"
engineConfig:
  mode: "baskets"
  baskets:
    - { id: "safe", label: "Безпечно", symbol: "●" }
    - { id: "phish", label: "Фішинг", symbol: "▲" }
  items:
    - { id: "i1", text: "Щоденник на gov.ua", targetBasketId: "safe" }
    - { id: "i2", text: "Бонус 5000 ₴ — введіть PIN", targetBasketId: "phish" }`,
  },
  {
    title: '5. Реакції персонажа у симуляторах (reactionZones)',
    subjects: ['history', 'physics'] as SubjectFilterId[],
    code: `reactionZones:
  - condition: "hit"
    speaker: "Дмитро Вишневецький (Байда)"
    avatar: "⚔️"
    emote: "joy"
    text: "Влучний залп! Ціль уражено!"
  - condition: "near_miss"
    speaker: "Джура Тарас"
    avatar: "🏹"
    emote: "idea"
    text: "Зовсім поруч! Змініть кут лише на 2–3°."
  - condition: "undershoot"
    speaker: "Джура Тарас"
    avatar: "🏹"
    emote: "sweat"
    text: "Недоліт! Додайте заряду."`,
  },
  {
    title: '6. Тести з індивідуальним фідбеком (multiSelect, copilotHint)',
    subjects: ['ukrainian', 'informatics', 'science', 'math', 'cybersecurity'] as SubjectFilterId[],
    code: `type: "block_recognition_quiz"
multiSelect: true
question: "Оберіть УСІ правильні твердження:"
copilotHint: "Перевірте кожен варіант по черзі."
options:
  - text: "Правильний варіант А"
    isCorrect: true
    feedbackSuccess: "Точно!"
  - text: "Хибний варіант Б"
    isCorrect: false
    feedbackFail: "Пояснення, чому Б не підходить."`,
  },
  {
    title: '7. Музичний слуховий диктант та ритм (music-sequencer-ear)',
    subjects: ['music'] as SubjectFilterId[],
    code: `id: "music-melody-demo"
type: "block_interactive_sandbox"
engineId: "music-sequencer-ear"
instruction: "Послухайте зразок і повторіть мелодію у подвійному позначенні (До/C4)."
engineConfig:
  mode: "ear_melody"
  gradeBand: "5-7"
  difficulty: "beginner"
  scale: "pentatonic"
  timbre: "piano"
  tempoBpm: 96
  targetNotes: ["До", "Мі", "Соль", "До5"]`,
  },
  {
    title: '8. Колористика, перспектива і світлотінь (color-perspective-studio)',
    subjects: ['art'] as SubjectFilterId[],
    code: `id: "art-perspective-demo"
type: "block_interactive_sandbox"
engineId: "color-perspective-studio"
instruction: "Встановіть горизонт 38% і точку сходу F у центрі (50%)."
engineConfig:
  mode: "perspective"
  targetHorizon: 38
  targetVanishing: 50
  tolerance: 8`,
  },
];

export const AuthorGuidePanel: React.FC<AuthorGuidePanelProps> = ({
  onCopySnippet,
  onInsertIntoEditor,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilterId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWidgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GUIDE_WIDGET_EXAMPLES.filter((item) => {
      const matchesSubject = subjectFilter === 'all' || item.subjects.includes(subjectFilter);
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.snippet.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q);
      return matchesSubject && matchesSearch;
    });
  }, [subjectFilter, searchQuery]);

  const filteredPatterns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return YAML_PATTERNS.filter((item) => {
      const matchesSubject = subjectFilter === 'all' || item.subjects.includes(subjectFilter);
      const matchesSearch =
        !q || item.title.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
      return matchesSubject && matchesSearch;
    });
  }, [subjectFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header + Subject filter & Search */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--primary-dark)]">
              📖 Інтерактивний довідник автора ({GUIDE_WIDGET_EXAMPLES.length} віджетів + синтаксис)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Кожен приклад рендериться наживо через реальний рушій. Клікніть «Копіювати» або вставте конструкцію одразу у поточний блок редактора.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {SUBJECT_FILTERS.map((sf) => (
            <Button
              key={sf.id}
              type="button"
              variant={subjectFilter === sf.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSubjectFilter(sf.id)}
            >
              {sf.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук віджета або тегу (наприклад: circuit, vars, venn, morpheme)..."
            className="input-field py-1.5 text-xs flex-1"
          />
          {searchQuery && (
            <Button type="button" variant="outline" size="sm" onClick={() => setSearchQuery('')}>
              Очистити
            </Button>
          )}
        </div>
      </div>

      {/* Humanities Semantic Markers */}
      {(subjectFilter === 'all' || subjectFilter === 'ukrainian' || subjectFilter === 'history') && (
        <div className="card space-y-3">
          <h3 className="text-sm font-extrabold text-[var(--primary-dark)]">
            ✍️ Гуманітарні маркери розмітки (подвійне кодування для Ч/Б)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2">
              <strong className="block text-[var(--primary-dark)]">Синтаксичні члени речення:</strong>
              <div className="leading-loose">
                <RichBlockText text="[[attr:Ясний]] [[subj:місяць]] [[adv:тихо]] [[pred:освітлював]] [[obj:берег]]." />
              </div>
              <code className="block text-[11px] font-mono bg-[var(--surface)] p-2 rounded border border-[var(--border)]">
                {'[[attr:...]] [[subj:...]] [[adv:...]] [[pred:...]] [[obj:...]]'}
              </code>
            </div>

            <div className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2">
              <strong className="block text-[var(--primary-dark)]">Орфограми, морфеми, цитати, тези та винятки:</strong>
              <div className="space-y-1.5 leading-relaxed">
                <div>
                  <RichBlockText text="Орфограма: [[ortho:з[е/и]лений]] · Морфеми: [[morpheme:prefix:при|root:клад|suffix:н|ending:ий]]" />
                </div>
                <div>
                  <RichBlockText text="[[quote:Мудрість приходить із досвідом.]]" />
                </div>
                <div>
                  <RichBlockText text="[[thesis:Головна ідея уроку]] [[law_warn:Виняток із правила!]]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Widgets Gallery */}
      <div className="space-y-2">
        <h3 className="text-sm font-extrabold text-[var(--primary-dark)] px-1">
          📊 Жива галерея інлайн-віджетів (показано {filteredWidgets.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {filteredWidgets.map((item) => (
            <div key={item.id} className="card space-y-2.5 flex flex-col justify-between min-w-0 overflow-hidden">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <strong className="text-xs font-extrabold text-[var(--primary-dark)] min-w-0 break-words">
                    {item.title}
                  </strong>
                  <div className="flex flex-wrap gap-1 max-w-full">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCopySnippet(item.snippet)}
                    >
                      📋 Копіювати
                    </Button>
                    {onInsertIntoEditor && (
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        onClick={() => onInsertIntoEditor(item.snippet)}
                      >
                        + У редактор
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-muted)] leading-snug">{item.notes}</p>

                <div className="p-2.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] min-w-0 overflow-hidden">
                  <RichBlockText
                    text={item.snippet}
                    interactiveWidgets={true}
                    resetSignal={`guide_${item.id}`}
                  />
                </div>
              </div>

              <code className="block text-[11px] font-mono bg-[var(--surface)] px-2.5 py-1.5 rounded border border-[var(--border)] break-all">
                {item.snippet}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* YAML Patterns Reference */}
      {filteredPatterns.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-extrabold text-[var(--primary-dark)]">
            🧩 Готові YAML-шаблони ключових механік
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            {filteredPatterns.map((pat) => (
              <div
                key={pat.title}
                className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[var(--primary-dark)]">{pat.title}</strong>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onCopySnippet(pat.code)}
                  >
                    📋 YAML
                  </Button>
                </div>
                <pre className="text-[11px] font-mono bg-[var(--surface)] p-2.5 rounded border border-[var(--border)] overflow-x-auto leading-relaxed">
                  {pat.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
