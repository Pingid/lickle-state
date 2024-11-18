import { SignalBinding, pubsub } from './pubsub.js'

export type ReactiveRecord<K extends keyof any, V> = Record<K, V> & SignalBinding<K>

/**
 * Creates a reactive `Record` that emits signals whenever its properties change.
 *
 * The returned `Record` allows subscribers to listen for changes to specific keys
 * or to any property globally.
 *
 * @example
 * import { reactiveRecord, subscribe } from '@lickle/state';
 *
 * const myRecord = reactiveRecord({ a: 1, b: 2 });
 * const unsubscribe = subscribe(myRecord, 'a', () => console.log('Key "a" changed!'));
 *
 * myRecord.a = 42; // Logs: 'Key "a" changed!'
 * unsubscribe();
 */
export const reactiveRecord = <K extends keyof any, V>(x: Record<K, V>): ReactiveRecord<K, V> => {
  const subs = pubsub()
  return new Proxy(Object.assign(subs.bind(), x), {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const result = Reflect.set(target, key, value, receiver)
      subs.publish(key as K)
      return result
    },
  })
}
