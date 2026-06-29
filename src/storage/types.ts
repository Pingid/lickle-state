export type TypeMap = Record<string, unknown>

export interface SyncStorage<T extends TypeMap = TypeMap> {
  kind: 'sync'
  get: <K extends keyof T>(key: K) => T[K] | null
  set: <K extends keyof T>(key: K, value: T[K]) => void
  delete: (key: keyof T) => void
}

export interface AsyncStorage<T extends TypeMap = TypeMap> {
  kind: 'async'
  get: <K extends keyof T>(key: K) => Promise<T[K] | null>
  set: <K extends keyof T>(key: K, value: T[K]) => Promise<void>
  delete: <K extends keyof T>(key: K) => Promise<void>
}
