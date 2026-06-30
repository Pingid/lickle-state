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

export type Unary<T, R> = (source: T) => R
