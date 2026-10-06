import { h } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { createBatch } from '../../components/batch';
import { slider, field, numberInput, notice, checkbox } from '../../components/ui';
import { processImage, isSvg, prepareSvg } from '../../services/imageService';
import { colorField, formatSelect, outputName, type FormatChoice } from './shared';
import type { OutputType } from '../../utils/imageCore';
import { canonicalExt } from '../../utils/fileType';
import { extOf } from '../../utils/format';

interface Settings {
  to: Exclude<FormatChoice, 'keep'>;
  quality: number;
  background: string;
  fillTransparent: boolean;
  svgWidth: number;
  svgUseOriginal: boolean;
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const preset = ctx.preset as { to?: Settings['to'] };
  const s = await ctx.loadSettings<Settings>({ to: preset.to ?? 'webp', quality: 85, background: '#ffffff', fillTransparent: false, svgWidth: 1024, svgUseOriginal: true });
  if (preset.to) s.to = preset.to;
  const save = () => {
    ctx.saveSettings(s);
    batch.invalidate();
  };

  const quality = slider('Quality', s.quality, { min: 1, max: 100, format: (v) => `${v}%`, onInput: (v) => { s.quality = v; save(); } });
  const bgField = colorField('Background for transparent areas', s.background, (v) => { s.background = v; save(); });
  const fill = checkbox('Fill transparency with a colour', s.fillTransparent, (v) => { s.fillTransparent = v; save(); sync(); });
  const svgW = numberInput(s.svgWidth, { min: 1, max: 16384, onInput: (v) => { s.svgWidth = Math.round(v); save(); } });
  const svgOrig = checkbox('Use the SVG’s own size', s.svgUseOriginal, (v) => { s.svgUseOriginal = v; save(); sync(); });
  const svgWField = field('Output width for SVG (px)', svgW, 'SVG is vector: render it at any size without blur.');
  const svgBox = h('div', { class: 'field', hidden: true }, h('span', { class: 'field-label' }, 'SVG input'), svgOrig.el, svgWField);
  const jpgNote = notice('info', 'JPG has no transparency — transparent pixels are filled with the background colour.');
  const gifNote = notice('warn', 'Animated GIFs: only the first frame is converted.');
  gifNote.hidden = true;

  const sync = () => {
    quality.el.hidden = s.to === 'png';
    jpgNote.hidden = s.to !== 'jpeg';
    fill.el.hidden = s.to === 'jpeg';
    bgField.hidden = !(s.to === 'jpeg' || s.fillTransparent);
    svgWField.hidden = s.svgUseOriginal;
  };

  const batch = createBatch({
    ctx,
    accept: ctx.meta.supportedFormats,
    actionLabel: 'Convert',
    zipName: `converted-to-${s.to}.zip`,
    concurrency: 3,
    showSaving: true,
    onFilesChange: async (items) => {
      gifNote.hidden = !items.some((i) => canonicalExt(extOf(i.file.name)) === 'gif');
      const anySvg = (await Promise.all(items.slice(0, 50).map((i) => isSvg(i.file)))).some(Boolean);
      svgBox.hidden = !anySvg;
    },
    process: async (file, onProgress, signal) => {
      const type = `image/${s.to}` as OutputType;
      const svg = await isSvg(file);
      let svgWidth: number | undefined;
      if (svg && !s.svgUseOriginal) svgWidth = s.svgWidth;
      else if (svg) svgWidth = Math.round((await prepareSvg(file)).info.width);
      const res = await processImage(
        file,
        { output: { type, quality: s.quality / 100, background: type === 'image/jpeg' || s.fillTransparent ? s.background : undefined } },
        { onProgress, signal, svgWidth },
      );
      return { name: outputName(file, type), blob: res.blob, width: res.width, height: res.height, note: res.encoder === 'wasm' ? 'WebP via WASM encoder' : undefined };
    },
  });

  root.append(
    h('div', { class: 'tool-layout' },
      h('aside', { class: 'tool-options panel', 'aria-label': 'Conversion options' },
        formatSelect(s.to, (v) => { s.to = v as Settings['to']; save(); sync(); }, false),
        quality.el,
        jpgNote,
        fill.el,
        bgField,
        svgBox,
        gifNote,
      ),
      h('div', { class: 'tool-main' }, batch.el),
    ),
  );
  sync();
};
