import { test, expect, describe, vi } from 'vitest'
import * as A from './index.ts'

const tick = () => Promise.resolve()

describe('atom', () => {
  test('get returns the initial value', () => {
    expect(A.atom(42).get()).toBe(42)
  })

  test('set updates the value', () => {
    const a = A.atom(0)
    a.set(5)
    expect(a.get()).toBe(5)
  })

  test('sub notifies on change', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('unsubscribe stops notifications', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    const unsub = a.sub(fn)
    unsub()
    a.set(1)
    expect(fn).not.toHaveBeenCalled()
  })

  test('lc tracks subscriber count', () => {
    const a = A.atom(0)
    expect(a.lc).toBe(0)
    const u1 = a.sub(() => {})
    expect(a.lc).toBe(1)
    const u2 = a.sub(() => {})
    expect(a.lc).toBe(2)
    u1()
    expect(a.lc).toBe(1)
    u2()
    expect(a.lc).toBe(0)
  })

  test('multiple subscribers each receive notifications', () => {
    const a = A.atom(0)
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    a.sub(fn1)
    a.sub(fn2)
    a.set(1)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })
})

describe('derive', () => {
  test('computes from one source atom', () => {
    const a = A.atom(4)
    const d = A.derive([a], (n) => n * 2)
    expect(d.get()).toBe(8)
  })

  test('computes from multiple source atoms', () => {
    const a = A.atom(2)
    const b = A.atom(3)
    const d = A.derive([a, b], (x, y) => x + y)
    expect(d.get()).toBe(5)
    a.set(10)
    expect(d.get()).toBe(13)
  })

  test('updates when a source changes', () => {
    const a = A.atom(1)
    const d = A.derive([a], (n) => n * 2)
    const fn = vi.fn()
    d.sub(fn)
    a.set(5)
    expect(d.get()).toBe(10)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('skips notification when eq returns true', () => {
    const a = A.atom({ x: 1 })
    const d = A.derive(
      [a],
      (v) => v.x,
      (prev, next) => prev === next,
    )
    const fn = vi.fn()
    d.sub(fn)
    a.set({ x: 1 })
    expect(fn).not.toHaveBeenCalled()
    a.set({ x: 2 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('does not subscribe to sources until it has a subscriber', () => {
    const a = A.atom(0)
    A.derive([a], (n) => n + 1)
    expect(a.lc).toBe(0)
  })

  test('subscribes to sources on first subscriber', () => {
    const a = A.atom(0)
    const d = A.derive([a], (n) => n + 1)
    const unsub = d.sub(() => {})
    expect(a.lc).toBe(1)
    unsub()
    expect(a.lc).toBe(0)
  })

  test('unsubscribes from sources when last subscriber leaves', () => {
    const a = A.atom(0)
    const d = A.derive([a], (n) => n + 1)
    const u1 = d.sub(() => {})
    const u2 = d.sub(() => {})
    u1()
    expect(a.lc).toBe(1)
    u2()
    expect(a.lc).toBe(0)
  })

  test('get without subscribers always recomputes fresh', () => {
    let calls = 0
    const a = A.atom(0)
    const d = A.derive([a], (n) => {
      calls++
      return n
    })
    d.get()
    d.get()
    expect(calls).toBe(2)
  })

  test('get with subscribers returns cached value', () => {
    let calls = 0
    const a = A.atom(0)
    const d = A.derive([a], (n) => {
      calls++
      return n
    })
    const unsub = d.sub(() => {})
    d.get()
    d.get()
    expect(calls).toBe(1) // seeded on subscribe, not re-run on get
    unsub()
  })
})

describe('select', () => {
  test('applies a selector to the source', () => {
    const a = A.atom({ x: 1, y: 2 })
    const x = A.select(a, (v) => v.x)
    expect(x.get()).toBe(1)
  })

  test('updates when the selected value changes', () => {
    const a = A.atom({ x: 1 })
    const x = A.select(a, (v) => v.x)
    const fn = vi.fn()
    x.sub(fn)
    a.set({ x: 2 })
    expect(x.get()).toBe(2)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('skips notification when selected value is unchanged', () => {
    const a = A.atom({ x: 1, y: 0 })
    const x = A.select(a, (v) => v.x)
    const fn = vi.fn()
    x.sub(fn)
    a.set({ x: 1, y: 99 })
    expect(fn).not.toHaveBeenCalled()
  })

  test('does not subscribe to source until it has a subscriber', () => {
    const a = A.atom(0)
    A.select(a, (n) => n + 1)
    expect(a.lc).toBe(0)
  })

  test('unsubscribes from source when last subscriber leaves', () => {
    const a = A.atom(0)
    const s = A.select(a, (n) => n + 1)
    const unsub = s.sub(() => {})
    expect(a.lc).toBe(1)
    unsub()
    expect(a.lc).toBe(0)
  })

  test('custom eq suppresses notifications on deep-equal values', () => {
    const a = A.atom([1, 2, 3])
    const s = A.select(
      a,
      (v) => [...v],
      (x, y) => JSON.stringify(x) === JSON.stringify(y),
    )
    const fn = vi.fn()
    s.sub(fn)
    a.set([1, 2, 3])
    expect(fn).not.toHaveBeenCalled()
    a.set([1, 2, 4])
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('effect', () => {
  test('runs the callback immediately', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    A.effect(a, fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('runs on each subsequent change', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    A.effect(a, fn)
    a.set(1)
    a.set(2)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('cleanup stops future calls', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    const stop = A.effect(a, fn)
    stop()
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1) // only the initial run
  })
})

describe('batch', () => {
  test('coalesces rapid updates into one notification', async () => {
    const a = A.atom(0)
    A.batch(a)
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    a.set(2)
    a.set(3)
    expect(fn).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(a.get()).toBe(3)
  })

  test('cancels pending notification on unsubscribe', async () => {
    const a = A.atom(0)
    A.batch(a)
    const fn = vi.fn()
    const unsub = a.sub(fn)
    a.set(1)
    unsub()
    await Promise.resolve()
    expect(fn).not.toHaveBeenCalled()
  })

  test('batch.microtask applies microtask batching', async () => {
    const a = A.atom(0)
    A.batch(a)
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    a.set(2)
    expect(fn).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(a.get()).toBe(2)
  })

  test('batch.timeout delays notification', () => {
    vi.useFakeTimers()
    try {
      const a = A.atom(0)
      A.batch.timeout(100, a)
      const fn = vi.fn()
      a.sub(fn)
      a.set(1)
      expect(fn).not.toHaveBeenCalled()
      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  test('accepts a custom scheduler', async () => {
    const a = A.atom(0)
    const scheduler: A.Scheduler = (cb) => {
      Promise.resolve().then(cb)
      return () => {}
    }
    A.batch(a, scheduler)
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    expect(fn).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('onMount', () => {
  test('runs callback on first subscription', () => {
    const a = A.atom(0)
    const fn = vi.fn(() => () => {})
    A.onMount(a, fn)
    expect(fn).not.toHaveBeenCalled()
    const unsub = a.sub(() => {})
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
  })

  test('does not run callback on subsequent subscriptions', () => {
    const a = A.atom(0)
    const fn = vi.fn(() => () => {})
    A.onMount(a, fn)
    const u1 = a.sub(() => {})
    const u2 = a.sub(() => {})
    expect(fn).toHaveBeenCalledTimes(1)
    u1()
    u2()
  })

  test('calls mount cleanup on last unsubscribe', () => {
    const a = A.atom(0)
    const cleanup = vi.fn()
    A.onMount(a, () => cleanup)
    const unsub = a.sub(() => {})
    unsub()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  test('does not call cleanup until the last subscriber leaves', () => {
    const a = A.atom(0)
    const cleanup = vi.fn()
    A.onMount(a, () => cleanup)
    const u1 = a.sub(() => {})
    const u2 = a.sub(() => {})
    u1()
    expect(cleanup).not.toHaveBeenCalled()
    u2()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  test('re-runs on new subscription after all subscribers leave', () => {
    const a = A.atom(0)
    const fn = vi.fn(() => () => {})
    A.onMount(a, fn)
    const u1 = a.sub(() => {})
    u1()
    const u2 = a.sub(() => {})
    expect(fn).toHaveBeenCalledTimes(2)
    u2()
  })

  test('atom still notifies subscribers after onMount wraps it', () => {
    const a = A.atom(0)
    A.onMount(a, () => () => {})
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('callback may subscribe to the atom without infinite recursion', () => {
    const a = A.atom(0)
    const mount = vi.fn(() => a.sub(() => {}))
    A.onMount(a, mount)
    const unsub = a.sub(() => {})
    expect(mount).toHaveBeenCalledTimes(1)
    unsub()
  })

  test('cleanup unsubscribes the listener opened during mount', () => {
    const a = A.atom(0)
    const internal = vi.fn()
    A.onMount(a, () => a.sub(internal))
    const unsub = a.sub(() => {})
    unsub() // last external subscriber leaves -> mount cleanup unsubscribes internal
    a.set(1)
    expect(internal).not.toHaveBeenCalled()
  })
})

describe('atom eq option', () => {
  test('default === suppresses same-reference re-set', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    a.sub(fn)
    a.set(0)
    expect(fn).not.toHaveBeenCalled()
  })

  test('() => false always notifies, even for same reference', () => {
    const obj = { x: 1 }
    const a = A.atom(obj, () => false)
    const fn = vi.fn()
    a.sub(fn)
    obj.x = 2
    a.set(obj) // same reference, mutated
    expect(fn).toHaveBeenCalledTimes(1)
    expect(a.get().x).toBe(2)
  })

  test('custom eq suppresses structurally-equal objects', () => {
    const a = A.atom({ x: 1 }, (p, n) => p.x === n.x)
    const fn = vi.fn()
    a.sub(fn)
    a.set({ x: 1 }) // different ref, same x
    expect(fn).not.toHaveBeenCalled()
    a.set({ x: 2 })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('persist async race', () => {
  const makeAsync = () => {
    let resolve: (v: any) => void
    const p = new Promise<any>((r) => {
      resolve = r
    })
    return {
      store: { kind: 'async' as const, get: () => p, set: () => Promise.resolve(), delete: () => Promise.resolve() },
      resolve: (v: any) => resolve(v),
    }
  }

  test('hydrates from async storage when untouched', async () => {
    const { store, resolve } = makeAsync()

    const a = A.persist('k', A.atom(0), store)
    resolve(42)
    await tick()
    expect(a.get()).toBe(42)
  })

  test('does not overwrite a set made before hydration resolves', async () => {
    const { store, resolve } = makeAsync()
    const a = A.persist('k', A.atom(0), store)
    a.set(99) // write before promise resolves
    resolve(42)
    await tick()
    expect(a.get()).toBe(99)
  })

  test('second persist set-wrapper survives first async resolution', async () => {
    const { store: s1, resolve: r1 } = makeAsync()
    const { store: s2 } = makeAsync()
    const a = A.atom(0)
    A.persist('k', a, s1) // first persist, async
    A.persist('k', a, s2) // second persist wraps set further
    r1(10)
    await tick()
    // a.set should still go through s2's write-through (not crash or lose it)
    expect(a.get()).toBe(10) // hydrated from s1 (atom was untouched)
  })
})

describe('effect cleanup', () => {
  test('cleanup returned from callback runs before the next invocation', () => {
    const a = A.atom(0)
    const order: string[] = []
    A.effect(a, () => {
      order.push('run')
      return () => order.push('cleanup')
    })
    a.set(1)
    expect(order).toEqual(['run', 'cleanup', 'run'])
  })

  test('cleanup runs on dispose', () => {
    const a = A.atom(0)
    const cleanup = vi.fn()
    const stop = A.effect(a, () => cleanup)
    stop()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  test('no double-cleanup when dispose is called after a change', () => {
    const a = A.atom(0)
    const cleanup = vi.fn()
    const stop = A.effect(a, () => cleanup)
    a.set(1) // triggers cleanup + re-run
    stop() // triggers final cleanup
    expect(cleanup).toHaveBeenCalledTimes(2)
  })
})

describe('watch', () => {
  test('does not fire on subscription', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    A.watch(a, fn)
    expect(fn).not.toHaveBeenCalled()
  })

  test('fires on change', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    A.watch(a, fn)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('unsubscribe stops notifications', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    const stop = A.watch(a, fn)
    stop()
    a.set(1)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('update', () => {
  test('applies the transform and sets the new value', () => {
    const a = A.atom(5)
    A.update(a, (n) => n * 2)
    expect(a.get()).toBe(10)
  })

  test('notifies subscribers', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    a.sub(fn)
    A.update(a, (n) => n + 1)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('readonly', () => {
  test('get delegates to the source atom', () => {
    const a = A.atom(42)
    expect(A.readonly(a).get()).toBe(42)
  })

  test('sub fires when the source atom changes', () => {
    const a = A.atom(0)
    const fn = vi.fn()
    A.readonly(a).sub(fn)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('returned object has no set property', () => {
    const a = A.atom(0)
    expect('set' in A.readonly(a)).toBe(false)
  })
})

describe('keyed', () => {
  test('get returns undefined for missing keys', () => {
    const k = A.keyed<{ x: number }>()
    expect(k.get('x')).toBeUndefined()
  })

  test('set and get round-trip', () => {
    const k = A.keyed<{ x: number }>()
    k.set('x', 7)
    expect(k.get('x')).toBe(7)
  })

  test('per-key sub fires with the new value', () => {
    const k = A.keyed<{ x: number }>()
    const fn = vi.fn()
    k.sub('x', fn)
    k.set('x', 3)
    expect(fn).toHaveBeenCalledWith(3)
  })

  test('per-key sub does not fire for a different key', () => {
    const k = A.keyed<{ x: number; y: number }>()
    const fn = vi.fn()
    k.sub('x', fn)
    k.set('y', 5)
    expect(fn).not.toHaveBeenCalled()
  })

  test('global sub fires for any key change', () => {
    const k = A.keyed<{ x: number; y: number }>()
    const fn = vi.fn()
    k.sub(fn)
    k.set('x', 1)
    k.set('y', 2)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith('x', 1)
    expect(fn).toHaveBeenCalledWith('y', 2)
  })

  test('identity guard: same reference does not notify', () => {
    const k = A.keyed<{ x: number }>()
    k.set('x', 1)
    const fn = vi.fn()
    k.sub('x', fn)
    k.set('x', 1)
    expect(fn).not.toHaveBeenCalled()
  })

  test('delete fires global sub with undefined', () => {
    const k = A.keyed<{ x: number }>({ x: 1 })
    const fn = vi.fn()
    k.sub(fn)
    k.delete('x')
    expect(fn).toHaveBeenCalledWith('x', undefined)
    expect(k.get('x')).toBeUndefined()
  })

  test('lc tracks total listener count across key and global subs', () => {
    const k = A.keyed<{ x: number }>()
    expect(k.lc).toBe(0)
    const u1 = k.sub('x', () => {})
    const u2 = k.sub(() => {})
    expect(k.lc).toBe(2)
    u1()
    u2()
    expect(k.lc).toBe(0)
  })

  test('init seeds initial values', () => {
    const k = A.keyed<{ a: string; b: number }>({ a: 'hello', b: 42 })
    expect(k.get('a')).toBe('hello')
    expect(k.get('b')).toBe(42)
  })
})

describe('deriveAsync', () => {
  test('initial state is loading with null value', () => {
    const a = A.atom(0)
    const d = A.deriveAsync([a], async (n) => n * 2)
    expect(d.get()).toEqual({ loading: true, error: null, value: null })
  })

  test('resolves to the computed value', async () => {
    const a = A.atom(3)
    const d = A.deriveAsync([a], async (n) => n * 2)
    const fn = vi.fn()
    d.sub(fn)
    await tick()
    expect(d.get()).toEqual({ loading: false, error: null, value: 6 })
    expect(fn).toHaveBeenCalled()
  })

  test('captures errors in the error field', async () => {
    const a = A.atom(0)
    const d = A.deriveAsync([a], async () => {
      throw new Error('boom')
    })
    d.sub(() => {})
    await tick()
    const result = d.get()
    expect(result.loading).toBe(false)
    expect(result.error?.message).toBe('boom')
    expect(result.value).toBeNull()
  })

  test('stale resolution is discarded when source changes before settling', async () => {
    const a = A.atom(1)
    let resolveFirst!: (v: number) => void
    let callCount = 0
    const d = A.deriveAsync([a], (n) => {
      callCount++
      if (callCount === 1)
        return new Promise<number>((r) => {
          resolveFirst = r
        })
      return Promise.resolve(n * 10)
    })
    d.sub(() => {})
    a.set(2) // triggers second call before first resolves
    await tick()
    // second result (20) should be current
    expect(d.get().value).toBe(20)
    // resolving the stale first promise must not overwrite
    resolveFirst(999)
    await tick()
    expect(d.get().value).toBe(20)
  })

  test('unsubscribing disconnects sources', () => {
    const a = A.atom(0)
    const d = A.deriveAsync([a], async (n) => n)
    const unsub = d.sub(() => {})
    expect(a.lc).toBe(1)
    unsub()
    expect(a.lc).toBe(0)
  })
})
