import type { TypeMap, AsyncStorage } from './types.ts'
import { memory, toAsync } from './sync.ts'

/**
 * IndexedDB-backed {@link AsyncStorage}. Keys and values live in a single
 * object store. Falls back to an in-memory store when `indexedDB` is
 * unavailable (SSR, older runtimes, tests), mirroring `localStorage`'s
 * fallback to `memory()`.
 *
 * @example
 * ```ts
 * const store = indexedDB()
 * await store.set('token', 'abc')
 * await store.get('token') // 'abc'
 * ```
 */
export const indexedDB = <T extends TypeMap = TypeMap>(
  name = 'lickle-state',
  storeName = 'keyval',
): AsyncStorage<T> => {
  if (typeof globalThis === 'undefined' || !('indexedDB' in globalThis)) return toAsync(memory<T>())

  let dbPromise: Promise<IDBDatabase> | null = null
  const db = () =>
    (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = globalThis.indexedDB.open(name)
      req.onupgradeneeded = () => req.result.createObjectStore(storeName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }))

  const run = <R>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> =>
    db().then(
      (database) =>
        new Promise<R>((resolve, reject) => {
          const req = fn(database.transaction(storeName, mode).objectStore(storeName))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        }),
    )

  return {
    kind: 'async',
    get: (key) => run('readonly', (s) => s.get(key as string)).then((v) => (v === undefined ? null : (v as any))),
    set: (key, value) => run('readwrite', (s) => s.put(value, key as string)).then(() => undefined),
    delete: (key) => run('readwrite', (s) => s.delete(key as string)).then(() => undefined),
  }
}
