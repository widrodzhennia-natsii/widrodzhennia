import React from 'react';

export interface WidgetSliderSpec {
  key: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface ParsedWidgetArgs {
  raw: string;
  params: Record<string, string>;
  positional: string[];
}

export interface WidgetDefinition {
  type: string;
  label: string;
  category: 'stem' | 'humanities' | 'subject';
  render: (
    args: ParsedWidgetArgs,
    overrides: Record<string, number>,
    options?: {
      interactive?: boolean;
      onToggleOverride?: (key: string, nextVal: number) => void;
      renderRichText?: (text: string) => React.ReactNode;
    }
  ) => React.ReactNode;
  getSliders?: (args: ParsedWidgetArgs) => WidgetSliderSpec[];
  getLiveSummary?: (args: ParsedWidgetArgs, overrides: Record<string, number>) => string | null;
}

function splitRespectingQuotes(input: string, delimiter: string): string[] {
  const out: string[] = [];
  let buf = '';
  let quote: '"' | "'" | null = null;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escapeNext) {
      buf += ch;
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      buf += ch;
      escapeNext = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === delimiter) {
      out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) {
    out.push(buf.trim());
  }
  return out.filter(Boolean);
}

function unquoteWidgetValue(rawVal: string): string {
  const v = rawVal.trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }
  return v;
}

export function parseWidgetArgString(raw: string): ParsedWidgetArgs {
  const params: Record<string, string> = {};
  const positional: string[] = [];
  if (!raw || !raw.trim()) return { raw: '', params, positional };

  // Prefer ';' when unquoted ';' separates key=val tokens, otherwise split on unquoted ','
  const semiParts = splitRespectingQuotes(raw, ';');
  const commaParts = splitRespectingQuotes(raw, ',');
  const parts = semiParts.length > 1 ? semiParts : commaParts;

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim();
      const v = unquoteWidgetValue(part.slice(eqIdx + 1));
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) {
        params[k] = v;
      } else {
        positional.push(unquoteWidgetValue(part));
      }
    } else {
      positional.push(unquoteWidgetValue(part));
    }
  }

  return { raw, params, positional };
}

export function numArg(
  args: ParsedWidgetArgs,
  overrides: Record<string, number>,
  keys: string[],
  fallback: number,
  posIdx?: number
): number {
  for (const k of keys) {
    if (overrides[k] !== undefined && Number.isFinite(overrides[k])) {
      return overrides[k];
    }
  }
  for (const k of keys) {
    if (args.params[k] !== undefined) {
      const n = Number(args.params[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  if (posIdx !== undefined && args.positional[posIdx] !== undefined) {
    const n = Number(args.positional[posIdx]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function strArg(
  args: ParsedWidgetArgs,
  keys: string[],
  fallback: string,
  posIdx?: number
): string {
  for (const k of keys) {
    if (args.params[k] !== undefined && args.params[k] !== '') {
      return args.params[k];
    }
  }
  if (posIdx !== undefined && args.positional[posIdx] !== undefined) {
    return args.positional[posIdx];
  }
  return fallback;
}
