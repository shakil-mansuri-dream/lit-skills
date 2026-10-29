// Counts and times stateChanged() per connected element (pwa-helpers connect, or any mixin
// that calls this.stateChanged(state) on store updates).
//
// Paste into the DevTools console after the app has rendered, then:
//   scProbe.reset()     before the action
//   ...do the action...
//   scProbe.report()    calls and milliseconds per tag
//   scProbe.stop()      restore the original methods
// Pair it with lit-doctor's lit-render-probe.js: many calls with few renders means the cost is
// in stateChanged and its selectors, not in rendering.
(() => {
  if (window.scProbe) { window.scProbe.reset(); return; }

  const stats = new Map();   // tag -> { calls, ms, maxMs, instances:Set }
  const patched = [];
  const active = new WeakSet();

  function* deepElements(root) {
    for (const el of root.querySelectorAll('*')) {
      yield el;
      if (el.shadowRoot) yield* deepElements(el.shadowRoot);
    }
  }

  function ownerOf(el) {
    for (let p = Object.getPrototypeOf(el); p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) {
      if (Object.prototype.hasOwnProperty.call(p, 'stateChanged')) return p;
    }
    return null;
  }

  function patch(proto) {
    if (patched.some(x => x.proto === proto)) return;
    const original = proto.stateChanged;
    proto.stateChanged = function (state) {
      // A subclass calling super.stateChanged() is one call, not two.
      if (active.has(this)) return original.call(this, state);
      active.add(this);
      const t0 = performance.now();
      try {
        return original.call(this, state);
      } finally {
        const dt = performance.now() - t0;
        active.delete(this);
        let s = stats.get(this.localName);
        if (!s) stats.set(this.localName, s = { calls: 0, ms: 0, maxMs: 0, instances: new Set() });
        s.calls++; s.ms += dt; s.maxMs = Math.max(s.maxMs, dt); s.instances.add(this);
      }
    };
    patched.push({ proto, original });
  }

  for (const el of deepElements(document)) {
    if (typeof el.stateChanged === 'function') {
      const owner = ownerOf(el);
      if (owner) patch(owner);
    }
  }

  window.scProbe = {
    classes: patched.length,
    reset() { stats.clear(); },
    report() {
      const rows = [...stats.entries()]
        .map(([tag, s]) => ({ tag, calls: s.calls, instances: s.instances.size, totalMs: +s.ms.toFixed(1), maxMs: +s.maxMs.toFixed(1) }))
        .sort((a, b) => b.totalMs - a.totalMs);
      console.table(rows);
      return rows;
    },
    stop() {
      for (const { proto, original } of patched) proto.stateChanged = original;
      patched.length = 0;
      delete window.scProbe;
    },
  };
  console.log(`scProbe: watching stateChanged on ${patched.length} classes. scProbe.reset(), act, scProbe.report().`);
})();
