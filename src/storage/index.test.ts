import 'fake-indexeddb/auto'
import { test, expect, describe } from 'vitest'
import { indexedDB } from './index.js'

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
