import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { kvTable, statGrid, errorPanel, button, notice } from '../../components/ui';
import { pdfWorker, readFileBytes, openPdfJs } from './lib';
import type { PdfInfo } from '../../utils/pdfOps';
import { formatBytes, formatDate } from '../../utils/format';

const PT_PER_MM = 72 / 25.4;
const PAPER: [string, number, number][] = [
  ['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210], ['Letter', 215.9, 279.4], ['Legal', 215.9, 355.6], ['Tabloid', 279.4, 431.8],
];

export function paperName(wPt: number, hPt: number): string {
  const w = wPt / PT_PER_MM;
  const hh = hPt / PT_PER_MM;
  const [a, b] = w < hh ? [w, hh] : [hh, w];
  const hit = PAPER.find(([, pw, ph]) => Math.abs(pw - a) < 3 && Math.abs(ph - b) < 3);
  const dims = `${w.toFixed(0)} × ${hh.toFixed(0)} mm`;
  return hit ? `${hit[0]} ${w > hh ? 'landscape' : 'portrait'} (${dims})` : dims;
}

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'tool-main', 'aria-live': 'polite' });
  const zone = dropzone({ accept: ['pdf'], multiple: false, onFiles: (f) => void inspect(f[0]), paste: true, title: 'Drop a PDF here' });
  root.append(zone, out);

  async function inspect(file: File) {
    render(out, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Reading PDF…'));
    try {
      const bytes = await readFileBytes(file);
      const info = await pdfWorker().call<PdfInfo>('info', { bytes: bytes.slice() }, { signal: ctx.signal });
      // pdf.js gives extra details (XMP metadata, tagged/linearized flags) when it can open the file.
      let extra: [string, string][] = [];
      try {
        const doc = await openPdfJs(bytes);
        const meta = await doc.getMetadata();
        const infoDict = meta.info as Record<string, unknown>;
        extra = [
          ['Linearized (fast web view)', infoDict?.IsLinearized ? 'Yes' : 'No'],
          ['AcroForm (fillable form)', infoDict?.IsAcroFormPresent ? 'Yes' : 'No'],
          ['XFA form', infoDict?.IsXFAPresent ? 'Yes' : 'No'],
        ];
        const xmpTitle = meta.metadata?.get('dc:title');
        if (xmpTitle && !info.title) extra.unshift(['Title (XMP)', String(xmpTitle)]);
        await doc.loadingTask.destroy();
      } catch {
        extra = [];
      }
      const sizes = new Map<string, number>();
      for (const p of info.pages) {
        const key = paperName(p.width, p.height);
        sizes.set(key, (sizes.get(key) ?? 0) + 1);
      }
      const rotated = info.pages.filter((p) => p.rotation).length;
      render(
        out,
        statGrid([
          ['Pages', info.pageCount.toLocaleString()],
          ['File size', formatBytes(file.size)],
          ['PDF version', info.version ?? '—'],
          ['Encrypted', info.encrypted ? 'Yes' : 'No'],
        ]),
        info.encrypted ? notice('warn', 'This PDF is encrypted. Metadata may be unreadable and editing tools (merge, split, rotate) cannot modify it.') : null,
        kvTable([
          ['File name', h('span', { class: 'break' }, file.name)],
          ['Title', info.title || '—'],
          ['Author', info.author || '—'],
          ['Subject', info.subject || '—'],
          ['Keywords', info.keywords || '—'],
          ['Creator (app)', info.creator || '—'],
          ['Producer', info.producer || '—'],
          ['Created', info.creationDate ? formatDate(new Date(info.creationDate)) : '—'],
          ['Modified', info.modificationDate ? formatDate(new Date(info.modificationDate)) : '—'],
          ...extra,
        ], 'Document metadata'),
        kvTable([...sizes.entries()].map(([k, v]) => [k, `${v} page${v > 1 ? 's' : ''}`] as [string, string]).concat(rotated ? [['Rotated pages', String(rotated)]] : []), 'Page sizes'),
        h('div', { class: 'toolbar' }, button('Inspect another PDF', { variant: 'ghost', icon: 'upload', onClick: () => zone.querySelector('input')?.click() })),
      );
      ctx.recordUse();
    } catch (e) {
      render(out, errorPanel(e));
    }
  }
  if (ctx.initialFiles[0]) void inspect(ctx.initialFiles[0]);
};
