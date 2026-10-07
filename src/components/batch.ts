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
import { plural, t } from '../i18n/i18n';
import { enter, nudge, pop } from '../utils/motion';

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

  const list = h('ul', { class: 'file-list', 'aria-label': t('Files') });
  const overall = progress(t('Processing…'));
  const summary = h('div', { class: 'batch-summary', hidden: true, role: 'status' });
  const runBtn = button(opts.actionLabel, { variant: 'primary', icon: 'zap', size: 'lg', onClick: () => void run() });
  const cancelBtn = button(t('Cancel'), { variant: 'secondary', icon: 'x', onClick: () => runController?.abort() });
  cancelBtn.hidden = true;
  const clearBtn = button(t('Clear all'), { variant: 'ghost', icon: 'trash', onClick: () => setItems([]) });
  const dlAllBtn = button(t('Download All'), { variant: 'primary', icon: 'download', onClick: () => void dlAll() });
  dlAllBtn.hidden = true;
  const actions = h('div', { class: 'toolbar batch-actions' }, runBtn, cancelBtn, dlAllBtn, h('span', { class: 'toolbar-end' }, clearBtn));

  const zone = dropzone({ accept: opts.accept, multiple: true, onFiles: (f) => addFiles(f), compact: true, paste: true });
  const body = h('div', { class: 'batch-body', hidden: true }, overall.el, summary, list, actions);
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
    enter(fresh.map((f) => f.row).filter((r): r is HTMLElement => Boolean(r)), { y: 6 });
    if (opts.autoRun) void run();
  }

  function rowFor(it: BatchItem): HTMLElement {
    const isImage = guessKind(it.file) === 'image';
    if (isImage && !it.thumbUrl && items.length <= 300) {
      it.thumbUrl = 'pending';
      void ctx.imageUrl(it.file).then((u) => {
        it.thumbUrl = u;
        document.querySelectorAll<HTMLImageElement>(`img[data-thumb="${it.id}"]`).forEach((img) => (img.src = u));
      }, () => (it.thumbUrl = undefined));
    }
    const ready = it.thumbUrl && it.thumbUrl !== 'pending' ? it.thumbUrl : undefined;
    const thumb = h('div', { class: 'file-thumb' }, it.thumbUrl ? h('img', { src: ready, alt: '', loading: 'lazy', decoding: 'async', 'data-thumb': String(it.id) }) : icon('file'));
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
      meta.append(h('span', { class: 'status-err' }, it.error ?? t('Failed')));
    } else {
      meta.append(h('span', null, formatBytes(it.file.size)), h('span', null, it.status === 'working' ? t('Processing…') : t('Ready')));
    }
    const actionsEl = h(
      'div',
      { class: 'file-actions' },
      it.status === 'done' && res
        ? button('', { variant: 'secondary', icon: 'download', size: 'sm', ariaLabel: t('Download {name}', { name: res.name }), title: t('Download'), onClick: (e) => { e.stopPropagation(); void downloadBlob(res.blob, res.name); } })
        : null,
      iconButton('x', t('Remove {name}', { name: it.file.name }), (e) => {
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
        'aria-label': opts.onSelect && it.status === 'done' ? t('{name}: show preview', { name }) : undefined,
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
    // Draw the eye to the result the moment a file finishes.
    if (it.status === 'done' && !old?.querySelector('.saving, .growing')) nudge(fresh.querySelector('.saving, .growing'), { scale: 1.12 });
  }

  function draw() {
    body.hidden = items.length === 0;
    render(list, ...items.map(rowFor));
    const done = items.filter((i) => i.status === 'done');
    dlAllBtn.hidden = done.length === 0;
    dlAllBtn.querySelector('span')!.textContent = done.length > 1 ? t('Download All ({n}) as ZIP', { n: done.length }) : t('Download');
    const pending = items.filter((i) => i.status !== 'done').length;
    runBtn.querySelector('span')!.textContent = pending && done.length ? t('{action} remaining ({n})', { action: opts.actionLabel, n: pending }) : items.length > 1 ? t('{action} all ({files})', { action: opts.actionLabel, files: plural(items.length, 'file') }) : opts.actionLabel;
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
      h('span', null, t('{done} of {total} done', { done: done.length, total: items.length }), failed ? ` · ${t('{n} failed', { n: failed })}` : ''),
      done.length ? h('span', null, `${formatBytes(before)} → ${formatBytes(after)}`, opts.showSaving ? ` (${formatPercent(percentChange(before, after))})` : '') : null,
    );
    if (summary.hidden) pop(summary);
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
      overall.set(sum / total, t('Processing {i} of {n}…', { i: Math.min(total, [...fractions.values()].filter((v) => v >= 1).length + 1), n: total }));
    };
    overall.set(0, t('Processing {i} of {n}…', { i: 1, n: total }));
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
            it.error = f.message && f.details ? `${f.title} ${f.message}` : f.title;
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
        if (signal.aborted) toast(t('Processing cancelled'), 'info');
        else {
          const failed = items.filter((i) => i.status === 'error').length;
          announce(t('{done} of {total} done', { done: ok, total: items.length }));
          if (ok) {
            ctx.recordUse();
            toast(failed ? t('Done: {ok}, failed: {failed}', { ok, failed }) : t('Done! {files} processed.', { files: plural(ok, 'file') }), failed ? 'error' : 'success');
            // Bring the results into view (useful on phones).
            const r = summary.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight) summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  }

  async function dlAll() {
    const done = items.filter((i) => i.status === 'done' && i.result).map((i) => i.result!);
    if (!done.length) return;
    dlAllBtn.disabled = true;
    try {
      if (done.length > 1) overall.set(0, t('Creating ZIP…'));
      await downloadAll(done, opts.zipName, (f) => overall.set(f, t('Creating ZIP…')));
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
