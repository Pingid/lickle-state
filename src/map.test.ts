import { it, expect, describe, vi, beforeEach } from 'vitest'
import { reactiveMap, batch, subscribe, suspend } from './index.js'

describe('map', () => {
  const s = reactiveMap(new Map<'one' | 'two', number>())
  const cb = vi.fn()
  beforeEach(() => (s.clear(), cb.mockClear()))

  it('should subscribe and unsubscribe to global changes', () => {
    const unsub = subscribe(s)(cb)
    s.set('one', 1)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.get('one')).toBe(1)
    unsub()
    s.set('two', 2)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.get('two')).toBe(2)
  })

  it('should subscribe and unsubscribe to keyed changes', () => {
    const unsub = subscribe(s)('one', cb)
    s.set('one', 1)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.get('one')).toBe(1)
    unsub()
    s.set('two', 2)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.get('two')).toBe(2)
  })

  it('should batch changes', () => {
    const unsub = subscribe(s)(cb)
    batch(s, () => {
      s.set('one', 1)
      s.set('two', 2)
      expect(cb).toHaveBeenCalledTimes(0)
    })
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('should suspend listeners', () => {
    subscribe(s)(cb)
    suspend(s, () => {
      s.set('one', 1)
      s.set('two', 2)
      expect(cb).toHaveBeenCalledTimes(0)
    })
    expect(cb).toHaveBeenCalledTimes(0)
  })
})
