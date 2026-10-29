---
name: lit-redux-doctor
description: Use when Lit or LitElement components read a Redux store (pwa-helpers `connect`, `stateChanged`, reselect `createSelector`) and show stale data after a property change, re-render on unrelated dispatches, feel slow on a click, or when choosing memoize options for reselect.
---

# Lit + Redux doctor

`stateChanged` runs on every connected element for every dispatch. Most bugs are either a value
that only `stateChanged` computes (so it goes stale when a property changes), or selectors whose
memo silently misses (so every dispatch does real work).

Find the Lit version first: lit-element 2 has no `willUpdate`. **REQUIRED:** follow lit-doctor
step 1 when it is installed.

## Stale data after a property change

`connect` calls `stateChanged` in `connectedCallback` and on dispatch - never when a property such
as `cardId` changes. Recompute in the same update, before render:

```js
// Lit 2/3
willUpdate(changed) {
  if (changed.has('cardId')) this.stateChanged(store.getState());
}
// lit-element 2: no willUpdate - do it in update(), before super
update(changed) {
  if (changed.has('cardId')) this.stateChanged(store.getState());
  super.update(changed);
}
```

Do not do it in `updated()`: that renders twice, once with the old value.

## Selector memo: what reselect actually does

Check the version first (`npm ls reselect`). Behaviour changed across 5.x.

| Version | Default memoize | Cache | `memoizeOptions: { maxSize }` |
|---|---|---|---|
| 4.x | `defaultMemoize` | 1 entry: alternating `(state, id)` calls always miss | works (4.1+) |
| 5.0 - 5.2 | `weakMapMemoize` | one entry per argument combination; objects held weakly, primitive ids forever | **ignored silently** |
| 5.3+ | `weakMapMemoize` | same | bounds primitive-argument entries (generational, about 2x maxSize), not an LRU |

So in 5.x one shared `selectCardTitle(state, id)` used by 40 cards does **not** thrash; a
per-instance selector factory is a 4.x fix. `lruMemoize` is the 5.x name of `defaultMemoize`.

Memo breakers to grep for, in every version:

| Pattern | Why it misses | Fix |
|---|---|---|
| `(state) => state` as an input | new state every dispatch | select the slices actually used |
| `x \|\| []`, `x ?? {}` in an input | new empty value every call | module-level `const EMPTY = []` |
| Output `.map`/`.filter` with unchanged content | new array, so `!==` re-renders | `memoizeOptions: { resultEqualityCheck: shallowEqual }` (5.x) |

In a non-production build reselect 5 warns about the second row (`inputStabilityCheck`, on each
selector's first call only). Nothing warns about `(state) => state` as an input: grep for it.

## Slow click: measure, then fix

Do not assume "every component re-renders". Usually `stateChanged` runs everywhere while only one
or two elements render. Measure both:

```js
// scripts/state-changed-probe.js + lit-doctor's scripts/lit-render-probe.js, after the app renders
scProbe.reset(); litProbe.reset();
// ...click...
scProbe.report();   // calls, totalMs per tag: where stateChanged time goes
litProbe.report();  // renders per tag
```

| Result | Fix |
|---|---|
| High stateChanged ms, few renders | make `stateChanged` cheap: early return while closed or hidden (`if (!this.open) return;` and recompute when it opens), or build one map for all instances instead of each instance scanning the collection |
| Many renders | a selector returns a new value each time - see memo breakers |
| Both low | the time is elsewhere: record a Performance trace |

## Common mistakes

- Advising a per-instance selector factory or `maxSize` on reselect 5.0 - 5.2.
- Recomputing in `updated()` or `willUpdate` without checking the Lit version.
- Loading data in `connectedCallback` for views that are not visible (pre-rendered tabs, slides).
- Store slices never cleared or not keyed by the current entity, so old values reach the next one.
