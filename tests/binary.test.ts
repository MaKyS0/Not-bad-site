import { describe, expect, it } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { Sha256 } from '../src/utils/sha256';
import { encodeIco, readIcoDirectory } from '../src/utils/ico';
import { encodeWav, applyFades, peaks } from '../src/tools/audio/lib/wav';
import { readId3 } from '../src/tools/audio/lib/id3';
import { sniffBytes } from '../src/utils/fileType';
import { uuidV4, uuidV7, decodeJwt } from '../src/tools/developer/lib';
import { targetSize } from '../src/tools/image/resizer';
import { clampRect } from '../src/tools/image/cropper';
import { safeSegments } from '../src/tools/archive/unzip';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('incremental SHA-256', () => {
  it('matches Node/WebCrypto for many sizes and chunkings', async () => {
    for (const size of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 100_003]) {
      const data = new Uint8Array(size).map((_, i) => (i * 31 + 7) & 0xff);
      const expected = createHash('sha256').update(data).digest('hex');
      expect(hex(new Sha256().update(data).digest())).toBe(expected);
      const h = new Sha256();
      for (let i = 0; i < size; i += 17) h.update(data.subarray(i, i + 17));
      expect(hex(h.digest())).toBe(expected);
      expect(hex(new Uint8Array(await webcrypto.subtle.digest('SHA-256', data)))).toBe(expected);
    }
  });
});

describe('ICO encoder', () => {
  it('writes a valid directory', () => {
    const png = (n: number) => new Uint8Array(n).fill(1);
    const ico = encodeIco([{ size: 16, png: png(10) }, { size: 32, png: png(20) }, { size: 256, png: png(30) }]);
    const dir = readIcoDirectory(ico);
    expect(dir.map((d) => [d.width, d.bytes])).toEqual([[16, 10], [32, 20], [256, 30]]);
    expect(dir[0].offset).toBe(6 + 16 * 3);
    expect(ico.length).toBe(6 + 48 + 60);
    expect(sniffBytes(ico)?.ext).toBe('ico');
  });
});

describe('WAV encoder', () => {
  it('writes a correct header and samples', () => {
    const l = new Float32Array([0, 1, -1, 0.5]);
    const r = new Float32Array([0, -1, 1, -0.5]);
    const wav = encodeWav([l, r], 44100);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(40, true)).toBe(4 * 2 * 2);
    expect(v.getInt16(44 + 4, true)).toBe(32767);
    expect(v.getInt16(44 + 6, true)).toBe(-32768);
    expect(sniffBytes(wav)?.ext).toBe('wav');
    expect(encodeWav([l], 8000, 24).length).toBe(44 + 12);
  });
  it('fades and peaks', () => {
    const ch = new Float32Array(20).fill(1);
    applyFades([ch], 10, 0.5, 0.5);
    expect(ch[0]).toBe(0);
    expect(ch[19]).toBe(0);
    expect(ch[2]).toBeCloseTo(0.4);
    expect(ch[10]).toBe(1);
    const p = peaks(new Float32Array([0, 0.5, -0.5, 1]), 2);
    expect(Array.from(p.max)).toEqual([0.5, 1]);
    expect(Array.from(p.min)).toEqual([0, -0.5]);
  });
});

describe('ID3 reader', () => {
  it('reads v2.3 text frames and v1 fallback', () => {
    const frame = (id: string, text: string) => {
      const body = new Uint8Array([3, ...new TextEncoder().encode(text)]);
      const hdr = new Uint8Array(10);
      hdr.set([...id].map((c) => c.charCodeAt(0)));
      new DataView(hdr.buffer).setUint32(4, body.length);
      return new Uint8Array([...hdr, ...body]);
    };
    const frames = new Uint8Array([...frame('TIT2', 'Song'), ...frame('TPE1', 'Артист')]);
    const head = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, frames.length, ...frames]);
    expect(readId3(head).tags).toEqual([['Title', 'Song'], ['Artist', 'Артист']]);
    const v1 = new Uint8Array(128);
    v1.set([84, 65, 71]);
    v1.set(new TextEncoder().encode('Old'), 3);
    expect(readId3(new Uint8Array(4), v1).tags).toEqual([['Title', 'Old']]);
  });
});

describe('file type sniffing', () => {
  const b = (...x: number[]) => new Uint8Array([...x, ...new Array(20).fill(0)]);
  it('detects common formats', () => {
    expect(sniffBytes(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe('png');
    expect(sniffBytes(b(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe('jpg');
    expect(sniffBytes(new TextEncoder().encode('%PDF-1.7'))?.ext).toBe('pdf');
    expect(sniffBytes(b(0x50, 0x4b, 3, 4))?.ext).toBe('zip');
    expect(sniffBytes(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))?.ext).toBe('webp');
    expect(sniffBytes(new TextEncoder().encode('ID3\u0003'))?.ext).toBe('mp3');
    expect(sniffBytes(new TextEncoder().encode('OggS'))?.ext).toBe('ogg');
    expect(sniffBytes(new TextEncoder().encode('﻿  <?xml version="1.0"?><svg xmlns="x">'))?.ext).toBe('svg');
    expect(sniffBytes(new TextEncoder().encode('hello'))).toBeUndefined();
  });
});

describe('developer helpers', () => {
  it('generates valid UUIDs', () => {
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const v7 = uuidV7(0x0123456789ab);
    expect(v7).toMatch(/^01234567-89ab-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('decodes JWTs', () => {
    const t = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwiZXhwIjoxfQ.sig';
    expect(decodeJwt(t)).toEqual({ header: { alg: 'HS256' }, payload: { sub: 'x', exp: 1 }, signature: 'sig' });
    expect(() => decodeJwt('abc')).toThrow();
  });
});

describe('image geometry', () => {
  const base = { mode: 'pixels' as const, width: 0, height: 0, lock: true, percent: 50, fit: 'fit' as const, noUpscale: false };
  it('computes resize targets', () => {
    expect(targetSize(4000, 3000, { ...base, width: 1000 })).toEqual({ width: 1000, height: 750 });
    expect(targetSize(4000, 3000, { ...base, width: 1000, height: 1000 })).toEqual({ width: 1000, height: 750 });
    expect(targetSize(4000, 3000, { ...base, lock: false, width: 100, height: 100 })).toEqual({ width: 100, height: 100 });
    expect(targetSize(4000, 3000, { ...base, mode: 'percent', percent: 25 })).toEqual({ width: 1000, height: 750 });
    expect(targetSize(400, 300, { ...base, width: 1000, noUpscale: true })).toEqual({ width: 400, height: 300 });
  });
  it('clamps crop rectangles with aspect ratio', () => {
    expect(clampRect({ x: -10, y: -10, w: 50, h: 50 }, 100, 100, null, 'move')).toEqual({ x: 0, y: 0, w: 50, h: 50 });
    expect(clampRect({ x: 0, y: 0, w: 160, h: 10 }, 100, 100, 16 / 9)).toEqual({ x: 0, y: 0, w: 100, h: 56 });
    expect(clampRect({ x: 90, y: 90, w: 50, h: 50 }, 100, 100, 1, 'move')).toEqual({ x: 50, y: 50, w: 50, h: 50 });
  });
});

describe('zip slip protection', () => {
  it('drops dangerous path segments', () => {
    expect(safeSegments('../../etc/passwd')).toEqual(['etc', 'passwd']);
    expect(safeSegments('/abs\\win\\..\\x:y.txt')).toEqual(['abs', 'win', 'x_y.txt']);
  });
});
