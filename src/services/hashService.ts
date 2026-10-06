import { WorkerPool } from '../workers/rpc';

let pool: WorkerPool | null = null;
const getPool = () => (pool ??= new WorkerPool(() => new Worker(new URL('../workers/hash.worker.ts', import.meta.url), { type: 'module' }), 2));

/** Hash a file in a background worker. Returns lower-case hex digests by algorithm. */
export function hashFile(file: Blob, algorithms: string[] = ['SHA-256'], opts: { onProgress?: (f: number) => void; signal?: AbortSignal } = {}): Promise<Record<string, string>> {
  return getPool().call<Record<string, string>>('digest', { file, algorithms }, opts);
}
