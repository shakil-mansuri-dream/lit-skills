// Counts Lit renders per element and records which properties triggered each one.
// Works with lit-element 2, Lit 2 and Lit 3, and with several Lit copies on one page.
//
// Paste into the DevTools console (or inject with page.evaluate / addInitScript), then:
//   litProbe.reset()     before the action
//   ...do the action...
//   litProbe.report()    renders per tag, and the properties that caused them
//   litProbe.stop()      restore the original methods
(() => {
  if (window.litProbe) { window.litProbe.reset(); return; }

  const counts = new Map();   // tag -> { renders, instances:Set, props:Map }
  const patched = [];

  function* deepElements(root) {
    for (const el of root.querySelectorAll('*')) {
      yield el;
      if (el.shadowRoot) yield* deepElements(el.shadowRoot);
    }
  }

  // The deepest prototype that owns update() is ReactiveElement / UpdatingElement.
  // Every subclass reaches it through super.update(), so one patch per Lit copy sees every render.
  function baseUpdateOwner(el) {
    let owner = null;
    for (let p = Object.getPrototypeOf(el); p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) {
      if (Object.prototype.hasOwnProperty.call(p, 'update') && 'requestUpdate' in p) owner = p;
    }
    return owner;
  }

  function patch(proto) {
    if (patched.some(x => x.proto === proto)) return;
    const original = proto.update;
    proto.update = function (changed) {
      const tag = this.localName;
      let c = counts.get(tag);
      if (!c) counts.set(tag, c = { renders: 0, instances: new Set(), props: new Map() });
      c.renders++;
      c.instances.add(this);
      if (changed) for (const key of changed.keys()) c.props.set(String(key), (c.props.get(String(key)) || 0) + 1);
      return original.call(this, changed);
    };
    patched.push({ proto, original });
  }

  for (const el of deepElements(document)) {
    if (typeof el.requestUpdate === 'function' && 'updateComplete' in el) {
      const owner = baseUpdateOwner(el);
      if (owner) patch(owner);
    }
  }

  window.litProbe = {
    copies: patched.length,
    reset() { counts.clear(); },
    report() {
      const rows = [...counts.entries()]
        .map(([tag, c]) => ({
          tag,
          renders: c.renders,
          instances: c.instances.size,
          changed: [...c.props.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}×${n}`).join(' '),
        }))
        .sort((a, b) => b.renders - a.renders);
      console.table(rows);
      return rows;
    },
    stop() {
      for (const { proto, original } of patched) proto.update = original;
      patched.length = 0;
      delete window.litProbe;
    },
  };
  console.log(`litProbe: watching ${patched.length} Lit cop${patched.length === 1 ? 'y' : 'ies'}. litProbe.reset(), act, litProbe.report().`);
})();
