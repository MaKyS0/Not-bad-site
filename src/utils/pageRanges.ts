/**
 * Page range parsing: "1-3, 5, 8-" → groups of 1-based page numbers.
 */
import { UserError } from './errors';

/** Parse into groups (each comma-separated part is one group). Pages are 1-based. */
export function parseRangeGroups(input: string, pageCount: number): number[][] {
  const parts = input
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) throw new UserError('Enter at least one page or range, e.g. “1-3, 5”.');
  return parts.map((part) => {
    const m = /^(\d+)?\s*(?:(-|–|—|\.\.)\s*(\d+)?)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new UserError(`“${part}” is not a valid page or range.`, 'Use numbers like 3, ranges like 2-6, or open ranges like 5- (to the end).');
    const start = m[1] ? parseInt(m[1], 10) : 1;
    const end = m[2] ? (m[3] ? parseInt(m[3], 10) : pageCount) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new UserError(`Page range “${part}” is outside the document (1–${pageCount}).`);
    }
    const out: number[] = [];
    if (start <= end) for (let i = start; i <= end; i++) out.push(i);
    else for (let i = start; i >= end; i--) out.push(i); // reversed ranges like 5-2 are allowed
    return out;
  });
}

/** Flat, de-duplicated list in the order given. */
export function parsePageList(input: string, pageCount: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const g of parseRangeGroups(input, pageCount)) for (const p of g) if (!seen.has(p)) { seen.add(p); out.push(p); }
  return out;
}

/** Compact a sorted list of pages back into a range string: [1,2,3,5] → "1-3, 5" */
export function formatPageList(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i];
    parts.push(start === end ? `${start}` : `${start}-${end}`);
  }
  return parts.join(', ');
}

/** Split 1..n into chunks of `size`. */
export function chunkPages(pageCount: number, size: number): number[][] {
  const groups: number[][] = [];
  const s = Math.max(1, Math.floor(size));
  for (let i = 1; i <= pageCount; i += s) {
    const g: number[] = [];
    for (let p = i; p < i + s && p <= pageCount; p++) g.push(p);
    groups.push(g);
  }
  return groups;
}
