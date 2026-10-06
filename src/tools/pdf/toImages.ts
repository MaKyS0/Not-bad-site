import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { button, field, progress, segmented, slider, textInput, errorPanel, notice } from '../../components/ui';
import { singlePdfTool } from './single';
import { renderPage } from './lib';
import { parsePageList } from '../../utils/pageRanges';
import { describeError, throwIfAborted } from '../../utils/errors';
import { downloadAll, downloadBlob } from '../../services/download';
import { baseName, formatBytes } from '../../utils/format';
import { canvasToBlob, maxArea, MAX_SIDE } from '../../utils/imageCore';
import { nextFrame } from '../../utils/dom';

interface Settings {
  format: 'png' | 'jpeg';
  dpi: number;
  quality: number;
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings<Settings>({ format: 'png', dpi: 150, quality: 90 });
  singlePdfTool(root, ctx, ({ file, doc }, area) => {
    const n = doc.numPages;
    let pagesText = `1-${n}`;
    let abort: AbortController | null = null;
    const status = h('p', { class: 'hint', 'aria-live': 'polite' });
    const result = h('div', { 'aria-live': 'polite' });
    const prog = progress('Rendering…');
    const fmt = segmented<Settings['format']>('Image format', [{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }], s.format, (v) => { s.format = v; ctx.saveSettings(s); quality.el.hidden = v !== 'jpeg'; });
    const dpi = segmented<string>('Resolution', [
      { value: '72', label: '72 dpi' }, { value: '150', label: '150 dpi' }, { value: '200', label: '200 dpi' }, { value: '300', label: '300 dpi' },
    ], String(s.dpi), (v) => { s.dpi = Number(v); ctx.saveSettings(s); });
    const quality = slider('JPG quality', s.quality, { min: 10, max: 100, format: (v) => `${v}%`, onInput: (v) => { s.quality = v; ctx.saveSettings(s); } });
    quality.el.hidden = s.format !== 'jpeg';
    const pagesIn = textInput(pagesText, { onInput: (v) => { pagesText = v; check(); } });
    const btn = button('Convert to images', { variant: 'primary', icon: 'image', size: 'lg', onClick: () => void run() });
    const cancel = button('Cancel', { variant: 'secondary', icon: 'x', onClick: () => abort?.abort() });
    cancel.hidden = true;

    function check(): number[] | null {
      try {
        const pages = parsePageList(pagesText, n);
        status.className = 'hint';
        status.textContent = `${pages.length} image${pages.length === 1 ? '' : 's'} will be created.`;
        btn.disabled = false;
        return pages;
      } catch (e) {
        status.className = 'hint status-err';
        status.textContent = describeError(e).title;
        btn.disabled = true;
        return null;
      }
    }

    async function run() {
      const pages = check();
      if (!pages) return;
      abort = new AbortController();
      const signal = abort.signal;
      const stop = () => abort?.abort();
      ctx.signal.addEventListener('abort', stop, { once: true });
      btn.disabled = true;
      cancel.hidden = false;
      render(result);
      const outputs: { name: string; blob: Blob }[] = [];
      const type = s.format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = s.format === 'png' ? 'png' : 'jpg';
      const base = baseName(file.name);
      let reduced = false;
      try {
        for (const [i, p] of pages.entries()) {
          throwIfAborted(signal);
          prog.set(i / pages.length, `Rendering page ${p} (${i + 1} of ${pages.length})…`);
          await nextFrame();
          // Respect canvas limits: lower the scale for huge pages instead of failing.
          const page = await doc.getPage(p);
          const vp = page.getViewport({ scale: 1 });
          let scale = s.dpi / 72;
          const limit = Math.min(MAX_SIDE / Math.max(vp.width, vp.height), Math.sqrt(maxArea() / (vp.width * vp.height)));
          if (scale > limit) {
            scale = limit * 0.98;
            reduced = true;
          }
          const canvas = await renderPage(doc, p, scale);
          const blob = await canvasToBlob(canvas, type, s.quality / 100);
          canvas.width = canvas.height = 1;
          outputs.push({ name: `${base}-page-${String(p).padStart(String(n).length, '0')}.${ext}`, blob });
        }
        prog.set(1, 'Done');
        const total = outputs.reduce((a, o) => a + o.blob.size, 0);
        render(
          result,
          reduced ? notice('warn', 'Some pages were too large for the selected resolution on this device and were rendered at the highest possible resolution instead.') : null,
          h('div', { class: 'batch-summary' },
            h('span', null, `${outputs.length} image${outputs.length > 1 ? 's' : ''} · ${formatBytes(total)}`),
            button(outputs.length > 1 ? 'Download All (ZIP)' : 'Download', { variant: 'primary', icon: 'download', onClick: () => void downloadAll(outputs, `${base}-images.zip`) }),
          ),
          h('ul', { class: 'file-list', style: 'margin-top:12px' }, ...outputs.slice(0, 200).map((o) => {
            const url = ctx.objectUrl(o.blob);
            return h('li', { class: 'file-row' },
              h('div', { class: 'file-thumb' }, h('img', { src: url, alt: '', loading: 'lazy' })),
              h('div', { class: 'file-info' }, h('span', { class: 'file-name' }, o.name), h('span', { class: 'file-meta' }, formatBytes(o.blob.size))),
              h('div', { class: 'file-actions' }, button('', { variant: 'secondary', size: 'sm', icon: 'download', ariaLabel: `Download ${o.name}`, onClick: () => void downloadBlob(o.blob, o.name) })),
            );
          })),
        );
        ctx.recordUse(s);
      } catch (e) {
        render(result, errorPanel(e));
      } finally {
        ctx.signal.removeEventListener('abort', stop);
        prog.hide();
        cancel.hidden = true;
        btn.disabled = false;
      }
    }

    render(area, h('div', { class: 'panel stack' }, field('Pages', pagesIn, 'All pages by default. Example: 1-3, 8'), status, fmt.el, dpi.el, quality.el, h('div', { class: 'toolbar' }, btn, cancel), prog.el), result);
    check();
  });
};
