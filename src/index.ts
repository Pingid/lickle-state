/**
 * @lickle/state
 *
 * Root barrel — re-exports the atom, signal, and storage namespaces together
 * with the shared primitive types and functional utilities.
 */

export * as storage from './storage/index.ts'
export * as signal from './signal/index.ts'
export * as atom from './atom/index.ts'

export * from './primitives.ts'
export * from './util.ts'
