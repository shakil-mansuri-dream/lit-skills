# lit-skills

Two Claude Code skills for apps built with [Lit](https://lit.dev), with or without Redux.

Recent Claude models already know Lit well. These skills don't repeat the docs. They cover the
places where agents still go wrong in real codebases:

- **Writing for the wrong Lit.** Large apps often still run `lit-element` 2, where `willUpdate`
  is never called. An agent that skips `package.json` writes dead code there.
- **Guessing instead of measuring.** "Every card re-renders" is the usual first guess. In practice
  `stateChanged` often runs on every element while only one or two of them render.
- **Getting reselect's memo wrong.** The cache rules changed between 4.x, 5.0–5.2 and 5.3.

| Skill | Use it when |
|---|---|
| `lit-doctor` | Writing or fixing a Lit component, a component won't update or updates too often, `[object Object]` shows up in a template, or a Lit app is slow |
| `lit-redux-doctor` | Components use `connect` / `stateChanged` / reselect, data goes stale after a property change, or a click is slow |

## The probes

Both skills ship a small console script. Each one works on lit-element 2, Lit 2 and Lit 3, and on
pages that load several Lit copies at once.

Example output after selecting one card on a 40-card board:

```js
// lit-doctor/scripts/lit-render-probe.js
litProbe.reset();  /* click */  litProbe.report();
// ┌ tag        renders  instances  changed
// │ card-view  1        1          _selected×1

// lit-redux-doctor/scripts/state-changed-probe.js
scProbe.reset();   /* click */  scProbe.report();
// ┌ tag        calls  instances  totalMs  maxMs
// │ card-view  40     40         38.2     1.4
```

That pair of numbers (40 `stateChanged` calls, 1 render) tells you to make `stateChanged`
cheaper, not to chase renders.

## Install

As a Claude Code plugin:

```
/plugin marketplace add shakil-mansuri-dream/lit-skills
/plugin install lit-skills@lit-skills
```

Or copy the folders by hand:

```bash
git clone https://github.com/shakil-mansuri-dream/lit-skills
cp -r lit-skills/skills/* ~/.claude/skills/
```

## How they were made

Every row in these skills came from a real bug in a production Lit + Redux app, over several
months of agent sessions. Before shipping, each skill was tested against models without it, and
only the gaps those tests showed were kept. The version facts were checked against the published
source of `lit-element` 2.5.1, `pwa-helpers` 0.9.1 and `reselect` 4.1, 5.1, 5.2 and 5.3.

MIT licensed.
