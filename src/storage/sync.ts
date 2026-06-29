import type { TypeMap, SyncStorage, AsyncStorage } from './types.ts'

export interface MemoryStorage<T extends TypeMap = TypeMap> extends SyncStorage<T> {
  store: Map<keyof T, T[keyof T]>
}

export const memory = <T extends TypeMap = TypeMap>(): MemoryStorage<T> => {
  const map = new Map<keyof T, T[keyof T]>()
  return {
    store: map,
    kind: 'sync',
    get: (key) => {
      return map.get(key) as any
    },
    set(key, value) {
      map.set(key, value)
    },
    delete(key) {
      map.delete(key)
    },
  }
}

export const localStorage = <T extends TypeMap = Record<string, string>>(): SyncStorage<T> => {
  if (typeof window === 'undefined' || !('localStorage' in window)) return memory<T>()
  const store = window.localStorage
  return {
    kind: 'sync',
    get(key) {
      return store.getItem(key as string) as any
    },
    set(key, value) {
      store.setItem(key as string, value as string)
    },
    delete(key) {
      store.removeItem(key as string)
    },
  }
}

export const toAsync = <T extends TypeMap = TypeMap>(storage: SyncStorage<T> | AsyncStorage<T>): AsyncStorage<T> => ({
  kind: 'async',
  get(key) {
    return Promise.resolve(storage.get(key))
  },
  set(key, value) {
    return Promise.resolve(storage.set(key, value))
  },
  delete(key) {
    return Promise.resolve(storage.delete(key))
  },
})

const defaultSerializer = (value: any) => JSON.stringify({ value })
const defaultDeserializer = (value: string) => JSON.parse(value).value
export const serialized = <T extends TypeMap = TypeMap>(
  storage: SyncStorage<Record<string, string>>,
  serializer: (value: any) => string = defaultSerializer,
  deserializer: (value: string) => any = defaultDeserializer,
): SyncStorage<T> => ({
  kind: 'sync',
  get(key) {
    const value = storage.get(key as string)
    return value ? deserializer(value) : null
  },
  set(key, value) {
    storage.set(key as string, serializer(value))
  },
  delete(key) {
    storage.delete(key as string)
  },
})
