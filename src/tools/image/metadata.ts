import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { kvTable, errorPanel, notice, button } from '../../components/ui';
import { decodeImage } from '../../services/imageService';
import { detectFileType } from '../../utils/fileType';
import { formatBytes, formatDate } from '../../utils/format';
import { copyText } from '../../services/download';
import { plural, t, translateMessage } from '../../i18n/i18n';

const GROUP_NAMES: Record<string, string> = {
  ifd0: 'Camera & image (IFD0)',
  exif: 'EXIF',
  gps: 'GPS',
  iptc: 'IPTC',
  xmp: 'XMP',
  interop: 'Interoperability',
  ifd1: 'Thumbnail (IFD1)',
  jfif: 'JFIF',
  ihdr: 'PNG header',
  icc: 'ICC colour profile',
};

function fmtValue(v: unknown): string {
  if (v instanceof Date) return formatDate(v);
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return `[binary, ${(v as ArrayBufferView).byteLength} bytes]`;
  if (Array.isArray(v)) return v.length > 16 ? `[${v.slice(0, 16).map(fmtValue).join(', ')}, …]` : v.map(fmtValue).join(', ');
  if (v && typeof v === 'object') return JSON.stringify(v).slice(0, 500);
  const s = String(v);
  return s.length > 500 ? `${s.slice(0, 500)}…` : s;
}

export const mount: ToolModule['mount'] = (root: HTMLElement, ctx: ToolContext) => {
  const out = h('div', { class: 'tool-main', 'aria-live': 'polite' });
  const zone = dropzone({ accept: ctx.meta.supportedFormats, multiple: false, onFiles: (f) => void inspect(f[0]), paste: true });
  root.append(zone, out);

  async function inspect(file: File) {
    render(out, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('Reading metadata…')));
    try {
      const type = await detectFileType(file);
      let dims = '—';
      try {
        const d = await decodeImage(file);
        dims = `${d.width} × ${d.height} px (${((d.width * d.height) / 1e6).toFixed(2)} MP)`;
        d.close();
      } catch {
        dims = t('Could not decode in this browser');
      }
      const basic = kvTable([
        [t('File name'), h('span', { class: 'break' }, file.name)],
        [t('Dimensions'), dims],
        [t('Format (detected)'), translateMessage(type.detected.label)],
        [t('MIME type'), file.type || type.detected.mime],
        [t('File size'), `${formatBytes(file.size)} (${plural(file.size, 'byte')})`],
        [t('Last modified'), formatDate(file.lastModified)],
      ], t('Basic information'));

      let groups: Record<string, Record<string, unknown>> = {};
      let exifError: string | null = null;
      try {
        const exifr = (await import('exifr')).default;
        const parsed = await exifr.parse(file, {
          tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: false, jfif: true, ihdr: true, interop: true, ifd1: false,
          mergeOutput: false, translateValues: true, reviveValues: true, sanitize: true,
        } as Record<string, unknown>);
        groups = (parsed ?? {}) as Record<string, Record<string, unknown>>;
      } catch (e) {
        exifError = (e as Error).message;
      }
      let gps: { latitude: number; longitude: number } | null = null;
      try {
        const exifr = (await import('exifr')).default;
        gps = (await exifr.gps(file)) ?? null;
        if (gps && !(Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude))) gps = null;
      } catch {
        gps = null;
      }

      const sections = Object.entries(groups)
        .filter(([, v]) => v && typeof v === 'object' && Object.keys(v).length)
        .map(([k, v]) => kvTable(Object.entries(v).map(([kk, vv]) => [kk, h('span', { class: 'break' }, fmtValue(vv))] as [string, HTMLElement]), GROUP_NAMES[k] ? t(GROUP_NAMES[k]) : k.toUpperCase()));

      const allJson = JSON.stringify(groups, (_k, v) => (ArrayBuffer.isView(v) ? `[binary ${(v as ArrayBufferView).byteLength} bytes]` : v), 2);
      render(
        out,
        basic,
        gps
          ? notice('warn', h('strong', null, t('This image contains a GPS location:')), ' ', `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}. `, h('a', { href: `https://www.openstreetmap.org/?mlat=${gps.latitude}&mlon=${gps.longitude}#map=15/${gps.latitude}/${gps.longitude}`, target: '_blank', rel: 'noopener noreferrer', 'data-external': '' }, t('Open in OpenStreetMap')), ' ', t('(opens an external site with the coordinates). Converting or compressing the image with this site removes EXIF data including GPS.'))
          : null,
        sections.length
          ? [...sections, h('div', { class: 'toolbar' }, button(t('Copy all metadata as JSON'), { icon: 'copy', onClick: () => void copyText(allJson) }))]
          : notice('info', exifError ? t('No readable EXIF/IPTC/XMP metadata ({error}).', { error: exifError }) : t('No EXIF, IPTC or XMP metadata was found in this file. That is normal for screenshots, PNG/GIF/WebP/SVG files and images shared via messengers.')),
        h('div', { class: 'toolbar' }, button(t('Inspect another image'), { variant: 'ghost', icon: 'upload', onClick: () => zone.querySelector('input')?.click() })),
      );
      ctx.recordUse();
    } catch (e) {
      render(out, errorPanel(e));
    }
  }

  if (ctx.initialFiles[0]) void inspect(ctx.initialFiles[0]);
};
