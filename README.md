# Lickle State

A lightweight reactive pub/sub utility for `Map`, `Set`, and plain objects.

[![Build Status](https://img.shields.io/github/actions/workflow/status/Pingid/lickle-state/test.yml?branch=main&style=flat&colorA=000000&colorB=000000)](https://github.com/Pingid/lickle-state/actions?query=workflow:Test)
[![Build Size](https://img.shields.io/bundlephobia/minzip/%40lickle%2Fstate?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=%40lickle%2Fstate)
[![Version](https://img.shields.io/npm/v/%40lickle%2Fstate?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/%40lickle%2Fstate)

## Installation

```bash
npm install @lickle/state
# or
yarn add @lickle/state
# or
pnpm add @lickle/state
```

---

## Usage

### Reactive Objects

Wrap any object, `Map`, or `Set` to make them reactive:

```ts
import { reactiveRecord, reactiveMap, reactiveSet, subscribe } from '@lickle/state'

// Reactive object
const state = reactiveRecord({ count: 0 })
subscribe(state, 'count', () => console.log(`Count: ${state.count}`))
state.count += 1 // Logs: Count: 1

// Reactive map
const map = reactiveMap(new Map())
subscribe(map, 'key', () => console.log('Key changed!'))
map.set('key', 'value') // Logs: Key changed!

// Reactive set
const set = reactiveSet(new Set())
subscribe(set, () => console.log('Set updated!'))
set.add('item') // Logs: Set updated!
```

---

### Batch Updates

Group multiple updates to trigger a single notification:

```ts
import { batch } from '@lickle/state'

batch(state, () => {
  state.count += 1
  state.count += 1
}) // Logs: Count: 2 (once)
```

---

### Suspend Listeners

Pause notifications while making updates:

```ts
import { suspend } from '@lickle/state'

suspend(state, () => {
  state.count += 1
}) // No logs
```

---

## License

MIT © [Dan Beaven](https://github.com/Pingid)
