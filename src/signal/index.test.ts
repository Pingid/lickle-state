import { test, expect, describe, vi } from 'vitest'
import { signal, effect, memo, batch, untrack } from './index.js'
import { createScope } from './scope.ts'

const tick = () => Promise.resolve()

describe('signal', () => {
  test('get returns the initial value', () => {
    const n = signal(42)
    expect(n.get()).toBe(42)
  })

  test('set updates the value', () => {
    const n = signal(0)
    n.set(5)
    expect(n.get()).toBe(5)
  })

  test('functional set receives the previous value', () => {
    const n = signal(1)
    n.set((x) => x + 1)
    expect(n.get()).toBe(2)
  })

  test('set to an equal value does not notify', () => {
    const n = signal(0)
    const fn = vi.fn(() => {
      n.get()
    })
    effect(fn)
    n.set(0)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('effect', () => {
  test('runs immediately and on each tracked change', () => {
    const n = signal(0)
    const fn = vi.fn(() => {
      n.get()
    })
    effect(fn)
    n.set(1)
    n.set(2)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('only subscribes to signals it actually reads', () => {
    const a = signal(0)
    const b = signal(0)
    const fn = vi.fn(() => {
      a.get()
    })
    effect(fn)
    b.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('disposer runs the latest cleanup and stops reruns', () => {
    const n = signal(0)
    const cleanup = vi.fn()
    const fn = vi.fn(() => {
      n.get()
      return cleanup
    })
    const stop = effect(fn)
    n.set(1)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenCalledTimes(1) // cleanup before the rerun
    stop()
    expect(cleanup).toHaveBeenCalledTimes(2) // disposer runs the final cleanup
    n.set(2)
    expect(fn).toHaveBeenCalledTimes(2) // no rerun after dispose
  })
})

describe('untrack', () => {
  test('reads without subscribing the surrounding effect', () => {
    const n = signal(0)
    const fn = vi.fn(() => {
      untrack(n.get)
    })
    effect(fn)
    n.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('returns the value from fn', () => {
    const n = signal(7)
    expect(untrack(() => n.get() + 1)).toBe(8)
  })
})

describe('batch', () => {
  test('coalesces multiple writes into a single rerun', () => {
    const a = signal(0)
    const b = signal(0)
    const fn = vi.fn(() => {
      a.get()
      b.get()
    })
    effect(fn)
    batch(() => {
      a.set(1)
      b.set(1)
    })
    expect(fn).toHaveBeenCalledTimes(2) // initial + one batched rerun
    expect([a.get(), b.get()]).toEqual([1, 1])
  })

  test('dedups diamond dependencies to a single rerun', () => {
    const a = signal(1)
    const left = memo(() => a.get() + 1)
    const right = memo(() => a.get() + 2)
    const fn = vi.fn(() => {
      left.get()
      right.get()
    })
    effect(fn)
    batch(() => a.set(2))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('nested batches flush once at the outermost close', () => {
    const n = signal(0)
    const fn = vi.fn(() => {
      n.get()
    })
    effect(fn)
    batch(() => {
      n.set(1)
      batch(() => n.set(2))
      expect(fn).toHaveBeenCalledTimes(1) // still deferred
    })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(n.get()).toBe(2)
  })

  test('returns the value from fn', () => {
    expect(batch(() => 99)).toBe(99)
  })
})

describe('memo', () => {
  test('derives and caches a value', () => {
    const a = signal(2)
    const b = signal(3)
    const sum = memo(() => a.get() + b.get())
    expect(sum.get()).toBe(5)
    a.set(10)
    expect(sum.get()).toBe(13)
    b.set(0)
    expect(sum.get()).toBe(10)
  })

  test('does not compute until first read', () => {
    const compute = vi.fn(() => 1)
    memo(compute)
    expect(compute).not.toHaveBeenCalled()
  })

  test('recomputes on every untracked read while unobserved', () => {
    const a = signal(0)
    const compute = vi.fn(() => a.get())
    const m = memo(compute)
    m.get()
    m.get()
    expect(compute).toHaveBeenCalledTimes(2)
  })

  test('shares one computation across observers and skips equal values', () => {
    const a = signal(1)
    const compute = vi.fn(() => a.get() * 2)
    const m = memo(compute)
    const fn = vi.fn(() => {
      m.get()
    })
    effect(fn)
    effect(fn)
    expect(compute).toHaveBeenCalledTimes(1) // single shared computation
    a.set(1) // unchanged
    expect(fn).toHaveBeenCalledTimes(2) // the two initial runs, no reruns
  })

  test('disposes its computation after the last observer leaves', async () => {
    const a = signal(0)
    const compute = vi.fn(() => a.get())
    const m = memo(compute)
    const stop = effect(() => {
      m.get()
    })
    stop()
    await tick() // disposal is deferred to a microtask
    const calls = compute.mock.calls.length
    a.set(1) // memo no longer observing its source
    expect(compute).toHaveBeenCalledTimes(calls)
  })

  test('an effect rerun does not thrash the memo computation', () => {
    const a = signal(0)
    const compute = vi.fn(() => a.get())
    const m = memo(compute)
    effect(() => {
      m.get()
    })
    const before = compute.mock.calls.length
    a.set(1)
    // one recompute for the change, not a teardown/rebuild cascade
    expect(compute).toHaveBeenCalledTimes(before + 1)
  })
})

describe('scope', () => {
  test('independent scopes do not cross-notify', () => {
    const a = createScope()
    const b = createScope()
    const sigA = a.signal(0)
    const sigB = b.signal(0)
    const fn = vi.fn(() => {
      sigA.get()
    })
    a.effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    sigB.set(1) // write in scope b
    expect(fn).toHaveBeenCalledTimes(1) // effect in a is untouched
    sigA.set(1)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test("a batch on one scope does not defer another's notifications", () => {
    const a = createScope()
    const b = createScope()
    const sigB = b.signal(0)
    const fn = vi.fn(() => {
      sigB.get()
    })
    b.effect(fn)
    a.batch(() => {
      sigB.set(1) // not governed by a's batch
    })
    expect(fn).toHaveBeenCalledTimes(2) // ran immediately
  })
})
