/**
 * Minimal request/response RPC over postMessage with progress events and a
 * small worker pool. Workers are terminated after being idle for a while to
 * free memory.
 */
import { AbortedError, UserError } from '../utils/errors';

export interface RpcRequest<P = unknown> {
  id: number;
  method: string;
  params: P;
}

export type RpcMessage =
  | { id: number; type: 'progress'; value: number }
  | { id: number; type: 'result'; value: unknown }
  | { id: number; type: 'error'; message: string; name?: string; hint?: string };

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  onProgress?: (v: number) => void;
}

class WorkerSlot {
  worker: Worker;
  busy = 0;
  pending = new Map<number, Pending>();
  constructor(factory: () => Worker) {
    this.worker = factory();
    this.worker.onmessage = (e: MessageEvent<RpcMessage>) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') return p.onProgress?.(msg.value);
      this.pending.delete(msg.id);
      this.busy--;
      if (msg.type === 'result') p.resolve(msg.value);
      else {
        if (msg.name === 'UserError') return p.reject(new UserError(msg.message, msg.hint));
        const err = new Error(msg.message);
        err.name = msg.name ?? 'Error';
        p.reject(err);
      }
    };
    this.worker.onerror = (e) => {
      e.preventDefault?.();
      const err = new Error(e.message || 'Worker crashed (possibly out of memory).');
      this.pending.forEach((p) => p.reject(err));
      this.pending.clear();
      this.busy = 0;
    };
  }
}

let nextId = 1;

export class WorkerPool {
  private slots: WorkerSlot[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private factory: () => Worker,
    private size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)),
    private idleMs = 60_000,
  ) {}

  private pick(): WorkerSlot {
    let slot = this.slots.reduce<WorkerSlot | undefined>((best, s) => (!best || s.busy < best.busy ? s : best), undefined);
    if (!slot || (slot.busy > 0 && this.slots.length < this.size)) {
      slot = new WorkerSlot(this.factory);
      this.slots.push(slot);
    }
    return slot;
  }

  call<R>(method: string, params: unknown, opts: { transfer?: Transferable[]; onProgress?: (v: number) => void; signal?: AbortSignal } = {}): Promise<R> {
    if (opts.signal?.aborted) return Promise.reject(new AbortedError());
    clearTimeout(this.idleTimer);
    const slot = this.pick();
    const id = nextId++;
    slot.busy++;
    return new Promise<R>((resolve, reject) => {
      const onAbort = () => {
        // A running job can't be interrupted cooperatively; kill the worker.
        slot.pending.forEach((p) => p.reject(new AbortedError()));
        slot.pending.clear();
        slot.worker.terminate();
        this.slots = this.slots.filter((s) => s !== slot);
      };
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      slot.pending.set(id, {
        resolve: (v) => {
          opts.signal?.removeEventListener('abort', onAbort);
          this.scheduleIdle();
          resolve(v as R);
        },
        reject: (e) => {
          opts.signal?.removeEventListener('abort', onAbort);
          this.scheduleIdle();
          reject(e);
        },
        onProgress: opts.onProgress,
      });
      try {
        slot.worker.postMessage({ id, method, params } satisfies RpcRequest, opts.transfer ?? []);
      } catch (e) {
        slot.pending.delete(id);
        slot.busy--;
        reject(e);
      }
    });
  }

  private scheduleIdle(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.terminate(), this.idleMs);
  }

  terminate(): void {
    for (const s of this.slots) if (s.busy === 0) s.worker.terminate();
    this.slots = this.slots.filter((s) => s.busy > 0);
  }
}

/** Worker-side helper: register handlers for incoming RPC calls. */
export function exposeHandlers(handlers: Record<string, (params: never, progress: (v: number) => void) => Promise<{ value: unknown; transfer?: Transferable[] }>>): void {
  const scope = self as unknown as { onmessage: ((e: MessageEvent<RpcRequest>) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void };
  scope.onmessage = async (e) => {
    const { id, method, params } = e.data;
    const progress = (value: number) => scope.postMessage({ id, type: 'progress', value });
    try {
      const fn = handlers[method];
      if (!fn) throw new Error(`Unknown method ${method}`);
      const { value, transfer } = await fn(params as never, progress);
      scope.postMessage({ id, type: 'result', value }, transfer ?? []);
    } catch (err) {
      const er = err as Error & { hint?: string };
      scope.postMessage({ id, type: 'error', message: er?.message ?? String(err), name: er?.name, hint: er?.hint });
    }
  };
}
