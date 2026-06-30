/**
 * Signal primitives: auto-tracked effects, memoised derivations, and a
 * batched-flush queue. All logic is parameterised over a {@link Runtime} so
 * multiple isolated {@link Scope | scopes} can coexist without sharing state.
 */

import type { Readable, Writable } from '../primitives.ts'

/**
 * Read-side of a {@link Signal}; calling `get` inside an {@link Scope.effect}
 * or {@link Scope.memo} subscribes the caller to changes.
 *
 * @group Types
 */
export interface ReadableSignal<T> extends Readable<T> {}

/**
 * Write-side of a {@link Signal}. Accepts a value or an updater function.
 *
 * @group Types
 */
export interface WritableSignal<T> extends Writable<[next: T | ((prev: T) => T)]> {
  set: (next: T | ((prev: T) => T)) => void
}

/**
 * A readable + writable reactive value produced by {@link Scope.signal}.
 *
 * @group Types
 */
export interface Signal<T> extends ReadableSignal<T>, WritableSignal<T> {}

/**
 * An isolated reactive scope: a bound set of signal utilities that share one
 * dependency graph. Independent scopes never cross-notify. The library's
 * top-level `signal`/`effect`/`memo`/`batch`/`untrack` are the methods of one
 * root scope created at import time.
 *
 * @group Types
 */
export interface Scope {
  /** Create a reactive value on this scope. */
  signal: {
    /** Create a reactive value with no initial value, inferring `T | undefined`. */
    <T>(): Signal<T | undefined>
    /** Create a reactive value seeded with `initial`. */
    <T>(initial: T): Signal<T>
  }
  /**
   * Run `fn` now, then again whenever a signal it read changes. Returns a
   * disposer that runs the latest cleanup and detaches the effect.
   */
  effect: (fn: () => (() => any) | void) => () => void
  /** Read signals without subscribing the surrounding effect / memo. */
  untrack: <T>(fn: () => T) => T
  /** Group writes so subscribers run once, de-duplicated, after `fn` returns. */
  batch: <T>(fn: () => T) => T
  /** Derive a cached value from other signals. Lazy and ref-counted. */
  memo: <T>(fn: () => T) => ReadableSignal<T>
}

/**
 * Create an isolated reactive scope: its own dependency graph and batch queue.
 *
 */
export const createScope = (): Scope => {
  const ctx: Runtime = { o: null, depth: 0, flushing: false, queued: new Set() }
  return {
    signal: <T>(initial?: T) => signal(ctx, initial as T),
    effect: (fn) => effect(ctx, fn),
    untrack: (fn) => untrack(ctx, fn),
    batch: (fn) => batch(ctx, fn),
    memo: (fn) => memo(ctx, fn),
  }
}

// ---- internals: scope-first primitives shared by every scope ----

/** Reactive computation node (an effect's run function). */
type Node = { (): void; o: Set<Set<Node>>; d: () => void }

/** Mutable per-scope state: the current observer and the batch queue. */
interface Runtime {
  o: Node | null
  depth: number
  flushing: boolean
  queued: Set<Node>
}

const noop = () => void 0

/** Notify observers now, or enqueue them while a batch is open/flushing. */
const notify = (ctx: Runtime, subs: Set<Node>) => {
  if (ctx.depth || ctx.flushing) for (const f of subs) ctx.queued.add(f)
  else for (const f of [...subs]) f()
}

/** Drain queued observers, re-queuing any triggered mid-flush so each runs once. */
const flush = (ctx: Runtime) => {
  ctx.flushing = true
  try {
    while (ctx.queued.size) {
      const q = [...ctx.queued]
      ctx.queued.clear()
      for (const f of q) f()
    }
  } finally {
    ctx.flushing = false
  }
}

/** Create a reactive value on `ctx` with no initial value (`T | undefined`). */
function signal<T>(ctx: Runtime): Signal<T | undefined>
/** Create a reactive value on `ctx` seeded with `initial`. */
function signal<T>(ctx: Runtime, initial: T): Signal<T>
function signal<T>(ctx: Runtime, initial?: T): Signal<T | undefined> {
  const subs = new Set<Node>()
  let value = initial

  return {
    get: () => {
      if (ctx.o) (subs.add(ctx.o), ctx.o.o.add(subs))
      return value
    },
    set: (next) => {
      const x = typeof next === 'function' ? (next as (prev: T | undefined) => T | undefined)(value) : next
      if (x === value) return
      value = x
      notify(ctx, subs)
    },
  }
}

function effect(ctx: Runtime, fn: () => (() => any) | void): () => void {
  const run = (() => {
    run.d()
    for (const s of run.o) s.delete(run)
    run.o.clear()
    const prev = ctx.o
    ctx.o = run
    /* prettier-ignore */
    try { const d = fn(); run.d = typeof d === 'function' ? d : noop } finally { ctx.o = prev }
  }) as Node
  run.o = new Set()
  run.d = noop
  run()
  return () => {
    run.d()
    for (const s of run.o) s.delete(run)
    run.o.clear()
    run.d = noop
  }
}

function untrack<T>(ctx: Runtime, fn: () => T): T {
  const prev = ctx.o
  ctx.o = null
  /* prettier-ignore */
  try { return fn() } finally { ctx.o = prev }
}

function batch<T>(ctx: Runtime, fn: () => T): T {
  ctx.depth++
  try {
    return fn()
  } finally {
    if (--ctx.depth === 0) flush(ctx)
  }
}

function memo<T>(ctx: Runtime, fn: () => T): ReadableSignal<T> {
  const subs = new Set<Node>()
  let value!: T
  let dispose: (() => void) | null = null

  // Auto-track cleanup deletes observers straight from `subs`; intercept it to
  // ref-count. Disposal is deferred to a microtask so a consumer that detaches
  // and re-reads within the same tick (an effect rerun) doesn't thrash.
  const del = subs.delete.bind(subs)
  const stop = () => {
    if (subs.size || !dispose) return
    dispose()
    dispose = null
  }
  subs.delete = (o) => {
    const removed = del(o)
    if (subs.size === 0 && dispose) queueMicrotask(stop)
    return removed
  }

  return {
    get: () => {
      if (!ctx.o) return dispose ? value : untrack(ctx, fn)
      if (!dispose)
        dispose = effect(ctx, () => {
          const next = fn()
          if (dispose && next === value) return
          value = next
          notify(ctx, subs)
        })
      subs.add(ctx.o)
      ctx.o.o.add(subs)
      return value
    },
  }
}
