import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TextShorthandParser } from '../../core/ingestion/text-shorthand-parser';
import { YamlCurriculumParser } from '../../services/yamlCurriculumParser';
import { ContentValidator, ValidationIssue } from '../../core/ingestion/content-validator';
import { StoryBlockZod } from '../../core/contracts/blocks.schema';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';

interface RawTextPasteTabProps {
  onSuccess: (blocks: StoryBlockZod[], title: string, description: string, customQuestId?: string) => void;
}

const getHumanBlockTypeLabel = (type: string): string => {
  switch (type) {
    case 'block_dialogue':
    case 'dialogue':
      return '💬 Діалог';
    case 'block_anchor_fact':
      return '📜 Контекст / Факт';
    case 'block_theory_rule':
      return '📖 Теорія / Приклад';
    case 'block_recognition_quiz':
      return '🎯 Тест';
    case 'block_notebook_task':
      return '📝 Практика у чернетці';
    case 'block_interactive_sandbox':
    case 'sandbox':
      return '⚙️ Інтерактивний симулятор';
    case 'block_boss_challenge':
      return '🏆 Самостійне завдання';
    case 'block_somatic_pause':
    case 'somatic_break':
      return '🧘 Пауза';
    default:
      return '📌 Етап уроку';
  }
};

export const RawTextPasteTab: React.FC<RawTextPasteTabProps> = ({ onSuccess }) => {
  const [rawText, setRawText] = useState('');
  const [parsedBlocks, setParsedBlocks] = useState<StoryBlockZod[]>([]);
  const [parsedTitle, setParsedTitle] = useState('');
  const [parsedDesc, setParsedDesc] = useState('');
  const [parsedId, setParsedId] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [isCompiled, setIsCompiled] = useState(false);

  const { notify } = useFeedbackStore();

  const sampleShorthand = `# title: Моделювання руху тіла під кутом
## Практичний урок із налаштування балістичної траєкторії

> Галілео Галілей довів, що траєкторія тіла, кинутого під кутом до горизонту, є параболою.
@Наставник [idea]: Обчисліть оптимальний кут та початкову швидкість для досягнення дальності 450 м!
= Максимальна дальність польоту без опору повітря досягається під кутом 45°.
? Під яким кутом до горизонту дальність польоту без опору повітря буде найбільшою?
+ 45° (Правильно! Саме при 45° sin(2α) = 1.)
- 30°
- 90°
[Зошит: Обчисліть 15 × 30 у чорновику | ключ: distance | відповідь: 450 | од: м]
[Рушій: ballistic-trajectory | targetDistanceMeters: 450 | gravity: 9.81]
[Пауза: double_sigh | 30]`;

  const handleCompile = () => {
    if (!rawText.trim()) return;

    const looksStructuredYaml =
      YamlCurriculumParser.looksLikeYaml(rawText) ||
      /(?:^|\n)\s*(?:blocks|pipeline|steps|stages|scenes|tasks|sections|phases|parts|slides|episodes|activities|items|elements|lesson|chapter|scenario|quest|module|unit|course)\s*:/i.test(
        rawText
      ) ||
      /(?:^|\n)\s*-\s+(?:type|blockType|kind|theory|fact|rule|dialogue|quiz|task|boss)\s*:/i.test(rawText);

    if (looksStructuredYaml) {
      try {
        const yamlResult = YamlCurriculumParser.parseQuestYaml(rawText, 'pasted_lesson.yaml');
        const validationResult = ContentValidator.validateBlocks(yamlResult.pipeline);
        setParsedBlocks(validationResult.data || (yamlResult.pipeline as StoryBlockZod[]));
        setParsedTitle(yamlResult.title);
        setParsedDesc(yamlResult.description || 'Навчальний урок із практичними вправами.');
        setParsedId(yamlResult.id);
        setIssues(validationResult.issues);
        setIsCompiled(true);
        return;
      } catch (err) {
        setParsedBlocks([]);
        setParsedTitle('Помилка структури YAML');
        setParsedDesc('');
        setParsedId('');
        setIssues([
          {
            path: 'YAML-сценарій',
            message: (err as Error).message || 'Не вдалося розібрати YAML-структуру.',
            suggestion: 'Перевірте відступи (2 пробіли) та лапки біля рядків із двокрапкою.',
          },
        ]);
        setIsCompiled(true);
        return;
      }
    }

    const shorthandResult = TextShorthandParser.parse(rawText);
    const validationResult = ContentValidator.validateBlocks(shorthandResult.blocks);

    setParsedBlocks(validationResult.data || []);
    setParsedTitle(shorthandResult.title);
    setParsedDesc(shorthandResult.description || 'Навчальний урок із практичними вправами.');
    setParsedId(shorthandResult.id);
    setIssues(validationResult.issues);
    setIsCompiled(true);
  };

  const handleLaunch = () => {
    if (parsedBlocks.length > 0) {
      onSuccess(parsedBlocks, parsedTitle, parsedDesc, parsedId);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="status-panel status-panel--success space-y-1">
        <span className="font-bold block">
          ✍️ Розумний парсер сценаріїв (YAML або текстові теги):
        </span>
        <p className="text-[11px] leading-relaxed font-medium">
          Вставте YAML-сценарій або текст з тегами: <code className="code-inline">&gt; Факт</code>,{' '}
          <code className="code-inline">@Персонаж: Текст</code>, <code className="code-inline">= Правило</code>,{' '}
          <code className="code-inline">? Тест</code>, <code className="code-inline">[Зошит: ...]</code>,{' '}
          <code className="code-inline">[Рушій: ...]</code>, а також блоки коду <code className="code-inline">```</code>.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <label className="font-bold text-[var(--color-text)]">Текст або YAML сценарій уроку:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const promptSpec = `# РЕГЛАМЕНТОВАНИЙ ШАБЛОН СЦЕНАРІЮ УРОКУ (YAML або ТЕКСТ)
## Варіант 1: Структурований YAML (рекомендовано)
id: "01-lesson"
title: "Назва уроку"
blocks:
  - type: "block_anchor_fact"
    headline: "Історичний чи науковий контекст"
    contentSummary: "Основний зміст факту."
  - type: "block_theory_rule"
    title: "Правило та алгоритм"
    ruleSummary: "Чітке формулювання правила."
    formulaText: "S = a * b"
    stepByStepBreakdown:
      - "Крок 1: ..."
      - "Крок 2: ..."
  - type: "block_dialogue"
    speaker: "Наставник"
    emote: "idea"
    text: "Коротка репліка-супровід."
  - type: "block_recognition_quiz"
    question: "Питання?"
    options: ["Варіант 1", "Варіант 2"]
    correctIndex: 0
    explanation: "Пояснення."
  - type: "block_notebook_task"
    title: "Практика"
    notebookPrompt: "Умова завдання..."
    correctAnswer: "42"
  - type: "block_boss_challenge"
    title: "Підсумок"
    notebookPrompt: "Самостійна задача..."
    correctAnswer: "100"

## Варіант 2: Швидкі текстові теги
> Факт або контекст
@Наставник [idea]: Репліка діалогу
Теорія: Основне правило
Формула: S = a * b
- Крок 1
? Запитання тесту?
+ Правильний варіант (Пояснення)
- Хибний варіант
[Зошит: Завдання | ключ: result | відповідь: 45 | од: од.]`;
                navigator.clipboard.writeText(promptSpec);
                notify('Промт для генерації чернеток скопійовано!', 'success');
              }}
              className="btn btn-outline text-[11px] font-bold px-2.5 py-1"
            >
              📋 Скопіювати промт для ШІ
            </button>
            <button
              type="button"
              onClick={() => {
                setRawText(sampleShorthand);
                setIsCompiled(false);
              }}
              className="text-[11px] text-[var(--color-primary-dark)] hover:underline font-bold cursor-pointer"
            >
              📋 Вставити приклад чернетки
            </button>
          </div>
        </div>

        <textarea
          rows={8}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setIsCompiled(false);
          }}
          placeholder="Вставте YAML або текстовий сценарій уроку тут..."
          className="input-field font-mono text-xs p-3 leading-relaxed w-full"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="primary" onClick={handleCompile} className="w-full font-bold">
          ⚙️ Скомпілювати та перевірити структуру
        </Button>
      </div>

      {isCompiled && (
        <div className="space-y-3 pt-2">
          {issues.length > 0 ? (
            <div className="status-panel status-panel--danger space-y-2">
              <span className="font-bold flex items-center gap-1">
                ⚠️ Виявлено зауваження до структури ({issues.length}):
              </span>
              <ul className="space-y-1 text-[11px]">
                {issues.map((iss, idx) => (
                  <li key={idx} className="p-2 rounded bg-[var(--color-surface)] border border-[var(--color-danger-border)]">
                    <strong>{iss.path}:</strong> {iss.message}
                    {iss.suggestion && <span className="block italic mt-0.5">💡 Підказка: {iss.suggestion}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="status-panel status-panel--success space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="font-bold">
                  ✅ Урок &quot;{parsedTitle}&quot; готовий ({parsedBlocks.length} етапів)
                </span>
                <Button variant="accent" size="sm" onClick={handleLaunch} className="font-bold">
                  🚀 Інтегрувати урок
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 pt-1 max-h-48 overflow-y-auto">
                {parsedBlocks.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] flex justify-between items-center gap-2"
                  >
                    <span className="font-bold text-[var(--color-primary-dark)] shrink-0">
                      #{idx + 1} {getHumanBlockTypeLabel(b.type)}
                    </span>
                    <span className="text-[var(--color-muted)] truncate max-w-xs">
                      {(b as any).text ||
                        (b as any).ruleSummary ||
                        (b as any).contentSummary ||
                        (b as any).headline ||
                        (b as any).question ||
                        (b as any).notebookPrompt ||
                        (b as any).instruction ||
                        (b as any).title ||
                        'Етап сценарію'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
