/**
 * Shared primitive interfaces and utility types used across the atom, signal,
 * and storage layers.
 */

/**
 * Any object with a `dispose` method that can be called to release resources.
 *
 * @group Types
 */
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

/**
 * A keyed readable: `get(key)` returns the value at that key, narrowed to the
 * key's exact type.
 *
 * @group Types
 */
export interface KeyReadable<T extends TypeMap = TypeMap> extends Readable<T[keyof T], [key: keyof T]> {
  get: <K extends keyof T>(key: K) => T[K]
}

/**
 * A keyed writable: `set(key, value)` constrains both to the same key's type.
 *
 * @group Types
 */
export interface KeyWritable<T extends TypeMap = TypeMap, R = void> extends Writable<
  [key: keyof T, value: T[keyof T]],
  R
> {
  set: <K extends keyof T>(key: K, value: T[K]) => R
}

/**
 * A keyed reactive source: `sub(key, callback)` subscribes to a single key,
 * with the callback typed to that key's value.
 *
 * @group Types
 */
export interface KeyReactive<T extends TypeMap = TypeMap> extends Reactive<
  [key: keyof T, callback: (value: T[keyof T]) => void]
> {
  sub: <K extends keyof T>(key: K, callback: (value: T[K]) => void) => () => void
}

// ---------------- Base ----------------
/**
 * Maps each storage key to its value type. The default permits any string key.
 *
 * @group Storage
 */

export type TypeMap = Record<string, unknown>

/** Maps each key of `T` to `T[K] | null`; used by storage `get` return types. */
export type NullMap<T extends TypeMap = TypeMap> = { [K in keyof T]: T[K] | null }

/** Maps each key of `T` to `Promise<T[K] | null>`; used by async storage `get` return types. */
export type AsyncNullMap<T extends TypeMap = TypeMap> = { [K in keyof T]: Promise<T[K] | null> }

/** Forces TypeScript to eagerly resolve an intersection type, producing a plain object type. */
export type Compute<T> = { [K in keyof T]: T[K] } & {}
