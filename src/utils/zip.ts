/**
 * ZIP helpers built on fflate. Files are streamed chunk-by-chunk into the
 * archive (compression runs in fflate's background workers when available),
 * so building an archive never blocks the UI.
 */
import { AsyncZipDeflate, Zip, ZipDeflate, ZipPassThrough, inflateSync } from 'fflate';
import { UserError, throwIfAborted } from './errors';

export interface ZipInput {
  name: string;
  data: Blob;
  lastModified?: number;
}

export interface ZipOptions {
  /** 0 = store only (fast, for already compressed data), 1–9 deflate. */
  level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const COMPRESSED_EXT = /\.(png|jpe?g|webp|gif|avif|heic|mp3|mp4|m4a|ogg|opus|webm|zip|gz|7z|rar|pdf|woff2?)$/i;

async function readChunks(blob: Blob, onChunk: (chunk: Uint8Array) => void): Promise<void> {
  // Blob.stream() is widely supported; fall back to slicing for very old engines.
  if (typeof blob.stream === 'function') {
    const reader = blob.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(value);
    }
    return;
  }
  const step = 4 * 1024 * 1024;
  for (let off = 0; off < blob.size; off += step) {
    onChunk(new Uint8Array(await blob.slice(off, off + step).arrayBuffer()));
  }
}

/**
 * Safe entry name: forward slashes, no absolute paths, drive letters or
 * ".." segments ("zip slip"), no bidi tricks or control characters.
 */
export function entryName(raw: string): string {
  const name = raw
    .replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '_')
    .replace(/\\/g, '/')
    .replace(/^[a-zA-Z]:/, '')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
  return name || 'file';
}

export function zipFiles(files: ZipInput[], opts: ZipOptions = {}): Promise<Blob> {
  const level = opts.level ?? 6;
  const total = files.reduce((s, f) => s + f.data.size, 0) || 1;
  let processed = 0;
  return new Promise<Blob>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((err, chunk, final) => {
      if (err) return reject(err);
      chunks.push(chunk);
      if (final) resolve(new Blob(chunks as BlobPart[], { type: 'application/zip' }));
    });
    (async () => {
      const usedNames = new Set<string>();
      for (const f of files) {
        throwIfAborted(opts.signal);
        let name = entryName(f.name);
        // Avoid duplicate entries which confuse many unzip tools.
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf('.');
          let i = 2;
          while (usedNames.has(dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`)) i++;
          name = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
        }
        usedNames.add(name);
        const store = level === 0 || COMPRESSED_EXT.test(name);
        // Small files are deflated inline; big ones in fflate's worker, one at a
        // time (a worker per file would spawn thousands of threads for a folder).
        const big = f.data.size > 1024 * 1024;
        const entry = store ? new ZipPassThrough(name) : big ? new AsyncZipDeflate(name, { level }) : new ZipDeflate(name, { level });
        if (f.lastModified) entry.mtime = new Date(f.lastModified);
        zip.add(entry);
        const finished = new Promise<void>((done) => {
          const forward = entry.ondata;
          entry.ondata = (err, data, final) => {
            forward.call(entry, err, data, final);
            if (final || err) done();
          };
        });
        await readChunks(f.data, (chunk) => {
          entry.push(chunk, false);
          processed += chunk.length;
          opts.onProgress?.(Math.min(0.99, processed / total));
        });
        entry.push(new Uint8Array(0), true);
        await finished;
      }
      zip.end();
      opts.onProgress?.(1);
    })().catch((e) => {
      zip.terminate();
      reject(e);
    });
  });
}

export interface ZipEntryInfo {
  name: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
  compression: number;
  encrypted: boolean;
  crc: number;
  /** Offset of the local file header. */
  offset: number;
}

/** Entries larger than this are not extracted in the browser. */
export const MAX_ENTRY_SIZE = 1024 * 1024 * 1024;

function toUint8(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) + u32(b, o + 4) * 2 ** 32;

const invalidZip = (why: string) => new UserError('This does not look like a valid ZIP archive.', `The file may be corrupted or use an unsupported format (${why}).`);

/**
 * List entries from the central directory without decompressing anything.
 * Sizes, flags and offsets are read directly (with ZIP64 support) so that
 * encrypted entries and lying size fields can be detected before extraction.
 */
export function listZip(buf: ArrayBuffer | Uint8Array): ZipEntryInfo[] {
  const b = toUint8(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw invalidZip('no end of central directory');
  let count = u16(b, eocd + 10);
  let cdOff = u32(b, eocd + 16);
  if ((cdOff === 0xffffffff || count === 0xffff) && eocd >= 20 && u32(b, eocd - 20) === 0x07064b50) {
    const z = u64(b, eocd - 12);
    if (z + 56 <= b.length && u32(b, z) === 0x06064b50) {
      count = u64(b, z + 32);
      cdOff = u64(b, z + 48);
    }
  }
  if (cdOff >= b.length) throw invalidZip('central directory out of range');
  const utf8 = new TextDecoder();
  const entries: ZipEntryInfo[] = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) throw invalidZip('damaged central directory');
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const e: ZipEntryInfo = {
      name: utf8.decode(b.subarray(p + 46, p + 46 + nameLen)),
      compression: u16(b, p + 10),
      encrypted: (u16(b, p + 8) & 1) === 1,
      crc: u32(b, p + 16),
      compressedSize: u32(b, p + 20),
      size: u32(b, p + 24),
      offset: u32(b, p + 42),
      isDirectory: false,
    };
    e.isDirectory = e.name.endsWith('/');
    for (let x = p + 46 + nameLen, end = x + extraLen; x + 4 <= end; x += 4 + u16(b, x + 2)) {
      if (u16(b, x) !== 1) continue;
      let q = x + 4;
      if (e.size === 0xffffffff) (e.size = u64(b, q)), (q += 8);
      if (e.compressedSize === 0xffffffff) (e.compressedSize = u64(b, q)), (q += 8);
      if (e.offset === 0xffffffff) e.offset = u64(b, q);
    }
    entries.push(e);
    p += 46 + nameLen + extraLen + u16(b, p + 32);
  }
  return entries;
}

let crcTable: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Extract a single entry (pass the entry from listZip(); a name picks the
 * first entry with that name). Checks encryption, size limits, the actual
 * decompressed length and the CRC-32, so damaged or crafted entries fail
 * loudly instead of producing truncated or garbage files.
 */
export function extractEntry(buf: ArrayBuffer | Uint8Array, entry: ZipEntryInfo | string): Uint8Array {
  const b = toUint8(buf);
  const e = typeof entry === 'string' ? listZip(b).find((x) => x.name === entry) : entry;
  if (!e) throw new UserError(`“${String(entry)}” was not found in the archive.`);
  const cannot = (why: string) => new UserError(`“${e.name}” cannot be extracted.`, why);
  if (e.encrypted) throw cannot('It is password-protected (encrypted), which is not supported here.');
  if (e.compression !== 0 && e.compression !== 8) throw cannot('It uses an unsupported compression method (only Stored and Deflate are supported).');
  if (e.size > MAX_ENTRY_SIZE) throw cannot('It is larger than 1 GB when unpacked.');
  if (e.offset + 30 > b.length || u32(b, e.offset) !== 0x04034b50) throw cannot('The archive is damaged.');
  const start = e.offset + 30 + u16(b, e.offset + 26) + u16(b, e.offset + 28);
  if (start + e.compressedSize > b.length) throw cannot('The archive is damaged or truncated.');
  const raw = b.subarray(start, start + e.compressedSize);
  let data: Uint8Array;
  if (e.compression === 0) data = raw.slice();
  else {
    try {
      // One byte of headroom reveals entries that are bigger than declared.
      const out = inflateSync(raw, { out: new Uint8Array(e.size + 1) });
      if (out.length !== e.size) throw new Error('size mismatch');
      data = out;
    } catch {
      throw cannot('The archive is damaged (the data does not match its declared size).');
    }
  }
  if (data.length !== e.size || crc32(data) !== e.crc) throw cannot('The archive is damaged (checksum mismatch).');
  return data;
}
