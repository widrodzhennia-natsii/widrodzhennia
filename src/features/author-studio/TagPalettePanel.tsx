import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { REGISTERED_WIDGET_TYPES } from '../../components/widgets/WidgetRegistry';

interface TagPalettePanelProps {
  onInsertSnippet: (snippet: string) => void;
}

interface PaletteItem {
  label: string;
  snippet: string;
  hint: string;
}

const SEMANTIC_ITEMS: PaletteItem[] = [
  { label: 'Підмет ═', snippet: '[[subj:слово]]', hint: 'Підмет (одна/подвійна риса)' },
  { label: 'Присудок ≡', snippet: '[[pred:дієслово]]', hint: 'Присудок' },
  { label: 'Означення ∿', snippet: '[[attr:який]]', hint: 'Означення (хвиляста)' },
  { label: 'Додаток --', snippet: '[[obj:кого]]', hint: 'Додаток (пунктир)' },
  { label: 'Обставина ·-·', snippet: '[[adv:де]]', hint: 'Обставина' },
  { label: 'Морфеми (текст)', snippet: '[[morpheme:пре-фікс-корінь-суф-ікс]]', hint: 'Візуальний розбір слова' },
  { label: 'Морфеми (інтерактив)', snippet: '[[morpheme_parts:prefix:при|root:кордон|suffix:н|ending:ий]]', hint: 'Окремі клікабельні морфеми в block_text_marking' },
  { label: 'Орфограма', snippet: '[[ortho:букв[а/о]а]]', hint: 'Орфографічний маркер' },
  { label: 'Дрібний шрифт (доказ)', snippet: '[[fine_print:підозріле посилання]]', hint: 'Прихована умова / доказ для критичного читання' },
  { label: 'Цитата «»', snippet: '[[quote:Пряма цитата автора]]', hint: 'Блок цитати' },
  { label: 'Теза ✓', snippet: '[[thesis:Ключове положення]]', hint: 'Блок тези' },
  { label: 'Увага !', snippet: '[[law_warn:Важливий виняток]]', hint: 'Попередження / виняток' },
];

const WIDGET_SNIPPETS: Record<string, { label: string; snippet: string }> = {
  compare: { label: 'Порівняння', snippet: '{{compare:a=12;b=8;labelA="Перше";labelB="Друге"}}' },
  split: { label: 'Частина і ціле', snippet: '{{split:total=100;left=35}}' },
  rect_geo: { label: 'Прямокутник', snippet: '{{rect_geo:w=8;h=5;unit="см"}}' },
  tape: { label: 'Стрічкова схема', snippet: '{{tape:parts="18|12";labels="Фрагмент 1|Фрагмент 2";whole="Усього 30"}}' },
  fraction: { label: 'Дроби', snippet: '{{fraction:num=3;den=4;mode="pie"}}' },
  angle: { label: 'Кут', snippet: '{{angle:deg=45}}' },
  axis: { label: 'Числова пряма', snippet: '{{axis:min=0;max=20;start=5;jump=7}}' },
  balance: { label: 'Терези', snippet: '{{balance:leftVal=15;rightVal=15;leftExpr="x + 5";rightExpr="15"}}' },
  grid: { label: 'Сітка площі', snippet: '{{grid:rows=3;cols=4;points="1:2|3:1"}}' },
  formula: { label: 'Формула', snippet: '{{formula:expr="S = v · t";legend="S — шлях; v — швидкість; t — час"}}' },
  vectors: { label: 'Вектори сил', snippet: '{{vectors:f1=16;f2=7;dir="opposite"}}' },
  machine: { label: 'Функція-автомат', snippet: '{{machine:in=5;factor=3;add=2}}' },
  scale_gauge: { label: 'Шкала / Термометр', snippet: '{{scale_gauge:type="thermometer";min=-10;max=40;value=22;step=2;unit="°C"}}' },
  clock_face: { label: 'Годинник', snippet: '{{clock_face:hour=3;minute=15}}' },
  timeline: { label: 'Хронологія', snippet: '{{timeline:events="1556:Заснування Січі|1557:Перша облога|1648:Жовті Води"}}' },
  venn: { label: 'Діаграма Венна', snippet: '{{venn:a="Рослини";b="Тварини";both="Клітини"}}' },
  tree: { label: 'Дерево понять', snippet: '{{tree:root="Речення";children="Підмет|Присудок|Другорядні"}}' },
  flow: { label: 'Блок-схема', snippet: '{{flow:steps="Початок|Умова|Дія|Результат"}}' },
  deep_dive: { label: 'Довідка (розкривна)', snippet: '{{deep_dive:title="Цікавий факт";body="Додаткове пояснення"}}' },
  protocol_steps: { label: 'Протокол безпеки', snippet: '{{protocol_steps:title="Якщо знайшли фейк";steps="Перевірте домен|Не переходьте за посиланням|Повідомте дорослих"}}' },
  algorithm_trace: { label: 'Трасування', snippet: '{{algorithm_trace:vars="x = 2";steps="x = x + 3:x = 5|Вивід x:5"}}' },
  binary_bits: { label: 'Біти (інформатика)', snippet: '{{binary_bits:value=13}}' },
  circuit: { label: 'Електроколо', snippet: '{{circuit:voltage=12;resistance=4;closed=1}}' },
  cycle_diagram: { label: 'Кругообіг (природа)', snippet: '{{cycle_diagram:nodes="Випаровування|Конденсація|Опади|Стік";title="Вода"}}' },
  atom_shell: { label: 'Модель атома', snippet: '{{atom_shell:element="Карбон (C)";protons=6;electrons="2|4"}}' },
  morpheme_builder: { label: 'Склади слово', snippet: '{{morpheme_builder:parts="prefix:під|root:сніж|suffix:ник|ending:и"}}' },
  music_rhythm: { label: 'Музичний ритм', snippet: '{{music_rhythm:pattern="2|1|0|1";bpm=96}}' },
  perspective_guide: { label: 'Перспектива (арт)', snippet: '{{perspective_guide:horizon=40;vanishing=50}}' },
  hotspot_diagram: {
    label: 'Схема з мітками',
    snippet: '{{hotspot_diagram:title="Клітина";points="105,72,Ядро:Керує клітиною|176,84,Мітохондрія:Енергія"}}',
  },
  pythagoras_squares: { label: 'Теорема Піфагора', snippet: '{{pythagoras_squares:a=3;b=4}}' },
  circle_theorem: { label: 'Кути кола', snippet: '{{circle_theorem:deg=80;r=5}}' },
  express_graph: { label: 'Експрес-графік', snippet: '{{express_graph:k=1.5;b=-1;a=0}}' },
  flow_diagram: {
    label: 'Схема з тексту (->)',
    snippet: '{{flow_diagram:title="Алгоритм";spec="Дано (умова) -> Формула -> Обчислення -> Відповідь"}}',
  },
  indented_diagram: {
    label: 'Ієрархія з відступами',
    snippet: '{{indented_diagram:title="Частини мови";spec="Слова|  Самостійні -> Іменник|  Службові -> Прийменник"}}',
  },
};

export const TagPalettePanel: React.FC<TagPalettePanelProps> = ({ onInsertSnippet }) => {
  const [group, setGroup] = useState<'semantic' | 'widgets'>('widgets');

  return (
    <div className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-[var(--primary-dark)]">
          ✨ 1-клік палітра тегів та віджетів
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={group === 'widgets' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setGroup('widgets')}
          >
            📊 SVG-віджети ({REGISTERED_WIDGET_TYPES.length})
          </Button>
          <Button
            type="button"
            variant={group === 'semantic' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setGroup('semantic')}
          >
            ✍️ Розбір і теги
          </Button>
        </div>
      </div>

      {group === 'semantic' ? (
        <div className="flex flex-wrap gap-1.5">
          {SEMANTIC_ITEMS.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant="outline"
              size="sm"
              title={item.hint}
              onClick={() => onInsertSnippet(item.snippet)}
            >
              + {item.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
          {REGISTERED_WIDGET_TYPES.map((wType) => {
            const meta = WIDGET_SNIPPETS[wType] || {
              label: wType,
              snippet: `{{${wType}:title="Приклад"}}`,
            };
            return (
              <Button
                key={wType}
                type="button"
                variant="outline"
                size="sm"
                title={meta.snippet}
                onClick={() => onInsertSnippet(meta.snippet)}
              >
                + {meta.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};
