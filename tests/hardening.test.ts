import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { loadPdf, pdfInfo } from '../src/utils/pdfOps';
import { listZip, extractEntry, entryName, zipFiles } from '../src/utils/zip';
import { headerDimensions } from '../src/utils/imageCore';

/** A tiny PDF whose page tree is a DAG: every node lists the same child twice. */
function dagPdf(levels: number): Uint8Array {
  const objs: string[] = ['<< /Type /Catalog /Pages 2 0 R >>'];
  for (let i = 0; i < levels; i++) {
    const id = i + 2;
    objs.push(`<< /Type /Pages /Kids [${id + 1} 0 R ${id + 1} 0 R] /Count ${2 ** (levels - i)} >>`);
  }
  objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>');
  let body = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

describe('hardening', () => {
  it('refuses PDF page-tree bombs quickly', async () => {
    const t0 = Date.now();
    await expect(loadPdf(dagPdf(40))).rejects.toThrow(/damaged page tree/);
    await expect(pdfInfo(dagPdf(40))).rejects.toThrow(/damaged page tree/);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('extracts ZIP entries only when size, CRC and encryption check out', () => {
    const zip = zipSync({ 'a.txt': strToU8('hello hello hello hello'), 'b.bin': new Uint8Array([1, 2, 3]) });
    const [a] = listZip(zip);
    expect(new TextDecoder().decode(extractEntry(zip, a))).toBe('hello hello hello hello');
    // lie about the size in the central directory
    const lying = zip.slice();
    const dv = new DataView(lying.buffer);
    for (let i = lying.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x02014b50) dv.setUint32(i + 24, 5, true);
    expect(() => extractEntry(lying, listZip(lying)[0])).toThrow(/cannot be extracted/);
    const bigClaim = zip.slice();
    const dv2 = new DataView(bigClaim.buffer);
    for (let i = bigClaim.length - 22; i >= 0; i--) if (dv2.getUint32(i, true) === 0x02014b50) dv2.setUint32(i + 24, 0xfffffff0, true);
    expect(() => extractEntry(bigClaim, listZip(bigClaim)[0])).toThrow(/cannot be extracted/);
    // flip a data byte → CRC mismatch
    const stored = zipSync({ 's.txt': [strToU8('abcdef'), { level: 0 }] });
    const bad = stored.slice();
    bad[bad.indexOf(0x61)] = 0x7a;
    expect(() => extractEntry(bad, 's.txt')).toThrow(/cannot be extracted/);
    // encrypted flag
    const enc = stored.slice();
    const dv3 = new DataView(enc.buffer);
    for (let i = enc.length - 22; i >= 0; i--) if (dv3.getUint32(i, true) === 0x02014b50) dv3.setUint16(i + 8, 1, true);
    expect(listZip(enc)[0].encrypted).toBe(true);
    expect(() => extractEntry(enc, listZip(enc)[0])).toThrow(/cannot be extracted/);
  });

  it('never writes unsafe names into archives', async () => {
    expect(entryName('../../etc/evil.sh')).toBe('etc/evil.sh');
    expect(entryName('C:\\Windows\\x.dll')).toBe('Windows/x.dll');
    expect(entryName('/abs/./p\u202Egpj.exe')).toBe('abs/pgpj.exe');
    const blob = await zipFiles(Array.from({ length: 50 }, (_, i) => ({ name: `../f${i}.txt`, data: new Blob([`file ${i} `.repeat(100)]) })));
    const list = listZip(new Uint8Array(await blob.arrayBuffer()));
    expect(list).toHaveLength(50);
    expect(list.every((e) => !e.name.includes('..'))).toBe(true);
  });

  it('reads image dimensions from headers', () => {
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(png.buffer).setUint32(16, 50000);
    new DataView(png.buffer).setUint32(20, 50000);
    expect(headerDimensions(png)).toEqual({ width: 50000, height: 50000 });
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x20, 0x00]);
    expect(headerDimensions(gif)).toEqual({ width: 16, height: 32 });
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x01, 0x00, 0x02, 0x00, 3, 0, 0]);
    expect(headerDimensions(jpg)).toEqual({ width: 512, height: 256 });
  });
});
