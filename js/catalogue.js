/*
 * The catalogue: the terminal in every vestibule.
 *
 * Finding the nearest copy of a text cannot be done by calculation: the shelving is a
 * keyed pseudorandom permutation, so the only way to know what a book contains is to
 * open it. The catalogue therefore reads the books themselves, hexagon by hexagon,
 * outwards from where the reader stands (walking distance: galleries plus floors),
 * on several processor cores at once. The first ring that yields a copy holds a
 * nearest copy. This is quick for short passages and hopeless for long ones, whose
 * nearest copy lies further away than any search could reach; for those the catalogue
 * can still give the address of a copy that certainly exists, by running the shelving
 * backwards.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  /* ------------------------------------------------------------------ *
   * Workers
   * ------------------------------------------------------------------ */

  function workerSource() {
    return `
      const BabelCore = ${BabelCore.source};
      let lib = null, anchor = null, query = null;
      const galleries = new Map(), floors = new Map();
      function cached(map, key, make) {
        let v = map.get(key);
        if (!v) { v = make(); map.set(key, v); if (map.size > 48) map.delete(map.keys().next().value); }
        return v;
      }
      self.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'init') {
          lib = new BabelCore.Library(m.config);
          anchor = m.anchor; query = m.query;
          galleries.clear(); floors.clear();
          self.postMessage({ type: 'ready' });
          return;
        }
        if (m.type === 'scan') {
          const gallery = cached(galleries, m.dg, () => lib.offsetGallery(anchor.gallery, m.dg));
          const floor = cached(floors, m.df, () => lib.offsetFloor(anchor.floor, m.df));
          let books = 0;
          for (let slot = m.from; slot < m.to; slot++) {
            const content = lib.bookAt({ gallery, floor, slot });
            if (!content) continue;
            books++;
            const index = BabelCore.Library.indexOf(content, query);
            if (index >= 0) { self.postMessage({ type: 'found', id: m.id, slot, index, books }); return; }
          }
          self.postMessage({ type: 'done', id: m.id, books });
        }
      };
    `;
  }

  let workerURL = null;
  function makeWorker() {
    if (!workerURL) workerURL = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
    return new Worker(workerURL);
  }

  /** Hexagons at walking distance d from (cg, cf), same floor first. */
  function ring(cg, cf, d) {
    if (d === 0) return [[cg, cf]];
    const out = [];
    for (let j = 0; j <= d; j++) {
      const i = d - j;
      const cells = j === 0 ? [[i, 0], [-i, 0]] : i === 0 ? [[0, j], [0, -j]] : [[i, j], [-i, j], [i, -j], [-i, -j]];
      for (const [a, b] of cells) out.push([cg + a, cf + b]);
    }
    return out;
  }

  /**
   * Reads books outwards from a hexagon until a copy of `query` is found.
   * Callbacks: onProgress({ books, hexagons, ring, rate }), onFound(result), onEnd(reason).
   */
  class NearestSearch {
    constructor(opts) {
      this.o = opts;
      this.lib = opts.lib;
      this.chunk = 32;
      this.books = 0;
      this.hexagonsDone = 0;
      this.best = null;
      this.limitRing = opts.maxRing;
      this.inflight = new Map();
      this.order = 0;
      this.stopped = false;
      this.t0 = performance.now();
      this.startRing = opts.startRing || 0;
      this.booksBefore = opts.booksBefore || 0;
      this.hexagonsBefore = opts.hexagonsBefore || 0;
      this.cursor = { d: this.startRing, list: ring(opts.center[0], opts.center[1], this.startRing), h: 0, slot: 0 };
      this.pending = new Map(); // hexagon key → chunks left
    }

    start() {
      const n = Math.max(1, Math.min(12, (navigator.hardwareConcurrency || 4) - 1));
      this.workers = [];
      try {
        for (let i = 0; i < n; i++) this.workers.push(makeWorker());
      } catch (e) {
        this.workers.forEach((w) => w.terminate());
        this.workers = [];
      }
      if (this.workers.length === 0) return this._startInline();
      this.mode = 'workers';
      const config = Object.assign({}, this.lib.raw, { seed: this.lib.seed });
      for (const w of this.workers) {
        w.onmessage = (e) => this._message(w, e.data);
        w.onerror = () => { this._fallback(); };
        w.postMessage({ type: 'init', config, anchor: this.o.anchor, query: this.o.query });
      }
    }

    /** If workers cannot run (some browsers refuse them for pages opened from disk), read on the main thread. */
    _fallback() {
      if (this.mode !== 'workers') return;
      for (const w of this.workers) w.terminate();
      this.workers = [];
      this.inflight.clear();
      this.cursor = { d: this.startRing, list: ring(this.o.center[0], this.o.center[1], this.startRing), h: 0, slot: 0 };
      this.books = 0; this.hexagonsDone = 0; this.pending.clear();
      this._startInline();
    }

    _startInline() {
      this.mode = 'inline';
      const lib = this.lib, a = this.o.anchor;
      let t = null, gallery = null, floor = null, slot = 0, books = 0;
      const step = () => {
        if (this.stopped) return;
        if (!t) {
          t = this._nextTask();
          if (!t) return this._finishIfDone();
          gallery = lib.offsetGallery(a.gallery, t.dg);
          floor = lib.offsetFloor(a.floor, t.df);
          slot = t.from; books = 0;
        }
        const tEnd = performance.now() + 25;
        let found = null;
        while (slot < t.to && performance.now() < tEnd) {
          const content = lib.bookAt({ gallery, floor, slot });
          slot++;
          if (!content) continue;
          books++;
          const index = BabelCore.Library.indexOf(content, this.o.query);
          if (index >= 0) { found = { slot: slot - 1, index }; break; }
        }
        if (found || slot >= t.to) { const done = t; t = null; this._result(done, books, found); }
        if (!this.stopped) setTimeout(step, 0);
      };
      setTimeout(step, 0);
    }

    stop(reason) {
      if (this.stopped) return;
      this.stopped = true;
      (this.workers || []).forEach((w) => w.terminate());
      this.workers = [];
      if (reason !== 'silent' && this.o.onEnd) this.o.onEnd(reason || 'stopped', this.best);
    }

    _nextTask() {
      if (this.best) return null; // everything still unread is at least as far away
      const c = this.cursor, S = this.lib.S;
      while (true) {
        if (c.d > this.limitRing) return null;
        if (c.h >= c.list.length) {
          c.d++; c.h = 0; c.slot = 0;
          if (c.d > this.limitRing) return null;
          c.list = ring(this.o.center[0], this.o.center[1], c.d);
          continue;
        }
        const [dg, df] = c.list[c.h];
        const from = c.slot, to = Math.min(S, from + this.chunk);
        const key = dg + ',' + df;
        if (from === 0) this.pending.set(key, Math.ceil(S / this.chunk));
        c.slot = to;
        if (c.slot >= S) { c.h++; c.slot = 0; }
        const t = { id: ++this.order, order: this.order, dg, df, from, to, ring: c.d, key };
        this.inflight.set(t.id, t);
        return t;
      }
    }

    _dispatch(w) {
      if (this.stopped) return;
      const t = this._nextTask();
      if (!t) { w.idle = true; return this._finishIfDone(); }
      w.idle = false;
      w.task = t;
      w.postMessage({ type: 'scan', id: t.id, dg: t.dg, df: t.df, from: t.from, to: t.to });
    }

    _message(w, m) {
      if (this.stopped) return;
      if (m.type === 'ready') return this._dispatch(w);
      const t = this.inflight.get(m.id);
      if (!t) return this._dispatch(w);
      this._result(t, m.books, m.type === 'found' ? { slot: m.slot, index: m.index } : null);
      this._dispatch(w);
    }

    _result(t, books, found) {
      this.inflight.delete(t.id);
      this.books += books;
      const left = (this.pending.get(t.key) || 1) - 1;
      if (found) this.pending.delete(t.key);
      else if (left <= 0) { this.pending.delete(t.key); this.hexagonsDone++; }
      else this.pending.set(t.key, left);
      if (found && (!this.best || t.ring < this.best.ring || (t.ring === this.best.ring && t.order < this.best.order))) {
        this.best = { dg: t.dg, df: t.df, slot: found.slot, index: found.index, ring: t.ring, order: t.order };
        this.limitRing = t.ring; // nothing further away can be nearer
      }
      const secs = (performance.now() - this.t0) / 1000;
      if (this.o.onProgress) this.o.onProgress({ books: this.books, hexagons: this.hexagonsDone, ring: this.cursor.d, rate: this.books / Math.max(secs, 0.001), mode: this.mode });
      this._finishIfDone();
    }

    _finishIfDone() {
      if (this.stopped) return;
      const c = this.cursor;
      const exhausted = c.d > this.limitRing || (c.d === this.limitRing && c.h >= c.list.length);
      let busy = false;
      for (const t of this.inflight.values()) if (t.ring <= this.limitRing) { busy = true; break; }
      if ((exhausted || this.best) && !busy) {
        const reason = this.best ? 'found' : 'limit';
        this.stop('silent');
        if (this.o.onEnd) this.o.onEnd(reason, this.best);
      }
    }
  }

  Babel.NearestSearch = NearestSearch;
  Babel.catalogueRing = ring;
})();
