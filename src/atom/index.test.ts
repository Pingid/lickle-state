import { test, expect, describe, vi } from 'vitest'
import * as S from './index.ts'

describe('atom', () => {
  test('get returns the initial value', () => {
    expect(S.atom(42).get()).toBe(42)
  })

  test('set updates the value', () => {
    const a = S.atom(0)
    a.set(5)
    expect(a.get()).toBe(5)
  })

  test('sub notifies on change', () => {
    const a = S.atom(0)
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('unsubscribe stops notifications', () => {
    const a = S.atom(0)
    const fn = vi.fn()
    const unsub = a.sub(fn)
    unsub()
    a.set(1)
    expect(fn).not.toHaveBeenCalled()
  })

  test('lc tracks subscriber count', () => {
    const a = S.atom(0)
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
    const a = S.atom(0)
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
    const a = S.atom(4)
    const d = S.derive([a], (n) => n * 2)
    expect(d.get()).toBe(8)
  })

  test('computes from multiple source atoms', () => {
    const a = S.atom(2)
    const b = S.atom(3)
    const d = S.derive([a, b], (x, y) => x + y)
    expect(d.get()).toBe(5)
    a.set(10)
    expect(d.get()).toBe(13)
  })

  test('updates when a source changes', () => {
    const a = S.atom(1)
    const d = S.derive([a], (n) => n * 2)
    const fn = vi.fn()
    d.sub(fn)
    a.set(5)
    expect(d.get()).toBe(10)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('skips notification when eq returns true', () => {
    const a = S.atom({ x: 1 })
    const d = S.derive(
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
    const a = S.atom(0)
    S.derive([a], (n) => n + 1)
    expect(a.lc).toBe(0)
  })

  test('subscribes to sources on first subscriber', () => {
    const a = S.atom(0)
    const d = S.derive([a], (n) => n + 1)
    const unsub = d.sub(() => {})
    expect(a.lc).toBe(1)
    unsub()
    expect(a.lc).toBe(0)
  })

  test('unsubscribes from sources when last subscriber leaves', () => {
    const a = S.atom(0)
    const d = S.derive([a], (n) => n + 1)
    const u1 = d.sub(() => {})
    const u2 = d.sub(() => {})
    u1()
    expect(a.lc).toBe(1)
    u2()
    expect(a.lc).toBe(0)
  })

  test('get without subscribers always recomputes fresh', () => {
    let calls = 0
    const a = S.atom(0)
    const d = S.derive([a], (n) => {
      calls++
      return n
    })
    d.get()
    d.get()
    expect(calls).toBe(2)
  })

  test('get with subscribers returns cached value', () => {
    let calls = 0
    const a = S.atom(0)
    const d = S.derive([a], (n) => {
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
    const a = S.atom({ x: 1, y: 2 })
    const x = S.select(a, (v) => v.x)
    expect(x.get()).toBe(1)
  })

  test('updates when the selected value changes', () => {
    const a = S.atom({ x: 1 })
    const x = S.select(a, (v) => v.x)
    const fn = vi.fn()
    x.sub(fn)
    a.set({ x: 2 })
    expect(x.get()).toBe(2)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('skips notification when selected value is unchanged', () => {
    const a = S.atom({ x: 1, y: 0 })
    const x = S.select(a, (v) => v.x)
    const fn = vi.fn()
    x.sub(fn)
    a.set({ x: 1, y: 99 })
    expect(fn).not.toHaveBeenCalled()
  })

  test('does not subscribe to source until it has a subscriber', () => {
    const a = S.atom(0)
    S.select(a, (n) => n + 1)
    expect(a.lc).toBe(0)
  })

  test('unsubscribes from source when last subscriber leaves', () => {
    const a = S.atom(0)
    const s = S.select(a, (n) => n + 1)
    const unsub = s.sub(() => {})
    expect(a.lc).toBe(1)
    unsub()
    expect(a.lc).toBe(0)
  })

  test('custom eq suppresses notifications on deep-equal values', () => {
    const a = S.atom([1, 2, 3])
    const s = S.select(
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
    const a = S.atom(0)
    const fn = vi.fn()
    S.effect(a, fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('runs on each subsequent change', () => {
    const a = S.atom(0)
    const fn = vi.fn()
    S.effect(a, fn)
    a.set(1)
    a.set(2)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('cleanup stops future calls', () => {
    const a = S.atom(0)
    const fn = vi.fn()
    const stop = S.effect(a, fn)
    stop()
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1) // only the initial run
  })
})

describe('batch', () => {
  test('coalesces rapid updates into one notification', async () => {
    const a = S.atom(0)
    S.batch(a)
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
    const a = S.atom(0)
    S.batch(a)
    const fn = vi.fn()
    const unsub = a.sub(fn)
    a.set(1)
    unsub()
    await Promise.resolve()
    expect(fn).not.toHaveBeenCalled()
  })

  test('batch.microtask applies microtask batching', async () => {
    const a = S.atom(0)
    S.batch(a)
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
      const a = S.atom(0)
      S.batch.timeout(100, a)
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
    const a = S.atom(0)
    const scheduler: S.Scheduler = (cb) => {
      Promise.resolve().then(cb)
      return () => {}
    }
    S.batch(a, scheduler)
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
    const a = S.atom(0)
    const fn = vi.fn(() => () => {})
    S.onMount(a, fn)
    expect(fn).not.toHaveBeenCalled()
    const unsub = a.sub(() => {})
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
  })

  test('does not run callback on subsequent subscriptions', () => {
    const a = S.atom(0)
    const fn = vi.fn(() => () => {})
    S.onMount(a, fn)
    const u1 = a.sub(() => {})
    const u2 = a.sub(() => {})
    expect(fn).toHaveBeenCalledTimes(1)
    u1()
    u2()
  })

  test('calls mount cleanup on last unsubscribe', () => {
    const a = S.atom(0)
    const cleanup = vi.fn()
    S.onMount(a, () => cleanup)
    const unsub = a.sub(() => {})
    unsub()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  test('does not call cleanup until the last subscriber leaves', () => {
    const a = S.atom(0)
    const cleanup = vi.fn()
    S.onMount(a, () => cleanup)
    const u1 = a.sub(() => {})
    const u2 = a.sub(() => {})
    u1()
    expect(cleanup).not.toHaveBeenCalled()
    u2()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  test('re-runs on new subscription after all subscribers leave', () => {
    const a = S.atom(0)
    const fn = vi.fn(() => () => {})
    S.onMount(a, fn)
    const u1 = a.sub(() => {})
    u1()
    const u2 = a.sub(() => {})
    expect(fn).toHaveBeenCalledTimes(2)
    u2()
  })

  test('atom still notifies subscribers after onMount wraps it', () => {
    const a = S.atom(0)
    S.onMount(a, () => () => {})
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('callback may subscribe to the atom without infinite recursion', () => {
    const a = S.atom(0)
    const mount = vi.fn(() => a.sub(() => {}))
    S.onMount(a, mount)
    const unsub = a.sub(() => {})
    expect(mount).toHaveBeenCalledTimes(1)
    unsub()
  })

  test('cleanup unsubscribes the listener opened during mount', () => {
    const a = S.atom(0)
    const internal = vi.fn()
    S.onMount(a, () => a.sub(internal))
    const unsub = a.sub(() => {})
    unsub() // last external subscriber leaves -> mount cleanup unsubscribes internal
    a.set(1)
    expect(internal).not.toHaveBeenCalled()
  })
})
