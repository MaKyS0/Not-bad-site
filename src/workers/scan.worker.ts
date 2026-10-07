/// <reference lib="webworker" />
/** Scan worker: runs the local malware red-flag scanner off the main thread. */
import { exposeHandlers } from './rpc';
import { scanFile } from '../tools/files/lib/scan';

exposeHandlers({
  async scan(p: { file: File }, progress) {
    const { file } = p;
    const report = await scanFile(
      { name: file.name, size: file.size, read: async (s, e) => new Uint8Array(await file.slice(s, e).arrayBuffer()) },
      progress,
    );
    return { value: report };
  },
});
