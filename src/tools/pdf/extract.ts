import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { button, field, progress, segmented, textInput, errorPanel } from '../../components/ui';
import { singlePdfTool } from './single';
import { pdfWorker, pdfBlob, pageGrid } from './lib';
import { formatPageList, parsePageList } from '../../utils/pageRanges';
import { describeError } from '../../utils/errors';
import { downloadBlob } from '../../services/download';
import { baseName, formatBytes } from '../../utils/format';

type Mode = 'keep' | 'remove';

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  singlePdfTool(root, ctx, ({ file, bytes, doc }, area) => {
    const n = doc.numPages;
    let mode: Mode = 'keep';
    const status = h('p', { class: 'hint', 'aria-live': 'polite' });
    const result = h('div', { 'aria-live': 'polite' });
    const prog = progress('Creating PDF…');
    const rangeIn = textInput('', { placeholder: 'e.g. 1, 3-5', ariaLabel: 'Selected pages' });
    const btn = button('Extract pages', { variant: 'primary', icon: 'pages', size: 'lg', onClick: () => void run() });

    const grid = pageGrid(doc, {
      selectable: true,
      onChange: (sel) => {
        rangeIn.value = formatPageList([...sel]);
        update();
      },
    });
    rangeIn.addEventListener('input', () => {
      try {
        grid.setSelected(rangeIn.value.trim() ? parsePageList(rangeIn.value, n) : []);
        update();
      } catch (e) {
        status.className = 'hint status-err';
        status.textContent = describeError(e).title;
      }
    });

    const modeSeg = segmented<Mode>('Mode', [
      { value: 'keep', label: 'Keep selected pages' },
      { value: 'remove', label: 'Delete selected pages' },
    ], mode, (v) => { mode = v; update(); });

    const outputPages = (): number[] => {
      const sel = [...grid.selected].sort((a, b) => a - b);
      if (mode === 'keep') return sel;
      const del = new Set(sel);
      return Array.from({ length: n }, (_, i) => i + 1).filter((p) => !del.has(p));
    };

    function update() {
      const out = outputPages();
      status.className = 'hint';
      status.textContent = grid.selected.size === 0
        ? 'Click pages to select them, or type page numbers.'
        : `New PDF will contain ${out.length} page${out.length === 1 ? '' : 's'}${out.length ? `: ${formatPageList(out)}` : ''}.`;
      btn.disabled = out.length === 0 || grid.selected.size === 0;
      btn.querySelector('span')!.textContent = mode === 'keep' ? 'Extract pages' : 'Delete pages & save';
    }

    async function run() {
      const pages = outputPages();
      btn.disabled = true;
      prog.indeterminate('Creating PDF…');
      render(result);
      try {
        const out = await pdfWorker().call<Uint8Array>('extract', { bytes: bytes.slice(), pages, name: file.name }, { signal: ctx.signal });
        const blob = pdfBlob(out);
        const name = `${baseName(file.name)}-${mode === 'keep' ? 'extracted' : 'edited'}.pdf`;
        render(result, h('div', { class: 'batch-summary' }, h('span', null, `${pages.length} pages · ${formatBytes(blob.size)}`), button('Download PDF', { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(blob, name) })));
        ctx.recordUse();
        await downloadBlob(blob, name);
      } catch (e) {
        render(result, errorPanel(e));
      } finally {
        prog.hide();
        update();
      }
    }

    render(
      area,
      h('div', { class: 'panel stack' },
        modeSeg.el,
        field('Pages', rangeIn),
        h('div', { class: 'toolbar' },
          button('Select all', { variant: 'secondary', size: 'sm', onClick: () => { grid.setSelected(Array.from({ length: n }, (_, i) => i + 1)); rangeIn.value = `1-${n}`; update(); } }),
          button('Select none', { variant: 'secondary', size: 'sm', onClick: () => { grid.setSelected([]); rangeIn.value = ''; update(); } }),
          button('Odd pages', { variant: 'secondary', size: 'sm', onClick: () => { const p = Array.from({ length: n }, (_, i) => i + 1).filter((x) => x % 2); grid.setSelected(p); rangeIn.value = formatPageList(p); update(); } }),
          button('Even pages', { variant: 'secondary', size: 'sm', onClick: () => { const p = Array.from({ length: n }, (_, i) => i + 1).filter((x) => !(x % 2)); grid.setSelected(p); rangeIn.value = formatPageList(p); update(); } }),
        ),
        status,
        h('div', { class: 'toolbar' }, btn),
        prog.el,
      ),
      result,
      grid.el,
    );
    update();
    return () => grid.destroy();
  });
};
