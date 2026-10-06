/**
 * Drag & drop / file picker zone. Supports multiple files, folders (drag and
 * drop of directories, where the browser exposes them), keyboard activation
 * and pasting images/files from the clipboard.
 */
import { h } from '../utils/dom';
import { icon } from './icons';
import { extOf } from '../utils/format';
import { canonicalExt } from '../utils/fileType';
import { toast } from './toast';

/** Relative path inside a dropped folder (File.webkitRelativePath is read-only). */
export const relativePaths = new WeakMap<File, string>();
export const pathOf = (f: File): string => relativePaths.get(f) || f.webkitRelativePath || f.name;

export interface DropzoneOptions {
  /** Lower-case extensions; ['*'] or empty = anything. */
  accept?: string[];
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  /** Show an "Add folder" button (where supported). */
  folders?: boolean;
  /** Listen for paste events on the document while mounted. */
  paste?: boolean;
  buttonLabel?: string;
}

interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (cb: (f: File) => void, err: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (cb: (e: FsEntry[]) => void, err: (e: unknown) => void) => void };
}

async function walk(entry: FsEntry, out: File[]): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((res, rej) => entry.file!(res, rej));
    relativePaths.set(file, entry.fullPath.replace(/^\//, ''));
    out.push(file);
  } else if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    // readEntries returns results in batches; keep reading until empty.
    for (;;) {
      const batch = await new Promise<FsEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await walk(e, out);
    }
  }
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []);
  const entries = items
    .filter((i) => i.kind === 'file')
    .map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.() ?? null);
  if (entries.length && entries.every(Boolean) && entries.some((e) => e!.isDirectory)) {
    const out: File[] = [];
    for (const e of entries) await walk(e!, out);
    return out;
  }
  return Array.from(dt.files ?? []);
}

export function acceptAttr(exts: string[] | undefined): string | undefined {
  if (!exts || !exts.length || exts.includes('*')) return undefined;
  return exts.map((e) => `.${e}`).join(',');
}

export function filterAccepted(files: File[], accept?: string[]): { ok: File[]; rejected: File[] } {
  if (!accept || !accept.length || accept.includes('*')) return { ok: files, rejected: [] };
  const set = new Set(accept.map(canonicalExt));
  const ok: File[] = [];
  const rejected: File[] = [];
  for (const f of files) {
    const ext = canonicalExt(extOf(f.name));
    const mimeExt = f.type.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    if (set.has(ext) || (!ext && mimeExt && set.has(mimeExt))) ok.push(f);
    else rejected.push(f);
  }
  return { ok, rejected };
}

export function dropzone(opts: DropzoneOptions): HTMLElement {
  const multiple = opts.multiple ?? true;
  const input = h('input', { type: 'file', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', multiple, accept: acceptAttr(opts.accept) });
  const folderInput = h('input', { type: 'file', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', multiple: true });
  folderInput.setAttribute('webkitdirectory', '');

  const emit = (files: File[]) => {
    if (!files.length) return;
    const { ok, rejected } = filterAccepted(files, opts.accept);
    if (rejected.length) {
      toast(
        `${rejected.length} file${rejected.length > 1 ? 's' : ''} skipped: unsupported type (${[...new Set(rejected.map((f) => extOf(f.name) || f.type || '?'))].join(', ')}).`,
        'error',
        5000,
      );
    }
    if (!ok.length) return;
    opts.onFiles(multiple ? ok : ok.slice(0, 1));
  };

  input.addEventListener('change', () => {
    emit(Array.from(input.files ?? []));
    input.value = '';
  });
  folderInput.addEventListener('change', () => {
    emit(Array.from(folderInput.files ?? []));
    folderInput.value = '';
  });

  const chooseBtn = h(
    'button',
    { type: 'button', class: 'btn btn-primary btn-lg', onClick: () => input.click() },
    icon('upload'),
    h('span', null, opts.buttonLabel ?? (multiple ? 'Choose Files' : 'Choose File')),
  );
  const supportsFolder = opts.folders && 'webkitdirectory' in folderInput && !/iPhone|iPad|iPod/.test(navigator.userAgent);
  const folderBtn = supportsFolder
    ? h('button', { type: 'button', class: 'btn btn-secondary btn-lg', onClick: () => folderInput.click() }, icon('folder'), h('span', null, 'Add Folder'))
    : null;

  const formats = opts.accept && opts.accept.length && !opts.accept.includes('*')
    ? [...new Set(opts.accept.map((e) => e.toUpperCase().replace('JPEG', 'JPG')))].join(', ')
    : null;

  const zone = h(
    'div',
    { class: ['dropzone', opts.compact && 'dropzone-compact'], 'data-dropzone': '' },
    h('div', { class: 'dropzone-icon' }, icon('upload', 'icon icon-xl')),
    h('p', { class: 'dropzone-title' }, opts.title ?? (multiple ? 'Drop files here' : 'Drop a file here')),
    h('p', { class: 'dropzone-sub' }, opts.subtitle ?? 'or'),
    h('div', { class: 'dropzone-actions' }, chooseBtn, folderBtn),
    formats ? h('p', { class: 'dropzone-formats' }, `Supported: ${formats}`) : null,
    input,
    folderInput,
  );

  let depth = 0;
  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  zone.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) zone.classList.remove('is-over');
  });
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    zone.classList.remove('is-over');
    if (e.dataTransfer) emit(await filesFromDataTransfer(e.dataTransfer));
  });
  // Clicking anywhere on the zone (not on buttons) opens the picker.
  zone.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    input.click();
  });

  if (opts.paste) {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        emit(files);
      }
    };
    document.addEventListener('paste', onPaste);
    // Detach when the zone leaves the DOM.
    const mo = new MutationObserver(() => {
      if (!zone.isConnected) {
        document.removeEventListener('paste', onPaste);
        mo.disconnect();
      }
    });
    queueMicrotask(() => mo.observe(document.body, { childList: true, subtree: true }));
  }

  return zone;
}

/** Prevent the browser from navigating to a file dropped outside a drop zone. */
export function preventWindowDrop(): void {
  window.addEventListener('dragover', (e) => {
    if (!(e.target as HTMLElement)?.closest?.('[data-dropzone]')) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    if (!(e.target as HTMLElement)?.closest?.('[data-dropzone]')) e.preventDefault();
  });
}
