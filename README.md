# @lickle/state

A tiny, type-safe reactive state library. State lives in atoms; derived values and effects compose from them.

[![Build Status](https://img.shields.io/github/actions/workflow/status/Pingid/lickle-state/test.yml?branch=main&style=flat&colorA=000000&colorB=000000)](https://github.com/Pingid/lickle-state/actions?query=workflow:Test)
[![Build Size](https://img.shields.io/bundlephobia/minzip/@lickle/state?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=@lickle/state)
[![Version](https://img.shields.io/npm/v/@lickle/state?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@lickle/state)
[![Downloads](https://img.shields.io/npm/dt/@lickle/state.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@lickle/state)

## Install

```bash
npm install @lickle/state
```

---

## Quick Start

```ts
import { atom, derive, effect } from '@lickle/state/atom'

const count = atom(0)
const doubled = derive([count], (n) => n * 2)

const stop = effect(count, () => console.log('count:', count.get()))
// logs "count: 0" immediately
count.set(1) // logs "count: 1"
stop()
```

---

## Core Concept

A **reactive atom** holds a value, lets you read it with `get`, write it with `set`, and subscribe to changes with `sub`. All other primitives compose from this interface.

```ts
type ReadableAtom<T> = {
  get: () => T
  sub: (callback: () => void) => () => void // returns unsub
}

type Atom<T> = ReadableAtom<T> & {
  lc: number  // current subscriber count
  set: (value: T) => void
}
```

---

## Atoms

```ts
import { atom } from '@lickle/state/atom'

const count = atom(0)   // writable atom
count.get()             // 0
count.set(1)            // update — notifies all subscribers synchronously

const unsub = count.sub(() => console.log(count.get()))
count.set(2)  // logs 2
unsub()
```

Pass a custom equality function to control when subscribers are notified. The default is `===`; pass `() => false` to always notify (useful for mutable objects):

```ts
const pos = atom({ x: 0, y: 0 }, (a, b) => a.x === b.x && a.y === b.y)
pos.set({ x: 0, y: 0 }) // suppressed — same coordinates
pos.set({ x: 1, y: 0 }) // fires
```

**`update`** applies a transform in a single call:

```ts
update(count, (n) => n + 1)
```

**`readonly`** hides `set`, useful for exposing internal atoms to consumers:

```ts
const _count = atom(0)
export const count = readonly(_count) // no .set on the public surface
```

---

## Derived State

**`derive`** computes a value from one or more source atoms. It subscribes lazily (only while it has its own subscribers) and skips notifications when the computed value is unchanged.

```ts
import { atom, derive, select } from '@lickle/state/atom'

const a = atom(2)
const b = atom(3)
const sum = derive([a, b], (x, y) => x + y)
sum.get() // 5
a.set(10)
sum.get() // 13
```

**`select`** is the single-source shorthand with an optional equality check:

```ts
const user = atom({ name: 'Alice', age: 30 })
const name = select(user, (u) => u.name)
name.get() // 'Alice'

// Only notify when the array contents change:
const ids = select(store, (s) => s.ids, (a, b) => a.join() === b.join())
```

---

## Async Derived State

**`deriveAsync`** wraps an async function, exposing its state as a `{ loading, error, value }` atom. Sources are subscribed lazily; stale in-flight requests are discarded when sources change.

```ts
import { atom, deriveAsync } from '@lickle/state/atom'

const userId = atom('u1')
const profile = deriveAsync([userId], async (id) => fetchUser(id))

profile.get() // { loading: true, error: null, value: null }

profile.sub(() => {
  const { loading, error, value } = profile.get()
  if (!loading && !error) render(value)
})

userId.set('u2') // cancels the previous fetch, starts a new one
```

---

## Effects

**`effect`** subscribes to a reactive source, running the callback immediately and again on every change. The callback may return a cleanup function that runs before each re-fire and on final dispose:

```ts
import { atom, effect } from '@lickle/state/atom'

const count = atom(0)
const stop = effect(count, () => {
  const id = setInterval(() => count.set(count.get() + 1), 100)
  return () => clearInterval(id)
})
stop()
```

**`watch`** is like `effect` but skips the initial run — useful when you only care about future changes:

```ts
const stop = watch(count, () => console.log('changed:', count.get()))
count.set(1) // logs "changed: 1"
stop()
```

**`onMount`** runs a setup function the first time a reactive gains a subscriber, calling its returned cleanup when the last subscriber leaves:

```ts
const clock = atom(Date.now())

onMount(clock, () => {
  const id = setInterval(() => clock.set(Date.now()), 1000)
  return () => clearInterval(id)
})
// interval only runs while clock has subscribers
```

When composing with `batch`, apply `batch` first: `onMount(batch(atom), callback)`.

---

## Keyed Atoms

**`keyed`** is a reactive key/value store with per-key and global subscriptions.

```ts
import { keyed } from '@lickle/state/atom'

type Session = { userId: string; theme: 'light' | 'dark' }
const session = keyed<Session>()

// Per-key subscription — typed to that key's value:
const stopTheme = session.sub('theme', (v) => console.log('theme:', v))

// Global subscription — fires on any change:
const stopAll = session.sub((key, value) => console.log(key, '→', value))

session.set('theme', 'dark') // fires both
session.delete('userId')     // fires global with undefined
stopTheme(); stopAll()
```

---

## Batching

**`batch`** wraps an atom so that rapid `set` calls coalesce into a single subscriber notification. It mutates and returns the atom.

```ts
import { atom, batch } from '@lickle/state/atom'

const a = atom(0)
batch(a) // default: microtask scheduling

a.sub(() => console.log(a.get()))
a.set(1)
a.set(2)
a.set(3)
// callback fires once (value: 3) after the current microtask
```

```ts
batch.timeout(100, a) // flush after 100 ms

// custom Scheduler: (flush: () => void) => cancelFn
batch(a, (cb) => {
  const id = requestAnimationFrame(cb)
  return () => cancelAnimationFrame(id)
})
```

---

## Persistence

**`persist`** connects a writable atom to a storage backend: it hydrates the atom from storage on init, then writes every `set` back. Works with both sync and async backends.

```ts
import { atom, persist } from '@lickle/state/atom'
import { storage } from '@lickle/state/storage'

const count = persist('count', atom(0), storage('local'))
count.set(5) // persisted to localStorage
// on next page load, persist(...) hydrates back to 5
```

---

## Storage

```ts
import { storage, memory, prefix, serialized, indexedDB } from '@lickle/state/storage'
```

**`storage`** builds a backend by name or passes an existing one through:

```ts
storage('local')     // localStorage, JSON-serialized
storage('session')   // sessionStorage, JSON-serialized
storage('indexedDB') // IndexedDB (returns AsyncStorage)
storage(memory())    // pass-through
```

**`memory`** is an in-memory store backed by a `Map` — useful in tests and as a fallback:

```ts
const store = memory<{ count: number }>()
store.set('count', 1)
store.get('count') // 1
```

**`prefix`** namespaces keys. Call it curried to compose, or data-first to apply immediately:

```ts
const ns = prefix(memory(), 'app:')
ns.set('count', '1') // stored as 'app:count'

// curried, for use with pipe:
const withPrefix = prefix<Record<string, string>>('app:')
```

**`serialized`** adapts a string-only store (e.g. `localStorage`) to hold structured values:

```ts
const store = serialized<{ count: number }>(memory())
store.set('count', 42)
store.get('count') // 42

// curried:
const withSerialization = serialized<{ count: number }>()
```

**`indexedDB`** stores values in IndexedDB, returning an `AsyncStorage`:

```ts
const db = indexedDB<string, number>('mydb', 'keyval')
await db.set('score', 100)
await db.get('score')    // 100
await db.keys()          // ['score']
await db.clear()
```

Backends compose:

```ts
const store = serialized(prefix(memory(), 'app:'))
persist('count', atom(0), store)
```

---

## React

```tsx
import { useStore, useSignal } from '@lickle/state/react'
```

**`useStore`** subscribes a component to a `ReadableAtom`, with an optional selector and equality function to limit re-renders:

```tsx
import { atom } from '@lickle/state/atom'
import { useStore } from '@lickle/state/react'

const count = atom(0)

function Counter() {
  const n = useStore(count)
  return <button onClick={() => count.set(n + 1)}>{n}</button>
}

// Selector — re-renders only when the name changes:
const user = atom({ name: 'Alice', age: 30 })
function Name() {
  const name = useStore(user, (u) => u.name)
  return <span>{name}</span>
}
```

**`useSignal`** subscribes to an auto-tracked signal getter, re-rendering whenever any signal it reads changes:

```tsx
import { signal, memo } from '@lickle/state/signal'
import { useSignal } from '@lickle/state/react'

const [count, setCount] = signal(0)
const doubled = memo(() => count() * 2)

function Counter() {
  const n = useSignal(doubled)
  return <button onClick={() => setCount((x) => x + 1)}>{n}</button>
}
```

---

## Signals

The `@lickle/state/signal` sub-path exports auto-tracked reactive signals — a push-pull model where reading a value inside an `effect` or `memo` automatically subscribes it.

```ts
import { signal, effect, memo, batch, untrack } from '@lickle/state/signal'

const [count, setCount] = signal(0)
const doubled = memo(() => count() * 2)

const stop = effect(() => console.log('doubled:', doubled()))
setCount(1) // logs "doubled: 2"
stop()
```

For isolated dependency graphs, use `createScope`:

```ts
import { createScope } from '@lickle/state/signal'
const { signal, effect } = createScope()
```

---

## License

MIT © [Dan Beaven](https://github.com/Pingid)
