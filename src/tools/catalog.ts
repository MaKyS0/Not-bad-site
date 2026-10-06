/**
 * The Tool Catalog: plain metadata for every tool, grouped by category.
 * To add a tool, append a ToolMeta entry to the matching category catalog
 * and create the component module referenced by `component`.
 */
import type { ToolMeta } from './types';
import { imageTools } from './image/catalog';
import { pdfTools } from './pdf/catalog';
import { fileTools } from './files/catalog';
import { dataTools } from './data/catalog';
import { textTools } from './text/catalog';
import { archiveTools } from './archive/catalog';
import { audioTools } from './audio/catalog';
import { developerTools } from './developer/catalog';

export { CATEGORIES, categoryById } from './categories';

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
