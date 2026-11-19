import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { RawTextPasteTab } from './RawTextPasteTab';
import { ArchiveExtractor, ExtractedLessonItem } from '../../core/ingestion/archive-extractor';
import { YamlCurriculumParser, YamlBlueprintParser, ParsedCharacterYaml } from '../../services/yamlCurriculumParser';
import { TextShorthandParser } from '../../core/ingestion/text-shorthand-parser';
import { ContentLoaderService } from '../../services/contentLoaderService';
import { useSessionStore } from '../../core/state/useSessionStore';
import { useProfileStore } from '../../core/state/useProfileStore';
import { useFeedbackStore } from '../../core/state/useFeedbackStore';
import { StoryBlockZod } from '../../core/contracts/blocks.schema';
import { db } from '../../core/storage/db';

interface DropZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MEDIA_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'mp3', 'wav', 'ogg']);

export const DropZoneModal: React.FC<DropZoneModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileQueue, setFileQueue] = useState<ExtractedLessonItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedGrade, setSelectedGrade] = useState('grade_5');
  const [selectedSubjectCategory, setSelectedSubjectCategory] = useState('math');
  const [bookTitle, setBookTitle] = useState('Авторський навчальний курс');
  const [authorLabel, setAuthorLabel] = useState('Авторський курс вчителя');
  const [importMode, setImportMode] = useState<'create_new_book' | 'append' | 'extend_lesson'>('create_new_book');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [targetChapterId, setTargetChapterId] = useState('');
  const [showTagGuide, setShowTagGuide] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const { setQuest, setSelectedGradeId, setSelectedSubjectId, setActiveView } = useSessionStore();
  const { notify } = useFeedbackStore();

  const availableGrades = ContentLoaderService.getGrades();
  const currentGrade = availableGrades.find((g) => g.id === selectedGrade) || availableGrades[4] || availableGrades[0];
  const currentSubject =
    currentGrade.subjects.find((s) => s.id === targetSubjectId) || currentGrade.subjects[0];
  const availableChapters = currentSubject ? currentSubject.chapters : [];

  // Keep targetSubjectId & targetChapterId synchronized when grade changes
  useEffect(() => {
    const gradeSubjects = currentGrade.subjects || [];
    if (gradeSubjects.length > 0) {
      const nextSubj = gradeSubjects[0];
      setTargetSubjectId(nextSubj.id);
      setTargetChapterId(nextSubj.chapters[0]?.id || '');
    } else {
      setTargetSubjectId('');
      setTargetChapterId('');
    }
  }, [selectedGrade]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    setIsProcessing(true);
    setErrorMessage(null);
    const collected: ExtractedLessonItem[] = [];
    const errors: string[] = [];

    try {
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const lowerName = file.name.toLowerCase();

        try {
          if (ext === 'zip' || ext === 'edupack') {
            const result = await ArchiveExtractor.extract(file);
            collected.push(...result.lessons);
          } else if (ext === 'yaml' || ext === 'yml' || ext === 'json') {
            const text = await file.text();
            const hasLessonStructure =
              /(?:^|\n)\s*(?:blocks|pipeline|steps|stages|scenes|tasks|sections|slides|episodes|activities|items|elements)\s*:/i.test(text) ||
              /(?:^|\n)\s*(?:lesson|chapter|scenario|quest|module|unit|course)\s*:/i.test(text) ||
              /(?:^|\n)\s*-\s+(?:type|id|theory|fact|rule|dialogue|quiz|task|question)\s*:/i.test(text);

            if (
              !hasLessonStructure &&
              (lowerName === 'map.yaml' ||
                lowerName === 'map.yml' ||
                lowerName.includes('world_map') ||
                ((text.includes('mapTitle:') || text.includes('"mapTitle"') || text.includes('nodes:')) && !text.includes('blocks:')))
            ) {
              const mapData = YamlCurriculumParser.parseWorldMapContent(text, file.name);
              collected.push({
                fileName: file.name,
                id: TextShorthandParser.sanitizeId(file.name),
                title: mapData.mapTitle || 'Топологія мапи',
                fileType: 'world_map',
                pipeline: [],
                mapData,
                textContent: text,
              });
            } else if (
              !hasLessonStructure &&
              (lowerName.includes('blueprint') || text.includes('totalSpanMeters:') || text.includes('geometry:'))
            ) {
              const bp = YamlBlueprintParser.parseBlueprintContent(text, file.name);
              collected.push({
                fileName: file.name,
                id: bp.id,
                title: bp.title,
                description: bp.description,
                fileType: 'blueprint',
                pipeline: [],
                blueprintData: bp,
                textContent: text,
              });
            } else if (
              !hasLessonStructure &&
              (lowerName === 'subject.yaml' || lowerName === 'subject.yml' || lowerName.includes('manifest'))
            ) {
              const meta = YamlCurriculumParser.parseSubjectManifest(text, file.name);
              collected.push({
                fileName: file.name,
                id: meta.id || TextShorthandParser.sanitizeId(file.name),
                title: meta.name || file.name,
                description: meta.description,
                fileType: 'manifest',
                pipeline: [],
                manifestData: meta,
                textContent: text,
              });
            } else if (
              !hasLessonStructure &&
              (lowerName.includes('character') ||
                lowerName.includes('avatar') ||
                lowerName.includes('voice') ||
                text.includes('characters:') ||
                text.includes('avatars:'))
            ) {
              const chars = YamlCurriculumParser.parseCharacterYaml(text);
              const charList = Array.isArray(chars) ? chars : chars ? [chars] : [];
              collected.push({
                fileName: file.name,
                id: TextShorthandParser.sanitizeId(file.name),
                title: charList.map((c: ParsedCharacterYaml) => c.name).join(', ') || file.name,
                fileType: lowerName.includes('voice') ? 'voice_config' : 'avatar',
                pipeline: [],
                characterData: charList,
                textContent: text,
              });
            } else {
              const parsed = YamlCurriculumParser.parseQuestYaml(text, file.name);
              collected.push({
                fileName: file.name,
                id: parsed.id,
                title: parsed.title,
                description: parsed.description,
                islandStageName: parsed.islandStageName,
                fileType: 'lesson',
                pipeline: parsed.pipeline as StoryBlockZod[],
                mapData: parsed.mapTopology,
                textContent: text,
              });
            }
          } else if (ext === 'txt' || ext === 'md') {
            const text = await file.text();
            const looksStructuredYaml =
              YamlCurriculumParser.looksLikeYaml(text) ||
              /(?:^|\n)\s*(?:blocks|pipeline|steps|stages|scenes|tasks|sections|phases|parts|slides|episodes|activities|items|elements|lesson|chapter|scenario|quest|module|unit|course)\s*:/i.test(
                text
              ) ||
              /(?:^|\n)\s*-\s+(?:type|blockType|kind|theory|fact|rule|dialogue|quiz|task|boss)\s*:/i.test(text);

            if (looksStructuredYaml) {
              const parsed = YamlCurriculumParser.parseQuestYaml(text, file.name);
              collected.push({
                fileName: file.name,
                id: parsed.id,
                title: parsed.title,
                description: parsed.description,
                islandStageName: parsed.islandStageName,
                fileType: 'lesson',
                pipeline: parsed.pipeline as StoryBlockZod[],
                mapData: parsed.mapTopology,
                textContent: text,
              });
            } else {
              const chapterResults = TextShorthandParser.parseMultiChapterBook(text, file.name);
              chapterResults.forEach((parsed) => {
                collected.push({
                  fileName: file.name,
                  id: parsed.id,
                  title: parsed.title,
                  description: parsed.description,
                  islandStageName: parsed.islandStageName,
                  fileType: parsed.fileType,
                  pipeline: parsed.blocks,
                  textContent: text,
                });
              });
            }
          } else if (MEDIA_EXTENSIONS.has(ext)) {
            await db.saveAssetBlob(file.name, file, file.type || 'application/octet-stream');
            collected.push({
              fileName: file.name,
              id: TextShorthandParser.sanitizeId(file.name),
              title: file.name,
              fileType: 'media',
              pipeline: [],
              mediaBlob: file,
              mediaMimeType: file.type,
            });
          } else {
            errors.push(`Формат файлу ${file.name} (.${ext}) не підтримується.`);
          }
        } catch (fileErr) {
          errors.push(`${file.name}: ${(fileErr as Error).message}`);
        }
      }

      if (collected.length > 0) {
        collected.sort((a, b) => {
          if (a.fileType === 'lesson' && b.fileType === 'lesson') {
            return YamlCurriculumParser.naturalCompare(
              a.relativePath || a.fileName || a.id,
              b.relativePath || b.fileName || b.id
            );
          }
          if (a.fileType === 'manifest' && b.fileType !== 'manifest') return -1;
          if (a.fileType !== 'manifest' && b.fileType === 'manifest') return 1;
          return 0;
        });
        setFileQueue((prev) => [...prev, ...collected]);
      }
      if (errors.length > 0) {
        setErrorMessage(errors.join(' '));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeduplicate = () => {
    const seenIds = new Set<string>();
    setFileQueue((prev) =>
      prev.filter((item) => {
        const key = `${item.fileType}::${item.id || item.fileName}`;
        if (seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setFileQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setFileQueue((prev) => {
      const copy = [...prev];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    setFileQueue((prev) => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      return copy;
    });
  };

  const handleUpdateItemInternalId = (index: number, newId: string) => {
    setFileQueue((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], id: TextShorthandParser.sanitizeId(newId) };
      return copy;
    });
  };

  const handleUpdateFileType = (
    index: number,
    newType: 'lesson' | 'world_map' | 'manifest' | 'avatar' | 'voice_config' | 'blueprint' | 'media'
  ) => {
    setFileQueue((prev) => {
      const copy = [...prev];
      const item = copy[index];
      let mapData = item.mapData;
      let blueprintData = item.blueprintData;
      let characterData = item.characterData;

      if (newType === 'world_map' && !mapData && item.textContent) {
        mapData = YamlCurriculumParser.parseWorldMapContent(item.textContent, item.title);
      }
      if (newType === 'blueprint' && !blueprintData && item.textContent) {
        blueprintData = YamlBlueprintParser.parseBlueprintContent(item.textContent, item.fileName);
      }
      if ((newType === 'avatar' || newType === 'voice_config') && !characterData && item.textContent) {
        characterData = YamlCurriculumParser.parseCharacterYaml(item.textContent);
      }

      copy[index] = { ...item, fileType: newType, mapData, blueprintData, characterData };
      return copy;
    });
  };

  const handleImportExecute = async (singleItem?: ExtractedLessonItem) => {
    const itemsToProcess = singleItem ? [singleItem] : fileQueue;
    if (itemsToProcess.length === 0) return;

    const lessonItems = itemsToProcess.filter((i) => i.fileType === 'lesson');
    const blueprintItems = itemsToProcess.filter((i) => i.fileType === 'blueprint');
    const manifestItem = itemsToProcess.find((i) => i.fileType === 'manifest');
    const mapItem = itemsToProcess.find((i) => i.fileType === 'world_map');
    const charItems = itemsToProcess.filter(
      (i) => i.fileType === 'avatar' || i.fileType === 'voice_config'
    );
    const mediaItems = itemsToProcess.filter((i) => i.fileType === 'media');

    for (const m of mediaItems) {
      if (m.mediaBlob) {
        await db.saveAssetBlob(
          m.relativePath || m.fileName,
          m.mediaBlob,
          m.mediaMimeType || 'application/octet-stream'
        );
      }
    }

    const collectedCharacters: ParsedCharacterYaml[] = [];
    charItems.forEach((cItem) => {
      if (Array.isArray(cItem.characterData)) {
        collectedCharacters.push(...cItem.characterData);
      } else if (cItem.characterData) {
        collectedCharacters.push(cItem.characterData);
      } else if (cItem.textContent) {
        const parsed = YamlCurriculumParser.parseCharacterYaml(cItem.textContent);
        if (Array.isArray(parsed)) {
          collectedCharacters.push(...parsed);
        } else if (parsed) {
          collectedCharacters.push(parsed);
        }
      }
    });

    const customMapSchema = mapItem
      ? mapItem.mapData || YamlCurriculumParser.parseWorldMapContent(mapItem.textContent || '', mapItem.title)
      : undefined;

    const effectiveTitle =
      manifestItem?.manifestData?.name || bookTitle.trim() || lessonItems[0]?.title || 'Імпортований курс';
    const effectiveDesc =
      manifestItem?.manifestData?.description || undefined;
    const effectiveIcon = manifestItem?.manifestData?.iconName;

    let currentVolumeId = importMode !== 'create_new_book' ? targetSubjectId : undefined;
    let firstQuestId = '';
    let firstBlocks: StoryBlockZod[] = [];

    if (lessonItems.length === 0) {
      // Importing blueprints / maps / manifests / characters / media into subject
      const firstBlueprint = blueprintItems[0]?.blueprintData;
      const res = ContentLoaderService.registerCustomVolume({
        gradeId: selectedGrade,
        subjectCategory: selectedSubjectCategory,
        bookTitle: effectiveTitle,
        authorLabel,
        description: effectiveDesc,
        iconName: effectiveIcon,
        blueprint: firstBlueprint,
        characters: collectedCharacters,
        mode: importMode === 'create_new_book' && !firstBlueprint && !customMapSchema && collectedCharacters.length === 0
          ? 'append'
          : importMode,
        targetSubjectId: currentVolumeId,
        mapSchema: customMapSchema,
      });

      // Attach any additional blueprints
      for (let i = 1; i < blueprintItems.length; i++) {
        if (blueprintItems[i].blueprintData) {
          ContentLoaderService.registerCustomVolume({
            gradeId: selectedGrade,
            subjectCategory: selectedSubjectCategory,
            bookTitle: effectiveTitle,
            authorLabel,
            blueprint: blueprintItems[i].blueprintData,
            mode: 'append',
            targetSubjectId: res.volumeId,
          });
        }
      }

      setSelectedGradeId(selectedGrade);
      setSelectedSubjectId(res.volumeId);
      notify(`Матеріали пакета (${itemsToProcess.length} файлів) успішно додано до предмета.`, 'success');
      setActiveView('subject_hub');
      onClose();
      return;
    }

    lessonItems.forEach((item, idx) => {
      const finalTitle = item.title || 'Навчальний урок';
      const isFirst = idx === 0;
      const modeToUse = isFirst ? importMode : 'append';

      const res = ContentLoaderService.registerCustomVolume({
        gradeId: selectedGrade,
        subjectCategory: selectedSubjectCategory,
        bookTitle: effectiveTitle,
        authorLabel,
        description: effectiveDesc || item.description,
        iconName: effectiveIcon,
        quest: {
          id: item.id,
          title: finalTitle,
          description: item.description || effectiveDesc || `Навчальний епізод (${item.pipeline.length} блоків).`,
          islandStageName: item.islandStageName,
          mapTopology: item.mapData,
          pipeline: item.pipeline as any,
        },
        blueprint: isFirst ? blueprintItems[0]?.blueprintData : undefined,
        characters: isFirst ? collectedCharacters : undefined,
        mode: modeToUse,
        targetSubjectId: currentVolumeId,
        targetChapterId: modeToUse === 'extend_lesson' ? targetChapterId : undefined,
        mapSchema: isFirst ? customMapSchema : undefined,
      });

      currentVolumeId = res.volumeId;
      if (isFirst) {
        firstQuestId = res.questId;
        firstBlocks = item.pipeline;
      }
    });

    // Attach remaining blueprints if package contained more than one
    for (let i = 1; i < blueprintItems.length; i++) {
      if (blueprintItems[i].blueprintData && currentVolumeId) {
        ContentLoaderService.registerCustomVolume({
          gradeId: selectedGrade,
          subjectCategory: selectedSubjectCategory,
          bookTitle: effectiveTitle,
          blueprint: blueprintItems[i].blueprintData,
          mode: 'append',
          targetSubjectId: currentVolumeId,
        });
      }
    }

    if (currentVolumeId) {
      setSelectedGradeId(selectedGrade);
      setSelectedSubjectId(currentVolumeId);
      if (importMode === 'create_new_book') {
        useProfileStore.getState().setSubjectChapterIndex(currentVolumeId, 0, 0);
      }
      if (firstQuestId) {
        setQuest(firstQuestId, firstBlocks as any);
      }
      notify(`Імпортовано уроків: ${lessonItems.length}.`, 'success');
      setActiveView('subject_hub');
      onClose();
    }
  };

  const registerFromRawText = (
    blocks: StoryBlockZod[],
    title: string,
    description?: string,
    customQuestId?: string
  ) => {
    const questId = customQuestId || `quest_${Date.now()}`;
    const res = ContentLoaderService.registerCustomVolume({
      gradeId: selectedGrade,
      subjectCategory: selectedSubjectCategory,
      bookTitle: bookTitle.trim() || title,
      authorLabel,
      description,
      quest: {
        id: questId,
        title,
        description: description || 'Навчальний урок із практичними вправами.',
        pipeline: blocks as any,
      },
      mode: importMode,
      targetSubjectId: importMode !== 'create_new_book' ? targetSubjectId : undefined,
      targetChapterId: importMode === 'extend_lesson' ? targetChapterId : undefined,
    });

    setSelectedGradeId(selectedGrade);
    setSelectedSubjectId(res.volumeId);
    if (importMode === 'create_new_book') {
      useProfileStore.getState().setSubjectChapterIndex(res.volumeId, 0, 0);
    }
    setQuest(res.questId, blocks as any);
    notify(`Урок «${title}» інтегровано!`, 'success');
    setActiveView('subject_hub');
    onClose();
  };

  const fullAiSystemPromptSpec = `# РЕГЛАМЕНТОВАНА СПЕЦИФІКАЦІЯ YAML-СЦЕНАРІЇВ (НУШ)

## 1. Сценарій уроку (chapters/01-lesson.yaml):
\`\`\`yaml
id: "01-lesson-topic"
title: "Назва навчальної теми"
subjectId: "math" # math | history | physics | science | ukrainian | informatics
gradeId: "grade-05" # grade-01 .. grade-12
description: "Короткий опис навчальної мети уроку."
islandStageName: "Назва етапу на мапі"

blocks:
  # 1) Контекстний / історичний факт
  - id: "fact-01"
    type: "block_anchor_fact"
    headline: "Цікавий факт або контекст"
    locationLabel: "Довідка"
    contentSummary: "Основний текст факту чи вступу."
    formulaText: "S = a * b" # необов'язково
    stepByStepBreakdown:
      - "Теза 1"
      - "Теза 2"

  # 2) Опорний теоретичний конспект / правило / код
  - id: "theory-01"
    type: "block_theory_rule"
    title: "Ключове правило"
    ruleSummary: "Чітке формулювання правила, визначення або закону."
    formulaText: "P = 2 * (a + b)" # необов'язково
    codeSnippet: "<h1>Заголовок</h1>" # для інформатики
    codeLanguage: "html"
    stepByStepBreakdown:
      - "Крок 1: Проаналізуйте умову"
      - "Крок 2: Виконайте обчислення"

  # 3) Діалог персонажа
  - id: "dlg-01"
    type: "block_dialogue"
    speaker: "Наставник"
    avatar: "👨‍🏫"
    emote: "idea" # idea | joy | question | sweat
    text: "Репліка персонажа, що супроводжує пояснення."

  # 4) Тест на розуміння
  - id: "quiz-01"
    type: "block_recognition_quiz"
    question: "Скільки сантиметрів у 2 метрах?"
    options:
      - "20 см"
      - "200 см"
      - "2000 см"
    correctIndex: 1
    explanation: "1 м = 100 см, отже 2 м = 200 см."

  # 5) Практичне завдання у чернетці / з кресленням
  - id: "task-01"
    type: "block_notebook_task"
    title: "Обчислення у чорновику"
    notebookPrompt: "Знайдіть площу прямокутника зі сторонами 4 см та 5 см."
    correctAnswer: "20"
    unit: "см²"
    hint: "Помножте довжину на ширину."

  # 6) Інтерактивний симулятор (за потреби)
  - id: "sandbox-01"
    type: "block_interactive_sandbox"
    engineId: "ballistic-trajectory" # balance-physics, number-line-scales, drag-sorter-protocol, place-value-abacus, fraction-slicer, number-line, coordinate-plane, protractor-angle
    instruction: "Підберіть кут запуску та влучіть у ціль."
    engineConfig:
      targetDistanceMeters: 450
      toleranceMeters: 35
      gravity: 9.81

  # 7) Підсумкова самостійна робота
  - id: "boss-01"
    type: "block_boss_challenge"
    title: "Підсумкове завдання"
    notebookPrompt: "Обчисліть периметр квадрата зі стороною 9 см."
    correctAnswer: "36"

  # 8) Нейро-пауза відпочинку
  - id: "pause-01"
    type: "block_somatic_pause"
    activityId: "double_sigh" # double_sigh | eye_eight | muscle_squeeze | vocal_humming
    durationSec: 25
\`\`\``;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Імпорт навчальних матеріалів (YAML / ZIP / Текст)"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4 text-xs">
        {/* AI Prompt Specification Accordion */}
        <div className="p-3 surface-subtle rounded-[var(--radius-sm)] space-y-2.5 shadow-xs">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <span className="font-extrabold text-xs text-[var(--color-primary-dark)]">
              🤖 Шаблон та специфікація YAML для підготовки уроків і блупрінтів:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fullAiSystemPromptSpec);
                  setPromptCopied(true);
                  notify('Специфікацію YAML скопійовано!', 'success');
                  setTimeout(() => setPromptCopied(false), 3000);
                }}
                className="btn btn-accent px-3 py-1 text-xs font-bold"
              >
                {promptCopied ? '✅ Скопійовано' : '📋 Копіювати'}
              </button>
              <button
                type="button"
                onClick={() => setShowTagGuide(!showTagGuide)}
                className="text-[11px] font-bold text-[var(--color-primary-dark)] hover:underline cursor-pointer"
              >
                {showTagGuide ? 'Сховати' : 'Показати приклад'}
              </button>
            </div>
          </div>

          {showTagGuide && (
            <div className="code-block-wrapper max-h-48 overflow-y-auto">
              <pre className="code-block-pre text-[11px]">{fullAiSystemPromptSpec}</pre>
            </div>
          )}
        </div>

        {/* Target Destination Settings */}
        <div className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] space-y-2.5">
          <span className="font-extrabold text-[var(--color-primary-dark)] block">
            ⚙️ 1. Куди інтегрувати матеріали:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[var(--color-text)] mb-1">Цільовий Клас (1–12):</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="input-field text-xs py-1.5 w-full"
              >
                {availableGrades.map((gr) => (
                  <option key={gr.id} value={gr.id}>
                    🚪 {gr.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--color-text)] mb-1">Предметна Категорія:</label>
              <select
                value={selectedSubjectCategory}
                onChange={(e) => {
                  const cat = e.target.value;
                  setSelectedSubjectCategory(cat);
                  const names: Record<string, string> = {
                    math: 'Математика: Додатковий курс',
                    history: 'Історія України: Додатковий курс',
                    physics: 'Фізика: Моделювання',
                    science: 'Природознавство: Дослідження',
                    ukrainian: 'Українська мова та література',
                    informatics: 'Інформатика та алгоритми',
                    cybersecurity: 'Кібербезпека та цифрова гігієна',
                    music: 'Музичне мистецтво: Ритм і слух',
                    art: 'Образотворче мистецтво: Колір і перспектива',
                  };
                  if (names[cat]) setBookTitle(names[cat]);
                }}
                className="input-field text-xs py-1.5 w-full"
              >
                <option value="math">📐 Математика</option>
                <option value="history">📜 Історія</option>
                <option value="physics">⚛️ Фізика</option>
                <option value="science">🌿 Природознавство</option>
                <option value="ukrainian">📖 Українська мова</option>
                <option value="informatics">💻 Інформатика</option>
                <option value="cybersecurity">🛡️ Кібербезпека</option>
                <option value="music">🎵 Музичне мистецтво</option>
                <option value="art">🎨 Образотворче мистецтво</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[var(--color-text)] mb-1">Назва предмета / книги:</label>
              <input
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Введіть назву..."
                className="input-field text-xs py-1.5 w-full"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-text)] mb-1">Джерело / Автор:</label>
              <select
                value={authorLabel}
                onChange={(e) => setAuthorLabel(e.target.value)}
                className="input-field text-xs py-1.5 w-full"
              >
                <option value="Авторський курс вчителя">👨‍🏫 Авторський курс вчителя</option>
                <option value="Пояснення від батьків">👨‍👩‍👧 Пояснення від батьків</option>
                <option value="Додатковий посібник">📘 Додатковий посібник</option>
                <option value="Імпортований пакет">📦 Імпортований пакет</option>
              </select>
            </div>
          </div>

          <div className="pt-1 space-y-2">
            <label className="block font-bold text-[var(--color-text)]">Спосіб інтеграції:</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImportMode('create_new_book')}
                className={`px-3.5 py-2 rounded border-2 font-extrabold text-[11px] uppercase tracking-wide transition-all cursor-pointer ${
                  importMode === 'create_new_book'
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                }`}
              >
                📚 Новий предмет
              </button>

              <button
                type="button"
                onClick={() => setImportMode('append')}
                className={`px-3.5 py-2 rounded border-2 font-extrabold text-[11px] uppercase tracking-wide transition-all cursor-pointer ${
                  importMode === 'append'
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                }`}
              >
                ➕ Додати до предмета
              </button>

              <button
                type="button"
                onClick={() => setImportMode('extend_lesson')}
                className={`px-3.5 py-2 rounded border-2 font-extrabold text-[11px] uppercase tracking-wide transition-all cursor-pointer ${
                  importMode === 'extend_lesson'
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)] shadow-sm'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]'
                }`}
              >
                🔗 Доповнити урок
              </button>
            </div>

            {importMode !== 'create_new_book' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 bg-[var(--color-surface)] p-3 rounded border border-[var(--color-border)]">
                <div>
                  <label className="block font-bold text-[11px] text-[var(--color-text)] mb-1">
                    Оберіть предмет ({currentGrade.name}):
                  </label>
                  <select
                    value={targetSubjectId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setTargetSubjectId(nextId);
                      const subj = currentGrade.subjects.find((s) => s.id === nextId);
                      setTargetChapterId(subj?.chapters[0]?.id || '');
                    }}
                    className="input-field text-xs py-1.5 w-full"
                  >
                    {currentGrade.subjects.length > 0 ? (
                      currentGrade.subjects.map((subj) => (
                        <option key={subj.id} value={subj.id}>
                          {subj.name} ({subj.isCustom ? 'Імпортований' : 'Базовий'})
                        </option>
                      ))
                    ) : (
                      <option value="">У цьому класі ще немає предметів</option>
                    )}
                  </select>
                </div>

                {importMode === 'extend_lesson' && (
                  <div>
                    <label className="block font-bold text-[11px] text-[var(--color-text)] mb-1">
                      Оберіть урок для доповнення:
                    </label>
                    <select
                      value={targetChapterId}
                      onChange={(e) => setTargetChapterId(e.target.value)}
                      className="input-field text-xs py-1.5 w-full"
                    >
                      {availableChapters.length > 0 ? (
                        availableChapters.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.title}
                          </option>
                        ))
                      ) : (
                        <option value="">Немає уроків у предметі</option>
                      )}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--color-border)] gap-2 text-xs font-extrabold pt-1 uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2 px-4 transition-colors border-b-2 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-[var(--color-primary)] text-[var(--color-primary-dark)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            📁 Завантаження файлів / ZIP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`pb-2 px-4 transition-colors border-b-2 cursor-pointer ${
              activeTab === 'paste'
                ? 'border-[var(--color-primary)] text-[var(--color-primary-dark)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            📝 Вставити текстом
          </button>
        </div>

        {activeTab === 'upload' ? (
          <div className="space-y-3">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[var(--radius-md)] p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[var(--color-primary)] bg-[var(--color-bg)] scale-[1.01]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-light)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".zip,.edupack,.yaml,.yml,.json,.txt,.md,.png,.jpg,.jpeg,.webp,.svg,.mp3,.wav,.ogg"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="space-y-2">
                <span className="text-4xl block">📦</span>
                <h3 className="font-extrabold text-xs text-[var(--color-text)]">
                  Перетягніть архів (.zip/.edupack) або кілька файлів (.yaml, .txt, блупрінти, медіа)
                </h3>
                <p className="text-[11px] text-[var(--color-muted)] max-w-sm mx-auto leading-relaxed">
                  Файли будуть розпізнані за типом та додані у «{currentGrade.name}».
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-2 font-bold text-xs"
                >
                  📂 Обрати файли з диска
                </Button>
              </div>
            </div>

            {isProcessing && (
              <div className="p-3 bg-[var(--color-guidance-bg)] border border-[var(--color-guidance-border)] rounded-[var(--radius-sm)] flex items-center gap-2 font-bold text-[var(--color-guidance-text)]">
                <span className="animate-spin text-lg">⏳</span>
                Обробка та розпізнавання файлів...
              </div>
            )}

            {errorMessage && (
              <div className="status-panel status-panel--danger">
                {errorMessage}
              </div>
            )}

            {fileQueue.length > 0 && (
              <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-[var(--color-border)]">
                  <span className="font-extrabold text-[var(--color-primary-dark)] text-xs uppercase tracking-wide">
                    📄 Черга імпорту ({fileQueue.length}):
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeduplicate}
                    className="text-[10px] font-extrabold py-1 px-3"
                  >
                    🧹 Очистити дублікати
                  </Button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 border border-[var(--color-border)] rounded p-2 bg-[var(--color-bg)]">
                  {fileQueue.map((item, idx) => (
                    <div
                      key={`${item.id}_${idx}`}
                      className="p-3 bg-[var(--color-surface)] rounded border border-[var(--color-border)] shadow-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-[var(--color-border)]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] font-extrabold text-[var(--color-muted)] bg-[var(--color-bg)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                            #{idx + 1}
                          </span>

                          <select
                            value={item.fileType}
                            onChange={(e) => handleUpdateFileType(idx, e.target.value as any)}
                            className="text-[10px] font-extrabold px-3 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] cursor-pointer"
                          >
                            <option value="lesson">📖 Урок</option>
                            <option value="blueprint">📐 Блупрінт (Креслення)</option>
                            <option value="world_map">🗺️ Мапа</option>
                            <option value="manifest">📜 Маніфест предмета</option>
                            <option value="avatar">🎭 Персонаж / Аватар</option>
                            <option value="voice_config">🔊 Профіль голосу</option>
                            <option value="media">🖼️ Медіаресурс</option>
                          </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 min-w-0 max-w-full">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-1 text-[10px] font-bold bg-[var(--color-bg)] border border-[var(--color-border)] rounded disabled:opacity-40 cursor-pointer"
                            title="Вгору"
                          >
                            ⬆️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === fileQueue.length - 1}
                            className="p-1 text-[10px] font-bold bg-[var(--color-bg)] border border-[var(--color-border)] rounded disabled:opacity-40 cursor-pointer"
                            title="Вниз"
                          >
                            ⬇️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-[10px] text-[var(--color-danger-text)] bg-[var(--color-danger-bg)] rounded border border-[var(--color-danger-border)] font-bold ml-1 cursor-pointer"
                            title="Вилучити з черги"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-[var(--color-text)] px-1">
                          {item.title}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 px-1">
                          <span className="text-[10px] font-semibold text-[var(--color-muted)]">Системний ключ:</span>
                          <input
                            type="text"
                            value={item.id}
                            onChange={(e) => handleUpdateItemInternalId(idx, e.target.value)}
                            className="font-mono text-[11px] font-semibold text-[var(--color-muted)] bg-[var(--color-bg)] px-2 py-0.5 rounded border border-[var(--color-border)] flex-1 min-w-[160px]"
                          />
                        </div>

                        <div className="text-[11px] text-[var(--color-muted)] font-mono break-all p-1.5 bg-[var(--color-bg)] rounded border border-[var(--color-border)] space-y-1">
                          <div>
                            {item.relativePath ? `📁 ${item.relativePath}` : `📄 ${item.fileName}`}
                            {item.pipeline && item.pipeline.length > 0 ? ` · 🧱 ${item.pipeline.length} етапів` : ''}
                            {item.blueprintData ? ` · 📐 Креслення (${Object.keys(item.blueprintData.geometry || {}).length} параметрів)` : ''}
                          </div>
                          {item.fileType === 'lesson' && (() => {
                            const blocks = item.pipeline || [];
                            const dialogueCount = blocks.filter((b: any) => b.type === 'block_dialogue' || b.type === 'dialogue').length;
                            const theoryCount = blocks.filter((b: any) => b.type === 'block_theory_rule' || b.type === 'block_anchor_fact').length;
                            const practiceCount = blocks.filter(
                              (b: any) =>
                                b.type === 'block_recognition_quiz' ||
                                b.type === 'block_notebook_task' ||
                                b.type === 'block_interactive_sandbox' ||
                                b.type === 'block_boss_challenge'
                            ).length;
                            return (
                              <div className="flex flex-wrap gap-1.5 font-sans text-[10px] font-bold">
                                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                  📖 Теорія/Факти: {theoryCount}
                                </span>
                                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                  💬 Діалоги: {dialogueCount}
                                </span>
                                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                  🎯 Тести/Завдання: {practiceCount}
                                </span>
                                {blocks.length === 0 && (
                                  <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning-text)]">
                                    ⚠️ Блоки сценарію не знайдено — перевірте ключі blocks/steps у файлі
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => handleImportExecute()}
                  className="w-full text-xs font-bold py-2.5"
                >
                  🚀 Імпортувати {fileQueue.length} елемент(ів) у «{currentGrade.name}»
                </Button>
              </div>
            )}
          </div>
        ) : (
          <RawTextPasteTab
            onSuccess={(blocks, title, desc, customQuestId) => {
              registerFromRawText(blocks, title, desc, customQuestId);
            }}
          />
        )}
      </div>
    </Modal>
  );
};
