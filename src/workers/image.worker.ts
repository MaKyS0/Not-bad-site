/// <reference lib="webworker" />
/**
 * Image worker: decodes, transforms and encodes images off the main thread
 * using OffscreenCanvas. SVG cannot be decoded in workers, so the main thread
 * passes an ImageBitmap for those.
 */
import { exposeHandlers } from './rpc';
import { runJob, type ImageJob } from '../utils/imageCore';

interface ProcessParams {
  source: Blob | ImageBitmap;
  job: ImageJob;
}

exposeHandlers({
  async process(params: ProcessParams, progress) {
    progress(0.1);
    const bitmap =
      params.source instanceof Blob
        ? await createImageBitmap(params.source, { imageOrientation: 'from-image' } as ImageBitmapOptions)
        : params.source;
    progress(0.4);
    try {
      const res = await runJob(bitmap, params.job);
      progress(1);
      return { value: res };
    } finally {
      bitmap.close();
    }
  },
  async probe() {
    // Can this worker decode + encode with OffscreenCanvas?
    const ok = typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function' && !!new OffscreenCanvas(1, 1).getContext('2d');
    return { value: ok };
  },
});
