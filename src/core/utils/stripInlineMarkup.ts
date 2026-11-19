import { TextShorthandParser } from '../ingestion/text-shorthand-parser';

/**
 * Converts inline educational tags (`{{widget:...}}`, `[[role:word]]`, markdown/HTML, leaked YAML lines)
 * into clean human-readable plain text for dialogue typewriter animation,
 * topic list summaries, and speech output so raw YAML/tag syntax never leaks.
 */
export function stripInlineMarkup(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  // 0. Drop purely technical YAML metadata lines and unwrap accidental YAML prose prefixes
  const cleanedLines = rawText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (TextShorthandParser.isTechnicalMetadataLine(trimmed)) return '';
      const unwrapped = TextShorthandParser.unwrapYamlProseLine(trimmed);
      return TextShorthandParser.isTechnicalMetadataLine(unwrapped.text) ? '' : unwrapped.text;
    })
    .filter((l, idx, arr) => l !== '' || (idx > 0 && arr[idx - 1] !== ''));

  let text = cleanedLines.join('\n');

  // 1. Remove widget tags `{{type:...}}` (with balanced braces up to 2 levels)
  text = text.replace(/\{\{(?:[^{}]|\{\{[^{}]*\}\})*\}\}/g, (match) => {
    const bodyMatch = match.match(/(?:title|body|text)\s*=\s*["']([^"']+)["']/i);
    if (match.toLowerCase().startsWith('{{deep_dive') && bodyMatch) {
      return `(${bodyMatch[1]})`;
    }
    return '';
  });

  // 2. Unwrap semantic & morpheme markers `[[tag:content]]` or `[[plain]]` -> readable text
  text = text.replace(/\[\[([a-zA-Z_][a-zA-Z0-9_]*):((?:(?!\]\]).)+)\]\]/g, (_m, tag: string, body: string) => {
    const cleanTag = tag.toLowerCase();
    if (cleanTag === 'morpheme') {
      if (body.includes('|')) {
        return body
          .split('|')
          .map((part) => {
            const idx = part.indexOf(':');
            return idx > 0 ? part.slice(idx + 1) : part;
          })
          .join('');
      }
      return body.replace(/-/g, '').trim();
    }
    return body.trim();
  });
  text = text.replace(/\[\[((?:(?!\]\]).)+)\]\]/g, '$1');

  // 3. Strip HTML comments and inline HTML formatting tags if present
  text = text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(?:p|div|span|strong|em|b|i|u|br|ul|ol|li|h[1-6]|code|pre|blockquote)\b[^>]*\/?>/gi, ' ');

  // 4. Strip markdown headings, bold/italic markers, and backticks
  text = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');

  // 5. Collapse excessive blank lines/spaces created after removing widget tags
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
