import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { button, field, numberInput, progress, segmented, textInput, errorPanel } from '../../components/ui';
import { singlePdfTool } from './single';
import { pdfWorker, pdfBlob } from './lib';
import { chunkPages, formatPageList, parseRangeGroups } from '../../utils/pageRanges';
import { describeError } from '../../utils/errors';
import { downloadAll, downloadBlob } from '../../services/download';
import { baseName, formatBytes } from '../../utils/format';
import { icon } from '../../components/icons';

type Mode = 'each' | 'every' | 'ranges';

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ mode: 'ranges' as Mode, every: 2 });
  singlePdfTool(root, ctx, ({ file, bytes, doc }, area) => {
    const n = doc.numPages;
    let ranges = n > 1 ? `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}` : '1';
    const plan = h('p', { class: 'hint', 'aria-live': 'polite' });
    const result = h('div', { 'aria-live': 'polite' });
    const prog = progress('Splitting…');
    const rangeIn = textInput(ranges, { placeholder: 'e.g. 1-3, 4-6, 7', onInput: (v) => { ranges = v; updatePlan(); } });
    const everyIn = numberInput(s.every, { min: 1, max: n, onInput: (v) => { s.every = Math.max(1, Math.round(v)); ctx.saveSettings(s); updatePlan(); } });
    const rangeField = field('Page ranges (each becomes one PDF)', rangeIn, 'Example: “1-3, 4-6, 7-” → three files. Open ranges like “7-” go to the last page.');
    const everyField = field('Pages per file', everyIn);
    const mode = segmented<Mode>('Split mode', [
      { value: 'ranges', label: 'Custom ranges' },
      { value: 'each', label: 'Every page' },
      { value: 'every', label: 'Every N pages' },
    ], s.mode, (v) => { s.mode = v; ctx.saveSettings(s); updatePlan(); });
    const btn = button('Split PDF', { variant: 'primary', icon: 'split', size: 'lg', onClick: () => void run() });

    const groups = (): number[][] => (s.mode === 'each' ? chunkPages(n, 1) : s.mode === 'every' ? chunkPages(n, s.every) : parseRangeGroups(ranges, n));

    function updatePlan() {
      rangeField.hidden = s.mode !== 'ranges';
      everyField.hidden = s.mode !== 'every';
      try {
        const g = groups();
        plan.className = 'hint';
        plan.textContent = `→ ${g.length} file${g.length === 1 ? '' : 's'}: ${g.slice(0, 8).map((x) => formatPageList(x)).join(' | ')}${g.length > 8 ? ' | …' : ''}`;
        btn.disabled = false;
      } catch (e) {
        plan.className = 'hint status-err';
        plan.textContent = describeError(e).title;
        btn.disabled = true;
      }
    }

    async function run() {
      let g: number[][];
      try {
        g = groups();
      } catch (e) {
        render(result, errorPanel(e));
        return;
      }
      btn.disabled = true;
      prog.set(0, 'Splitting…');
      render(result);
      try {
        const outs = await pdfWorker().call<Uint8Array[]>('split', { bytes: bytes.slice(), groups: g, name: file.name }, { onProgress: (f) => prog.set(f, 'Splitting…'), signal: ctx.signal });
        const base = baseName(file.name);
        const files = outs.map((o, i) => ({ name: `${base}-${g[i].length === 1 ? `page-${g[i][0]}` : `pages-${g[i][0]}-${g[i][g[i].length - 1]}`}.pdf`, blob: pdfBlob(o) }));
        render(
          result,
          h('div', { class: 'batch-summary' },
            h('span', null, `${files.length} PDF${files.length > 1 ? 's' : ''} · ${formatBytes(files.reduce((a, f) => a + f.blob.size, 0))}`),
            button(files.length > 1 ? 'Download All (ZIP)' : 'Download', { variant: 'primary', icon: 'download', onClick: () => void downloadAll(files, `${base}-split.zip`) }),
          ),
          h('ul', { class: 'entry-list', style: 'margin-top:12px' }, ...files.map((f) =>
            h('li', { class: 'entry' }, icon('pdf'), h('span', { class: 'entry-name' }, f.name), h('span', { class: 'entry-size' }, formatBytes(f.blob.size)),
              h('span', { class: 'entry-actions' }, button('', { variant: 'ghost', size: 'sm', icon: 'download', ariaLabel: `Download ${f.name}`, onClick: () => void downloadBlob(f.blob, f.name) }))),
          )),
        );
        ctx.recordUse({ mode: s.mode, every: s.every });
      } catch (e) {
        render(result, errorPanel(e));
      } finally {
        prog.hide();
        btn.disabled = false;
      }
    }

    render(area, h('div', { class: 'panel stack' }, mode.el, rangeField, everyField, plan, h('div', { class: 'toolbar' }, btn), prog.el), result);
    updatePlan();
  });
};
