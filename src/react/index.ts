/**
 * @lickle/state/react
 *
 * React bindings for `@lickle/state`.
 *
 * {@link useStore} subscribes a component to any {@link ReadableAtom}, with an
 * optional selector and equality check to limit re-renders. {@link useReadable}
 * handles parameterised atoms (e.g. reactive maps) whose `get`/`sub` take
 * extra arguments.
 *
 * @example
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

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Reactive, Readable, ReadableAtom } from '../reactive/index.ts'

/**
 * Subscribe a component to a {@link ReadableAtom}, re-rendering only when the
 * selected value changes.
 *
 * `selector` maps the atom's value to the slice the component cares about.
 * `eq` controls when a new selected value is considered different; defaults to
 * strict equality (`===`). Selector and equality function identity is not
 * tracked — they may change each render without causing spurious re-renders.
 *
 * @example
 * ```tsx
 * // full value
 * const n = useStore(count)
 *
 * // with selector — re-renders only when the name field changes
 * const name = useStore(userAtom, (u) => u.name)
 *
 * // with custom equality
 * const ids = useStore(listAtom, (l) => l.map((x) => x.id), shallowEqual)
 * ```
 *
 * @group Hooks
 */
export const useStore = <A, B = A>(
  atom: ReadableAtom<A>,
  selector: (value: A) => B = DEFAULT_SELECTOR,
  eq: (a: B, b: B) => boolean = DEFAULT_EQ,
): B => {
  const value = useRef<{ v: B } | null>(null)
  const fns = useRef({ selector, eq })
  fns.current = { selector, eq }

  const { sub, get } = useMemo(() => {
    const compute = () => fns.current.selector(atom.get())
    const get = () => {
      if (value.current === null) value.current = { v: compute() }
      return value.current.v
    }
    const sub = (cb: () => void) =>
      atom.sub(() => {
        const next = compute()
        if (value.current && fns.current.eq(value.current.v, next)) return
        value.current = { v: next }
        cb()
      })
    return { sub, get }
  }, [atom])

  return useSyncExternalStore(sub, get, get)
}

const DEFAULT_EQ = (a: any, b: any) => a === b
const DEFAULT_SELECTOR = (value: any) => value

/**
 * Subscribe a component to a parameterised reactive source — one whose `get`
 * and `sub` accept extra arguments (e.g. a key into a reactive map).
 *
 * Re-renders whenever the source notifies. The atom reference and each
 * argument are treated as dependencies; changing any of them resubscribes.
 *
 * @example
 * ```tsx
 * // reactive map where get(key) / sub(key, cb) take a key argument
 * const name = useReadable(usersMap, userId)
 * ```
 *
 * @group Hooks
 */
export const useReadable = <A extends any[], R>(
  atom: Readable<R, A> & Reactive<[...A, callback: () => void]>,
  ...args: A
): R => {
  const get = useCallback(() => atom.get(...args), [atom, ...args])
  const sub = useCallback((callback: () => void) => atom.sub(...args, callback), [atom, ...args])
  return useSyncExternalStore(sub, get, get)
}
