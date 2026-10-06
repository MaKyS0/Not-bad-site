/**
 * Helpers shared by the image tools.
 */
import { h } from '../../utils/dom';
import { field, select } from '../../components/ui';
import type { OutputType } from '../../utils/imageCore';
import { baseName, extOf } from '../../utils/format';
import { canonicalExt } from '../../utils/fileType';

export type FormatChoice = 'keep' | 'jpeg' | 'png' | 'webp';

export const FORMAT_OPTIONS: { value: FormatChoice; label: string }[] = [
  { value: 'keep', label: 'Same as input' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

/** Resolve the output MIME type for an input file. Non-web formats become PNG. */
export function outputTypeFor(file: File, choice: FormatChoice): OutputType {
  if (choice !== 'keep') return `image/${choice}` as OutputType;
  const ext = canonicalExt(extOf(file.name));
  if (ext === 'jpg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

export const extForType = (t: OutputType): string => (t === 'image/jpeg' ? 'jpg' : t.split('/')[1]);

export function outputName(file: File, type: OutputType, suffix = ''): string {
  return `${baseName(file.name)}${suffix}.${extForType(type)}`;
}

export function formatSelect(value: FormatChoice, onChange: (v: FormatChoice) => void, includeKeep = true): HTMLElement {
  return field('Output format', select(includeKeep ? FORMAT_OPTIONS : FORMAT_OPTIONS.filter((o) => o.value !== 'keep'), value, onChange));
}

export function colorField(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const input = h('input', { type: 'color', class: 'input', value });
  input.addEventListener('input', () => onInput(input.value));
  return field(label, input);
}

/** Map a 1–100 quality to a PNG palette size (lossy PNG). */
export const qualityToColors = (q: number): number => Math.max(2, Math.min(256, Math.round(2 + (q / 100) ** 2 * 254)));
