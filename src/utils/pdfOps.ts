/**
 * PDF manipulation with pdf-lib. Pure functions over byte arrays so they run
 * the same in the PDF worker and in unit tests (Node).
 */
import { PDFDocument, degrees, PageSizes, EncryptedPDFError, PDFArray, PDFDict, PDFName, PDFRef } from 'pdf-lib';
import { UserError } from './errors';
import { MAX_PAGES, tooManyPages } from './pdfLimits';


/**
 * Walk the page tree once, refusing loops, shared subtrees (a "DAG" that makes
 * 4 KB claim a trillion pages) and documents over MAX_PAGES. pdf-lib would
 * otherwise recurse forever or hang counting pages.
 */
export function checkPageTree(doc: PDFDocument): number {
  const seen = new Set<string>();
  const stack: unknown[] = [doc.catalog.get(PDFName.of('Pages'))];
  let pages = 0;
  while (stack.length) {
    let node = stack.pop();
    if (node instanceof PDFRef) {
      const key = node.toString();
      if (seen.has(key)) throw new UserError('This PDF has a damaged page tree.', 'Its pages refer to each other in a loop. The file may be corrupted or crafted to crash PDF software.');
      seen.add(key);
      node = doc.context.lookup(node);
    }
    if (!(node instanceof PDFDict)) continue;
    const kids = node.lookup(PDFName.of('Kids'));
    if (kids instanceof PDFArray) {
      if (seen.size + kids.size() > MAX_PAGES * 4) throw tooManyPages();
      for (let i = 0; i < kids.size(); i++) stack.push(kids.get(i));
    } else if (++pages > MAX_PAGES) {
      throw tooManyPages();
    }
  }
  return pages;
}


export async function loadPdf(bytes: Uint8Array | ArrayBuffer, name = 'PDF'): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (e instanceof EncryptedPDFError || /encrypt/i.test((e as Error).message)) {
      throw new UserError(`“${name}” is encrypted or password-protected.`, 'Encrypted PDFs cannot be modified in the browser. Remove the protection in the original application, or use “PDF to Images” which can render PDFs that only have permission restrictions.');
    }
    throw new UserError(`“${name}” could not be read as a PDF.`, `The file may be damaged or not a real PDF (${(e as Error).message}).`);
  }
  checkPageTree(doc);
  return doc;
}

function stamp(doc: PDFDocument): void {
  doc.setProducer('Universal File Toolbox (pdf-lib, in-browser)');
  doc.setModificationDate(new Date());
}

export async function mergePdfs(files: { name: string; bytes: Uint8Array }[], onProgress?: (f: number) => void): Promise<Uint8Array> {
  if (!files.length) throw new UserError('Add at least one PDF.');
  const out = await PDFDocument.create();
  for (const [i, f] of files.entries()) {
    const src = await loadPdf(f.bytes, f.name);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    onProgress?.((i + 1) / (files.length + 1));
  }
  stamp(out);
  const bytes = await out.save({ useObjectStreams: true });
  onProgress?.(1);
  return bytes;
}

/** Build a new PDF from 1-based page numbers of `src`. */
async function subset(src: PDFDocument, pages: number[], title?: string): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pages.map((p) => p - 1));
  copied.forEach((p) => out.addPage(p));
  const t = src.getTitle();
  if (title || t) out.setTitle(title ?? t ?? '');
  if (src.getAuthor()) out.setAuthor(src.getAuthor()!);
  stamp(out);
  return out.save({ useObjectStreams: true });
}

export async function splitPdf(bytes: Uint8Array, groups: number[][], name = 'PDF', onProgress?: (f: number) => void): Promise<Uint8Array[]> {
  const src = await loadPdf(bytes, name);
  const outputs: Uint8Array[] = [];
  for (const [i, g] of groups.entries()) {
    outputs.push(await subset(src, g));
    onProgress?.((i + 1) / groups.length);
  }
  return outputs;
}

export async function extractPages(bytes: Uint8Array, pages: number[], name = 'PDF'): Promise<Uint8Array> {
  if (!pages.length) throw new UserError('Select at least one page.');
  const src = await loadPdf(bytes, name);
  return subset(src, pages);
}

/** rotations: 1-based page number → degrees to add (multiple of 90). */
export async function rotatePdf(bytes: Uint8Array, rotations: Record<number, number>, name = 'PDF'): Promise<Uint8Array> {
  const doc = await loadPdf(bytes, name);
  const pages = doc.getPages();
  for (const [k, add] of Object.entries(rotations)) {
    const page = pages[Number(k) - 1];
    if (!page || !add) continue;
    const current = page.getRotation().angle;
    page.setRotation(degrees((((current + add) % 360) + 360) % 360));
  }
  stamp(doc);
  return doc.save({ useObjectStreams: true });
}

export interface ImageForPdf {
  bytes: Uint8Array;
  kind: 'jpg' | 'png';
  width: number;
  height: number;
}

export interface ImagesToPdfOptions {
  pageSize: 'fit' | 'a4' | 'letter';
  orientation: 'auto' | 'portrait' | 'landscape';
  /** Margin in PDF points (1/72 inch). */
  margin: number;
}

export async function imagesToPdf(images: ImageForPdf[], opts: ImagesToPdfOptions, onProgress?: (f: number) => void): Promise<Uint8Array> {
  if (!images.length) throw new UserError('Add at least one image.');
  const doc = await PDFDocument.create();
  for (const [i, img] of images.entries()) {
    const embedded = img.kind === 'jpg' ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
    // Images are placed at 72 dpi-equivalent size for "fit" pages, scaled for paper pages.
    let pw: number;
    let ph: number;
    if (opts.pageSize === 'fit') {
      pw = img.width + opts.margin * 2;
      ph = img.height + opts.margin * 2;
    } else {
      const [a, b] = opts.pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter;
      const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && img.width > img.height);
      [pw, ph] = landscape ? [b, a] : [a, b];
    }
    const page = doc.addPage([pw, ph]);
    const boxW = pw - opts.margin * 2;
    const boxH = ph - opts.margin * 2;
    const k = Math.min(boxW / img.width, boxH / img.height, opts.pageSize === 'fit' ? 1 : Infinity);
    const w = img.width * k;
    const hh = img.height * k;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - hh) / 2, width: w, height: hh });
    onProgress?.((i + 1) / (images.length + 1));
  }
  doc.setTitle('Images');
  doc.setCreator('Universal File Toolbox');
  stamp(doc);
  const out = await doc.save({ useObjectStreams: true });
  onProgress?.(1);
  return out;
}

export interface PdfInfo {
  pageCount: number;
  version: string | null;
  encrypted: boolean;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pages: { width: number; height: number; rotation: number }[];
}

export async function pdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  const version = /%PDF-(\d\.\d)/.exec(head)?.[1] ?? null;
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (e) {
    throw new UserError('This file could not be read as a PDF.', (e as Error).message);
  }
  checkPageTree(doc);
  const safe = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  return {
    pageCount: doc.getPageCount(),
    version,
    encrypted: doc.isEncrypted,
    title: safe(() => doc.getTitle()),
    author: safe(() => doc.getAuthor()),
    subject: safe(() => doc.getSubject()),
    keywords: safe(() => doc.getKeywords()),
    creator: safe(() => doc.getCreator()),
    producer: safe(() => doc.getProducer()),
    creationDate: safe(() => doc.getCreationDate()?.toISOString()),
    modificationDate: safe(() => doc.getModificationDate()?.toISOString()),
    pages: doc.getPages().map((p) => {
      const { width, height } = p.getSize();
      return { width, height, rotation: p.getRotation().angle };
    }),
  };
}
