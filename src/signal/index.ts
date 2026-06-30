import { createScope } from './scope.ts'

export type { Scope, ReadableSignal, WritableSignal, Signal } from './scope.ts'
export { createScope } from './scope.ts'

/**
 * The library's global signal utilities, bound to one root {@link Scope}.
 * Reading a getter inside `effect`/`memo` subscribes that computation; writing a
 * different value reruns its subscribers. Create isolated scopes with
 * {@link createScope}.
 *
 * @group Signals
 */
export const { signal, effect, memo, batch, untrack } = createScope()
