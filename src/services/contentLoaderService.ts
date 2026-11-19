import { YamlCurriculumParser, YamlBlueprintParser, ParsedYamlQuest, ParsedCharacterYaml } from './yamlCurriculumParser';
import { TextShorthandParser } from '../core/ingestion/text-shorthand-parser';
import { stripInlineMarkup } from '../core/utils/stripInlineMarkup';
import { WorldMapSchema, GradeConfig, SubjectConfig, Chapter, ExtensionMode } from '../curriculum/types';
import { StoryBlock } from '../core/contracts/campaign.contract';
import { Blueprint } from '../core/contracts/blueprint.schema';

const CUSTOM_BOOKS_STORAGE_KEY = 'nush_custom_books_v1';
const SUBJECT_OVERLAYS_STORAGE_KEY = 'nush_subject_overlays_v1';

export interface StoredCustomVolume {
  id: string;
  gradeId: string;
  subjectCategory: string;
  name: string;
  description: string;
  iconName: string;
  authorLabel: string;
  isAvailable: boolean;
  isCustom: boolean;
  chapters: Chapter[];
  pipelines: Record<string, StoryBlock[]>;
  blueprints?: Record<string, Blueprint>;
  characters?: ParsedCharacterYaml[];
  mapSchema?: WorldMapSchema;
}

export interface SubjectOverlay {
  subjectId: string;
  gradeId?: string;
  name?: string;
  description?: string;
  iconName?: string;
  appendedChapters: Chapter[];
  pipelines: Record<string, StoryBlock[]>;
  extendedBlocksByChapter: Record<string, StoryBlock[]>;
  blueprints: Record<string, Blueprint>;
  characters: ParsedCharacterYaml[];
  mapSchema?: WorldMapSchema;
}

export interface RegisterVolumeParams {
  gradeId: string;
  subjectCategory: string;
  bookTitle: string;
  authorLabel?: string;
  description?: string;
  iconName?: string;
  quest?: ParsedYamlQuest;
  blueprint?: Blueprint;
  characters?: ParsedCharacterYaml[];
  mode: ExtensionMode;
  targetSubjectId?: string;
  targetChapterId?: string;
  mapSchema?: WorldMapSchema;
}

interface BundledSubjectBucket {
  id: string;
  gradeId: string;
  meta?: Partial<SubjectConfig>;
  quests: ParsedYamlQuest[];
  blueprints: Record<string, Blueprint>;
  mapSchema?: WorldMapSchema;
}

export class ContentLoaderService {
  private static isInitialized = false;
  private static bundledQuests = new Map<string, ParsedYamlQuest>();
  private static bundledSubjects = new Map<string, BundledSubjectBucket>();
  private static bundledBlueprints = new Map<string, Blueprint>();

  /**
   * Parses `/content/grades/grade-XX/subjects/<subjectId>/...` path segments cleanly
   */
  private static parseContentPath(filePath: string): {
    gradeId: string;
    subjectId: string;
    kind: 'chapter' | 'blueprint' | 'map' | 'subject' | 'character' | 'other';
  } {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const gradeMatch = normalized.match(/\/grades\/([^/]+)\//);
    const subjectMatch = normalized.match(/\/subjects\/([^/]+)\//);

    const gradeId = this.normalizeGradeId(gradeMatch ? gradeMatch[1] : 'grade-05');
    const subjectId = subjectMatch ? subjectMatch[1] : 'general';

    if (normalized.endsWith('/map.yaml') || normalized.endsWith('/map.yml')) {
      return { gradeId, subjectId, kind: 'map' };
    }
    if (normalized.endsWith('/subject.yaml') || normalized.endsWith('/subject.yml')) {
      return { gradeId, subjectId, kind: 'subject' };
    }
    if (normalized.includes('/blueprints/')) {
      return { gradeId, subjectId, kind: 'blueprint' };
    }
    if (normalized.includes('/characters/') || normalized.endsWith('characters.yaml')) {
      return { gradeId, subjectId, kind: 'character' };
    }
    if (normalized.includes('/chapters/') || (!normalized.includes('/registry.yaml') && !normalized.includes('/manifest.'))) {
      return { gradeId, subjectId, kind: 'chapter' };
    }
    return { gradeId, subjectId, kind: 'other' };
  }

  private static getOrCreateBundledBucket(gradeId: string, subjectId: string): BundledSubjectBucket {
    const key = `${gradeId}::${subjectId}`;
    let bucket = this.bundledSubjects.get(key);
    if (!bucket) {
      bucket = {
        id: subjectId,
        gradeId,
        quests: [],
        blueprints: {},
      };
      this.bundledSubjects.set(key, bucket);
    }
    return bucket;
  }

  /**
   * Initialize and parse all bundled YAML content from /content/ strictly by directory & type
   */
  private static initCache() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const rawYamlModules = import.meta.glob<string>('/content/**/*.yaml', {
        query: '?raw',
        import: 'default',
        eager: true,
      });

      Object.entries(rawYamlModules).forEach(([filePath, rawContent]) => {
        if (!rawContent) return;
        const pathInfo = this.parseContentPath(filePath);
        const fileName = filePath.split('/').pop() || 'item.yaml';

        try {
          if (pathInfo.kind === 'character') {
            YamlCurriculumParser.parseCharacterYaml(rawContent);
            return;
          }

          if (pathInfo.kind === 'blueprint') {
            const bp = YamlBlueprintParser.parseBlueprintContent(rawContent, fileName);
            const targetGradeId = bp.gradeId ? this.normalizeGradeId(bp.gradeId) : pathInfo.gradeId;
            const targetSubjectId = bp.subjectId || pathInfo.subjectId;
            const bucket = this.getOrCreateBundledBucket(targetGradeId, targetSubjectId);
            bucket.blueprints[bp.id] = bp;
            this.bundledBlueprints.set(bp.id, bp);
            return;
          }

          if (pathInfo.kind === 'subject') {
            const meta = YamlCurriculumParser.parseSubjectManifest(rawContent, pathInfo.subjectId);
            const targetGradeId = meta.gradeId ? this.normalizeGradeId(meta.gradeId) : pathInfo.gradeId;
            const targetSubjectId = meta.id || pathInfo.subjectId;
            const bucket = this.getOrCreateBundledBucket(targetGradeId, targetSubjectId);
            bucket.meta = meta;
            return;
          }

          if (pathInfo.kind === 'map') {
            const mapSchema = YamlCurriculumParser.parseWorldMapContent(rawContent);
            const bucket = this.getOrCreateBundledBucket(pathInfo.gradeId, pathInfo.subjectId);
            bucket.mapSchema = mapSchema;
            return;
          }

          if (pathInfo.kind === 'chapter') {
            const parsed = YamlCurriculumParser.parseQuestYaml(rawContent, fileName);
            if (!parsed || !parsed.id) return;

            const resolvedGradeId = this.normalizeGradeId(parsed.gradeId || parsed.grade || pathInfo.gradeId);
            const resolvedSubjectId = parsed.subjectId || parsed.subject || pathInfo.subjectId;
            parsed.gradeId = resolvedGradeId;
            parsed.subjectId = resolvedSubjectId;

            this.bundledQuests.set(parsed.id, parsed);
            const bucket = this.getOrCreateBundledBucket(resolvedGradeId, resolvedSubjectId);
            bucket.quests.push(parsed);
          }
        } catch (err) {
          console.warn('Failed to parse bundled YAML file:', filePath, err);
        }
      });

      this.bundledSubjects.forEach((bucket) => {
        bucket.quests.sort((a, b) => YamlCurriculumParser.naturalCompare(a.id, b.id));
      });
    } catch (err) {
      console.warn('No bundled content files found:', err);
    }
  }

  /**
   * Normalize grade IDs across formats ('grade_1'..'grade_12', 'grade-05', '5', 5)
   */
  public static normalizeGradeId(gradeId?: string | number): string {
    if (!gradeId) return 'grade_5';
    const str = String(gradeId).toLowerCase();
    const numMatch = str.match(/\d+/);
    if (numMatch) {
      const n = Number(numMatch[0]);
      if (n >= 1 && n <= 12) {
        return `grade_${n}`;
      }
    }
    return 'grade_5';
  }

  private static extractGradeNumber(gradeId: string): number {
    const m = gradeId.match(/\d+/);
    const n = m ? Number(m[0]) : 5;
    return n >= 1 && n <= 12 ? n : 5;
  }

  public static sanitizePipelineBlocks(blocks: StoryBlock[], chapterId: string = 'ch'): {
    blocks: StoryBlock[];
    changed: boolean;
  } {
    if (!Array.isArray(blocks)) return { blocks: [], changed: true };
    let changed = false;
    const cleanedBlocks: StoryBlock[] = [];
    const canonicalTypes = new Set([
      'block_dialogue',
      'block_anchor_fact',
      'block_theory_rule',
      'block_interactive_sandbox',
      'block_recognition_quiz',
      'block_notebook_task',
      'block_boss_challenge',
      'block_text_marking',
      'block_logic_review',
      'block_somatic_pause',
      'task_ref',
      'world_event',
    ]);

    blocks.forEach((rawBlock: any, idx: number) => {
      if (!rawBlock || typeof rawBlock !== 'object') {
        changed = true;
        return;
      }

      // 0. Normalize non-canonical block types (e.g. 'fact', 'theory', 'quiz', 'notebook', 'blueprint_task', 'boss')
      if (!canonicalTypes.has(String(rawBlock.type || ''))) {
        const mappedList = YamlCurriculumParser.mapObjectBlocks(rawBlock, idx);
        if (mappedList.length > 0) {
          changed = true;
          cleanedBlocks.push(...mappedList);
          return;
        }
      }

      // 1. Clean & recover corrupted dialogue blocks (leaked YAML lines)
      if ((rawBlock.type === 'block_dialogue' || rawBlock.type === 'dialogue') && typeof rawBlock.text === 'string') {
        const rawText = rawBlock.text.trim();
        if (TextShorthandParser.isTechnicalMetadataLine(rawText)) {
          changed = true;
          return;
        }
        const unwrapped = TextShorthandParser.unwrapYamlProseLine(rawText);
        if (unwrapped.text !== rawText) {
          changed = true;
        }
        if (!unwrapped.text || TextShorthandParser.isTechnicalMetadataLine(unwrapped.text)) {
          changed = true;
          return;
        }
        if (unwrapped.field === 'formulatext' || unwrapped.field === 'formula') {
          const prev: any = cleanedBlocks[cleanedBlocks.length - 1];
          if (prev && (prev.type === 'block_theory_rule' || prev.type === 'block_anchor_fact')) {
            prev.formulaText = unwrapped.text;
          } else {
            cleanedBlocks.push({
              id: rawBlock.id || `formula_${chapterId}_${idx}`,
              type: 'block_theory_rule',
              title: 'Ключова формула',
              ruleSummary: `Формула: ${unwrapped.text}`,
              formulaText: unwrapped.text,
              stepByStepBreakdown: [],
            });
          }
          changed = true;
          return;
        }
        if (
          unwrapped.field === 'contentsummary' ||
          unwrapped.field === 'facttext' ||
          unwrapped.field === 'fact' ||
          unwrapped.field === 'context' ||
          unwrapped.field === 'contextstory' ||
          unwrapped.field === 'headline'
        ) {
          cleanedBlocks.push({
            id: rawBlock.id || `fact_${chapterId}_${idx}`,
            type: 'block_anchor_fact',
            headline: 'Контекст уроку',
            contentSummary: unwrapped.text,
            locationLabel: 'Контекст уроку',
          });
          changed = true;
          return;
        }
        if (
          unwrapped.field === 'rulesummary' ||
          unwrapped.field === 'summary' ||
          unwrapped.field === 'theory' ||
          unwrapped.field === 'theorytext' ||
          unwrapped.field === 'rule' ||
          unwrapped.field === 'concept' ||
          unwrapped.field === 'definition' ||
          unwrapped.field === 'explanation' ||
          unwrapped.field === 'callout' ||
          unwrapped.field === 'example' ||
          unwrapped.field === 'details' ||
          unwrapped.field === 'notes' ||
          unwrapped.field === 'note' ||
          unwrapped.field === 'main'
        ) {
          cleanedBlocks.push({
            id: rawBlock.id || `rule_${chapterId}_${idx}`,
            type: 'block_theory_rule',
            title: 'Опорний конспект',
            ruleSummary: unwrapped.text,
            stepByStepBreakdown: [],
          });
          changed = true;
          return;
        }
        if (unwrapped.field === 'notebookprompt' || unwrapped.field === 'prompt' || unwrapped.field === 'instruction') {
          cleanedBlocks.push({
            id: rawBlock.id || `task_${chapterId}_${idx}`,
            type: 'block_notebook_task',
            title: 'Практичне завдання',
            notebookPrompt: unwrapped.text,
            reward: { wood: 25, stone: 10, energy: 15 },
          });
          changed = true;
          return;
        }
        if (unwrapped.field === 'question') {
          cleanedBlocks.push({
            id: rawBlock.id || `q_note_${chapterId}_${idx}`,
            type: 'block_anchor_fact',
            headline: 'Запитання для осмислення',
            contentSummary: unwrapped.text,
            locationLabel: 'Перевірка розуміння',
          });
          changed = true;
          return;
        }
        cleanedBlocks.push({
          ...rawBlock,
          type: 'block_dialogue',
          text: unwrapped.text,
        });
        if (rawBlock.type !== 'block_dialogue') changed = true;
        return;
      }

      // 2. Hydrate theory rule blocks missing `ruleSummary` or holding non-string summary
      if (rawBlock.type === 'block_theory_rule') {
        const currentSummary = typeof rawBlock.ruleSummary === 'string' ? rawBlock.ruleSummary.trim() : '';
        if (!currentSummary) {
          const remapped = YamlCurriculumParser.mapObjectBlock(rawBlock, idx);
          changed = true;
          if (remapped) {
            cleanedBlocks.push(remapped);
            return;
          }
        }
      }

      // 3. Hydrate anchor fact blocks missing `contentSummary` or holding non-string summary
      if (rawBlock.type === 'block_anchor_fact') {
        const currentFact = typeof rawBlock.contentSummary === 'string' ? rawBlock.contentSummary.trim() : '';
        if (!currentFact) {
          const remapped = YamlCurriculumParser.mapObjectBlock(rawBlock, idx);
          changed = true;
          if (remapped) {
            cleanedBlocks.push(remapped);
            return;
          }
        }
      }

      cleanedBlocks.push(rawBlock);
    });

    return { blocks: cleanedBlocks, changed };
  }

  private static sanitizeStoredVolumes(volumes: StoredCustomVolume[]): { volumes: StoredCustomVolume[]; changed: boolean } {
    let anyChanged = false;
    const numberedIdRegex = /(?:lesson|chapter|quest|step|ch)[-_]?\d+|^\d+[-_]/i;

    const repaired = volumes.map((vol) => {
      let volChanged = false;
      const nextPipelines: Record<string, StoryBlock[]> = {};

      Object.entries(vol.pipelines || {}).forEach(([chId, blocks]) => {
        const { blocks: cleanedBlocks, changed } = this.sanitizePipelineBlocks(blocks, chId);
        if (changed) volChanged = true;
        nextPipelines[chId] = cleanedBlocks;
      });

      let nextChapters = Array.isArray(vol.chapters) ? [...vol.chapters] : [];
      if (
        nextChapters.length > 1 &&
        nextChapters.every((c) => numberedIdRegex.test(c.id || ''))
      ) {
        const sorted = [...nextChapters].sort((a, b) => YamlCurriculumParser.naturalCompare(a.id, b.id));
        const orderChanged = sorted.some((c, i) => c.id !== nextChapters[i].id);
        if (orderChanged) {
          nextChapters = sorted;
          volChanged = true;
        }
      }

      nextChapters = nextChapters.map((ch) => {
        const chPipeline = nextPipelines[ch.id] || [];
        const isGenericCount = !ch.description || /^Навчальний урок \(\d+ етапів\)\.?$/i.test(ch.description.trim());
        const hasRawMarkup = Boolean(ch.description && /\{\{|\[\[|<[a-zA-Z]/.test(ch.description));
        if (hasRawMarkup && !isGenericCount) {
          const cleanExisting = stripInlineMarkup(ch.description);
          if (cleanExisting && cleanExisting !== ch.description) {
            volChanged = true;
            return {
              ...ch,
              description: cleanExisting,
              lesson: ch.lesson ? { ...ch.lesson, description: cleanExisting } : ch.lesson,
            };
          }
        }
        if (isGenericCount && chPipeline.length > 0) {
          const infoBlock: any = chPipeline.find(
            (b: any) => b.type === 'block_anchor_fact' || b.type === 'block_theory_rule'
          );
          const rawSummaryText =
            infoBlock?.contentSummary || infoBlock?.ruleSummary || infoBlock?.text || '';
          const summaryText = stripInlineMarkup(String(rawSummaryText));
          if (summaryText) {
            volChanged = true;
            return {
              ...ch,
              description: summaryText,
              lesson: {
                ...ch.lesson,
                description: summaryText,
                storyText: summaryText,
              },
            };
          }
        }
        return ch;
      });

      let nextMap = vol.mapSchema;
      if (volChanged && nextChapters.length > 0) {
        nextMap = YamlCurriculumParser.generateNonOverlappingMapLayout(
          nextChapters,
          `Сюжетна мапа: ${vol.name}`
        );
      }

      if (volChanged) {
        anyChanged = true;
        return {
          ...vol,
          chapters: nextChapters,
          pipelines: nextPipelines,
          mapSchema: nextMap,
        };
      }
      return vol;
    });

    return { volumes: repaired, changed: anyChanged };
  }

  private static sanitizeSubjectOverlays(overlays: Record<string, SubjectOverlay>): {
    overlays: Record<string, SubjectOverlay>;
    changed: boolean;
  } {
    let anyChanged = false;
    const repaired: Record<string, SubjectOverlay> = {};

    Object.entries(overlays || {}).forEach(([key, ov]) => {
      if (!ov || typeof ov !== 'object') return;
      let ovChanged = false;

      const nextPipelines: Record<string, StoryBlock[]> = {};
      Object.entries(ov.pipelines || {}).forEach(([chId, blocks]) => {
        const { blocks: cleaned, changed } = this.sanitizePipelineBlocks(blocks, chId);
        if (changed) ovChanged = true;
        nextPipelines[chId] = cleaned;
      });

      const nextExtended: Record<string, StoryBlock[]> = {};
      Object.entries(ov.extendedBlocksByChapter || {}).forEach(([chId, blocks]) => {
        const { blocks: cleaned, changed } = this.sanitizePipelineBlocks(blocks, chId);
        if (changed) ovChanged = true;
        nextExtended[chId] = cleaned;
      });

      const nextAppended = Array.isArray(ov.appendedChapters)
        ? ov.appendedChapters.map((ch) => {
            const chPipeline = nextPipelines[ch.id] || [];
            const isGenericCount =
              !ch.description || /^Навчальний урок \(\d+ етапів\)\.?$/i.test(ch.description.trim());
            const hasRawMarkup = Boolean(ch.description && /\{\{|\[\[|<[a-zA-Z]/.test(ch.description));
            if (hasRawMarkup && !isGenericCount) {
              const cleanExisting = stripInlineMarkup(ch.description);
              if (cleanExisting && cleanExisting !== ch.description) {
                ovChanged = true;
                return {
                  ...ch,
                  description: cleanExisting,
                  lesson: ch.lesson ? { ...ch.lesson, description: cleanExisting } : ch.lesson,
                };
              }
            }
            if (isGenericCount && chPipeline.length > 0) {
              const infoBlock: any = chPipeline.find(
                (b: any) => b.type === 'block_anchor_fact' || b.type === 'block_theory_rule'
              );
              const rawSummaryText = infoBlock?.contentSummary || infoBlock?.ruleSummary || infoBlock?.text || '';
              const summaryText = stripInlineMarkup(String(rawSummaryText));
              if (summaryText) {
                ovChanged = true;
                return {
                  ...ch,
                  description: summaryText,
                  lesson: {
                    ...ch.lesson,
                    description: summaryText,
                    storyText: summaryText,
                  },
                };
              }
            }
            return ch;
          })
        : [];

      if (ovChanged) {
        anyChanged = true;
        repaired[key] = {
          ...ov,
          appendedChapters: nextAppended,
          pipelines: nextPipelines,
          extendedBlocksByChapter: nextExtended,
        };
      } else {
        repaired[key] = ov;
      }
    });

    return { overlays: repaired, changed: anyChanged };
  }

  /**
   * Read stored custom book volumes from LocalStorage
   */
  public static getStoredCustomVolumes(): StoredCustomVolume[] {
    try {
      const data = localStorage.getItem(CUSTOM_BOOKS_STORAGE_KEY);
      const rawVolumes: StoredCustomVolume[] = data ? JSON.parse(data) : [];
      const { volumes, changed } = this.sanitizeStoredVolumes(rawVolumes);
      if (changed) {
        this.saveStoredCustomVolumes(volumes);
      }
      // Register any saved character voice profiles dynamically
      volumes.forEach((vol) => {
        vol.characters?.forEach((c) => {
          YamlCurriculumParser.parseCharacterYaml(
            `id: "${c.id}"\nname: "${c.name}"\navatar: "${c.avatar}"\npitch: ${c.voice?.pitch || 1}\nspeed: ${c.voice?.speed || 1}\ntone: "${c.voice?.tone || ''}"`
          );
        });
      });
      return volumes;
    } catch {
      return [];
    }
  }

  private static saveStoredCustomVolumes(volumes: StoredCustomVolume[]) {
    try {
      localStorage.setItem(CUSTOM_BOOKS_STORAGE_KEY, JSON.stringify(volumes));
    } catch (err) {
      console.error('Failed to save custom volumes:', err);
    }
  }

  private static getSubjectOverlays(): Record<string, SubjectOverlay> {
    try {
      const data = localStorage.getItem(SUBJECT_OVERLAYS_STORAGE_KEY);
      const rawParsed: Record<string, SubjectOverlay> = data ? JSON.parse(data) : {};
      const { overlays: parsed, changed } = this.sanitizeSubjectOverlays(rawParsed);
      if (changed) {
        this.saveSubjectOverlays(parsed);
      }
      Object.values(parsed).forEach((ov) => {
        ov.characters?.forEach((c) => {
          YamlCurriculumParser.parseCharacterYaml(
            `id: "${c.id}"\nname: "${c.name}"\navatar: "${c.avatar}"\npitch: ${c.voice?.pitch || 1}\nspeed: ${c.voice?.speed || 1}\ntone: "${c.voice?.tone || ''}"`
          );
        });
      });
      return parsed;
    } catch {
      return {};
    }
  }

  private static saveSubjectOverlays(overlays: Record<string, SubjectOverlay>) {
    try {
      localStorage.setItem(SUBJECT_OVERLAYS_STORAGE_KEY, JSON.stringify(overlays));
    } catch (err) {
      console.error('Failed to save subject overlays:', err);
    }
  }

  private static formatQuestToChapter(quest: ParsedYamlQuest): Chapter {
    const cleanTitle = quest.title || 'Навчальний епізод';

    let cleanDesc =
      quest.description &&
      !quest.description.includes('Урок імпортовано з') &&
      !quest.description.startsWith('Навчальний епізод із')
        ? quest.description
        : '';

    if (!cleanDesc || /^Навчальний урок \(\d+ етапів\)\.?$/i.test(cleanDesc.trim())) {
      cleanDesc = '';
      if (quest.topic) {
        cleanDesc = `Тема: ${quest.topic}. `;
      }
      const factBlock: any = quest.pipeline?.find(
        (b: any) => b.type === 'block_anchor_fact' || b.type === 'block_theory_rule'
      );
      if (factBlock) {
        const textVal =
          factBlock.contentSummary || factBlock.factText || factBlock.text || factBlock.content || factBlock.ruleSummary;
        if (textVal) cleanDesc += textVal;
      } else {
        const dialogueBlock: any = quest.pipeline?.find((b: any) => b.type === 'block_dialogue' && b.text);
        if (dialogueBlock?.text) {
          cleanDesc += dialogueBlock.text;
        } else {
          const blockCount = quest.pipeline ? quest.pipeline.length : 0;
          cleanDesc += `Навчальний урок (${blockCount} етапів).`;
        }
      }
    }

    const quizBlock: any = quest.pipeline?.find((b: any) => b.type === 'block_recognition_quiz');
    const notebookBlock: any = quest.pipeline?.find((b: any) => b.type === 'block_notebook_task');
    const bossBlock: any = quest.pipeline?.find((b: any) => b.type === 'block_boss_challenge');
    const theoryBlock: any = quest.pipeline?.find((b: any) => b.type === 'block_theory_rule');

    const recognitionQuestion = quizBlock
      ? {
          id: quizBlock.id || `rec_${quest.id}`,
          question: quizBlock.prompt || quizBlock.question || 'Перевірка розуміння матеріалу:',
          options:
            quizBlock.options?.map((o: any) => (typeof o === 'string' ? o : o.text)) || ['Так', 'Ні'],
          correctIndex: quizBlock.correctIndex ?? 0,
          explanation: quizBlock.explanation || quizBlock.feedbackSuccess || 'Вірно!',
        }
      : {
          id: `rec_${quest.id}`,
          question: 'Перевірка розуміння матеріалу:',
          options: ['Варіант А', 'Варіант Б'],
          correctIndex: 0,
          explanation: 'Вірно!',
        };

    const notebookTask = notebookBlock
      ? {
          id: notebookBlock.id || `manual_${quest.id}`,
          title: notebookBlock.title || 'Практичне завдання',
          contextStory: notebookBlock.contextStory || cleanDesc,
          notebookPrompt: notebookBlock.prompt || notebookBlock.notebookPrompt || 'Виконайте розрахунок:',
          question: 'Результат:',
          correctAnswer: notebookBlock.expectedValue ?? notebookBlock.correctAnswer ?? '',
          hint: notebookBlock.hint || 'Скористайтеся матеріалами уроку.',
          hints: notebookBlock.hints,
          reward: notebookBlock.reward || { wood: 25, stone: 10, energy: 15 },
        }
      : {
          id: `manual_${quest.id}`,
          title: 'Практичне завдання',
          contextStory: cleanDesc,
          notebookPrompt: 'Виконайте завдання уроку:',
          question: 'Результат:',
          correctAnswer: '',
          hint: 'Скористайтеся теоретичним правилом уроку.',
          reward: { wood: 25, stone: 10, energy: 15 },
        };

    const bossChallenge = bossBlock
      ? {
          id: bossBlock.id || `challenge_${quest.id}`,
          title: bossBlock.title || 'Підсумкове завдання',
          contextStory: bossBlock.contextStory || 'Самостійне виконання вправи',
          notebookPrompt: bossBlock.instruction || bossBlock.notebookPrompt || 'Виконайте завдання:',
          question: 'Результат:',
          correctAnswer: bossBlock.expected ?? bossBlock.engineConfig?.targetNumber ?? bossBlock.correctAnswer ?? '',
          hint: bossBlock.hint || 'Перевірте власні обчислення.',
          hints: bossBlock.hints,
          reward: bossBlock.reward || { wood: 40, stone: 20, energy: 25 },
        }
      : {
          id: `challenge_${quest.id}`,
          title: 'Підсумкове завдання',
          contextStory: 'Самостійне виконання вправи',
          notebookPrompt: 'Виконайте підсумкове завдання:',
          question: 'Результат:',
          correctAnswer: '',
          hint: 'Перевірте обчислення.',
          reward: { wood: 40, stone: 20, energy: 25 },
        };

    const theoryConcept = theoryBlock
      ? {
          title: theoryBlock.title || '📖 Опорний конспект',
          ruleSummary: theoryBlock.ruleSummary || '',
          formulaText: theoryBlock.formulaText,
          stepByStepBreakdown: theoryBlock.stepByStepBreakdown || [],
        }
      : undefined;

    return {
      id: quest.id,
      title: cleanTitle,
      description: cleanDesc,
      islandStageName: quest.islandStageName || undefined,
      subjectId: quest.subjectId,
      gradeId: quest.gradeId,
      mapTopology: quest.mapTopology,
      lesson: {
        id: quest.id,
        title: cleanTitle,
        islandStageName: quest.islandStageName || undefined,
        description: cleanDesc,
        storyText: cleanDesc,
        conceptTitle: cleanTitle,
        conceptBreakdown: {
          number1: 0,
          tens1: 0,
          ones1: 0,
          number2: 0,
          tens2: 0,
          ones2: 0,
          sumTens: 0,
          sumOnes: 0,
          totalSum: 0,
        },
        theoryConcept,
        recognitionQuestion,
        multipleChoiceTasks: [],
        notebookManualTasks: [notebookTask],
        independentChallengeTask: bossChallenge,
      },
    };
  }

  public static getSubjectCategoryName(subjectCategory?: string): string {
    const key = String(subjectCategory || '').toLowerCase();
    if (key.includes('math')) return 'Математика';
    if (key.includes('history')) return 'Історія України';
    if (key.includes('science') || key.includes('nature')) return 'Природознавство';
    if (key.includes('physics')) return 'Фізика';
    if (key.includes('ukrainian') || key.includes('mova')) return 'Українська мова';
    if (key.includes('informatics') || key.includes('cs')) return 'Інформатика';
    if (key.includes('cyber')) return 'Кібербезпека';
    if (key.includes('music')) return 'Музичне мистецтво';
    if (key.includes('art') || key.includes('draw')) return 'Образотворче мистецтво';
    if (key.includes('biology')) return 'Біологія';
    if (key.includes('chemistry')) return 'Хімія';
    if (key.includes('geography')) return 'Географія';
    if (key.includes('english')) return 'Англійська мова';
    if (key.includes('literature')) return 'Література';
    return subjectCategory && subjectCategory !== 'custom' ? subjectCategory : 'Навчальний предмет';
  }

  private static getFallbackSubjectLabel(subjectId: string): { name: string; icon: string; desc: string } {
    switch (subjectId) {
      case 'math':
        return { name: 'Математика', icon: '📐', desc: 'Навчальний курс математики.' };
      case 'history':
        return { name: 'Історія України', icon: '📜', desc: 'Навчальний курс історії.' };
      case 'science':
        return { name: 'Природознавство', icon: '🌿', desc: 'Дослідження природи та науки.' };
      case 'physics':
        return { name: 'Фізика', icon: '⚛️', desc: 'Фізичні закони та моделювання.' };
      case 'ukrainian':
        return { name: 'Українська мова', icon: '📖', desc: 'Мова та література.' };
      case 'informatics':
        return { name: 'Інформатика', icon: '💻', desc: 'Алгоритми, логіка та цифрові технології.' };
      case 'cybersecurity':
        return { name: 'Кібербезпека', icon: '🛡️', desc: 'Цифрова гігієна, захист від шахраїв та протоколи безпеки.' };
      case 'music':
        return { name: 'Музичне мистецтво', icon: '🎵', desc: 'Слух, пентатоніка, ритм і музична грамота.' };
      case 'art':
        return { name: 'Образотворче мистецтво', icon: '🎨', desc: 'Колір Іттена, лінійна перспектива та світлотінь.' };
      default:
        return { name: this.getSubjectCategoryName(subjectId), icon: '📘', desc: 'Навчальний курс.' };
    }
  }

  /**
   * Build all 12 grades (1–12) dynamically from `/content/` + overlays + custom volumes
   */
  public static getGrades(): GradeConfig[] {
    this.initCache();
    const storedVolumes = this.getStoredCustomVolumes();
    const overlays = this.getSubjectOverlays();

    const grades: GradeConfig[] = [];

    for (let gradeNum = 1; gradeNum <= 12; gradeNum++) {
      const gradeId = `grade_${gradeNum}`;
      const subjects: SubjectConfig[] = [];

      // 1. Add subjects discovered in /content/ for this grade
      this.bundledSubjects.forEach((bucket) => {
        if (bucket.gradeId !== gradeId) return;

        const overlayKey = `${gradeId}::${bucket.id}`;
        const overlay = overlays[overlayKey] || overlays[bucket.id];
        const fallbackLabel = this.getFallbackSubjectLabel(bucket.id);

        const baseChapters = bucket.quests.map((q) => this.formatQuestToChapter(q));
        const appendedChapters = overlay?.appendedChapters || [];
        const allChapters = [...baseChapters];
        appendedChapters.forEach((ch) => {
          if (!allChapters.some((existing) => existing.id === ch.id)) {
            allChapters.push(ch);
          }
        });

        const mergedBlueprints: Record<string, Blueprint> = {
          ...bucket.blueprints,
          ...(overlay?.blueprints || {}),
        };

        // Scoped ID guarantees uniqueness across grades if multiple grades have 'math'
        const subjectUniqueId = `${gradeId}_${bucket.id}`;
        const hasChapters = allChapters.length > 0;

        subjects.push({
          id: subjectUniqueId,
          subjectCategory: bucket.id,
          gradeId,
          name: overlay?.name || bucket.meta?.name || fallbackLabel.name,
          description: overlay?.description || bucket.meta?.description || fallbackLabel.desc,
          iconName: overlay?.iconName || bucket.meta?.iconName || fallbackLabel.icon,
          authorLabel: bucket.meta?.authorLabel || 'Програма курсу',
          isAvailable: bucket.meta?.isAvailable ?? true,
          isCustom: false,
          chapters: allChapters,
          blueprints: mergedBlueprints,
        });

        // Also ensure mapTopology / availability metadata stays clean
        if (!hasChapters && Object.keys(mergedBlueprints).length > 0) {
          subjects[subjects.length - 1].description += ' (Додано креслення; очікуються уроки)';
        }
      });

      // 2. Add custom volumes imported by the user for this grade
      const gradeCustom = storedVolumes.filter((v) => this.normalizeGradeId(v.gradeId) === gradeId);
      gradeCustom.forEach((vol) => {
        subjects.push({
          id: vol.id,
          subjectCategory: vol.subjectCategory,
          gradeId,
          name: vol.name,
          description: vol.description,
          iconName: vol.iconName,
          authorLabel: vol.authorLabel,
          isAvailable: vol.isAvailable,
          isCustom: true,
          chapters: vol.chapters,
          blueprints: vol.blueprints || {},
        });
      });

      const totalChapters = subjects.reduce((sum, s) => sum + s.chapters.length, 0);
      const hasAnySubject = subjects.length > 0;
      const isComplete = totalChapters > 0;
      const hasPartial = hasAnySubject && !isComplete;

      let description = 'Матеріали для цього класу ще відсутні. Додайте курс через /content/ або імпортуйте пакет.';
      if (isComplete) {
        description = `Доступно предметів: ${subjects.length} · Уроків: ${totalChapters}.`;
      } else if (hasPartial) {
        description = 'Матеріали неповні: предмети створені, але уроки ще не додані.';
      }

      grades.push({
        id: gradeId,
        gradeNumber: gradeNum,
        name: `${gradeNum} Клас`,
        description,
        isAvailable: isComplete,
        hasPartialMaterials: hasPartial,
        subjects,
      });
    }

    return grades;
  }

  public static getSubjectById(subjectId: string, gradeId?: string): SubjectConfig | undefined {
    const grades = this.getGrades();
    if (gradeId) {
      const normalized = this.normalizeGradeId(gradeId);
      const g = grades.find((gr) => gr.id === normalized);
      if (g) {
        const direct = g.subjects.find((s) => s.id === subjectId || s.subjectCategory === subjectId);
        if (direct) return direct;
      }
    }
    for (const g of grades) {
      const found = g.subjects.find((s) => s.id === subjectId || s.subjectCategory === subjectId);
      if (found) return found;
    }
    return undefined;
  }

  public static getChapters(): Chapter[] {
    this.initCache();
    const chapters: Chapter[] = [];
    this.bundledQuests.forEach((quest) => {
      chapters.push(this.formatQuestToChapter(quest));
    });
    return chapters;
  }

  public static getChaptersForSubject(subjectId: string, gradeId?: string): Chapter[] {
    if (!subjectId) return [];
    const subject = this.getSubjectById(subjectId, gradeId);
    return subject?.chapters || [];
  }

  public static getPipelineForChapter(chapterId: string, subjectId?: string): StoryBlock[] | null {
    this.initCache();
    const overlays = this.getSubjectOverlays();

    // Check extended blocks across overlays
    const findOverlayExtension = (): StoryBlock[] => {
      for (const ov of Object.values(overlays)) {
        if (ov.extendedBlocksByChapter && ov.extendedBlocksByChapter[chapterId]) {
          return ov.extendedBlocksByChapter[chapterId];
        }
      }
      return [];
    };

    const bundledQuest = this.bundledQuests.get(chapterId);
    if (bundledQuest && bundledQuest.pipeline.length > 0) {
      return [...bundledQuest.pipeline, ...findOverlayExtension()];
    }

    // Check appended chapters in overlays
    for (const ov of Object.values(overlays)) {
      if (ov.pipelines && ov.pipelines[chapterId]) {
        return [...ov.pipelines[chapterId], ...findOverlayExtension()];
      }
    }

    // Check custom volumes
    const customVolumes = this.getStoredCustomVolumes();
    if (subjectId) {
      const specificVol = customVolumes.find((v) => v.id === subjectId);
      if (specificVol?.pipelines?.[chapterId]) {
        return specificVol.pipelines[chapterId];
      }
    }
    for (const vol of customVolumes) {
      if (vol.pipelines && vol.pipelines[chapterId]) {
        return vol.pipelines[chapterId];
      }
    }

    return null;
  }

  /**
   * Resolves a technical blueprint by ID from subject blueprints, overlays, custom volumes, or bundled cache
   */
  public static getBlueprintById(blueprintId: string, subjectId?: string): Blueprint | undefined {
    this.initCache();
    if (!blueprintId) return undefined;

    if (subjectId) {
      const subject = this.getSubjectById(subjectId);
      if (subject?.blueprints?.[blueprintId]) {
        return subject.blueprints[blueprintId];
      }
    }

    const customVolumes = this.getStoredCustomVolumes();
    for (const vol of customVolumes) {
      if (vol.blueprints?.[blueprintId]) {
        return vol.blueprints[blueprintId];
      }
    }

    const overlays = this.getSubjectOverlays();
    for (const ov of Object.values(overlays)) {
      if (ov.blueprints?.[blueprintId]) {
        return ov.blueprints[blueprintId];
      }
    }

    return this.bundledBlueprints.get(blueprintId);
  }

  public static getWorldMapSchemaForSubject(subjectId: string, gradeId?: string): WorldMapSchema {
    this.initCache();
    const subject = this.getSubjectById(subjectId, gradeId);
    const chapters = this.getChaptersForSubject(subjectId, gradeId);
    const mapTitle = subject ? `Сюжетна мапа: ${subject.name}` : 'Сюжетна мапа курсу';

    // 1. Custom volume saved map
    const customVolumes = this.getStoredCustomVolumes();
    const volIndex = customVolumes.findIndex((v) => v.id === subjectId);
    if (volIndex !== -1) {
      const customVol = customVolumes[volIndex];
      if (customVol.mapSchema && customVol.mapSchema.nodes && customVol.mapSchema.nodes.length > 0) {
        return customVol.mapSchema;
      }
      if (customVol.chapters && customVol.chapters.length > 0) {
        const autoMap = YamlCurriculumParser.generateNonOverlappingMapLayout(customVol.chapters, mapTitle);
        customVol.mapSchema = autoMap;
        customVolumes[volIndex] = customVol;
        this.saveStoredCustomVolumes(customVolumes);
        return autoMap;
      }
    }

    // 2. Overlay custom map for bundled subject
    const overlays = this.getSubjectOverlays();
    const overlayKey = subject ? `${subject.gradeId}::${subject.subjectCategory}` : subjectId;
    const overlay = overlays[overlayKey] || overlays[subjectId];
    if (overlay?.mapSchema && overlay.mapSchema.nodes.length > 0) {
      return overlay.mapSchema;
    }

    // 3. Bundled map.yaml for subject
    if (subject) {
      const bucketKey = `${subject.gradeId}::${subject.subjectCategory || subject.id}`;
      const bucket = this.bundledSubjects.get(bucketKey);
      if (bucket?.mapSchema && bucket.mapSchema.nodes.length > 0) {
        return bucket.mapSchema;
      }
    }

    // 4. Embedded mapTopology from chapter if it describes multiple steps/chapters
    if (chapters.length === 1 && chapters[0].mapTopology && chapters[0].mapTopology.nodes.length > 0) {
      return chapters[0].mapTopology;
    }

    // 5. Dynamic non-overlapping serpentine map generated strictly from actual chapters
    if (chapters.length > 0) {
      return YamlCurriculumParser.generateNonOverlappingMapLayout(chapters, mapTitle);
    }

    return {
      mapTitle,
      nodes: [],
    };
  }

  /**
   * Register a new custom book volume, append episode/blueprint/map/characters to an existing custom or bundled subject,
   * or extend an existing lesson pipeline.
   */
  public static registerCustomVolume(params: RegisterVolumeParams): { volumeId: string; questId: string } {
    this.initCache();
    const {
      gradeId,
      subjectCategory,
      bookTitle,
      authorLabel,
      description,
      iconName,
      quest,
      blueprint,
      characters,
      mode,
      targetSubjectId,
      targetChapterId,
      mapSchema,
    } = params;

    const normalizedGradeId = this.normalizeGradeId(gradeId);
    const newChapter = quest ? this.formatQuestToChapter(quest) : undefined;
    const storedVolumes = this.getStoredCustomVolumes();

    let volIndex = -1;
    if (targetSubjectId) {
      volIndex = storedVolumes.findIndex((v) => v.id === targetSubjectId);
    }

    // Check if targetSubjectId points to a bundled /content/ subject (e.g. 'grade_5_math' or 'math')
    const bundledTarget = targetSubjectId ? this.getSubjectById(targetSubjectId, normalizedGradeId) : undefined;
    const isBundledTarget = Boolean(bundledTarget && !bundledTarget.isCustom && volIndex === -1);

    if ((mode === 'extend_lesson' || mode === 'append') && isBundledTarget && bundledTarget) {
      const overlays = this.getSubjectOverlays();
      const overlayKey = `${bundledTarget.gradeId}::${bundledTarget.subjectCategory || bundledTarget.id}`;
      const existing: SubjectOverlay = overlays[overlayKey] || {
        subjectId: bundledTarget.id,
        gradeId: bundledTarget.gradeId,
        appendedChapters: [],
        pipelines: {},
        extendedBlocksByChapter: {},
        blueprints: {},
        characters: [],
      };

      if (mode === 'extend_lesson' && targetChapterId && quest) {
        const prev = existing.extendedBlocksByChapter[targetChapterId] || [];
        existing.extendedBlocksByChapter[targetChapterId] = [...prev, ...quest.pipeline];
      } else if (newChapter && quest) {
        if (!existing.appendedChapters.some((c) => c.id === newChapter.id)) {
          existing.appendedChapters.push(newChapter);
        }
        existing.pipelines[quest.id] = quest.pipeline;
      }

      if (blueprint) {
        existing.blueprints[blueprint.id] = blueprint;
      }
      if (characters && characters.length > 0) {
        existing.characters = [...existing.characters, ...characters];
      }
      if (mapSchema) {
        existing.mapSchema = mapSchema;
      }
      if (bookTitle && mode === 'append' && !existing.name) {
        // Keep bundled subject name unless manifest explicitly overrides
      }

      overlays[overlayKey] = existing;
      this.saveSubjectOverlays(overlays);
      return {
        volumeId: bundledTarget.id,
        questId: targetChapterId || quest?.id || bundledTarget.chapters[0]?.id || '',
      };
    }

    // Mode: Extend existing custom volume lesson
    if (mode === 'extend_lesson' && targetChapterId && volIndex !== -1 && quest) {
      const vol = storedVolumes[volIndex];
      const existingPipeline = vol.pipelines[targetChapterId] || this.getPipelineForChapter(targetChapterId) || [];
      vol.pipelines[targetChapterId] = [...existingPipeline, ...quest.pipeline];
      if (blueprint) {
        vol.blueprints = { ...(vol.blueprints || {}), [blueprint.id]: blueprint };
      }
      if (characters?.length) {
        vol.characters = [...(vol.characters || []), ...characters];
      }
      if (mapSchema) vol.mapSchema = mapSchema;
      storedVolumes[volIndex] = vol;
      this.saveStoredCustomVolumes(storedVolumes);
      return { volumeId: vol.id, questId: targetChapterId };
    }

    // Mode: Append to existing custom volume
    if (mode === 'append' && volIndex !== -1) {
      const vol = storedVolumes[volIndex];
      if (newChapter && quest) {
        if (!vol.chapters.some((c) => c.id === quest.id)) {
          vol.chapters.push(newChapter);
        }
        vol.pipelines[quest.id] = quest.pipeline;
      }
      if (blueprint) {
        vol.blueprints = { ...(vol.blueprints || {}), [blueprint.id]: blueprint };
      }
      if (characters?.length) {
        vol.characters = [...(vol.characters || []), ...characters];
      }
      if (mapSchema) vol.mapSchema = mapSchema;
      storedVolumes[volIndex] = vol;
      this.saveStoredCustomVolumes(storedVolumes);
      return { volumeId: vol.id, questId: quest?.id || vol.chapters[0]?.id || '' };
    }

    // Default: Create a new custom volume (book)
    const volumeId = `${subjectCategory}_custom_${Date.now()}`;
    const fallbackLabel = this.getFallbackSubjectLabel(subjectCategory);

    const newVolume: StoredCustomVolume = {
      id: volumeId,
      gradeId: normalizedGradeId,
      subjectCategory,
      name: bookTitle.trim() || quest?.title || fallbackLabel.name,
      description: description || quest?.description || 'Навчальний курс із практичними завданнями.',
      iconName: iconName || fallbackLabel.icon,
      authorLabel: authorLabel || 'Авторський курс',
      isAvailable: true,
      isCustom: true,
      chapters: newChapter ? [newChapter] : [],
      pipelines: quest ? { [quest.id]: quest.pipeline } : {},
      blueprints: blueprint ? { [blueprint.id]: blueprint } : {},
      characters: characters || [],
      mapSchema,
    };

    storedVolumes.push(newVolume);
    this.saveStoredCustomVolumes(storedVolumes);

    return { volumeId, questId: quest?.id || '' };
  }

  public static deleteCustomVolume(volumeId: string, subjectName?: string): boolean {
    const targetIdStr = String(volumeId).trim().toLowerCase();
    const targetNameStr = subjectName ? String(subjectName).trim().toLowerCase() : '';

    try {
      const data = localStorage.getItem(CUSTOM_BOOKS_STORAGE_KEY);
      const stored: StoredCustomVolume[] = data ? JSON.parse(data) : [];
      const initialLength = stored.length;

      const filtered = stored.filter((v) => {
        const vId = String(v.id).trim().toLowerCase();
        const vName = String(v.name).trim().toLowerCase();
        if (vId === targetIdStr) return false;
        if (targetNameStr && vName === targetNameStr) return false;
        return true;
      });

      this.saveStoredCustomVolumes(filtered);
      window.dispatchEvent(new Event('nush_storage_change'));
      return filtered.length < initialLength;
    } catch (err) {
      console.error('Failed to delete custom volume:', err);
      return false;
    }
  }

  public static deleteChapterFromVolume(volumeId: string, chapterId: string): boolean {
    try {
      const data = localStorage.getItem(CUSTOM_BOOKS_STORAGE_KEY);
      const stored: StoredCustomVolume[] = data ? JSON.parse(data) : [];
      const volIndex = stored.findIndex(
        (v) => String(v.id).trim().toLowerCase() === String(volumeId).trim().toLowerCase()
      );
      if (volIndex !== -1) {
        const vol = stored[volIndex];
        vol.chapters = vol.chapters.filter(
          (c) => String(c.id).trim().toLowerCase() !== String(chapterId).trim().toLowerCase()
        );
        delete vol.pipelines[chapterId];
        vol.mapSchema = YamlCurriculumParser.generateNonOverlappingMapLayout(
          vol.chapters,
          `Сюжетна мапа: ${vol.name}`
        );
        stored[volIndex] = vol;
        this.saveStoredCustomVolumes(stored);
        window.dispatchEvent(new Event('nush_storage_change'));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete chapter:', err);
      return false;
    }
  }

  public static upsertChapterInVolume(
    volumeId: string,
    chapterMeta: {
      id: string;
      title: string;
      description?: string;
      islandStageName?: string;
    },
    pipeline: StoryBlock[]
  ): boolean {
    try {
      const stored = this.getStoredCustomVolumes();
      const volIndex = stored.findIndex((v) => v.id === volumeId);
      if (volIndex === -1) return false;

      const vol = stored[volIndex];
      const chIndex = vol.chapters.findIndex((c) => c.id === chapterMeta.id);
      const nextChapter = this.formatQuestToChapter({
        id: chapterMeta.id,
        title: chapterMeta.title,
        description: chapterMeta.description || 'Навчальна тема курсу.',
        islandStageName: chapterMeta.islandStageName,
        pipeline,
      });

      if (chIndex >= 0) {
        vol.chapters[chIndex] = nextChapter;
      } else {
        vol.chapters.push(nextChapter);
      }

      vol.pipelines[chapterMeta.id] = pipeline;
      vol.mapSchema = YamlCurriculumParser.generateNonOverlappingMapLayout(
        vol.chapters,
        `Сюжетна мапа: ${vol.name}`
      );
      stored[volIndex] = vol;
      this.saveStoredCustomVolumes(stored);
      window.dispatchEvent(new Event('nush_storage_change'));
      return true;
    } catch {
      return false;
    }
  }

  public static reorderVolumeChapters(volumeId: string, orderedChapterIds: string[]): boolean {
    try {
      const stored = this.getStoredCustomVolumes();
      const volIndex = stored.findIndex((v) => v.id === volumeId);
      if (volIndex === -1) return false;

      const vol = stored[volIndex];
      const byId = new Map(vol.chapters.map((c) => [c.id, c]));
      const reordered: Chapter[] = [];
      orderedChapterIds.forEach((id) => {
        const found = byId.get(id);
        if (found) reordered.push(found);
      });
      vol.chapters.forEach((c) => {
        if (!orderedChapterIds.includes(c.id)) reordered.push(c);
      });

      vol.chapters = reordered;
      vol.mapSchema = YamlCurriculumParser.generateNonOverlappingMapLayout(
        vol.chapters,
        `Сюжетна мапа: ${vol.name}`
      );
      stored[volIndex] = vol;
      this.saveStoredCustomVolumes(stored);
      window.dispatchEvent(new Event('nush_storage_change'));
      return true;
    } catch {
      return false;
    }
  }
}
