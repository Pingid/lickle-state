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
import { atom, derive, effect } from '@lickle/state'

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
  lc: number // current subscriber count
  get: () => T
  sub: (callback: () => void) => () => void // returns unsub
}

type Atom<T> = ReadableAtom<T> & { set: (value: T) => void }
```

---

## Atoms

```ts
const count = atom(0) // create a writable atom
count.get() // 0
count.set(1) // update — notifies all subscribers synchronously

const unsub = count.sub(() => console.log(count.get()))
count.set(2) // logs 2
unsub()
```

---

## Derived State

**`derive`** computes a value from one or more source atoms. It subscribes lazily (only while it has its own subscribers) and skips notifications when the computed value hasn't changed.

```ts
const a = atom(2)
const b = atom(3)
const sum = derive([a, b], (x, y) => x + y)
sum.get() // 5
a.set(10)
sum.get() // 13
```

**`select`** is the single-atom shorthand — apply a selector function and optionally a custom equality check:

```ts
const user = atom({ name: 'Alice', age: 30 })
const name = select(user, (u) => u.name)
name.get() // 'Alice'

// With custom equality — only notify when the array contents change:
const ids = select(
  store,
  (s) => s.ids,
  (a, b) => a.join() === b.join(),
)
```

Both `derive` and `select` accept an optional `eq` function (defaults to `===`) to suppress redundant notifications.

---

## Effects

**`effect`** subscribes to a reactive source, running the callback immediately and again on every change:

```ts
const count = atom(0)
const stop = effect(count, () => console.log(count.get()))
// logs 0
count.set(1) // logs 1
stop()
count.set(2) // silent
```

**`onMount`** runs a setup function the first time a reactive gains a subscriber, and calls its returned cleanup when the last subscriber leaves. Useful for lazy external connections:

```ts
const clock = atom(Date.now())

onMount(clock, () => {
  const id = setInterval(() => clock.set(Date.now()), 1000)
  return () => clearInterval(id)
})
// the interval only runs while clock has subscribers
```

---

## Batching

**`batch`** wraps an atom so that rapid `set` calls coalesce into a single subscriber notification. It mutates and returns the atom.

```ts
const a = atom(0)
batch(a) // use the default microtask batcher

a.sub(() => console.log(a.get()))
a.set(1)
a.set(2)
a.set(3)
// callback fires once (with value 3) after the current microtask
```

Convenience shorthands and a custom-scheduler escape hatch:

```ts
batch(a) // microtask (default)
batch.microtask(a) // same, explicit
batch.timeout(100, a) // flush after 100 ms

// custom Scheduler: (flush: () => void) => cancelFn
batch(a, (cb) => {
  const id = requestAnimationFrame(cb)
  return () => cancelAnimationFrame(id)
})
```

---

## React

The `@lickle/state/react` sub-path exports two hooks.

**`useStore`** subscribes a component to an atom, with an optional selector and equality function:

```tsx
import { atom } from '@lickle/state'
import { useStore } from '@lickle/state/react'

const count = atom(0)

function Counter() {
  const n = useStore(count)
  return <button onClick={() => count.set(n + 1)}>{n}</button>
}

// With selector — re-renders only when the name changes:
const user = atom({ name: 'Alice', age: 30 })
function Name() {
  const name = useStore(user, (u) => u.name)
  return <span>{name}</span>
}
```

**`useReadable`** is a lower-level hook for custom `Readable` types that take extra arguments:

```tsx
const useReadable = (atom, ...args) => T
```

---

## License

MIT © [Dan Beaven](https://github.com/Pingid)
