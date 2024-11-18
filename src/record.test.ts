import { it, expect, describe, vi, beforeEach } from 'vitest'
import { reactiveRecord, batch, subscribe, suspend } from './index.js'

describe('record', () => {
  const s = reactiveRecord({ one: 1, two: 2 })
  const cb = vi.fn()
  beforeEach(() => ((s.one = 1), (s.two = 2), cb.mockClear()))

  it('should subscribe and unsubscribe to global changes', () => {
    const unsub = subscribe(s)(cb)
    s.one = 3
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.one).toBe(3)
    unsub()
    s.two = 4
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.two).toBe(4)
  })

  it('should subscribe and unsubscribe to keyed changes', () => {
    const unsub = subscribe(s)('one', cb)
    s.one = 3
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.one).toBe(3)
    unsub()
    s.two = 4
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.two).toBe(4)
  })

  it('should batch changes', () => {
    const unsub = subscribe(s)(cb)
    batch(s, () => {
      s.one = 3
      s.two = 4
      expect(cb).toHaveBeenCalledTimes(0)
    })
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('should suspend listeners', () => {
    subscribe(s)(cb)
    suspend(s, () => {
      s.one = 3
      s.two = 4
      expect(cb).toHaveBeenCalledTimes(0)
    })
    expect(cb).toHaveBeenCalledTimes(0)
  })
})
