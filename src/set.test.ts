import { it, expect, describe, vi, beforeEach } from 'vitest'
import { reactiveSet, batch, subscribe, suspend } from './index.js'

describe('set', () => {
  const s = reactiveSet(new Set<'one' | 'two'>())
  const cb = vi.fn()
  beforeEach(() => (s.clear(), cb.mockClear()))

  it('should subscribe and unsubscribe to global changes', () => {
    const unsub = subscribe(s)(cb)
    s.add('one')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.has('one')).toBe(true)
    unsub()
    s.add('two')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.has('two')).toBe(true)
  })

  it('should subscribe and unsubscribe to keyed changes', () => {
    const unsub = subscribe(s)('one', cb)
    s.add('one')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.has('one')).toBe(true)
    unsub()
    s.add('two')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.has('two')).toBe(true)
  })

  it('should batch changes', () => {
    const unsub = subscribe(s)(cb)
    batch(s, () => {
      s.add('one')
      s.add('two')
      expect(cb).toHaveBeenCalledTimes(0)
    })
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('should suspend listeners', () => {
    subscribe(s)(cb)
    suspend(s, () => {
      s.add('one')
      s.add('two')
      expect(cb).toHaveBeenCalledTimes(0)
    })
    expect(cb).toHaveBeenCalledTimes(0)
  })
})
