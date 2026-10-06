/**
 * Pure text utilities (Unicode aware). No DOM — unit tested in Node.
 */

type Segmenter = { segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }> };
const SegmenterCtor = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => Segmenter }).Segmenter;

/** Split into user-perceived characters (grapheme clusters). */
export function graphemes(s: string): string[] {
  if (SegmenterCtor) return Array.from(new SegmenterCtor(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  return Array.from(s);
}

export function words(s: string): string[] {
  if (SegmenterCtor) {
    const out: string[] = [];
    for (const seg of new SegmenterCtor(undefined, { granularity: 'word' }).segment(s)) if (seg.isWordLike) out.push(seg.segment);
    return out;
  }
  return s.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? [];
}

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  uniqueWords: number;
  lines: number;
  nonEmptyLines: number;
  sentences: number;
  paragraphs: number;
  bytesUtf8: number;
  readingMinutes: number;
  speakingMinutes: number;
  topWords: [string, number][];
}

export function textStats(s: string): TextStats {
  const g = graphemes(s);
  const w = words(s);
  const lower = w.map((x) => x.toLocaleLowerCase());
  const freq = new Map<string, number>();
  for (const x of lower) freq.set(x, (freq.get(x) ?? 0) + 1);
  const lines = s === '' ? 0 : s.split(/\r\n|\r|\n/).length;
  const nonEmptyLines = s === '' ? 0 : s.split(/\r\n|\r|\n/).filter((l) => l.trim()).length;
  const sentences = s.trim() ? (s.match(/[^.!?…。！？]+(?:[.!?…。！？]+|$)/gu) ?? []).filter((x) => /[\p{L}\p{N}]/u.test(x)).length : 0;
  const paragraphs = s.trim() ? s.split(/(?:\r?\n\s*){2,}/).filter((p) => p.trim()).length : 0;
  return {
    characters: g.length,
    charactersNoSpaces: g.filter((c) => !/^\s+$/u.test(c)).length,
    words: w.length,
    uniqueWords: freq.size,
    lines,
    nonEmptyLines,
    sentences,
    paragraphs,
    bytesUtf8: new TextEncoder().encode(s).length,
    readingMinutes: w.length / 238,
    speakingMinutes: w.length / 150,
    topWords: [...freq.entries()].filter(([k]) => k.length > 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10),
  };
}

/* ---------------- case conversion ---------------- */

/** Split identifiers / phrases into words: "helloWorld foo_bar" → [hello, World, foo, bar] */
export function splitWords(s: string): string[] {
  return s
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const cap = (w: string): string => (w ? w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase() : w);

const perLine = (s: string, fn: (line: string) => string): string => s.split(/(\r\n|\r|\n)/).map((part, i) => (i % 2 ? part : fn(part))).join('');

export const caseOps = {
  upper: (s: string) => s.toLocaleUpperCase(),
  lower: (s: string) => s.toLocaleLowerCase(),
  title: (s: string) => s.toLocaleLowerCase().replace(/(^|[\s\-–—("'“‘/])(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase()),
  sentence: (s: string) => s.toLocaleLowerCase().replace(/(^\s*|[.!?…]\s+)(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase()),
  camel: (s: string) => perLine(s, (l) => splitWords(l).map((w, i) => (i ? cap(w) : w.toLocaleLowerCase())).join('')),
  pascal: (s: string) => perLine(s, (l) => splitWords(l).map(cap).join('')),
  snake: (s: string) => perLine(s, (l) => splitWords(l).map((w) => w.toLocaleLowerCase()).join('_')),
  constant: (s: string) => perLine(s, (l) => splitWords(l).map((w) => w.toLocaleUpperCase()).join('_')),
  kebab: (s: string) => perLine(s, (l) => splitWords(l).map((w) => w.toLocaleLowerCase()).join('-')),
  dot: (s: string) => perLine(s, (l) => splitWords(l).map((w) => w.toLocaleLowerCase()).join('.')),
  inverse: (s: string) => Array.from(s, (c) => (c === c.toLocaleUpperCase() ? c.toLocaleLowerCase() : c.toLocaleUpperCase())).join(''),
  alternating: (s: string) => {
    let i = 0;
    return Array.from(s, (c) => (/\p{L}/u.test(c) ? (i++ % 2 ? c.toLocaleUpperCase() : c.toLocaleLowerCase()) : c)).join('');
  },
};

/* ---------------- line operations ---------------- */

export const splitLines = (s: string): string[] => s.split(/\r\n|\r|\n/);

export interface DedupeOptions {
  ignoreCase?: boolean;
  trim?: boolean;
  removeEmpty?: boolean;
}

export function dedupeLines(s: string, o: DedupeOptions = {}): { text: string; removed: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const line of splitLines(s)) {
    const v = o.trim ? line.trim() : line;
    if (o.removeEmpty && !v.trim()) {
      removed++;
      continue;
    }
    const key = o.ignoreCase ? v.toLocaleLowerCase() : v;
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(v);
  }
  return { text: out.join('\n'), removed };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortLines(s: string, mode: 'asc' | 'desc' | 'natural' | 'length' | 'shuffle' | 'reverse', ignoreCase = true): string {
  const lines = splitLines(s);
  switch (mode) {
    case 'asc':
      return lines.sort((a, b) => (ignoreCase ? a.localeCompare(b, undefined, { sensitivity: 'base' }) : a < b ? -1 : a > b ? 1 : 0)).join('\n');
    case 'desc':
      return lines.sort((a, b) => (ignoreCase ? b.localeCompare(a, undefined, { sensitivity: 'base' }) : a < b ? 1 : a > b ? -1 : 0)).join('\n');
    case 'natural':
      return lines.sort(collator.compare).join('\n');
    case 'length':
      return lines.sort((a, b) => a.length - b.length || collator.compare(a, b)).join('\n');
    case 'reverse':
      return lines.reverse().join('\n');
    case 'shuffle': {
      const rnd = new Uint32Array(lines.length);
      crypto.getRandomValues(rnd);
      for (let i = lines.length - 1; i > 0; i--) {
        const j = rnd[i] % (i + 1);
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      return lines.join('\n');
    }
  }
}

export const reverseText = (s: string): string => graphemes(s).reverse().join('');
export const reverseWords = (s: string): string => perLine(s, (l) => l.split(/(\s+)/).reverse().join(''));

export interface TrimOptions {
  trimLines?: boolean;
  collapseSpaces?: boolean;
  removeEmptyLines?: boolean;
  removeLineBreaks?: boolean;
  tabsToSpaces?: boolean;
}

export function trimText(s: string, o: TrimOptions): string {
  let lines = splitLines(s);
  if (o.tabsToSpaces) lines = lines.map((l) => l.replace(/\t/g, '  '));
  if (o.collapseSpaces) lines = lines.map((l) => l.replace(/[ \t ]{2,}/g, ' '));
  if (o.trimLines) lines = lines.map((l) => l.trim());
  if (o.removeEmptyLines) lines = lines.filter((l) => l.trim() !== '');
  return o.removeLineBreaks ? lines.join(' ').replace(/ {2,}/g, ' ') : lines.join('\n');
}
