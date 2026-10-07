/**
 * Main-thread entry point for image operations. Decides between the worker
 * (OffscreenCanvas) and a main-thread fallback, and handles SVG input safely
 * (rendered as an <img>, so scripts inside SVG never run).
 */
import { WorkerPool } from '../workers/rpc';
import { assertDecodable, runJob, type ImageJob, type JobResult, type Drawable } from '../utils/imageCore';
import { UserError, throwIfAborted } from '../utils/errors';
import { canonicalExt, readHead, sniffBytes } from '../utils/fileType';
import { extOf } from '../utils/format';

let pool: WorkerPool | null = null;
let workerOk: Promise<boolean> | null = null;

function getPool(): WorkerPool {
  pool ??= new WorkerPool(() => new Worker(new URL('../workers/image.worker.ts', import.meta.url), { type: 'module' }));
  return pool;
}

async function canUseWorker(): Promise<boolean> {
  workerOk ??= (async () => {
    try {
      if (typeof Worker === 'undefined') return false;
      const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), 4000));
      return await Promise.race([getPool().call<boolean>('probe', null), timeout]);
    } catch {
      return false;
    }
  })();
  return workerOk;
}

export async function isSvg(file: Blob & { name?: string }): Promise<boolean> {
  if (file.type === 'image/svg+xml' || canonicalExt(extOf(file.name ?? '')) === 'svg') return true;
  return sniffBytes(await readHead(file))?.ext === 'svg';
}

export interface SvgInfo {
  width: number;
  height: number;
  hasViewBox: boolean;
}

/** Parse SVG dimensions and optionally rewrite width/height for crisp rasterisation. */
export async function prepareSvg(file: Blob, targetWidth?: number): Promise<{ blob: Blob; info: SvgInfo }> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length || root.nodeName.toLowerCase() !== 'svg') {
    throw new UserError('This SVG file could not be parsed.', 'The file may be corrupted or not a valid SVG document.');
  }
  const num = (v: string | null): number | null => {
    if (!v || /%$/.test(v.trim())) return null;
    const m = /^\s*([\d.]+)\s*(px)?\s*$/.exec(v);
    return m ? parseFloat(m[1]) : null;
  };
  const vb = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const hasViewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  let w = num(root.getAttribute('width'));
  let h = num(root.getAttribute('height'));
  if (!w && !h && hasViewBox) {
    w = vb[2];
    h = vb[3];
  } else if (w && !h) h = hasViewBox ? (w * vb[3]) / vb[2] : w;
  else if (h && !w) w = hasViewBox ? (h * vb[2]) / vb[3] : h;
  w ||= 300;
  h ||= 150;
  if (!hasViewBox) root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const outW = targetWidth ? Math.round(targetWidth) : Math.round(w);
  const outH = Math.max(1, Math.round((outW * h) / w));
  root.setAttribute('width', String(outW));
  root.setAttribute('height', String(outH));
  root.setAttribute('preserveAspectRatio', root.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet');
  const blob = new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
  return { blob, info: { width: w, height: h, hasViewBox } };
}

function loadImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UserError('This image could not be decoded.', 'The file may be corrupted, or your browser does not support this image format.'));
    };
    img.src = url;
  });
}

export interface Decoded {
  source: Drawable;
  width: number;
  height: number;
  close(): void;
}

/** Decode an image on the main thread (for previews, cropping, metadata). */
export async function decodeImage(file: Blob & { name?: string }, opts: { svgWidth?: number } = {}): Promise<Decoded> {
  if (await isSvg(file)) {
    const { blob } = await prepareSvg(file, opts.svgWidth);
    const img = await loadImg(blob);
    return { source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, close() {} };
  }
  await assertDecodable(file);
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to <img> (e.g. ICO in some browsers) */
    }
  }
  const img = await loadImg(file);
  if (!img.naturalWidth) throw new UserError('This image could not be decoded.');
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close() {} };
}

export async function getImageSize(file: Blob & { name?: string }): Promise<{ width: number; height: number }> {
  const d = await decodeImage(file);
  d.close();
  return { width: d.width, height: d.height };
}

export interface ProcessOpts {
  onProgress?: (f: number) => void;
  signal?: AbortSignal;
  /** For SVG input: rasterise at this width. */
  svgWidth?: number;
}

/** Process an image with the given job, preferring a background worker. */
export async function processImage(file: Blob & { name?: string }, job: ImageJob, opts: ProcessOpts = {}): Promise<JobResult> {
  throwIfAborted(opts.signal);
  try {
    if (localStorage.getItem('uft-debug-wasm-webp') === '1') job = { ...job, output: { ...job.output, forceWasm: true } };
  } catch {
    /* storage unavailable */
  }
  const svg = await isSvg(file);
  const useWorker = await canUseWorker();
  if (useWorker) {
    try {
      let source: Blob | ImageBitmap = file;
      if (svg) {
        const d = await decodeImage(file, { svgWidth: opts.svgWidth });
        source = await createImageBitmap(d.source as HTMLImageElement);
      }
      return await getPool().call<JobResult>('process', { source, job }, { transfer: source instanceof Blob ? [] : [source], onProgress: opts.onProgress, signal: opts.signal });
    } catch (e) {
      if ((e as Error).name === 'UserError' || (e as Error).name === 'AbortError') throw e;
      // Decoding in the worker can fail for formats only <img> understands — retry on the main thread.
    }
  }
  throwIfAborted(opts.signal);
  opts.onProgress?.(0.2);
  const d = await decodeImage(file, { svgWidth: opts.svgWidth });
  try {
    opts.onProgress?.(0.5);
    const res = await runJob(d.source, job);
    opts.onProgress?.(1);
    return res;
  } finally {
    d.close();
  }
}

export const MIME_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
