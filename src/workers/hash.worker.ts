/// <reference lib="webworker" />
/**
 * Hash worker: computes digests of files without blocking the UI.
 * Files up to WEBCRYPTO_LIMIT are read into memory and hashed with Web Crypto
 * (all algorithms). Larger files are streamed through an incremental SHA-256.
 */
import { exposeHandlers } from './rpc';
import { Sha256 } from '../utils/sha256';

const WEBCRYPTO_LIMIT = 512 * 1024 * 1024;
const CHUNK = 8 * 1024 * 1024;
const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

exposeHandlers({
  async digest(p: { file: Blob; algorithms: string[] }, progress) {
    const { file, algorithms } = p;
    const out: Record<string, string> = {};
    if (file.size <= WEBCRYPTO_LIMIT) {
      const buf = new Uint8Array(file.size);
      for (let off = 0; off < file.size; off += CHUNK) {
        buf.set(new Uint8Array(await file.slice(off, off + CHUNK).arrayBuffer()), off);
        progress(Math.min(0.9, (off + CHUNK) / file.size) * 0.9);
      }
      for (const algo of algorithms) out[algo] = hex(new Uint8Array(await crypto.subtle.digest(algo, buf)));
      progress(1);
      return { value: out };
    }
    if (algorithms.some((a) => a !== 'SHA-256')) {
      throw Object.assign(new Error('Files larger than 512 MB can only be hashed with SHA-256 here.'), { name: 'UserError', hint: 'Deselect the other algorithms and try again.' });
    }
    const sha = new Sha256();
    for (let off = 0; off < file.size; off += CHUNK) {
      sha.update(new Uint8Array(await file.slice(off, off + CHUNK).arrayBuffer()));
      progress(Math.min(1, (off + CHUNK) / file.size));
    }
    out['SHA-256'] = hex(sha.digest());
    return { value: out };
  },
});
