/**
 * Deterministic PRNG + Safe Recursive-Descent Expression Evaluator for `vars`
 * and declarative reaction condition expressions. Zero `eval` / `Function`.
 */

export type VarPrimitive = number | string | boolean;
export type VarMap = Record<string, VarPrimitive>;

export type VarDefinition =
  | VarPrimitive
  | [number, number]
  | [number, number, number]
  | {
      range?: [number, number] | [number, number, number];
      pick?: VarPrimitive[];
      expr?: string;
      formula?: string;
      value?: VarPrimitive;
    };

/** FNV-1a 32-bit string hash */
export function hashSeedString(seedText: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic Mulberry32 PRNG returning floats in [0, 1) */
export function createMulberry32(seedInput: string | number): () => number {
  let a = typeof seedInput === 'number' ? seedInput >>> 0 : hashSeedString(seedInput);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type TokenType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'qmark' | 'colon';

interface ExprToken {
  type: TokenType;
  value: string;
}

function tokenizeExpression(input: string): ExprToken[] {
  const tokens: ExprToken[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Two-char comparison / logical operators
    const two = input.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }
    if (ch === '?') {
      tokens.push({ type: 'qmark', value: '?' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ':' });
      i++;
      continue;
    }

    if ('+-*/%^<>!'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Number literal
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let seenDot = false;
      while (i < input.length && (/[0-9]/.test(input[i]) || (!seenDot && input[i] === '.'))) {
        if (input[i] === '.') seenDot = true;
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'num', value: numStr });
      continue;
    }

    // Identifier
    if (/[a-zA-Z_а-яА-ЯіІїЇєЄґҐ]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_а-яА-ЯіІїЇєЄґҐ]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    // Skip unknown chars safely
    i++;
  }
  return tokens;
}

const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  round: (x, digits = 0) => {
    const f = Math.pow(10, Math.max(0, Math.min(8, Math.trunc(digits))));
    return Math.round(x * f) / f;
  },
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  abs: (x) => Math.abs(x),
  min: (...args) => (args.length ? Math.min(...args) : 0),
  max: (...args) => (args.length ? Math.max(...args) : 0),
  sqrt: (x) => (x >= 0 ? Math.sqrt(x) : 0),
};

function toNum(v: number | boolean | string): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBool(v: number | boolean | string): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  return String(v).trim() !== '' && v !== 'false' && v !== '0';
}

/**
 * Recursive-descent safe expression evaluator.
 * Supports arithmetic (+ - * / % ^), comparisons (< <= > >= == !=),
 * logic (&& || !), ternary (?:), parentheses, variables, and safe math functions.
 */
export function evaluateSafeExpression(
  expression: string,
  env: Record<string, VarPrimitive> = {},
  extraFunctions?: Record<string, (...args: number[]) => number>
): number {
  const tokens = tokenizeExpression(String(expression || ''));
  if (tokens.length === 0) return 0;
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseTernary = (): number => {
    const cond = parseOr();
    if (peek()?.type === 'qmark') {
      consume();
      const whenTrue = parseTernary();
      if (peek()?.type === 'colon') {
        consume();
        const whenFalse = parseTernary();
        return toBool(cond) ? whenTrue : whenFalse;
      }
      return whenTrue;
    }
    return cond;
  };

  const parseOr = (): number => {
    let left = parseAnd();
    while (peek()?.type === 'op' && peek()?.value === '||') {
      consume();
      const right = parseAnd();
      left = toBool(left) || toBool(right) ? 1 : 0;
    }
    return left;
  };

  const parseAnd = (): number => {
    let left = parseEquality();
    while (peek()?.type === 'op' && peek()?.value === '&&') {
      consume();
      const right = parseEquality();
      left = toBool(left) && toBool(right) ? 1 : 0;
    }
    return left;
  };

  const parseEquality = (): number => {
    let left = parseComparison();
    while (peek()?.type === 'op' && (peek()?.value === '==' || peek()?.value === '!=')) {
      const op = consume().value;
      const right = parseComparison();
      left = op === '==' ? (Math.abs(left - right) < 1e-9 ? 1 : 0) : Math.abs(left - right) >= 1e-9 ? 1 : 0;
    }
    return left;
  };

  const parseComparison = (): number => {
    let left = parseAddSub();
    while (peek()?.type === 'op' && ['<', '<=', '>', '>='].includes(peek()!.value)) {
      const op = consume().value;
      const right = parseAddSub();
      if (op === '<') left = left < right ? 1 : 0;
      else if (op === '<=') left = left <= right ? 1 : 0;
      else if (op === '>') left = left > right ? 1 : 0;
      else if (op === '>=') left = left >= right ? 1 : 0;
    }
    return left;
  };

  const parseAddSub = (): number => {
    let left = parseMulDiv();
    while (peek()?.type === 'op' && (peek()?.value === '+' || peek()?.value === '-')) {
      const op = consume().value;
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseMulDiv = (): number => {
    let left = parsePower();
    while (peek()?.type === 'op' && ['*', '/', '%'].includes(peek()!.value)) {
      const op = consume().value;
      const right = parsePower();
      if (op === '*') left = left * right;
      else if (op === '/') left = Math.abs(right) < 1e-12 ? 0 : left / right;
      else left = Math.abs(right) < 1e-12 ? 0 : left % right;
    }
    return left;
  };

  const parsePower = (): number => {
    const base = parseUnary();
    if (peek()?.type === 'op' && peek()?.value === '^') {
      consume();
      const exp = parsePower(); // right-associative
      const res = Math.pow(base, exp);
      return Number.isFinite(res) ? res : 0;
    }
    return base;
  };

  const parseUnary = (): number => {
    const tk = peek();
    if (tk?.type === 'op' && (tk.value === '-' || tk.value === '+' || tk.value === '!')) {
      consume();
      const val = parseUnary();
      if (tk.value === '-') return -val;
      if (tk.value === '!') return toBool(val) ? 0 : 1;
      return val;
    }
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    const tk = peek();
    if (!tk) return 0;

    if (tk.type === 'num') {
      consume();
      const n = Number(tk.value);
      return Number.isFinite(n) ? n : 0;
    }

    if (tk.type === 'lparen') {
      consume();
      const inside = parseTernary();
      if (peek()?.type === 'rparen') consume();
      return inside;
    }

    if (tk.type === 'ident') {
      consume();
      const name = tk.value;

      // Function call
      if (peek()?.type === 'lparen') {
        consume();
        const args: number[] = [];
        while (peek() && peek()!.type !== 'rparen') {
          args.push(parseTernary());
          if (peek()?.type === 'comma') consume();
          else break;
        }
        if (peek()?.type === 'rparen') consume();

        const fn =
          (extraFunctions && extraFunctions[name.toLowerCase()]) ||
          MATH_FUNCTIONS[name.toLowerCase()];
        if (fn) {
          const out = fn(...args);
          return Number.isFinite(out) ? out : 0;
        }
        return 0;
      }

      if (name === 'pi' || name === 'PI') return Math.PI;
      if (name === 'e') return Math.E;
      if (name === 'true') return 1;
      if (name === 'false') return 0;

      if (Object.prototype.hasOwnProperty.call(env, name)) {
        return toNum(env[name]);
      }
      return 0;
    }

    consume();
    return 0;
  };

  try {
    const result = parseTernary();
    if (!Number.isFinite(result)) return 0;
    // Eliminate IEEE 754 tiny rounding artifacts (e.g. 0.1 + 0.2 = 0.30000000000000004)
    return Number(result.toPrecision(12));
  } catch {
    return 0;
  }
}

export function evaluateBooleanCondition(
  conditionExpr: string,
  env: Record<string, VarPrimitive> = {}
): boolean {
  if (!conditionExpr || !conditionExpr.trim()) return false;
  return evaluateSafeExpression(conditionExpr, env) !== 0;
}

function getDecimalPlaces(num: number): number {
  const s = String(num);
  const idx = s.indexOf('.');
  return idx >= 0 ? s.length - idx - 1 : 0;
}

function sampleRange(rangeTuple: [number, number] | [number, number, number], rng: () => number): number {
  const min = Number(rangeTuple[0] ?? 0);
  const max = Number(rangeTuple[1] ?? min);
  const step = Number((rangeTuple as number[])[2] ?? 1);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max <= min || step <= 0) return min;

  const totalSteps = Math.floor((max - min + 1e-9) / step);
  const chosenStep = Math.floor(rng() * (totalSteps + 1));
  const raw = min + chosenStep * step;
  const decimals = Math.max(getDecimalPlaces(min), getDecimalPlaces(step));
  return Number(Math.min(max, raw).toFixed(decimals));
}

function looksLikeVarExpression(rawStr: string, resolved: VarMap): boolean {
  const s = rawStr.trim();
  if (!s) return false;
  if (s.startsWith('=')) return true;
  if (/^(?:randInt|rand|round|floor|ceil|abs|min|max|sqrt)\s*\(/i.test(s)) return true;
  if (/^[0-9a-zA-Z_().+\-*/%^<>=!&|?:\s]+$/.test(s)) {
    const hasOperator = /[+\-*/%^()]/.test(s);
    const hasKnownVar = Object.keys(resolved).some((k) => new RegExp(`\\b${k}\\b`).test(s));
    if (hasOperator || hasKnownVar) return true;
  }
  return false;
}

/**
 * Resolves a `vars` specification deterministically using Mulberry32 seeded by
 * `profileSeed + lessonId + chapterId + variantOffset`.
 */
export function resolveVarsSpec(
  varsSpec: Record<string, VarDefinition> | undefined,
  seedContext: { profileSeed?: string; lessonId?: string; chapterId?: string; variantNonce?: number } = {}
): VarMap {
  if (!varsSpec || typeof varsSpec !== 'object') return {};

  const seedStr = `${seedContext.profileSeed || 'guest'}::${seedContext.lessonId || 'lesson'}::${
    seedContext.chapterId || 'chapter'
  }::${seedContext.variantNonce ?? 0}`;
  const rng = createMulberry32(seedStr);

  const seededFns: Record<string, (...args: number[]) => number> = {
    randint: (min = 0, max = 10) => {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(rng() * (hi - lo + 1));
    },
    rand: (min = 0, max = 1) => {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      return lo + rng() * (hi - lo);
    },
  };

  const resolved: VarMap = {};

  for (const [key, def] of Object.entries(varsSpec)) {
    if (Array.isArray(def)) {
      resolved[key] = sampleRange(def, rng);
    } else if (def !== null && typeof def === 'object') {
      if (Array.isArray(def.range)) {
        resolved[key] = sampleRange(def.range, rng);
      } else if (Array.isArray(def.pick) && def.pick.length > 0) {
        const idx = Math.floor(rng() * def.pick.length);
        resolved[key] = def.pick[idx];
      } else if (typeof def.expr === 'string' || typeof def.formula === 'string') {
        const rawExpr = (def.expr || def.formula)!.trim();
        resolved[key] = evaluateSafeExpression(
          rawExpr.startsWith('=') ? rawExpr.slice(1) : rawExpr,
          resolved,
          seededFns
        );
      } else if (def.value !== undefined) {
        resolved[key] = def.value;
      }
    } else if (typeof def === 'string' && looksLikeVarExpression(def, resolved)) {
      const rawExpr = def.trim();
      resolved[key] = evaluateSafeExpression(
        rawExpr.startsWith('=') ? rawExpr.slice(1) : rawExpr,
        resolved,
        seededFns
      );
    } else if (typeof def === 'number' || typeof def === 'string' || typeof def === 'boolean') {
      resolved[key] = def;
    }
  }

  return resolved;
}

/**
 * Replaces `{{varName}}` (when defined in `vars`) and `{{= expr }}` inside strings.
 * Leaves widget tokens such as `{{rect_geo:...}}` intact while resolving any nested `{{var}}` inside them.
 */
export function interpolateVarTemplate(text: string, vars: VarMap): string {
  if (!text || typeof text !== 'string') return text;
  const hasVars = vars && Object.keys(vars).length > 0;
  if (!hasVars && !text.includes('{{=')) return text;

  let current = text;
  // Two passes resolve outer templates after inner nested vars like {{rect_geo:w={{w}}}}
  for (let pass = 0; pass < 2; pass++) {
    const next = current.replace(
      /\{\{\s*(=\s*[^{}]+|[a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
      (full, exprBody: string) => {
        const trimmed = exprBody.trim();
        if (trimmed.startsWith('=')) {
          return String(evaluateSafeExpression(trimmed.slice(1), vars));
        }
        if (Object.prototype.hasOwnProperty.call(vars, trimmed)) {
          return String(vars[trimmed]);
        }
        return full;
      }
    );
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Deeply resolves template variables across an arbitrary story block before rendering */
export function applyVarsToValue<T>(value: T, vars: VarMap): T {
  if (typeof value === 'string') {
    return interpolateVarTemplate(value, vars) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyVarsToValue(item, vars)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (k === 'vars') continue;
      out[k] = applyVarsToValue(v, vars);
    }
    return out as T;
  }
  return value;
}

/**
 * Recomputes dependent formula variables cleanly whenever an independent variable changes
 * inside reactive LessonScope (Tangle). Runs two safe passes to support chained formulas.
 */
export function recomputeScopeVars(
  currentVars: VarMap,
  formulas: Record<string, string> = {}
): VarMap {
  const next: VarMap = { ...currentVars };
  const formulaEntries = Object.entries(formulas).filter(([, expr]) => typeof expr === 'string' && expr.trim() !== '');
  if (formulaEntries.length === 0) return next;

  for (let pass = 0; pass < 2; pass++) {
    for (const [key, rawExpr] of formulaEntries) {
      const expr = rawExpr.trim();
      const cleaned = expr.startsWith('=') ? expr.slice(1) : expr;
      next[key] = evaluateSafeExpression(cleaned, next);
    }
  }
  return next;
}

