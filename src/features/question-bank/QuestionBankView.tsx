import React, { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { RichBlockText } from '../../components/ui/RichBlockText';
import { ContentLoaderService } from '../../services/contentLoaderService';
import { StoryBlock } from '../../core/contracts/campaign.contract';
import { resolveVarsSpec, applyVarsToValue, VarDefinition } from '../../core/vars/var-engine';
import { useProfileStore } from '../../core/state/useProfileStore';
import { stripInlineMarkup } from '../../core/utils/stripInlineMarkup';

export interface QuestionBankFilter {
  subjectId?: string;
  reverseMode?: boolean;
}

interface QuestionBankViewProps {
  selectedGradeId: string;
  selectedSubjectId: string;
  onBackToSubject: () => void;
  onSelectSubject?: (subjectId: string) => void;
}

type DifficultyFilter = 'all' | 'warmup' | 'core' | 'advanced';

interface BankExercise {
  id: string;
  chapterId: string;
  chapterTitle: string;
  subjectCategory: string;
  title: string;
  difficulty: Exclude<DifficultyFilter, 'all'>;
  kind: 'numeric' | 'quiz' | 'theory';
  prompt: string;
  inversePrompt?: string;
  answer?: string;
  inverseAnswer?: string;
  unit?: string;
  inverseUnit?: string;
  hint?: string;
  inverseHint?: string;
  formulaText?: string;
  options?: Array<{ text: string; isCorrect: boolean }>;
  varsSpec?: Record<string, VarDefinition>;
}

interface ParametricInverseTemplate {
  id: string;
  subjectCategory: string;
  chapterTitle: string;
  title: string;
  difficulty: Exclude<DifficultyFilter, 'all'>;
  formulaText: string;
  varsSpec: Record<string, VarDefinition>;
  forwardPrompt: string;
  forwardAnswer: string;
  forwardUnit: string;
  forwardHint: string;
  inversePrompt: string;
  inverseAnswer: string;
  inverseUnit: string;
  inverseHint: string;
}

const PARAMETRIC_BANK_TEMPLATES: ParametricInverseTemplate[] = [
  {
    id: 'tpl-math-perimeter-rect',
    subjectCategory: 'math',
    chapterTitle: 'Периметр і площа',
    title: 'Периметр прямокутної ділянки',
    difficulty: 'warmup',
    formulaText: 'P = 2 · (a + b)  |  b = P / 2 − a',
    varsSpec: {
      a: [6, 18, 2],
      b: [4, 14, 2],
      P: '2 * (a + b)',
    },
    forwardPrompt: 'Довжина прямокутної ділянки дорівнює {{a}} м, а ширина — {{b}} м. Обчисліть її периметр P:',
    forwardAnswer: '{{P}}',
    forwardUnit: 'м',
    forwardHint: 'Додайте довжину й ширину ({{a}} + {{b}}) та помножте на 2.',
    inversePrompt: 'Периметр прямокутної ділянки становить {{P}} м, а її довжина — {{a}} м. Знайдіть невідому ширину b:',
    inverseAnswer: '{{b}}',
    inverseUnit: 'м',
    inverseHint: 'Поділіть периметр {{P}} навпіл (отримаєте півпериметр a + b) та відніміть {{a}} м.',
  },
  {
    id: 'tpl-math-speed-time',
    subjectCategory: 'math',
    chapterTitle: 'Рух: шлях, швидкість, час',
    title: 'Формула шляху та обернена задача',
    difficulty: 'core',
    formulaText: 'S = v · t  |  t = S / v  |  v = S / t',
    varsSpec: {
      v: [40, 80, 10],
      t: [2, 6, 1],
      S: 'v * t',
    },
    forwardPrompt: 'Веломобіль рухався {{t}} год зі сталою швидкістю {{v}} км/год. Який шлях S він подолав?',
    forwardAnswer: '{{S}}',
    forwardUnit: 'км',
    forwardHint: 'Помножте швидкість ({{v}}) на час ({{t}}).',
    inversePrompt: 'Шлях у {{S}} км транспорт подолав за {{t}} год. З якою середньою швидкістю v він рухався?',
    inverseAnswer: '{{v}}',
    inverseUnit: 'км/год',
    inverseHint: 'Щоб знайти швидкість v, поділіть пройдений шлях {{S}} км на час {{t}} год.',
  },
  {
    id: 'tpl-math-area-width',
    subjectCategory: 'math',
    chapterTitle: 'Площа прямокутника',
    title: 'Площа щита й пошук сторони',
    difficulty: 'advanced',
    formulaText: 'S = a · b  |  a = S / b',
    varsSpec: {
      a: [12, 24, 2],
      b: [5, 10, 1],
      S: 'a * b',
    },
    forwardPrompt: 'Дерев’яний щит має довжину {{a}} дм і ширину {{b}} дм. Обчисліть його площу S:',
    forwardAnswer: '{{S}}',
    forwardUnit: 'дм²',
    forwardHint: 'Помножте {{a}} на {{b}}.',
    inversePrompt: 'Площа прямокутного щита становить {{S}} дм², а його ширина — {{b}} дм. Знайдіть довжину a:',
    inverseAnswer: '{{a}}',
    inverseUnit: 'дм',
    inverseHint: 'Поділіть загальну площу {{S}} на відому сторону {{b}}.',
  },
  {
    id: 'tpl-physics-ohm',
    subjectCategory: 'physics',
    chapterTitle: 'Електричне коло',
    title: 'Закон Ома: сила струму та опір',
    difficulty: 'core',
    formulaText: 'I = U / R  |  U = I · R  |  R = U / I',
    varsSpec: {
      I: [2, 6, 1],
      R: [4, 12, 2],
      U: 'I * R',
    },
    forwardPrompt: 'До резистора опором {{R}} Ом приклали напругу {{U}} В. Знайдіть силу струму I в колі:',
    forwardAnswer: '{{I}}',
    forwardUnit: 'А',
    forwardHint: 'За законом Ома I = U / R: поділіть {{U}} на {{R}}.',
    inversePrompt: 'Через резистор тече струм {{I}} А при напрузі {{U}} В. Обчисліть опір R цього резистора:',
    inverseAnswer: '{{R}}',
    inverseUnit: 'Ом',
    inverseHint: 'Обернена формула: R = U / I. Поділіть {{U}} В на {{I}} А.',
  },
];

function inferDifficulty(step: StoryBlock, idx: number): Exclude<DifficultyFilter, 'all'> {
  if (step.type === 'block_boss_challenge' || step.type === 'block_logic_review') return 'advanced';
  if (idx <= 2) return 'warmup';
  return 'core';
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  selectedGradeId,
  selectedSubjectId,
  onBackToSubject,
  onSelectSubject,
}) => {
  const { profile } = useProfileStore();
  const grades = ContentLoaderService.getGrades();
  const currentGrade = grades.find((g) => g.id === selectedGradeId) || grades[4] || grades[0];
  const subjects = currentGrade?.subjects || [];
  const activeSubject =
    ContentLoaderService.getSubjectById(selectedSubjectId, selectedGradeId) || subjects[0];

  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [reverseMode, setReverseMode] = useState<boolean>(false);
  const [variantNonce, setVariantNonce] = useState<number>(0);
  const [showPrintSheet, setShowPrintSheet] = useState<boolean>(false);
  const [includeAnswersInPrint, setIncludeAnswersInPrint] = useState<boolean>(false);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [checkedStatus, setCheckedStatus] = useState<Record<string, 'correct' | 'wrong'>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});

  const profileSeed = String((profile as any).profileSeed || profile.id);
  const activeCategory = (activeSubject?.subjectCategory || activeSubject?.id || '').toLowerCase();

  const { exercises, theoryRules } = useMemo(() => {
    const list: BankExercise[] = [];
    const rules: Array<{ id: string; chapterTitle: string; title: string; summary: string; formula?: string }> = [];

    if (!activeSubject) return { exercises: list, theoryRules: rules };

    const chapters = ContentLoaderService.getChaptersForSubject(activeSubject.id, selectedGradeId);

    chapters.forEach((ch) => {
      const pipeline = ContentLoaderService.getPipelineForChapter(ch.id, activeSubject.id) || [];
      pipeline.forEach((rawStep, idx) => {
        const vars = resolveVarsSpec(rawStep.vars, {
          profileSeed,
          lessonId: rawStep.id || `qb_${ch.id}_${idx}`,
          chapterId: ch.id,
          variantNonce,
        });
        const step: any =
          Object.keys(vars).length > 0 || rawStep.vars ? applyVarsToValue(rawStep, vars) : rawStep;

        if (step.type === 'block_theory_rule' || step.type === 'theory') {
          rules.push({
            id: `${ch.id}_${step.id || idx}`,
            chapterTitle: ch.title,
            title: step.title || ch.title,
            summary: stripInlineMarkup(step.ruleSummary || step.summary || step.text || ''),
            formula: step.formulaText ? stripInlineMarkup(step.formulaText) : undefined,
          });
          return;
        }

        if (
          (step.type === 'block_notebook_task' || step.type === 'block_boss_challenge') &&
          (step.correctAnswer !== undefined || step.expectedValue !== undefined)
        ) {
          const ansVal = step.correctAnswer !== undefined ? step.correctAnswer : step.expectedValue;
          // Auto-derive inverse challenge when `vars` exposes known parts & total
          let inversePrompt: string | undefined;
          let inverseAnswer: string | undefined;
          let inverseHint: string | undefined;
          if (rawStep.vars && vars.totalCm !== undefined && vars.leafCm !== undefined && vars.frameCm !== undefined) {
            inversePrompt = `Обернена задача: Повна ширина хвіртки становить ${vars.totalCm} см, а центральний просвіт і бічні опори додають ${vars.frameCm} см. Знайдіть ширину однієї з двох однакових стулок:`;
            inverseAnswer = String(vars.leafCm);
            inverseHint = `Відніміть ${vars.frameCm} см від повної ширини ${vars.totalCm} см і поділіть на 2 стулки.`;
          }

          list.push({
            id: `${ch.id}_${step.id || idx}`,
            chapterId: ch.id,
            chapterTitle: ch.title,
            subjectCategory: activeCategory,
            title: step.title || 'Практична вправа',
            difficulty: inferDifficulty(step, idx),
            kind: 'numeric',
            prompt: step.notebookPrompt || step.instruction || step.prompt || step.title,
            inversePrompt,
            answer: String(ansVal),
            inverseAnswer,
            unit: step.unit,
            inverseUnit: step.unit,
            hint: step.hint || step.hints?.[0]?.explanation,
            inverseHint,
            varsSpec: rawStep.vars,
          });
        } else if (step.type === 'block_recognition_quiz' && Array.isArray(step.options)) {
          const normalizedOpts = step.options.map((o: any, oIdx: number) => ({
            text: typeof o === 'string' ? o : o?.text || String(o),
            isCorrect:
              typeof o === 'object' && o !== null && o.isCorrect !== undefined
                ? Boolean(o.isCorrect)
                : oIdx === (step.correctIndex ?? 0),
          }));
          list.push({
            id: `${ch.id}_${step.id || idx}`,
            chapterId: ch.id,
            chapterTitle: ch.title,
            subjectCategory: activeCategory,
            title: step.title || 'Тестове завдання',
            difficulty: inferDifficulty(step, idx),
            kind: 'quiz',
            prompt: step.question || step.prompt || 'Оберіть правильну відповідь:',
            options: normalizedOpts,
            hint: step.explanation || step.feedbackSuccess,
          });
        }
      });
    });

    // Inject parametric bidirectional templates matching subject (or all if math/physics)
    PARAMETRIC_BANK_TEMPLATES.filter(
      (tpl) =>
        activeCategory.includes(tpl.subjectCategory) ||
        (tpl.subjectCategory === 'math' && activeCategory === '')
    ).forEach((tpl) => {
      const vars = resolveVarsSpec(tpl.varsSpec, {
        profileSeed,
        lessonId: tpl.id,
        chapterId: activeSubject.id,
        variantNonce,
      });
      const resolvedTpl = applyVarsToValue(tpl, vars);
      list.push({
        id: tpl.id,
        chapterId: 'parametric_generator',
        chapterTitle: tpl.chapterTitle,
        subjectCategory: tpl.subjectCategory,
        title: `${resolvedTpl.title} (Генератор)`,
        difficulty: resolvedTpl.difficulty,
        kind: 'numeric',
        prompt: resolvedTpl.forwardPrompt,
        inversePrompt: resolvedTpl.inversePrompt,
        answer: String(resolvedTpl.forwardAnswer),
        inverseAnswer: String(resolvedTpl.inverseAnswer),
        unit: resolvedTpl.forwardUnit,
        inverseUnit: resolvedTpl.inverseUnit,
        hint: resolvedTpl.forwardHint,
        inverseHint: resolvedTpl.inverseHint,
        formulaText: resolvedTpl.formulaText,
        varsSpec: tpl.varsSpec,
      });
    });

    return { exercises: list, theoryRules: rules };
  }, [activeSubject, selectedGradeId, profileSeed, variantNonce, activeCategory]);

  const chaptersForFilter = useMemo(() => {
    const map = new Map<string, string>();
    exercises.forEach((ex) => {
      if (!map.has(ex.chapterId)) map.set(ex.chapterId, ex.chapterTitle);
    });
    return Array.from(map.entries());
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      if (chapterFilter !== 'all' && ex.chapterId !== chapterFilter) return false;
      if (difficultyFilter !== 'all' && ex.difficulty !== difficultyFilter) return false;
      if (reverseMode && ex.kind === 'numeric' && !ex.inversePrompt) {
        // Keep quizzes or tasks that support reverse prompts when filtered cleanly, or show all if none have inverse
        return true;
      }
      return true;
    });
  }, [exercises, chapterFilter, difficultyFilter, reverseMode]);

  const handleCheckNumeric = (ex: BankExercise) => {
    const expected = reverseMode && ex.inverseAnswer ? ex.inverseAnswer : ex.answer || '';
    const actual = (drafts[ex.id] || '').trim().toLowerCase();
    const isRight = actual !== '' && actual === expected.trim().toLowerCase();
    setCheckedStatus((prev) => ({ ...prev, [ex.id]: isRight ? 'correct' : 'wrong' }));
  };

  return (
    <div className="space-y-4 max-w-[1020px] mx-auto py-2">
      {/* Top Toolbar (Hidden in Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 p-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBackToSubject}>
            ← Назад до предмета
          </Button>
          <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
          <h1 className="text-sm sm:text-base font-extrabold text-[var(--primary-dark)]">
            🧠 Банк задач і генератор варіантів
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setVariantNonce((n) => n + 1);
              setDrafts({});
              setCheckedStatus({});
            }}
            title="Згенерувати новий числовий варіант для задач"
          >
            🎲 Новий варіант чисел
          </Button>
          <Button
            type="button"
            variant={showPrintSheet ? 'accent' : 'primary'}
            size="sm"
            onClick={() => setShowPrintSheet((prev) => !prev)}
          >
            {showPrintSheet ? '← До тренажера' : '🖨️ Ч/Б шпаргалка (А4)'}
          </Button>
        </div>
      </div>

      {/* Filters Bar (Hidden in Print) */}
      <div className="no-print p-3.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-md)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <label className="block space-y-1 text-xs font-bold">
          <span className="text-[11px] text-[var(--text-muted)] uppercase">Предмет</span>
          <select
            value={activeSubject?.id || ''}
            onChange={(e) => {
              setChapterFilter('all');
              if (onSelectSubject) onSelectSubject(e.target.value);
            }}
            className="input-field py-2 px-2.5 text-xs"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.iconName} {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs font-bold">
          <span className="text-[11px] text-[var(--text-muted)] uppercase">Тема</span>
          <select
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            className="input-field py-2 px-2.5 text-xs"
          >
            <option value="all">Усі теми ({exercises.length})</option>
            {chaptersForFilter.map(([cId, cTitle]) => (
              <option key={cId} value={cId}>
                {cTitle}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs font-bold">
          <span className="text-[11px] text-[var(--text-muted)] uppercase">Складність</span>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as DifficultyFilter)}
            className="input-field py-2 px-2.5 text-xs"
          >
            <option value="all">Усі рівні</option>
            <option value="warmup">Розминка</option>
            <option value="core">Базова</option>
            <option value="advanced">Поглиблена / Логіка</option>
          </select>
        </label>

        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={() => {
              setReverseMode((prev) => !prev);
              setDrafts({});
              setCheckedStatus({});
            }}
            aria-pressed={reverseMode}
            className={`px-3 py-2 rounded-[var(--radius-sm)] border text-xs font-extrabold cursor-pointer transition-colors ${
              reverseMode
                ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]'
            }`}
          >
            {reverseMode ? '🔄 Обернені задачі: УВІМК' : '➡️ Режим: Прямі задачі'}
          </button>
        </div>
      </div>

      {/* PRINTABLE A4 B&W CHEAT SHEET VIEW */}
      {showPrintSheet ? (
        <div className="space-y-3">
          <div className="no-print flex flex-wrap items-center justify-between gap-2 p-3 rounded-[var(--radius-sm)] bg-[var(--hl-bg)] border border-[var(--hl-border)] text-[var(--hl-text)] text-xs font-bold">
            <span>
              📄 Попередній перегляд аркуша А4. Під час друку інтерфейс автоматично перейде в економний Ч/Б режим.
            </span>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnswersInPrint}
                  onChange={() => setIncludeAnswersInPrint((v) => !v)}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                <span>Додати ключі відповідей внизу</span>
              </label>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => window.print()}
              >
                🖨️ Друкувати А4 (Ч/Б)
              </Button>
            </div>
          </div>

          <article className="a4-print-sheet p-6 sm:p-8 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-5 text-[var(--text)]">
            <header className="border-b-2 border-[var(--border-hover)] pb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold">
                  Шпаргалка та тренувальний лист: {activeSubject?.name || 'Предмет'}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {currentGrade?.name || '5 клас'} · Варіант #{variantNonce + 1} ·{' '}
                  {reverseMode ? 'Обернені формули та задачі' : 'Базові задачі'}
                </p>
              </div>
              <span className="text-xs font-mono font-bold">Офлайн-аркуш А4</span>
            </header>

            {theoryRules.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wide border-b border-[var(--border)] pb-1">
                  1. Ключові правила та формули
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {theoryRules.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 border border-[var(--border)] rounded-[var(--radius-sm)] space-y-1 break-inside-avoid"
                    >
                      <div className="text-xs font-extrabold">{r.title}</div>
                      {r.formula && (
                        <div className="font-mono text-xs font-extrabold py-1 px-2 border border-[var(--border)] rounded">
                          {r.formula}
                        </div>
                      )}
                      {r.summary && <p className="text-[11px] leading-snug">{r.summary}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wide border-b border-[var(--border)] pb-1">
                2. Тренувальні вправи ({filteredExercises.length})
              </h3>
              <ol className="space-y-2.5 pl-4 list-decimal">
                {filteredExercises.map((ex) => {
                  const activePrompt =
                    reverseMode && ex.inversePrompt ? ex.inversePrompt : ex.prompt;
                  return (
                    <li key={ex.id} className="text-xs leading-relaxed break-inside-avoid">
                      <span className="font-extrabold">{ex.title}.</span>{' '}
                      <span>{stripInlineMarkup(activePrompt)}</span>
                      {ex.kind === 'quiz' && ex.options && (
                        <div className="grid grid-cols-2 gap-1 mt-1 pl-2 text-[11px]">
                          {ex.options.map((o, idx) => (
                            <div key={idx}>
                              {String.fromCharCode(65 + idx)}) {stripInlineMarkup(o.text)}
                            </div>
                          ))}
                        </div>
                      )}
                      {ex.kind === 'numeric' && (
                        <div className="mt-1 font-mono text-[11px]">
                          Відповідь: ____________________ {ex.unit || ''}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            {includeAnswersInPrint && (
              <footer className="pt-3 border-t border-dashed border-[var(--border-hover)] text-[11px] space-y-1">
                <div className="font-extrabold uppercase">Ключі для самоперевірки:</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
                  {filteredExercises.map((ex, idx) => {
                    const ans =
                      ex.kind === 'numeric'
                        ? `${reverseMode && ex.inverseAnswer ? ex.inverseAnswer : ex.answer || ''} ${
                            ex.unit || ''
                          }`.trim()
                        : ex.options
                            ?.map((o, oIdx) => (o.isCorrect ? String.fromCharCode(65 + oIdx) : null))
                            .filter(Boolean)
                            .join(', ') || '';
                    return (
                      <span key={ex.id}>
                        {idx + 1}) {ans}
                      </span>
                    );
                  })}
                </div>
              </footer>
            )}
          </article>
        </div>
      ) : (
        /* INTERACTIVE QUESTION BANK WORKSPACE */
        <div className="space-y-3">
          {filteredExercises.length === 0 ? (
            <div className="p-6 text-center rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-muted)] font-semibold">
              Для вибраного фільтра задачі відсутні. Спробуйте обрати «Усі теми» або інший предмет.
            </div>
          ) : (
            filteredExercises.map((ex, idx) => {
              const isInverseShown = Boolean(reverseMode && ex.inversePrompt);
              const promptText = isInverseShown ? ex.inversePrompt! : ex.prompt;
              const activeUnit = isInverseShown ? ex.inverseUnit || ex.unit : ex.unit;
              const activeHint = isInverseShown ? ex.inverseHint || ex.hint : ex.hint;
              const status = checkedStatus[ex.id];
              const isHintShown = Boolean(revealedHints[ex.id]);

              return (
                <div
                  key={ex.id}
                  className="p-4 sm:p-5 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] shadow-card space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold text-[var(--text-muted)]">
                      <span className="font-mono text-[var(--primary-dark)]">#{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span>{ex.chapterTitle}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {ex.difficulty === 'warmup'
                          ? 'Розминка'
                          : ex.difficulty === 'advanced'
                          ? 'Поглиблена'
                          : 'Базова'}
                      </span>
                      {isInverseShown && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--hl-text)]">🔄 Обернена логіка</span>
                        </>
                      )}
                    </div>

                    {activeHint && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRevealedHints((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))
                        }
                      >
                        {isHintShown ? 'Сховати підказку' : '💡 Підказка'}
                      </Button>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--text)]">
                    {ex.title}
                  </h3>

                  {ex.formulaText && (
                    <div className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] font-mono text-xs font-bold text-[var(--primary-dark)] inline-block">
                      {ex.formulaText}
                    </div>
                  )}

                  <div className="text-xs sm:text-sm font-medium text-[var(--text)] leading-relaxed">
                    <RichBlockText text={promptText} interactiveWidgets={true} />
                  </div>

                  {isHintShown && activeHint && (
                    <div className="status-panel status-panel--neutral text-xs">
                      💡 <RichBlockText text={activeHint} />
                    </div>
                  )}

                  {ex.kind === 'numeric' ? (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={drafts[ex.id] || ''}
                          onChange={(e) => {
                            setDrafts((prev) => ({ ...prev, [ex.id]: e.target.value }));
                            if (checkedStatus[ex.id]) {
                              setCheckedStatus((prev) => {
                                const next = { ...prev };
                                delete next[ex.id];
                                return next;
                              });
                            }
                          }}
                          placeholder="Введіть відповідь..."
                          className="input-field py-2 px-3 text-sm font-mono flex-1"
                        />
                        {activeUnit && (
                          <span className="text-xs font-bold text-[var(--text-muted)] shrink-0">
                            {activeUnit}
                          </span>
                        )}
                      </div>
                      <Button type="button" variant="primary" size="sm" onClick={() => handleCheckNumeric(ex)}>
                        Перевірити
                      </Button>
                    </div>
                  ) : (
                    ex.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {ex.options.map((opt, oIdx) => {
                          const chosen = drafts[ex.id] === String(oIdx);
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => {
                                setDrafts((prev) => ({ ...prev, [ex.id]: String(oIdx) }));
                                setCheckedStatus((prev) => ({
                                  ...prev,
                                  [ex.id]: opt.isCorrect ? 'correct' : 'wrong',
                                }));
                              }}
                              className={`p-2.5 text-left rounded-[var(--radius-sm)] border text-xs font-bold cursor-pointer transition-colors ${
                                chosen
                                  ? opt.isCorrect
                                    ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
                                    : 'bg-[var(--err-bg)] border-[var(--err-border)] text-[var(--err-text)]'
                                  : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]'
                              }`}
                            >
                              <span className="font-mono mr-1.5">{String.fromCharCode(65 + oIdx)}.</span>
                              <RichBlockText text={opt.text} />
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}

                  {status === 'correct' && (
                    <div className="status-panel status-panel--success text-xs font-bold">
                      ✅ Точно! Розв’язання правильне.
                    </div>
                  )}
                  {status === 'wrong' && (
                    <div className="status-panel status-panel--warning text-xs font-bold">
                      ⚠️ Спробуйте ще раз або відкрийте підказку зверху.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
