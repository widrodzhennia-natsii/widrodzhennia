import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../components/ui/Button';
import { RichBlockText } from '../../components/ui/RichBlockText';
import { DialogueCard } from '../story-player/DialogueCard';
import { TextMarkingBlock } from '../story-player/TextMarkingBlock';
import { SomaticPauseModal } from '../story-player/SomaticPauseModal';
import { CopilotBar } from '../story-player/CopilotBar';
import { EngineRegistry } from '../../engines/registry';
import { ContentLoaderService } from '../../services/contentLoaderService';
import { YamlCurriculumParser } from '../../services/yamlCurriculumParser';
import { ContentValidator } from '../../core/ingestion/content-validator';
import { applyVarsToValue, resolveVarsSpec } from '../../core/vars/var-engine';
import { THEME_OPTIONS, ThemeMode } from '../../core/state/useThemeStore';
import { useAuthorGateStore } from '../../core/state/useAuthorGateStore';
import { useProfileStore } from '../../core/state/useProfileStore';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';
import {
  exportCourseToZipDownload,
  exportLessonYamlDownload,
  serializeLessonToYaml,
} from '../../core/export/course-exporter';
import { TagPalettePanel } from './TagPalettePanel';
import { AuthorGuidePanel } from './AuthorGuidePanel';
import { DiagramBuilderForm } from './DiagramBuilderForm';

const QuestGraphLazy = React.lazy(() => import('./QuestGraphLazy'));

interface AuthorStudioProps {
  initialGradeId?: string;
  initialSubjectId?: string;
  onExitStudio: () => void;
  onOpenImportModal: () => void;
}

const ENGINE_CONFIG_PRESETS: Record<string, { instruction: string; config: Record<string, any> }> = {
  'number-line-scales': {
    instruction: 'Налийте у мензурку рівно 140 мл води (ціна поділки — 20 мл).',
    config: { scaleType: 'beaker', min: 0, max: 200, step: 20, initialValue: 40, targetValue: 140, unit: 'мл' },
  },
  'drag-sorter-protocol': {
    instruction: 'Розподіліть приклади на безпечні та підозрілі.',
    config: {
      mode: 'baskets',
      baskets: [
        { id: 'safe', label: 'Безпечно', symbol: '●' },
        { id: 'risk', label: 'Загроза', symbol: '▲' },
      ],
      items: [
        { id: 'i1', text: 'Офіційний шкільний портал', targetBasketId: 'safe' },
        { id: 'i2', text: 'Прохання ввести PIN-код картки', targetBasketId: 'risk' },
      ],
    },
  },
  'place-value-abacus': {
    instruction: 'Виставте на рахівниці десятковий дріб 12,45.',
    config: { allowDecimals: true, initialValue: 0, targetValue: 12.45 },
  },
  'balance-physics': {
    instruction: 'Знайдіть невідоме X, зрівноваживши обидві шальки терезів.',
    config: { mode: 'equation', leftConstant: 7, unknownValue: 15, targetSum: 22, unitLabel: 'од.' },
  },
  'fraction-slicer': {
    instruction: 'Зафарбуйте рівно 3/4 цілого.',
    config: { targetNumerator: 3, targetDenominator: 4 },
  },
  'number-line': {
    instruction: 'Виконайте додавання стрибком на числовому промені.',
    config: { startNumber: 4, addend: 7, max: 20 },
  },
  'protractor-angle': {
    instruction: 'Побудуйте гострий кут 45°.',
    config: { targetAngle: 45, toleranceDegrees: 3 },
  },
  'coordinate-plane': {
    instruction: 'Позначте точку A(4; 3) на координатній площині.',
    config: { targetPoint: { x: 4, y: 3 } },
  },
  'ballistic-trajectory': {
    instruction: 'Налаштуйте кут і заряд для влучання в ціль.',
    config: { targetDistanceMeters: 420, toleranceMeters: 40, gravity: 9.81 },
  },
  'geometry-cannon': {
    instruction: 'Підберіть оптимальний кут запуску.',
    config: { targetDistanceMeters: 350, toleranceMeters: 35 },
  },
  'music-sequencer-ear': {
    instruction: 'Послухайте мелодію та відтворіть її на звуковій панелі.',
    config: {
      mode: 'ear_melody',
      difficulty: 'beginner',
      scale: 'pentatonic',
      tempoBpm: 96,
      targetNotes: ['До', 'Мі', 'Соль', 'До5'],
    },
  },
  'color-perspective-studio': {
    instruction: 'Оберіть дві основні фарби, щоб отримати зелений колір.',
    config: {
      mode: 'color_mix',
      targetColor: 'green',
      availablePigments: ['yellow', 'red', 'blue', 'white', 'black'],
    },
  },
  'circuit-flashlight': {
    instruction: 'Оберіть резистор, щоб струм через LED не перевищував 25 мА.',
    config: { sourceVoltage: 4.5, ledDropVoltage: 2.1, maxSafeCurrentMa: 25, availableResistorsOhm: [47, 150, 470] },
  },
  'timeline-compass-map': {
    instruction: 'Впорядкуйте історичні події від найдавнішої до найновішої.',
    config: { mode: 'timeline', events: ['988: Хрещення Русі', '1648: Початок Визвольної війни', '1991: Незалежність України'] },
  },
  'pixel-embroidery-grid': {
    instruction: 'Відтворіть симетричний орнамент вишиванки по вертикальній осі.',
    config: { size: 6, enforceSymmetry: 'vertical' },
  },
  'column-arithmetic': {
    instruction: 'Виконайте порозрядне додавання чисел у стовпчик.',
    config: { left: 248, right: 175, operation: 'add' },
  },
  'polyhedron-net-3d': {
    instruction: 'Перевірте співвідношення Ейлера V − E + F = 2 для куба.',
    config: { shape: 'cube' },
  },
  'optics-lens-lab': {
    instruction: 'Налаштуйте відстань предмета d, щоб отримати чітке зображення.',
    config: { focalLengthCm: 10, objectDistanceCm: 20 },
  },
  'logic-gates-tracer': {
    instruction: 'Встановіть вхідні сигнали A та B для активації схеми.',
    config: { gateType: 'XOR', targetOutput: 1 },
  },
};

const getUniqueBlockSortIds = (blocks: any[]): string[] => {
  const seen = new Set<string>();
  return blocks.map((blk, idx) => {
    const base = blk?.id ? String(blk.id) : `step_${idx}`;
    let candidate = base;
    let suffix = 1;
    while (seen.has(candidate)) {
      candidate = `${base}__${suffix}`;
      suffix += 1;
    }
    seen.add(candidate);
    return candidate;
  });
};

interface SortableBlockChipProps {
  sortId: string;
  index: number;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

const SortableBlockChip: React.FC<SortableBlockChipProps> = ({
  sortId,
  index,
  label,
  isSelected,
  onSelect,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="inline-flex">
      <Button
        type="button"
        variant={isSelected ? 'primary' : 'outline'}
        size="sm"
        onClick={onSelect}
        title="Натисніть для редагування або перетягніть для зміни порядку"
      >
        ⋮⋮ {index + 1}. {label}
      </Button>
    </div>
  );
};

const BLOCK_TYPE_TEMPLATES: Array<{ type: string; label: string; create: (idx: number) => any }> = [
  {
    type: 'block_dialogue',
    label: '💬 Діалог персонажа',
    create: (i) => ({
      id: `dlg_${i}`,
      type: 'block_dialogue',
      speaker: 'Наставник',
      avatar: '👨‍🏫',
      emote: 'idea',
      text: 'Вітаю! Сьогодні розглянемо нову ідею на практиці.',
    }),
  },
  {
    type: 'block_anchor_fact',
    label: '📜 Контекстний факт',
    create: (i) => ({
      id: `fact_${i}`,
      type: 'block_anchor_fact',
      headline: 'Цікавий контекст',
      locationLabel: 'Довідка',
      contentSummary: 'Пояснення контексту {{deep_dive:title="Детальніше";text="Додаткова довідка"}}.',
    }),
  },
  {
    type: 'block_theory_rule',
    label: '📖 Правило теорії + SVG',
    create: (i) => ({
      id: `theory_${i}`,
      type: 'block_theory_rule',
      title: 'Опорне правило',
      ruleSummary: 'Формула та інтерактивна схема: {{rect_geo:w=6;h=4;unit="см"}}',
      formulaText: 'S = a · b',
      stepByStepBreakdown: ['Визначте відомі величини', 'Підставте у формулу'],
    }),
  },
  {
    type: 'block_text_marking',
    label: '✍️ Розбір тексту (Deferred)',
    create: (i) => ({
      id: `mark_${i}`,
      type: 'block_text_marking',
      title: 'Синтаксичний розбір',
      prompt: 'Позначте підмет і присудок у реченні.',
      sentence: '[[subj:Козаки]] впевнено [[pred:тримали]] оборону.',
      availableTools: ['subj', 'pred'],
      toleranceMode: 'exact',
      explanation: 'Хто? Козаки — підмет; що робили? тримали — присудок.',
    }),
  },
  {
    type: 'block_recognition_quiz',
    label: '🎯 Тест на розуміння',
    create: (i) => ({
      id: `quiz_${i}`,
      type: 'block_recognition_quiz',
      question: 'Оберіть правильне твердження:',
      options: [
        { text: 'Варіант А (точний)', isCorrect: true, feedbackSuccess: 'Саме так!' },
        { text: 'Варіант Б (хибний)', isCorrect: false, feedbackFail: 'Перевірте правило ще раз.' },
      ],
      explanation: 'Пояснення правильної відповіді.',
    }),
  },
  {
    type: 'block_notebook_task',
    label: '📝 Завдання у чернетці',
    create: (i) => ({
      id: `task_${i}`,
      type: 'block_notebook_task',
      title: 'Обчислення у чорновику',
      vars: { a: 'randInt(3, 9)', b: 'randInt(4, 8)', ans: 'a * b' },
      notebookPrompt: 'Знайдіть площу прямокутника зі сторонами {{a}} см і {{b}} см.',
      correctAnswer: '{{ans}}',
      unit: 'см²',
      hint: 'Перемножте сторони.',
    }),
  },
  {
    type: 'block_interactive_sandbox',
    label: '⚙️ Інтерактивний симулятор',
    create: (i) => ({
      id: `sandbox_${i}`,
      type: 'block_interactive_sandbox',
      engineId: 'ballistic-trajectory',
      instruction: 'Налаштуйте кут пострілу і досягніть цілі.',
      engineConfig: { targetDistanceMeters: 420, toleranceMeters: 40, gravity: 9.81 },
    }),
  },
  {
    type: 'block_somatic_pause',
    label: '🌿 Соматична пауза',
    create: (i) => ({
      id: `pause_${i}`,
      type: 'block_somatic_pause',
      activityId: 'vowel_sound_flow',
      durationSec: 20,
      guideVoiceText: 'Спокійний вдих і плавний видих на відкритих голосних А — О — У — І.',
    }),
  },
  {
    type: 'block_boss_challenge',
    label: '🏆 Підсумкова робота',
    create: (i) => ({
      id: `boss_${i}`,
      type: 'block_boss_challenge',
      title: 'Підсумкова перевірка',
      notebookPrompt: 'Обчисліть периметр квадрата зі стороною 7 см.',
      correctAnswer: '28',
      hint: 'P = 4 · a',
    }),
  },
];

export const AuthorStudio: React.FC<AuthorStudioProps> = ({
  initialGradeId,
  initialSubjectId,
  onExitStudio,
  onOpenImportModal,
}) => {
  const { gateMode, pinCode, setGateConfig, lockAuthorSession } = useAuthorGateStore();
  const { profile, resetProfile } = useProfileStore();
  const { notify, confirm } = useFeedbackStore();

  const [refreshTick, setRefreshTick] = useState(0);
  const grades = useMemo(() => ContentLoaderService.getGrades(), [refreshTick]);

  const [selectedGradeId, setSelectedGradeId] = useState(initialGradeId || 'grade_5');
  const activeGrade = useMemo(
    () => grades.find((g) => g.id === selectedGradeId) || grades[4] || grades[0],
    [grades, selectedGradeId]
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState(() => {
    if (initialSubjectId) return initialSubjectId;
    return activeGrade?.subjects[0]?.id || '';
  });

  const activeSubject = useMemo(
    () =>
      activeGrade?.subjects.find((s) => s.id === selectedSubjectId) ||
      activeGrade?.subjects[0],
    [activeGrade, selectedSubjectId]
  );

  const chapters = useMemo(
    () =>
      activeSubject
        ? ContentLoaderService.getChaptersForSubject(activeSubject.id, activeGrade?.id)
        : [],
    [activeSubject, activeGrade, refreshTick]
  );

  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => chapters[0]?.id || '');

  // Ensure valid chapter selected on course change
  useEffect(() => {
    if (chapters.length > 0 && !chapters.some((c) => c.id === selectedChapterId)) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) || chapters[0],
    [chapters, selectedChapterId]
  );

  // Studio UI states
  const [studioTab, setStudioTab] = useState<'editor' | 'guide'>('editor');
  const [editorMode, setEditorMode] = useState<'form' | 'diagram' | 'graph' | 'yaml'>('form');
  const [showGateSettings, setShowGateSettings] = useState(false);
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // New Course quick creator state
  const [newCourseName, setNewCourseName] = useState('Новий авторський курс');
  const [newCourseCategory, setNewCourseCategory] = useState('ukrainian');

  // Gate config form state
  const [draftPin, setDraftPin] = useState(pinCode);

  // Active lesson draft state
  const [lessonId, setLessonId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [lessonStage, setLessonStage] = useState('');
  const [draftBlocks, setDraftBlocks] = useState<any[]>([]);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState(0);
  const [yamlCodeText, setYamlCodeText] = useState('');
  const [yamlParseError, setYamlParseError] = useState<string | null>(null);

  // Preview state
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [previewTheme, setPreviewTheme] = useState<ThemeMode>('cream');
  const [previewStepIdx, setPreviewStepIdx] = useState(0);
  const [previewVariantNonce, setPreviewVariantNonce] = useState(0);
  const [previewUserInput, setPreviewUserInput] = useState('');
  const [previewQuizPick, setPreviewQuizPick] = useState<number | null>(null);
  const [previewSomaticModalOpen, setPreviewSomaticModalOpen] = useState(false);

  // Track active input element for 1-click tag palette insertion
  const activeFieldRef = useRef<{
    element: HTMLTextAreaElement | HTMLInputElement | null;
    apply: (nextVal: string) => void;
  } | null>(null);

  // Sync draft when switching chapters
  useEffect(() => {
    if (!activeChapter) {
      setLessonId(`lesson_${Date.now()}`);
      setLessonTitle('Новий урок');
      setLessonDesc('Опис уроку');
      setLessonStage('');
      setDraftBlocks([BLOCK_TYPE_TEMPLATES[0].create(1)]);
      setSelectedBlockIdx(0);
      setPreviewStepIdx(0);
      return;
    }

    const rawBlocks = ContentLoaderService.getPipelineForChapter(activeChapter.id) || [];
    const cloned = JSON.parse(JSON.stringify(rawBlocks));
    setLessonId(activeChapter.id);
    setLessonTitle(activeChapter.title);
    setLessonDesc(activeChapter.description || '');
    setLessonStage(activeChapter.islandStageName || '');
    setDraftBlocks(cloned);
    setSelectedBlockIdx(0);
    setPreviewStepIdx(0);
    setPreviewSomaticModalOpen(false);
    setYamlParseError(null);
    setYamlCodeText(
      serializeLessonToYaml({
        id: activeChapter.id,
        title: activeChapter.title,
        subjectId: activeSubject?.subjectCategory || activeSubject?.id || 'math',
        gradeId: activeGrade?.id || 'grade_5',
        description: activeChapter.description,
        islandStageName: activeChapter.islandStageName,
        blocks: cloned,
      })
    );
  }, [activeChapter?.id]);

  // Listen to storage refreshes (after DropZone imports)
  useEffect(() => {
    const onStorage = () => setRefreshTick((t) => t + 1);
    window.addEventListener('nush_storage_change', onStorage);
    return () => window.removeEventListener('nush_storage_change', onStorage);
  }, []);

  // Validation diagnostics
  const validation = useMemo(() => {
    return ContentValidator.validateBlocks(draftBlocks);
  }, [draftBlocks]);

  const currentEditBlock = draftBlocks[selectedBlockIdx] || draftBlocks[0];
  const currentPreviewRawBlock = draftBlocks[previewStepIdx] || draftBlocks[0];

  const resolvedPreviewVars = useMemo(() => {
    if (!currentPreviewRawBlock?.vars) return {};
    return resolveVarsSpec(currentPreviewRawBlock.vars, {
      profileSeed: profile.profileSeed || profile.id,
      lessonId: currentPreviewRawBlock.id || `step_${previewStepIdx}`,
      chapterId: lessonId,
      variantNonce: previewVariantNonce,
    });
  }, [currentPreviewRawBlock, profile.profileSeed, profile.id, previewStepIdx, lessonId, previewVariantNonce]);

  const resolvedPreviewBlock = useMemo(() => {
    if (!currentPreviewRawBlock) return null;
    return applyVarsToValue(currentPreviewRawBlock, resolvedPreviewVars);
  }, [currentPreviewRawBlock, resolvedPreviewVars]);

  const updateBlockAt = (idx: number, patch: Record<string, any>) => {
    setDraftBlocks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const blockSortIds = useMemo(() => getUniqueBlockSortIds(draftBlocks), [draftBlocks]);

  const handleDragEndBlocks = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blockSortIds.indexOf(String(active.id));
    const newIndex = blockSortIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const selectedSortId = blockSortIds[selectedBlockIdx];
    const reordered = arrayMove(draftBlocks, oldIndex, newIndex);
    setDraftBlocks(reordered);

    const nextIds = getUniqueBlockSortIds(reordered);
    const nextIdx = selectedSortId ? nextIds.indexOf(selectedSortId) : newIndex;
    const resolvedIdx = nextIdx >= 0 ? nextIdx : newIndex;
    setSelectedBlockIdx(resolvedIdx);
    setPreviewStepIdx(resolvedIdx);
  };

  const handleSwitchEditorMode = (nextMode: 'form' | 'diagram' | 'graph' | 'yaml') => {
    if (nextMode === 'yaml') {
      setYamlCodeText(
        serializeLessonToYaml({
          id: lessonId,
          title: lessonTitle,
          subjectId: activeSubject?.subjectCategory || activeSubject?.id,
          gradeId: activeGrade?.id,
          description: lessonDesc,
          islandStageName: lessonStage,
          blocks: draftBlocks,
        })
      );
      setYamlParseError(null);
    }
    setEditorMode(nextMode);
  };

  const handleYamlChange = (rawText: string) => {
    setYamlCodeText(rawText);
    try {
      const parsed = YamlCurriculumParser.parseQuestYaml(rawText, `${lessonId || 'lesson'}.yaml`);
      if (parsed.title) setLessonTitle(parsed.title);
      if (parsed.description) setLessonDesc(parsed.description);
      if (Array.isArray(parsed.pipeline) && parsed.pipeline.length > 0) {
        setDraftBlocks(parsed.pipeline);
      }
      setYamlParseError(null);
    } catch (err) {
      setYamlParseError((err as Error).message || 'Помилка розбору YAML.');
    }
  };

  const handleInsertSnippet = (snippet: string) => {
    if (editorMode === 'yaml') {
      const ta = activeFieldRef.current?.element;
      if (ta && ta.tagName === 'TEXTAREA') {
        const start = ta.selectionStart ?? yamlCodeText.length;
        const end = ta.selectionEnd ?? yamlCodeText.length;
        const nextYaml = yamlCodeText.slice(0, start) + snippet + yamlCodeText.slice(end);
        handleYamlChange(nextYaml);
        notify('Тег вставлено в YAML.', 'info');
        return;
      }
      setYamlCodeText((prev) => `${prev}\n# ${snippet}`);
      notify('Тег додано в кінець YAML.', 'info');
      return;
    }

    if (activeFieldRef.current?.element) {
      const el = activeFieldRef.current.element;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const nextVal = el.value.slice(0, start) + snippet + el.value.slice(end);
      activeFieldRef.current.apply(nextVal);
      notify('Тег вставлено в активне поле.', 'info');
      return;
    }

    // Fallback: append into main text field of current block
    if (!currentEditBlock) return;
    const targetKey =
      currentEditBlock.ruleSummary !== undefined
        ? 'ruleSummary'
        : currentEditBlock.contentSummary !== undefined
        ? 'contentSummary'
        : currentEditBlock.notebookPrompt !== undefined
        ? 'notebookPrompt'
        : currentEditBlock.sentence !== undefined
        ? 'sentence'
        : 'text';
    updateBlockAt(selectedBlockIdx, {
      [targetKey]: `${String(currentEditBlock[targetKey] || '')} ${snippet}`.trim(),
    });
    notify('Конструкцію додано в текст активного блоку.', 'info');
  };

  const handleSaveLesson = () => {
    if (!activeSubject) return;

    if (activeSubject.isCustom) {
      const ok = ContentLoaderService.upsertChapterInVolume(
        activeSubject.id,
        {
          id: lessonId.trim() || `lesson_${Date.now()}`,
          title: lessonTitle.trim() || 'Навчальний урок',
          description: lessonDesc,
          islandStageName: lessonStage,
        },
        draftBlocks
      );
      if (ok) {
        setRefreshTick((t) => t + 1);
        notify(`Урок «${lessonTitle}» збережено в курсі «${activeSubject.name}»!`, 'success');
      }
      return;
    }

    // Bundled course: safely clone as editable author volume so base curriculum remains intact
    const newCourseTitle = `${activeSubject.name} (Авторська версія)`;
    const res = ContentLoaderService.registerCustomVolume({
      gradeId: activeGrade.id,
      subjectCategory: activeSubject.subjectCategory || activeSubject.id,
      bookTitle: newCourseTitle,
      authorLabel: 'Авторська редакція',
      description: activeSubject.description,
      iconName: activeSubject.iconName,
      quest: {
        id: `${lessonId || 'lesson'}_custom_${Date.now()}`,
        title: lessonTitle.trim() || 'Відредагований урок',
        description: lessonDesc || 'Авторський варіант уроку.',
        islandStageName: lessonStage,
        pipeline: draftBlocks,
      },
      mode: 'create_new_book',
    });

    setRefreshTick((t) => t + 1);
    setSelectedSubjectId(res.volumeId);
    setSelectedChapterId(res.questId);
    notify(`Створено авторську копію курсу «${newCourseTitle}» зі змінами.`, 'success');
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    const firstBlock = BLOCK_TYPE_TEMPLATES[2].create(1);
    const res = ContentLoaderService.registerCustomVolume({
      gradeId: activeGrade.id,
      subjectCategory: newCourseCategory,
      bookTitle: newCourseName.trim(),
      authorLabel: 'Авторський курс вчителя',
      description: 'Власний курс, створений у Студії автора.',
      quest: {
        id: `lesson_${Date.now()}`,
        title: 'Урок 1. Вступ до теми',
        description: 'Перший урок нового курсу.',
        pipeline: [firstBlock],
      },
      mode: 'create_new_book',
    });
    setRefreshTick((t) => t + 1);
    setSelectedSubjectId(res.volumeId);
    setSelectedChapterId(res.questId);
    setShowNewCourseForm(false);
    notify(`Створено курс «${newCourseName.trim()}»!`, 'success');
  };

  const handleCreateLesson = () => {
    if (!activeSubject?.isCustom) {
      notify('Оберіть власний авторський курс або створіть «+ Новий курс», щоб додавати уроки.', 'info');
      return;
    }
    const newId = `lesson_${Date.now()}`;
    const starterBlocks = [BLOCK_TYPE_TEMPLATES[0].create(1), BLOCK_TYPE_TEMPLATES[2].create(2)];
    ContentLoaderService.upsertChapterInVolume(
      activeSubject.id,
      { id: newId, title: `Новий урок ${chapters.length + 1}`, description: 'Опис нового уроку.' },
      starterBlocks
    );
    setRefreshTick((t) => t + 1);
    setSelectedChapterId(newId);
    notify('Додано новий урок до курсу.', 'success');
  };

  const handleMoveChapter = (idx: number, dir: -1 | 1) => {
    if (!activeSubject?.isCustom) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= chapters.length) return;
    const ids = chapters.map((c) => c.id);
    [ids[idx], ids[nextIdx]] = [ids[nextIdx], ids[idx]];
    ContentLoaderService.reorderVolumeChapters(activeSubject.id, ids);
    setRefreshTick((t) => t + 1);
  };

  const handleDeleteCurrentLesson = async () => {
    if (!activeSubject?.isCustom || !activeChapter) return;
    const step1 = await confirm({
      title: 'Видалення уроку (Крок 1 з 2)',
      message: `Ви справді хочете видалити урок «${activeChapter.title}»?`,
      confirmLabel: 'Так, далі',
      cancelLabel: 'Скасувати',
      danger: true,
    });
    if (!step1) return;

    const step2 = await confirm({
      title: 'Остаточне підтвердження (Крок 2 з 2)',
      message: `Цю дію не можна скасувати. Видалити «${activeChapter.title}» назавжди?`,
      confirmLabel: 'Видалити назавжди',
      cancelLabel: 'Залишити',
      danger: true,
    });
    if (!step2) return;

    ContentLoaderService.deleteChapterFromVolume(activeSubject.id, activeChapter.id);
    setRefreshTick((t) => t + 1);
    notify(`Урок «${activeChapter.title}» видалено.`, 'success');
  };

  const handleDeleteCurrentCourse = async () => {
    if (!activeSubject?.isCustom) return;
    const step1 = await confirm({
      title: 'Видалення курсу (Крок 1 з 2)',
      message: `Видалити весь курс «${activeSubject.name}» (${chapters.length} уроків)?`,
      confirmLabel: 'Продовжити',
      cancelLabel: 'Скасувати',
      danger: true,
    });
    if (!step1) return;

    const step2 = await confirm({
      title: 'Підтвердження видалення курсу (Крок 2 з 2)',
      message: `Підтвердьте повне видалення авторського курсу «${activeSubject.name}».`,
      confirmLabel: 'Видалити курс',
      cancelLabel: 'Скасувати',
      danger: true,
    });
    if (!step2) return;

    ContentLoaderService.deleteCustomVolume(activeSubject.id, activeSubject.name);
    setRefreshTick((t) => t + 1);
    notify(`Курс «${activeSubject.name}» видалено.`, 'success');
  };

  const handleResetStudentProgress = async () => {
    const step1 = await confirm({
      title: 'Скидання прогресу учня (Крок 1 з 2)',
      message: 'Усі бали компетенцій, пройдені уроки та записи щоденника буде очищено.',
      confirmLabel: 'Далі',
      cancelLabel: 'Скасувати',
      danger: true,
    });
    if (!step1) return;

    const step2 = await confirm({
      title: 'Підтвердити скидання (Крок 2 з 2)',
      message: 'Повернути профіль учня до початкового стану?',
      confirmLabel: 'Скинути прогрес',
      cancelLabel: 'Скасувати',
      danger: true,
    });
    if (!step2) return;

    resetProfile();
    notify('Прогрес учня скинуто.', 'info');
  };

  const registerFocus = (apply: (val: string) => void) => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      activeFieldRef.current = { element: e.currentTarget, apply };
    },
  });

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto pb-8">
      {/* Studio Top Bar */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onExitStudio}>
            ← Повернутися до навчання
          </Button>
          <span className="font-extrabold text-sm text-[var(--primary-dark)]">
            🛠️ Студія автора та вчителя
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={studioTab === 'editor' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStudioTab('editor')}
          >
            📝 Редактор і прев&apos;ю
          </Button>
          <Button
            type="button"
            variant={studioTab === 'guide' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStudioTab('guide')}
          >
            📖 Довідник автора
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onOpenImportModal}>
            📥 Імпорт (.yaml / .zip)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              exportLessonYamlDownload({
                id: lessonId,
                title: lessonTitle,
                subjectId: activeSubject?.subjectCategory || activeSubject?.id,
                gradeId: activeGrade?.id,
                description: lessonDesc,
                islandStageName: lessonStage,
                blocks: draftBlocks,
              });
              notify('Урок експортовано у .yaml!', 'success');
            }}
          >
            📄 Експорт .yaml
          </Button>
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={() => {
              if (activeSubject && exportCourseToZipDownload(activeSubject.id, activeGrade.id)) {
                notify(`Пакет курсу «${activeSubject.name}» збережено у .zip!`, 'success');
              }
            }}
          >
            📦 Експорт .zip
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowGateSettings((s) => !s)}
          >
            🔐 Захист доступу
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              lockAuthorSession();
              onExitStudio();
              notify('Режим автора заблоковано.', 'info');
            }}
          >
            🔒 Заблокувати
          </Button>
        </div>
      </div>

      {/* Adult Gate Config & Danger Zone Drawer */}
      {showGateSettings && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[var(--primary-dark)]">
              🔐 Налаштування захисного бар&apos;єра та профілю
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowGateSettings(false)}>
              Згорнути
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2">
              <span className="font-bold block">Спосіб перевірки входу до Студії:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={gateMode === 'math' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setGateConfig('math', draftPin);
                    notify('Активовано математичний бар’єр.', 'success');
                  }}
                >
                  🧮 Задача дорослого рівня
                </Button>
                <Button
                  type="button"
                  variant={gateMode === 'pin' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (/^\d{4}$/.test(draftPin)) {
                      setGateConfig('pin', draftPin);
                      notify('Активовано захист за 4-значним PIN.', 'success');
                    } else {
                      notify('PIN має складатися рівно з 4 цифр.', 'warning');
                    }
                  }}
                >
                  🔑 4-значний PIN
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <label className="font-semibold">PIN-код (4 цифри):</label>
                <input
                  type="text"
                  maxLength={4}
                  value={draftPin}
                  onChange={(e) => setDraftPin(e.target.value.replace(/\D+/g, '').slice(0, 4))}
                  className="input-field w-24 text-center font-mono tabular-nums py-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (/^\d{4}$/.test(draftPin)) {
                      setGateConfig(gateMode, draftPin);
                      notify('PIN-код оновлено.', 'success');
                    } else {
                      notify('Введіть 4 цифри для PIN.', 'warning');
                    }
                  }}
                >
                  Зберегти PIN
                </Button>
              </div>
            </div>

            <div className="p-3 bg-[var(--err-bg)] border border-[var(--err-border)] rounded-[var(--radius-sm)] space-y-2 text-[var(--err-text)]">
              <span className="font-bold block">Захищені операції скидання:</span>
              <p className="text-[11px] leading-relaxed">
                Очищення прогресу учня доступне лише тут (із подвійним підтвердженням), щоб дитина випадково не видалила свої досягнення.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleResetStudentProgress}>
                🗑️ Скинути прогрес учня
              </Button>
            </div>
          </div>
        </div>
      )}

      {studioTab === 'guide' ? (
        <AuthorGuidePanel
          onCopySnippet={(snip) => {
            navigator.clipboard?.writeText(snip);
            notify('Приклад скопійовано в буфер обміну!', 'info');
          }}
          onInsertIntoEditor={(snip) => {
            handleInsertSnippet(snip);
            setStudioTab('editor');
          }}
        />
      ) : (
        <>
          {/* Course & Chapter Selector Strip */}
          <div className="card space-y-3">
            <div className="flex flex-wrap items-end gap-3 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-muted)] mb-1">Клас</label>
                <select
                  value={selectedGradeId}
                  onChange={(e) => {
                    const gId = e.target.value;
                    setSelectedGradeId(gId);
                    const g = grades.find((item) => item.id === gId);
                    if (g?.subjects[0]) setSelectedSubjectId(g.subjects[0].id);
                  }}
                  className="input-field py-1.5 text-xs"
                >
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[210px]">
                <label className="block font-bold text-[var(--text-muted)] mb-1">Курс / Предмет</label>
                <select
                  value={activeSubject?.id || ''}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="input-field py-1.5 text-xs w-full"
                >
                  {(activeGrade?.subjects || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.iconName || '📘'} {s.name} ({s.isCustom ? 'Авторський' : 'Шаблон'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[210px]">
                <label className="block font-bold text-[var(--text-muted)] mb-1">Урок ({chapters.length})</label>
                <select
                  value={activeChapter?.id || ''}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="input-field py-1.5 text-xs w-full"
                >
                  {chapters.map((c, idx) => (
                    <option key={c.id} value={c.id}>
                      {idx + 1}. {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCourseForm((v) => !v)}>
                  + Новий курс
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCreateLesson}>
                  + Новий урок
                </Button>
                {activeSubject?.isCustom && activeChapter && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={chapters.findIndex((c) => c.id === activeChapter.id) <= 0}
                      onClick={() => handleMoveChapter(chapters.findIndex((c) => c.id === activeChapter.id), -1)}
                      title="Перемістити урок раніше"
                    >
                      ⬆️
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={chapters.findIndex((c) => c.id === activeChapter.id) >= chapters.length - 1}
                      onClick={() => handleMoveChapter(chapters.findIndex((c) => c.id === activeChapter.id), 1)}
                      title="Перемістити урок пізніше"
                    >
                      ⬇️
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDeleteCurrentLesson}>
                      🗑️ Урок
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDeleteCurrentCourse}>
                      🗑️ Курс
                    </Button>
                  </>
                )}
              </div>
            </div>

            {showNewCourseForm && (
              <form
                onSubmit={handleCreateCourse}
                className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] flex flex-wrap items-end gap-2 text-xs"
              >
                <div className="flex-1 min-w-[200px]">
                  <label className="block font-bold mb-1">Назва нового курсу:</label>
                  <input
                    type="text"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    className="input-field py-1.5 text-xs w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Предмет:</label>
                  <select
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="ukrainian">📖 Українська мова</option>
                    <option value="math">📐 Математика</option>
                    <option value="informatics">💻 Інформатика</option>
                    <option value="cybersecurity">🛡️ Кібербезпека</option>
                    <option value="physics">⚛️ Фізика</option>
                    <option value="science">🌿 Природознавство</option>
                    <option value="history">📜 Історія</option>
                    <option value="music">🎵 Музичне мистецтво</option>
                    <option value="art">🎨 Образотворче мистецтво</option>
                  </select>
                </div>
                <Button type="submit" variant="primary" size="sm">
                  Створити курс
                </Button>
              </form>
            )}
          </div>

          {/* TWO-PANEL STUDIO WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* LEFT PANEL: Form / YAML Editor + Vars + Palette + Diagnostics */}
            <div className="lg:col-span-6 space-y-4">
              <div className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)]">
                    <Button
                      type="button"
                      variant={editorMode === 'form' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleSwitchEditorMode('form')}
                    >
                      🧩 Блоки
                    </Button>
                    <Button
                      type="button"
                      variant={editorMode === 'diagram' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleSwitchEditorMode('diagram')}
                    >
                      🗺️ Діаграми
                    </Button>
                    <Button
                      type="button"
                      variant={editorMode === 'graph' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleSwitchEditorMode('graph')}
                    >
                      🕸️ Граф квесту
                    </Button>
                    <Button
                      type="button"
                      variant={editorMode === 'yaml' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleSwitchEditorMode('yaml')}
                    >
                      📄 Прямий YAML
                    </Button>
                  </div>

                  <Button type="button" variant="accent" size="sm" onClick={handleSaveLesson}>
                    💾 Зберегти зміни
                  </Button>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] mb-1">Назва уроку</label>
                    <input
                      type="text"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      className="input-field py-1.5 text-xs w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-muted)] mb-1">Короткий опис</label>
                    <input
                      type="text"
                      value={lessonDesc}
                      onChange={(e) => setLessonDesc(e.target.value)}
                      className="input-field py-1.5 text-xs w-full"
                    />
                  </div>
                </div>

                {/* 1-Click Tag & Widget Palette */}
                <TagPalettePanel onInsertSnippet={handleInsertSnippet} />

                {editorMode === 'yaml' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs">
                      <span className="font-bold text-[var(--primary-dark)]">
                        Передпублікаційний редактор YAML ({draftBlocks.length} блоків ·{' '}
                        {validation.isValid && !yamlParseError ? 'готово до експорту' : 'потребує перевірки'})
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSwitchEditorMode('yaml')}
                        >
                          🔄 Оновити з конструктора
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="accent"
                          disabled={Boolean(yamlParseError) || !validation.isValid}
                          onClick={() => {
                            exportLessonYamlDownload({
                              id: lessonId,
                              title: lessonTitle,
                              subjectId: activeSubject?.subjectCategory || activeSubject?.id,
                              gradeId: activeGrade?.id,
                              description: lessonDesc,
                              islandStageName: lessonStage,
                              blocks: draftBlocks,
                            });
                            notify('YAML перевірено й експортовано!', 'success');
                          }}
                        >
                          📤 Опублікувати .yaml
                        </Button>
                      </div>
                    </div>
                    <textarea
                      value={yamlCodeText}
                      onChange={(e) => handleYamlChange(e.target.value)}
                      {...registerFocus((next) => handleYamlChange(next))}
                      rows={18}
                      spellCheck={false}
                      className="input-field w-full font-mono text-xs leading-relaxed"
                    />
                    {yamlParseError && (
                      <div className="status-panel status-panel--warning text-xs">{yamlParseError}</div>
                    )}
                  </div>
                ) : editorMode === 'diagram' ? (
                  <DiagramBuilderForm
                    onInsertSnippet={(snippet) => {
                      handleInsertSnippet(snippet);
                      setEditorMode('form');
                    }}
                  />
                ) : editorMode === 'graph' ? (
                  <Suspense
                    fallback={
                      <div className="p-6 text-center text-xs font-bold text-[var(--text-muted)] border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                        Завантаження модуля вузлового графа (@xyflow/react)...
                      </div>
                    }
                  >
                    <QuestGraphLazy
                      blocks={draftBlocks}
                      selectedIndex={selectedBlockIdx}
                      onSelectBlock={(idx) => {
                        setSelectedBlockIdx(idx);
                        setPreviewStepIdx(idx);
                      }}
                      onUpdateBlocks={setDraftBlocks}
                    />
                  </Suspense>
                ) : (
                  <div className="space-y-3">
                    {/* Blocks strip + Drag & Drop + Add Block */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-[var(--primary-dark)]">
                          Етапи уроку ({draftBlocks.length}) · перетягуйте картки для зміни порядку:
                        </span>
                        <select
                          value=""
                          onChange={(e) => {
                            const tpl = BLOCK_TYPE_TEMPLATES.find((t) => t.type === e.target.value);
                            if (tpl) {
                              const nextBlock = tpl.create(draftBlocks.length + 1);
                              setDraftBlocks((prev) => [...prev, nextBlock]);
                              setSelectedBlockIdx(draftBlocks.length);
                              setPreviewStepIdx(draftBlocks.length);
                            }
                          }}
                          className="input-field py-1 text-xs font-bold"
                        >
                          <option value="">+ Додати блок...</option>
                          {BLOCK_TYPE_TEMPLATES.map((t) => (
                            <option key={t.type} value={t.type}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEndBlocks}
                      >
                        <SortableContext items={blockSortIds} strategy={rectSortingStrategy}>
                          <div className="flex flex-wrap gap-1.5">
                            {draftBlocks.map((blk, idx) => (
                              <SortableBlockChip
                                key={blockSortIds[idx]}
                                sortId={blockSortIds[idx]}
                                index={idx}
                                label={String(blk.type || '').replace('block_', '')}
                                isSelected={selectedBlockIdx === idx}
                                onSelect={() => {
                                  setSelectedBlockIdx(idx);
                                  setPreviewStepIdx(idx);
                                }}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>

                    {/* Selected Block Form Editor */}
                    {currentEditBlock && (
                      <div className="p-3.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[var(--radius-sm)] space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-[var(--primary-dark)]">
                            Редагування блоку #{selectedBlockIdx + 1} ({currentEditBlock.type})
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={selectedBlockIdx === 0}
                              onClick={() => {
                                setDraftBlocks((prev) => {
                                  const next = [...prev];
                                  [next[selectedBlockIdx - 1], next[selectedBlockIdx]] = [
                                    next[selectedBlockIdx],
                                    next[selectedBlockIdx - 1],
                                  ];
                                  return next;
                                });
                                setSelectedBlockIdx((i) => Math.max(0, i - 1));
                              }}
                            >
                              ⬆️
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={draftBlocks.length <= 1}
                              onClick={() => {
                                setDraftBlocks((prev) => prev.filter((_, i) => i !== selectedBlockIdx));
                                setSelectedBlockIdx((i) => Math.max(0, i - 1));
                              }}
                            >
                              🗑️
                            </Button>
                          </div>
                        </div>

                        {currentEditBlock.type === 'block_dialogue' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block font-bold mb-1">Персонаж</label>
                              <input
                                type="text"
                                value={currentEditBlock.speaker || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { speaker: e.target.value })}
                                className="input-field py-1 text-xs w-full"
                              />
                            </div>
                            <div>
                              <label className="block font-bold mb-1">Емоція</label>
                              <select
                                value={currentEditBlock.emote || 'idea'}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { emote: e.target.value })}
                                className="input-field py-1 text-xs w-full"
                              >
                                <option value="idea">💡 idea</option>
                                <option value="joy">😊 joy</option>
                                <option value="question">❓ question</option>
                                <option value="sweat">😅 sweat</option>
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block font-bold mb-1">Текст репліки</label>
                              <textarea
                                rows={3}
                                value={currentEditBlock.text || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { text: e.target.value })}
                                {...registerFocus((v) => updateBlockAt(selectedBlockIdx, { text: v }))}
                                className="input-field text-xs w-full"
                              />
                            </div>
                          </div>
                        )}

                        {(currentEditBlock.type === 'block_theory_rule' || currentEditBlock.type === 'block_anchor_fact') && (
                          <div className="space-y-2">
                            <div>
                              <label className="block font-bold mb-1">Заголовок</label>
                              <input
                                type="text"
                                value={currentEditBlock.title || currentEditBlock.headline || ''}
                                onChange={(e) =>
                                  updateBlockAt(selectedBlockIdx, {
                                    title: e.target.value,
                                    headline: e.target.value,
                                  })
                                }
                                className="input-field py-1 text-xs w-full"
                              />
                            </div>
                            <div>
                              <label className="block font-bold mb-1">Текст / теорія (можна вставляти SVG і теги)</label>
                              <textarea
                                rows={4}
                                value={currentEditBlock.ruleSummary || currentEditBlock.contentSummary || ''}
                                onChange={(e) =>
                                  updateBlockAt(
                                    selectedBlockIdx,
                                    currentEditBlock.type === 'block_theory_rule'
                                      ? { ruleSummary: e.target.value }
                                      : { contentSummary: e.target.value }
                                  )
                                }
                                {...registerFocus((v) =>
                                  updateBlockAt(
                                    selectedBlockIdx,
                                    currentEditBlock.type === 'block_theory_rule'
                                      ? { ruleSummary: v }
                                      : { contentSummary: v }
                                  )
                                )}
                                className="input-field text-xs w-full"
                              />
                            </div>
                          </div>
                        )}

                        {currentEditBlock.type === 'block_text_marking' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block font-bold mb-1">Умова завдання (prompt)</label>
                              <input
                                type="text"
                                value={currentEditBlock.prompt || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { prompt: e.target.value })}
                                className="input-field py-1 text-xs w-full"
                              />
                            </div>
                            <div>
                              <label className="block font-bold mb-1">Еталон речення з мітками [[role:слово]]</label>
                              <textarea
                                rows={2}
                                value={currentEditBlock.sentence || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { sentence: e.target.value })}
                                {...registerFocus((v) => updateBlockAt(selectedBlockIdx, { sentence: v }))}
                                className="input-field text-xs w-full font-mono"
                              />
                            </div>
                            <div>
                              <label className="block font-bold mb-1">Інструменти (через кому: subj, pred, attr, obj, adv, ortho...)</label>
                              <input
                                type="text"
                                value={(currentEditBlock.availableTools || []).join(', ')}
                                onChange={(e) =>
                                  updateBlockAt(selectedBlockIdx, {
                                    availableTools: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="input-field py-1 text-xs w-full font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {(currentEditBlock.type === 'block_notebook_task' || currentEditBlock.type === 'block_boss_challenge') && (
                          <div className="space-y-2">
                            <div>
                              <label className="block font-bold mb-1">Умова задачі</label>
                              <textarea
                                rows={3}
                                value={currentEditBlock.notebookPrompt || currentEditBlock.instruction || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { notebookPrompt: e.target.value })}
                                {...registerFocus((v) => updateBlockAt(selectedBlockIdx, { notebookPrompt: v }))}
                                className="input-field text-xs w-full"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block font-bold mb-1">Очікувана відповідь</label>
                                <input
                                  type="text"
                                  value={String(currentEditBlock.correctAnswer ?? '')}
                                  onChange={(e) => updateBlockAt(selectedBlockIdx, { correctAnswer: e.target.value })}
                                  className="input-field py-1 text-xs w-full font-mono"
                                />
                              </div>
                              <div>
                                <label className="block font-bold mb-1">Підказка для дорослого (copilot)</label>
                                <input
                                  type="text"
                                  value={String(currentEditBlock.copilotAdvice || currentEditBlock.copilotHint || '')}
                                  onChange={(e) => updateBlockAt(selectedBlockIdx, { copilotAdvice: e.target.value })}
                                  className="input-field py-1 text-xs w-full"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {currentEditBlock.type === 'block_recognition_quiz' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block font-bold mb-1">Запитання тесту</label>
                              <input
                                type="text"
                                value={currentEditBlock.question || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { question: e.target.value })}
                                {...registerFocus((v) => updateBlockAt(selectedBlockIdx, { question: v }))}
                                className="input-field py-1 text-xs w-full"
                              />
                            </div>
                            <div>
                              <label className="block font-bold mb-1">Пояснення</label>
                              <input
                                type="text"
                                value={currentEditBlock.explanation || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { explanation: e.target.value })}
                                className="input-field py-1 text-xs w-full"
                              />
                            </div>
                          </div>
                        )}

                        {currentEditBlock.type === 'block_interactive_sandbox' && (() => {
                          const allEngines = EngineRegistry.getAllEngines().filter(
                            (e) => e.engineId !== 'khortytsia-cannon' && e.engineId !== 'measurement-scales'
                          );
                          const cfg = {
                            ...(currentEditBlock.engineConfig || {}),
                            ...(currentEditBlock.config || {}),
                          };
                          const patchEngineConfig = (patch: Record<string, any>) => {
                            const nextCfg = { ...cfg, ...patch };
                            updateBlockAt(selectedBlockIdx, {
                              config: nextCfg,
                              engineConfig: nextCfg,
                            });
                          };
                          const engId = currentEditBlock.engineId || 'balance-physics';

                          return (
                            <div className="space-y-2.5">
                              <div>
                                <label className="block font-bold mb-1">Інструкція</label>
                                <input
                                  type="text"
                                  value={currentEditBlock.instruction || ''}
                                  onChange={(e) => updateBlockAt(selectedBlockIdx, { instruction: e.target.value })}
                                  {...registerFocus((v) => updateBlockAt(selectedBlockIdx, { instruction: v }))}
                                  className="input-field py-1 text-xs w-full"
                                />
                              </div>

                              <div className="flex flex-wrap items-end gap-2">
                                <div className="flex-1 min-w-[180px]">
                                  <label className="block font-bold mb-1">Інтерактивний рушій</label>
                                  <select
                                    value={engId}
                                    onChange={(e) => updateBlockAt(selectedBlockIdx, { engineId: e.target.value })}
                                    className="input-field py-1 text-xs w-full"
                                  >
                                    {allEngines.map((eng) => (
                                      <option key={eng.engineId} value={eng.engineId}>
                                        {eng.title} ({eng.engineId})
                                      </option>
                                    ))}
                                    {!allEngines.some((e) => e.engineId === engId) && (
                                      <option value={engId}>{engId}</option>
                                    )}
                                  </select>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const preset = ENGINE_CONFIG_PRESETS[engId];
                                    if (!preset) return;
                                    updateBlockAt(selectedBlockIdx, {
                                      instruction: preset.instruction,
                                      config: preset.config,
                                      engineConfig: preset.config,
                                    });
                                    notify('Застосовано шаблон параметрів рушія.', 'info');
                                  }}
                                >
                                  ⚡ Шаблон конфігу
                                </Button>
                              </div>

                              {/* Structured Wave 1 visual quick-controls */}
                              {engId === 'number-line-scales' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-[var(--surface-alt)] rounded border border-[var(--border)]">
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Прилад</label>
                                    <select
                                      value={cfg.scaleType || 'thermometer'}
                                      onChange={(e) => patchEngineConfig({ scaleType: e.target.value })}
                                      className="input-field py-1 text-xs w-full"
                                    >
                                      <option value="thermometer">🌡️ Термометр</option>
                                      <option value="beaker">🧪 Мензурка</option>
                                      <option value="clock">🕒 Годинник</option>
                                      <option value="ruler">📏 Лінійка</option>
                                    </select>
                                  </div>
                                  {cfg.scaleType === 'clock' ? (
                                    <>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Цільова год.</label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={12}
                                          value={cfg.targetHour ?? 3}
                                          onChange={(e) => patchEngineConfig({ targetHour: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Цільова хв.</label>
                                        <input
                                          type="number"
                                          min={0}
                                          max={59}
                                          value={cfg.targetMinute ?? 30}
                                          onChange={(e) => patchEngineConfig({ targetMinute: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Ціна поділки (step)</label>
                                        <input
                                          type="number"
                                          step="0.5"
                                          value={cfg.step ?? 2}
                                          onChange={(e) => patchEngineConfig({ step: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Ціль (targetValue)</label>
                                        <input
                                          type="number"
                                          value={cfg.targetValue ?? 20}
                                          onChange={(e) => patchEngineConfig({ targetValue: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Мін</label>
                                        <input
                                          type="number"
                                          value={cfg.min ?? 0}
                                          onChange={(e) => patchEngineConfig({ min: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Макс</label>
                                        <input
                                          type="number"
                                          value={cfg.max ?? 100}
                                          onChange={(e) => patchEngineConfig({ max: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Одиниця</label>
                                        <input
                                          type="text"
                                          value={cfg.unit ?? '°C'}
                                          onChange={(e) => patchEngineConfig({ unit: e.target.value })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {engId === 'place-value-abacus' && (
                                <div className="grid grid-cols-3 gap-2 p-2 bg-[var(--surface-alt)] rounded border border-[var(--border)]">
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Цільове число</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={cfg.targetValue ?? 1245}
                                      onChange={(e) => patchEngineConfig({ targetValue: Number(e.target.value) })}
                                      className="input-field py-1 text-xs w-full"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Початкове</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={cfg.initialValue ?? 0}
                                      onChange={(e) => patchEngineConfig({ initialValue: Number(e.target.value) })}
                                      className="input-field py-1 text-xs w-full"
                                    />
                                  </div>
                                  <label className="flex items-center gap-1.5 text-[11px] font-bold pt-4 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(cfg.allowDecimals)}
                                      onChange={(e) => patchEngineConfig({ allowDecimals: e.target.checked })}
                                    />
                                    <span>Десяткові</span>
                                  </label>
                                </div>
                              )}

                              {engId === 'balance-physics' && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-[var(--surface-alt)] rounded border border-[var(--border)]">
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Режим</label>
                                    <select
                                      value={cfg.mode || 'sums'}
                                      onChange={(e) => patchEngineConfig({ mode: e.target.value })}
                                      className="input-field py-1 text-xs w-full"
                                    >
                                      <option value="sums">Сума чисел</option>
                                      <option value="equation">Рівняння з X</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Права шалька</label>
                                    <input
                                      type="number"
                                      value={cfg.targetSum ?? 15}
                                      onChange={(e) => patchEngineConfig({ targetSum: Number(e.target.value) })}
                                      className="input-field py-1 text-xs w-full"
                                    />
                                  </div>
                                  {cfg.mode === 'equation' && (
                                    <>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Константа ліворуч</label>
                                        <input
                                          type="number"
                                          value={cfg.leftConstant ?? 5}
                                          onChange={(e) => patchEngineConfig({ leftConstant: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Значення X</label>
                                        <input
                                          type="number"
                                          value={cfg.unknownValue ?? 10}
                                          onChange={(e) => patchEngineConfig({ unknownValue: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {engId === 'music-sequencer-ear' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-[var(--surface-alt)] rounded border border-[var(--border)]">
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Режим</label>
                                    <select
                                      value={cfg.mode || 'ear_melody'}
                                      onChange={(e) => patchEngineConfig({ mode: e.target.value })}
                                      className="input-field py-1 text-xs w-full"
                                    >
                                      <option value="ear_melody">🎼 Слуховий диктант (мелодія)</option>
                                      <option value="rhythm_grid">🥁 Ритмічна сітка</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Віковий профіль (класи)</label>
                                    <select
                                      value={cfg.gradeBand || '5-7'}
                                      onChange={(e) => patchEngineConfig({ gradeBand: e.target.value })}
                                      className="input-field py-1 text-xs w-full"
                                    >
                                      <option value="1-4">1–4 класи (пульс, пентатоніка)</option>
                                      <option value="5-7">5–7 класи (лади, 1/8 долі)</option>
                                      <option value="8-12">8–12 класи (синкопи, 1/16, складні темпи)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Темп (BPM)</label>
                                    <input
                                      type="number"
                                      min={60}
                                      max={176}
                                      step={4}
                                      value={cfg.tempoBpm ?? 96}
                                      onChange={(e) => patchEngineConfig({ tempoBpm: Number(e.target.value) })}
                                      className="input-field py-1 text-xs w-full"
                                    />
                                  </div>
                                  {cfg.mode === 'rhythm_grid' ? (
                                    <div>
                                      <label className="block text-[10px] font-bold mb-0.5">Розмір такту</label>
                                      <select
                                        value={cfg.timeSignature || '4/4'}
                                        onChange={(e) => patchEngineConfig({ timeSignature: e.target.value })}
                                        className="input-field py-1 text-xs w-full"
                                      >
                                        <option value="2/4">2/4</option>
                                        <option value="3/4">3/4</option>
                                        <option value="4/4">4/4</option>
                                        <option value="6/8">6/8</option>
                                      </select>
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Складність</label>
                                        <select
                                          value={cfg.difficulty || 'beginner'}
                                          onChange={(e) => patchEngineConfig({ difficulty: e.target.value })}
                                          className="input-field py-1 text-xs w-full"
                                        >
                                          <option value="beginner">Початковий (приклад + підбір)</option>
                                          <option value="intermediate">Середній (без підказки висоти)</option>
                                          <option value="advanced">Складний (сліпий диктант)</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Лад</label>
                                        <select
                                          value={cfg.scale || 'pentatonic'}
                                          onChange={(e) => patchEngineConfig({ scale: e.target.value })}
                                          className="input-field py-1 text-xs w-full"
                                        >
                                          <option value="pentatonic">Пентатоніка (6 нот)</option>
                                          <option value="major">Мажорна гама (8 нот)</option>
                                          <option value="minor">Мінорна гама (8 нот)</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Тембр</label>
                                        <select
                                          value={cfg.timbre || 'piano'}
                                          onChange={(e) => patchEngineConfig({ timbre: e.target.value })}
                                          className="input-field py-1 text-xs w-full"
                                        >
                                          <option value="piano">Фортепіано / Piano</option>
                                          <option value="marimba">Маримба / Marimba</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Тривалість за замовч.</label>
                                        <select
                                          value={cfg.subdivision || 'quarter'}
                                          onChange={(e) => patchEngineConfig({ subdivision: e.target.value })}
                                          className="input-field py-1 text-xs w-full"
                                        >
                                          <option value="quarter">Четвертні (♩ 1/4)</option>
                                          <option value="eighth">Восьмі (♪ 1/8)</option>
                                          <option value="mixed">Змішана (за кроками)</option>
                                        </select>
                                      </div>
                                      <label className="flex items-center gap-1.5 text-[11px] font-bold pt-4 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(cfg.strictSequential)}
                                          onChange={(e) => patchEngineConfig({ strictSequential: e.target.checked })}
                                        />
                                        <span>Послідовний запис (без заміни)</span>
                                      </label>
                                    </>
                                  )}
                                  <label className="flex items-center gap-1.5 text-[11px] font-bold pt-4 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={cfg.allowTempoControl !== false}
                                      onChange={(e) => patchEngineConfig({ allowTempoControl: e.target.checked })}
                                    />
                                    <span>Дозволити перемикач темпу (0.75×–1.25×)</span>
                                  </label>
                                </div>
                              )}

                              {engId === 'color-perspective-studio' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-[var(--surface-alt)] rounded border border-[var(--border)]">
                                  <div>
                                    <label className="block text-[10px] font-bold mb-0.5">Режим</label>
                                    <select
                                      value={cfg.mode || 'color_mix'}
                                      onChange={(e) => patchEngineConfig({ mode: e.target.value })}
                                      className="input-field py-1 text-xs w-full"
                                    >
                                      <option value="color_mix">🎨 Коло Іттена (змішування)</option>
                                      <option value="perspective">🛤️ Лінійна перспектива</option>
                                      <option value="shading">🌗 Світлотінь та штрихування</option>
                                    </select>
                                  </div>
                                  {(cfg.mode || 'color_mix') === 'color_mix' && (
                                    <div>
                                      <label className="block text-[10px] font-bold mb-0.5">Цільовий колір</label>
                                      <select
                                        value={cfg.targetColor || 'green'}
                                        onChange={(e) => patchEngineConfig({ targetColor: e.target.value })}
                                        className="input-field py-1 text-xs w-full"
                                      >
                                        <option value="green">Зелений (Жовтий + Синій)</option>
                                        <option value="orange">Помаранчевий (Жовтий + Червоний)</option>
                                        <option value="purple">Фіолетовий (Червоний + Синій)</option>
                                        <option value="sky_blue">Блакитний (Синій + Білий)</option>
                                        <option value="pink">Рожевий (Червоний + Білий)</option>
                                        <option value="gray">Сірий (Білий + Чорний)</option>
                                      </select>
                                    </div>
                                  )}
                                  {cfg.mode === 'perspective' && (
                                    <>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Горизонт (%)</label>
                                        <input
                                          type="number"
                                          min={20}
                                          max={80}
                                          value={cfg.targetHorizon ?? 38}
                                          onChange={(e) => patchEngineConfig({ targetHorizon: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-0.5">Точка сходу F (%)</label>
                                        <input
                                          type="number"
                                          min={15}
                                          max={85}
                                          value={cfg.targetVanishing ?? 50}
                                          onChange={(e) => patchEngineConfig({ targetVanishing: Number(e.target.value) })}
                                          className="input-field py-1 text-xs w-full"
                                        />
                                      </div>
                                    </>
                                  )}
                                  {cfg.mode === 'shading' && (
                                    <div>
                                      <label className="block text-[10px] font-bold mb-0.5">Кут світла (°)</label>
                                      <input
                                        type="number"
                                        min={20}
                                        max={160}
                                        value={cfg.targetLightAngle ?? 40}
                                        onChange={(e) => patchEngineConfig({ targetLightAngle: Number(e.target.value) })}
                                        className="input-field py-1 text-xs w-full"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              <div>
                                <label className="block font-bold mb-1">JSON-конфігурація (engineConfig)</label>
                                <textarea
                                  rows={4}
                                  value={JSON.stringify(cfg, null, 2)}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      if (parsed && typeof parsed === 'object') {
                                        updateBlockAt(selectedBlockIdx, {
                                          config: parsed,
                                          engineConfig: parsed,
                                        });
                                      }
                                    } catch {
                                      // Wait until valid JSON while typing
                                    }
                                  }}
                                  className="input-field py-1.5 text-[11px] font-mono w-full leading-snug"
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {currentEditBlock.type === 'block_somatic_pause' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block font-bold mb-1">Вправа</label>
                              <select
                                value={currentEditBlock.activityId || 'double_sigh'}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { activityId: e.target.value })}
                                className="input-field py-1 text-xs w-full"
                              >
                                <option value="double_sigh">double_sigh</option>
                                <option value="vowel_sound_flow">vowel_sound_flow</option>
                                <option value="eye_eight">eye_eight</option>
                                <option value="muscle_squeeze">muscle_squeeze</option>
                                <option value="vocal_humming">vocal_humming</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-bold mb-1">Тривалість (с)</label>
                              <input
                                type="number"
                                value={currentEditBlock.durationSec || 25}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { durationSec: Number(e.target.value) })}
                                className="input-field py-1 text-xs w-full font-mono"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block font-bold mb-1">Текст супроводу (guideVoiceText)</label>
                              <input
                                type="text"
                                value={currentEditBlock.guideVoiceText || ''}
                                onChange={(e) => updateBlockAt(selectedBlockIdx, { guideVoiceText: e.target.value })}
                                className="input-field py-1 text-xs w-full"
                              />
                            </div>
                          </div>
                        )}

                        {/* Vars Live Tester */}
                        <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-[var(--primary-dark)]">
                              🎲 Змінні блоку (vars)
                            </span>
                            <div className="flex gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const nextVars = {
                                    ...(currentEditBlock.vars || {}),
                                    a: 'randInt(3, 12)',
                                    b: 'randInt(4, 9)',
                                  };
                                  updateBlockAt(selectedBlockIdx, { vars: nextVars });
                                }}
                              >
                                + Приклад vars
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewVariantNonce((n) => n + 1)}
                              >
                                🔄 Перегенерувати
                              </Button>
                            </div>
                          </div>
                          {currentEditBlock.vars && (
                            <div className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded font-mono text-[11px] tabular-nums">
                              Тест-значення: {JSON.stringify(resolvedPreviewVars)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Real-Time Zod & Parity Validator */}
                <div className="pt-2 border-t border-[var(--border)] space-y-1.5 text-xs">
                  <span className="font-extrabold text-[var(--primary-dark)] block">
                    🛡️ Діагностика схеми та паритету інструментів:
                  </span>
                  {validation.isValid ? (
                    <div className="status-panel status-panel--success text-xs">
                      ✅ Усі {draftBlocks.length} блоків пройшли валідацію без помилок!
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {validation.issues.map((iss, i) => (
                        <div key={i} className="status-panel status-panel--warning text-xs space-y-0.5">
                          <strong>{iss.path}</strong>
                          <div>{iss.message}</div>
                          {iss.suggestion && (
                            <div className="text-[11px] opacity-85">Порада: {iss.suggestion}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Live Isolated Preview (PC / Mobile + 8 Themes) */}
            <div className="lg:col-span-6 space-y-3">
              <div className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border)] text-xs">
                  <span className="font-extrabold text-[var(--primary-dark)]">
                    👁️ Живий попередній перегляд ({previewStepIdx + 1} / {Math.max(1, draftBlocks.length)})
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant={previewWidth === 'desktop' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewWidth('desktop')}
                      >
                        🖥️ ПК
                      </Button>
                      <Button
                        type="button"
                        variant={previewWidth === 'mobile' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewWidth('mobile')}
                      >
                        📱 375px
                      </Button>
                    </div>

                    <select
                      value={previewTheme}
                      onChange={(e) => setPreviewTheme(e.target.value as ThemeMode)}
                      className="input-field py-1 text-xs font-bold"
                      aria-label="Тема попереднього перегляду"
                    >
                      {THEME_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>
                          🎨 {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Preview step switcher */}
                <div className="flex flex-wrap gap-1.5">
                  {draftBlocks.map((_, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant={previewStepIdx === idx ? 'accent' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setPreviewStepIdx(idx);
                        setSelectedBlockIdx(idx);
                        setPreviewQuizPick(null);
                        setPreviewUserInput('');
                      }}
                    >
                      Крок {idx + 1}
                    </Button>
                  ))}
                </div>

                {/* Isolated Preview Viewport with data-theme and optional mono grayscale */}
                <div className="flex justify-center p-2 bg-[var(--surface-alt)] rounded-[var(--radius-sm)] border border-[var(--border)] overflow-x-auto">
                  <div
                    data-theme={previewTheme}
                    style={{
                      width: previewWidth === 'mobile' ? '375px' : '100%',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      filter: previewTheme.startsWith('mono-') ? 'grayscale(100%)' : undefined,
                    }}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 space-y-4 transition-all shrink-0 max-w-full min-w-0 overflow-x-hidden"
                  >
                    {!resolvedPreviewBlock ? (
                      <div className="text-xs text-[var(--text-muted)] text-center py-6">
                        Додайте блок ліворуч для попереднього перегляду.
                      </div>
                    ) : (
                      <>
                        {resolvedPreviewBlock.type === 'block_dialogue' && (
                          <DialogueCard
                            speaker={resolvedPreviewBlock.speaker || 'Наставник'}
                            avatar={resolvedPreviewBlock.avatar || '👨‍🏫'}
                            text={resolvedPreviewBlock.text || '...'}
                            emote={resolvedPreviewBlock.emote}
                            vars={resolvedPreviewVars}
                            onNext={() => setPreviewStepIdx((i) => Math.min(draftBlocks.length - 1, i + 1))}
                            isLastStep={previewStepIdx >= draftBlocks.length - 1}
                          />
                        )}

                        {(resolvedPreviewBlock.type === 'block_theory_rule' ||
                          resolvedPreviewBlock.type === 'block_anchor_fact') && (
                          <div className="card space-y-3">
                            <h3 className="text-lg font-extrabold text-[var(--primary-dark)]">
                              {resolvedPreviewBlock.title || resolvedPreviewBlock.headline}
                            </h3>
                            <RichBlockText
                              text={
                                resolvedPreviewBlock.ruleSummary ||
                                resolvedPreviewBlock.contentSummary ||
                                'Опис правила або факту'
                              }
                              vars={resolvedPreviewVars}
                              interactiveWidgets={true}
                              resetSignal={`preview_${previewStepIdx}_${previewVariantNonce}`}
                            />
                            {resolvedPreviewBlock.formulaText && (
                              <div className="p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded text-center font-mono font-extrabold text-base">
                                {resolvedPreviewBlock.formulaText}
                              </div>
                            )}
                          </div>
                        )}

                        {resolvedPreviewBlock.type === 'block_text_marking' && (
                          <TextMarkingBlock
                            title={resolvedPreviewBlock.title}
                            prompt={resolvedPreviewBlock.prompt || 'Позначте слова'}
                            sentence={resolvedPreviewBlock.sentence || ''}
                            availableTools={resolvedPreviewBlock.availableTools || ['subj', 'pred']}
                            toleranceMode={resolvedPreviewBlock.toleranceMode}
                            explanation={resolvedPreviewBlock.explanation}
                            onSolved={() => notify('Прев’ю: розмітку перевірено!', 'success')}
                          />
                        )}

                        {resolvedPreviewBlock.type === 'block_recognition_quiz' && (
                          <div className="card space-y-3">
                            <h4 className="text-sm font-extrabold">
                              <RichBlockText text={resolvedPreviewBlock.question || 'Запитання'} vars={resolvedPreviewVars} />
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                              {(resolvedPreviewBlock.options || []).map((opt: any, idx: number) => {
                                const label = typeof opt === 'string' ? opt : opt?.text || String(opt);
                                return (
                                  <Button
                                    key={idx}
                                    type="button"
                                    variant={previewQuizPick === idx ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => setPreviewQuizPick(idx)}
                                    className="justify-start text-left"
                                  >
                                    <span className="flex items-start gap-1.5 text-left">
                                      <span className="font-mono shrink-0">{String.fromCharCode(65 + idx)}.</span>
                                      <RichBlockText text={label} vars={resolvedPreviewVars} />
                                    </span>
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {(resolvedPreviewBlock.type === 'block_notebook_task' ||
                          resolvedPreviewBlock.type === 'block_boss_challenge') && (
                          <div className="card space-y-3">
                            <h4 className="text-sm font-extrabold text-[var(--primary-dark)]">
                              {resolvedPreviewBlock.title || 'Завдання'}
                            </h4>
                            <RichBlockText
                              text={resolvedPreviewBlock.notebookPrompt || resolvedPreviewBlock.instruction || ''}
                              codeSnippet={resolvedPreviewBlock.codeSnippet}
                              codeLanguage={resolvedPreviewBlock.codeLanguage}
                              vars={resolvedPreviewVars}
                              interactiveWidgets={true}
                              resetSignal={`preview_${previewStepIdx}_${previewVariantNonce}`}
                            />
                            <input
                              type="text"
                              value={previewUserInput}
                              onChange={(e) => setPreviewUserInput(e.target.value)}
                              placeholder={`Відповідь (очікується: ${resolvedPreviewBlock.correctAnswer ?? ''})`}
                              className="input-field w-full text-xs font-mono"
                            />
                          </div>
                        )}

                        {resolvedPreviewBlock.type === 'block_interactive_sandbox' && (() => {
                          const EngineComp = EngineRegistry.getComponent(resolvedPreviewBlock.engineId);
                          return EngineComp ? (
                            <EngineComp
                              config={{
                                ...(resolvedPreviewBlock.engineConfig || {}),
                                ...(resolvedPreviewBlock.reactionZones
                                  ? { reactionZones: resolvedPreviewBlock.reactionZones }
                                  : {}),
                              }}
                              onSubmitAnswer={() => notify('Прев’ю симулятора завершено!', 'success')}
                            />
                          ) : (
                            <div className="status-panel status-panel--warning text-xs">
                              Рушій «{resolvedPreviewBlock.engineId}» не знайдено.
                            </div>
                          );
                        })()}

                        {resolvedPreviewBlock.type === 'block_somatic_pause' && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-[var(--primary-dark)]">
                                🧘 Вбудований перегляд соматичної паузи
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="accent"
                                onClick={() => setPreviewSomaticModalOpen(true)}
                              >
                                🪟 Тестувати у модалці
                              </Button>
                            </div>

                            <SomaticPauseModal
                              key={`inline_somatic_${previewStepIdx}_${previewVariantNonce}`}
                              isOpen={true}
                              inlinePreview={true}
                              activityId={resolvedPreviewBlock.activityId || 'vowel_sound_flow'}
                              durationSec={resolvedPreviewBlock.durationSec || 20}
                              guideVoiceText={resolvedPreviewBlock.guideVoiceText}
                              inhaleSec={resolvedPreviewBlock.inhaleSec}
                              holdSec={resolvedPreviewBlock.holdSec}
                              exhaleSec={resolvedPreviewBlock.exhaleSec}
                              restSec={resolvedPreviewBlock.restSec}
                              cues={resolvedPreviewBlock.cues}
                              onComplete={() => {
                                setPreviewVariantNonce((n) => n + 1);
                                notify('Цикл соматичної паузи завершено (прев’ю).', 'success');
                              }}
                              onClose={() => {
                                setPreviewVariantNonce((n) => n + 1);
                                notify('Прев’ю соматичної паузи скинуто.', 'info');
                              }}
                            />

                            <SomaticPauseModal
                              isOpen={previewSomaticModalOpen}
                              activityId={resolvedPreviewBlock.activityId || 'vowel_sound_flow'}
                              durationSec={resolvedPreviewBlock.durationSec || 20}
                              guideVoiceText={resolvedPreviewBlock.guideVoiceText}
                              inhaleSec={resolvedPreviewBlock.inhaleSec}
                              holdSec={resolvedPreviewBlock.holdSec}
                              exhaleSec={resolvedPreviewBlock.exhaleSec}
                              restSec={resolvedPreviewBlock.restSec}
                              cues={resolvedPreviewBlock.cues}
                              onComplete={() => {
                                setPreviewSomaticModalOpen(false);
                                notify('Модальне прев’ю паузи завершено.', 'success');
                              }}
                              onClose={() => {
                                setPreviewSomaticModalOpen(false);
                                notify('Вікно соматичної паузи закрито.', 'info');
                              }}
                            />
                          </div>
                        )}

                        <CopilotBar
                          guideText={resolvedPreviewBlock.copilotAdvice || resolvedPreviewBlock.copilotHint}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
