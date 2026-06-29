import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Reactive, Readable, ReadableAtom } from './index.ts'

export const useStore = <A, B = A>(
  atom: ReadableAtom<A>,
  selector: (value: A) => B = DEFAULT_SELECTOR,
  eq: (a: B, b: B) => boolean = DEFAULT_EQ,
): B => {
  const value = useRef<any>()

  const t = useMemo(() => {
    let initial = true
    const onChange = (cb: () => void) => () => {
      const next = selector(atom.get())
      if (eq(value.current, next)) return
      value.current = next
      cb()
    }
    const sub = (cb: () => void) => atom.sub(onChange(cb))
    const get = () => {
      if (initial) value.current = selector(atom.get())
      initial = false
      return value.current
    }
    return { sub, get }
  }, [atom, selector])

  return useSyncExternalStore(t.sub, t.get, t.get)
}

const DEFAULT_EQ = (a: any, b: any) => a === b
const DEFAULT_SELECTOR = (value: any) => value

export const useReadable = <A extends any[], R>(
  atom: Readable<R, A> & Reactive<[...A, callback: () => void]>,
  ...args: A
): R => {
  const get = useCallback(() => atom.get(...args), [atom, ...args])
  const sub = useCallback((callback: () => void) => atom.sub(...args, callback), [atom, ...args])
  return useSyncExternalStore(sub, get, get)
}
