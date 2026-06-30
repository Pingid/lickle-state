/**
 * @lickle/state/storage
 *
 * Key-value storage backends and the combinators that adapt them.
 *
 * A backend is either a {@link SyncStorage} (localStorage, sessionStorage,
 * memory) or an {@link AsyncStorage} (IndexedDB). The {@link storage} factory
 * builds one from a name; lower-level constructors ({@link memory},
 * {@link local}, {@link session}, {@link indexedDB}, {@link fromWeb}) build them
 * directly. Combinators reshape a backend: {@link prefix} namespaces keys,
 * {@link serialized} (de)serializes string-only stores, {@link transform} maps
 * values, and {@link toAsync} lifts a sync store to the async interface.
 *
 * Pair any of these with `persist` from `@lickle/state` to back an atom.
 *
 * @example
 * ```ts
 * import { atom, persist } from '@lickle/state'
 * import { storage, prefix, serialized, local } from '@lickle/state/storage'
 *
 * const store = serialized(prefix(local(), 'app:'))
 * persist('count', atom(0), store)
 * ```
 */

import type { AsyncNullMap, KeyReadable, KeyWritable, NullMap, TypeMap } from '../primitives.ts'

/**
 *
 * @group Types
 */
export interface StorageReadable<T extends TypeMap = TypeMap> extends KeyReadable<NullMap<T>> {
  get: <K extends keyof T>(key: K) => T[K] | null
}

/**
 * @group Types
 */
export interface StorageWritable<T extends TypeMap = TypeMap> extends KeyWritable<T> {
  set: <K extends keyof T>(key: K, value: T[K]) => void
  delete: (key: keyof T) => void
}

/**
 * A synchronous key-value store. `get` returns `null` for missing keys.
 *
 * @group Types
 */
export interface SyncStorage<T extends TypeMap = TypeMap> extends StorageReadable<T>, StorageWritable<T> {
  kind: 'sync'
}

/**
 * @group Types
 */
export interface AsyncStorageReadable<T extends TypeMap = TypeMap> extends KeyReadable<AsyncNullMap<T>> {
  get: <K extends keyof T>(key: K) => Promise<T[K] | null>
}

/**
 * @group Types
 */
export interface AsyncStorageWritable<T extends TypeMap = TypeMap> extends KeyWritable<T, Promise<void>> {
  set: <K extends keyof T>(key: K, value: T[K]) => Promise<void>
  delete: <K extends keyof T>(key: K) => Promise<void>
}

/**
 * An asynchronous key-value store. Every operation resolves a promise; `get`
 * resolves `null` for missing keys.
 *
 * @group Types
 */
export interface AsyncStorage<T extends TypeMap = TypeMap> extends AsyncStorageReadable<T>, AsyncStorageWritable<T> {
  kind: 'async'
}

/**
 * Either storage flavour, with value types erased.
 *
 * @group Types
 */
export type AnyStorage = SyncStorage<any> | AsyncStorage<any>

/**
 * Options for the {@link storage} factory.
 *
 * - `fallback`: store to use when the requested web backend is unavailable
 *   (SSR, older runtimes, tests). Defaults to {@link memory}.
 * - `serialize` / `deserialize`: convert values to and from the strings that
 *   `local`/`session` backends hold. Default to JSON.
 *
 * @group Types
 */
type SyncStorageOptions<T extends TypeMap = TypeMap> = {
  fallback?: SyncStorage<T>
  serialize?: (value: T[keyof T], key: keyof T) => string
  deserialize?: (value: string, key: keyof T) => T[keyof T]
}

/**
 * Build a storage backend from a name, or pass an existing one straight
 * through. `'local'` and `'session'` produce {@link SyncStorage} backed by the
 * matching web storage, JSON-serialized so non-string values round-trip;
 * `'indexedDB'` produces {@link AsyncStorage}. When a web backend is missing,
 * `opts.fallback` (default {@link memory}) is returned instead.
 *
 * @example
 * ```ts
 * const settings = storage<{ theme: string }>('local')
 * settings.set('theme', 'dark')
 * settings.get('theme') // 'dark'
 *
 * // pass an existing store through unchanged
 * storage(memory())
 * ```
 *
 * @group Storage
 */
export function storage<T extends TypeMap>(backing: 'local', opts?: SyncStorageOptions<T>): SyncStorage<T>
export function storage<T extends TypeMap>(backing: 'session', opts?: SyncStorageOptions<T>): SyncStorage<T>
export function storage<T extends TypeMap>(backing: 'indexedDB', opts?: SyncStorageOptions<T>): IndexedDBStorage<T>
export function storage<K extends string, T>(
  backing: 'local',
  opts?: SyncStorageOptions<Record<K, T>>,
): SyncStorage<Record<K, T>>
export function storage<K extends string, T>(
  backing: 'session',
  opts?: SyncStorageOptions<Record<K, T>>,
): SyncStorage<Record<K, T>>
export function storage<K extends string, T>(
  backing: 'indexedDB',
  opts?: SyncStorageOptions<Record<K, T>>,
): IndexedDBStorage<Record<K, T>>
export function storage<T extends AnyStorage>(store: T): T
export function storage<T>(
  backing: 'local',
  opts?: SyncStorageOptions<Record<string, T>>,
): SyncStorage<Record<string, T>>
export function storage<T>(
  backing: 'session',
  opts?: SyncStorageOptions<Record<string, T>>,
): SyncStorage<Record<string, T>>
export function storage<T>(
  backing: 'indexedDB',
  opts?: SyncStorageOptions<Record<string, T>>,
): IndexedDBStorage<Record<string, T>>

export function storage<T>(
  backing: 'local' | 'session' | 'indexedDB' | SyncStorage<Record<string, T>> | AsyncStorage<Record<string, T>>,
  opts: SyncStorageOptions<Record<string, T>> = {},
): SyncStorage<Record<string, T>> | AsyncStorage<Record<string, T>> {
  if (typeof backing !== 'string') return backing
  if (backing === 'indexedDB') return indexedDB() as any

  const web = backing === 'local' ? globalThis.window?.localStorage : globalThis.window?.sessionStorage
  if (!web) return (opts.fallback ?? memory()) as SyncStorage<Record<string, T>>
  return serialized(fromWeb(web), opts.serialize as any, opts.deserialize as any)
}

/**
 * Namespace every key of a {@link SyncStorage} with `prefix`. Useful for
 * isolating one feature's keys from another's in a shared backend. Call it
 * curried (`prefix('app:')`) to compose, or data-first (`prefix(store, 'app:')`)
 * to apply immediately.
 *
 * @example
 * ```ts
 * const ns = prefix(local(), 'app:')
 * ns.set('count', '1') // writes key 'app:count'
 * ```
 *
 * @group Storage
 */
export function prefix<T extends TypeMap = TypeMap>(prefix: string): (storage: SyncStorage<T>) => SyncStorage<T>
export function prefix<T extends TypeMap = TypeMap>(storage: SyncStorage<T>, prefix: string): SyncStorage<T>
export function prefix<K extends string, V>(
  prefix: string,
): (storage: SyncStorage<Record<K, V>>) => SyncStorage<Record<K, V>>
export function prefix<K extends string, V>(
  storage: SyncStorage<Record<K, V>>,
  prefix: string,
): SyncStorage<Record<K, V>>

export function prefix(a: string | SyncStorage<Record<string, any>>, b?: string): any {
  const apply =
    (p: string) =>
    (storage: SyncStorage<Record<string, any>>): SyncStorage<Record<string, any>> => ({
      kind: 'sync',
      get(key) {
        return storage.get(p + (key as string)) as any
      },
      set(key, value) {
        storage.set(p + (key as string), value as any)
      },
      delete(key) {
        storage.delete(p + (key as string))
      },
    })

  return typeof a === 'string' ? apply(a) : apply(b as string)(a)
}

/**
 * A {@link SyncStorage} whose entries live in an exposed `store` Map.
 *
 * @group Types
 */
export interface MemoryStorage<T extends TypeMap = TypeMap> extends SyncStorage<T> {
  store: Map<keyof T, T[keyof T]>
}

/**
 * In-memory {@link SyncStorage}. Values are held in a `Map`, so anything is
 * stored as-is (no serialization). Handy for tests and as a fallback when web
 * storage is unavailable.
 *
 * @example
 * ```ts
 * const store = memory<{ count: number }>()
 * store.set('count', 1)
 * store.get('count') // 1
 * ```
 *
 * @group Storage
 */
export function memory<K extends string, V>(): MemoryStorage<Record<K, V>>
export function memory<T extends TypeMap>(): MemoryStorage<T>
export function memory(): MemoryStorage<Record<string, any>> {
  const map = new Map<string, any>()
  return {
    store: map,
    kind: 'sync',
    get: (key) => {
      return map.get(key) as any
    },
    set(key, value) {
      map.set(key, value)
    },
    delete(key) {
      map.delete(key)
    },
  }
}

/**
 * String-valued {@link SyncStorage} backed by `sessionStorage`. Falls back to
 * {@link memory} when `sessionStorage` is unavailable.
 *
 * @group Storage
 */
export function session<K extends string, V>(): SyncStorage<Record<K, V>>
export function session<T extends TypeMap = Record<string, string>>(): SyncStorage<T>

export function session(): SyncStorage<Record<string, string>> {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) return memory<any>()
  return fromWeb(window.sessionStorage) as any
}

/**
 * String-valued {@link SyncStorage} backed by `localStorage`. Falls back to
 * {@link memory} when `localStorage` is unavailable.
 *
 * @group Storage
 */
export function local<K extends string, V>(): SyncStorage<Record<K, V>>
export function local<T extends TypeMap>(): SyncStorage<T>
export function local(): SyncStorage<Record<string, string>> {
  if (typeof window === 'undefined' || !('localStorage' in window)) return memory<any>()
  return fromWeb(window.localStorage) as any
}

/**
 * Wrap a Web Storage object (`localStorage`, `sessionStorage`) as a
 * string-valued {@link SyncStorage}. Use {@link serialized} on top to store
 * structured values.
 *
 * @example
 * ```ts
 * const store = fromWeb(window.localStorage)
 * ```
 *
 * @group Storage
 */
export function fromWeb(storage: Storage): SyncStorage<Record<string, string>> {
  return {
    kind: 'sync',
    get(key) {
      return storage.getItem(key as string) as any
    },
    set(key, value) {
      storage.setItem(key as string, value as string)
    },
    delete(key) {
      storage.removeItem(key as string)
    },
  }
}

/**
 * Lift a {@link SyncStorage} to the {@link AsyncStorage} interface by wrapping
 * every result in a resolved promise. Lets sync backends satisfy code that
 * expects the async shape.
 *
 * @example
 * ```ts
 * const store = toAsync(memory<{ token: string }>())
 * await store.set('token', 'abc')
 * await store.get('token') // 'abc'
 * ```
 *
 * @group Storage
 */
export function toAsync<T extends TypeMap = TypeMap>(storage: SyncStorage<T>): AsyncStorage<T>
export function toAsync<K extends string, V>(storage: AsyncStorage<Record<K, V>>): AsyncStorage<Record<K, V>>
export function toAsync(storage: AnyStorage): AsyncStorage<any> {
  return {
    kind: 'async',
    get(key) {
      return Promise.resolve(storage.get(key))
    },
    set(key, value) {
      return Promise.resolve(storage.set(key, value))
    },
    delete(key) {
      return Promise.resolve(storage.delete(key))
    },
  }
}

/**
 * Adapt a string-only {@link SyncStorage} (e.g. {@link fromWeb}) into one that
 * holds structured values, serializing on `set` and deserializing on `get`.
 * Defaults to JSON. Call it data-first (`serialized(store)`) or curried
 * (`serialized()`) to compose with {@link prefix} and friends.
 *
 * @example
 * ```ts
 * const store = serialized<{ user: { name: string } }>(local())
 * store.set('user', { name: 'Alice' })
 * store.get('user') // { name: 'Alice' }
 * ```
 *
 * @group Storage
 */
export function serialized<T extends TypeMap = TypeMap>(
  storage: SyncStorage<Record<string, string>>,
  serializer?: (value: T[keyof T]) => string,
  deserializer?: (value: string, key: keyof T) => T[keyof T],
): SyncStorage<T>

export function serialized<T extends TypeMap = TypeMap>(
  serializer?: (value: T[keyof T]) => string,
  deserializer?: (value: string, key: keyof T) => T[keyof T],
): (storage: SyncStorage<Record<string, string>>) => SyncStorage<T>

export function serialized<K extends string, V>(
  storage: SyncStorage<Record<string, string>>,
  serializer?: (value: V) => string,
  deserializer?: (value: string) => V,
): SyncStorage<Record<K, V>>

export function serialized<K extends string, V>(
  serializer?: (value: V) => string,
  deserializer?: (value: string) => V,
): (storage: SyncStorage<Record<string, string>>) => SyncStorage<Record<K, V>>

export function serialized(a: any, b?: any, c?: any) {
  const isStore = a && typeof a === 'object' && 'kind' in a
  const wrap =
    (serializer: (value: any, key: any) => string, deserializer: (value: string, key: any) => any) =>
    (store: SyncStorage<Record<string, string>>): SyncStorage<Record<string, any>> => ({
      kind: 'sync',
      get(key) {
        const value = store.get(key as string)
        return value != null ? deserializer(value, key) : null
      },
      set(key, value) {
        store.set(key as string, serializer(value, key))
      },
      delete(key) {
        store.delete(key as string)
      },
    })

  if (isStore) return wrap(b ?? defaultSerializer, c ?? defaultDeserializer)(a)
  return wrap(a ?? defaultSerializer, b ?? defaultDeserializer)
}

const defaultSerializer = (value: any) => JSON.stringify({ value })
const defaultDeserializer = (value: string) => JSON.parse(value).value

/**
 * An {@link AsyncStorage} that also exposes its IndexedDB database and object
 * store names.
 *
 * @group Types
 */
export interface IndexedDBStorage<T extends TypeMap = TypeMap> extends AsyncStorage<T> {
  name: string
  storeName: string
  /** Remove every entry from the object store. */
  clear: () => Promise<void>
  /** Drop the object store and re-create it empty. Bumps the DB version. */
  recreate: () => Promise<void>
  /** Delete the entire database. A later `get`/`set` reopens it fresh. */
  destroy: () => Promise<void>
  /** All keys currently in the store. */
  keys: () => Promise<(keyof T)[]>
  /** All key/value pairs currently in the store. */
  entries: () => Promise<[keyof T, T[keyof T]][]>
}

/**
 * IndexedDB-backed {@link AsyncStorage}. Keys and values share a single object
 * store; values are kept structured (no serialization). Falls back to an
 * in-memory store when `indexedDB` is unavailable (SSR, older runtimes, tests).
 *
 * @example
 * ```ts
 * const store = indexedDB()
 * await store.set('token', 'abc')
 * await store.get('token') // 'abc'
 * await store.keys()       // ['token']
 * await store.clear()      // wipe every entry
 * await store.recreate()   // drop and rebuild the object store
 * await store.destroy()    // delete the whole database
 * ```
 *
 * @group Storage
 */
export function indexedDB<K extends string, V>(name?: string, storeName?: string): IndexedDBStorage<Record<K, V>>
export function indexedDB<T extends TypeMap = TypeMap>(name: string, storeName: string): IndexedDBStorage<T>
export function indexedDB(
  name: string = 'lickle-state',
  storeName: string = 'keyval',
): IndexedDBStorage<Record<string, any>> {
  if (typeof globalThis === 'undefined' || !('indexedDB' in globalThis)) {
    const mem = memory<any>()
    return {
      ...toAsync(mem),
      name,
      storeName,
      clear: () => (mem.store.clear(), Promise.resolve()),
      recreate: () => (mem.store.clear(), Promise.resolve()),
      destroy: () => (mem.store.clear(), Promise.resolve()),
      keys: () => Promise.resolve([...mem.store.keys()] as any),
      entries: () => Promise.resolve([...mem.store.entries()] as [any, any][]),
    }
  }

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

  // Mutating the store schema needs a version-change transaction, so close the
  // current connection, reopen at version + 1, and rebuild the store there.
  const recreate = () => {
    const p = db().then(
      (database) =>
        new Promise<IDBDatabase>((resolve, reject) => {
          database.close()
          const req = globalThis.indexedDB.open(name, database.version + 1)
          req.onupgradeneeded = () => {
            const d = req.result
            if (d.objectStoreNames.contains(storeName)) d.deleteObjectStore(storeName)
            d.createObjectStore(storeName)
          }
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        }),
    )
    dbPromise = p // concurrent ops await the rebuilt connection
    return p.then(() => undefined)
  }

  const destroy = () =>
    db().then(
      (database) =>
        new Promise<void>((resolve, reject) => {
          database.close()
          dbPromise = null // next op reopens (and re-creates) the DB
          const req = globalThis.indexedDB.deleteDatabase(name)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
          req.onblocked = () => resolve()
        }),
    )

  // getAllKeys() and getAll() share an ascending-key order, so zip by index.
  const entries = () =>
    db().then(
      (database) =>
        new Promise<[any, any][]>((resolve, reject) => {
          const s = database.transaction(storeName, 'readonly').objectStore(storeName)
          const ks = s.getAllKeys()
          const vs = s.getAll()
          s.transaction.oncomplete = () => resolve(ks.result.map((k, i) => [k, vs.result[i]]))
          s.transaction.onerror = () => reject(s.transaction.error)
        }),
    )

  return {
    kind: 'async',
    get: (key) => run('readonly', (s) => s.get(key as string)).then((v) => (v === undefined ? null : (v as any))),
    set: (key, value) => run('readwrite', (s) => s.put(value, key as string)).then(() => undefined),
    delete: (key) => run('readwrite', (s) => s.delete(key as string)),
    clear: () => run('readwrite', (s) => s.clear()).then(() => undefined),
    keys: () => run('readonly', (s) => s.getAllKeys()).then((ks) => ks as any),
    entries,
    recreate,
    destroy,
    name,
    storeName,
  }
}
