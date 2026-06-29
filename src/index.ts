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
 * import { atom, derive, effect } from '@lickle/state'
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
 * import { atom } from '@lickle/state'
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

/**
 * A source that can be read with optional extra arguments.
 *
 * @group Types
 */
export type Readable<T, A extends any[] = []> = { get: (...args: A) => T }

/**
 * A sink that can be written.
 *
 * @group Types
 */
export type Writable<A extends any[] = []> = { set: (...args: A) => void }

/**
 * A reactive source: tracks subscriber count (`lc`) and allows subscription
 * via `sub`.
 *
 * @group Types
 */
export type Reactive<A extends any[] = [callback: () => void]> = { lc: number; sub: (...args: A) => () => void }

/**
 * A readable, reactive atom — can be read and subscribed to.
 *
 * @group Types
 */
export type ReadableAtom<T> = Readable<T> & Reactive<[callback: () => void]>

/**
 * A writable atom — can only be written (no read or subscribe).
 *
 * @group Types
 */
export type WritableAtom<T> = Writable<[value: T]>

/**
 * A fully reactive atom: readable, writable, and subscribable.
 *
 * @group Types
 */
export type Atom<T> = ReadableAtom<T> & WritableAtom<T>

// ---- atoms ----

/**
 * Create a writable reactive atom holding `init` as the initial value.
 * Subscribers are notified synchronously on every `set`.
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
export const atom = <T>(init: T): Atom<T> => {
  const listeners = new Set<() => void>()

  const $atom = {
    lc: 0,
    init,
    value: init,
    get: () => $atom.value,
    set: (value: T) => {
      $atom.value = value
      listeners.forEach((l) => l())
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
export const derive = <R, A extends ReadableAtom<any>[]>(
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
    listeners.forEach((l) => l())
  }

  const $derived: ReadableAtom<R> = {
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
): ReadableAtom<B> => {
  const listeners = new Set<() => void>()
  let cached: { value: B } | null = null
  let srcUnsub: (() => void) | null = null

  const notify = () => {
    const next = selector(src.get())
    if (cached && eq(cached.value, next)) return
    cached = { value: next }
    listeners.forEach((l) => l())
  }

  const $select: ReadableAtom<B> = {
    lc: 0,
    get: () => {
      if ($select.lc === 0 || !cached) cached = { value: selector(src.get()) }
      return cached.value
    },
    sub: (callback: () => void) => {
      if ($select.lc === 0) {
        cached = { value: selector(src.get()) }
        srcUnsub = src.sub(notify)
      }
      $select.lc++
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
        $select.lc--
        if ($select.lc === 0) {
          srcUnsub?.()
          srcUnsub = null
          cached = null
        }
      }
    },
  }

  return $select
}

// ---- effects ----

/**
 * Subscribe to a reactive source, running `callback` immediately and again on
 * every subsequent change. Returns an unsubscribe function.
 *
 * @example
 * ```ts
 * const count = atom(0)
 * const stop = effect(count, () => console.log(count.get()))
 * // logs 0 immediately
 * count.set(1) // logs 1
 * stop()
 * count.set(2) // silent
 * ```
 *
 * @group Effects
 */
export const effect = <A extends Reactive>(reactive: A, callback: () => void): (() => void) => {
  callback()
  return reactive.sub(callback)
}

/**
 * Run `callback` the first time the reactive gains a subscriber, calling its
 * return value (cleanup) when the last subscriber leaves. Useful for lazily
 * connecting external resources (timers, WebSockets, etc.).
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
  reactive.sub = (...args: any) => {
    if (reactive.lc === 0) mountCleanup = callback()
    const cleanup = original(...args)
    return () => {
      cleanup()
      if (reactive.lc === 0) {
        mountCleanup?.()
        mountCleanup = null
      }
    }
  }
  return reactive
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
 * `batch.microtask(r)` and `batch.timeout(ms, r)` are convenience shorthands.
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
export const batch = Object.assign(
  <A extends Reactive>(r: A, scheduler: Scheduler = _microtaskScheduler): A => applyBatch(r, scheduler),
  {
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
    timeout: <A extends Reactive>(ms: number, r: A): A =>
      applyBatch(r, (cb) => {
        const id = setTimeout(cb, ms)
        return () => clearTimeout(id)
      }),
    /**
     * Apply microtask-based batching to `r` (the default strategy).
     *
     * @example
     * ```ts
     * batch.microtask(a)
     * ```
     *
     * @group Batching
     */
    microtask: <A extends Reactive>(r: A): A => applyBatch(r, _microtaskScheduler),
  },
)

// ---------------- Util types ----------------

/** Extract the value type `T` from a `Readable<T>`. */
type InferRead<T> = T extends Readable<infer U> ? U : never
