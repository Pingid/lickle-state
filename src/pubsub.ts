/** Subscribe to changes */
export const subscribe = <T extends { [K in typeof SUB]: any }>(x: T) => x[SUB]
const SUB = Symbol('subscribe')

/** Batch mutations so that they only trigger listeners once */
export const batch = <T extends { [K in typeof BATCH]: (f: () => R) => void }, R>(x: T, f: () => R) => x[BATCH](f)
const BATCH = Symbol('batch')

/** Suspend listeners from responding to changes */
export const suspend = <T extends { [K in typeof SUSPEND]: (f: () => R) => void }, R>(x: T, f: () => R) => x[SUSPEND](f)
const SUSPEND = Symbol('suspend')

export type SignalBinding<K> = {
  [SUB]: {
    (key: K, cb: () => void): () => void
    (cb: () => void): () => void
  }
  [BATCH]: <R extends any>(f: () => R) => R
  [SUSPEND]: <R extends any>(f: () => R) => R
}

export const pubsub = <K extends keyof any>() => {
  const keyed = new Map<K, Set<() => void>>()
  const global = new Set<() => void>()
  let batched: Set<K> | null = null
  let suspended = false

  const subscribe = (a: K | (() => void), b?: any) => {
    if (typeof a === 'function') {
      global.add(a)
      return () => global.delete(a)
    }
    if (!keyed.has(a)) keyed.set(a, new Set())
    keyed.get(a)!.add(b)
    return () => keyed.get(a)!.delete(b)
  }

  const batch = (f: () => any) => {
    batched = new Set()
    const result = f()
    batched.forEach((key) => keyed.get(key)?.forEach((fn) => fn()))
    global.forEach((fn) => fn())
    batched = null
    return result
  }

  const publish = (key?: K) => {
    if (suspended || (!key && batched)) return
    if (!key) return global.forEach((fn) => fn())
    if (batched) batched.add(key)
    else {
      keyed.get(key)?.forEach((fn) => fn())
      global.forEach((fn) => fn())
    }
  }

  const suspend = (f: Function) => {
    suspended = true
    const result = f()
    suspended = false
    return result
  }

  return {
    bind: () => ({ [SUB]: subscribe, [BATCH]: batch, [SUSPEND]: suspend }),
    publish,
    batch,
    subscribe,
  }
}
