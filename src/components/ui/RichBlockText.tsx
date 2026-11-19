import React from 'react';
import { InlineWidgetRenderer } from '../widgets/WidgetRegistry';
import { InlineTangleNumber, InlineScopeExprReadout } from '../widgets/ReactiveStage2Widgets';
import { VarMap, interpolateVarTemplate } from '../../core/vars/var-engine';
import { TextShorthandParser } from '../../core/ingestion/text-shorthand-parser';
import { TextLensMode } from '../../features/story-player/TextLensSwitch';
import { useSessionStore } from '../../core/state/useSessionStore';

interface RichBlockTextProps {
  text?: string;
  codeSnippet?: string;
  codeLanguage?: string;
  className?: string;
  vars?: VarMap;
  interactiveWidgets?: boolean;
  resetSignal?: string;
  activeLens?: TextLensMode;
}

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'syntax'; role: 'subj' | 'pred' | 'attr' | 'obj' | 'adv'; value: string }
  | { kind: 'morpheme'; parts: Array<{ partKind: string; text: string }> }
  | { kind: 'ortho'; value: string }
  | { kind: 'callout'; role: 'quote' | 'thesis' | 'warn'; value: string }
  | { kind: 'widget'; widgetType: string; rawArgs: string };

/**
 * Finds the matching closing `}}` starting after an opening `{{` at `openIdx`,
 * respecting quoted strings and nested `{{...}}` pairs.
 */
function findMatchingDoubleBraceClose(line: string, openIdx: number): number {
  let depth = 1;
  let quote: '"' | "'" | null = null;
  let i = openIdx + 2;

  while (i < line.length - 1) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\' && i + 1 < line.length) {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === '{' && line[i + 1] === '{') {
      depth++;
      i += 2;
      continue;
    }
    if (ch === '}' && line[i + 1] === '}') {
      depth--;
      if (depth === 0) return i;
      i += 2;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * Finds closing `]]` for `[[...]]`, handling inner single `[...]` like `[[ortho:з[е/и]лений]]`.
 */
function findMatchingDoubleBracketClose(line: string, openIdx: number): number {
  let i = openIdx + 2;
  let singleDepth = 0;

  while (i < line.length - 1) {
    const ch = line[i];
    if (ch === ']' && line[i + 1] === ']') {
      if (singleDepth > 0 && line[i + 2] === ']') {
        // e.g. `[[ortho:word [e]]]` -> consume inner `]` first, then `]]` closes outer tag
        singleDepth--;
        i++;
        continue;
      }
      return i;
    }
    if (ch === '[') {
      singleDepth++;
    } else if (ch === ']' && singleDepth > 0) {
      singleDepth--;
    }
    i++;
  }
  return -1;
}

function sanitizeProseSegment(rawProse: string): string {
  // 1. Convert accidental inline HTML tags in prose (never runs on fenced code blocks)
  const htmlCleaned = rawProse
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|li|ul|ol|blockquote|section|article)\b[^>]*>/gi, '\n')
    .replace(/<(?:strong|b)\b[^>]*>/gi, '**')
    .replace(/<\/(?:strong|b)>/gi, '**')
    .replace(/<(?:em|i)\b[^>]*>/gi, '*')
    .replace(/<\/(?:em|i)>/gi, '*')
    .replace(/<code\b[^>]*>/gi, '`')
    .replace(/<\/code>/gi, '`')
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s+[^<>]*)?\/?>/g, '');

  // 2. Drop stray technical YAML metadata lines and unwrap YAML prose field prefixes
  const lines = htmlCleaned.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      continue;
    }
    if (TextShorthandParser.isTechnicalMetadataLine(trimmed)) {
      continue;
    }
    const unwrapped = TextShorthandParser.unwrapYamlProseLine(trimmed);
    const candidate = unwrapped.text.trim();
    if (!candidate || TextShorthandParser.isTechnicalMetadataLine(candidate)) {
      continue;
    }
    cleanedLines.push(candidate);
  }

  return cleanedLines.join('\n').trim();
}

/**
 * Single-pass balanced scanner that never re-scans already matched spans.
 */
function scanInlineTokens(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let plainStart = 0;

  const flushPlain = (endIdx: number) => {
    if (endIdx > plainStart) {
      tokens.push({ kind: 'text', value: line.slice(plainStart, endIdx) });
    }
  };

  while (i < line.length) {
    // 1. Inline code: `...`
    if (line[i] === '`') {
      const close = line.indexOf('`', i + 1);
      if (close > i + 1) {
        flushPlain(i);
        tokens.push({ kind: 'code', value: line.slice(i + 1, close) });
        i = close + 1;
        plainStart = i;
        continue;
      }
    }

    // 2. Bold: **...**
    if (line[i] === '*' && line[i + 1] === '*') {
      const close = line.indexOf('**', i + 2);
      if (close > i + 2) {
        flushPlain(i);
        tokens.push({ kind: 'bold', value: line.slice(i + 2, close) });
        i = close + 2;
        plainStart = i;
        continue;
      }
    }

    // 2b. Italic: *...* (avoid math multiplication like `a * b`)
    if (line[i] === '*' && line[i + 1] !== '*' && line[i + 1] && !/\s/.test(line[i + 1])) {
      let close = i + 1;
      let foundClose = -1;
      while (close < line.length) {
        if (line[close] === '*' && line[close + 1] !== '*') {
          if (close > i + 1 && !/\s/.test(line[close - 1])) {
            foundClose = close;
            break;
          }
        }
        close++;
      }
      if (foundClose > i + 1) {
        flushPlain(i);
        tokens.push({ kind: 'italic', value: line.slice(i + 1, foundClose) });
        i = foundClose + 1;
        plainStart = i;
        continue;
      }
    }

    // 3. Bracket markers: [[tag:content]]
    if (line[i] === '[' && line[i + 1] === '[') {
      const close = findMatchingDoubleBracketClose(line, i);
      if (close > i + 2) {
        const inner = line.slice(i + 2, close);
        const colonIdx = inner.indexOf(':');
        if (colonIdx > 0) {
          const tag = inner.slice(0, colonIdx).trim().toLowerCase();
          const body = inner.slice(colonIdx + 1);

          if (tag === 'subj' || tag === 'pred' || tag === 'attr' || tag === 'obj' || tag === 'adv') {
            flushPlain(i);
            tokens.push({ kind: 'syntax', role: tag, value: body });
            i = close + 2;
            plainStart = i;
            continue;
          }

          if (tag === 'ortho' || tag === 'key_term' || tag === 'term' || tag === 'highlight') {
            flushPlain(i);
            tokens.push({ kind: 'ortho', value: body });
            i = close + 2;
            plainStart = i;
            continue;
          }

          if (
            tag === 'quote' ||
            tag === 'citation' ||
            tag === 'cite' ||
            tag === 'thesis' ||
            tag === 'note' ||
            tag === 'important' ||
            tag === 'fact' ||
            tag === 'rule' ||
            tag === 'tip' ||
            tag === 'law_warn' ||
            tag === 'warn' ||
            tag === 'warning' ||
            tag === 'attention' ||
            tag === 'hint'
          ) {
            flushPlain(i);
            const role: 'quote' | 'thesis' | 'warn' =
              tag === 'quote' || tag === 'citation' || tag === 'cite'
                ? 'quote'
                : tag === 'law_warn' || tag === 'warn' || tag === 'warning' || tag === 'attention' || tag === 'hint'
                ? 'warn'
                : 'thesis';
            tokens.push({ kind: 'callout', role, value: body });
            i = close + 2;
            plainStart = i;
            continue;
          }

          if (tag === 'morpheme') {
            // Supports both `[[morpheme:prefix:при|root:ліс|ending:а]]` and `[[morpheme:при-клад-н-ий]]`
            const rawChunks = body.includes('|')
              ? body.split('|').filter(Boolean)
              : body.split('-').filter(Boolean);
            const parts = rawChunks.map((chunk) => {
              const cIdx = chunk.indexOf(':');
              if (cIdx > 0) {
                return {
                  partKind: chunk.slice(0, cIdx).trim().toLowerCase(),
                  text: chunk.slice(cIdx + 1),
                };
              }
              return { partKind: 'root', text: chunk };
            });
            flushPlain(i);
            tokens.push({ kind: 'morpheme', parts });
            i = close + 2;
            plainStart = i;
            continue;
          }

          // Unknown [[tag:body]] -> unwrap body cleanly so raw [[...]] syntax never leaks
          flushPlain(i);
          tokens.push({ kind: 'text', value: body.trim() });
          i = close + 2;
          plainStart = i;
          continue;
        }

        // Unknown [[plain]] -> unwrap brackets cleanly
        flushPlain(i);
        tokens.push({ kind: 'text', value: inner.trim() });
        i = close + 2;
        plainStart = i;
        continue;
      }
    }

    // 4. Widget / template tags: {{type:args}} or {{type}}
    if (line[i] === '{' && line[i + 1] === '{') {
      const close = findMatchingDoubleBraceClose(line, i);
      if (close > i + 2) {
        const inner = line.slice(i + 2, close).trim();
        const colonIdx = inner.indexOf(':');
        const widgetType = (colonIdx > 0 ? inner.slice(0, colonIdx) : inner).trim();
        const rawArgs = colonIdx > 0 ? inner.slice(colonIdx + 1).trim() : '';
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(widgetType)) {
          flushPlain(i);
          tokens.push({ kind: 'widget', widgetType, rawArgs });
          i = close + 2;
          plainStart = i;
          continue;
        }
      }
    }

    i++;
  }

  flushPlain(line.length);
  return tokens;
}

const normalizeReadableText = (input: unknown): string => {
  if (input === undefined || input === null) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  if (Array.isArray(input)) {
    return input.map((item) => normalizeReadableText(item)).filter(Boolean).join('\n');
  }
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const preferred =
      obj.text ??
      obj.content ??
      obj.body ??
      obj.description ??
      obj.summary ??
      obj.ruleSummary ??
      obj.contentSummary ??
      obj.explanation;
    if (preferred !== undefined) {
      return normalizeReadableText(preferred);
    }
    return Object.values(obj)
      .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''))
      .filter(Boolean)
      .join('\n');
  }
  return String(input);
};

const LENS_NUMBER_RE = /(\d+(?:[.,–-]\d+)?(?:\s?(?:см|мм|м|км|кг|г|т|л|с|хв|год|рр?\.|ст\.|°|%|₴|ккал|м\/с|км\/год|Вт|В|А|Ом))?)/gi;
const LENS_CAUSE_RE = /\b(тому що|тому|щоб|аби|оскільки|через те що|через|завдяки|внаслідок|отже|якщо|тоді|бо|призводить до|перевищує|дорівнює|визначали)\b/gi;
const LENS_RULE_RE = /\b(правил[оау]|формул[аиу]|теорем[аи]|закон|периметр|площ[аіу]|підмет|присудок|означенн[яі]|додаток|обставин[аи]|префікс|корінь|суфікс|закінченн[яі]|орфограм[аи]|перевірне слово|правопис)\b/gi;
const LENS_FACT_RE = /\b(\d{3,4}(?:–\d{3,4})?\s?(?:р\.|рр\.|році|року|ст\.|століття)?|[А-ЯІЇЄҐ][а-яіїєґ']{2,}(?:\s+[А-ЯІЇЄҐ][а-яіїєґ'’]+)?)\b/g;

function renderTextWithLens(text: string, lens: TextLensMode, keyPrefix: string): React.ReactNode {
  if (!text || lens === 'all') return text;

  const regex =
    lens === 'numbers'
      ? LENS_NUMBER_RE
      : lens === 'causes'
      ? LENS_CAUSE_RE
      : lens === 'rules'
      ? LENS_RULE_RE
      : LENS_FACT_RE;

  regex.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const cls =
      lens === 'numbers'
        ? 'lens-hl-numbers'
        : lens === 'causes'
        ? 'lens-hl-causes'
        : lens === 'rules'
        ? 'lens-hl-rules'
        : 'lens-hl-facts';
    parts.push(
      <mark key={`${keyPrefix}_l_${counter++}`} className={`lens-hl ${cls}`}>
        {match[0]}
      </mark>
    );
    lastIdx = match.index + match[0].length;
    if (match[0].length === 0) break;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

export const RichBlockText: React.FC<RichBlockTextProps> = ({
  text = '',
  codeSnippet,
  codeLanguage,
  className = '',
  vars,
  interactiveWidgets = false,
  resetSignal = '',
  activeLens = 'all',
}) => {
  const openGlossary = useSessionStore((s) => s.openGlossary);
  const safeRawText = normalizeReadableText(text);
  const safeText = vars ? interpolateVarTemplate(safeRawText, vars) : safeRawText;
  const safeRawCode = normalizeReadableText(codeSnippet).trim();
  const safeCode = vars ? interpolateVarTemplate(safeRawCode, vars) : safeRawCode;

  const parts: Array<{ kind: 'text' | 'code'; content: string; lang?: string }> = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(safeText)) !== null) {
    if (match.index > lastIndex) {
      const prose = sanitizeProseSegment(safeText.slice(lastIndex, match.index));
      if (prose) parts.push({ kind: 'text', content: prose });
    }
    parts.push({
      kind: 'code',
      lang: match[1]?.trim() || undefined,
      content: match[2].replace(/\s+$/, ''),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < safeText.length) {
    const tail = sanitizeProseSegment(safeText.slice(lastIndex));
    if (tail) parts.push({ kind: 'text', content: tail });
  }

  if (safeCode) {
    parts.push({
      kind: 'code',
      lang: codeLanguage,
      content: safeCode,
    });
  }

  if (parts.length === 0) return null;

  const renderLineTokens = (line: string, keyPrefix: string, depth = 0): React.ReactNode => {
    const tokens = scanInlineTokens(line);
    return tokens.map((tok, i) => {
      const key = `${keyPrefix}_${i}`;
      switch (tok.kind) {
        case 'code':
          return (
            <code key={key} className="code-inline">
              {tok.value}
            </code>
          );
        case 'bold':
          return (
            <strong key={key}>
              {depth < 2 ? renderLineTokens(tok.value, `${key}_b`, depth + 1) : tok.value}
            </strong>
          );
        case 'italic':
          return (
            <em key={key}>
              {depth < 2 ? renderLineTokens(tok.value, `${key}_em`, depth + 1) : tok.value}
            </em>
          );
        case 'syntax':
          return (
            <span key={key} className={`sem-${tok.role}`}>
              {tok.value}
            </span>
          );
        case 'ortho':
          return (
            <span
              key={key}
              className={`ortho-mark cursor-pointer ${activeLens === 'rules' ? 'lens-hl lens-hl-rules' : ''}`}
              title="Двічі натисніть, щоб відкрити слово у довіднику"
              onDoubleClick={(e) => {
                e.stopPropagation();
                openGlossary(tok.value.replace(/\[[^\]]+\]/g, ''));
              }}
            >
              {tok.value}
            </span>
          );
        case 'morpheme':
          return (
            <span
              key={key}
              className={`inline-flex items-end gap-0.5 align-baseline ${
                activeLens === 'rules' ? 'lens-hl lens-hl-rules' : ''
              }`}
            >
              {tok.parts.map((mp, mIdx) => {
                const cls =
                  mp.partKind === 'prefix' ||
                  mp.partKind === 'root' ||
                  mp.partKind === 'suffix' ||
                  mp.partKind === 'ending'
                    ? `morpheme-${mp.partKind}`
                    : 'morpheme-root';
                return (
                  <span key={`${key}_m_${mIdx}`} className={`morpheme-chip ${cls}`}>
                    {mp.text}
                  </span>
                );
              })}
            </span>
          );
        case 'callout': {
          const calloutCls =
            tok.role === 'quote'
              ? 'sem-quote'
              : tok.role === 'thesis'
              ? 'sem-thesis'
              : 'sem-warn';
          const prefixIcon = tok.role === 'quote' ? '❝ ' : tok.role === 'thesis' ? '📌 ' : '⚠️ ';
          return (
            <span
              key={key}
              className={`block my-1.5 ${calloutCls} ${
                activeLens === 'facts' && tok.role === 'thesis' ? 'ring-2 ring-[var(--accent)]' : ''
              }`}
            >
              {prefixIcon}
              {depth < 2 ? renderLineTokens(tok.value, `${key}_c`, depth + 1) : tok.value}
            </span>
          );
        }
        case 'widget':
          if (tok.widgetType === 'tangle' || tok.widgetType === 'scope_var') {
            return <InlineTangleNumber key={key} rawArgs={tok.rawArgs} />;
          }
          if (tok.widgetType === 'scope_expr' || tok.widgetType === 'calc') {
            return <InlineScopeExprReadout key={key} rawArgs={tok.rawArgs} />;
          }
          return (
            <InlineWidgetRenderer
              key={key}
              widgetType={tok.widgetType}
              rawArgs={tok.rawArgs}
              interactive={interactiveWidgets}
              resetSignal={resetSignal}
              instanceKey={key}
              renderRichText={(nestedText) => (
                <RichBlockText
                  text={nestedText}
                  vars={vars}
                  interactiveWidgets={false}
                  resetSignal={resetSignal}
                  activeLens={activeLens}
                />
              )}
            />
          );
        default:
          return (
            <React.Fragment key={key}>
              {renderTextWithLens(tok.value, activeLens, key)}
            </React.Fragment>
          );
      }
    });
  };

  const handleProseDoubleClick = () => {
    if (typeof window === 'undefined') return;
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length >= 2 && selected.length <= 42) {
      openGlossary(selected);
    }
  };

  return (
    <div
      className={`space-y-3 ${className}`}
      onDoubleClick={handleProseDoubleClick}
    >
      {parts.map((part, idx) => {
        if (part.kind === 'code') {
          return (
            <div key={`part_${idx}`} className="code-block-wrapper">
              <div className="code-block-header">
                <span>{part.lang ? part.lang.toUpperCase() : 'ПРИКЛАД / КОД'}</span>
              </div>
              <pre className="code-block-pre">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }

        const lines = part.content.split(/\r?\n/);
        return (
          <div key={`part_${idx}`} className="space-y-1.5 leading-relaxed">
            {lines.map((line, lIdx) => {
              const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
              if (headingMatch) {
                return (
                  <h4 key={`l_${idx}_${lIdx}`} className="font-extrabold text-[var(--primary-dark)] pt-1">
                    {renderLineTokens(headingMatch[2], `p_${idx}_${lIdx}`)}
                  </h4>
                );
              }
              const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
              if (bulletMatch) {
                return (
                  <div key={`l_${idx}_${lIdx}`} className="flex items-start gap-2 pl-1">
                    <span className="text-[var(--accent)] font-bold shrink-0" aria-hidden="true">•</span>
                    <div className="flex-1 min-w-0 whitespace-pre-wrap">
                      {renderLineTokens(bulletMatch[1], `p_${idx}_${lIdx}`)}
                    </div>
                  </div>
                );
              }
              return (
                <div key={`l_${idx}_${lIdx}`} className="whitespace-pre-wrap">
                  {renderLineTokens(line, `p_${idx}_${lIdx}`)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
