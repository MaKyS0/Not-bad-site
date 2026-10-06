/**
 * Generic batch processing UI: file queue, per-file progress and results,
 * "Process all", per-file download and "Download All" (ZIP).
 */
import { h, render, announce, append } from '../utils/dom';
import { dropzone, filterAccepted } from './dropzone';
import { button, iconButton, progress } from './ui';
import { icon } from './icons';
import { downloadAll, downloadBlob } from '../services/download';
import { formatBytes, formatPercent, percentChange, uniqueName } from '../utils/format';
import { describeError, isAbort } from '../utils/errors';
import { guessKind } from '../utils/fileType';
import type { OutputFile, ToolContext } from '../tools/types';
import { toast } from './toast';

export interface BatchResult extends OutputFile {
  width?: number;
  height?: number;
}

export interface BatchItem {
  id: number;
  file: File;
  status: 'queued' | 'working' | 'done' | 'error';
  result?: BatchResult;
  error?: string;
  thumbUrl?: string;
  row?: HTMLElement;
}

export interface BatchOptions {
  ctx: ToolContext;
  accept: string[];
  /** Process one file. Throw to mark it as failed. */
  process: (file: File, onProgress: (f: number) => void, signal: AbortSignal) => Promise<BatchResult>;
  /** Label for the run button, e.g. "Compress". */
  actionLabel: string;
  zipName: string;
  /** Called after each successful item (e.g. to update a preview). */
  onResult?: (item: BatchItem) => void;
  /** Called when the user clicks a finished row. */
  onSelect?: (item: BatchItem) => void;
  /** Called whenever the file list changes. */
  onFilesChange?: (items: BatchItem[]) => void;
  /** Show size difference (compression tools). */
  showSaving?: boolean;
  concurrency?: number;
  /** Automatically start processing when files are added. */
  autoRun?: boolean;
}

export interface BatchHandle {
  el: HTMLElement;
  items: () => BatchItem[];
  addFiles: (files: File[]) => void;
  run: () => Promise<void>;
  /** Mark all results stale (options changed). */
  invalidate: () => void;
}

let nextId = 1;

export function createBatch(opts: BatchOptions): BatchHandle {
  const { ctx } = opts;
  let items: BatchItem[] = [];
  let running = false;
  let runController: AbortController | null = null;

  const list = h('ul', { class: 'file-list', 'aria-label': 'Files' });
  const overall = progress('Processing…');
  const summary = h('div', { class: 'batch-summary', hidden: true, role: 'status' });
  const runBtn = button(opts.actionLabel, { variant: 'primary', icon: 'zap', size: 'lg', onClick: () => void run() });
  const cancelBtn = button('Cancel', { variant: 'secondary', icon: 'x', onClick: () => runController?.abort() });
  cancelBtn.hidden = true;
  const clearBtn = button('Clear all', { variant: 'ghost', icon: 'trash', onClick: () => setItems([]) });
  const dlAllBtn = button('Download All', { variant: 'primary', icon: 'download', onClick: () => void dlAll() });
  dlAllBtn.hidden = true;
  const actions = h('div', { class: 'toolbar' }, runBtn, cancelBtn, dlAllBtn, h('span', { class: 'toolbar-end' }, clearBtn));

  const zone = dropzone({ accept: opts.accept, multiple: true, onFiles: (f) => addFiles(f), compact: true, paste: true, title: 'Drop files here', subtitle: 'or' });
  const body = h('div', { class: 'batch-body', hidden: true }, actions, overall.el, summary, list);
  const el = h('div', { class: 'batch' }, zone, body);

  const releaseThumb = (it: BatchItem) => {
    if (it.thumbUrl) ctx.revokeUrl(it.thumbUrl);
    it.thumbUrl = undefined;
  };
  ctx.onCleanup(() => {
    runController?.abort();
    items.forEach(releaseThumb);
  });

  function setItems(next: BatchItem[]) {
    for (const it of items) if (!next.includes(it)) releaseThumb(it);
    items = next;
    draw();
    opts.onFilesChange?.(items);
  }

  function addFiles(files: File[]) {
    const fresh = files.map<BatchItem>((file) => ({ id: nextId++, file, status: 'queued' }));
    setItems([...items, ...fresh]);
    if (opts.autoRun) void run();
  }

  function rowFor(it: BatchItem): HTMLElement {
    const isImage = guessKind(it.file) === 'image';
    if (isImage && !it.thumbUrl && items.length <= 300) it.thumbUrl = ctx.objectUrl(it.file);
    const thumb = h('div', { class: 'file-thumb' }, it.thumbUrl ? h('img', { src: it.thumbUrl, alt: '', loading: 'lazy', decoding: 'async' }) : icon('file'));
    const meta = h('div', { class: 'file-meta' });
    const res = it.result;
    if (it.status === 'done' && res) {
      const pct = percentChange(it.file.size, res.blob.size);
      append(meta, [
        h('span', null, formatBytes(it.file.size)),
        h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'),
        h('span', null, formatBytes(res.blob.size)),
        opts.showSaving ? h('span', { class: pct <= 0 ? 'saving' : 'growing' }, formatPercent(pct)) : null,
        res.width ? h('span', null, `${res.width}×${res.height}`) : null,
        res.note ? h('span', null, res.note) : null,
      ]);
    } else if (it.status === 'error') {
      meta.append(h('span', { class: 'status-err' }, it.error ?? 'Failed'));
    } else {
      meta.append(h('span', null, formatBytes(it.file.size)), h('span', null, it.status === 'working' ? 'Processing…' : 'Ready'));
    }
    const actionsEl = h(
      'div',
      { class: 'file-actions' },
      it.status === 'done' && res
        ? button('', { variant: 'secondary', icon: 'download', size: 'sm', ariaLabel: `Download ${res.name}`, title: 'Download', onClick: (e) => { e.stopPropagation(); void downloadBlob(res.blob, res.name); } })
        : null,
      iconButton('x', `Remove ${it.file.name}`, (e) => {
        e.stopPropagation();
        setItems(items.filter((x) => x !== it));
      }),
    );
    const name = it.status === 'done' && res ? res.name : it.file.name;
    const row = h(
      'li',
      {
        class: ['file-row', it.status === 'error' && 'is-error', opts.onSelect && it.status === 'done' && 'is-clickable'],
        tabindex: opts.onSelect && it.status === 'done' ? '0' : undefined,
        'aria-label': opts.onSelect && it.status === 'done' ? `${name}: show preview` : undefined,
      },
      thumb,
      h('div', { class: 'file-info' }, h('span', { class: 'file-name', title: name }, name), meta),
      actionsEl,
    );
    if (opts.onSelect && it.status === 'done') {
      row.addEventListener('click', () => opts.onSelect!(it));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          opts.onSelect!(it);
        }
      });
    }
    it.row = row;
    return row;
  }

  function updateRow(it: BatchItem) {
    const old = it.row;
    const fresh = rowFor(it);
    if (old?.isConnected) old.replaceWith(fresh);
  }

  function draw() {
    body.hidden = items.length === 0;
    render(list, ...items.map(rowFor));
    const done = items.filter((i) => i.status === 'done');
    dlAllBtn.hidden = done.length === 0;
    dlAllBtn.querySelector('span')!.textContent = done.length > 1 ? `Download All (${done.length}) as ZIP` : 'Download';
    const pending = items.filter((i) => i.status !== 'done').length;
    runBtn.querySelector('span')!.textContent = pending && done.length ? `${opts.actionLabel} remaining ${pending}` : items.length > 1 ? `${opts.actionLabel} all ${items.length} files` : opts.actionLabel;
    runBtn.disabled = running || pending === 0;
    drawSummary();
  }

  function drawSummary() {
    const done = items.filter((i) => i.status === 'done' && i.result);
    const failed = items.filter((i) => i.status === 'error').length;
    if (!done.length && !failed) {
      summary.hidden = true;
      return;
    }
    const before = done.reduce((s, i) => s + i.file.size, 0);
    const after = done.reduce((s, i) => s + i.result!.blob.size, 0);
    render(
      summary,
      h('span', null, `${done.length} of ${items.length} done`, failed ? ` · ${failed} failed` : ''),
      done.length ? h('span', null, `${formatBytes(before)} → ${formatBytes(after)}`, opts.showSaving ? ` (${formatPercent(percentChange(before, after))})` : '') : null,
    );
    summary.hidden = false;
  }

  async function run() {
    if (running) return;
    const queue = items.filter((i) => i.status !== 'done');
    if (!queue.length) return;
    running = true;
    runController = new AbortController();
    const signal = runController.signal;
    const onUnmount = () => runController?.abort();
    ctx.signal.addEventListener('abort', onUnmount, { once: true });
    runBtn.disabled = true;
    cancelBtn.hidden = false;
    const fractions = new Map<number, number>();
    const total = queue.length;
    const tick = () => {
      const sum = [...fractions.values()].reduce((a, b) => a + b, 0);
      overall.set(sum / total, `Processing ${Math.min(total, [...fractions.values()].filter((v) => v >= 1).length + 1)} of ${total}…`);
    };
    overall.set(0, `Processing 1 of ${total}…`);
    const usedNames = new Set(items.filter((i) => i.status === 'done' && i.result).map((i) => i.result!.name));
    let index = 0;
    const worker = async () => {
      while (index < queue.length && !signal.aborted) {
        const it = queue[index++];
        if (!items.includes(it)) continue;
        it.status = 'working';
        it.error = undefined;
        updateRow(it);
        try {
          const res = await opts.process(it.file, (f) => {
            fractions.set(it.id, f);
            tick();
          }, signal);
          res.name = uniqueName(res.name, usedNames);
          it.result = res;
          it.status = 'done';
          opts.onResult?.(it);
        } catch (e) {
          if (isAbort(e) || signal.aborted) {
            it.status = 'queued';
          } else {
            it.status = 'error';
            const f = describeError(e);
            it.error = f.message && f.title === 'Something went wrong.' ? `${f.title} ${f.message}` : f.title;
            console.warn(e);
          }
        }
        fractions.set(it.id, 1);
        tick();
        updateRow(it);
        drawSummary();
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 2, queue.length)) }, worker));
    } finally {
      ctx.signal.removeEventListener('abort', onUnmount);
      running = false;
      cancelBtn.hidden = true;
      overall.hide();
      if (!ctx.signal.aborted) {
        draw();
        const ok = items.filter((i) => i.status === 'done').length;
        if (signal.aborted) toast('Processing cancelled', 'info');
        else {
          announce(`${ok} of ${items.length} files processed.`);
          if (ok) ctx.recordUse();
        }
      }
    }
  }

  async function dlAll() {
    const done = items.filter((i) => i.status === 'done' && i.result).map((i) => i.result!);
    if (!done.length) return;
    dlAllBtn.disabled = true;
    try {
      if (done.length > 1) overall.set(0, 'Creating ZIP…');
      await downloadAll(done, opts.zipName, (f) => overall.set(f, 'Creating ZIP…'));
    } catch (e) {
      toast(describeError(e).title, 'error');
    } finally {
      overall.hide();
      dlAllBtn.disabled = false;
    }
  }

  function invalidate() {
    let changed = false;
    for (const it of items) {
      if (it.status === 'done' || it.status === 'error') {
        it.status = 'queued';
        it.result = undefined;
        changed = true;
      }
    }
    if (changed) draw();
  }

  if (ctx.initialFiles.length) queueMicrotask(() => {
    const ok = filterAccepted(ctx.initialFiles, opts.accept).ok;
    if (ok.length) addFiles(ok);
  });

  return { el, items: () => items, addFiles, run, invalidate };
}
