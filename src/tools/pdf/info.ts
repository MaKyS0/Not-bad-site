import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { kvTable, statGrid, errorPanel, button, notice } from '../../components/ui';
import { pdfWorker, readFileBytes, openPdfJs } from './lib';
import type { PdfInfo } from '../../utils/pdfOps';
import { formatBytes, formatDate } from '../../utils/format';
import { plural, t } from '../../i18n/i18n';

const PT_PER_MM = 72 / 25.4;
const PAPER: [string, number, number][] = [
  ['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210], [t('Letter'), 215.9, 279.4], [t('Legal'), 215.9, 355.6], [t('Tabloid'), 279.4, 431.8],
];

export function paperName(wPt: number, hPt: number): string {
  const w = wPt / PT_PER_MM;
  const hh = hPt / PT_PER_MM;
  const [a, b] = w < hh ? [w, hh] : [hh, w];
  const hit = PAPER.find(([, pw, ph]) => Math.abs(pw - a) < 3 && Math.abs(ph - b) < 3);
  const dims = `${w.toFixed(0)} × ${hh.toFixed(0)} mm`;
  return hit ? `${hit[0]} ${w > hh ? t('landscape') : t('portrait')} (${dims.replace('mm', t('mm'))})` : dims.replace('mm', t('mm'));
}

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'tool-main', 'aria-live': 'polite' });
  const zone = dropzone({ accept: ['pdf'], multiple: false, onFiles: (f) => void inspect(f[0]), paste: true, title: t('Drop a PDF here') });
  root.append(zone, out);

  async function inspect(file: File) {
    render(out, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('Reading PDF…')));
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
          [t('Linearized (fast web view)'), infoDict?.IsLinearized ? t('Yes') : t('No')],
          [t('AcroForm (fillable form)'), infoDict?.IsAcroFormPresent ? t('Yes') : t('No')],
          [t('XFA form'), infoDict?.IsXFAPresent ? t('Yes') : t('No')],
        ];
        const xmpTitle = meta.metadata?.get('dc:title');
        if (xmpTitle && !info.title) extra.unshift([t('Title (XMP)'), String(xmpTitle)]);
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
          [t('Pages'), info.pageCount.toLocaleString()],
          [t('File size'), formatBytes(file.size)],
          [t('PDF version'), info.version ?? '—'],
          [t('Encrypted'), info.encrypted ? t('Yes') : t('No')],
        ]),
        info.encrypted ? notice('warn', t('This PDF is encrypted. Metadata may be unreadable and editing tools (merge, split, rotate) cannot modify it.')) : null,
        kvTable([
          [t('File name'), h('span', { class: 'break' }, file.name)],
          [t('Title'), info.title || '—'],
          [t('Author'), info.author || '—'],
          [t('Subject'), info.subject || '—'],
          [t('Keywords'), info.keywords || '—'],
          [t('Creator (app)'), info.creator || '—'],
          [t('Producer'), info.producer || '—'],
          [t('Created'), info.creationDate ? formatDate(new Date(info.creationDate)) : '—'],
          [t('Modified'), info.modificationDate ? formatDate(new Date(info.modificationDate)) : '—'],
          ...extra,
        ], t('Document metadata')),
        kvTable([...sizes.entries()].map(([k, v]) => [k, plural(v, 'page')] as [string, string]).concat(rotated ? [[t('Rotated pages'), String(rotated)]] : []), t('Page sizes')),
        h('div', { class: 'toolbar' }, button(t('Inspect another PDF'), { variant: 'ghost', icon: 'upload', onClick: () => zone.querySelector('input')?.click() })),
      );
      ctx.recordUse();
    } catch (e) {
      render(out, errorPanel(e));
    }
  }
  if (ctx.initialFiles[0]) void inspect(ctx.initialFiles[0]);
};
