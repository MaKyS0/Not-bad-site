import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, field, progress, segmented, select, errorPanel, textInput } from '../../components/ui';
import { pdfWorker, pdfBlob, sortableList, type SortItem } from './lib';
import { processImage, decodeImage } from '../../services/imageService';
import { canonicalExt, readHead, sniffBytes } from '../../utils/fileType';
import { downloadBlob } from '../../services/download';
import { extOf, formatBytes, safeFileName } from '../../utils/format';
import type { ImageForPdf, ImagesToPdfOptions } from '../../utils/pdfOps';
import { throwIfAborted } from '../../utils/errors';

let nextId = 1;

interface Settings {
  pageSize: ImagesToPdfOptions['pageSize'];
  orientation: ImagesToPdfOptions['orientation'];
  margin: 'none' | 'small' | 'large';
}

const MARGINS = { none: 0, small: 18, large: 36 };

/** Prepare an image for pdf-lib: JPG/PNG as-is when safe, everything else via canvas. */
async function prepare(file: File, signal: AbortSignal): Promise<ImageForPdf> {
  const sniffed = sniffBytes(await readHead(file))?.ext ?? canonicalExt(extOf(file.name));
  const d = await decodeImage(file);
  const width = d.width;
  const height = d.height;
  d.close();
  if (sniffed === 'png') return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'png', width, height };
  if (sniffed === 'jpg') {
    // JPEGs with an EXIF rotation must be re-encoded, because PDF viewers ignore EXIF.
    let orientation = 1;
    try {
      const exifr = (await import('exifr')).default;
      orientation = (await exifr.orientation(file)) ?? 1;
    } catch {
      orientation = 1;
    }
    if (orientation === 1) return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'jpg', width, height };
  }
  throwIfAborted(signal);
  const photo = sniffed === 'jpg' || sniffed === 'webp' || sniffed === 'avif' || sniffed === 'heic' || sniffed === 'bmp';
  const res = await processImage(file, { output: photo ? { type: 'image/jpeg', quality: 0.92 } : { type: 'image/png' } }, { signal, svgWidth: sniffed === 'svg' ? Math.max(width, 1200) : undefined });
  return { bytes: new Uint8Array(await res.blob.arrayBuffer()), kind: photo ? 'jpg' : 'png', width: res.width, height: res.height };
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings<Settings>({ pageSize: 'a4', orientation: 'auto', margin: 'small' });
  let items: SortItem[] = [];
  const listBox = h('div');
  const result = h('div', { 'aria-live': 'polite' });
  const prog = progress('Creating PDF…');
  const nameIn = textInput('images.pdf', { ariaLabel: 'Output file name' });
  const btn = button('Create PDF', { variant: 'primary', icon: 'pdf', size: 'lg', onClick: () => void run() });

  const sizeSel = field('Page size', select<Settings['pageSize']>([{ value: 'a4', label: 'A4 (210 × 297 mm)' }, { value: 'letter', label: 'US Letter (8.5 × 11 in)' }, { value: 'fit', label: 'Same as image' }], s.pageSize, (v) => { s.pageSize = v; ctx.saveSettings(s); orient.el.hidden = v === 'fit'; }));
  const orient = segmented<Settings['orientation']>('Orientation', [{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }], s.orientation, (v) => { s.orientation = v; ctx.saveSettings(s); });
  orient.el.hidden = s.pageSize === 'fit';
  const margin = segmented<Settings['margin']>('Margin', [{ value: 'none', label: 'None' }, { value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }], s.margin, (v) => { s.margin = v; ctx.saveSettings(s); });

  const controls = h('div', { class: 'tool-layout', hidden: true },
    h('aside', { class: 'tool-options panel', 'aria-label': 'PDF options' }, sizeSel, orient.el, margin.el, field('File name', nameIn), btn, prog.el),
    h('div', { class: 'tool-main' }, h('div', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'Pages (drag to reorder)'), listBox), result),
  );
  const zone = dropzone({ accept: ctx.meta.supportedFormats, multiple: true, onFiles: (f) => add(f), paste: true, title: 'Drop images here', compact: false });
  root.append(zone, controls);

  ctx.onCleanup(() => items.forEach((i) => i.thumbUrl && ctx.revokeUrl(i.thumbUrl)));

  function setItems(next: SortItem[]) {
    for (const it of items) if (!next.includes(it) && it.thumbUrl) ctx.revokeUrl(it.thumbUrl);
    items = next;
    controls.hidden = items.length === 0;
    btn.disabled = items.length === 0;
    render(listBox, sortableList(items, setItems, (it) => setItems(items.filter((x) => x !== it))));
  }

  function add(files: File[]) {
    setItems([...items, ...files.map((file) => ({ id: nextId++, file, thumbUrl: ctx.objectUrl(file) }))]);
    render(result);
  }

  async function run() {
    btn.disabled = true;
    render(result);
    try {
      const prepared: ImageForPdf[] = [];
      for (const [i, it] of items.entries()) {
        prog.set((i / items.length) * 0.7, `Preparing image ${i + 1} of ${items.length}…`);
        prepared.push(await prepare(it.file, ctx.signal));
      }
      const opts: ImagesToPdfOptions = { pageSize: s.pageSize, orientation: s.orientation, margin: MARGINS[s.margin] };
      const bytes = await pdfWorker().call<Uint8Array>('images', { images: prepared, opts }, { transfer: prepared.map((p) => p.bytes.buffer as ArrayBuffer), onProgress: (f) => prog.set(0.7 + f * 0.3, 'Building PDF…'), signal: ctx.signal });
      const blob = pdfBlob(bytes);
      let name = safeFileName(nameIn.value.trim() || 'images.pdf');
      if (!/\.pdf$/i.test(name)) name += '.pdf';
      render(result, h('div', { class: 'batch-summary' }, h('span', null, `${items.length} page${items.length > 1 ? 's' : ''} · ${formatBytes(blob.size)}`), button('Download PDF', { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(blob, name) })));
      ctx.recordUse(s);
      await downloadBlob(blob, name);
    } catch (e) {
      render(result, errorPanel(e));
    } finally {
      prog.hide();
      btn.disabled = items.length === 0;
    }
  }

  if (ctx.initialFiles.length) add(ctx.initialFiles);
};
