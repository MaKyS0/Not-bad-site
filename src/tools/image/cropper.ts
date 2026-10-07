import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, field, numberInput, segmented, slider, errorPanel, progress } from '../../components/ui';
import { decodeImage, processImage, isSvg } from '../../services/imageService';
import { formatSelect, outputTypeFor, outputName, type FormatChoice } from './shared';
import { downloadBlob } from '../../services/download';
import { formatBytes } from '../../utils/format';
import { t } from '../../i18n/i18n';

type Ratio = 'free' | '1:1' | '4:3' | '16:9' | '9:16' | '3:2' | 'custom';
interface Rect { x: number; y: number; w: number; h: number }

interface Settings {
  ratio: Ratio;
  customW: number;
  customH: number;
  format: FormatChoice;
  quality: number;
}

/** Clamp a rect to the image and optionally enforce an aspect ratio. Exported for tests. */
export function clampRect(r: Rect, iw: number, ih: number, ratio: number | null, anchor: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move' = 'se'): Rect {
  let { x, y, w, h: hh } = r;
  w = Math.max(1, Math.min(w, iw));
  hh = Math.max(1, Math.min(hh, ih));
  if (ratio) {
    if (anchor === 'n' || anchor === 's') w = hh * ratio;
    else hh = w / ratio;
    if (w > iw) { w = iw; hh = w / ratio; }
    if (hh > ih) { hh = ih; w = hh * ratio; }
  }
  if (anchor !== 'move') {
    // keep the opposite corner fixed when resizing from left/top
    if (anchor.includes('w')) x = r.x + r.w - w;
    if (anchor.includes('n')) y = r.y + r.h - hh;
  }
  x = Math.max(0, Math.min(x, iw - w));
  y = Math.max(0, Math.min(y, ih - hh));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) };
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings<Settings>({ ratio: 'free', customW: 3, customH: 2, format: 'keep', quality: 92 });
  const save = () => ctx.saveSettings(s);
  let file: File | null = null;
  let iw = 0;
  let ih = 0;
  let rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let imgUrl = '';
  let resultUrl = '';

  const ratioValue = (): number | null => {
    switch (s.ratio) {
      case '1:1': return 1;
      case '4:3': return 4 / 3;
      case '16:9': return 16 / 9;
      case '9:16': return 9 / 16;
      case '3:2': return 3 / 2;
      case 'custom': return s.customW > 0 && s.customH > 0 ? s.customW / s.customH : null;
      default: return null;
    }
  };

  const area = h('div', { class: 'tool-main' });
  const options = h('aside', { class: 'tool-options panel', 'aria-label': t('Crop options'), hidden: true });
  const zone = dropzone({ accept: ctx.meta.supportedFormats, multiple: false, onFiles: (f) => void load(f[0]), paste: true });
  root.append(zone, h('div', { class: 'tool-layout options-right' }, area, options));

  // ----- crop stage -----
  const img = h('img', { alt: t('Image to crop'), draggable: 'false' });
  const box = h('div', { class: 'crop-box', tabindex: '0', role: 'group', 'aria-label': t('Crop area. Use arrow keys to move, Shift+arrows to move faster, Alt+arrows to resize.') });
  for (const hd of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) box.append(h('span', { class: 'crop-handle', dataset: { h: hd }, 'aria-hidden': 'true' }));
  const stage = h('div', { class: 'crop-stage' }, img, box);
  const wrap = h('div', { class: 'crop-wrap' }, stage);
  const dims = h('p', { class: 'hint', 'aria-live': 'polite' });

  const xIn = numberInput(0, { min: 0, onInput: (v) => setRect({ ...rect, x: v }, 'move') , ariaLabel: 'X' });
  const yIn = numberInput(0, { min: 0, onInput: (v) => setRect({ ...rect, y: v }, 'move'), ariaLabel: 'Y' });
  const wIn = numberInput(0, { min: 1, onInput: (v) => setRect({ ...rect, w: v }, 'se'), ariaLabel: t('Width') });
  const hIn = numberInput(0, { min: 1, onInput: (v) => setRect({ ...rect, h: v }, 's'), ariaLabel: t('Height') });

  const scale = () => (img.clientWidth && iw ? img.clientWidth / iw : 1);

  function drawBox() {
    const k = scale();
    Object.assign(box.style, { left: `${rect.x * k}px`, top: `${rect.y * k}px`, width: `${rect.w * k}px`, height: `${rect.h * k}px` });
    if (document.activeElement !== xIn) xIn.value = String(rect.x);
    if (document.activeElement !== yIn) yIn.value = String(rect.y);
    if (document.activeElement !== wIn) wIn.value = String(rect.w);
    if (document.activeElement !== hIn) hIn.value = String(rect.h);
    dims.textContent = t('Selection: {w} × {h} px at ({x}, {y}) — image {iw} × {ih} px', { w: rect.w, h: rect.h, x: rect.x, y: rect.y, iw, ih });
  }

  function setRect(r: Rect, anchor: Parameters<typeof clampRect>[4] = 'se') {
    rect = clampRect(r, iw, ih, ratioValue(), anchor);
    drawBox();
  }

  function resetRect() {
    const ratio = ratioValue();
    let w = iw * 0.8;
    let hh = ih * 0.8;
    if (ratio) {
      if (w / hh > ratio) w = hh * ratio;
      else hh = w / ratio;
    }
    setRect({ x: (iw - w) / 2, y: (ih - hh) / 2, w, h: hh }, 'move');
  }

  // Pointer interaction (mouse, touch, pen).
  let drag: { mode: string; startX: number; startY: number; orig: Rect } | null = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!iw) return;
    const target = e.target as HTMLElement;
    const k = scale();
    const bounds = stage.getBoundingClientRect();
    const px = (e.clientX - bounds.left) / k;
    const py = (e.clientY - bounds.top) / k;
    let mode = target.dataset.h ?? (target === box ? 'move' : 'new');
    if (mode === 'new') {
      rect = { x: px, y: py, w: 1, h: 1 };
      mode = 'se';
    }
    drag = { mode, startX: e.clientX, startY: e.clientY, orig: { ...rect } };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = scale();
    const dx = (e.clientX - drag.startX) / k;
    const dy = (e.clientY - drag.startY) / k;
    const o = drag.orig;
    const m = drag.mode;
    if (m === 'move') return setRect({ ...o, x: o.x + dx, y: o.y + dy }, 'move');
    let { x, y, w, h: hh } = o;
    if (m.includes('e')) w = o.w + dx;
    if (m.includes('s')) hh = o.h + dy;
    if (m.includes('w')) { w = o.w - dx; x = o.x + dx; }
    if (m.includes('n')) { hh = o.h - dy; y = o.y + dy; }
    if (w < 1) { if (m.includes('w')) x = o.x + o.w - 1; w = 1; }
    if (hh < 1) { if (m.includes('n')) y = o.y + o.h - 1; hh = 1; }
    rect = clampRect({ x, y, w, h: hh }, iw, ih, ratioValue(), m as Parameters<typeof clampRect>[4]);
    drawBox();
  });
  const end = () => (drag = null);
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  box.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    if (e.altKey) setRect({ ...rect, w: rect.w + d[0], h: rect.h + d[1] }, d[1] ? 's' : 'se');
    else setRect({ ...rect, x: rect.x + d[0], y: rect.y + d[1] }, 'move');
  });
  const ro = new ResizeObserver(() => drawBox());
  ro.observe(img);
  ctx.onCleanup(() => ro.disconnect());

  // ----- options -----
  const customW = numberInput(s.customW, { min: 0.01, step: 0.01, onInput: (v) => { s.customW = v; save(); resetRect(); }, ariaLabel: t('Custom ratio width') });
  const customH = numberInput(s.customH, { min: 0.01, step: 0.01, onInput: (v) => { s.customH = v; save(); resetRect(); }, ariaLabel: t('Custom ratio height') });
  const customBox = h('div', { class: 'two-col' }, field(t('Ratio W'), customW), field(t('Ratio H'), customH));
  const ratioSeg = segmented<Ratio>(t('Aspect ratio'), [
    { value: 'free', label: t('Free') }, { value: '1:1', label: '1:1' }, { value: '4:3', label: '4:3' }, { value: '3:2', label: '3:2' },
    { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: 'custom', label: t('Custom') },
  ], s.ratio, (v) => { s.ratio = v; save(); customBox.hidden = v !== 'custom'; if (iw) resetRect(); });
  customBox.hidden = s.ratio !== 'custom';
  const quality = slider(t('Quality (JPG/WebP)'), s.quality, { min: 1, max: 100, format: (v) => `${v}%`, onInput: (v) => { s.quality = v; save(); } });
  const prog = progress(t('Cropping…'));
  const result = h('div', { 'aria-live': 'polite' });
  const cropBtn = button(t('Crop image'), { variant: 'primary', icon: 'crop', size: 'lg', onClick: () => void doCrop() });

  render(
    options,
    ratioSeg.el,
    customBox,
    h('div', { class: 'two-col' }, field('X', xIn), field('Y', yIn)),
    h('div', { class: 'two-col' }, field(t('Width'), wIn), field(t('Height'), hIn)),
    button(t('Reset selection'), { variant: 'ghost', icon: 'rotate', onClick: resetRect }),
    formatSelect(s.format, (v) => { s.format = v; save(); }),
    quality.el,
    cropBtn,
    prog.el,
  );

  async function load(f: File) {
    file = f;
    render(area, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('Loading image…')));
    options.hidden = true;
    try {
      const d = await decodeImage(f);
      iw = d.width;
      ih = d.height;
      d.close();
      if (imgUrl) ctx.revokeUrl(imgUrl);
      imgUrl = await ctx.imageUrl(f);
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('Image failed to display'));
        img.src = imgUrl;
      });
      render(area, wrap, dims, result);
      options.hidden = false;
      zone.hidden = true;
      render(result, button(t('Choose another image'), { variant: 'ghost', icon: 'upload', onClick: () => { zone.hidden = false; zone.querySelector('input')?.click(); } }));
      resetRect();
    } catch (e) {
      render(area, errorPanel(e, () => { zone.hidden = false; render(area); }));
    }
  }

  async function doCrop() {
    if (!file) return;
    cropBtn.disabled = true;
    prog.set(0, t('Cropping…'));
    try {
      const type = outputTypeFor(file, s.format);
      const svgW = (await isSvg(file)) ? iw : undefined;
      const res = await processImage(file, { crop: { x: rect.x, y: rect.y, width: rect.w, height: rect.h }, output: { type, quality: s.quality / 100 } }, { onProgress: (f) => prog.set(f), signal: ctx.signal, svgWidth: svgW });
      const name = outputName(file, type, '-cropped');
      if (resultUrl) ctx.revokeUrl(resultUrl);
      resultUrl = ctx.objectUrl(res.blob);
      render(
        result,
        h('div', { class: 'panel' },
          h('h2', { class: 'panel-title' }, t('Result')),
          h('div', { class: 'preview-box' }, h('img', { src: resultUrl, alt: t('Cropped result') })),
          h('p', { class: 'hint' }, `${res.width} × ${res.height} px · ${formatBytes(res.blob.size)}`),
          h('div', { class: 'toolbar' },
            button(t('Download'), { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(res.blob, name) }),
            button(t('Choose another image'), { variant: 'ghost', icon: 'upload', onClick: () => { zone.hidden = false; zone.querySelector('input')?.click(); } }),
          ),
        ),
      );
      ctx.recordUse(s);
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      render(result, errorPanel(e));
    } finally {
      prog.hide();
      cropBtn.disabled = false;
    }
  }

  if (ctx.initialFiles[0]) void load(ctx.initialFiles[0]);
};
