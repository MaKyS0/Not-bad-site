/**
 * Image processing pipeline shared by the image worker and the main-thread
 * fallback: crop → rotate/flip → resize → encode.
 * Uses OffscreenCanvas when available, otherwise a DOM canvas.
 */
import { UserError } from './errors';

export type OutputType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ImageJob {
  crop?: { x: number; y: number; width: number; height: number };
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  /** Final output size (after rotation). */
  resize?: { width: number; height: number };
  output: {
    type: OutputType;
    /** 0..1 for JPEG/WebP. */
    quality?: number;
    /** Fill colour for transparent pixels (always used for JPEG). */
    background?: string;
    /** PNG only: max colours for quantisation (2–256); 0/undefined = lossless. */
    pngColors?: number;
    /** Debug/testing: always use the WASM WebP encoder. */
    forceWasm?: boolean;
  };
}

export interface JobResult {
  blob: Blob;
  width: number;
  height: number;
  /** True if the requested type could not be encoded and a fallback was used. */
  encoder: 'native' | 'wasm' | 'upng';
}

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type Drawable = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

const isIOS = (): boolean =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1));

/** Conservative canvas limits that work on all major browsers (iOS is strictest). */
export const MAX_SIDE = 16384;
export const maxArea = (): number => (isIOS() ? 16_777_216 : 268_435_456);

export function assertCanvasSize(w: number, h: number): void {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) throw new UserError('Invalid image size.', `Requested ${w}×${h} px.`);
  if (w > MAX_SIDE || h > MAX_SIDE || w * h > maxArea()) {
    throw new UserError(
      `The image is too large for this browser (${Math.round(w)}×${Math.round(h)} px).`,
      `The limit here is ${MAX_SIDE} px per side and ${(maxArea() / 1e6).toFixed(0)} megapixels. Choose a smaller output size.`,
    );
  }
}

export function makeCanvas(w: number, h: number): AnyCanvas {
  assertCanvasSize(w, h);
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(w, h);
      if (c.getContext('2d')) return c;
    } catch {
      /* fall through */
    }
  }
  if (typeof document === 'undefined') throw new Error('No canvas implementation available in this context.');
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: AnyCanvas): Ctx2D {
  const ctx = c.getContext('2d', { alpha: true }) as Ctx2D | null;
  if (!ctx) throw new Error('Canvas 2D context is not available (out of memory?).');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

export function releaseCanvas(c: AnyCanvas): void {
  // Shrinking the canvas releases its backing store immediately (important on iOS).
  c.width = 1;
  c.height = 1;
}

export async function canvasToBlob(c: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))), type, quality),
  );
}

const sizeOf = (d: Drawable): { w: number; h: number } => {
  if ('naturalWidth' in d) return { w: d.naturalWidth || d.width, h: d.naturalHeight || d.height };
  return { w: d.width, h: d.height };
};

/** High-quality downscale by halving steps, then a final exact resize. */
export function scaleStepwise(src: Drawable, sx: number, sy: number, sw: number, sh: number, tw: number, th: number): AnyCanvas {
  let cur: Drawable = src;
  let cx = sx, cy = sy, cw = sw, ch = sh;
  const temps: AnyCanvas[] = [];
  while (cw / 2 >= tw * 1.0001 && ch / 2 >= th * 1.0001 && cw > 2 && ch > 2) {
    const nw = Math.max(tw, Math.round(cw / 2));
    const nh = Math.max(th, Math.round(ch / 2));
    const step = makeCanvas(nw, nh);
    ctx2d(step).drawImage(cur as CanvasImageSource, cx, cy, cw, ch, 0, 0, nw, nh);
    temps.push(step);
    cur = step;
    cx = 0; cy = 0; cw = nw; ch = nh;
  }
  const out = makeCanvas(tw, th);
  ctx2d(out).drawImage(cur as CanvasImageSource, cx, cy, cw, ch, 0, 0, tw, th);
  temps.forEach(releaseCanvas);
  return out;
}

/** Run crop/rotate/flip/resize and return a canvas with the final pixels. */
export function renderJob(src: Drawable, job: Omit<ImageJob, 'output'> & { output?: ImageJob['output'] }): AnyCanvas {
  const { w: iw, h: ih } = sizeOf(src);
  const crop = job.crop
    ? {
        x: Math.max(0, Math.round(job.crop.x)),
        y: Math.max(0, Math.round(job.crop.y)),
        width: Math.min(iw - Math.max(0, Math.round(job.crop.x)), Math.round(job.crop.width)),
        height: Math.min(ih - Math.max(0, Math.round(job.crop.y)), Math.round(job.crop.height)),
      }
    : { x: 0, y: 0, width: iw, height: ih };
  if (crop.width < 1 || crop.height < 1) throw new UserError('The crop area is empty.');
  const rot = job.rotate ?? 0;
  const swap = rot === 90 || rot === 270;
  const rw = swap ? crop.height : crop.width;
  const rh = swap ? crop.width : crop.height;
  const tw = Math.max(1, Math.round(job.resize?.width ?? rw));
  const th = Math.max(1, Math.round(job.resize?.height ?? rh));
  assertCanvasSize(tw, th);

  const needsTransform = rot !== 0 || job.flipH || job.flipV;
  // Scale first (in the source orientation) so rotation happens on the smaller image.
  const scaledW = swap ? th : tw;
  const scaledH = swap ? tw : th;
  const scaled = scaleStepwise(src, crop.x, crop.y, crop.width, crop.height, scaledW, scaledH);

  let out: AnyCanvas = scaled;
  if (needsTransform) {
    out = makeCanvas(tw, th);
    const ctx = ctx2d(out);
    ctx.translate(tw / 2, th / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(job.flipH ? -1 : 1, job.flipV ? -1 : 1);
    ctx.drawImage(scaled as CanvasImageSource, -scaledW / 2, -scaledH / 2);
    releaseCanvas(scaled);
  }

  const bg = job.output?.background ?? (job.output?.type === 'image/jpeg' ? '#ffffff' : undefined);
  if (bg) {
    const flat = makeCanvas(tw, th);
    const ctx = ctx2d(flat);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(out as CanvasImageSource, 0, 0);
    releaseCanvas(out);
    out = flat;
  }
  return out;
}

interface UpngLib {
  encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number): ArrayBuffer;
}

let webpNative: boolean | null = null;

async function nativeWebpSupported(): Promise<boolean> {
  if (webpNative !== null) return webpNative;
  try {
    const c = makeCanvas(2, 2);
    const b = await canvasToBlob(c, 'image/webp', 0.8);
    webpNative = b.type === 'image/webp';
  } catch {
    webpNative = false;
  }
  return webpNative;
}

/** Encode a canvas to the requested type, with WASM/UPNG fallbacks. */
export async function encodeCanvas(c: AnyCanvas, out: ImageJob['output']): Promise<{ blob: Blob; encoder: JobResult['encoder'] }> {
  const q = out.quality ?? 0.85;
  if (out.type === 'image/png' && out.pngColors && out.pngColors > 0) {
    const mod = (await import('upng-js')) as unknown as { default?: UpngLib } & UpngLib;
    const UPNG: UpngLib = mod.default ?? mod;
    const ctx = ctx2d(c);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const buf = UPNG.encode([data.data.buffer as ArrayBuffer], c.width, c.height, Math.max(2, Math.min(256, Math.round(out.pngColors))));
    return { blob: new Blob([buf], { type: 'image/png' }), encoder: 'upng' };
  }
  if (out.type === 'image/webp' && (out.forceWasm || !(await nativeWebpSupported()))) {
    // Safari cannot encode WebP from canvas: use the bundled libwebp (WASM).
    const { default: encode } = await import('@jsquash/webp/encode');
    const data = ctx2d(c).getImageData(0, 0, c.width, c.height);
    const buf = await encode(data, { quality: Math.round(q * 100) });
    return { blob: new Blob([buf], { type: 'image/webp' }), encoder: 'wasm' };
  }
  const blob = await canvasToBlob(c, out.type, out.type === 'image/png' ? undefined : q);
  if (blob.type !== out.type) {
    throw new UserError(`This browser cannot encode ${out.type.split('/')[1].toUpperCase()} images.`, 'Choose a different output format (PNG works everywhere).');
  }
  return { blob, encoder: 'native' };
}

export async function runJob(src: Drawable, job: ImageJob): Promise<JobResult> {
  const canvas = renderJob(src, job);
  try {
    const { blob, encoder } = await encodeCanvas(canvas, job.output);
    return { blob, width: canvas.width, height: canvas.height, encoder };
  } finally {
    releaseCanvas(canvas);
  }
}
