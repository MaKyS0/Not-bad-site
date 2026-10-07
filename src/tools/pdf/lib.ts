/**
 * Shared PDF helpers for the PDF tools: worker client for pdf-lib operations,
 * lazy pdf.js loading for rendering, and reusable UI (page thumbnails grid,
 * sortable file list).
 */
import { WorkerPool } from '../../workers/rpc';
import { h, render } from '../../utils/dom';
import { icon } from '../../components/icons';
import { iconButton } from '../../components/ui';
import { assetUrl } from '../../utils/base';
import { UserError } from '../../utils/errors';
import { MAX_PAGES, tooManyPages } from '../../utils/pdfLimits';
import { formatBytes } from '../../utils/format';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { t } from '../../i18n/i18n';

let pool: WorkerPool | null = null;
export function pdfWorker(): WorkerPool {
  pool ??= new WorkerPool(() => new Worker(new URL('../../workers/pdfops.worker.ts', import.meta.url), { type: 'module' }), 1, 60_000);
  return pool;
}

export const pdfBlob = (bytes: Uint8Array): Blob => new Blob([bytes as BlobPart], { type: 'application/pdf' });

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= (async () => {
    const [lib, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return pdfjsPromise;
}

/** Open a PDF with pdf.js for rendering. The buffer is copied (pdf.js transfers it). */
export async function openPdfJs(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const lib = await loadPdfJs();
  const task = lib.getDocument({
    data: bytes.slice(),
    password,
    cMapUrl: assetUrl('pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('pdfjs/standard_fonts/'),
    wasmUrl: assetUrl('pdfjs/wasm/'),
    iccUrl: assetUrl('pdfjs/iccs/'),
    // Hardening against crafted PDFs: never run XFA forms, and skip embedded
    // images above 100 megapixels (decompression bombs) instead of decoding them.
    enableXfa: false,
    maxImageSize: 100_000_000,
  });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'PasswordException') throw new UserError(t('This PDF is password-protected.'), 'Opening PDFs that require a password is not supported here.');
    if (name === 'InvalidPDFException') throw new UserError(t('This file is not a valid PDF.'), 'The file may be damaged or have a wrong extension.');
    throw e;
  }
  if (doc.numPages > MAX_PAGES) {
    void task.destroy();
    throw tooManyPages();
  }
  return doc;
}

/** Canvases above this many pixels fail or exhaust memory in most browsers. */
const MAX_CANVAS_PIXELS = 50_000_000;

/** Render one page to a canvas at the given scale (1 = 72 dpi). */
export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, scale: number, extraRotation = 0): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  try {
    const rotation = (page.rotate + extraRotation) % 360;
    let viewport = page.getViewport({ scale, rotation });
    // Absurd page sizes (MediaBox of 1e8 pt) would request gigantic canvases.
    if (viewport.width * viewport.height > MAX_CANVAS_PIXELS) viewport = page.getViewport({ scale: scale * Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)), rotation });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas;
  } finally {
    page.cleanup();
  }
}

export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/* ---------------- Page thumbnails grid ---------------- */

export interface PageGrid {
  el: HTMLElement;
  selected: Set<number>;
  setSelected(pages: Iterable<number>): void;
  setRotation(page: number, deg: number): void;
  destroy(): void;
}

export function pageGrid(doc: PDFDocumentProxy, opts: { selectable?: boolean; onChange?: (sel: Set<number>) => void; initialSelected?: Iterable<number> } = {}): PageGrid {
  const selected = new Set<number>(opts.initialSelected ?? []);
  const rotations = new Map<number, number>();
  const list = h('ul', { class: 'page-grid', role: 'list', 'aria-label': t('Pages') });
  const cards: HTMLButtonElement[] = [];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const card = e.target as HTMLElement;
        const n = Number(card.dataset.page);
        const holder = card.querySelector('.page-thumb')!;
        renderPage(doc, n, 0.35)
          .then((c) => {
            // scale down to a thumbnail-sized bitmap to save memory
            c.style.transform = `rotate(${rotations.get(n) ?? 0}deg)`;
            render(holder, c);
          })
          .catch(() => render(holder, icon('alert')));
      }
    },
    { rootMargin: '400px' },
  );

  for (let n = 1; n <= doc.numPages; n++) {
    const card = h(
      'button',
      { type: 'button', class: 'page-card', dataset: { page: String(n) }, 'aria-pressed': opts.selectable ? String(selected.has(n)) : undefined, 'aria-label': `Page ${n}` },
      h('span', { class: 'page-thumb' }, h('span', { class: 'spinner', 'aria-hidden': 'true' })),
      h('span', null, `Page ${n}`),
      opts.selectable ? h('span', { class: 'check-badge', 'aria-hidden': 'true' }, icon('check')) : null,
    );
    if (opts.selectable) {
      card.addEventListener('click', () => {
        if (selected.has(n)) selected.delete(n);
        else selected.add(n);
        card.setAttribute('aria-pressed', String(selected.has(n)));
        opts.onChange?.(selected);
      });
    } else card.tabIndex = -1;
    cards.push(card);
    list.append(h('li', null, card));
    io.observe(card);
  }

  return {
    el: list,
    selected,
    setSelected(pages) {
      selected.clear();
      for (const p of pages) selected.add(p);
      cards.forEach((c, i) => c.setAttribute('aria-pressed', String(selected.has(i + 1))));
    },
    setRotation(page, deg) {
      rotations.set(page, deg);
      const card = cards[page - 1];
      const canvas = card?.querySelector('canvas');
      if (canvas) canvas.style.transform = `rotate(${deg}deg)`;
      let badge = card?.querySelector('.rot-badge');
      if (!badge && card) {
        badge = h('span', { class: 'badge badge-warn rot-badge' });
        card.append(badge);
      }
      if (badge) {
        badge.textContent = deg ? `↻ ${deg}°` : '';
        (badge as HTMLElement).hidden = !deg;
      }
    },
    destroy() {
      io.disconnect();
    },
  };
}

/* ---------------- Sortable list (merge / images → PDF) ---------------- */

export interface SortItem {
  id: number;
  file: File;
  thumbUrl?: string;
  meta?: string;
}

/** Reorderable list: drag & drop (pointer), plus up/down buttons for keyboard and touch. */
export function sortableList(items: SortItem[], onChange: (items: SortItem[]) => void, onRemove: (item: SortItem) => void): HTMLElement {
  const list = h('ol', { class: 'sort-list', 'aria-label': t('Order of files') });
  let dragIndex = -1;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
    requestAnimationFrame(() => (list.children[to]?.querySelector(to > from ? '[data-dir="down"]' : '[data-dir="up"]') as HTMLElement | null)?.focus());
  };
  items.forEach((it, i) => {
    const up = iconButton('up', t('Move {name} up', { name: it.file.name }), () => move(i, i - 1));
    up.dataset.dir = 'up';
    up.disabled = i === 0;
    const down = iconButton('down', t('Move {name} down', { name: it.file.name }), () => move(i, i + 1));
    down.dataset.dir = 'down';
    down.disabled = i === items.length - 1;
    const li = h(
      'li',
      { class: 'sort-item', draggable: 'true' },
      h('span', { class: 'sort-index' }, String(i + 1)),
      h('span', { class: 'sort-thumb' }, it.thumbUrl !== undefined ? h('img', { src: it.thumbUrl || undefined, alt: '', loading: 'lazy', 'data-thumb': String(it.id) }) : icon('pdf')),
      h('span', { class: 'file-info' }, h('span', { class: 'file-name', title: it.file.name }, it.file.name), h('span', { class: 'file-meta' }, formatBytes(it.file.size), it.meta ? ` · ${it.meta}` : '')),
      h('span', { class: 'sort-actions' }, up, down, iconButton('trash', `Remove ${it.file.name}`, () => onRemove(it))),
    );
    li.addEventListener('dragstart', (e) => {
      dragIndex = i;
      li.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', String(i));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => {
      if (dragIndex < 0) return;
      e.preventDefault();
      li.classList.add('drop-target');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', (e) => {
      if (dragIndex < 0) return;
      e.preventDefault();
      e.stopPropagation();
      li.classList.remove('drop-target');
      const from = dragIndex;
      dragIndex = -1;
      move(from, i);
    });
    list.append(li);
  });
  return list;
}
