/**
 * ZIP helpers built on fflate. Files are streamed chunk-by-chunk into the
 * archive (compression runs in fflate's background workers when available),
 * so building an archive never blocks the UI.
 */
import { AsyncZipDeflate, Zip, ZipPassThrough, unzipSync, type UnzipFileInfo } from 'fflate';
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
        let name = f.name.replace(/^\/+/, '');
        // Avoid duplicate entries which confuse many unzip tools.
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf('.');
          let i = 2;
          while (usedNames.has(dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`)) i++;
          name = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
        }
        usedNames.add(name);
        const store = level === 0 || COMPRESSED_EXT.test(name);
        const entry = store ? new ZipPassThrough(name) : new AsyncZipDeflate(name, { level });
        if (f.lastModified) entry.mtime = new Date(f.lastModified);
        zip.add(entry);
        await readChunks(f.data, (chunk) => {
          entry.push(chunk, false);
          processed += chunk.length;
          opts.onProgress?.(Math.min(0.99, processed / total));
        });
        entry.push(new Uint8Array(0), true);
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
}

function toUint8(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

/** List entries without decompressing anything. */
export function listZip(buf: ArrayBuffer | Uint8Array): ZipEntryInfo[] {
  const entries: ZipEntryInfo[] = [];
  try {
    unzipSync(toUint8(buf), {
      filter: (info: UnzipFileInfo) => {
        entries.push({
          name: info.name,
          size: info.originalSize,
          compressedSize: info.size,
          isDirectory: info.name.endsWith('/'),
          compression: info.compression,
        });
        return false;
      },
    });
  } catch (e) {
    throw new UserError('This does not look like a valid ZIP archive.', `The file may be corrupted or use an unsupported format (${(e as Error).message}).`);
  }
  return entries;
}

/** Extract a single entry. */
export function extractEntry(buf: ArrayBuffer | Uint8Array, name: string): Uint8Array {
  const u8 = toUint8(buf);
  let out: Record<string, Uint8Array>;
  try {
    out = unzipSync(u8, { filter: (info) => info.name === name });
  } catch (e) {
    const msg = (e as Error).message || '';
    if (/compression|encrypt/i.test(msg)) {
      throw new UserError(`“${name}” cannot be extracted.`, 'It uses encryption or an unsupported compression method (only Stored and Deflate are supported).');
    }
    throw e;
  }
  const data = out[name];
  if (!data) throw new UserError(`“${name}” was not found in the archive.`);
  return data;
}
