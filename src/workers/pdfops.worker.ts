/// <reference lib="webworker" />
/**
 * PDF worker: runs pdf-lib operations off the main thread so merging or
 * splitting big documents never freezes the UI.
 */
import { exposeHandlers } from './rpc';
import { extractPages, imagesToPdf, mergePdfs, pdfInfo, rotatePdf, splitPdf, type ImageForPdf, type ImagesToPdfOptions } from '../utils/pdfOps';

const result = (bytes: Uint8Array) => ({ value: bytes, transfer: [bytes.buffer as ArrayBuffer] });

exposeHandlers({
  async merge(p: { files: { name: string; bytes: Uint8Array }[] }, progress) {
    return result(await mergePdfs(p.files, progress));
  },
  async split(p: { bytes: Uint8Array; groups: number[][]; name: string }, progress) {
    const outs = await splitPdf(p.bytes, p.groups, p.name, progress);
    return { value: outs, transfer: outs.map((o) => o.buffer as ArrayBuffer) };
  },
  async extract(p: { bytes: Uint8Array; pages: number[]; name: string }) {
    return result(await extractPages(p.bytes, p.pages, p.name));
  },
  async rotate(p: { bytes: Uint8Array; rotations: Record<number, number>; name: string }) {
    return result(await rotatePdf(p.bytes, p.rotations, p.name));
  },
  async images(p: { images: ImageForPdf[]; opts: ImagesToPdfOptions }, progress) {
    return result(await imagesToPdf(p.images, p.opts, progress));
  },
  async info(p: { bytes: Uint8Array }) {
    return { value: await pdfInfo(p.bytes) };
  },
});
