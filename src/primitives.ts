export interface Disposable<R = void> {
  dispose: () => R
}

/**
 * A source that can be read with optional extra arguments.
 *
 * @group Types
 */
export interface Readable<T, A extends any[] = []> {
  get: (...args: A) => T
}

/**
 * A sink that can be written.
 *
 * @group Types
 */
export interface Writable<A extends any[] = [], R = void> {
  set: (...args: A) => R
}

/**
 * A reactive source: tracks subscriber count (`lc`) and allows subscription
 * via `sub`.
 *
 * @group Types
 */
export interface Reactive<A extends any[] = [callback: () => void]> {
  sub: (...args: A) => () => void
}

// ---------------- Keyed ----------------

export interface KeyReadable<T extends TypeMap = TypeMap> extends Readable<T[keyof T], [key: keyof T]> {
  get: <K extends keyof T>(key: K) => T[K]
}

export interface KeyWritable<T extends TypeMap = TypeMap, R = void> extends Writable<
  [key: keyof T, value: T[keyof T]],
  R
> {
  set: <K extends keyof T>(key: K, value: T[K]) => R
}

export interface KeyReactive<T extends TypeMap = TypeMap> extends Reactive<
  [key: keyof T, callback: (value: T[keyof T]) => void]
> {
  sub: <K extends keyof T>(key: K, callback: (value: T[K]) => void) => () => void
}

// ---------------- Helpers ----------------
export type AnyDispose = (() => void) | Disposable | void
export const dispose =
  (...args: AnyDispose[]) =>
  () =>
    args.forEach((a) => (typeof a === 'function' ? a() : a?.dispose?.()))

// ---------------- Base ----------------
/**
 * Maps each storage key to its value type. The default permits any string key.
 *
 * @group Storage
 */

export type TypeMap = Record<string, unknown>

export type NullMap<T extends TypeMap = TypeMap> = { [K in keyof T]: T[K] | null }

export type AsyncNullMap<T extends TypeMap = TypeMap> = { [K in keyof T]: Promise<T[K] | null> }

export type Compute<T> = { [K in keyof T]: T[K] } & {}
