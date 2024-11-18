import { SignalBinding, pubsub } from './pubsub.js'

export type ReactiveRecord<T extends Record<any, any>> = T & SignalBinding<keyof T>

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
export const reactiveRecord = <T extends Record<any, any>>(x: T): ReactiveRecord<T> => {
  const subs = pubsub()
  return new Proxy(Object.assign(subs.bind(), x), {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const result = Reflect.set(target, key, value, receiver)
      subs.publish(key as keyof T)
      return result
    },
  })
}
