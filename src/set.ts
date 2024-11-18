import { SignalBinding, pubsub } from './pubsub.js'

export type ReactiveSet<K extends keyof any> = Set<K> & SignalBinding<K>

/**
 * Creates a reactive `Set` that emits signals whenever its state changes.
 *
 * The returned `Set` allows subscribers to listen for changes, such as when items are
 * added, removed, or the set is cleared.
 *
 * @example
 * import { reactiveSet, subscribe } from '@lickle/state';
 *
 * const mySet = reactiveSet(new Set());
 * const unsubscribe = subscribe(mySet, () => console.log('Set changed!'));
 *
 * mySet.add('item'); // Logs: 'Set changed!'
 * unsubscribe();
 */
export const reactiveSet = <K extends keyof any>(x: Set<K>): ReactiveSet<K> => {
  const subs = pubsub()
  return Object.assign(x, {
    ...subs.bind(),
    add: (key: K) => {
      Set.prototype.add.call(x, key)
      subs.publish(key)
      return self
    },
    clear: () => {
      Set.prototype.clear.call(x)
      subs.publish()
    },
    delete: (key: K) => {
      const result = Set.prototype.delete.call(x, key)
      subs.publish(key)
      return result
    },
  })
}
