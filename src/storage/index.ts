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
 * Read side of a storage backend: `get` returns the stored value or `null`.
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
  /** All keys currently in the store. */
  keys: Iterable<keyof T>
  /** All key/value pairs currently in the store. */
  entries: Iterable<{ [K in keyof T]: [K, T[K]] }[keyof T]>
}

/**
 * Async read side of a storage backend: `get` resolves to the value or `null`.
 *
 * @group Types
 */
export interface AsyncStorageReadable<T extends TypeMap = TypeMap> extends KeyReadable<AsyncNullMap<T>> {
  get: <K extends keyof T>(key: K) => Promise<T[K] | null>
}

/**
 * Async write side of a storage backend: `set` and `delete` return promises.
 *
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
 */
/** Pass an existing {@link SyncStorage} through unchanged. */
export function storage<T extends TypeMap>(store: SyncStorage<T>): SyncStorage<T>
/** Build a JSON-serialized {@link SyncStorage} backed by `localStorage`; falls back to {@link memory} when unavailable. */
export function storage<T extends TypeMap>(backing: 'local', opts?: SyncStorageOptions<T>): SyncStorage<T>
/** Build a JSON-serialized {@link SyncStorage} backed by `sessionStorage`; falls back to {@link memory} when unavailable. */
export function storage<T extends TypeMap>(backing: 'session', opts?: SyncStorageOptions<T>): SyncStorage<T>
/** Build an {@link IndexedDBStorage} backed by IndexedDB. */
export function storage<T extends TypeMap>(backing: 'indexedDB', opts?: SyncStorageOptions<T>): IndexedDBStorage<T>
/** `localStorage` variant with explicit key union `K` and value type `V`. */
export function storage<K extends string, T>(
  backing: 'local',
  opts?: SyncStorageOptions<Record<K, T>>,
): SyncStorage<Record<K, T>>
/** `sessionStorage` variant with explicit key union `K` and value type `V`. */
export function storage<K extends string, T>(
  backing: 'session',
  opts?: SyncStorageOptions<Record<K, T>>,
): SyncStorage<Record<K, T>>
/** IndexedDB variant with explicit key union `K` and value type `V`. */
export function storage<K extends string, T>(
  backing: 'indexedDB',
  opts?: SyncStorageOptions<Record<K, T>>,
): IndexedDBStorage<Record<K, T>>
/** `localStorage` variant typed as `Record<string, T>`. */
export function storage<T>(
  backing: 'local',
  opts?: SyncStorageOptions<Record<string, T>>,
): SyncStorage<Record<string, T>>
/** `sessionStorage` variant typed as `Record<string, T>`. */
export function storage<T>(
  backing: 'session',
  opts?: SyncStorageOptions<Record<string, T>>,
): SyncStorage<Record<string, T>>
/** IndexedDB variant typed as `Record<string, T>`. */
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
 */
/** Curried form: returns a function that applies the prefix to a storage. */
export function prefix<T extends TypeMap = TypeMap>(prefix: string): (storage: SyncStorage<T>) => SyncStorage<T>
/** Data-first form: applies the prefix to `storage` immediately. */
export function prefix<T extends TypeMap = TypeMap>(storage: SyncStorage<T>, prefix: string): SyncStorage<T>
/** Curried form with explicit key union `K` and value type `V`. */
export function prefix<K extends string, V>(
  prefix: string,
): (storage: SyncStorage<Record<K, V>>) => SyncStorage<Record<K, V>>
/** Data-first form with explicit key union `K` and value type `V`. */
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
      get keys(): Iterable<string> {
        const src = storage.keys
        return (function* () {
          for (const k of src) {
            if ((k as string).startsWith(p)) yield (k as string).slice(p.length)
          }
        })()
      },
      get entries(): Iterable<[string, any]> {
        const src = storage.entries
        return (function* () {
          for (const [k, v] of src) {
            if ((k as string).startsWith(p)) yield [(k as string).slice(p.length), v] as [string, any]
          }
        })()
      },
    })

  return typeof a === 'string' ? apply(a) : apply(b as string)(a)
}

/**
 * A {@link SyncStorage} whose entries live in an exposed `store` Map.
 *
 * @group Types
 */
export type MemoryStorage<T extends TypeMap = TypeMap> = SyncStorage<T>

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
 */
/** Type parameters as explicit key union `K` and value type `V`. */
export function memory<K extends string, V>(store?: Map<string, any>): SyncStorage<Record<K, V>>
/** Type parameter as a full {@link TypeMap}. */
export function memory<T extends TypeMap>(store?: Map<string, any>): SyncStorage<T>
export function memory(store: Map<string, any> = new Map<string, any>()): SyncStorage<Record<string, any>> {
  return {
    kind: 'sync',
    get: (key) => store.get(key) as any,
    set(key, value) {
      store.set(key, value)
    },
    delete(key) {
      store.delete(key)
    },
    get keys() {
      return store.keys()
    },
    get entries() {
      return store.entries()
    },
  }
}

/**
 * String-valued {@link SyncStorage} backed by `sessionStorage`. Falls back to
 * {@link memory} when `sessionStorage` is unavailable.
 *
 */
/** Type parameters as explicit key union `K` and value type `V`. */
export function session<K extends string, V>(): SyncStorage<Record<K, V>>
/** Type parameter as a full {@link TypeMap}; defaults to `Record<string, string>`. */
export function session<T extends TypeMap = Record<string, string>>(): SyncStorage<T>

export function session(): SyncStorage<Record<string, string>> {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) return memory<any>()
  return fromWeb(window.sessionStorage) as any
}

/**
 * String-valued {@link SyncStorage} backed by `localStorage`. Falls back to
 * {@link memory} when `localStorage` is unavailable.
 *
 */
/** Type parameters as explicit key union `K` and value type `V`. */
export function local<K extends string, V>(): SyncStorage<Record<K, V>>
/** Type parameter as a full {@link TypeMap}. */
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
    get keys() {
      return Object.keys(storage)
    },
    get entries(): Iterable<[string, string]> {
      return Object.keys(storage).map((k) => [k, storage.getItem(k) as string] as [string, string])
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
 */
/** Lift a {@link SyncStorage} to the {@link AsyncStorage} interface, wrapping each result in a resolved promise. */
export function toAsync<T extends TypeMap = TypeMap>(storage: SyncStorage<T>): AsyncStorage<T>
/** Pass-through overload for stores already typed as `AsyncStorage<Record<K, V>>`. */
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
 */
/** Data-first form; type parameter as a full {@link TypeMap}. */
export function serialized<T extends TypeMap = TypeMap>(
  storage: SyncStorage<Record<string, string>>,
  serializer?: (value: T[keyof T]) => string,
  deserializer?: (value: string, key: keyof T) => T[keyof T],
): SyncStorage<T>

/** Curried form; type parameter as a full {@link TypeMap}. */
export function serialized<T extends TypeMap = TypeMap>(
  serializer?: (value: T[keyof T]) => string,
  deserializer?: (value: string, key: keyof T) => T[keyof T],
): (storage: SyncStorage<Record<string, string>>) => SyncStorage<T>

/** Data-first form with explicit key union `K` and value type `V`. */
export function serialized<K extends string, V>(
  storage: SyncStorage<Record<string, string>>,
  serializer?: (value: V) => string,
  deserializer?: (value: string) => V,
): SyncStorage<Record<K, V>>

/** Curried form with explicit key union `K` and value type `V`. */
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
      get keys() {
        return store.keys
      },
      get entries(): Iterable<[string, any]> {
        const src = store.entries
        return (function* () {
          for (const [k, v] of src) yield [k as string, deserializer(v as string, k)] as [string, any]
        })()
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
 */
/** Type parameters as explicit key union `K` and value type `V`; both arguments are optional. */
export function indexedDB<K extends string, V>(name?: string, storeName?: string): IndexedDBStorage<Record<K, V>>
/** Type parameter as a full {@link TypeMap}; `name` and `storeName` are required. */
export function indexedDB<T extends TypeMap = TypeMap>(name: string, storeName: string): IndexedDBStorage<T>
export function indexedDB(
  name: string = 'lickle-state',
  storeName: string = 'keyval',
): IndexedDBStorage<Record<string, any>> {
  if (typeof globalThis === 'undefined' || !('indexedDB' in globalThis)) {
    const store = new Map<string, any>()
    const mem = memory<any>(store)
    return {
      ...toAsync(mem),
      name,
      storeName,
      clear: () => (store.clear(), Promise.resolve()),
      recreate: () => (store.clear(), Promise.resolve()),
      destroy: () => (store.clear(), Promise.resolve()),
      keys: () => Promise.resolve([...store.keys()] as any),
      entries: () => Promise.resolve([...store.entries()] as [any, any][]),
    }
  }

  let dbPromise: Promise<IDBDatabase> | null = null
  const db = () =>
    (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = globalThis.indexedDB.open(name)
      req.onupgradeneeded = () => req.result.createObjectStore(storeName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error(`IndexedDB open blocked: ${name}`))
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
          req.onblocked = () => reject(new Error(`IndexedDB version-change blocked: ${name}`))
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

  const entries = () =>
    db().then(
      (database) =>
        new Promise<[any, any][]>((resolve, reject) => {
          const s = database.transaction(storeName, 'readonly').objectStore(storeName)
          const ks = s.getAllKeys()
          const vs = s.getAll()
          s.transaction.oncomplete = () => {
            // sanity guard — a concurrent write in another tab can still
            // produce a torn read between getAllKeys and getAll
            if (ks.result.length !== vs.result.length)
              return reject(new Error('IndexedDB entries: key/value count mismatch'))
            resolve(ks.result.map((k, i) => [k, vs.result[i]]))
          }
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
