import 'fake-indexeddb/auto'
import { test, expect, describe } from 'vitest'
import { indexedDB, memory, prefix, serialized } from './index.js'

describe('memory storage', () => {
  test('keys returns all stored keys', () => {
    const s = memory<{ a: number; b: number }>()
    s.set('a', 1)
    s.set('b', 2)
    expect([...s.keys].sort()).toEqual(['a', 'b'])
  })

  test('entries returns all key/value pairs', () => {
    const s = memory<{ a: number; b: number }>()
    s.set('a', 1)
    s.set('b', 2)
    expect([...s.entries].sort()).toEqual([['a', 1], ['b', 2]])
  })

  test('keys and entries are empty on a fresh store', () => {
    const s = memory()
    expect([...s.keys]).toEqual([])
    expect([...s.entries]).toEqual([])
  })
})

describe('prefix storage', () => {
  test('keys strips the prefix', () => {
    const s = memory<Record<string, string>>()
    s.set('app:x', 'a')
    s.set('app:y', 'b')
    s.set('other:z', 'c')
    const ns = prefix(s, 'app:')
    expect([...ns.keys].sort()).toEqual(['x', 'y'])
  })

  test('entries strips the prefix from keys', () => {
    const s = memory<Record<string, string>>()
    s.set('app:x', '1')
    s.set('app:y', '2')
    s.set('other:z', '3')
    const ns = prefix(s, 'app:')
    expect([...ns.entries].sort()).toEqual([['x', '1'], ['y', '2']])
  })

  test('keys/entries only return prefixed entries', () => {
    const s = memory<Record<string, string>>()
    s.set('a:key', 'v')
    const ns = prefix(s, 'b:')
    expect([...ns.keys]).toEqual([])
    expect([...ns.entries]).toEqual([])
  })
})

describe('serialized storage', () => {
  test('entries deserializes values', () => {
    const s = serialized<{ count: number }>(memory())
    s.set('count', 42)
    expect([...s.entries]).toEqual([['count', 42]])
  })

  test('keys delegates to the inner store', () => {
    const s = serialized(memory())
    s.set('a', 'hello')
    s.set('b', 'world')
    expect([...s.keys].sort()).toEqual(['a', 'b'])
  })
})

describe('indexedDB storage', () => {
  const fresh = (name: string) => indexedDB<string, number>(name, 'keyval')

  test('get/set/delete round-trip', async () => {
    const store = fresh('rt')
    expect(await store.get('a')).toBe(null)
    await store.set('a', 1)
    expect(await store.get('a')).toBe(1)
    await store.delete('a')
    expect(await store.get('a')).toBe(null)
  })

  test('keys and entries enumerate the store', async () => {
    const store = fresh('enum')
    await store.set('a', 1)
    await store.set('b', 2)
    expect((await store.keys()).sort()).toEqual(['a', 'b'])
    expect((await store.entries()).sort()).toEqual([
      ['a', 1],
      ['b', 2],
    ])
  })

  test('clear removes every entry', async () => {
    const store = fresh('clear')
    await store.set('a', 1)
    await store.set('b', 2)
    await store.clear()
    expect(await store.keys()).toEqual([])
    expect(await store.get('a')).toBe(null)
  })

  test('recreate empties the store and keeps working', async () => {
    const store = fresh('recreate')
    await store.set('a', 1)
    await store.recreate()
    expect(await store.keys()).toEqual([])
    // store is usable again afterwards
    await store.set('b', 2)
    expect(await store.get('b')).toBe(2)
  })

  test('destroy deletes the database, then a later op reopens it fresh', async () => {
    const store = fresh('destroy')
    await store.set('a', 1)
    await store.destroy()
    const names = (await globalThis.indexedDB.databases()).map((d) => d.name)
    expect(names).not.toContain('destroy')
    // reopens automatically on next use
    expect(await store.get('a')).toBe(null)
    await store.set('b', 2)
    expect(await store.get('b')).toBe(2)
  })
})
