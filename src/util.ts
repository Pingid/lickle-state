/**
 * Functional utilities: {@link pipe} for left-to-right value threading,
 * {@link flow} for function composition, and {@link dispose} for grouping
 * cleanup callbacks.
 */

import type { Disposable } from './primitives.ts'

/**
 * Pipes a value through a series of functions, left to right.
 *
 * @param x - The initial value
 * @param fns - Functions to apply in sequence
 * @returns The result of applying all functions
 *
 * @example
 * ```ts
 * import { pipe } from '@lickle/state'
 * import { local, prefix, serialized } from '@lickle/state/storage'
 *
 * const store = pipe(local(), prefix('app:'), serialized())
 * ```
 */
export const pipe: {
  <T>(x: T): T
  <T, A>(x: T, op1: Unary<T, A>): A
  <T, A, B>(x: T, op1: Unary<T, A>, op2: Unary<A, B>): B
  <T, A, B, C>(x: T, op1: Unary<T, A>, op2: Unary<A, B>, op3: Unary<B, C>): C
  <T, A, B, C, D>(x: T, op1: Unary<T, A>, op2: Unary<A, B>, op3: Unary<B, C>, op4: Unary<C, D>): D
  <T, A, B, C, D, E>(x: T, op1: Unary<T, A>, op2: Unary<A, B>, op3: Unary<B, C>, op4: Unary<C, D>, op5: Unary<D, E>): E
  <T, A, B, C, D, E, F>(
    x: T,
    op1: Unary<T, A>,
    op2: Unary<A, B>,
    op3: Unary<B, C>,
    op4: Unary<C, D>,
    op5: Unary<D, E>,
    op6: Unary<E, F>,
  ): F
  <T, A, B, C, D, E, F, G>(
    x: T,
    op1: Unary<T, A>,
    op2: Unary<A, B>,
    op3: Unary<B, C>,
    op4: Unary<C, D>,
    op5: Unary<D, E>,
    op6: Unary<E, F>,
    op7: Unary<F, G>,
  ): G
  <T, A, B, C, D, E, F, G, H>(
    x: T,
    op1: Unary<T, A>,
    op2: Unary<A, B>,
    op3: Unary<B, C>,
    op4: Unary<C, D>,
    op5: Unary<D, E>,
    op6: Unary<E, F>,
    op7: Unary<F, G>,
    op8: Unary<G, H>,
  ): H
  <T, A, B, C, D, E, F, G, H, I>(
    x: T,
    op1: Unary<T, A>,
    op2: Unary<A, B>,
    op3: Unary<B, C>,
    op4: Unary<C, D>,
    op5: Unary<D, E>,
    op6: Unary<E, F>,
    op7: Unary<F, G>,
    op8: Unary<G, H>,
    op9: Unary<H, I>,
  ): I
  <T, A, B, C, D, E, F, G, H, I, J>(
    x: T,
    op1: Unary<T, A>,
    op2: Unary<A, B>,
    op3: Unary<B, C>,
    op4: Unary<C, D>,
    op5: Unary<D, E>,
    op6: Unary<E, F>,
    op7: Unary<F, G>,
    op8: Unary<G, H>,
    op9: Unary<H, I>,
    op10: Unary<I, J>,
  ): J
  <T, A, B, C, D, E, F, G, H, I, J, K>(
    x: T,
    op1: Unary<T, A>,
    op2: Unary<A, B>,
    op3: Unary<B, C>,
    op4: Unary<C, D>,
    op5: Unary<D, E>,
    op6: Unary<E, F>,
    op7: Unary<F, G>,
    op8: Unary<G, H>,
    op9: Unary<H, I>,
    op10: Unary<I, J>,
    op11: Unary<J, K>,
  ): K
  <T, A, B, C, D, E, F, G, H, I, J, K, L>(
    x: T,
    op1: Unary<T, A>,
    op2: Unary<A, B>,
    op3: Unary<B, C>,
    op4: Unary<C, D>,
    op5: Unary<D, E>,
    op6: Unary<E, F>,
    op7: Unary<F, G>,
    op8: Unary<G, H>,
    op9: Unary<H, I>,
    op10: Unary<I, J>,
    op11: Unary<J, K>,
    op12: Unary<K, L>,
  ): L
  <T>(x: T, ...ops: Unary<any, any>[]): any
} = (h: any, ...t: any[]) => t.reduce<any>((a, b) => b(a), h)

/**
 * Composes functions left to right, returning a new function.
 *
 * @param fns - Functions to compose
 * @returns A function that applies all functions in sequence
 *
 */
export const flow: {
  <A, B>(op1: Unary<A, B>): (x: A) => B
  <A, B, C>(op1: Unary<A, B>, op2: Unary<B, C>): (x: A) => C
  <A, B, C, D>(op1: Unary<A, B>, op2: Unary<B, C>, op3: Unary<C, D>): (x: A) => D
  <A, B, C, D, E>(op1: Unary<A, B>, op2: Unary<B, C>, op3: Unary<C, D>, op4: Unary<D, E>): (x: A) => E
  <A, B, C, D, E, F>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
  ): (x: A) => F
  <A, B, C, D, E, F, G>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
    op6: Unary<F, G>,
  ): (x: A) => G
  <A, B, C, D, E, F, G, H>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
    op6: Unary<F, G>,
    op7: Unary<G, H>,
  ): (x: A) => H
  <A, B, C, D, E, F, G, H, I>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
    op6: Unary<F, G>,
    op7: Unary<G, H>,
    op8: Unary<H, I>,
  ): (x: A) => I
  <A, B, C, D, E, F, G, H, I, J>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
    op6: Unary<F, G>,
    op7: Unary<G, H>,
    op8: Unary<H, I>,
    op9: Unary<I, J>,
  ): (x: A) => J
  <A, B, C, D, E, F, G, H, I, J, K>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
    op6: Unary<F, G>,
    op7: Unary<G, H>,
    op8: Unary<H, I>,
    op9: Unary<I, J>,
    op10: Unary<J, K>,
  ): (x: A) => K
  <A, B, C, D, E, F, G, H, I, J, K, L>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
    op6: Unary<F, G>,
    op7: Unary<G, H>,
    op8: Unary<H, I>,
    op9: Unary<I, J>,
    op10: Unary<J, K>,
    op11: Unary<K, L>,
  ): (x: A) => L
  <A, B, C, D, E, F, G, H, I, J, K, L, M>(
    op1: Unary<A, B>,
    op2: Unary<B, C>,
    op3: Unary<C, D>,
    op4: Unary<D, E>,
    op5: Unary<E, F>,
    op6: Unary<F, G>,
    op7: Unary<G, H>,
    op8: Unary<H, I>,
    op9: Unary<I, J>,
    op10: Unary<J, K>,
    op11: Unary<K, L>,
    op12: Unary<L, M>,
  ): (x: A) => M
  (...ops: Unary<any, any>[]): (x: any) => any
} =
  (h: any, ...t: any[]) =>
  (x: any) =>
    pipe(h(x), ...(t as [any]))

export type Unary<T, R> = (source: T) => R

// ---------------- Helpers ----------------
export type AnyDispose = (() => void) | Disposable | void

/**
 * Combine multiple cleanup values into one `() => void` disposer. Accepts
 * plain functions, {@link Disposable} objects, or `void` (which is ignored).
 *
 * @example
 * ```ts
 * const stop = dispose(
 *   effect(count, () => {}),
 *   { dispose: () => socket.close() },
 * )
 * stop() // calls all cleanup functions
 * ```
 */
export const dispose =
  (...args: AnyDispose[]) =>
  (): void =>
    args.forEach((a) => (typeof a === 'function' ? a() : a?.dispose?.()))
