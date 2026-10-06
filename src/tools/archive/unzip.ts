import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, errorPanel, notice, progress, textInput } from '../../components/ui';
import { icon } from '../../components/icons';
import { listZip, extractEntry, type ZipEntryInfo } from '../../utils/zip';
import { downloadBlob } from '../../services/download';
import { formatBytes } from '../../utils/format';
import { sniffBytes } from '../../utils/fileType';
import { describeError } from '../../utils/errors';
import { plural, t } from '../../i18n/i18n';

interface DirHandle {
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: BlobPart): Promise<void>; close(): Promise<void> }> }>;
}
type PickerWindow = Window & { showDirectoryPicker?: (o?: { mode?: string }) => Promise<DirHandle> };

/** Prevent "zip slip": keep only safe path segments. */
export function safeSegments(path: string): string[] {
  return path.split(/[\\/]+/).filter((seg) => seg && seg !== '.' && seg !== '..').map((seg) => seg.replace(/[:*?"<>|\u0000-\u001f]/g, '_'));
}

const PREVIEW_TEXT = /\.(txt|md|json|csv|tsv|xml|html?|css|js|ts|ya?ml|ini|log|svg)$/i;
const PREVIEW_IMG = /\.(png|jpe?g|gif|webp|bmp|ico|avif)$/i;
const MAX_ARCHIVE = 1024 * 1024 * 1024;

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const area = h('div', { class: 'stack' });
  const zone = dropzone({ accept: ['zip'], multiple: false, onFiles: (f) => void open(f[0]), paste: true, title: t('Drop a ZIP file here') });
  root.append(zone, area);
  let buf: Uint8Array | null = null;
  ctx.onCleanup(() => (buf = null));

  async function open(file: File) {
    render(area, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('Reading archive…')));
    try {
      if (file.size > MAX_ARCHIVE) throw new Error(t('Archives larger than {size} cannot be opened in the browser.', { size: formatBytes(MAX_ARCHIVE) }));
      buf = new Uint8Array(await file.arrayBuffer());
      const entries = listZip(buf).filter((e) => !e.isDirectory);
      draw(file, entries);
      ctx.recordUse();
    } catch (e) {
      render(area, errorPanel(e));
    }
  }

  function draw(file: File, entries: ZipEntryInfo[]) {
    let filter = '';
    const preview = h('div', { 'aria-live': 'polite' });
    const listEl = h('ul', { class: 'entry-list', 'aria-label': t('Files in archive') });
    const prog = progress(t('Extracting…'));
    const total = entries.reduce((a, e) => a + e.size, 0);
    const picker = (window as PickerWindow).showDirectoryPicker;

    const getBlob = (e: ZipEntryInfo): Blob => {
      const data = extractEntry(buf!, e.name);
      return new Blob([data as BlobPart], { type: sniffBytes(data.subarray(0, 512))?.mime ?? 'application/octet-stream' });
    };

    const showPreview = async (e: ZipEntryInfo) => {
      try {
        if (e.size > 20 * 1024 * 1024) return render(preview, notice('info', t('File too large to preview — download it instead.')));
        const blob = getBlob(e);
        if (PREVIEW_IMG.test(e.name)) {
          render(preview, h('div', { class: 'panel' }, h('h2', { class: 'panel-title break' }, e.name), h('div', { class: 'preview-box' }, h('img', { src: ctx.objectUrl(blob), alt: e.name }))));
        } else {
          const text = await blob.text();
          render(preview, h('div', { class: 'panel' }, h('h2', { class: 'panel-title break' }, e.name), h('pre', { class: 'code-view wrap', style: 'max-height:50vh' }, text.length > 200_000 ? `${text.slice(0, 200_000)}\n…` : text)));
        }
        preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        render(preview, errorPanel(err));
      }
    };

    const drawList = () => {
      const shown = entries.filter((e) => !filter || e.name.toLowerCase().includes(filter)).slice(0, 3000);
      render(listEl, ...shown.map((e) =>
        h('li', { class: 'entry' },
          icon(e.name.includes('/') ? 'folder' : 'file'),
          h('span', { class: 'entry-name', title: e.name }, e.name),
          h('span', { class: 'entry-size' }, formatBytes(e.size)),
          h('span', { class: 'entry-actions' },
            PREVIEW_IMG.test(e.name) || PREVIEW_TEXT.test(e.name) ? button('', { variant: 'ghost', size: 'sm', icon: 'search', ariaLabel: `Preview ${e.name}`, onClick: () => void showPreview(e) }) : null,
            button('', { variant: 'ghost', size: 'sm', icon: 'download', ariaLabel: `Download ${e.name}`, onClick: () => {
              try {
                void downloadBlob(getBlob(e), safeSegments(e.name).pop() ?? 'file');
              } catch (err) {
                render(preview, errorPanel(err));
              }
            } }),
          ),
        )));
    };

    const saveAll = async () => {
      if (!picker) return;
      let dir: DirHandle;
      try {
        dir = await picker.call(window, { mode: 'readwrite' });
      } catch {
        return; // cancelled
      }
      try {
        let i = 0;
        for (const e of entries) {
          prog.set(i++ / entries.length, t('Extracting {i} of {n}…', { i, n: entries.length }));
          const segs = safeSegments(e.name);
          const fileName = segs.pop();
          if (!fileName) continue;
          let d = dir;
          for (const seg of segs) d = await d.getDirectoryHandle(seg, { create: true });
          const fh = await d.getFileHandle(fileName, { create: true });
          const w = await fh.createWritable();
          await w.write(extractEntry(buf!, e.name) as BlobPart);
          await w.close();
        }
        render(preview, notice('success', t('Extracted {files} to the selected folder.', { files: plural(entries.length, 'file') })));
      } catch (err) {
        render(preview, notice('error', t('Extraction stopped: {reason}', { reason: describeError(err).title })));
      } finally {
        prog.hide();
      }
    };

    const filterIn = textInput('', { placeholder: t('Filter files…'), ariaLabel: t('Filter files'), onInput: (v) => { filter = v.toLowerCase(); drawList(); } });
    render(
      area,
      h('div', { class: 'panel stack' },
        h('div', { class: 'toolbar', style: 'justify-content:space-between' },
          h('p', { style: 'margin:0' }, h('strong', { class: 'break' }, file.name), ` · ${plural(entries.length, 'file')} · ${formatBytes(file.size)} → ${t('{size} uncompressed', { size: formatBytes(total) })}`),
          button(t('Open another ZIP'), { variant: 'ghost', icon: 'upload', onClick: () => zone.querySelector('input')?.click() }),
        ),
        picker
          ? h('div', { class: 'toolbar' }, button(t('Extract all to a folder…'), { variant: 'primary', icon: 'folder', onClick: () => void saveAll() }))
          : notice('info', t('Your browser cannot write to folders, so files are downloaded one at a time using the download buttons. (Chrome and Edge on desktop support “Extract all to a folder”.)')),
        prog.el,
        entries.length > 20 ? filterIn : null,
      ),
      preview,
      listEl,
    );
    drawList();
  }

  if (ctx.initialFiles[0]) void open(ctx.initialFiles[0]);
};
