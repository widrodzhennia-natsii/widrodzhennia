import * as yaml from 'js-yaml';
import { BlockHintItem, StoryBlock } from '../core/contracts/campaign.contract';
import { Blueprint, BlueprintSchema as BlueprintZodSchema } from '../core/contracts/blueprint.schema';
import { SubjectConfig, WorldMapSchema } from '../curriculum/types';
import { advancedFormantSynth } from '../core/audio/formant-synth';

export interface ParsedYamlQuest {
  id: string;
  grade?: number | string;
  gradeId?: string;
  subject?: string;
  subjectId?: string;
  topic?: string;
  title: string;
  description: string;
  islandStageName?: string;
  mapTopology?: WorldMapSchema;
  copilotAdvice?: string;
  vars?: Record<string, any>;
  pipeline: StoryBlock[];
}

export interface ParsedCharacterYaml {
  id: string;
  name: string;
  avatar: string;
  voice: {
    pitch: number;
    speed: number;
    tone?: string;
  };
  description?: string;
}

export type BlueprintSchema = Blueprint;

interface LessonDefaults {
  speaker?: string;
  speakerAvatar?: string;
  islandStageName?: string;
  vars?: Record<string, any>;
}

export class YamlCurriculumParser {
  private static stripCodeFence(rawText: string): string {
    const noBom = String(rawText || '').replace(/^\uFEFF/, '').trim();
    const fullFence = noBom.match(/^```(?:ya?ml|json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
    if (fullFence) return fullFence[1];

    // Support markdown wrappers like `# Title\n```yaml\n...\n````
    const embeddedYamlFence = noBom.match(/```(?:ya?ml)\s*\r?\n([\s\S]*?)\r?\n```/i);
    if (embeddedYamlFence) return embeddedYamlFence[1];

    return noBom;
  }

  private static normalizeYamlSyntax(text: string): string {
    return text
      .replace(/^\uFEFF/, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/^[ \t]+/gm, (indent) => indent.replace(/\t/g, '  '));
  }

  private static isBalancedDelimited(val: string, open: string, close: string): boolean {
    return val.startsWith(open) && val.endsWith(close) && val.length >= 2;
  }

  private static autoQuoteProblematicColons(text: string): string {
    const keyValRegex = /^(\s*(?:-\s+)?[a-zA-Z_][a-zA-Z0-9_-]*\s*:\s*)(.+)$/;
    return text
      .split('\n')
      .map((line) => {
        const m = line.match(keyValRegex);
        if (!m) return line;
        const prefix = m[1];
        const val = m[2].trim();
        if (
          !val ||
          val === '|' ||
          val === '|-' ||
          val === '>' ||
          val === '>-' ||
          this.isBalancedDelimited(val, "'", "'") ||
          this.isBalancedDelimited(val, '[', ']') ||
          this.isBalancedDelimited(val, '{', '}')
        ) {
          return line;
        }
        // Leave properly closed double-quoted scalars alone (no unescaped inner quote before end)
        if (val.startsWith('"') && val.endsWith('"') && !val.slice(1, -1).includes('"')) {
          return line;
        }
        if (
          val.includes(': ') ||
          val.endsWith(':') ||
          val.includes(' #') ||
          val.startsWith('#') ||
          val.startsWith('*') ||
          val.startsWith('!') ||
          val.startsWith('@') ||
          val.startsWith('&') ||
          val.startsWith('%') ||
          val.startsWith('[') ||
          val.startsWith('{') ||
          (val.startsWith('"') && !val.endsWith('"'))
        ) {
          const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          return `${prefix}"${escaped}"`;
        }
        return line;
      })
      .join('\n');
  }

  private static escapeBadDoubleQuoteBackslashes(text: string): string {
    // Fix unescaped LaTeX/Windows backslashes inside double-quoted YAML strings
    return text.replace(/"([^"\n]*)"/g, (full, inner) => {
      if (!inner.includes('\\')) return full;
      // 1. Protect common LaTeX commands starting with [bfnrt] (e.g. \frac, \times, \text, \beta, \right, \nu)
      let fixed = inner.replace(
        /(?<!\\)\\(?=(?:frac|forall|times|text|textbf|textit|tan|theta|tau|to|triangle|beta|binom|bar|right|Rightarrow|rho|neq|nu|nabla|notin)\b)/g,
        '\\\\'
      );
      // 2. Escape any remaining invalid JSON/YAML escape backslashes (e.g. \cdot, \sqrt, \alpha)
      fixed = fixed.replace(/(?<!\\)\\(?![\\"\/bfnrtuUx0])/g, '\\\\');
      return `"${fixed}"`;
    });
  }

  private static parseYamlDocuments(text: string): any {
    const docs: any[] = [];
    yaml.loadAll(
      text,
      (doc) => {
        if (doc !== undefined && doc !== null) docs.push(doc);
      },
      { json: true }
    );
    if (docs.length === 0) return null;
    if (docs.length === 1) return docs[0];
    if (docs.every((d) => d && typeof d === 'object' && !Array.isArray(d))) {
      return Object.assign({}, ...docs);
    }
    return docs.find((d) => d && typeof d === 'object') || docs[0];
  }

  private static safeLoadYaml(rawText: string): any {
    const cleaned = this.escapeBadDoubleQuoteBackslashes(
      this.normalizeYamlSyntax(this.stripCodeFence(rawText))
    );
    if (!cleaned) return null;
    try {
      return this.parseYamlDocuments(cleaned);
    } catch {
      try {
        const fixed = this.autoQuoteProblematicColons(cleaned);
        return this.parseYamlDocuments(fixed);
      } catch {
        try {
          const fixed2 = this.escapeBadDoubleQuoteBackslashes(this.autoQuoteProblematicColons(cleaned));
          return this.parseYamlDocuments(fixed2);
        } catch {
          return null;
        }
      }
    }
  }

  /**
   * Detects whether pasted text / .md / .txt content is actually a structured YAML lesson
   */
  public static looksLikeYaml(rawText: string): boolean {
    const cleaned = this.normalizeYamlSyntax(this.stripCodeFence(rawText));
    if (!cleaned) return false;
    const hasYamlStructure =
      /(?:^|\n)\s*(?:blocks|pipeline|steps|stages|scenes|tasks|sections|slides|episodes|activities|items|elements|lesson|chapter|scenario|quest|module|unit|topic|course)\s*:/i.test(
        cleaned
      ) ||
      /(?:^|\n)\s*-\s+(?:type|id|speaker|question|title|headline|theory|fact|rule|dialogue|quiz|task|sandbox)\s*:/i.test(
        cleaned
      ) ||
      (/^(?:id|title|subjectId|gradeId|meta|metadata)\s*:/im.test(cleaned) &&
        /(?:^|\n)\s*-\s+[a-zA-Z_]+\s*:/m.test(cleaned));
    if (!hasYamlStructure) return false;
    const parsed = this.safeLoadYaml(cleaned);
    return Boolean(parsed && (typeof parsed === 'object' || Array.isArray(parsed)));
  }

  public static naturalCompare(a: string, b: string): number {
    return String(a || '').localeCompare(String(b || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private static extractTextField(val: any): string {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return String(val).trim();
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.extractTextField(item)).filter(Boolean).join('\n');
    }
    if (typeof val === 'object') {
      const primary =
        this.firstNonEmptyText(
          val.text,
          val.content,
          val.body,
          val.main,
          val.description,
          val.summary,
          val.rule,
          val.ruleSummary,
          val.contentSummary,
          val.factText,
          val.fact,
          val.theory,
          val.theoryText,
          val.explanation,
          val.definition,
          val.markdown,
          val.notes,
          val.note,
          val.uk,
          val.value,
          val.caption,
          val.prompt,
          val.instruction
        ) || '';
      const heading = val.title || val.headline || val.name ? String(val.title || val.headline || val.name).trim() : '';
      const formula = val.formulaText || val.formula ? `Формула: ${val.formulaText || val.formula}` : '';
      const example = val.example ? `Приклад: ${this.extractTextField(val.example)}` : '';
      const code = val.code ? `\`\`\`${val.language || ''}\n${String(val.code)}\n\`\`\`` : '';

      const ordered = [heading, primary, formula, example, code].filter(Boolean);
      if (ordered.length > 0) {
        return ordered.join('\n').trim();
      }

      // Generic object fallback: collect scalar prose fields
      const genericParts = Object.entries(val)
        .filter(([k, v]) => !['id', 'type', 'blockType', 'kind', 'emote', 'avatar', 'order'].includes(k) && v !== undefined && v !== null)
        .map(([, v]) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : this.extractTextField(v)))
        .filter(Boolean);
      return genericParts.join('\n').trim();
    }
    return '';
  }

  private static firstNonEmptyText(...candidates: any[]): string {
    for (const c of candidates) {
      const extracted = this.extractTextField(c);
      if (extracted) return extracted;
    }
    return '';
  }

  private static extractStepsArray(raw: any): string[] {
    const stepCandidates = [
      raw.stepByStepBreakdown,
      raw.step_by_step_breakdown,
      raw.steps,
      raw.algorithm,
      raw.examples,
      raw.keyPoints,
      raw.keyIdeas,
      raw.mainPoints,
      raw.points,
      raw.bullets,
      raw.takeaways,
      raw.keyTakeaways,
      raw.rules,
      raw.facts,
      raw.paragraphs,
      raw.cards,
    ];
    for (const candidate of stepCandidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        const items = candidate.map((st: any) => this.extractTextField(st)).filter(Boolean);
        if (items.length > 0) return items;
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        const items = candidate
          .split('\n')
          .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim())
          .filter(Boolean);
        if (items.length > 0) return items;
      }
    }
    return [];
  }

  private static extractCodeSnippet(raw: any): { codeSnippet?: string; codeLanguage?: string } {
    const rawCode =
      raw.codeSnippet ??
      raw.code_snippet ??
      raw.codeExample ??
      raw.code_example ??
      raw.codeBlock ??
      raw.snippet ??
      raw.code ??
      raw.html ??
      raw.syntax ??
      (Array.isArray(raw.tags) ? raw.tags.join('\n') : undefined);
    if (rawCode === undefined || rawCode === null) return {};
    const codeText =
      typeof rawCode === 'string'
        ? rawCode.trim()
        : Array.isArray(rawCode)
        ? rawCode.map(String).join('\n')
        : typeof rawCode === 'object' && rawCode.code
        ? String(rawCode.code).trim()
        : '';
    if (!codeText) return {};
    const codeLanguage =
      raw.codeLanguage || raw.code_language || raw.language || raw.lang || rawCode?.language || undefined;
    return {
      codeSnippet: codeText,
      codeLanguage: codeLanguage ? String(codeLanguage) : undefined,
    };
  }

  private static normalizeEmote(rawEmote: any): 'idea' | 'sweat' | 'question' | 'joy' {
    const val = String(rawEmote || '').trim().toLowerCase();
    if (val === 'idea' || val === 'sweat' || val === 'question' || val === 'joy') {
      return val;
    }
    if (val.includes('joy') || val.includes('happy') || val.includes('smile') || val.includes('win') || val.includes('excite')) {
      return 'joy';
    }
    if (val.includes('quest') || val.includes('think') || val.includes('curio') || val.includes('wonder') || val.includes('confus')) {
      return 'question';
    }
    if (val.includes('sweat') || val.includes('worry') || val.includes('sad') || val.includes('stress') || val.includes('alert') || val.includes('nerv')) {
      return 'sweat';
    }
    return 'idea';
  }

  private static normalizeSomaticActivity(
    rawAct: any
  ): 'vocal_humming' | 'double_sigh' | 'eye_eight' | 'muscle_squeeze' | 'vowel_sound_flow' {
    const val = String(rawAct || '').trim().toLowerCase();
    if (
      val === 'vocal_humming' ||
      val === 'double_sigh' ||
      val === 'eye_eight' ||
      val === 'muscle_squeeze' ||
      val === 'vowel_sound_flow'
    ) {
      return val;
    }
    if (val.includes('vowel') || val.includes('голосн')) return 'vowel_sound_flow';
    if (val.includes('hum') || val.includes('vocal') || val.includes('voice')) return 'vocal_humming';
    if (val.includes('eye') || val.includes('eight') || val.includes('vision')) return 'eye_eight';
    if (val.includes('musc') || val.includes('squeez') || val.includes('stretch')) return 'muscle_squeeze';
    return 'double_sigh';
  }

  public static normalizeBlockType(raw: any): string {
    const rawType = String(raw?.type || raw?.blockType || raw?.kind || '').trim().toLowerCase();
    if (rawType) {
      if (
        rawType === 'block_dialogue' ||
        rawType === 'dialogue' ||
        rawType === 'dialog' ||
        rawType === 'speech' ||
        rawType === 'narration' ||
        rawType === 'npc' ||
        rawType.includes('dialogue') ||
        rawType === 'діалог' ||
        rawType === 'репліка' ||
        rawType === 'оповідь'
      ) {
        return 'block_dialogue';
      }
      if (
        rawType === 'block_anchor_fact' ||
        rawType === 'fact' ||
        rawType === 'anchor_fact' ||
        rawType === 'context' ||
        rawType === 'historical_context' ||
        rawType === 'history' ||
        rawType === 'info' ||
        rawType === 'callout' ||
        rawType === 'note' ||
        rawType.includes('fact') ||
        rawType.includes('context') ||
        rawType === 'факт' ||
        rawType === 'контекст' ||
        rawType === 'довідка' ||
        rawType === 'історія' ||
        rawType.includes('історич')
      ) {
        return 'block_anchor_fact';
      }
      if (
        rawType === 'block_theory_rule' ||
        rawType === 'theory' ||
        rawType === 'rule' ||
        rawType === 'concept' ||
        rawType === 'formula' ||
        rawType === 'definition' ||
        rawType === 'explanation' ||
        rawType === 'summary' ||
        rawType === 'code' ||
        rawType === 'code_example' ||
        rawType === 'tags' ||
        rawType.includes('theory') ||
        rawType.includes('rule') ||
        rawType === 'теорія' ||
        rawType === 'правило' ||
        rawType === 'конспект' ||
        rawType === 'пояснення'
      ) {
        return 'block_theory_rule';
      }
      if (
        rawType === 'block_interactive_sandbox' ||
        rawType === 'sandbox' ||
        rawType === 'interactive_engine' ||
        rawType === 'engine' ||
        rawType === 'simulator' ||
        rawType === 'simulation' ||
        rawType === 'lab' ||
        rawType === 'experiment' ||
        rawType.includes('sandbox') ||
        rawType.includes('engine') ||
        rawType.includes('simulat') ||
        rawType === 'пісочниця' ||
        rawType === 'симулятор' ||
        rawType === 'рушій' ||
        rawType === 'моделювання'
      ) {
        return 'block_interactive_sandbox';
      }
      if (
        rawType === 'block_recognition_quiz' ||
        rawType === 'quiz' ||
        rawType === 'question' ||
        rawType === 'mcq' ||
        rawType === 'multiple_choice' ||
        rawType === 'choice' ||
        rawType === 'test' ||
        rawType === 'recognition' ||
        rawType.includes('quiz') ||
        rawType === 'тест' ||
        rawType === 'вікторина' ||
        rawType === 'опитування' ||
        rawType === 'питання'
      ) {
        return 'block_recognition_quiz';
      }
      if (
        rawType === 'block_notebook_task' ||
        rawType === 'blueprint_task' ||
        rawType === 'notebook' ||
        rawType === 'task' ||
        rawType === 'practice' ||
        rawType === 'exercise' ||
        rawType === 'calculation' ||
        rawType === 'manual' ||
        rawType === 'problem' ||
        rawType.includes('blueprint') ||
        rawType.includes('notebook') ||
        rawType.includes('task') ||
        rawType === 'зошит' ||
        rawType === 'завдання' ||
        rawType === 'вправа' ||
        rawType === 'задача' ||
        rawType === 'практика'
      ) {
        return 'block_notebook_task';
      }
      if (
        rawType === 'block_boss_challenge' ||
        rawType === 'boss' ||
        rawType === 'challenge' ||
        rawType === 'boss_challenge' ||
        rawType === 'final' ||
        rawType === 'exam' ||
        rawType === 'control' ||
        rawType.includes('boss') ||
        rawType.includes('challenge') ||
        rawType === 'виклик' ||
        rawType === 'самостійна' ||
        rawType === 'контрольна'
      ) {
        return 'block_boss_challenge';
      }
      if (
        rawType === 'block_somatic_pause' ||
        rawType === 'somatic_break' ||
        rawType === 'somatic' ||
        rawType === 'pause' ||
        rawType === 'break' ||
        rawType === 'warmup' ||
        rawType === 'rest' ||
        rawType.includes('somatic') ||
        rawType.includes('pause') ||
        rawType === 'пауза' ||
        rawType === 'розминка' ||
        rawType === 'відпочинок'
      ) {
        return 'block_somatic_pause';
      }
      if (
        rawType === 'block_text_marking' ||
        rawType === 'text_marking' ||
        rawType === 'marking' ||
        rawType === 'розмітка' ||
        rawType === 'розбір'
      ) {
        return 'block_text_marking';
      }
      if (
        rawType === 'block_logic_review' ||
        rawType === 'logic_review' ||
        rawType === 'blueprint_audit' ||
        rawType === 'critical_check' ||
        rawType === 'логіка' ||
        rawType === 'перевірка'
      ) {
        return 'block_logic_review';
      }
      return rawType;
    }

    // Structural inference when `type` is omitted
    if (raw.expectedVerdict || raw.scenarioPrompt) return 'block_logic_review';
    if (raw.sentence && Array.isArray(raw.availableTools)) return 'block_text_marking';
    if (Array.isArray(raw.options || raw.choices || raw.answers || raw.variants)) return 'block_recognition_quiz';
    if (raw.engineId || raw.engine || raw.simulator) return 'block_interactive_sandbox';
    if (raw.blueprintId || raw.blueprintRef || raw.notebookPrompt || raw.notebook_prompt || raw.expectedValue !== undefined) {
      return 'block_notebook_task';
    }
    if (
      raw.ruleSummary ||
      raw.rule_summary ||
      raw.theory ||
      raw.theoryText ||
      raw.rule ||
      raw.concept ||
      raw.definition ||
      raw.formulaText ||
      raw.formula ||
      raw.stepByStepBreakdown ||
      raw.steps ||
      raw.code ||
      raw.codeSnippet ||
      raw.codeExample
    ) {
      return 'block_theory_rule';
    }
    if (raw.headline || raw.contentSummary || raw.content_summary || raw.factText || raw.fact || raw.year !== undefined) {
      return 'block_anchor_fact';
    }
    if (raw.speaker || raw.character || raw.message || raw.speech) {
      return 'block_dialogue';
    }
    return 'block_anchor_fact';
  }

  private static parseHintsArray(rawHints: any): BlockHintItem[] | undefined {
    if (!Array.isArray(rawHints) || rawHints.length === 0) return undefined;
    const mapped: BlockHintItem[] = [];
    rawHints.forEach((h: any, idx: number) => {
      if (typeof h === 'string') {
        mapped.push({
          id: `hint_${idx + 1}`,
          question: 'Підказка до завдання',
          correctAnswer: 'ОК',
          explanation: h,
        });
      } else if (h && typeof h === 'object') {
        mapped.push({
          id: h.id ? String(h.id) : `hint_${idx + 1}`,
          question: String(h.question || h.prompt || 'Запитання для самоперевірки'),
          correctAnswer: String(h.correctAnswer ?? h.answer ?? 'ОК'),
          explanation: h.explanation ? String(h.explanation) : h.text ? String(h.text) : '',
          era: h.era ? String(h.era) : undefined,
        });
      }
    });
    return mapped.length > 0 ? mapped : undefined;
  }

  public static mapObjectBlocks(
    rawInput: any,
    index: number,
    defaults: LessonDefaults = {}
  ): StoryBlock[] {
    if (!rawInput || typeof rawInput !== 'object') return [];

    // 0. Recursively flatten nested section/phase/module containers holding child block arrays
    const childArray = this.extractRawBlocksArray(rawInput);
    const rawTypeLower = String(rawInput.type || rawInput.blockType || rawInput.kind || '').trim().toLowerCase();
    const isContainerType =
      !rawTypeLower ||
      ['section', 'stage', 'step', 'slide', 'scene', 'phase', 'part', 'module', 'unit', 'group', 'chapter'].includes(
        rawTypeLower
      );
    if (childArray.length > 0 && isContainerType && !Array.isArray(rawInput.options)) {
      const results: StoryBlock[] = [];
      const childDefaults: LessonDefaults = {
        ...defaults,
        speaker: rawInput.speaker ? String(rawInput.speaker) : defaults.speaker,
        speakerAvatar: rawInput.speakerAvatar ? String(rawInput.speakerAvatar) : defaults.speakerAvatar,
      };
      childArray.forEach((child: any, cIdx: number) => {
        results.push(...this.mapObjectBlocks(child, index * 20 + cIdx, childDefaults));
      });
      if (results.length > 0) return results;
    }

    // 1. Check for composite stage/section object holding multiple distinct sub-blocks
    if (isContainerType) {
      const compositeEntries: Array<{ key: string; forcedType: string; val: any }> = [];
      const keyTypeMap: Array<[string, string]> = [
        ['dialogue', 'block_dialogue'],
        ['narration', 'block_dialogue'],
        ['fact', 'block_anchor_fact'],
        ['anchor_fact', 'block_anchor_fact'],
        ['anchorFact', 'block_anchor_fact'],
        ['context', 'block_anchor_fact'],
        ['theory', 'block_theory_rule'],
        ['rule', 'block_theory_rule'],
        ['theory_rule', 'block_theory_rule'],
        ['theoryRule', 'block_theory_rule'],
        ['sandbox', 'block_interactive_sandbox'],
        ['interactive_engine', 'block_interactive_sandbox'],
        ['engine', 'block_interactive_sandbox'],
        ['quiz', 'block_recognition_quiz'],
        ['notebook', 'block_notebook_task'],
        ['task', 'block_notebook_task'],
        ['practice', 'block_notebook_task'],
        ['boss', 'block_boss_challenge'],
        ['challenge', 'block_boss_challenge'],
        ['pause', 'block_somatic_pause'],
        ['somatic_pause', 'block_somatic_pause'],
      ];

      for (const [k, forcedType] of keyTypeMap) {
        const sub = rawInput[k];
        if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
          compositeEntries.push({ key: k, forcedType, val: sub });
        } else if (typeof sub === 'string' && sub.trim()) {
          compositeEntries.push({ key: k, forcedType, val: { text: sub.trim() } });
        }
      }

      if (compositeEntries.length > 0) {
        const results: StoryBlock[] = [];
        compositeEntries.forEach((entry, subIdx) => {
          const mergedObj = {
            id: rawInput.id ? `${rawInput.id}_${entry.key}` : undefined,
            title: rawInput.title,
            copilotAdvice: rawInput.copilotAdvice,
            vars: {
              ...(defaults.vars || {}),
              ...(rawInput.vars && typeof rawInput.vars === 'object' ? rawInput.vars : {}),
              ...(entry.val.vars && typeof entry.val.vars === 'object' ? entry.val.vars : {}),
            },
            type: entry.val.type || entry.forcedType,
            ...entry.val,
          };
          const mapped = this.mapObjectBlock(mergedObj, index * 10 + subIdx, defaults);
          if (mapped) {
            if (Object.keys(mergedObj.vars).length > 0) mapped.vars = mergedObj.vars;
            results.push(mapped);
          }
        });
        return results;
      }
    }

    const single = this.mapObjectBlock(rawInput, index, defaults);
    if (single) {
      const mergedVars = {
        ...(defaults.vars || {}),
        ...(rawInput.vars && typeof rawInput.vars === 'object' ? rawInput.vars : {}),
      };
      if (Object.keys(mergedVars).length > 0) single.vars = mergedVars;
      return [single];
    }
    return [];
  }

  public static mapObjectBlock(rawInput: any, index: number, defaults: LessonDefaults = {}): StoryBlock | null {
    if (!rawInput || typeof rawInput !== 'object') return null;
    const raw =
      rawInput.data && typeof rawInput.data === 'object' && !Array.isArray(rawInput.data)
        ? { ...rawInput, ...rawInput.data }
        : rawInput.payload && typeof rawInput.payload === 'object' && !Array.isArray(rawInput.payload)
        ? { ...rawInput, ...rawInput.payload }
        : rawInput;
    const blockType = this.normalizeBlockType(raw);
    const blockId = String(raw.id || `b_${index}_${Date.now()}`);
    const hints = this.parseHintsArray(raw.hints);
    const copilotAdvice = raw.copilotAdvice || raw.copilotHint || raw.advice || undefined;
    const { codeSnippet, codeLanguage } = this.extractCodeSnippet(raw);
    const formulaText =
      this.firstNonEmptyText(raw.formulaText, raw.formula_text, raw.formula, raw.expression, raw.equation) ||
      undefined;
    const extractedSteps = this.extractStepsArray(raw);

    if (blockType === 'block_dialogue') {
      const textVal = this.firstNonEmptyText(
        raw.text,
        raw.content,
        raw.message,
        raw.body,
        raw.line,
        raw.speech,
        raw.narration,
        raw.dialogue,
        raw.replica,
        raw.quote
      );
      if (!textVal && !raw.title) return null;
      return {
        type: 'block_dialogue',
        id: blockId,
        speaker: String(raw.speaker || raw.character || raw.name || raw.author || defaults.speaker || 'Наставник'),
        avatar: String(raw.avatar || raw.speakerAvatar || raw.emoji || raw.icon || defaults.speakerAvatar || '👤'),
        text: textVal || String(raw.title || '...'),
        emote: this.normalizeEmote(raw.emote),
        copilotAdvice,
        hints,
      };
    }

    if (blockType === 'block_anchor_fact') {
      const summaryVal = this.firstNonEmptyText(
        raw.contentSummary,
        raw.content_summary,
        raw.factText,
        raw.fact_text,
        raw.fact,
        raw.text,
        raw.body,
        raw.main,
        raw.content,
        raw.markdown,
        raw.details,
        raw.summary,
        raw.description,
        raw.notes,
        raw.note,
        raw.story,
        raw.context,
        raw.background,
        raw.example,
        raw.keyPoints,
        raw.keyIdeas,
        raw.mainPoints,
        raw.points,
        raw.bullets,
        raw.facts,
        raw.paragraphs
      );
      const safeSummary =
        summaryVal ||
        (formulaText ? `Ключова формула: ${formulaText}` : '') ||
        (extractedSteps.length > 0 ? extractedSteps[0] : '') ||
        (codeSnippet ? 'Розгляньте наведений приклад нижче:' : '') ||
        String(raw.headline || raw.title || 'Теоретичні та контекстні відомості');

      return {
        type: 'block_anchor_fact',
        id: blockId,
        year: raw.year ?? raw.epoch ?? undefined,
        headline: String(raw.headline || raw.title || raw.topic || 'Теоретичні та контекстні відомості'),
        contentSummary: safeSummary,
        locationLabel: String(
          raw.locationLabel ||
            raw.location ||
            raw.era ||
            raw.contextLabel ||
            raw.speaker ||
            defaults.islandStageName ||
            'Контекст уроку'
        ),
        formulaText,
        stepByStepBreakdown: extractedSteps.length > 0 ? extractedSteps : undefined,
        codeSnippet,
        codeLanguage,
        blueprintId: raw.blueprintId || raw.blueprintRef,
        blueprint: raw.blueprint,
        geometry: raw.geometry,
        hints,
        copilotAdvice,
      };
    }

    if (blockType === 'block_theory_rule') {
      const ruleVal = this.firstNonEmptyText(
        raw.ruleSummary,
        raw.rule_summary,
        raw.summary,
        raw.theory,
        raw.theoryText,
        raw.rule,
        raw.ruleText,
        raw.concept,
        raw.principle,
        raw.theorem,
        raw.explanation,
        raw.definition,
        raw.description,
        raw.text,
        raw.body,
        raw.main,
        raw.content,
        raw.contentSummary,
        raw.content_summary,
        raw.factText,
        raw.markdown,
        raw.details,
        raw.notes,
        raw.note,
        raw.callout,
        raw.example,
        raw.keyTakeaways,
        raw.paragraphs
      );
      const safeRuleSummary =
        ruleVal ||
        (formulaText ? `Основна формула: ${formulaText}` : '') ||
        (extractedSteps.length > 0 ? extractedSteps[0] : '') ||
        (codeSnippet ? 'Розгляньте наведений приклад нижче:' : '') ||
        String(raw.title || raw.headline || raw.topic || 'Теоретичне правило уроку');

      return {
        type: 'block_theory_rule',
        id: blockId,
        title: String(raw.title || raw.headline || raw.topic || 'Опорний конспект'),
        ruleSummary: safeRuleSummary,
        formulaText,
        codeSnippet,
        codeLanguage,
        stepByStepBreakdown: extractedSteps,
        blueprintId: raw.blueprintId || raw.blueprintRef,
        blueprint: raw.blueprint,
        geometry: raw.geometry,
        hints,
        copilotAdvice,
      };
    }

    if (blockType === 'block_interactive_sandbox') {
      const mergedConfig: Record<string, any> = {
        ...(typeof raw.params === 'object' && raw.params ? raw.params : {}),
        ...(typeof raw.settings === 'object' && raw.settings ? raw.settings : {}),
        ...(typeof raw.props === 'object' && raw.props ? raw.props : {}),
        ...(typeof raw.config === 'object' && raw.config ? raw.config : {}),
        ...(typeof raw.engineConfig === 'object' && raw.engineConfig ? raw.engineConfig : {}),
      };
      const directKeys = [
        'targetNumber', 'targetValue', 'targetSum', 'initialTens', 'initialOnes',
        'initialValue', 'allowDecimals', 'leftConstant', 'unknownValue', 'unitLabel',
        'scaleType', 'min', 'max', 'step', 'unit', 'targetHour', 'targetMinute',
        'initialHour', 'initialMinute', 'hideDigital', 'baskets', 'items', 'steps', 'order',
        'startNumber', 'addend', 'targetNumerator', 'targetDenominator',
        'targetAngle', 'toleranceDegrees', 'correctAngle', 'correctPower',
        'tolerance', 'toleranceMeters', 'distanceMeters', 'targetDistanceMeters',
        'targetDistance', 'gravity', 'windSpeedMs', 'airDragCoeff', 'maxAttempts',
        'themePreset', 'launcherLabel', 'targetLabel', 'projectileSymbol', 'targetSymbol',
        'stages', 'targets', 'successMessage', 'failureMessage', 'undershootMessage',
        'overshootMessage', 'targetPoint', 'obstacles', 'itemType', 'mode', 'title',
        'scale', 'difficulty', 'targetNotes', 'beats', 'targetPattern', 'tempoBpm', 'noteDurationSec',
        'timeSignature', 'strictSequential', 'targetColor', 'availablePigments', 'targetHorizon',
        'targetVanishing', 'targetLightAngle', 'toleranceAngle'
      ];
      for (const k of directKeys) {
        if (raw[k] !== undefined && mergedConfig[k] === undefined) {
          mergedConfig[k] = raw[k];
        }
      }
      if (mergedConfig.targetValue !== undefined && mergedConfig.targetSum === undefined) {
        mergedConfig.targetSum = mergedConfig.targetValue;
      }
      if (mergedConfig.targetNumber !== undefined && mergedConfig.targetSum === undefined) {
        mergedConfig.targetSum = mergedConfig.targetNumber;
      }

      const reactionZones = Array.isArray(raw.reactionZones) ? raw.reactionZones : undefined;
      if (reactionZones && !mergedConfig.reactionZones) {
        mergedConfig.reactionZones = reactionZones;
      }

      return {
        type: 'block_interactive_sandbox',
        id: blockId,
        title: raw.title,
        engineId: String(raw.engineId || raw.engine || raw.simulator || 'balance-physics'),
        instruction:
          this.extractTextField(raw.instruction ?? raw.prompt ?? raw.text ?? mergedConfig.instruction) ||
          'Експериментуйте у симуляторі!',
        config: mergedConfig,
        engineConfig: mergedConfig,
        reactionZones,
        hints,
        copilotAdvice,
      };
    }

    if (blockType === 'block_recognition_quiz') {
      const rawOptions = Array.isArray(raw.options || raw.choices || raw.answers || raw.variants)
        ? (raw.options || raw.choices || raw.answers || raw.variants)
        : [];
      const parsedOpts: Array<string | { text: string; isCorrect?: boolean; feedbackSuccess?: string; feedbackFail?: string }> = [];
      const correctIndices: number[] = [];
      let correctIdx: number | null =
        raw.correctIndex !== undefined && raw.correctIndex !== null && raw.correctIndex !== ''
          ? Number(raw.correctIndex)
          : raw.answerIndex !== undefined && raw.answerIndex !== null && raw.answerIndex !== ''
          ? Number(raw.answerIndex)
          : null;
      if (correctIdx !== null && (!Number.isInteger(correctIdx) || correctIdx < 0)) {
        correctIdx = null;
      }
      let feedbackExplanation = raw.explanation || raw.feedbackSuccess || '';

      rawOptions.forEach((opt: any, oIdx: number) => {
        if (typeof opt === 'string' || typeof opt === 'number') {
          parsedOpts.push(String(opt));
        } else if (opt && typeof opt === 'object') {
          const textVal = String(opt.text || opt.label || opt.value || opt.title || `Варіант ${oIdx + 1}`);
          const isTrue = opt.isCorrect === true || opt.isCorrect === 'true' || opt.correct === true;
          if (opt.feedbackFail || opt.feedbackSuccess || opt.isCorrect !== undefined) {
            parsedOpts.push({
              text: textVal,
              isCorrect: isTrue,
              feedbackSuccess: opt.feedbackSuccess ? String(opt.feedbackSuccess) : undefined,
              feedbackFail: opt.feedbackFail ? String(opt.feedbackFail) : undefined,
            });
          } else {
            parsedOpts.push(textVal);
          }
          if (isTrue) {
            if (correctIdx === null) correctIdx = oIdx;
            correctIndices.push(oIdx);
            if (opt.feedbackSuccess && !feedbackExplanation) feedbackExplanation = String(opt.feedbackSuccess);
          }
        }
      });

      const finalOpts =
        parsedOpts.length >= 2
          ? parsedOpts
          : parsedOpts.length === 1
          ? [...parsedOpts, 'Інший варіант']
          : ['Так', 'Ні'];

      if (correctIdx === null) {
        const expectedRaw = raw.correctAnswer ?? raw.answer ?? raw.correct ?? raw.expected;
        if (typeof expectedRaw === 'number' && expectedRaw >= 0 && expectedRaw < finalOpts.length) {
          correctIdx = expectedRaw;
        } else if (expectedRaw !== undefined && expectedRaw !== null) {
          const targetStr = String(expectedRaw).trim().toLowerCase();
          const matchedIdx = finalOpts.findIndex((o) => {
            const label = typeof o === 'string' ? o : o.text;
            return label.trim().toLowerCase() === targetStr;
          });
          if (matchedIdx !== -1) {
            correctIdx = matchedIdx;
          }
        }
      }

      const safeCorrectIdx =
        correctIdx !== null && correctIdx >= 0 && correctIdx < finalOpts.length ? correctIdx : 0;

      return {
        type: 'block_recognition_quiz',
        id: blockId,
        question:
          this.extractTextField(raw.question ?? raw.prompt ?? raw.title ?? raw.text) ||
          'Оберіть правильну відповідь:',
        options: finalOpts,
        correctIndex: safeCorrectIdx,
        correctIndices: correctIndices.length > 1 ? correctIndices : Array.isArray(raw.correctIndices) ? raw.correctIndices.map(Number) : undefined,
        multiSelect: Boolean(raw.multiSelect || correctIndices.length > 1),
        explanation: String(feedbackExplanation || 'Вірно! Розрахунок точний.'),
        feedbackSuccess: raw.feedbackSuccess,
        feedbackFail: raw.feedbackFail,
        codeSnippet,
        codeLanguage,
        hints,
        copilotAdvice,
      };
    }

    if (blockType === 'block_notebook_task') {
      const ans = raw.correctAnswer ?? raw.expectedValue ?? raw.expected ?? raw.answer ?? raw.solution;
      const promptVal = this.extractTextField(
        raw.notebookPrompt ??
          raw.notebook_prompt ??
          raw.prompt ??
          raw.question ??
          raw.task ??
          raw.problem ??
          raw.instruction ??
          raw.description ??
          raw.text ??
          raw.body
      );
      return {
        type: 'block_notebook_task',
        id: blockId,
        title: String(raw.title || raw.headline || 'Практичне завдання'),
        notebookPrompt: promptVal || 'Виконайте обчислення та введіть відповідь.',
        scaffoldTemplate: raw.scaffoldTemplate || raw.template,
        inputFieldKey: raw.inputFieldKey,
        expectedValue: raw.expectedValue,
        unit: raw.unit,
        correctAnswer: ans !== undefined ? ans : '',
        hint: raw.hint || (hints && hints[0]?.explanation) || undefined,
        hints,
        blueprintId: raw.blueprintId || raw.blueprintRef,
        blueprint: raw.blueprint,
        geometry: raw.geometry,
        blueprintMode: raw.blueprintMode,
        targetField: raw.targetField,
        calculationSteps: Array.isArray(raw.calculationSteps) ? raw.calculationSteps : undefined,
        codeSnippet,
        codeLanguage,
        copilotAdvice,
        reward: raw.reward || { wood: 25, stone: 10, energy: 15 },
      };
    }

    if (blockType === 'block_boss_challenge') {
      const mergedEngineCfg = {
        ...(typeof raw.params === 'object' && raw.params ? raw.params : {}),
        ...(typeof raw.config === 'object' && raw.config ? raw.config : {}),
        ...(typeof raw.engineConfig === 'object' && raw.engineConfig ? raw.engineConfig : {}),
      };
      const ans = raw.correctAnswer ?? raw.expected ?? raw.answer ?? raw.validation?.expected;
      const promptVal = this.extractTextField(
        raw.notebookPrompt ?? raw.notebook_prompt ?? raw.instruction ?? raw.prompt ?? raw.question ?? raw.task ?? raw.text ?? raw.body
      );
      const reactionZones = Array.isArray(raw.reactionZones) ? raw.reactionZones : undefined;
      if (reactionZones && !mergedEngineCfg.reactionZones) {
        mergedEngineCfg.reactionZones = reactionZones;
      }
      return {
        type: 'block_boss_challenge',
        id: blockId,
        title: String(raw.title || raw.headline || 'Підсумкове практичне завдання'),
        contextStory: this.extractTextField(raw.contextStory ?? raw.description ?? raw.story) || undefined,
        notebookPrompt: promptVal || 'Виконайте розрахунок або дію у симуляторі',
        instruction: raw.instruction,
        engineId: raw.engineId || raw.engine || raw.simulator,
        engineConfig: mergedEngineCfg,
        validation: raw.validation,
        expected: raw.expected,
        correctAnswer: ans,
        hint: raw.hint || (hints && hints[0]?.explanation) || undefined,
        hints,
        blueprintId: raw.blueprintId || raw.blueprintRef,
        blueprint: raw.blueprint,
        geometry: raw.geometry,
        blueprintMode: raw.blueprintMode,
        targetField: raw.targetField,
        calculationSteps: Array.isArray(raw.calculationSteps) ? raw.calculationSteps : undefined,
        codeSnippet,
        codeLanguage,
        copilotAdvice,
        reactionZones,
        reward: raw.reward || { wood: 40, stone: 20, energy: 25 },
      };
    }

    if (blockType === 'block_text_marking') {
      const sentenceVal = this.extractTextField(raw.sentence ?? raw.text ?? raw.content) || 'Речення для розбору.';
      const promptVal = this.extractTextField(raw.prompt ?? raw.instruction ?? raw.question) || 'Позначте потрібні елементи у реченні.';
      const tools = Array.isArray(raw.availableTools)
        ? raw.availableTools.map((t: any) => String(t).trim()).filter(Boolean)
        : ['subj', 'pred'];
      return {
        type: 'block_text_marking',
        id: blockId,
        title: raw.title ? String(raw.title) : 'Аналітичний розбір тексту',
        prompt: promptVal,
        sentence: sentenceVal,
        availableTools: tools.length > 0 ? tools : ['subj', 'pred'],
        toleranceMode: raw.toleranceMode === 'partial' ? 'partial' : 'exact',
        targetTokens: Array.isArray(raw.targetTokens) ? raw.targetTokens : undefined,
        explanation: raw.explanation ? String(raw.explanation) : undefined,
        hint: raw.hint ? String(raw.hint) : undefined,
        hints,
        copilotAdvice,
        reward: raw.reward || { wood: 20, stone: 10, energy: 15 },
      };
    }

    if (blockType === 'block_logic_review') {
      const scenarioPrompt =
        this.extractTextField(raw.scenarioPrompt ?? raw.prompt ?? raw.text ?? raw.question) ||
        'Перевірте креслення та твердження на коректність.';
      const expectedVerdict =
        raw.expectedVerdict === 'already_solved' ||
        raw.expectedVerdict === 'missing_data' ||
        raw.expectedVerdict === 'error_found'
          ? raw.expectedVerdict
          : 'error_found';

      return {
        type: 'block_logic_review',
        id: blockId,
        title: String(raw.title || 'Логічна оцінка та перевірка даних'),
        scenarioPrompt,
        claimedLabel: raw.claimedLabel ? String(raw.claimedLabel) : undefined,
        claimedValue: raw.claimedValue,
        blueprintId: raw.blueprintId || raw.blueprintRef,
        blueprint: raw.blueprint,
        geometry: raw.geometry,
        expectedVerdict,
        verdictOptions: Array.isArray(raw.verdictOptions) ? raw.verdictOptions : undefined,
        followUpQuestion: raw.followUpQuestion ? String(raw.followUpQuestion) : undefined,
        followUpAnswer: raw.followUpAnswer ?? raw.correctAnswer,
        followUpUnit: raw.followUpUnit ? String(raw.followUpUnit) : raw.unit ? String(raw.unit) : undefined,
        explanation: String(
          raw.explanation || 'Перевірка елементів допомагає виявити невідповідність або підтвердити дані.'
        ),
        hint: raw.hint ? String(raw.hint) : undefined,
        hints,
        copilotAdvice,
        reward: raw.reward || { wood: 25, stone: 15, energy: 15 },
      };
    }

    if (blockType === 'block_somatic_pause') {
      const act = this.normalizeSomaticActivity(raw.activityId || raw.activity);
      const parsedCues = Array.isArray(raw.cues)
        ? raw.cues.map((c: any) => String(c).trim()).filter(Boolean)
        : undefined;
      return {
        type: 'block_somatic_pause',
        id: blockId,
        activity: act,
        activityId: act,
        durationSec: Math.max(5, Number(raw.durationSec || raw.duration) || 30),
        guideVoiceText: raw.guideVoiceText ? String(raw.guideVoiceText) : undefined,
        inhaleSec: Number(raw.inhaleSec) > 0 ? Number(raw.inhaleSec) : undefined,
        holdSec: Number(raw.holdSec) >= 0 && raw.holdSec !== undefined ? Number(raw.holdSec) : undefined,
        exhaleSec: Number(raw.exhaleSec) > 0 ? Number(raw.exhaleSec) : undefined,
        restSec: Number(raw.restSec) >= 0 && raw.restSec !== undefined ? Number(raw.restSec) : undefined,
        cues: parsedCues && parsedCues.length > 0 ? parsedCues : undefined,
        copilotAdvice,
      };
    }

    const fallbackText = this.extractTextField(raw.text ?? raw.content ?? raw.description ?? raw.body ?? raw.summary);
    if (fallbackText || raw.title || raw.headline) {
      return {
        type: 'block_anchor_fact',
        id: blockId,
        headline: String(raw.headline || raw.title || 'Матеріал уроку'),
        contentSummary: fallbackText || String(raw.title || raw.headline || ''),
        locationLabel: defaults.islandStageName || 'Контекст уроку',
        codeSnippet,
        codeLanguage,
        hints,
        copilotAdvice,
      };
    }

    return null;
  }

  private static extractRawBlocksArray(obj: any): any[] {
    if (!obj || typeof obj !== 'object') return [];
    const candidateKeys = [
      'blocks',
      'pipeline',
      'steps',
      'stages',
      'scenes',
      'tasks',
      'sections',
      'phases',
      'parts',
      'slides',
      'episodes',
      'activities',
      'items',
      'elements',
      'content',
    ];
    for (const key of candidateKeys) {
      const val = obj[key];
      if (Array.isArray(val) && val.length > 0) {
        return val;
      }
      // Support YAML object maps like `blocks: { intro: {...}, theory: {...} }`
      if (val && typeof val === 'object' && !Array.isArray(val) && !val.type && !val.text && !val.content) {
        const mappedList = Object.entries(val)
          .filter(([, child]) => child && typeof child === 'object')
          .map(([k, child]: [string, any]) => ({ id: child.id || k, ...child }));
        if (mappedList.length > 0) {
          return mappedList;
        }
      }
    }
    return [];
  }

  private static humanizeFallbackTitle(fallbackFileName: string, topic?: string): string {
    if (topic && topic.trim()) return topic.trim();
    if (!fallbackFileName) return 'Навчальний урок';
    const base = fallbackFileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (!base || /^(lesson|chapter|quest|topic)\s*\d*$/i.test(base)) {
      return 'Навчальний урок';
    }
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  /**
   * Universal YAML parser for curriculum quest scenarios, story blocks, embedded maps, and hints.
   */
  public static parseQuestYaml(yamlContent: string, fallbackFileName: string = ''): ParsedYamlQuest {
    try {
      const loaded = this.safeLoadYaml(yamlContent);
      if (!loaded) {
        throw new Error('YAML не містить коректної структури об’єкта');
      }

      // Case A: Top-level YAML array of blocks
      if (Array.isArray(loaded)) {
        const questId = fallbackFileName
          ? fallbackFileName.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_')
          : `quest_${Date.now()}`;
        const title = this.humanizeFallbackTitle(fallbackFileName);
        const pipeline: StoryBlock[] = [];
        loaded.forEach((item, idx) => {
          pipeline.push(...this.mapObjectBlocks(item, idx));
        });
        const firstInfo: any = pipeline.find(
          (b: any) => b.type === 'block_anchor_fact' || b.type === 'block_theory_rule'
        );
        return {
          id: questId,
          title,
          description: firstInfo?.contentSummary || firstInfo?.ruleSummary || '',
          pipeline,
        };
      }

      if (typeof loaded === 'object') {
        // Case B: Unwrap nested containers & merge meta/metadata headers
        const metaBlock =
          (loaded.meta && typeof loaded.meta === 'object' && loaded.meta) ||
          (loaded.metadata && typeof loaded.metadata === 'object' && loaded.metadata) ||
          (loaded.header && typeof loaded.header === 'object' && loaded.header) ||
          null;
        const baseDoc = metaBlock ? { ...metaBlock, ...loaded } : loaded;

        const nested =
          baseDoc.lesson ||
          baseDoc.chapter ||
          baseDoc.scenario ||
          baseDoc.quest ||
          baseDoc.data ||
          baseDoc.module ||
          baseDoc.unit ||
          baseDoc.topic ||
          baseDoc.course ||
          baseDoc.episode ||
          baseDoc.curriculum ||
          (baseDoc.content && typeof baseDoc.content === 'object' && !Array.isArray(baseDoc.content)
            ? baseDoc.content
            : null);

        const doc =
          nested && typeof nested === 'object' && !Array.isArray(nested) && this.extractRawBlocksArray(baseDoc).length === 0
            ? { ...baseDoc, ...nested }
            : baseDoc;

        const rawId = doc.id ? String(doc.id) : '';
        const questId = rawId
          ? rawId.replace(/[^a-z0-9_-]/gi, '_')
          : fallbackFileName
          ? fallbackFileName.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/gi, '_')
          : `quest_${Date.now()}`;

        const topic = typeof doc.topic === 'string' ? doc.topic : '';
        const title = doc.title
          ? String(doc.title).trim()
          : doc.name
          ? String(doc.name).trim()
          : this.humanizeFallbackTitle(fallbackFileName, topic);
        const islandStageName = doc.islandStageName || doc.location || doc.stage || undefined;
        const gradeId = doc.gradeId ?? doc.grade;
        const subjectId = doc.subjectId ?? doc.subject;
        const copilotAdvice = doc.copilotAdvice ? String(doc.copilotAdvice) : undefined;

        const docVars = doc.vars && typeof doc.vars === 'object' && !Array.isArray(doc.vars) ? doc.vars : undefined;

        const lessonDefaults: LessonDefaults = {
          speaker: doc.speaker ? String(doc.speaker) : undefined,
          speakerAvatar: doc.speakerAvatar ? String(doc.speakerAvatar) : undefined,
          islandStageName: islandStageName ? String(islandStageName) : undefined,
          vars: docVars,
        };

        const rawBlocks = this.extractRawBlocksArray(doc);
        const pipeline: StoryBlock[] = [];
        if (rawBlocks.length > 0) {
          rawBlocks.forEach((item, idx) => {
            pipeline.push(...this.mapObjectBlocks(item, idx, lessonDefaults));
          });
        } else {
          // Support root-level composite keys directly on doc (`dialogue:`, `fact:`, `theory:`, `quiz:`, `task:`, `boss:`)
          const rootBlocks = this.mapObjectBlocks({ ...doc, type: undefined, blockType: undefined, kind: undefined }, 0, lessonDefaults);
          if (rootBlocks.length > 0) {
            pipeline.push(...rootBlocks);
          }
        }

        let description = doc.description ? String(doc.description).trim() : '';
        if (!description && pipeline.length > 0) {
          const infoBlock: any = pipeline.find(
            (b: any) => b.type === 'block_anchor_fact' || b.type === 'block_theory_rule'
          );
          description = infoBlock?.contentSummary || infoBlock?.ruleSummary || '';
        }

        let mapTopology: WorldMapSchema | undefined = undefined;
        if (doc.mapTopology && typeof doc.mapTopology === 'object') {
          mapTopology = this.normalizeWorldMapObject(doc.mapTopology, `Мапа: ${title}`);
        }

        return {
          id: questId,
          grade: doc.grade,
          gradeId: gradeId !== undefined ? String(gradeId) : undefined,
          subject: doc.subject,
          subjectId: subjectId !== undefined ? String(subjectId) : undefined,
          topic,
          title,
          description,
          islandStageName,
          mapTopology,
          copilotAdvice,
          vars: docVars,
          pipeline,
        };
      }

      throw new Error('YAML не містить коректної структури об’єкта');
    } catch (err) {
      console.error('YAML Parse Error:', err);
      throw new Error('Помилка зчитування YAML-файлу. Перевірте синтаксис.');
    }
  }

  public static parseSubjectManifest(yamlContent: string, fallbackId: string = 'custom_subject'): Partial<SubjectConfig> {
    const doc = this.safeLoadYaml(yamlContent);
    if (!doc || typeof doc !== 'object') {
      return { id: fallbackId, name: fallbackId, description: 'Навчальний предмет', iconName: '📘', isAvailable: true };
    }
    return {
      id: String(doc.id || fallbackId),
      name: String(doc.name || doc.title || fallbackId),
      description: String(doc.description || 'Навчальний курс'),
      iconName: String(doc.iconName || doc.icon || '📘'),
      subjectCategory: doc.subjectCategory ? String(doc.subjectCategory) : String(doc.id || fallbackId),
      authorLabel: doc.authorLabel ? String(doc.authorLabel) : doc.author ? String(doc.author) : undefined,
      gradeId: doc.gradeId !== undefined ? String(doc.gradeId) : doc.grade !== undefined ? String(doc.grade) : undefined,
      isAvailable: doc.isAvailable !== undefined ? Boolean(doc.isAvailable) : true,
    };
  }

  private static normalizeWorldMapObject(doc: any, fallbackTitle: string): WorldMapSchema {
    const mapTitle = String(doc?.mapTitle || doc?.title || fallbackTitle || 'Сюжетна мапа курсу');
    const nodes: WorldMapSchema['nodes'] = [];

    if (doc?.mapTopology?.spine && Array.isArray(doc.mapTopology.spine)) {
      const spineList = doc.mapTopology.spine;
      const itemsPerRow = 3;
      const startX = 160;
      const colSpacing = 260;
      let currentRowY = 135;

      for (let rowIdx = 0; rowIdx < Math.ceil(spineList.length / itemsPerRow); rowIdx++) {
        const rowSlice = spineList.slice(rowIdx * itemsPerRow, (rowIdx + 1) * itemsPerRow);
        const isEvenRow = rowIdx % 2 === 0;

        let rowHasUpperBranch = false;
        let rowHasLowerBranch = false;
        rowSlice.forEach((sNode: any) => {
          if (Array.isArray(sNode.branches) && sNode.branches.length > 0) {
            rowHasUpperBranch = true;
            if (sNode.branches.length > 1) rowHasLowerBranch = true;
          }
        });

        if (rowHasUpperBranch && rowIdx === 0) {
          currentRowY = Math.max(currentRowY, 175);
        }

        rowSlice.forEach((sNode: any, colIdx: number) => {
          const globalIdx = rowIdx * itemsPerRow + colIdx;
          const actualCol = isEvenRow ? colIdx : itemsPerRow - 1 - colIdx;
          const x = Math.round(startX + actualCol * colSpacing);
          const y = Math.round(currentRowY);

          const rawId = String(sNode.id || `spine_node_${globalIdx + 1}`);
          const prevSpineId = globalIdx > 0 ? String(spineList[globalIdx - 1]?.id || `spine_node_${globalIdx}`) : undefined;
          const lessonFile = sNode.lessonFile ? String(sNode.lessonFile) : '';
          const qId = lessonFile
            ? lessonFile.replace(/^.*[/\\]/, '').replace(/\.[^/.]+$/, '') || rawId
            : String(sNode.questId || rawId);

          nodes.push({
            id: rawId,
            title: String(sNode.title || `Епізод ${globalIdx + 1}`),
            type: sNode.milestone || globalIdx === 0 ? 'region_main' : 'quest_episode',
            x,
            y,
            questId: qId,
            regionId: qId,
            parentId: prevSpineId,
            lane: 'spine',
            isUnlocked: true,
            isCompleted: false,
          });

          if (Array.isArray(sNode.branches)) {
            sNode.branches.forEach((bNode: any, bIdx: number) => {
              const bFile = bNode.lessonFile ? String(bNode.lessonFile) : '';
              const bQuestId = bFile
                ? bFile.replace(/^.*[/\\]/, '').replace(/\.[^/.]+$/, '')
                : String(bNode.questId || bNode.id || `branch_${globalIdx}_${bIdx}`);
              const isUpper = bIdx % 2 === 0;
              const laneShiftIdx = Math.floor(bIdx / 2);
              const bx = Math.round(x + laneShiftIdx * 210);
              const by = Math.round(y + (isUpper ? -105 : 105));

              nodes.push({
                id: String(bNode.id || `branch_node_${globalIdx}_${bIdx}`),
                title: String(bNode.title || `Відгалуження ${bIdx + 1}`),
                type: 'quest_episode',
                x: bx,
                y: by,
                questId: bQuestId,
                regionId: bQuestId,
                parentId: rawId,
                lane: isUpper ? 'upper' : 'lower',
                isUnlocked: true,
                isCompleted: false,
              });
            });
          }
        });

        currentRowY += rowHasUpperBranch && rowHasLowerBranch ? 245 : rowHasUpperBranch || rowHasLowerBranch ? 195 : 145;
      }

      this.resolveMapNodeCollisions(nodes);
    } else if (Array.isArray(doc?.nodes)) {
      doc.nodes.forEach((n: any, idx: number) => {
        nodes.push({
          id: String(n.id || `node_${idx + 1}`),
          title: String(n.title || n.label || `Вузол ${idx + 1}`),
          type: (n.type || 'quest_episode') as any,
          x: typeof n.x === 'number' ? n.x : 160 + (idx % 3) * 260,
          y: typeof n.y === 'number' ? n.y : 105 + Math.floor(idx / 3) * 145,
          questId: n.questId || n.quest,
          regionId: n.regionId || n.region,
          parentId: n.parentId || (idx > 0 ? String(doc.nodes[idx - 1]?.id || `node_${idx}`) : undefined),
          lane: n.lane || 'spine',
          isUnlocked: n.isUnlocked !== undefined ? Boolean(n.isUnlocked) : true,
          isCompleted: Boolean(n.isCompleted),
        });
      });
    }

    return {
      mapTitle,
      grade: doc?.grade || doc?.gradeId,
      subject: doc?.subject || doc?.subjectId,
      nodes,
    };
  }

  private static resolveMapNodeCollisions(nodes: WorldMapSchema['nodes']): void {
    const minDx = 210;
    const minDy = 82;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (Math.abs(a.x - b.x) < minDx && Math.abs(a.y - b.y) < minDy) {
          b.y = Math.round(a.y + minDy);
        }
      }
    }
  }

  public static parseWorldMapContent(rawText: string, fallbackTitle: string = 'Сюжетна мапа курсу'): WorldMapSchema {
    if (!rawText || !rawText.trim()) {
      return { mapTitle: fallbackTitle, nodes: [] };
    }
    const doc = this.safeLoadYaml(rawText);
    if (doc && typeof doc === 'object') {
      const normalized = this.normalizeWorldMapObject(doc, fallbackTitle);
      if (normalized.nodes.length > 0) {
        return normalized;
      }
    }
    return { mapTitle: fallbackTitle, nodes: [] };
  }

  public static parseCharacterYaml(yamlContent: string): ParsedCharacterYaml[] | ParsedCharacterYaml {
    const doc = this.safeLoadYaml(yamlContent);
    const registerOne = (c: any): ParsedCharacterYaml => {
      const name = String(c?.name || c?.speaker || 'Персонаж');
      const id = String(c?.id || name.toLowerCase().replace(/\s+/g, '_'));
      const pitch = Number(c?.voice?.pitch ?? c?.voice?.basePitch ?? c?.pitch ?? c?.pitchMultiplier) || 1.0;
      const speed = Number(c?.voice?.speed ?? c?.speed ?? c?.speedMultiplier) || 1.0;
      const tone = String(c?.voice?.tone ?? c?.tone ?? c?.toneLabel ?? 'Стандарт');

      advancedFormantSynth.registerVoiceProfile(name, {
        speakerId: id,
        pitchMultiplier: pitch,
        speedMultiplier: speed,
        toneLabel: tone,
      });

      return {
        id,
        name,
        avatar: String(c?.avatar || c?.emoji || c?.icon || '👤'),
        voice: { pitch, speed, tone },
        description: c?.description || c?.role,
      };
    };

    if (doc && Array.isArray(doc.avatars || doc.characters)) {
      return (doc.avatars || doc.characters).map(registerOne);
    }
    return registerOne(doc || {});
  }

  /**
   * 3-lane collision-free winding layout (spine + upper/lower corridors, >= 250px spacing)
   */
  public static generateNonOverlappingMapLayout(
    chapters: Array<{ id: string; title: string }>,
    mapTitle: string = 'Сюжетна мапа курсу'
  ): WorldMapSchema {
    const nodes: WorldMapSchema['nodes'] = [];
    const itemsPerRow = 3;
    const startX = 160;
    const colSpacing = 260;
    const rowStepY = 148;
    const startY = 100;

    let prevId: string | undefined;

    chapters.forEach((ch, idx) => {
      const rowIndex = Math.floor(idx / itemsPerRow);
      const colIndex = idx % itemsPerRow;
      const isEvenRow = rowIndex % 2 === 0;
      const actualCol = isEvenRow ? colIndex : itemsPerRow - 1 - colIndex;

      // 3-lane vertical cadence inside each row so labels never collide horizontally or vertically
      const laneOffsets: Array<{ dy: number; lane: 'upper' | 'spine' | 'lower' }> = [
        { dy: 0, lane: 'spine' },
        { dy: -28, lane: 'upper' },
        { dy: 28, lane: 'lower' },
      ];
      const lanePick = laneOffsets[colIndex % 3];
      const nodeId = `node_${ch.id}`;

      nodes.push({
        id: nodeId,
        title: ch.title,
        type: idx % 3 === 0 ? 'region_main' : 'quest_episode',
        x: Math.round(startX + actualCol * colSpacing),
        y: Math.round(startY + rowIndex * rowStepY + lanePick.dy),
        regionId: ch.id,
        questId: ch.id,
        parentId: prevId,
        lane: lanePick.lane,
        isUnlocked: true,
        isCompleted: false,
      });

      prevId = nodeId;
    });

    this.resolveMapNodeCollisions(nodes);

    return { mapTitle, nodes };
  }
}

export class YamlBlueprintParser {
  public static parseBlueprintContent(rawText: string, fallbackFileName: string = 'blueprint.yaml'): Blueprint {
    let doc: any = null;
    try {
      doc = yaml.load(rawText, { json: true });
    } catch {
      doc = null;
    }

    const fallbackId = fallbackFileName.replace(/\.[^/.]+$/, '');

    if (doc && typeof doc === 'object') {
      const candidate = {
        id: String(doc.id || fallbackId),
        title: String(doc.title || 'Інженерне креслення'),
        subjectId: doc.subjectId || doc.subject ? String(doc.subjectId || doc.subject) : undefined,
        gradeId: doc.gradeId ?? doc.grade,
        category: doc.category || 'custom',
        description: String(doc.description || 'Технічне креслення або схема побудови.'),
        totalSpanMeters: doc.totalSpanMeters !== undefined ? Number(doc.totalSpanMeters) : undefined,
        loadCapacityTons: doc.loadCapacityTons !== undefined ? Number(doc.loadCapacityTons) : undefined,
        material: doc.material ? String(doc.material) : undefined,
        geometry: typeof doc.geometry === 'object' && doc.geometry ? doc.geometry : {},
        materials: typeof doc.materials === 'object' && doc.materials ? doc.materials : {},
        hints: Array.isArray(doc.hints) ? doc.hints.map(String) : [],
        dimensions: doc.dimensions,
        components: Array.isArray(doc.components) ? doc.components : [],
        assets: Array.isArray(doc.assets) ? doc.assets : [],
        rawText,
      };
      const parsed = BlueprintZodSchema.safeParse(candidate);
      if (parsed.success) {
        return parsed.data;
      }
      return {
        ...candidate,
        category: 'custom',
        components: [],
        assets: [],
      };
    }

    return {
      id: fallbackId,
      title: 'Інженерне креслення',
      category: 'custom',
      description: 'Технічне креслення або схема побудови.',
      geometry: {},
      materials: {},
      hints: [],
      components: [],
      assets: [],
      rawText,
    };
  }
}
