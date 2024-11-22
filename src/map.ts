import { pubsub, type SignalBinding } from './pubsub.js'

export type ReactiveMap<K extends keyof any, V> = Map<K, V> & SignalBinding<K>

/**
 * Creates a reactive `Map` that emits signals whenever its state changes.
 *
 * The returned `Map` allows subscribers to listen for changes, such as when
 * key-value pairs are added, updated, deleted, or the map is cleared.
 *
 * @example
 * import { reactiveMap, subscribe } from './signal';
 *
 * const myMap = reactiveMap(new Map());
 * const unsubscribe = subscribe(myMap, 'key', () => console.log('Key "key" changed!'));
 *
 * myMap.set('key', 'value'); // Logs: 'Key "key" changed!'
 * unsubscribe();
 */
export const reactiveMap = <K extends keyof any, V>(x: Map<K, V>): ReactiveMap<K, V> => {
  const subs = pubsub()
  const self: ReactiveMap<K, V> = Object.assign(x, {
    ...subs.bind(),
    set: (key: K, value: V) => {
      Map.prototype.set.call(x, key, value)
      subs.publish(key)
      return self
    },
    clear: () => {
      Map.prototype.clear.call(x)
      subs.publish()
    },
    delete: (key: K) => {
      const result = Map.prototype.delete.call(x, key)
      subs.publish(key)
      return result
    },
  })
  return self
}
