import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractPages, imagesToPdf, mergePdfs, pdfInfo, rotatePdf, splitPdf } from '../src/utils/pdfOps';
import { zipFiles, listZip, extractEntry } from '../src/utils/zip';

async function makePdf(n: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) d.addPage([200, 300]).drawText(`p${i}`, { x: 10, y: 10, font: f });
  d.setTitle('T');
  return d.save();
}
const count = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

describe('pdf operations', () => {
  it('merges, splits, extracts and rotates', async () => {
    const a = await makePdf(3);
    const b = await makePdf(2);
    expect(await count(await mergePdfs([{ name: 'a', bytes: a }, { name: 'b', bytes: b }]))).toBe(5);
    const parts = await splitPdf(a, [[1], [2, 3]]);
    expect(await Promise.all(parts.map(count))).toEqual([1, 2]);
    expect(await count(await extractPages(a, [3, 1]))).toBe(2);
    const rotated = await PDFDocument.load(await rotatePdf(a, { 2: 90, 3: 270 }));
    expect(rotated.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 270]);
    const info = await pdfInfo(a);
    expect(info).toMatchObject({ pageCount: 3, title: 'T', encrypted: false });
    expect(info.pages[0]).toEqual({ width: 200, height: 300, rotation: 0 });
  });
  it('rejects non-PDF input with a friendly error', async () => {
    await expect(mergePdfs([{ name: 'x.pdf', bytes: new TextEncoder().encode('hello') }])).rejects.toThrow(/could not be read/);
  });
  it('builds a PDF from images', async () => {
    // 1×1 PNG
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    const out = await imagesToPdf([{ bytes: png, kind: 'png', width: 1, height: 1 }, { bytes: png, kind: 'png', width: 1, height: 1 }], { pageSize: 'a4', orientation: 'auto', margin: 18 });
    expect(await count(out)).toBe(2);
  });
});

describe('zip', () => {
  it('creates archives that list and extract correctly', async () => {
    const files = [
      { name: 'a.txt', data: new Blob(['hello '.repeat(1000)]) },
      { name: 'dir/b.bin', data: new Blob([new Uint8Array([1, 2, 3])]) },
      { name: 'a.txt', data: new Blob(['dup']) },
    ];
    for (const level of [0, 6] as const) {
      const zip = new Uint8Array(await (await zipFiles(files, { level })).arrayBuffer());
      const list = listZip(zip);
      expect(list.map((e) => e.name)).toEqual(['a.txt', 'dir/b.bin', 'a (2).txt']);
      expect(new TextDecoder().decode(extractEntry(zip, 'a (2).txt'))).toBe('dup');
      expect(Array.from(extractEntry(zip, 'dir/b.bin'))).toEqual([1, 2, 3]);
      if (level === 6) expect(list[0].compressedSize).toBeLessThan(list[0].size);
    }
  });
  it('rejects garbage', () => {
    expect(() => listZip(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
