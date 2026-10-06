/**
 * Suggest tools for a set of files based on their (canonical) extensions.
 */
import { TOOLS, toolAccepts } from '../tools/catalog';
import type { ToolMeta } from '../tools/types';
import { canonicalExt } from '../utils/fileType';
import { extOf } from '../utils/format';

const PRIORITY: Record<string, string[]> = {
  pdfMulti: ['pdf-merge'],
  pdf: ['pdf-split', 'pdf-to-images', 'pdf-extract-pages', 'pdf-rotate', 'pdf-info'],
  imageMulti: ['image-compressor', 'image-converter', 'image-resizer', 'images-to-pdf'],
  image: ['image-compressor', 'image-converter', 'image-resizer', 'image-cropper'],
  zip: ['unzip', 'zip'],
};

export function suggestTools(files: File[], limit = 12): ToolMeta[] {
  if (!files.length) return [];
  const exts = [...new Set(files.map((f) => canonicalExt(extOf(f.name)) || (f.type.split('/')[1] ?? '')))];
  const multi = files.length > 1;
  const candidates = TOOLS.filter((t) => {
    if (!t.supportedFormats.length) return false;
    if (multi && !t.batch) return false;
    // Variants are only suggested when they exactly match a single input type.
    if (t.variantOf && (exts.length !== 1 || t.supportedFormats.includes('*'))) return false;
    return exts.every((e) => toolAccepts(t, e) || (e === 'jpg' && toolAccepts(t, 'jpeg')));
  });
  const allImages = exts.every((e) => ['png', 'jpg', 'webp', 'gif', 'bmp', 'svg', 'ico', 'avif'].includes(e));
  const allPdf = exts.length === 1 && exts[0] === 'pdf';
  const preferred = allPdf ? PRIORITY[multi ? 'pdfMulti' : 'pdf'] : allImages ? PRIORITY[multi ? 'imageMulti' : 'image'] : exts.includes('zip') ? PRIORITY.zip : [];
  const score = (t: ToolMeta): number => {
    let s = 0;
    const p = preferred.indexOf(t.id);
    if (p >= 0) s += 100 - p;
    if (!t.supportedFormats.includes('*')) s += 10;
    if (t.popular) s += 3;
    if (t.variantOf) s += 1;
    return s;
  };
  return candidates.sort((a, b) => score(b) - score(a)).slice(0, limit);
}
