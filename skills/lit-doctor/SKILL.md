---
name: lit-doctor
description: Use when editing, reviewing or debugging code that imports lit, lit-element or lit-html - even a small change to one component, a property that is not rendering, a value derived before render, `[object Object]` in a template, shadow DOM lookups in tests, or a slow or janky screen in a web-components app.
---

# Lit doctor

Two habits prevent most Lit bugs: know which Lit the code runs on before writing lifecycle code,
and count renders before fixing a performance problem.

## 1. Find the Lit version first

Do this before touching any component, even when the task looks simple. Large apps often run
`lit-element` 2 while the docs and your memory describe Lit 3.

```bash
grep -E '"(lit|lit-element|lit-html|@lit/reactive-element)"' package.json
npm ls lit lit-element lit-html 2>/dev/null   # more than one major = several copies loaded
```

Also open the base class the component extends: a shared base can pin an older Lit than
`package.json` suggests.

| Need | lit-element 2 + lit-html 1 | Lit 2 / Lit 3 |
|---|---|---|
| Derive state before render | override `update(changed)`, set fields, then `super.update(changed)` | `willUpdate(changed)` |
| `willUpdate` | **never called** - code there is dead | yes |
| Imports | `lit-element`, `lit-html/directives/x.js` | `lit`, `lit/directives/x.js` |
| Await extra async work | override `_getUpdateComplete()` | override `getUpdateComplete()` |
| Reactive controllers | no | `addController()` |

Templates from two lit-html majors cannot be mixed: a template built with one `html` and rendered by
the other prints `[object Object]`. Every `html`/`css` in a render tree must come from the same copy.

## 2. Why a component does not update

| Symptom | Cause | Fix |
|---|---|---|
| Push/splice/assign into a property, nothing renders | same reference, `hasChanged` sees no change | assign a new array/object, or `requestUpdate('prop', old)` |
| Value computed in `updated()` goes stale | layout or CSS changed, no reactive property did | `ResizeObserver` (disconnect it in `disconnectedCallback`) |
| A class set by hand stays on the wrong node | Lit reuses nodes that have no binding | bind the class in the template (`classMap`) instead of setting it |
| Base-class behaviour stops | override without `super.updated()` / `super.connectedCallback()` | call `super`; mind the order when the base acts on the DOM |
| Element removed and re-added shows nothing | state torn down in `disconnectedCallback`, not rebuilt | rebuild it in `connectedCallback` |
| Value set in `updated()` renders twice | setting a reactive property there queues another update | derive it earlier (row 1 of the version table) |
| Test cannot find an element | `document.querySelector` does not enter shadow roots | Playwright locators pierce open shadow roots; in plain DOM walk `.shadowRoot` |

## 3. Measure renders before fixing performance

Do not guess which components re-render. Load the probe, then act:

```js
// paste scripts/lit-render-probe.js into DevTools, or:
await page.addScriptTag({ path: 'scripts/lit-render-probe.js' });  // after the app has rendered
await page.evaluate(() => litProbe.reset());
// ...perform the slow action...
await page.evaluate(() => litProbe.report());  // [{ tag, renders, instances, changed: 'items×3 open×1' }]
```

It works on lit-element 2, Lit 2 and Lit 3, and counts every Lit copy on the page
(`litProbe.copies`). `changed` names the properties that caused the renders, which points at the
fix. If renders are low but the action is still slow, the time is not in rendering: record a
Performance trace and look at the long tasks.

## Common mistakes

- Writing `willUpdate` in a lit-element 2 codebase because the Lit docs say so.
- Declaring reactive properties as instance class fields (`count = 0;`) - they shadow Lit's
  accessors and changes never render. Set defaults in the constructor.
- Rendering every tab, slide or hidden panel on open. Render only what is visible.
- Statically importing a heavy child that is rarely shown; `import()` it when needed.
