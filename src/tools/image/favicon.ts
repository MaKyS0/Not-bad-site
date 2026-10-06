import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, checkbox, slider, errorPanel, progress, textInput, field } from '../../components/ui';
import { decodeImage, type Decoded } from '../../services/imageService';
import { canvasToBlob, ctx2d, makeCanvas, releaseCanvas, scaleStepwise, type AnyCanvas } from '../../utils/imageCore';
import { encodeIco } from '../../utils/ico';
import { zipFiles } from '../../utils/zip';
import { downloadBlob, copyText } from '../../services/download';
import { colorField } from './shared';
import { formatBytes } from '../../utils/format';

interface Settings {
  padding: number;
  radius: number;
  fillBg: boolean;
  background: string;
  appName: string;
  themeColor: string;
}

const PNG_SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'favicon-96x96.png', size: 96 },
  { name: 'apple-touch-icon.png', size: 180, opaque: true },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];
const ICO_SIZES = [16, 32, 48];

const MASTER = 1024;

function renderMaster(src: Decoded, s: Settings, opaque: boolean): AnyCanvas {
  const c = makeCanvas(MASTER, MASTER);
  const ctx = ctx2d(c);
  const r = (s.radius / 100) * (MASTER / 2);
  if (s.fillBg || opaque) {
    ctx.fillStyle = s.fillBg ? s.background : '#ffffff';
    ctx.beginPath();
    if (r > 0 && !opaque) {
      ctx.moveTo(r, 0);
      ctx.arcTo(MASTER, 0, MASTER, MASTER, r);
      ctx.arcTo(MASTER, MASTER, 0, MASTER, r);
      ctx.arcTo(0, MASTER, 0, 0, r);
      ctx.arcTo(0, 0, MASTER, 0, r);
      ctx.closePath();
    } else ctx.rect(0, 0, MASTER, MASTER);
    ctx.fill();
  }
  const pad = (s.padding / 100) * MASTER;
  const box = MASTER - pad * 2;
  const k = Math.min(box / src.width, box / src.height);
  const w = Math.max(1, Math.round(src.width * k));
  const hh = Math.max(1, Math.round(src.height * k));
  const scaled = scaleStepwise(src.source, 0, 0, src.width, src.height, w, hh);
  ctx.drawImage(scaled as CanvasImageSource, Math.round((MASTER - w) / 2), Math.round((MASTER - hh) / 2));
  releaseCanvas(scaled);
  return c;
}

async function sizeTo(master: AnyCanvas, size: number): Promise<Blob> {
  const c = scaleStepwise(master, 0, 0, master.width, master.height, size, size);
  try {
    return await canvasToBlob(c, 'image/png');
  } finally {
    releaseCanvas(c);
  }
}

export function htmlSnippet(appName: string, themeColor: string): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${themeColor}">`,
    appName ? `<meta name="application-name" content="${appName.replace(/"/g, '&quot;')}">` : '',
  ].filter(Boolean).join('\n');
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings<Settings>({ padding: 0, radius: 0, fillBg: false, background: '#ffffff', appName: 'My Website', themeColor: '#ffffff' });
  let decoded: Decoded | null = null;
  let fileName = '';
  let outputs: { name: string; blob: Blob }[] = [];
  const urls: string[] = [];

  const out = h('div', { class: 'tool-main', 'aria-live': 'polite' });
  const prog = progress('Generating icons…');
  const zone = dropzone({ accept: ctx.meta.supportedFormats, multiple: false, onFiles: (f) => void load(f[0]), paste: true, subtitle: 'Square PNG or SVG, 512×512 px or larger works best' });

  const pad = slider('Padding', s.padding, { min: 0, max: 30, format: (v) => `${v}%`, onInput: (v) => { s.padding = v; changed(); } });
  const rad = slider('Corner radius', s.radius, { min: 0, max: 100, format: (v) => `${v}%`, onInput: (v) => { s.radius = v; changed(); } });
  const bgToggle = checkbox('Fill background', s.fillBg, (v) => { s.fillBg = v; bgField.hidden = !v; rad.el.hidden = !v; changed(); });
  const bgField = colorField('Background colour', s.background, (v) => { s.background = v; changed(); });
  bgField.hidden = !s.fillBg;
  rad.el.hidden = !s.fillBg;
  const nameIn = textInput(s.appName, { onInput: (v) => { s.appName = v; ctx.saveSettings(s); drawSnippet(); } });
  const themeField = colorField('Theme colour', s.themeColor, (v) => { s.themeColor = v; ctx.saveSettings(s); drawSnippet(); });
  const snippetBox = h('div');

  const options = h('aside', { class: 'tool-options panel', 'aria-label': 'Favicon options' },
    pad.el, bgToggle.el, bgField, rad.el, field('App name (manifest)', nameIn), themeField,
    h('p', { class: 'hint' }, 'The Apple touch icon always gets an opaque background because iOS renders transparency as black.'),
  );

  root.append(zone, h('div', { class: 'tool-layout' }, options, out));

  let timer: ReturnType<typeof setTimeout> | undefined;
  function changed() {
    ctx.saveSettings(s);
    clearTimeout(timer);
    timer = setTimeout(() => void generate(), 250);
  }

  function manifest(): string {
    return JSON.stringify({
      name: s.appName,
      short_name: s.appName,
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: s.themeColor,
      background_color: s.fillBg ? s.background : '#ffffff',
      display: 'standalone',
    }, null, 2);
  }

  function drawSnippet() {
    const code = htmlSnippet(s.appName, s.themeColor);
    render(snippetBox,
      h('div', { class: 'panel' },
        h('h2', { class: 'panel-title' }, 'HTML snippet'),
        h('p', { class: 'hint' }, 'Put the files in your site root and paste this inside <head>:'),
        h('pre', { class: 'code-view wrap' }, code),
        h('div', { class: 'toolbar', style: 'margin-top:8px' }, button('Copy HTML', { icon: 'copy', onClick: () => void copyText(code) })),
      ),
    );
  }

  async function load(f: File) {
    try {
      decoded?.close();
      decoded = await decodeImage(f, { svgWidth: MASTER });
      fileName = f.name;
      zone.hidden = true;
      await generate();
    } catch (e) {
      render(out, errorPanel(e, () => { zone.hidden = false; render(out); }));
    }
  }

  async function generate() {
    if (!decoded) return;
    prog.set(0, 'Generating icons…');
    try {
      const master = renderMaster(decoded, s, false);
      const masterOpaque = renderMaster(decoded, s, true);
      const files: { name: string; blob: Blob; size: number }[] = [];
      for (const [i, def] of PNG_SIZES.entries()) {
        files.push({ name: def.name, size: def.size, blob: await sizeTo(def.opaque ? masterOpaque : master, def.size) });
        prog.set((i + 1) / (PNG_SIZES.length + 2));
      }
      const icoPngs = await Promise.all(
        ICO_SIZES.map(async (size) => ({ size, png: new Uint8Array(await (files.find((f) => f.size === size)?.blob ?? (await sizeTo(master, size))).arrayBuffer()) })),
      );
      const ico = new Blob([encodeIco(icoPngs) as BlobPart], { type: 'image/x-icon' });
      releaseCanvas(master);
      releaseCanvas(masterOpaque);
      outputs = [{ name: 'favicon.ico', blob: ico }, ...files.map((f) => ({ name: f.name, blob: f.blob })), { name: 'site.webmanifest', blob: new Blob([manifest()], { type: 'application/manifest+json' }) }];
      urls.splice(0).forEach((u) => ctx.revokeUrl(u));
      const previews = files.filter((f) => f.size <= 192).map((f) => {
        const url = ctx.objectUrl(f.blob);
        urls.push(url);
        const shown = Math.min(f.size, 96);
        return h('div', { class: 'icon-preview' }, h('img', { src: url, width: shown, height: shown, alt: `${f.size}×${f.size} icon` }), `${f.size}px`);
      });
      render(
        out,
        h('div', { class: 'panel' },
          h('div', { class: 'toolbar', style: 'justify-content:space-between;margin-bottom:12px' },
            h('h2', { class: 'panel-title', style: 'margin:0' }, 'Preview — ', h('span', { class: 'muted break' }, fileName)),
            button('Use another image', { variant: 'ghost', icon: 'upload', onClick: () => { zone.hidden = false; zone.querySelector('input')?.click(); } }),
          ),
          h('div', { class: 'icon-previews' }, ...previews),
        ),
        h('div', { class: 'panel' },
          h('h2', { class: 'panel-title' }, 'Files'),
          h('ul', { class: 'entry-list' }, ...outputs.map((o) => h('li', { class: 'entry' }, h('span', null), h('span', { class: 'entry-name' }, o.name), h('span', { class: 'entry-size' }, formatBytes(o.blob.size)), h('span', { class: 'entry-actions' }, button('', { variant: 'ghost', size: 'sm', icon: 'download', ariaLabel: `Download ${o.name}`, onClick: () => void downloadBlob(o.blob, o.name) }))))),
          h('div', { class: 'toolbar', style: 'margin-top:12px' },
            button('Download all (ZIP)', { variant: 'primary', icon: 'download', size: 'lg', onClick: async () => {
              const zip = await zipFiles(outputs.map((o) => ({ name: o.name, data: o.blob })), { level: 6 });
              await downloadBlob(zip, 'favicons.zip');
              ctx.recordUse(s);
            } }),
            button('Download favicon.ico', { variant: 'secondary', icon: 'download', onClick: () => void downloadBlob(ico, 'favicon.ico') }),
          ),
        ),
        snippetBox,
        prog.el,
      );
      drawSnippet();
    } catch (e) {
      render(out, errorPanel(e, () => { zone.hidden = false; render(out); }));
    } finally {
      prog.hide();
    }
  }

  ctx.onCleanup(() => decoded?.close());
  if (ctx.initialFiles[0]) void load(ctx.initialFiles[0]);
};
