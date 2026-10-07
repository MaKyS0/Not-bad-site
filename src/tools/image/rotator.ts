import { h } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { createBatch } from '../../components/batch';
import { segmented, checkbox, slider } from '../../components/ui';
import { processImage, isSvg, decodeImage } from '../../services/imageService';
import { formatSelect, outputTypeFor, outputName, type FormatChoice } from './shared';
import { icon } from '../../components/icons';
import { t } from '../../i18n/i18n';

interface Settings {
  rotate: '0' | '90' | '180' | '270';
  flipH: boolean;
  flipV: boolean;
  format: FormatChoice;
  quality: number;
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings<Settings>({ rotate: '90', flipH: false, flipV: false, format: 'keep', quality: 92 });
  const save = () => {
    ctx.saveSettings(s);
    batch.invalidate();
    drawPreview();
  };
  const rot = segmented<Settings['rotate']>(t('Rotate (clockwise)'), [
    { value: '0', label: '0°' }, { value: '90', label: '90°' }, { value: '180', label: '180°' }, { value: '270', label: '270°' },
  ], s.rotate, (v) => { s.rotate = v; save(); });
  const fh = checkbox(t('Flip horizontally (mirror)'), s.flipH, (v) => { s.flipH = v; save(); });
  const fv = checkbox(t('Flip vertically'), s.flipV, (v) => { s.flipV = v; save(); });
  const quality = slider(t('Quality (JPG/WebP)'), s.quality, { min: 1, max: 100, format: (v) => `${v}%`, onInput: (v) => { s.quality = v; save(); } });

  const previewImg = h('img', { alt: t('Preview of the first image with the current rotation'), style: 'max-height:240px;transition:transform .25s' });
  const previewBox = h('div', { class: 'preview-box', hidden: true, style: 'min-height:260px' }, previewImg);
  let previewUrl = '';
  function drawPreview() {
    const r = Number(s.rotate);
    previewImg.style.transform = `rotate(${r}deg) scale(${s.flipH ? -1 : 1}, ${s.flipV ? -1 : 1})`;
  }

  const batch = createBatch({
    ctx,
    accept: ctx.meta.supportedFormats,
    actionLabel: t('Rotate'),
    zipName: 'rotated-images.zip',
    concurrency: 3,
    onFilesChange: (items) => {
      if (previewUrl) ctx.revokeUrl(previewUrl);
      previewUrl = '';
      previewBox.hidden = !items.length;
      if (items[0]) {
        const file = items[0].file;
        void ctx.imageUrl(file).then((u) => {
          if (items[0]?.file !== file) return ctx.revokeUrl(u);
          previewUrl = u;
          previewImg.src = u;
          drawPreview();
        });
      }
    },
    process: async (file, onProgress, signal) => {
      const type = outputTypeFor(file, s.format);
      let svgWidth: number | undefined;
      if (await isSvg(file)) {
        const d = await decodeImage(file);
        svgWidth = d.width;
        d.close();
      }
      const res = await processImage(file, { rotate: Number(s.rotate) as 0 | 90 | 180 | 270, flipH: s.flipH, flipV: s.flipV, output: { type, quality: s.quality / 100 } }, { onProgress, signal, svgWidth });
      return { name: outputName(file, type, '-rotated'), blob: res.blob, width: res.width, height: res.height };
    },
  });

  root.append(
    h('div', { class: 'tool-layout' },
      h('aside', { class: 'tool-options panel', 'aria-label': t('Rotation options') },
        rot.el,
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, h('span', { style: 'display:inline-flex;gap:6px;align-items:center' }, icon('flipH'), t('Flip'))), fh.el, fv.el),
        previewBox,
        formatSelect(s.format, (v) => { s.format = v; save(); }),
        quality.el,
      ),
      h('div', { class: 'tool-main' }, batch.el),
    ),
  );
  drawPreview();
};
