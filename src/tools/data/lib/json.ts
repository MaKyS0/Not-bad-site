/**
 * JSON helpers: strict parsing with line/column error reporting, formatting,
 * key sorting and flattening (for CSV export). Pure — runs in workers & tests.
 */
import { UserError } from '../../../utils/errors';

export interface JsonErrorInfo {
  message: string;
  line?: number;
  column?: number;
}

export function locate(text: string, pos: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  }
  return { line, column: pos - last };
}

/**
 * Find the offset of the first syntax error with a strict JSON scanner.
 * Needed because recent V8 versions no longer include a position in
 * JSON.parse error messages. Returns -1 if the text is valid.
 */
export function findJsonErrorOffset(text: string): { pos: number; reason: string } {
  let i = 0;
  const n = text.length;
  const ws = () => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const fail = (reason: string): never => {
    throw { pos: i, reason };
  };
  const str = () => {
    i++; // opening quote
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) return void i++;
      if (c < 0x20) fail('Unescaped control character in string');
      if (c === 92) {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail('Invalid \\u escape');
          i += 6;
        } else if (e !== undefined && '"\\/bfnrt'.includes(e)) i += 2;
        else fail('Invalid escape sequence');
      } else i++;
    }
    fail('Unterminated string');
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      ws();
      if (text[i] === '}') return void i++;
      for (;;) {
        ws();
        if (text[i] !== '"') fail('Expected a double-quoted property name');
        str();
        ws();
        if (text[i] !== ':') fail('Expected ":" after property name');
        i++;
        value();
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') return void i++;
        fail('Expected "," or "}"');
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (text[i] === ']') return void i++;
      for (;;) {
        value();
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') return void i++;
        fail('Expected "," or "]"');
      }
    }
    if (c === '"') return str();
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (m && m[0].length) return void (i += m[0].length);
    for (const lit of ['true', 'false', 'null']) if (text.startsWith(lit, i)) return void (i += lit.length);
    fail(i >= n ? 'Unexpected end of input' : `Unexpected character ${JSON.stringify(c)}`);
  };
  try {
    value();
    ws();
    if (i < n) fail('Unexpected data after the JSON value');
    return { pos: -1, reason: '' };
  } catch (e) {
    if (e && typeof e === 'object' && 'pos' in e) return e as { pos: number; reason: string };
    throw e;
  }
}

export function jsonError(text: string, e: unknown): JsonErrorInfo {
  const msg = (e as Error).message ?? String(e);
  const scan = findJsonErrorOffset(text);
  if (scan.pos >= 0) return { message: scan.reason, ...locate(text, scan.pos) };
  const lc = /line (\d+) column (\d+)/i.exec(msg);
  if (lc) return { message: msg, line: Number(lc[1]), column: Number(lc[2]) };
  const p = /position (\d+)/i.exec(msg);
  if (p) return { message: msg, ...locate(text, Number(p[1])) };
  return { message: msg };
}

export function parseJson(text: string): unknown {
  const t = text.replace(/^\uFEFF/, '');
  if (!t.trim()) throw new UserError('The input is empty.');
  try {
    return JSON.parse(t);
  } catch (e) {
    const info = jsonError(t, e);
    throw new UserError(
      info.line ? `Invalid JSON at line ${info.line}, column ${info.column}.` : 'Invalid JSON.',
      info.message,
    );
  }
}

export function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v as object).sort((a, b) => a.localeCompare(b)).map((k) => [k, sortKeysDeep((v as Record<string, unknown>)[k])]));
  }
  return v;
}

export function formatJson(text: string, opts: { indent: number | '\t'; sortKeys?: boolean; minify?: boolean }): string {
  let v = parseJson(text);
  if (opts.sortKeys) v = sortKeysDeep(v);
  return opts.minify ? JSON.stringify(v) : JSON.stringify(v, null, opts.indent);
}

/** Flatten nested objects into dot-notation keys; arrays of primitives are joined. */
export function flatten(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') {
    out[prefix || 'value'] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    if (obj.every((x) => x === null || typeof x !== 'object')) {
      out[prefix || 'value'] = obj.join('; ');
      return out;
    }
    obj.forEach((x, i) => flatten(x, prefix ? `${prefix}.${i}` : String(i), out));
    return out;
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (!entries.length && prefix) out[prefix] = '';
  for (const [k, v] of entries) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** Turn parsed JSON into rows for CSV: array of objects, single object, or array of arrays. */
export function jsonToRows(data: unknown, doFlatten = true): { fields: string[]; rows: unknown[][] } {
  let list: unknown[];
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    // { "items": [...] } — use the first array property if it is the only meaningful content.
    const arrays = Object.values(data as Record<string, unknown>).filter(Array.isArray);
    list = arrays.length === 1 && Object.keys(data as object).length === 1 ? (arrays[0] as unknown[]) : [data];
  } else throw new UserError('JSON → CSV needs an array of objects (or an object).', 'Example: [{"name":"Ann","age":31},{"name":"Bob","age":27}]');
  if (!list.length) throw new UserError('The JSON array is empty.');
  if (list.every(Array.isArray)) {
    const [head, ...rest] = list as unknown[][];
    const isHeader = head.every((x) => typeof x === 'string');
    return isHeader ? { fields: head as string[], rows: rest } : { fields: head.map((_, i) => `column${i + 1}`), rows: list as unknown[][] };
  }
  const objs = list.map((x) => (doFlatten ? flatten(x) : x !== null && typeof x === 'object' ? (x as Record<string, unknown>) : { value: x }));
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const o of objs) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); fields.push(k); }
  const rows = objs.map((o) => fields.map((f) => {
    const v = (o as Record<string, unknown>)[f];
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
  }));
  return { fields, rows };
}

/* ---------------- syntax highlighting tokenizer ---------------- */

export type TokType = 'key' | 'str' | 'num' | 'bool' | 'null' | 'punc' | 'ws';
const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],:])|(\s+)/g;

/** Tokenize already-valid (formatted) JSON for highlighting. */
export function tokenizeJson(text: string): [TokType, string][] {
  const out: [TokType, string][] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m.index! > last) out.push(['punc', text.slice(last, m.index)]);
    if (m[1]) {
      out.push([m[2] ? 'key' : 'str', m[1]]);
      if (m[2]) out.push(['punc', m[2]]);
    } else if (m[3]) out.push(['num', m[3]]);
    else if (m[4]) out.push(['bool', m[4]]);
    else if (m[5]) out.push(['null', m[5]]);
    else if (m[6]) out.push(['punc', m[6]]);
    else out.push(['ws', m[7]]);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(['punc', text.slice(last)]);
  return out;
}
