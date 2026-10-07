import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { createBatch, type BatchItem } from '../../components/batch';
import { slider, checkbox, field, numberInput, notice, segmented } from '../../components/ui';
import { compareView } from '../../components/compare';
import { processImage } from '../../services/imageService';
import { formatSelect, outputTypeFor, outputName, qualityToColors, type FormatChoice } from './shared';
import { formatBytes, formatPercent, percentChange } from '../../utils/format';
import type { ImageJob } from '../../utils/imageCore';
import { t } from '../../i18n/i18n';

interface Settings {
  format: FormatChoice;
  quality: number;
  pngMode: 'lossy' | 'lossless';
  limit: boolean;
  maxSide: number;
  keepSmaller: boolean;
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const preset = ctx.preset as { format?: FormatChoice };
  const s = await ctx.loadSettings<Settings>({ format: preset.format ?? 'keep', quality: 75, pngMode: 'lossy', limit: false, maxSide: 2560, keepSmaller: true });
  if (preset.format) s.format = preset.format;
  const save = () => {
    ctx.saveSettings(s);
    batch.invalidate();
  };

  const quality = slider(t('Quality'), s.quality, { min: 1, max: 100, format: (v) => `${v}%`, onInput: (v) => { s.quality = v; save(); } });
  const pngMode = segmented<'lossy' | 'lossless'>(t('PNG compression'), [
    { value: 'lossy', label: t('Smaller (lossy)') },
    { value: 'lossless', label: t('Lossless') },
  ], s.pngMode, (v) => { s.pngMode = v; save(); syncVisibility(); });
  const maxInput = numberInput(s.maxSide, { min: 16, max: 16384, onInput: (v) => { s.maxSide = Math.round(v); save(); } });
  const maxField = field(t('Max width/height (px)'), maxInput);
  const limit = checkbox(t('Also limit dimensions'), s.limit, (v) => { s.limit = v; save(); syncVisibility(); });
  const keep = checkbox(t('Keep original if the result is larger'), s.keepSmaller, (v) => { s.keepSmaller = v; save(); });
  const pngHint = notice('info', t('PNG is lossless by nature. “Smaller” reduces the colour palette (like TinyPNG); the quality slider controls how many colours are kept.'));

  const syncVisibility = () => {
    const pngOut = s.format === 'png';
    pngMode.el.hidden = !(pngOut || s.format === 'keep');
    pngHint.hidden = !(pngOut || s.format === 'keep');
    maxField.hidden = !s.limit;
  };

  const preview = h('div', { class: 'tool-preview', 'aria-live': 'polite' });
  let previewItem: BatchItem | null = null;
  const urls: string[] = [];
  const showPreview = async (it: BatchItem) => {
    if (!it.result) return;
    previewItem = it;
    urls.splice(0).forEach((u) => ctx.revokeUrl(u));
    const before = await ctx.imageUrl(it.file);
    const after = ctx.objectUrl(it.result.blob);
    urls.push(before, after);
    const pct = percentChange(it.file.size, it.result.blob.size);
    render(
      preview,
      h('div', { class: 'panel' },
        h('h2', { class: 'panel-title' }, t('Preview:'), ' ', h('span', { class: 'break' }, it.file.name)),
        compareView(before, after, [`${t('Original')} · ${formatBytes(it.file.size)}`, `${t('Result')} · ${formatBytes(it.result.blob.size)}`]),
        h('p', { class: 'small muted', style: 'margin:8px 0 0' }, t('Drag the slider to compare.'), ' ', pct <= 0 ? h('strong', { class: 'saving' }, t('{pct} smaller', { pct: formatPercent(pct) })) : h('strong', { class: 'growing' }, t('{pct} larger', { pct: formatPercent(pct) }))),
      ),
    );
  };

  const process = async (file: File, onProgress: (f: number) => void, signal: AbortSignal) => {
    const type = outputTypeFor(file, s.format);
    const job: ImageJob = {
      output: {
        type,
        quality: s.quality / 100,
        pngColors: type === 'image/png' && s.pngMode === 'lossy' ? qualityToColors(s.quality) : 0,
      },
    };
    if (s.limit) {
      const { getImageSize } = await import('../../services/imageService');
      const { width, height } = await getImageSize(file);
      const scale = Math.min(1, s.maxSide / Math.max(width, height));
      if (scale < 1) job.resize = { width: Math.round(width * scale), height: Math.round(height * scale) };
    }
    const res = await processImage(file, job, { onProgress, signal });
    const sameType = file.type === type || (file.type === '' && type === 'image/png');
    if (s.keepSmaller && sameType && !job.resize && res.blob.size >= file.size) {
      return { name: file.name, blob: file, width: res.width, height: res.height, note: t('original kept (already optimal)') };
    }
    return { name: outputName(file, type), blob: res.blob, width: res.width, height: res.height, note: res.encoder === 'wasm' ? t('WebP via WASM encoder') : undefined };
  };

  const batch = createBatch({
    ctx,
    accept: ctx.meta.supportedFormats,
    process,
    actionLabel: t('Compress'),
    zipName: 'compressed-images.zip',
    showSaving: true,
    concurrency: 3,
    onResult: (it) => { if (!previewItem || previewItem === it || !previewItem.result) showPreview(it); },
    onSelect: showPreview,
    onFilesChange: (items) => {
      if (!items.length) { previewItem = null; render(preview); }
    },
  });

  root.append(
    h('div', { class: 'tool-layout' },
      h('aside', { class: 'tool-options panel', 'aria-label': t('Compression options') },
        formatSelect(s.format, (v) => { s.format = v; save(); syncVisibility(); }),
        quality.el,
        pngMode.el,
        pngHint,
        limit.el,
        maxField,
        keep.el,
      ),
      h('div', { class: 'tool-main' }, batch.el, preview),
    ),
  );
  syncVisibility();
};
