/**
 * The Tool Catalog: plain metadata for every tool, grouped by category.
 * To add a tool, append a ToolMeta entry to the matching category catalog
 * and create the component module referenced by `component`.
 */
import type { ToolMeta } from './types.ts';
import { imageTools } from './image/catalog.ts';
import { pdfTools } from './pdf/catalog.ts';
import { fileTools } from './files/catalog.ts';
import { dataTools } from './data/catalog.ts';
import { textTools } from './text/catalog.ts';
import { archiveTools } from './archive/catalog.ts';
import { audioTools } from './audio/catalog.ts';
import { developerTools } from './developer/catalog.ts';

export { CATEGORIES, categoryById } from './categories.ts';

export const TOOLS: ToolMeta[] = [
  ...imageTools,
  ...pdfTools,
  ...fileTools,
  ...dataTools,
  ...textTools,
  ...archiveTools,
  ...audioTools,
  ...developerTools,
];

const byId = new Map(TOOLS.map((t) => [t.id, t]));
if (byId.size !== TOOLS.length) {
  throw new Error('Duplicate tool id in catalog');
}

export const toolById = (id: string): ToolMeta | undefined => byId.get(id);

/** Main tools (no preset variants) — used in grids. */
export const primaryTools = (): ToolMeta[] => TOOLS.filter((t) => !t.variantOf);

export const toolsInCategory = (cat: string, includeVariants = false): ToolMeta[] =>
  TOOLS.filter((t) => t.category === cat && (includeVariants || !t.variantOf));

export const popularTools = (): ToolMeta[] => TOOLS.filter((t) => t.popular);

/** Does a tool accept a file with this extension? */
export const toolAccepts = (tool: ToolMeta, ext: string): boolean =>
  tool.supportedFormats.includes('*') || tool.supportedFormats.includes(ext.toLowerCase());
