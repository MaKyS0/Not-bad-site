import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, progress, errorPanel, notice, textInput, field } from '../../components/ui';
import { pdfWorker, pdfBlob, readFileBytes, sortableList, openPdfJs, type SortItem } from './lib';
import { downloadBlob } from '../../services/download';
import { formatBytes, safeFileName } from '../../utils/format';
import { plural, t } from '../../i18n/i18n';

let nextId = 1;

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  let items: SortItem[] = [];
  const listBox = h('div');
  const result = h('div', { 'aria-live': 'polite' });
  const prog = progress(t('Merging…'));
  const nameIn = textInput('merged.pdf', { ariaLabel: t('Output file name') });
  const mergeBtn = button(t('Merge PDFs'), { variant: 'primary', icon: 'merge', size: 'lg', onClick: () => void merge() });
  const controls = h('div', { class: 'panel', hidden: true },
    h('div', { class: 'toolbar', style: 'justify-content:space-between;margin-bottom:12px' }, h('h2', { class: 'panel-title', style: 'margin:0' }, t('Order')), h('span', { class: 'hint' }, t('Drag to reorder or use the arrows.'))),
    listBox,
    h('div', { class: 'options-grid', style: 'margin-top:16px' }, field(t('Output file name'), nameIn)),
    h('div', { class: 'toolbar', style: 'margin-top:16px' }, mergeBtn, button(t('Clear'), { variant: 'ghost', icon: 'trash', onClick: () => setItems([]) })),
    prog.el,
  );

  const zone = dropzone({ accept: ['pdf'], multiple: true, onFiles: (f) => add(f), paste: true, title: t('Drop PDF files here'), subtitle: t('Add two or more PDFs, in any order') });
  root.append(zone, controls, result);

  function setItems(next: SortItem[]) {
    items = next;
    controls.hidden = items.length === 0;
    mergeBtn.disabled = items.length < 2;
    render(listBox, sortableList(items, setItems, (it) => setItems(items.filter((x) => x !== it))));
    render(result, items.length === 1 ? notice('info', t('Add at least one more PDF to merge.')) : null);
  }

  async function add(files: File[]) {
    const fresh = files.map((file) => ({ id: nextId++, file, meta: t('counting pages…') }));
    setItems([...items, ...fresh]);
    for (const it of fresh) {
      try {
        const doc = await openPdfJs(await readFileBytes(it.file));
        it.meta = plural(doc.numPages, 'page');
        void doc.loadingTask.destroy();
      } catch (e) {
        it.meta = (e as Error).message.includes('password') ? t('password-protected') : t('unreadable');
      }
      if (items.includes(it)) setItems(items);
    }
  }

  async function merge() {
    if (items.length < 2) return;
    mergeBtn.disabled = true;
    prog.set(0, t('Reading files…'));
    render(result);
    try {
      const files = await Promise.all(items.map(async (it) => ({ name: it.file.name, bytes: await readFileBytes(it.file) })));
      prog.set(0.05, t('Merging…'));
      const bytes = await pdfWorker().call<Uint8Array>('merge', { files }, { transfer: files.map((f) => f.bytes.buffer as ArrayBuffer), onProgress: (f) => prog.set(f, t('Merging…')), signal: ctx.signal });
      const blob = pdfBlob(bytes);
      let name = safeFileName(nameIn.value.trim() || 'merged.pdf');
      if (!/\.pdf$/i.test(name)) name += '.pdf';
      render(
        result,
        h('div', { class: 'batch-summary' },
          h('span', null, `${t('Merged {files}', { files: plural(items.length, 'file') })} · ${formatBytes(blob.size)}`),
          button(t('Download PDF'), { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(blob, name) }),
        ),
      );
      ctx.recordUse();
      await downloadBlob(blob, name);
    } catch (e) {
      render(result, errorPanel(e));
    } finally {
      prog.hide();
      mergeBtn.disabled = items.length < 2;
    }
  }

  if (ctx.initialFiles.length) void add(ctx.initialFiles.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf'));
};
