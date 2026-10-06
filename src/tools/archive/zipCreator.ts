import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone, pathOf } from '../../components/dropzone';
import { button, iconButton, field, progress, select, textInput, errorPanel, notice } from '../../components/ui';
import { icon } from '../../components/icons';
import { zipFiles } from '../../utils/zip';
import { downloadBlob } from '../../services/download';
import { formatBytes, safeFileName } from '../../utils/format';
import { canonicalExt } from '../../utils/fileType';
import { extOf } from '../../utils/format';
import { UserError } from '../../utils/errors';

interface Entry {
  path: string;
  data: Blob;
  lastModified?: number;
}

type Level = '0' | '1' | '6' | '9';

/** Read every file of an existing ZIP into Blobs (decompressed in fflate's worker). */
async function readZip(file: File): Promise<Entry[]> {
  const { unzip } = await import('fflate');
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(buf, (err, data) => (err ? reject(new UserError(`“${file.name}” could not be opened.`, `It may be corrupted, encrypted or use unsupported compression (${err.message}).`)) : resolve(data))),
  );
  return Object.entries(files)
    .filter(([p]) => !p.endsWith('/'))
    .map(([path, data]) => ({ path, data: new Blob([data as BlobPart]) }));
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ level: '6' as Level });
  let entries: Entry[] = [];
  let archiveName = 'archive.zip';
  const list = h('ul', { class: 'entry-list', 'aria-label': 'Archive contents' });
  const summary = h('p', { class: 'hint', 'aria-live': 'polite' });
  const result = h('div', { 'aria-live': 'polite' });
  const prog = progress('Compressing…');
  const nameIn = textInput(archiveName, { onInput: (v) => (archiveName = v), ariaLabel: 'Archive name' });
  const levelSel = select<Level>([
    { value: '0', label: 'Store (no compression, fastest)' },
    { value: '1', label: 'Fast' },
    { value: '6', label: 'Normal' },
    { value: '9', label: 'Maximum (slowest)' },
  ], s.level, (v) => { s.level = v; ctx.saveSettings(s); });
  const createBtn = button('Download ZIP', { variant: 'primary', icon: 'download', size: 'lg', onClick: () => void create() });
  const panel = h('div', { class: 'tool-layout', hidden: true },
    h('aside', { class: 'tool-options panel', 'aria-label': 'Archive options' },
      field('Archive name', nameIn), field('Compression', levelSel),
      h('p', { class: 'hint' }, 'Already-compressed files (JPG, PNG, MP3, ZIP, PDF…) are stored without re-compression to save time.'),
      createBtn, prog.el,
    ),
    h('div', { class: 'tool-main' }, h('div', { class: 'toolbar', style: 'justify-content:space-between' }, summary, button('Remove all', { variant: 'ghost', icon: 'trash', onClick: () => setEntries([]) })), list, result),
  );

  const zone = dropzone({ accept: ['*'], multiple: true, folders: true, onFiles: (f) => void add(f), paste: true, title: 'Drop files or folders here', subtitle: 'Drop a .zip to edit its contents, or' });
  root.append(zone, panel);

  function setEntries(next: Entry[]) {
    entries = next.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    panel.hidden = entries.length === 0;
    const total = entries.reduce((a, e) => a + e.data.size, 0);
    summary.textContent = `${entries.length.toLocaleString()} file${entries.length === 1 ? '' : 's'} · ${formatBytes(total)}`;
    createBtn.disabled = !entries.length;
    const shown = entries.slice(0, 2000);
    render(
      list,
      ...shown.map((e) =>
        h('li', { class: 'entry' }, icon(e.path.includes('/') ? 'folder' : 'file'), h('span', { class: 'entry-name', title: e.path }, e.path), h('span', { class: 'entry-size' }, formatBytes(e.data.size)),
          h('span', { class: 'entry-actions' }, iconButton('trash', `Remove ${e.path}`, () => setEntries(entries.filter((x) => x !== e)), 'icon-btn-sm'))),
      ),
      entries.length > shown.length ? h('li', { class: 'entry' }, h('span'), h('span', { class: 'muted' }, `… and ${entries.length - shown.length} more`)) : null,
    );
  }

  async function add(files: File[]) {
    render(result);
    const next = [...entries];
    const used = new Set(next.map((e) => e.path));
    try {
      for (const f of files) {
        const isZip = canonicalExt(extOf(f.name)) === 'zip' && files.length === 1 && entries.length === 0;
        if (isZip) {
          prog.indeterminate(`Opening ${f.name}…`);
          const inner = await readZip(f);
          inner.forEach((e) => { next.push(e); used.add(e.path); });
          archiveName = f.name;
          nameIn.value = f.name;
          render(result, notice('info', `Opened ${f.name}: ${inner.length} files. Add or remove files, then download the updated archive.`));
          continue;
        }
        let path = pathOf(f).replace(/^\/+/, '');
        if (used.has(path)) {
          const dot = path.lastIndexOf('.');
          let i = 2;
          while (used.has(dot > 0 ? `${path.slice(0, dot)} (${i})${path.slice(dot)}` : `${path} (${i})`)) i++;
          path = dot > 0 ? `${path.slice(0, dot)} (${i})${path.slice(dot)}` : `${path} (${i})`;
        }
        used.add(path);
        next.push({ path, data: f, lastModified: f.lastModified });
      }
      setEntries(next);
    } catch (e) {
      render(result, errorPanel(e));
    } finally {
      prog.hide();
    }
  }

  async function create() {
    createBtn.disabled = true;
    render(result);
    try {
      prog.set(0, 'Compressing…');
      const zip = await zipFiles(entries.map((e) => ({ name: e.path, data: e.data, lastModified: e.lastModified })), {
        level: Number(s.level) as 0 | 1 | 6 | 9,
        onProgress: (f) => prog.set(f, 'Compressing…'),
        signal: ctx.signal,
      });
      let name = safeFileName(archiveName.trim() || 'archive.zip');
      if (!/\.zip$/i.test(name)) name += '.zip';
      const total = entries.reduce((a, e) => a + e.data.size, 0);
      render(result, h('div', { class: 'batch-summary' }, h('span', null, `${formatBytes(total)} → ${formatBytes(zip.size)}`), button('Download again', { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(zip, name) })));
      ctx.recordUse(s);
      await downloadBlob(zip, name);
    } catch (e) {
      render(result, errorPanel(e));
    } finally {
      prog.hide();
      createBtn.disabled = !entries.length;
    }
  }

  if (ctx.initialFiles.length) void add(ctx.initialFiles);
};
