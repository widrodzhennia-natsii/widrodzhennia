import { StoryBlockZod } from '../contracts/blocks.schema';

export interface ShorthandParseResult {
  id: string;
  fileType: 'lesson' | 'world_map' | 'manifest';
  title: string;
  description: string;
  islandStageName?: string;
  blocks: StoryBlockZod[];
  mapData?: any;
  errors: Array<{ line: number; message: string }>;
}

const EXPLICIT_PROSE_YAML_KEYS = new Set([
  'text',
  'content',
  'body',
  'message',
  'line',
  'speech',
  'narration',
  'contentsummary',
  'content_summary',
  'facttext',
  'fact_text',
  'fact',
  'context',
  'rulesummary',
  'rule_summary',
  'summary',
  'theory',
  'theorytext',
  'rule',
  'concept',
  'definition',
  'explanation',
  'headline',
  'question',
  'prompt',
  'notebookprompt',
  'notebook_prompt',
  'instruction',
  'callout',
  'contextstory',
  'formulatext',
  'formula_text',
  'formula',
  'example',
  'details',
  'notes',
  'note',
  'main',
]);

const METADATA_LINE_REGEX =
  /^(?:#+\s*)?(?:-\s*)?(?:id|айді|код|type|blocktype|kind|тип|title|subtitle|назва|тема|урок|topic|description|опис|stage|локація|locationlabel|location|islandstagename|grade|gradeid|клас|subject|subjectid|предмет|author|authorlabel|автор|speaker|speakeravatar|avatar|emote|version|epoch|year|era|engineid|engine|simulator|blueprintid|blueprintref|correctindex|answerindex|expectedvalue|expected|inputfieldkey|correctanswer|answer|unit|order|difficulty|codelanguage|language|lang|duration|durationsec|activity|activityid|iscorrect|correct|triggeronhitcount|distancemeters|targetdistancemeters|tolerancemeters|gravity|windspeedms|airdragcoeff|initialangle|initialpower|themepreset|launcherlabel|targetlabel|copilotadvice|advice|feedbacksuccess|feedbackfail|scaffoldtemplate|hint|buttonlabel|wood|stone|energy|xp|tags|category|icon|iconname|totalspanmeters|loadcapacitytons|material)\s*[:=]\s*.*$/i;

const BRACKET_META_REGEX =
  /^\[(?:id|айді|код|type|тип|назва|тема|урок|опис|локація|клас|предмет|мапа|карта|world_map|маніфест|manifest)(?:\s*:[^\]]*)?\]$/i;

const STRUCTURAL_YAML_LINE_REGEX =
  /^(?:-\s*)?[a-zA-Z_][a-zA-Z0-9_-]*\s*:\s*(?:[|>]-?|\[[^\]]*\]|\{[^}]*\})?\s*$/;

const STANDALONE_TECH_SLUG_REGEX =
  /^["']?(?:lesson|chapter|quest|step|block|node|stage|milestone)[-_]\d+[a-z0-9_-]*["']?$/i;

export class TextShorthandParser {
  /**
   * Detects whether a single line is purely technical YAML/JSON metadata
   * that must NEVER be displayed to students in dialogue or theory blocks.
   */
  public static isTechnicalMetadataLine(rawLine: string): boolean {
    const line = String(rawLine || '').trim();
    if (
      !line ||
      line === '---' ||
      line === '```' ||
      line === '|' ||
      line === '|-' ||
      line === '>' ||
      line === '>-' ||
      line === '{' ||
      line === '}' ||
      line === '[' ||
      line === ']'
    ) {
      return true;
    }
    if (
      METADATA_LINE_REGEX.test(line) ||
      BRACKET_META_REGEX.test(line) ||
      STRUCTURAL_YAML_LINE_REGEX.test(line) ||
      STANDALONE_TECH_SLUG_REGEX.test(line)
    ) {
      return true;
    }

    // Any ASCII camelCase/snake_case YAML key-value line NOT in EXPLICIT_PROSE_YAML_KEYS is technical metadata
    const asciiKeyMatch = line.match(/^(?:-\s*)?([a-zA-Z][a-zA-Z0-9_.-]{0,40})\s*:\s*(.+)$/);
    if (asciiKeyMatch) {
      const keyLower = asciiKeyMatch[1].toLowerCase();
      if (!EXPLICIT_PROSE_YAML_KEYS.has(keyLower)) {
        return true;
      }
      const valTrim = asciiKeyMatch[2].trim();
      if (valTrim === '|' || valTrim === '|-' || valTrim === '>' || valTrim === '>-') {
        return true;
      }
    }

    return false;
  }

  /**
   * Extracts readable text if a line carries a raw YAML prose field prefix like `text: "..."` or `ruleSummary: "..."`
   */
  public static unwrapYamlProseLine(rawLine: string): { field?: string; text: string } {
    const line = String(rawLine || '').trim();
    const match = line.match(
      /^(?:-\s*)?(text|content|body|message|line|speech|narration|contentSummary|content_summary|factText|fact_text|fact|context|ruleSummary|rule_summary|summary|theory|theoryText|rule|concept|definition|explanation|headline|question|prompt|notebookPrompt|notebook_prompt|instruction|callout|contextStory|formulaText|formula_text|formula|example|details|notes|note|main)\s*:\s*(.+)$/i
    );
    if (!match) return { text: line };
    const field = match[1].toLowerCase().replace(/_/g, '');
    const cleaned = match[2]
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .trim();
    if (cleaned === '|' || cleaned === '|-' || cleaned === '>' || cleaned === '>-') {
      return { field, text: '' };
    }
    return { field, text: cleaned };
  }
  /**
   * Sanitizes a raw string or filename into a clean slug ID
   */
  public static sanitizeId(raw: string): string {
    if (!raw) return `id_${Date.now()}`;
    const clean = raw
      .replace(/\.[^/.]+$/, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return clean || `id_${Date.now()}`;
  }

  private static humanizeTitle(fallbackFileName: string): string {
    if (!fallbackFileName) return 'Навчальний урок';
    const base = fallbackFileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (!base || /^(lesson|chapter|quest|topic)\s*\d*$/i.test(base)) {
      return 'Навчальний урок';
    }
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  /**
   * Translates raw shorthand text (.txt / .md) into structured Zod pipeline blocks
   * without leaking technical metadata lines (`id:`, `title:`, `lesson-03`) into student blocks.
   */
  public static parse(rawText: string, fallbackFileName: string = ''): ShorthandParseResult {
    const lines = rawText.split(/\r?\n/);
    const blocks: StoryBlockZod[] = [];
    const errors: Array<{ line: number; message: string }> = [];

    let extractedId: string | null = null;
    let extractedType: 'lesson' | 'world_map' | 'manifest' = 'lesson';
    let title = '';
    let description = '';
    let islandStageName = '';

    // 1. Check for YAML Frontmatter (`--- ... ---`) skipping leading blank lines
    let contentStartIdx = 0;
    while (contentStartIdx < lines.length && lines[contentStartIdx].trim() === '') {
      contentStartIdx++;
    }

    if (contentStartIdx < lines.length && lines[contentStartIdx].trim() === '---') {
      let fmEndIdx = -1;
      for (let i = contentStartIdx + 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          fmEndIdx = i;
          break;
        }
      }
      if (fmEndIdx > contentStartIdx) {
        const fmLines = lines.slice(contentStartIdx + 1, fmEndIdx);
        contentStartIdx = fmEndIdx + 1;
        fmLines.forEach((fLine) => {
          const colonIdx = fLine.indexOf(':');
          if (colonIdx !== -1) {
            const key = fLine.slice(0, colonIdx).trim().toLowerCase();
            const val = fLine.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

            if (key === 'id' || key === 'айді' || key === 'код') {
              extractedId = TextShorthandParser.sanitizeId(val);
            }
            if (key === 'type' || key === 'тип') {
              if (val.includes('map') || val.includes('мапа') || val.includes('карта')) extractedType = 'world_map';
              else if (val.includes('manifest') || val.includes('маніфест')) extractedType = 'manifest';
              else extractedType = 'lesson';
            }
            if (key === 'title' || key === 'назва' || key === 'тема' || key === 'topic') title = val;
            if (key === 'description' || key === 'опис') description = val;
            if (key === 'stage' || key === 'локація' || key === 'islandstagename') islandStageName = val;
          }
        });
      }
    }

    // 2. Scan metadata tags near top of text
    for (let i = contentStartIdx; i < Math.min(lines.length, contentStartIdx + 35); i++) {
      const line = lines[i].trim();

      if (!extractedId) {
        const idMatch =
          line.match(/^(?:#\s*)?(?:id|айді|код)\s*[:=]\s*["']?([^"'\s\]]+)["']?/i) ||
          line.match(/^\[(?:id|айді|код)\s*:\s*([^\]]+)\]/i);
        if (idMatch) {
          extractedId = TextShorthandParser.sanitizeId(idMatch[1]);
        }
      }

      if (extractedType === 'lesson') {
        const typeMatch =
          line.match(/^(?:#\s*)?(?:type|тип)\s*[:=]\s*["']?([^"'\s\]]+)["']?/i) ||
          line.match(/^\[(?:type|тип)\s*:\s*([^\]]+)\]/i);
        if (typeMatch) {
          const tVal = typeMatch[1].toLowerCase();
          if (tVal.includes('map') || tVal.includes('мапа') || tVal.includes('карта')) extractedType = 'world_map';
          else if (tVal.includes('manifest') || tVal.includes('маніфест')) extractedType = 'manifest';
        } else if (line.toUpperCase() === '[МАПА]' || line.toUpperCase() === '[КАРТА]' || line.toUpperCase() === '[WORLD_MAP]') {
          extractedType = 'world_map';
        } else if (line.toUpperCase() === '[МАНІФЕСТ]' || line.toUpperCase() === '[MANIFEST]') {
          extractedType = 'manifest';
        }
      }

      if (!title) {
        const titleMatch =
          line.match(/^(?:#\s*)?(?:title|назва|тема|урок|topic)\s*[:=]\s*["']?([^"'\r\n]+)["']?/i) ||
          line.match(/^\[(?:назва|тема|урок)\s*:\s*([^\]]+)\]/i);
        if (titleMatch) {
          title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }

      if (!description) {
        const descMatch =
          line.match(/^(?:#+\s*)?(?:description|опис)\s*[:=]\s*["']?([^"'\r\n]+)["']?/i) ||
          line.match(/^\[(?:опис)\s*:\s*([^\]]+)\]/i);
        if (descMatch) {
          description = descMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }

      if (!islandStageName) {
        const stageMatch =
          line.match(/^(?:#+\s*)?(?:stage|локація)\s*[:=]\s*["']?([^"'\r\n]+)["']?/i) ||
          line.match(/^\[(?:локація)\s*:\s*([^\]]+)\]/i);
        if (stageMatch) {
          islandStageName = stageMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    let lineIndex = contentStartIdx;
    while (lineIndex < lines.length) {
      const rawLine = lines[lineIndex];
      const line = rawLine.trim();

      if (!line || line === '---') {
        lineIndex++;
        continue;
      }

      // Skip all technical metadata tags so they NEVER leak into student dialogue cards
      if (this.isTechnicalMetadataLine(line)) {
        lineIndex++;
        continue;
      }

      // 0. Fenced code / tag block: ```lang ... ```
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const codeLines: string[] = [];
        let endFenceIdx = lineIndex + 1;
        while (endFenceIdx < lines.length && !lines[endFenceIdx].trim().startsWith('```')) {
          codeLines.push(lines[endFenceIdx]);
          endFenceIdx++;
        }
        const codeContent = codeLines.join('\n').trim();
        lineIndex = endFenceIdx < lines.length ? endFenceIdx + 1 : endFenceIdx;

        if (codeContent) {
          const prevBlock = blocks[blocks.length - 1] as any;
          if (
            prevBlock &&
            (prevBlock.type === 'block_theory_rule' ||
              prevBlock.type === 'block_anchor_fact' ||
              prevBlock.type === 'block_notebook_task') &&
            !prevBlock.codeSnippet
          ) {
            prevBlock.codeSnippet = codeContent;
            if (lang) prevBlock.codeLanguage = lang;
          } else {
            blocks.push({
              id: `code_${Date.now()}_${lineIndex}`,
              type: 'block_theory_rule',
              title: lang ? `Приклад коду (${lang.toUpperCase()})` : 'Приклад коду та тегів',
              ruleSummary: 'Проаналізуйте наведений фрагмент:',
              codeSnippet: codeContent,
              codeLanguage: lang || undefined,
              stepByStepBreakdown: [],
            });
          }
        }
        continue;
      }

      if (line.startsWith('# ')) {
        const headingText = line.replace(/^#\s*/, '').trim();
        if (!title) {
          title = headingText;
        } else {
          blocks.push({
            id: `section_${Date.now()}_${lineIndex}`,
            type: 'block_theory_rule',
            title: headingText,
            ruleSummary: headingText,
            stepByStepBreakdown: [],
          });
        }
        lineIndex++;
        continue;
      }

      if (line.startsWith('## ')) {
        const subText = line.replace(/^##\s*/, '').trim();
        if (!description) {
          description = subText;
        } else {
          blocks.push({
            id: `sub_${Date.now()}_${lineIndex}`,
            type: 'block_anchor_fact',
            headline: subText,
            contentSummary: subText,
            locationLabel: islandStageName || 'Розділ уроку',
          });
        }
        lineIndex++;
        continue;
      }

      // 1. Anchor Fact: `> Fact text...`, `[Факт: ...]`, `Факт: ...`, `Контекст: ...`
      const uFactMatch = line.match(/^(?:Факт|Контекст|Історичний контекст|Довідка)\s*:\s*(.+)$/i);
      if (line.startsWith('> ') || /^\[(?:факт|контекст|fact)\s*:/i.test(line) || uFactMatch) {
        const text = uFactMatch
          ? uFactMatch[1].trim()
          : line.startsWith('> ')
          ? line.replace(/^>\s*/, '').trim()
          : line.replace(/^\[(?:факт|контекст|fact)\s*:\s*/i, '').replace(/\]$/, '').trim();
        blocks.push({
          id: `fact_${Date.now()}_${lineIndex}`,
          type: 'block_anchor_fact',
          headline: text.length > 48 ? text.slice(0, 48) + '...' : text,
          contentSummary: text,
          locationLabel: islandStageName || 'Контекст уроку',
        });
        lineIndex++;
        continue;
      }

      // 2. Dialogue: `@Speaker [emote]: Text` or `Діалог: ...` or explicit `Speaker: Text`
      const dialogueMatch = line.match(/^@([^\s\[:]+)(?:\s*\[(idea|sweat|question|joy)\])?:\s*(.+)$/i);
      if (dialogueMatch) {
        const speaker = dialogueMatch[1];
        const emote = (dialogueMatch[2] ? dialogueMatch[2].toLowerCase() : 'idea') as any;
        const text = dialogueMatch[3];
        blocks.push({
          id: `dlg_${Date.now()}_${lineIndex}`,
          type: 'block_dialogue',
          speaker,
          avatar: '👤',
          emote,
          text,
        });
        lineIndex++;
        continue;
      }

      const speakerLineMatch = line.match(/^([А-ЯІЇЄҐA-Z][а-яіїєґa-zA-Z'’-]{1,22}):\s+(.+)$/);
      const nonSpeakerPrefixes =
        /^(?:Теорія|Правило|Факт|Контекст|Історія|Довідка|Приклад|Увага|Важливо|Крок|Пояснення|Висновок|Завдання|Задача|Вправа|Практика|Питання|Тест|Підсумок|Формула|Примітка|Джерело|Назва|Тема|Урок|Опис|Мета|Результат|Діалог|Репліка)$/i;
      if (speakerLineMatch && !nonSpeakerPrefixes.test(speakerLineMatch[1])) {
        blocks.push({
          id: `dlg_${Date.now()}_${lineIndex}`,
          type: 'block_dialogue',
          speaker: speakerLineMatch[1].trim(),
          avatar: '👤',
          emote: 'idea',
          text: speakerLineMatch[2].trim(),
        });
        lineIndex++;
        continue;
      }

      const explicitDialogueMatch = line.match(/^(?:Діалог|Репліка)\s*:\s*(.+)$/i);
      if (explicitDialogueMatch) {
        blocks.push({
          id: `dlg_${Date.now()}_${lineIndex}`,
          type: 'block_dialogue',
          speaker: 'Наставник',
          avatar: '👤',
          emote: 'idea',
          text: explicitDialogueMatch[1].trim(),
        });
        lineIndex++;
        continue;
      }

      // 3. Theory Rule: `= Rule...`, `Теорія: ...`, `[Теорія: ...]`, `!!! ...`, `Правило: ...`
      const bracketRuleMatch = line.match(/^\[(?:теорія|правило|rule|theory)\s*:\s*([^\]]+)\]$/i);
      const ruleMatch = line.match(/^(?:=|Теорія:|Теорія\s|Правило:|Правило\s|Визначення:|Поняття:|!!!)\s*(.+)$/i);
      if (bracketRuleMatch || ruleMatch) {
        const ruleText = (bracketRuleMatch ? bracketRuleMatch[1] : ruleMatch![1]).trim();
        blocks.push({
          id: `rule_${Date.now()}_${lineIndex}`,
          type: 'block_theory_rule',
          title: 'Опорне правило',
          ruleSummary: ruleText,
          stepByStepBreakdown: [],
        });
        lineIndex++;
        continue;
      }

      // 3b. Formula / Example / Task shorthand headings
      const formulaLineMatch = line.match(/^(?:Формула|Formula)\s*:\s*(.+)$/i);
      if (formulaLineMatch) {
        const fText = formulaLineMatch[1].trim();
        const prevBlock = blocks[blocks.length - 1] as any;
        if (prevBlock && (prevBlock.type === 'block_theory_rule' || prevBlock.type === 'block_anchor_fact')) {
          prevBlock.formulaText = fText;
        } else {
          blocks.push({
            id: `formula_${Date.now()}_${lineIndex}`,
            type: 'block_theory_rule',
            title: 'Ключова формула',
            ruleSummary: `Формула: ${fText}`,
            formulaText: fText,
            stepByStepBreakdown: [],
          });
        }
        lineIndex++;
        continue;
      }

      const taskLineMatch = line.match(/^(?:Завдання|Задача|Вправа|Практика)\s*:\s*(.+)$/i);
      if (taskLineMatch) {
        blocks.push({
          id: `notebook_${Date.now()}_${lineIndex}`,
          type: 'block_notebook_task',
          title: 'Практичне завдання',
          notebookPrompt: taskLineMatch[1].trim(),
          reward: { wood: 25, stone: 10, energy: 15 },
        });
        lineIndex++;
        continue;
      }

      // 4. Recognition Quiz: `? Question...` followed by `+ Correct` and `- Incorrect`
      if (line.startsWith('? ')) {
        const questionText = line.replace(/^\?\s*/, '').trim();
        const options: string[] = [];
        let correctIndex = 0;
        let explanation = 'Чудово! Розрахунок вірний.';

        let peekIdx = lineIndex + 1;
        while (peekIdx < lines.length) {
          const peekLine = lines[peekIdx].trim();
          if (peekLine.startsWith('+ ')) {
            const optText = peekLine.replace(/^\+\s*/, '').trim();
            const expMatch = optText.match(/^(.*?)\s*\((.*?)\)$/);
            if (expMatch) {
              options.push(expMatch[1]);
              explanation = expMatch[2];
            } else {
              options.push(optText);
            }
            correctIndex = options.length - 1;
            peekIdx++;
          } else if (peekLine.startsWith('- ')) {
            const optText = peekLine.replace(/^-\s*/, '').trim();
            const cleanOpt = optText.replace(/\s*\(.*?\)$/, '');
            options.push(cleanOpt);
            peekIdx++;
          } else {
            break;
          }
        }

        if (options.length === 0) {
          options.push('Варіант А', 'Варіант Б');
        }

        blocks.push({
          id: `quiz_${Date.now()}_${lineIndex}`,
          type: 'block_recognition_quiz',
          question: questionText,
          options,
          correctIndex,
          explanation,
        });

        lineIndex = peekIdx;
        continue;
      }

      // 5. Notebook Task: `[Зошит: Питання | шаблон: ___ | ключ: назва | відповідь: 15 | од: см | підказка: ...]`
      if (line.startsWith('[Зошит:') || line.startsWith('[зошит:')) {
        const content = line.replace(/^\[зошит:\s*/i, '').replace(/\]$/, '');
        const parts = content.split('|').map((p) => p.trim());

        const questionPrompt = parts[0] || 'Виконайте обчислення у чернетці';
        let scaffoldTemplate = '';
        let inputFieldKey = 'result';
        let expectedValue: string | number = '';
        let unit = '';
        let hintText = '';

        parts.slice(1).forEach((p) => {
          const colonIdx = p.indexOf(':');
          if (colonIdx === -1) return;
          const k = p.slice(0, colonIdx).trim().toLowerCase();
          const v = p.slice(colonIdx + 1).trim();
          if (k === 'шаблон') scaffoldTemplate = v;
          if (k === 'ключ') inputFieldKey = v;
          if (k === 'відповідь' || k === 'expected') expectedValue = v;
          if (k === 'од' || k === 'unit') unit = v;
          if (k === 'підказка' || k === 'hint') hintText = v;
        });

        blocks.push({
          id: `notebook_${Date.now()}_${lineIndex}`,
          type: 'block_notebook_task',
          title: 'Практичне завдання',
          notebookPrompt: questionPrompt,
          scaffoldTemplate: scaffoldTemplate || undefined,
          inputFieldKey,
          expectedValue: expectedValue || undefined,
          unit: unit || undefined,
          correctAnswer: expectedValue || undefined,
          hint: hintText || undefined,
          reward: { wood: 25, stone: 10, energy: 15 },
        });
        lineIndex++;
        continue;
      }

      // 5b. Text Marking: `[Розмітка: Інструкція | речення: [[subj:Хортиця]] [[pred:оберігає]] берег | інструменти: subj, pred]`
      if (/^\[розмітка\s*:/i.test(line)) {
        const content = line.replace(/^\[розмітка:\s*/i, '').replace(/\]$/, '');
        const parts = content.split('|').map((p) => p.trim());
        const promptText = parts[0] || 'Позначте члени речення або ключові слова.';
        let sentence = '';
        let tools: string[] = [];

        parts.slice(1).forEach((p) => {
          const cIdx = p.indexOf(':');
          if (cIdx === -1) return;
          const k = p.slice(0, cIdx).trim().toLowerCase();
          const v = p.slice(cIdx + 1).trim();
          if (k === 'речення' || k === 'sentence' || k === 'текст') sentence = v;
          if (k === 'інструменти' || k === 'tools') {
            tools = v
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
        });

        if (!sentence) sentence = promptText;
        if (tools.length === 0) tools = ['subj', 'pred'];

        blocks.push({
          id: `marking_${Date.now()}_${lineIndex}`,
          type: 'block_text_marking',
          title: 'Розбір тексту',
          prompt: promptText,
          sentence,
          availableTools: tools,
          toleranceMode: 'exact',
          reward: { wood: 20, stone: 10, energy: 15 },
        });
        lineIndex++;
        continue;
      }

      // 6. Interactive Engine Sandbox / Challenge: `[Рушій: engineId | ключ: значення | ...]`
      if (line.startsWith('[Рушій:') || line.startsWith('[рушій:')) {
        const content = line.replace(/^\[рушій:\s*/i, '').replace(/\]$/, '');
        const parts = content.split('|').map((p) => p.trim());
        const engineId = parts[0] || 'balance-physics';

        const engineConfig: Record<string, any> = {};

        parts.slice(1).forEach((p) => {
          const colonIdx = p.indexOf(':');
          if (colonIdx === -1) return;
          const k = p.slice(0, colonIdx).trim();
          const v = p.slice(colonIdx + 1).trim();
          const numVal = Number(v);
          const parsedVal = v !== '' && !isNaN(numVal) ? numVal : v;

          if (k === 'ціль' || k === 'target') {
            engineConfig.targetValue = parsedVal;
            engineConfig.targetSum = parsedVal;
            engineConfig.distanceMeters = parsedVal;
          } else {
            engineConfig[k] = parsedVal;
          }
        });

        blocks.push({
          id: `sandbox_${Date.now()}_${lineIndex}`,
          type: 'block_interactive_sandbox',
          engineId,
          instruction: String(engineConfig.instruction || `Виконайте моделювання у симуляторі`),
          config: engineConfig,
          engineConfig,
        });
        lineIndex++;
        continue;
      }

      // 7. Somatic Pause: `[Пауза: double_sigh | 30]`
      if (line.startsWith('[Пауза:') || line.startsWith('[пауза:')) {
        const content = line.replace(/^\[пауза:\s*/i, '').replace(/\]$/, '');
        const parts = content.split('|').map((p) => p.trim());
        const act = parts[0] || 'double_sigh';
        const dur = Number(parts[1]) || 30;

        blocks.push({
          id: `pause_${Date.now()}_${lineIndex}`,
          type: 'block_somatic_pause',
          activity: act as any,
          activityId: act as any,
          durationSec: dur,
        });
        lineIndex++;
        continue;
      }

      // 8. Bullet list items immediately following a theory/fact block attach as stepByStepBreakdown
      const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim().replace(/^["']|["']$/g, '');
        const prevBlock = blocks[blocks.length - 1] as any;
        if (
          bulletText &&
          !this.isTechnicalMetadataLine(bulletText) &&
          prevBlock &&
          (prevBlock.type === 'block_theory_rule' || prevBlock.type === 'block_anchor_fact')
        ) {
          prevBlock.stepByStepBreakdown = [...(prevBlock.stepByStepBreakdown || []), bulletText];
          lineIndex++;
          continue;
        }
      }

      // Fallback prose line (ignore stray comment lines or technical metadata)
      if (line.length > 0 && !line.startsWith('#')) {
        const unwrapped = this.unwrapYamlProseLine(line);
        if (unwrapped.text && !this.isTechnicalMetadataLine(unwrapped.text)) {
          const prevBlock = blocks[blocks.length - 1] as any;
          if (unwrapped.field === 'formulatext' || unwrapped.field === 'formula') {
            if (prevBlock && (prevBlock.type === 'block_theory_rule' || prevBlock.type === 'block_anchor_fact')) {
              prevBlock.formulaText = unwrapped.text;
            } else {
              blocks.push({
                id: `formula_${lineIndex}`,
                type: 'block_theory_rule',
                title: 'Ключова формула',
                ruleSummary: `Формула: ${unwrapped.text}`,
                formulaText: unwrapped.text,
                stepByStepBreakdown: [],
              });
            }
          } else if (
            unwrapped.field === 'contentsummary' ||
            unwrapped.field === 'facttext' ||
            unwrapped.field === 'fact' ||
            unwrapped.field === 'context' ||
            unwrapped.field === 'headline'
          ) {
            blocks.push({
              id: `fact_fallback_${lineIndex}`,
              type: 'block_anchor_fact',
              headline: 'Контекст уроку',
              contentSummary: unwrapped.text,
              locationLabel: islandStageName || 'Контекст уроку',
            });
          } else if (
            unwrapped.field === 'rulesummary' ||
            unwrapped.field === 'summary' ||
            unwrapped.field === 'theory' ||
            unwrapped.field === 'theorytext' ||
            unwrapped.field === 'rule' ||
            unwrapped.field === 'concept' ||
            unwrapped.field === 'definition' ||
            unwrapped.field === 'explanation' ||
            unwrapped.field === 'example'
          ) {
            blocks.push({
              id: `rule_fallback_${lineIndex}`,
              type: 'block_theory_rule',
              title: 'Опорне правило',
              ruleSummary: unwrapped.text,
              stepByStepBreakdown: [],
            });
          } else if (
            !unwrapped.field &&
            prevBlock &&
            (prevBlock.type === 'block_theory_rule' || prevBlock.type === 'block_anchor_fact')
          ) {
            // Multiline prose/example continuation attaches directly to the active theory or fact block
            if (prevBlock.type === 'block_theory_rule') {
              prevBlock.ruleSummary =
                prevBlock.ruleSummary && prevBlock.ruleSummary !== prevBlock.title
                  ? `${prevBlock.ruleSummary}\n${unwrapped.text}`
                  : unwrapped.text;
            } else {
              prevBlock.contentSummary =
                prevBlock.contentSummary && prevBlock.contentSummary !== prevBlock.headline
                  ? `${prevBlock.contentSummary}\n${unwrapped.text}`
                  : unwrapped.text;
            }
          } else {
            blocks.push({
              id: `dlg_fallback_${lineIndex}`,
              type: 'block_dialogue',
              speaker: 'Наставник',
              avatar: '👤',
              emote: 'idea',
              text: unwrapped.text,
            });
          }
        }
      }

      lineIndex++;
    }

    const finalId = extractedId || TextShorthandParser.sanitizeId(fallbackFileName || 'lesson_episode');
    const finalTitle = title || this.humanizeTitle(fallbackFileName);

    let finalDesc = description;
    if (!finalDesc) {
      const factBlock = blocks.find((b) => b.type === 'block_anchor_fact' || b.type === 'block_theory_rule');
      const rawSummary =
        (factBlock && 'contentSummary' in factBlock && (factBlock as any).contentSummary) ||
        (factBlock && 'ruleSummary' in factBlock && (factBlock as any).ruleSummary) ||
        '';
      const cleanedSummary = String(rawSummary)
        .replace(/\{\{(?:[^{}]|\{\{[^{}]*\}\})*\}\}/g, '')
        .replace(/\[\[([a-zA-Z_][a-zA-Z0-9_]*):((?:(?!\]\]).)+)\]\]/g, (_m, _t, b: string) => b.trim())
        .replace(/\[\[((?:(?!\]\]).)+)\]\]/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      finalDesc = cleanedSummary || `Навчальний урок (${blocks.length} етапів).`;
    }

    return {
      id: finalId,
      fileType: extractedType,
      title: finalTitle,
      description: finalDesc,
      islandStageName: islandStageName || undefined,
      blocks,
      errors,
    };
  }

  /**
   * Splits a single multi-chapter manuscript text file into individual ordered lessons
   */
  public static parseMultiChapterBook(rawText: string, fallbackFileName: string = ''): ShorthandParseResult[] {
    const chapterDelimiterRegex = /^(?:===|---|###)\s*(?:розділ|урок|тема|chapter|lesson)\s*(\d+)?\s*[:=]?\s*(.*?)(?:===|---|###)?$/i;
    const lines = rawText.split(/\r?\n/);

    const chapterIndices: number[] = [];
    lines.forEach((line, idx) => {
      if (chapterDelimiterRegex.test(line.trim())) {
        chapterIndices.push(idx);
      }
    });

    if (chapterIndices.length <= 1) {
      return [this.parse(rawText, fallbackFileName)];
    }

    const results: ShorthandParseResult[] = [];

    for (let i = 0; i < chapterIndices.length; i++) {
      const startLine = chapterIndices[i];
      const endLine = i < chapterIndices.length - 1 ? chapterIndices[i + 1] : lines.length;
      const chapterChunk = lines.slice(startLine, endLine).join('\n');

      const headerLine = lines[startLine].trim();
      const match = headerLine.match(chapterDelimiterRegex);
      const chNum = match && match[1] ? match[1] : `${i + 1}`;
      const chName = match && match[2] ? match[2].trim() : `Епізод ${chNum}`;

      const parsedCh = this.parse(chapterChunk, `lesson_${chNum}`);
      const cleanId =
        parsedCh.id !== 'lesson_episode'
          ? parsedCh.id
          : `lesson_${chNum}_${TextShorthandParser.sanitizeId(chName)}`;

      results.push({
        ...parsedCh,
        id: cleanId,
        title: parsedCh.title && parsedCh.title !== 'Навчальний урок' ? parsedCh.title : `Епізод ${chNum}: ${chName}`,
        islandStageName: parsedCh.islandStageName || undefined,
      });
    }

    return results;
  }
}
