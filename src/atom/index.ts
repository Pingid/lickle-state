/**
 * @lickle/state
 *
 * A tiny, type-safe reactive state library.
 *
 * State lives in {@link atom | atoms}. Derived values compose from atoms with
 * {@link derive} and {@link select}. Side effects attach with {@link effect}
 * and {@link onMount}. The React integration lives in `@lickle/state/react`.
 *
 * @example
 * ```ts
 * import { atom, derive, effect } from '@lickle/state/atom'
 *
 * const count = atom(0)
 * const doubled = derive([count], (n) => n * 2)
 *
 * const stop = effect(count, () => console.log('count:', count.get()))
 * // logs "count: 0" immediately
 * count.set(1) // logs "count: 1"
 * stop()
 * ```
 *
 * @example
 * React integration:
 * ```tsx
 * import { atom } from '@lickle/state/atom'
 * import { useStore } from '@lickle/state/react'
 *
 * const count = atom(0)
 *
 * function Counter() {
 *   const n = useStore(count)
 *   return <button onClick={() => count.set(n + 1)}>{n}</button>
 * }
 * ```
 */

import type { AsyncStorage, SyncStorage } from '../storage/index.ts'
import type { KeyReadable, KeyWritable, Reactive, Readable, TypeMap, Writable } from '../primitives.ts'

/**
 * A readable, reactive atom — can be read and subscribed to.
 *
 * @group Types
 */
export interface ReadableAtom<T> extends Readable<T>, Reactive<[callback: () => void]> {}

/**
 * A fully reactive atom: readable, writable, and subscribable.
 *
 * @group Types
 */
export interface Atom<T> extends ReadableAtom<T>, Writable<[value: T]> {
  lc: number
}

// ---- atoms ----

/**
 * Create a writable reactive atom holding `init` as the initial value.
 * Subscribers are notified synchronously on every `set`. Equal values (per
 * `eq`, defaulting to `===`) are swallowed. Pass `() => false` to always
 * notify, e.g. for atoms holding mutable objects you mutate in place.
 *
 * @example
 * ```ts
 * const count = atom(0)
 * count.get()  // 0
 * count.set(1)
 * count.get()  // 1
 *
 * const unsub = count.sub(() => console.log(count.get()))
 * count.set(2) // logs 2
 * unsub()
 * ```
 *
 * @group Atoms
 */
export const atom = <T>(init: T, eq: (a: T, b: T) => boolean = (a, b) => a === b): Atom<T> => {
  const listeners = new Set<() => void>()

  const $atom = {
    lc: 0,
    init,
    value: init,
    get: () => $atom.value,
    set: (value: T) => {
      if (eq(value, $atom.value)) return
      $atom.value = value
      for (const l of [...listeners]) l()
    },
    sub: (callback: () => void) => {
      $atom.lc++
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
        $atom.lc--
      }
    },
  }

  return $atom
}

/**
 * Derive a read-only atom by computing a value from one or more source atoms.
 * The derived atom only subscribes to its sources when it has at least one
 * subscriber itself, and unsubscribes when all of its subscribers leave.
 * Notifications are suppressed when the new computed value is equal to the
 * previous one (per `eq`, defaulting to `===`).
 *
 * @example
 * ```ts
 * const a = atom(2)
 * const b = atom(3)
 * const sum = derive([a, b], (x, y) => x + y)
 * sum.get() // 5
 * a.set(10)
 * sum.get() // 13
 * ```
 *
 * @group Atoms
 */
export const derive = <R, const A extends ReadableAtom<any>[]>(
  items: A,
  compute: (...args: { [K in keyof A]: InferRead<A[K]> }) => R,
  eq: (a: R, b: R) => boolean = (a, b) => a === b,
): ReadableAtom<R> => {
  const listeners = new Set<() => void>()
  let cached: { value: R } | null = null
  let srcUnsubs: (() => void)[] = []

  const recompute = () => compute(...(items.map((a) => a.get()) as any))

  const notify = () => {
    const next = recompute()
    if (cached && eq(cached.value, next)) return
    cached = { value: next }
    for (const l of [...listeners]) l()
  }

  const $derived = {
    lc: 0,
    get: () => {
      if ($derived.lc === 0 || !cached) cached = { value: recompute() }
      return cached.value
    },
    sub: (callback: () => void) => {
      if ($derived.lc === 0) {
        cached = { value: recompute() }
        srcUnsubs = items.map((a) => a.sub(notify))
      }
      $derived.lc++
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
        $derived.lc--
        if ($derived.lc === 0) {
          srcUnsubs.forEach((u) => u())
          srcUnsubs = []
          cached = null
        }
      }
    },
  }

  return $derived
}

/**
 * Derive a read-only atom by applying `selector` to a single source atom.
 * Notifications are suppressed when the selected value is unchanged (per `eq`,
 * defaulting to `===`). Like {@link derive}, it subscribes lazily.
 *
 * @example
 * ```ts
 * const user = atom({ name: 'Alice', age: 30 })
 * const name = select(user, (u) => u.name)
 * name.get() // 'Alice'
 * ```
 *
 * @group Atoms
 */
export const select = <A, B>(
  src: ReadableAtom<A>,
  selector: (value: A) => B,
  eq: (a: B, b: B) => boolean = (a, b) => a === b,
): ReadableAtom<B> => derive([src], selector, eq)

// ---- effects ----

/**
 * Subscribe to a reactive source, running `callback` immediately and again on
 * every subsequent change. Returns an unsubscribe function. `callback` may
 * return a cleanup function that runs before the next invocation and on final
 * dispose — matching the signal-layer `effect` contract.
 *
 * @example
 * ```ts
 * const count = atom(0)
 * const stop = effect(count, () => {
 *   const id = setInterval(() => count.set(count.get() + 1), 100)
 *   return () => clearInterval(id)
 * })
 * // logs 0 immediately
 * count.set(1) // logs 1
 * stop()
 * count.set(2) // silent
 * ```
 *
 * @group Effects
 */
export const effect = <A extends Reactive>(
  reactive: A,
  callback: () => (() => void) | void,
): (() => void) => {
  let cleanup: (() => void) | void
  const run = () => {
    cleanup?.()
    cleanup = callback()
  }
  run()
  const unsub = reactive.sub(run)
  return () => {
    cleanup?.()
    unsub()
  }
}

/**
 * Subscribe to a reactive source, calling `callback` on every change but
 * **not** immediately. Returns an unsubscribe function.
 *
 * Use {@link effect} when you need the current value right away; use `watch`
 * when you only care about future changes.
 *
 * @example
 * ```ts
 * const count = atom(0)
 * const stop = watch(count, () => console.log('changed:', count.get()))
 * count.set(1) // logs "changed: 1"
 * stop()
 * ```
 *
 * @group Effects
 */
export const watch = <A extends Reactive>(reactive: A, callback: () => void): (() => void) =>
  reactive.sub(callback)

/**
 * Read-modify-write an atom in a single call.
 *
 * @example
 * ```ts
 * const count = atom(0)
 * update(count, (n) => n + 1) // count is now 1
 * ```
 *
 * @group Atoms
 */
export const update = <T>(a: Atom<T>, fn: (value: T) => T): void => a.set(fn(a.get()))

/**
 * Wrap an atom to expose only its read surface, hiding `set`. Useful for
 * handing a derived or internal atom to consumers that should not write it.
 *
 * @example
 * ```ts
 * const _count = atom(0)
 * export const count = readonly(_count) // no .set exposed
 * ```
 *
 * @group Atoms
 */
export const readonly = <T>(a: ReadableAtom<T>): ReadableAtom<T> => ({
  get: a.get.bind(a),
  sub: a.sub.bind(a),
})

/**
 * Run `callback` the first time the reactive gains a subscriber, calling its
 * return value (cleanup) when the last subscriber leaves. Useful for lazily
 * connecting external resources (timers, WebSockets, etc.).
 *
 * When composing with {@link batch}, apply `batch` first:
 * `onMount(batch(atom), callback)` — not `batch(onMount(atom, callback))`.
 *
 * @example
 * ```ts
 * const clock = atom(Date.now())
 * onMount(clock, () => {
 *   const id = setInterval(() => clock.set(Date.now()), 1000)
 *   return () => clearInterval(id)
 * })
 * ```
 *
 * @group Effects
 */
export const onMount = <A extends Reactive<any>>(reactive: A, callback: () => () => void): A => {
  const original = reactive.sub.bind(reactive)
  let mountCleanup: (() => void) | null = null
  let users = 0
  let mounting = false

  reactive.sub = (...args: any) => {
    // Subscriptions made inside callback() pass straight through: they must not
    // re-trigger mount (infinite loop) nor count toward the mount lifecycle.
    if (mounting) return original(...args)

    users++
    if (users === 1) {
      mounting = true
      try {
        mountCleanup = callback()
      } finally {
        mounting = false
      }
    }
    const cleanup = original(...args)
    return () => {
      cleanup()
      if (--users === 0) {
        mountCleanup?.()
        mountCleanup = null
      }
    }
  }
  return reactive
}

// ---- keyed atoms ----

/**
 * A reactive record with per-key and global subscriptions.
 *
 * @group Types
 */
export interface KeyedAtom<T extends TypeMap = TypeMap> extends KeyReadable<T>, KeyWritable<T> {
  /** Subscribe to a single key; callback receives the new value. */
  sub<K extends keyof T>(key: K, callback: (value: T[K]) => void): () => void
  /** Subscribe to any change; callback receives the changed key and new value. */
  sub(callback: (key: keyof T, value: T[keyof T]) => void): () => void
  delete<K extends keyof T>(key: K): void
  lc: number
}

/**
 * Create a reactive key/value store. Subscribe per-key or globally; all
 * notifications use snapshot iteration to tolerate mid-fire subscribe/unsubscribe.
 *
 * @example
 * ```ts
 * type Session = { userId: string; theme: 'light' | 'dark' }
 * const session = keyed<Session>()
 *
 * const stopTheme = session.sub('theme', (v) => console.log('theme:', v))
 * const stopAll   = session.sub((key, v) => console.log(key, '→', v))
 *
 * session.set('theme', 'dark') // fires both
 * session.delete('userId')     // fires global with undefined
 * stopTheme(); stopAll()
 * ```
 *
 * @group Atoms
 */
export const keyed = <T extends TypeMap>(init: Partial<T> = {}): KeyedAtom<T> => {
  const store = new Map<keyof T, T[keyof T]>(Object.entries(init) as [keyof T, T[keyof T]][])
  const keyListeners = new Map<keyof T, Set<(value: any) => void>>()
  const globalListeners = new Set<(key: keyof T, value: T[keyof T]) => void>()
  let lc = 0

  const notify = <K extends keyof T>(key: K, value: T[K]) => {
    for (const l of [...(keyListeners.get(key) ?? [])]) l(value)
    for (const l of [...globalListeners]) l(key, value)
  }

  return {
    get lc() { return lc },
    get: <K extends keyof T>(key: K) => store.get(key) as T[K],
    set: <K extends keyof T>(key: K, value: T[K]) => {
      if (store.get(key) === value) return
      store.set(key, value)
      notify(key, value)
    },
    delete: <K extends keyof T>(key: K) => {
      if (!store.has(key)) return
      store.delete(key)
      notify(key, undefined as any)
    },
    sub(keyOrCallback: any, maybeCallback?: any) {
      if (typeof keyOrCallback === 'function') {
        const cb = keyOrCallback as (key: keyof T, value: T[keyof T]) => void
        globalListeners.add(cb); lc++
        return () => { globalListeners.delete(cb); lc-- }
      }
      const key = keyOrCallback as keyof T
      const cb = maybeCallback as (value: any) => void
      if (!keyListeners.has(key)) keyListeners.set(key, new Set())
      keyListeners.get(key)!.add(cb); lc++
      return () => { keyListeners.get(key)?.delete(cb); lc-- }
    },
  } as KeyedAtom<T>
}

// ---- async derived atoms ----

/**
 * The value type of a {@link deriveAsync} atom: the current loading/error/value
 * state of an async computation.
 *
 * @group Types
 */
export interface AsyncResult<T> {
  loading: boolean
  error: Error | null
  value: T | null
}

/**
 * Derive a read-only atom from an async function. The result atom holds an
 * {@link AsyncResult} that updates as the promise settles. Sources are
 * subscribed lazily (on first `.sub()`). Stale in-flight requests are
 * discarded when sources change.
 *
 * @example
 * ```ts
 * const userId = atom('u1')
 * const profile = deriveAsync([userId], async (id) => fetchUser(id))
 *
 * profile.get() // { loading: true, error: null, value: null }
 *
 * profile.sub(() => {
 *   const { loading, error, value } = profile.get()
 *   if (!loading && !error) render(value)
 * })
 * ```
 *
 * @group Atoms
 */
export const deriveAsync = <R, const A extends ReadableAtom<any>[]>(
  sources: A,
  fn: (...args: { [K in keyof A]: InferRead<A[K]> }) => Promise<R>,
): ReadableAtom<AsyncResult<R>> => {
  const inner = atom<AsyncResult<R>>({ loading: true, error: null, value: null }, () => false)
  let version = 0
  let srcUnsubs: (() => void)[] = []

  const run = () => {
    const v = ++version
    inner.set({ ...inner.get(), loading: true, error: null })
    const args = sources.map((s) => s.get()) as any
    fn(...args).then(
      (value) => { if (v === version) inner.set({ loading: false, error: null, value }) },
      (err) => {
        if (v === version)
          inner.set({ loading: false, error: err instanceof Error ? err : new Error(String(err)), value: null })
      },
    )
  }

  const origSub = inner.sub.bind(inner)
  inner.sub = (callback: () => void) => {
    if (inner.lc === 0) {
      srcUnsubs = sources.map((s) => s.sub(run))
      run()
    }
    const unsub = origSub(callback)
    return () => {
      unsub()
      if (inner.lc === 0) {
        srcUnsubs.forEach((u) => u())
        srcUnsubs = []
        version++ // discard any in-flight resolution
      }
    }
  }

  return inner
}

// ---- batching ----

/**
 * A scheduler defers a flush callback and returns a cancel function. Pass a
 * custom scheduler to {@link batch} to control notification timing.
 *
 * @group Batching
 */
export type Scheduler = (cb: () => void) => () => void

const _microtaskScheduler: Scheduler = (cb) => {
  let done = false
  Promise.resolve().then(() => {
    if (!done) cb()
  })
  return () => {
    done = true
  }
}

const applyBatch = <A extends Reactive>(r: A, scheduler: Scheduler): A => {
  const origSub = r.sub as any as (callback: () => void) => () => void
  ;(r as any).sub = (callback: () => void) => {
    let cancel: (() => void) | null = null
    const unsub = origSub(() => {
      cancel ??= scheduler(() => {
        cancel = null
        callback()
      })
    })
    return () => {
      cancel?.()
      unsub()
    }
  }
  return r
}

/**
 * Wrap a reactive atom so that subscriber notifications are deferred through
 * `scheduler`. Multiple rapid `set` calls coalesce into a single notification.
 * Mutates and returns `r`. Defaults to microtask scheduling.
 *
 * `batch.timeout(ms, r)` is a convenience shorthand for timeout-based scheduling.
 *
 * @example
 * ```ts
 * const a = atom(0)
 * batch(a)
 * a.sub(() => console.log(a.get()))
 * a.set(1)
 * a.set(2)
 * // callback fires once (value: 2) after the current microtask
 * ```
 *
 * @group Batching
 */
export const batch: Batch = Object.assign(
  (r: Reactive, scheduler: Scheduler = _microtaskScheduler): Reactive => applyBatch(r, scheduler),
  {
    timeout: (ms: number, r: Reactive): Reactive =>
      applyBatch(r, (cb) => {
        const id = setTimeout(cb, ms)
        return () => clearTimeout(id)
      }),
  },
)

export interface Batch {
  /**
   * Wrap a reactive atom so that subscriber notifications are deferred through
   * `scheduler`. Multiple rapid `set` calls coalesce into a single notification.
   * Mutates and returns `r`. Defaults to microtask scheduling.
   *
   * `batch.timeout(ms, r)` is a convenience shorthand for timeout-based scheduling.
   *
   * @example
   * ```ts
   * const a = atom(0)
   * batch(a)
   * a.sub(() => console.log(a.get()))
   * a.set(1)
   * a.set(2)
   * // callback fires once (value: 2) after the current microtask
   * ```
   *
   * @group Batching
   */
  (r: Reactive, scheduler?: Scheduler): Reactive
  /**
   * Apply timeout-based batching to `r`, flushing after `ms` milliseconds.
   *
   * @example
   * ```ts
   * batch.timeout(16, a) // flush ~once per frame
   * ```
   *
   * @group Batching
   */
  timeout: (ms: number, r: Reactive) => Reactive
}

// ---------------- Util types ----------------

/** Extract the value type `T` from a `Readable<T>`. */
type InferRead<T> = T extends Readable<infer U> ? U : never

/**
 * Connect a writable atom to a storage backend: hydrate from `storage[key]` on
 * init, then write the value back on every `set`. Mutates and returns `$atom`.
 *
 * Persistence is always active — it wraps `set` rather than subscribing, so it
 * neither inflates the atom's subscriber count (`lc`) nor depends on anyone
 * observing the atom. Works with both {@link SyncStorage} and
 * {@link AsyncStorage}: sync backends hydrate immediately, async backends
 * hydrate once their `get` promise resolves. Build a backend with `storage()`
 * (or the lower-level constructors) from `@lickle/state/storage`.
 *
 * @example
 * ```ts
 * import { atom, persist } from '@lickle/state/atom'
 * import { storage } from '@lickle/state/storage'
 *
 * const count = persist('count', atom(0), storage('local'))
 * count.set(5) // value persisted
 * // on reload, persist('count', atom(0), storage('local')) hydrates back to 5
 * ```
 *
 * @group Storage
 */
/** Narrow overload: key `K` is constrained to the storage's key union, catching typos at compile time. */
export function persist<K extends string, T>(
  key: K,
  $atom: Atom<T>,
  storage: SyncStorage<Record<K, T>> | AsyncStorage<Record<K, T>>,
): Atom<T>
/** Permissive overload: accepts any `string` key. */
export function persist<T>(
  key: string,
  $atom: Atom<T>,
  storage: SyncStorage<Record<string, T>> | AsyncStorage<Record<string, T>>,
): Atom<T>
export function persist(key: string, $atom: Atom<any>, storage: SyncStorage<any> | AsyncStorage<any>): Atom<any> {
  const origSet = $atom.set

  // Write-through: every set also persists.
  $atom.set = (value) => {
    origSet(value)
    storage.set(key, value) // async backends: fire-and-forget
  }

  // Hydrate via origSet so we don't immediately re-persist what we just read.
  if (storage.kind === 'sync') {
    const v = storage.get(key)
    if (v != null) origSet(v)
  } else {
    const snapshot = $atom.get()
    storage.get(key).then((v) => {
      if (v != null && $atom.get() === snapshot) origSet(v)
    })
  }

  return $atom
}
