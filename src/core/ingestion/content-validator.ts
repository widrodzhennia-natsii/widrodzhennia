import { z } from 'zod';
import { BlockSchema, StoryBlockZod } from '../contracts/blocks.schema';
import { CampaignManifestSchema, CampaignManifest } from '../contracts/campaign.schema';

export interface ValidationIssue {
  path: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  issues: ValidationIssue[];
}

const PROMPT_ROLE_HINTS: Array<{ pattern: RegExp; role: string; label: string }> = [
  { pattern: /підмет/i, role: 'subj', label: 'Підмет (subj)' },
  { pattern: /присуд/i, role: 'pred', label: 'Присудок (pred)' },
  { pattern: /означен/i, role: 'attr', label: 'Означення (attr)' },
  { pattern: /додат/i, role: 'obj', label: 'Додаток (obj)' },
  { pattern: /обставин/i, role: 'adv', label: 'Обставина (adv)' },
  { pattern: /орфограм/i, role: 'ortho', label: 'Орфограма (ortho)' },
  { pattern: /префікс/i, role: 'prefix', label: 'Префікс (prefix)' },
  { pattern: /корін|корен/i, role: 'root', label: 'Корінь (root)' },
  { pattern: /суфікс/i, role: 'suffix', label: 'Суфікс (suffix)' },
  { pattern: /закінчен/i, role: 'ending', label: 'Закінчення (ending)' },
  { pattern: /ключов/i, role: 'key_term', label: 'Ключове слово (key_term)' },
];

export function validateTextMarkingParity(block: any, blockIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!block || block.type !== 'block_text_marking') return issues;

  const tools = new Set<string>(Array.isArray(block.availableTools) ? block.availableTools.map(String) : []);
  const sentence = String(block.sentence || '');
  const prompt = String(block.prompt || '');

  // 1. Roles extracted from inline reference markers `[[role:word]]`
  const refRoles = new Set<string>();
  const markerRegex = /\[\[([a-zA-Z_][a-zA-Z0-9_]*):([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = markerRegex.exec(sentence)) !== null) {
    refRoles.add(m[1].trim().toLowerCase());
  }

  if (Array.isArray(block.targetTokens)) {
    block.targetTokens.forEach((tk: any) => {
      if (tk?.role) refRoles.add(String(tk.role).trim().toLowerCase());
    });
  }

  refRoles.forEach((role) => {
    if (!tools.has(role)) {
      issues.push({
        path: `Блок #${blockIndex + 1} (block_text_marking): availableTools`,
        message: `В еталоні використано роль «${role}», якої немає в availableTools.`,
        suggestion: `Додайте "${role}" до масиву availableTools.`,
      });
    }
  });

  // 2. Roles mentioned in Ukrainian prompt text
  PROMPT_ROLE_HINTS.forEach(({ pattern, role, label }) => {
    if (pattern.test(prompt) && !tools.has(role)) {
      issues.push({
        path: `Блок #${blockIndex + 1} (block_text_marking): prompt ↔ availableTools`,
        message: `В умові завдання згадується ${label}, але інструмент «${role}» відсутній у availableTools.`,
        suggestion: `Додайте "${role}" у availableTools або уточніть умову.`,
      });
    }
  });

  if (refRoles.size === 0) {
    issues.push({
      path: `Блок #${blockIndex + 1} (block_text_marking): sentence`,
      message: 'У реченні не задано жодного еталонного тегу виду [[subj:слово]] або targetTokens.',
      suggestion: 'Огорніть потрібні слова у [[subj:...]], [[pred:...]] тощо.',
    });
  }

  return issues;
}

export class ContentValidator {
  /**
   * Validate single block or array of blocks through Zod + domain parity rules
   */
  public static validateBlocks(blocks: unknown[]): ValidationResult<StoryBlockZod[]> {
    const validBlocks: StoryBlockZod[] = [];
    const issues: ValidationIssue[] = [];

    blocks.forEach((block, index) => {
      const result = BlockSchema.safeParse(block);
      if (result.success) {
        validBlocks.push(result.data as StoryBlockZod);
        if ((block as any)?.type === 'block_text_marking') {
          issues.push(...validateTextMarkingParity(block, index));
        }
      } else {
        result.error.issues.forEach((issue) => {
          const fieldPath = issue.path.join('.');
          const ukrMessage = this.formatUkrMessage(issue);
          issues.push({
            path: `Блок #${index + 1} (${(block as any)?.type || 'невідомий'}): ${fieldPath}`,
            message: ukrMessage,
            suggestion: this.getSuggestion(issue),
          });
        });
      }
    });

    return {
      isValid: issues.length === 0,
      data: validBlocks,
      issues,
    };
  }

  /**
   * Validate campaign manifest
   */
  public static validateCampaign(manifest: unknown): ValidationResult<CampaignManifest> {
    const result = CampaignManifestSchema.safeParse(manifest);
    if (result.success) {
      return { isValid: true, data: result.data, issues: [] };
    }

    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: this.formatUkrMessage(issue),
      suggestion: this.getSuggestion(issue),
    }));

    return { isValid: false, issues };
  }

  private static formatUkrMessage(issue: z.ZodIssue): string {
    const anyIssue = issue as any;
    switch (issue.code) {
      case 'invalid_type':
        return `Очікувався тип "${anyIssue.expected}", отримано "${anyIssue.received}".`;
      case 'too_small':
        return `Значення надто коротке або менше за мінімальне (мін. ${anyIssue.minimum}).`;
      default:
        return issue.message || 'Помилка структури поля.';
    }
  }

  private static getSuggestion(issue: z.ZodIssue): string {
    const pathStr = issue.path.join('.');
    if (pathStr.includes('speaker')) return 'Перевірте наявність ім’я персонажа (наприклад, "Наставник").';
    if (pathStr.includes('emote')) return 'Дозволені емоції: idea, sweat, question, joy.';
    if (pathStr.includes('durationSec')) return 'Тривалість має бути позитивним числом у секундах.';
    if (pathStr.includes('availableTools')) return 'Вкажіть щонайменше 1 інструмент розмітки (subj, pred, ortho тощо).';
    return 'Звірте назву тегів із описом стандарту Zod-схем.';
  }
}
