import type { ToolMeta } from './types.ts';

/** Extensions that duplicate another one in the list (jpeg = jpg …). */
const ALIASES = new Set(['jpeg', 'jpe', 'jfif', 'htm', 'tif', 'markdown', 'oga', 'opus', 'aac', 'log', 'text']);

/** Short format labels for a tool, e.g. ["JPG → WEBP"] or ["PDF"], "*.*" for any file. */
export function formatTags(tool: ToolMeta): string[] {
  const preset = tool.preset as { to?: string; from?: string[] } | undefined;
  if (preset?.to && preset.from?.length) return [`${preset.from[0].toUpperCase()} → ${(preset.to === 'jpeg' ? 'jpg' : preset.to).toUpperCase()}`];
  if (tool.supportedFormats.includes('*')) return ['*.*'];
  const exts = tool.supportedFormats.filter((e) => !ALIASES.has(e)).map((e) => e.toUpperCase());
  return exts.length > 3 ? [...exts.slice(0, 2), `+${exts.length - 2}`] : exts;
}

/** "JPG → WEBP" for preset converters, null for other tools. */
export function conversionLabel(tool: ToolMeta): string | null {
  const preset = tool.preset as { to?: string; from?: string[] } | undefined;
  return preset?.to && preset.from?.length ? formatTags(tool)[0] : null;
}

/** Tools listed under "Common tasks" on the home page, across categories. */
export const COMMON_TASKS = ['image-compressor', 'image-converter', 'pdf-merge', 'images-to-pdf', 'pdf-split', 'virus-scanner', 'json-formatter', 'csv-to-json', 'unzip', 'audio-to-text'];
