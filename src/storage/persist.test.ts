import { test, expect, describe, vi } from 'vitest'
import { atom } from '../index.ts'
import { persist } from './persist.ts'
import { memory, serialized, toAsync } from './sync.ts'

describe('persist (sync)', () => {
  test('hydrates from a pre-seeded store', () => {
    const store = memory<Record<string, number>>()
    store.set('count', 7)
    const a = persist(atom(0), store, 'count')
    expect(a.get()).toBe(7)
  })

  test('a missing key leaves the atom at its initial value', () => {
    const store = memory<Record<string, number>>()
    const a = persist(atom(3), store, 'count')
    expect(a.get()).toBe(3)
  })

  test('set writes through to storage', () => {
    const store = memory<Record<string, number>>()
    const a = persist(atom(0), store, 'count')
    a.set(5)
    expect(store.get('count')).toBe(5)
  })

  test('set still notifies subscribers', () => {
    const store = memory<Record<string, number>>()
    const a = persist(atom(0), store, 'count')
    const fn = vi.fn()
    a.sub(fn)
    a.set(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('round-trips non-string values through serialized storage', () => {
    const store = serialized<Record<string, { n: number }>>(memory<Record<string, string>>())
    const a = persist(atom({ n: 0 }), store, 'obj')
    a.set({ n: 1 })
    // a fresh atom over the same backing store hydrates the persisted value
    const b = persist(atom({ n: 0 }), store, 'obj')
    expect(b.get()).toEqual({ n: 1 })
  })
})

describe('persist (async)', () => {
  test('hydrates once the get promise resolves and notifies subscribers', async () => {
    const backing = memory<Record<string, number>>()
    backing.set('count', 42)
    const a = persist(atom(0), toAsync(backing), 'count')
    const fn = vi.fn()
    a.sub(fn)
    expect(a.get()).toBe(0) // not hydrated synchronously
    await Promise.resolve()
    expect(a.get()).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
