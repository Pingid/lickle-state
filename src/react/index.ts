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
import { effect, untrack } from '../signal/index.ts'
import type { ReadableAtom } from '../atom/index.ts'

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
 * Subscribe a component to a signal {@link Getter}, re-rendering when any signal
 * the getter reads changes. Dependencies are auto-tracked, so a derived getter
 * like `() => a() + b()` works without listing its sources.
 *
 * @example
 * ```tsx
 * import { signal, memo } from '@lickle/state/signal'
 * import { useSignal } from '@lickle/state/react'
 *
 * const [count, setCount] = signal(0)
 * const doubled = memo(() => count() * 2)
 *
 * function Counter() {
 *   const n = useSignal(doubled)
 *   return <button onClick={() => setCount((x) => x + 1)}>{n}</button>
 * }
 * ```
 *
 * @group Hooks
 */
export const useSignal = <T>(get: () => T): T => {
  const ref = useRef(get)
  ref.current = get
  const value = useRef<T>(undefined as T)

  const subscribe = useCallback(
    (onChange: () => void) =>
      effect(() => {
        value.current = ref.current()
        onChange()
      }),
    [],
  )
  const snapshot = useCallback(() => value.current, [])

  return useSyncExternalStore(subscribe, snapshot, () => untrack(ref.current))
}
