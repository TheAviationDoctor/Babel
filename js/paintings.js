/*
 * The paintings of the passages. Each hexagon's painting is a picture the Library works
 * out from the hexagon's place (see "Paintings" in js/library.js), drawn here in the
 * palette's colours. A painting takes a few milliseconds to work out and a few megabytes to
 * draw, so only the passages beside the reader's hexagon show theirs, made a step at a
 * time over a few frames. The others show the palette's average colour, which is how a
 * painting of nearly random pixels looks from a little way off.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  const KEEP = 7; // paintings kept at once, made or being made

  class Paintings {
    /** assets: from Babel.Architecture.createAssets, with a painting material and its texture filtering. */
    constructor(lib, assets) {
      this.lib = lib;
      this.layout = lib.painting;
      this.makeMaterial = assets.paintingMaterial;
      this.anisotropy = assets.anisotropy || 1;
      this.entries = new Map(); // key → { hexagon, floor, job, material, texture, used }
      this.queue = []; // keys of the paintings still to make, nearest first
      this.clock = 0;
      // the palette as one 32-bit word per colour (red, green, blue, opaque, in memory order)
      const pal = lib.paintingPalette(), N = lib.N, bytes = new Uint8Array(N * 4);
      const mean = [0, 0, 0];
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 3; k++) { bytes[i * 4 + k] = pal[i * 3 + k]; mean[k] += pal[i * 3 + k] / N; }
        bytes[i * 4 + 3] = 255;
      }
      this.words = new Uint32Array(bytes.buffer);
      // seen from afar: the average colour, as the smallest level of a painting's mipmaps has it
      const far = new THREE.DataTexture(new Uint8Array([Math.round(mean[0]), Math.round(mean[1]), Math.round(mean[2]), 255]), 1, 1);
      far.needsUpdate = true;
      this.blank = this.makeMaterial(far);
    }

    /** The key of a hexagon's painting: the World's keys of its hexagon and floor numbers. */
    key(g, f) { return g.key.join(',') + '/' + f.key.join(','); }

    /**
     * The paintings wanted now, nearest first: [{ key, hexagon, floor }]. Those not made yet
     * are queued; the least recently used of the others are let go.
     */
    want(list) {
      const wanted = new Set(list.map((w) => w.key));
      for (const w of list) {
        if (!this.entries.has(w.key)) this.entries.set(w.key, { hexagon: w.hexagon, floor: w.floor, job: null, material: null, texture: null, used: 0 });
        this.entries.get(w.key).used = ++this.clock;
      }
      this.queue = list.filter((w) => !this.entries.get(w.key).material).map((w) => w.key);
      if (this.entries.size > KEEP) {
        const old = [...this.entries].filter(([k]) => !wanted.has(k)).sort((a, b) => a[1].used - b[1].used);
        for (const [k, e] of old.slice(0, this.entries.size - KEEP)) {
          if (e.texture) e.texture.dispose();
          if (e.material) e.material.dispose();
          this.entries.delete(k);
        }
      }
    }

    /** The material showing a painting, or the far one while it is being made. */
    material(key) {
      const e = this.entries.get(key);
      return e && e.material ? e.material : this.blank;
    }

    /** Works on the queued paintings for about `budget` milliseconds. Returns true if one was finished. */
    step(budget) {
      const t0 = performance.now();
      let finished = false;
      while (this.queue.length && performance.now() - t0 < budget) {
        const key = this.queue[0], e = this.entries.get(key);
        if (!e || e.material) { this.queue.shift(); continue; }
        if (!e.job) e.job = this.lib.paintingSteps(e.hexagon, e.floor);
        const r = e.job.next(); // one round of the permutation at a time
        if (!r.done) continue;
        this._draw(e, r.value);
        this.queue.shift();
        finished = true;
      }
      return finished;
    }

    /** Turns a painting's colour numbers into a texture, and a material that shows it. */
    _draw(e, pixels) {
      const { width, height } = this.layout, n = width * height;
      const data = new Uint8Array(n * 4), out = new Uint32Array(data.buffer), words = this.words;
      for (let i = 0; i < n; i++) out[i] = words[pixels[i]];
      const t = new THREE.DataTexture(data, width, height);
      // each pixel sharp up close; from further off, averaged rather than glittering
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = this.anisotropy;
      t.needsUpdate = true;
      e.texture = t;
      e.material = this.makeMaterial(t);
      e.job = null;
    }
  }

  Babel.Paintings = Paintings;
})();
