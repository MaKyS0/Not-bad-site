/**
 * Client-side tool search. Scores tools by how well every query token matches
 * name, formats, keywords, category and description. No server involved.
 */
import type { ToolMeta } from '../tools/types';
import { TOOLS, categoryById } from '../tools/catalog';

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/jpeg/g, 'jpg')
    .replace(/[→>]/g, ' to ');

const tokenize = (s: string): string[] => norm(s).split(/[^a-z0-9+#]+/).filter(Boolean);

interface Indexed {
  tool: ToolMeta;
  name: string;
  nameTokens: string[];
  formats: string[];
  keywords: string;
  rest: string;
}

let index: Indexed[] | null = null;

function build(): Indexed[] {
  return TOOLS.map((tool) => ({
    tool,
    name: norm(tool.name),
    nameTokens: tokenize(tool.name),
    formats: tool.supportedFormats.map(norm),
    keywords: norm((tool.keywords ?? []).join(' ')),
    rest: norm(`${tool.description} ${categoryById(tool.category)?.name ?? ''} ${tool.id.replace(/-/g, ' ')}`),
  }));
}

function scoreToken(e: Indexed, t: string): number {
  let s = 0;
  if (e.nameTokens.includes(t)) s += 10;
  else if (e.nameTokens.some((n) => n.startsWith(t))) s += 7;
  else if (e.name.includes(t)) s += 5;
  if (e.formats.includes(t)) s += 4;
  if (e.keywords.includes(t)) s += 3;
  if (e.rest.includes(t)) s += 1;
  return s;
}

export function searchTools(query: string, limit = 20): ToolMeta[] {
  const tokens = tokenize(query).filter((t) => t !== 'to' || tokenize(query).length === 1);
  if (!tokens.length) return [];
  index ??= build();
  const q = norm(query).trim();
  const results: { tool: ToolMeta; score: number }[] = [];
  for (const e of index) {
    let total = 0;
    let all = true;
    for (const t of tokens) {
      const s = scoreToken(e, t);
      if (s === 0) {
        all = false;
        break;
      }
      total += s;
    }
    if (!all) continue;
    if (e.name === q) total += 20;
    else if (e.name.startsWith(q)) total += 8;
    if (!e.tool.variantOf) total += 1;
    if (e.tool.popular) total += 0.5;
    results.push({ tool: e.tool, score: total });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.tool);
}
