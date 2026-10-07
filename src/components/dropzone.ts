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
import { plural, t } from '../i18n/i18n';
import { hop, pop } from '../utils/motion';

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
  /** Extra line under the buttons, e.g. a list of supported formats. */
  hint?: string;
  /** @deprecated every drop zone now accepts drops anywhere on the page. */
  global?: boolean;
}

/* ---------- page-wide drop & paste: forwarded to the most recent drop zone ---------- */

interface ZoneEntry {
  zone: HTMLElement;
  emit: (files: File[]) => void;
  paste: boolean;
}
const zones: ZoneEntry[] = [];

/** Register any element as a page-wide drop/paste target (e.g. text editors). */
export function registerDropTarget(zone: HTMLElement, emit: (files: File[]) => void, paste = true): void {
  zones.push({ zone, emit, paste });
}

function activeZone(): ZoneEntry | undefined {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (!zones[i].zone.isConnected) zones.splice(i, 1);
  }
  return zones[zones.length - 1];
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
        t('{files} skipped: unsupported type ({types}).', { files: plural(rejected.length, 'file'), types: [...new Set(rejected.map((f) => extOf(f.name) || f.type || '?'))].join(', ') }),
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
    h('span', null, opts.buttonLabel ?? (multiple ? t('Choose Files') : t('Choose File'))),
  );
  const supportsFolder = opts.folders && 'webkitdirectory' in folderInput && !/iPhone|iPad|iPod/.test(navigator.userAgent);
  const folderBtn = supportsFolder
    ? h('button', { type: 'button', class: 'btn btn-secondary btn-lg', onClick: () => folderInput.click() }, icon('folder'), h('span', null, t('Add Folder')))
    : null;

  const formats = opts.accept && opts.accept.length && !opts.accept.includes('*')
    ? [...new Set(opts.accept.map((e) => e.toUpperCase().replace('JPEG', 'JPG')))].join(', ')
    : null;

  const zone = h(
    'div',
    { class: ['dropzone', opts.compact && 'dropzone-compact'], 'data-dropzone': '' },
    h('div', { class: 'dropzone-icon' }, icon('upload', 'icon icon-xl')),
    h('p', { class: 'dropzone-title' }, opts.title ?? (multiple ? t('Drop files here') : t('Drop a file here'))),
    h('p', { class: 'dropzone-sub' }, opts.subtitle ?? t('or')),
    h('div', { class: 'dropzone-actions' }, chooseBtn, folderBtn),
    opts.hint ? h('p', { class: 'dropzone-formats' }, opts.hint) : formats ? h('p', { class: 'dropzone-formats' }, t('Supported: {formats}', { formats })) : null,
    h('p', { class: 'dropzone-tip' }, t('Tip: you can drop files anywhere on the page or paste with Ctrl+V.')),
    input,
    folderInput,
  );

  let depth = 0;
  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    if (!zone.classList.contains('is-over')) hop(zone.querySelector('.dropzone-icon'));
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

  registerDropTarget(zone, emit, Boolean(opts.paste));

  return zone;
}

/**
 * Page-wide drag & drop and paste: files dropped anywhere (or pasted) go to the
 * most recently mounted drop zone, with a full-screen overlay while dragging.
 * Also prevents the browser from navigating away to a dropped file.
 */
export function installGlobalDrop(): void {
  let depth = 0;
  let overlay: HTMLElement | null = null;
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const show = () => {
    if (overlay || !activeZone()) return;
    overlay = h('div', { class: 'drop-overlay', 'aria-hidden': 'true' }, h('div', { class: 'drop-overlay-card' }, icon('upload', 'icon icon-xl'), h('p', null, t('Drop files to add them'))));
    document.body.appendChild(overlay);
    pop(overlay.firstElementChild, { scale: 0.94, y: 0 });
  };
  const hide = () => {
    depth = 0;
    overlay?.remove();
    overlay = null;
  };
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    depth++;
    if (!(e.target as HTMLElement)?.closest?.('[data-dropzone]')) show();
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) hide();
  });
  window.addEventListener('dragover', (e) => {
    if (!(e.target as HTMLElement)?.closest?.('[data-dropzone]')) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = activeZone() ? 'copy' : 'none';
    }
  });
  window.addEventListener('drop', async (e) => {
    const inZone = (e.target as HTMLElement)?.closest?.('[data-dropzone]');
    hide();
    if (inZone) return;
    e.preventDefault();
    const z = activeZone();
    if (z && e.dataTransfer) z.emit(await filesFromDataTransfer(e.dataTransfer));
  });
  document.addEventListener('paste', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) return;
    const files = Array.from(e.clipboardData?.files ?? []);
    const z = activeZone();
    if (files.length && z?.paste) {
      e.preventDefault();
      z.emit(files);
    }
  });
}
