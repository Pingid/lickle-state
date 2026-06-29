import type { Atom } from '../reactive/index.ts'
import type { SyncStorage, AsyncStorage } from './types.ts'

/**
 * Connect a writable atom to a storage backend: hydrate from `storage[key]` on
 * init, then write the value back on every `set`. Mutates and returns `$atom`.
 *
 * Persistence is always active — it wraps `set` rather than subscribing, so it
 * neither inflates the atom's subscriber count (`lc`) nor depends on anyone
 * observing the atom. Works with both {@link SyncStorage} and
 * {@link AsyncStorage}: sync backends hydrate immediately, async backends
 * hydrate once their `get` promise resolves.
 *
 * @example
 * ```ts
 * import { atom } from '@lickle/state'
 * import { persist, serialized, localStorage } from '@lickle/state/storage'
 *
 * const count = persist(atom(0), serialized(localStorage()), 'count')
 * count.set(5) // value persisted
 * // on reload, persist(atom(0), ...) hydrates back to 5
 * ```
 *
 * @group Storage
 */
export const persist = <T>(
  $atom: Atom<T>,
  storage: SyncStorage<Record<string, T>> | AsyncStorage<Record<string, T>>,
  key: string,
): Atom<T> => {
  const origSet = $atom.set

  // Write-through: every set also persists.
  $atom.set = (value) => {
    origSet(value)
    storage.set(key, value) // async backends: fire-and-forget
  }

  // Hydrate via origSet so we don't immediately re-persist what we just read.
  if (storage.kind === 'sync') {
    const v = storage.get(key)
    if (v != null) origSet(v)
  } else {
    storage.get(key).then((v) => {
      if (v != null) origSet(v)
    })
  }

  return $atom
}
