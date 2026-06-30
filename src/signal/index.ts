/**
 * @lickle/state/signal
 *
 * Auto-tracked reactive signals. Reading a getter inside {@link effect} or
 * {@link memo} subscribes that computation; writing a different value reruns
 * its subscribers. For isolated dependency graphs, use {@link createScope}.
 */

import { createScope, type ReadableSignal, type Scope, type Signal } from './scope.ts'

export type { Scope, ReadableSignal, WritableSignal, Signal } from './scope.ts'
export { createScope } from './scope.ts'

/** The root scope; re-exported as the top-level {@link signal}/{@link effect}/{@link memo}/{@link batch}/{@link untrack} functions. */
export const scope: Scope = createScope()

/**
 * Create a reactive value seeded with `initial`.
 *
 * @example
 * ```ts
 * const count = signal(0)
 * count.get() // 0
 * count.set(1)
 * count.set((n) => n + 1) // updater form
 * ```
 */
export function signal<T>(initial: T): Signal<T>
/** Create a reactive value with no initial value, inferring `T | undefined`. */
export function signal<T>(initial?: T): Signal<T | undefined>
export function signal<T>(initial?: T): Signal<T | undefined> {
  return scope.signal(initial)
}

/**
 * Run `fn` now, then again whenever a signal it read changes. Returns a
 * disposer that runs the latest cleanup and detaches the effect.
 *
 * @example
 * ```ts
 * const count = signal(0)
 * const stop = effect(() => console.log('count:', count.get()))
 * // logs "count: 0" immediately
 * count.set(1) // logs "count: 1"
 * stop()
 * ```
 */
export function effect(fn: () => (() => any) | void): () => void {
  return scope.effect(fn)
}

/**
 * Derive a cached value from other signals. Lazy and ref-counted.
 *
 * @example
 * ```ts
 * const count = signal(0)
 * const doubled = memo(() => count.get() * 2)
 * doubled.get() // 0
 * count.set(2)
 * doubled.get() // 4
 * ```
 */
export function memo<T>(fn: () => T): ReadableSignal<T> {
  return scope.memo(fn)
}

/**
 * Group writes so subscribers run once, de-duplicated, after `fn` returns.
 *
 * @example
 * ```ts
 * const a = signal(0)
 * const b = signal('x')
 * effect(() => console.log(a.get(), b.get()))
 * batch(() => { a.set(1); b.set('y') })
 * // logs "1 y" once, not twice
 * ```
 */
export function batch<T>(fn: () => T): T {
  return scope.batch(fn)
}

/**
 * Read signals without subscribing the surrounding effect / memo.
 *
 * @example
 * ```ts
 * const count = signal(0)
 * const other = signal(0)
 * effect(() => {
 *   const n = count.get()                    // tracked
 *   const m = untrack(() => other.get())     // not tracked
 *   console.log(n, m)
 * })
 * other.set(1) // does not re-run the effect
 * ```
 */
export function untrack<T>(fn: () => T): T {
  return scope.untrack(fn)
}
