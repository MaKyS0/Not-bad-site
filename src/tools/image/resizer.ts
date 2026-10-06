import { h } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { createBatch } from '../../components/batch';
import { slider, field, numberInput, checkbox, segmented, select } from '../../components/ui';
import { processImage, decodeImage, isSvg } from '../../services/imageService';
import { formatSelect, outputTypeFor, outputName, type FormatChoice } from './shared';

type Mode = 'pixels' | 'percent';
type Fit = 'fit' | 'exact';

interface Settings {
  mode: Mode;
  width: number;
  height: number;
  lock: boolean;
  percent: number;
  fit: Fit;
  noUpscale: boolean;
  format: FormatChoice;
  quality: number;
}

/** Compute the target size for an image of w×h. Exported for tests. */
export function targetSize(w: number, h: number, s: Pick<Settings, 'mode' | 'width' | 'height' | 'lock' | 'percent' | 'fit' | 'noUpscale'>): { width: number; height: number } {
  let tw: number;
  let th: number;
  if (s.mode === 'percent') {
    tw = (w * s.percent) / 100;
    th = (h * s.percent) / 100;
  } else if (s.lock) {
    const bw = s.width > 0 ? s.width : Infinity;
    const bh = s.height > 0 ? s.height : Infinity;
    if (!Number.isFinite(bw) && !Number.isFinite(bh)) return { width: w, height: h };
    const scale = s.fit === 'fit' ? Math.min(bw / w, bh / h) : Number.isFinite(bw) ? bw / w : bh / h;
    tw = w * scale;
    th = h * scale;
  } else {
    tw = s.width > 0 ? s.width : w;
    th = s.height > 0 ? s.height : h;
  }
  if (s.noUpscale && (tw > w || th > h)) {
    const k = Math.min(w / tw, h / th, 1);
    tw *= k;
    th *= k;
  }
  return { width: Math.max(1, Math.round(tw)), height: Math.max(1, Math.round(th)) };
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const preset = ctx.preset as { format?: FormatChoice };
  const s = await ctx.loadSettings<Settings>({ mode: 'pixels', width: 1280, height: 0, lock: true, percent: 50, fit: 'fit', noUpscale: true, format: preset.format ?? 'keep', quality: 90 });
  if (preset.format) s.format = preset.format;
  const save = () => {
    ctx.saveSettings(s);
    batch.invalidate();
  };
  let firstSize: { width: number; height: number } | null = null;

  const mode = segmented<Mode>('Resize by', [{ value: 'pixels', label: 'Pixels' }, { value: 'percent', label: 'Percentage' }], s.mode, (v) => { s.mode = v; save(); sync(); });
  const wIn = numberInput(s.width, { min: 0, max: 16384, onInput: (v) => { s.width = Math.max(0, Math.round(v)); linkFrom('w'); save(); preview(); } });
  const hIn = numberInput(s.height, { min: 0, max: 16384, onInput: (v) => { s.height = Math.max(0, Math.round(v)); linkFrom('h'); save(); preview(); } });
  const lock = checkbox('Lock aspect ratio', s.lock, (v) => { s.lock = v; save(); sync(); });
  const fitSel = field('When both are set', select<Fit>([{ value: 'fit', label: 'Fit inside width × height' }, { value: 'exact', label: 'Use width, height follows' }], s.fit, (v) => { s.fit = v; save(); preview(); }));
  const pct = slider('Scale', s.percent, { min: 1, max: 400, format: (v) => `${v}%`, onInput: (v) => { s.percent = v; save(); preview(); } });
  const noUp = checkbox('Never enlarge smaller images', s.noUpscale, (v) => { s.noUpscale = v; save(); preview(); });
  const quality = slider('Quality (JPG/WebP)', s.quality, { min: 1, max: 100, format: (v) => `${v}%`, onInput: (v) => { s.quality = v; save(); } });
  const info = h('p', { class: 'hint', 'aria-live': 'polite' }, 'Leave width or height at 0 to calculate it automatically.');
  const pxBox = h('div', { class: 'field' }, h('div', { class: 'two-col' }, field('Width (px)', wIn), field('Height (px)', hIn)), lock.el, fitSel);

  function linkFrom(which: 'w' | 'h') {
    // With a locked ratio and a known first image, keep the other field in sync for clarity.
    if (!s.lock || !firstSize || s.fit === 'fit') return;
    if (which === 'w' && s.width) {
      s.height = 0;
      hIn.value = '0';
    } else if (which === 'h' && s.height) {
      s.width = 0;
      wIn.value = '0';
    }
  }

  function preview() {
    if (!firstSize) return;
    const t = targetSize(firstSize.width, firstSize.height, s);
    info.textContent = `First image: ${firstSize.width}×${firstSize.height} → ${t.width}×${t.height} px`;
  }

  function sync() {
    pxBox.hidden = s.mode !== 'pixels';
    pct.el.hidden = s.mode !== 'percent';
    fitSel.hidden = !s.lock;
    preview();
  }

  const batch = createBatch({
    ctx,
    accept: ctx.meta.supportedFormats,
    actionLabel: 'Resize',
    zipName: 'resized-images.zip',
    concurrency: 3,
    onFilesChange: async (items) => {
      const first = items[0];
      if (!first) {
        firstSize = null;
        return;
      }
      try {
        const d = await decodeImage(first.file);
        firstSize = { width: d.width, height: d.height };
        d.close();
        preview();
      } catch {
        firstSize = null;
      }
    },
    process: async (file, onProgress, signal) => {
      const svg = await isSvg(file);
      const d = await decodeImage(file);
      const size = { width: d.width, height: d.height };
      d.close();
      const t = targetSize(size.width, size.height, s);
      const type = outputTypeFor(file, s.format);
      const res = await processImage(file, { resize: t, output: { type, quality: s.quality / 100 } }, { onProgress, signal, svgWidth: svg ? t.width : undefined });
      return { name: outputName(file, type, `-${res.width}x${res.height}`), blob: res.blob, width: res.width, height: res.height };
    },
  });

  root.append(
    h('div', { class: 'tool-layout' },
      h('aside', { class: 'tool-options panel', 'aria-label': 'Resize options' }, mode.el, pxBox, pct.el, noUp.el, info, formatSelect(s.format, (v) => { s.format = v; save(); }), quality.el),
      h('div', { class: 'tool-main' }, batch.el),
    ),
  );
  sync();
};
