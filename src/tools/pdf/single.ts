/**
 * Common shell for tools that work on ONE PDF: drop zone → load with pdf.js
 * (page count, thumbnails) → tool-specific UI.
 */
import { h, render } from '../../utils/dom';
import type { ToolContext } from '../types';
import { dropzone } from '../../components/dropzone';
import { errorPanel, button } from '../../components/ui';
import { openPdfJs, readFileBytes } from './lib';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { formatBytes } from '../../utils/format';

export interface LoadedPdf {
  file: File;
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
}

export function singlePdfTool(root: HTMLElement, ctx: ToolContext, onLoad: (pdf: LoadedPdf, area: HTMLElement) => void | (() => void)): void {
  const area = h('div', { class: 'tool-main' });
  let current: LoadedPdf | null = null;
  let dispose: (() => void) | void;
  const zone = dropzone({ accept: ['pdf'], multiple: false, onFiles: (f) => void load(f[0]), paste: true, title: 'Drop a PDF here' });
  root.append(zone, area);

  const cleanup = () => {
    if (dispose) dispose();
    dispose = undefined;
    if (current) void current.doc.loadingTask.destroy();
    current = null;
  };
  ctx.onCleanup(cleanup);

  async function load(file: File) {
    cleanup();
    render(area, h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner' }), 'Opening PDF…'));
    try {
      const bytes = await readFileBytes(file);
      const doc = await openPdfJs(bytes);
      current = { file, bytes, doc };
      zone.hidden = true;
      const content = h('div', { class: 'tool-main' });
      render(
        area,
        h('div', { class: 'toolbar', style: 'justify-content:space-between' },
          h('p', { class: 'muted', style: 'margin:0' }, h('strong', { class: 'break' }, file.name), ` · ${doc.numPages} page${doc.numPages === 1 ? '' : 's'} · ${formatBytes(file.size)}`),
          button('Open another PDF', { variant: 'ghost', icon: 'upload', onClick: () => { zone.hidden = false; zone.querySelector('input')?.click(); } }),
        ),
        content,
      );
      dispose = onLoad(current, content);
    } catch (e) {
      render(area, errorPanel(e, () => { zone.hidden = false; render(area); zone.querySelector('input')?.click(); }));
    }
  }

  if (ctx.initialFiles[0]) void load(ctx.initialFiles[0]);
}
