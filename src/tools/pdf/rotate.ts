import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { button, progress, errorPanel, notice } from '../../components/ui';
import { singlePdfTool } from './single';
import { pdfWorker, pdfBlob, pageGrid } from './lib';
import { downloadBlob } from '../../services/download';
import { baseName, formatBytes } from '../../utils/format';

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  singlePdfTool(root, ctx, ({ file, bytes, doc }, area) => {
    const n = doc.numPages;
    const rotations = new Map<number, number>();
    const all = Array.from({ length: n }, (_, i) => i + 1);
    const status = h('p', { class: 'hint', 'aria-live': 'polite' });
    const result = h('div', { 'aria-live': 'polite' });
    const prog = progress('Saving…');
    const grid = pageGrid(doc, { selectable: true, initialSelected: all, onChange: () => update() });
    const saveBtn = button('Save rotated PDF', { variant: 'primary', icon: 'download', size: 'lg', onClick: () => void save() });

    const rotate = (deg: number) => {
      const targets = grid.selected.size ? [...grid.selected] : all;
      for (const p of targets) {
        const next = (((rotations.get(p) ?? 0) + deg) % 360 + 360) % 360;
        rotations.set(p, next);
        grid.setRotation(p, next);
      }
      update();
    };

    function update() {
      const changed = [...rotations.values()].filter(Boolean).length;
      status.textContent = `${grid.selected.size || n} page${(grid.selected.size || n) === 1 ? '' : 's'} selected · ${changed} page${changed === 1 ? '' : 's'} will be rotated.`;
      saveBtn.disabled = changed === 0;
    }

    async function save() {
      saveBtn.disabled = true;
      prog.indeterminate('Saving…');
      render(result);
      try {
        const rot: Record<number, number> = {};
        rotations.forEach((v, k) => { if (v) rot[k] = v; });
        const out = await pdfWorker().call<Uint8Array>('rotate', { bytes: bytes.slice(), rotations: rot, name: file.name }, { signal: ctx.signal });
        const blob = pdfBlob(out);
        const name = `${baseName(file.name)}-rotated.pdf`;
        render(result, h('div', { class: 'batch-summary' }, h('span', null, `Saved · ${formatBytes(blob.size)}`), button('Download PDF', { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(blob, name) })));
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
        notice('info', 'Select pages (all are selected by default), then rotate. Rotation is lossless — page content is not re-rendered.'),
        h('div', { class: 'toolbar' },
          button('Rotate left 90°', { icon: 'rotate', onClick: () => rotate(270) }),
          button('Rotate right 90°', { icon: 'rotate', onClick: () => rotate(90), class: 'flip-icon' }),
          button('Rotate 180°', { onClick: () => rotate(180) }),
          button('Reset', { variant: 'ghost', onClick: () => { rotations.forEach((_, p) => grid.setRotation(p, 0)); rotations.clear(); update(); } }),
        ),
        h('div', { class: 'toolbar' },
          button('Select all', { variant: 'secondary', size: 'sm', onClick: () => { grid.setSelected(all); update(); } }),
          button('Select none', { variant: 'secondary', size: 'sm', onClick: () => { grid.setSelected([]); update(); } }),
        ),
        status,
        h('div', { class: 'toolbar' }, saveBtn),
        prog.el,
      ),
      result,
      grid.el,
    );
    update();
    return () => grid.destroy();
  });
};
