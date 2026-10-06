/**
 * Minimal promise wrapper around IndexedDB with an in-memory fallback
 * (private browsing modes or disabled storage must not break the app).
 */
const DB_NAME = 'uft';
const DB_VERSION = 1;
export const STORES = ['history', 'toolSettings'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, Map<IDBValidKey, unknown>>();

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function mem(store: StoreName): Map<IDBValidKey, unknown> {
  let m = memory.get(store);
  if (!m) memory.set(store, (m = new Map()));
  return m;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = fn(db.transaction(store, mode).objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await open();
  if (!db) return mem(store).get(key) as T | undefined;
  return tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
}

export async function idbSet(store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await open();
  if (!db) {
    mem(store).set(key, value);
    return;
  }
  await tx(store, 'readwrite', (s) => s.put(value, key));
}

export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await open();
  if (!db) {
    mem(store).delete(key);
    return;
  }
  await tx(store, 'readwrite', (s) => s.delete(key));
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await open();
  if (!db) {
    mem(store).clear();
    return;
  }
  await tx(store, 'readwrite', (s) => s.clear());
}
