/*
 * The visible Library: the hexagons around the reader, kept in a pool of "cells"
 * and re-dressed (book colours, spine designs) as the reader moves.
 *
 * Positions are relative: the cell the reader stands in is always at the origin,
 * so the Library can be walked for ever without losing numerical precision.
 * Absolute addresses (floor and gallery numbers, each about half a million symbols
 * long) are computed from the waking hexagon plus the reader's offset.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  // Leather colours (linear-ish RGB, multiplied by the spine texture and the lamplight).
  const LEATHER = [
    [0.62, 0.2, 0.15], [0.52, 0.3, 0.17], [0.34, 0.37, 0.24], [0.2, 0.27, 0.23], [0.24, 0.26, 0.38],
    [0.7, 0.52, 0.3], [0.45, 0.16, 0.2], [0.3, 0.21, 0.15], [0.6, 0.57, 0.46], [0.16, 0.14, 0.12],
    [0.55, 0.42, 0.25], [0.4, 0.12, 0.1],
  ];

  class World {
    constructor(scene, assets, library) {
      this.scene = scene;
      this.assets = assets;
      this.d = assets.dims;
      this.lib = library;
      this.cells = new Map(); // key "dg,df" → cell
      this.pool = [];
      this.galleryCache = new Map();
      this.floorCache = new Map();
      this.center = null;
      this.root = new THREE.Group();
      scene.add(this.root);
      this._bookLayout = this._layoutBooks();
      this.hover = null;
      this.view = { nearFloors: 1, nearGalleries: 3, farFloors: 6, farGalleries: 1 };
    }

    /** Sets the waking hexagon (absolute addresses) and clears everything cached. */
    setAnchor(gallery, floor) {
      this.anchor = { gallery, floor };
      this.galleryCache.clear();
      this.floorCache.clear();
      for (const cell of this.cells.values()) this._release(cell);
      this.cells.clear();
      this.center = null;
    }

    /** Replaces the Library (a new seed) — the geometry stays, the books change. */
    setLibrary(library) { this.lib = library; }

    gallery(dg) {
      let e = this.galleryCache.get(dg);
      if (!e) {
        const digits = this.lib.offsetGallery(this.anchor.gallery, dg);
        e = { digits, key: this.lib.galleryKey(digits) };
        this.galleryCache.set(dg, e);
      }
      return e;
    }

    floor(df) {
      let e = this.floorCache.get(df);
      if (!e) {
        const digits = this.lib.offsetFloor(this.anchor.floor, df);
        e = { digits, key: this.lib.floorKey(digits) };
        this.floorCache.set(df, e);
      }
      return e;
    }

    /** Absolute location object of a book in cell (dg, df). */
    location(dg, df, slot) {
      return { gallery: this.gallery(dg).digits, floor: this.floor(df).digits, slot };
    }

    fingerprint(dg, df) {
      return this.lib.fingerprintFromKeys(this.gallery(dg).key, this.floor(df).key);
    }

    /** Canonical position of every slot: matrices before per-book jitter. */
    _layoutBooks() {
      const d = this.d, lib = this.lib;
      const out = [];
      const sides = d.shelvedSides.map((j) => ({ j, m: Babel.Architecture.sideMatrix(j) }));
      const S = lib.S;
      for (let slot = 0; slot < S; slot++) {
        const { wall, shelf, volume } = lib.slotParts(slot);
        const side = sides[wall];
        const i = d.shelves - 1 - shelf; // shelf 0 is the top one; i counts compartments from the floor
        const y = d.base + i * d.pitch + d.board + d.bookH / 2;
        const x = d.rowLen / 2 - (volume + 0.5) * d.bookT;
        const z = d.aIn + 0.03 + d.bookD / 2;
        const local = new THREE.Matrix4().makeTranslation(x, y, z);
        const m = side.m.clone().multiply(local);
        const phi = (side.j * Math.PI) / 3;
        out.push({ m, nx: Math.cos(phi), nz: Math.sin(phi) });
      }
      return out;
    }

    _createCell() {
      const A = this.assets, G = A.geometries, M = A.materials, d = this.d;
      const group = new THREE.Group();
      for (const k of ['hexWood', 'hexPlaster', 'hexTiles', 'vesWood', 'vesPlaster', 'vesTiles', 'wellPlaster', 'wellStone']) {
        group.add(new THREE.Mesh(G[k], M[k]));
      }
      group.add(new THREE.Mesh(G.lamps, M.lamp));
      for (const s of [1, -1]) {
        const sp = new THREE.Sprite(M.glow);
        sp.position.set(0, d.lampY, s * d.lampZ);
        sp.scale.set(1.5, 1.5, 1.5);
        group.add(sp);
      }
      const mirror = new THREE.Mesh(G.mirror, M.mirrorDark);
      mirror.position.set(d.mirrorX, d.mirrorY0 + d.mirrorH / 2, -d.hallW / 2 + 0.041);
      group.add(mirror);

      // books
      const S = this.lib.S;
      const base = G.book;
      const geo = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv', 'aPart']) geo.setAttribute(name, base.getAttribute(name));
      geo.setIndex(base.getIndex());
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(S * 3), 3);
      const variant = new THREE.InstancedBufferAttribute(new Float32Array(S), 1);
      geo.setAttribute('aTint', tint);
      geo.setAttribute('aVariant', variant);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, d.roomH / 2, 0), d.a + d.roomH);
      const books = new THREE.InstancedMesh(geo, M.books, S);
      books.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(books);
      return { group, books, tint, variant, tints: new Float32Array(S * 3), dg: 0, df: 0 };
    }

    _acquire() { return this.pool.pop() || this._createCell(); }

    _release(cell) {
      this.root.remove(cell.group);
      this.pool.push(cell);
    }

    /** Dresses a cell for hexagon (dg, df): which books exist, and how each one looks. */
    _dress(cell, dg, df) {
      cell.dg = dg; cell.df = df;
      const lib = this.lib;
      const g = this.gallery(dg), f = this.floor(df);
      const count = lib.booksInHexagon(g.digits, f.digits);
      const fp = lib.fingerprintFromKeys(g.key, f.key);
      cell.fingerprint = fp;
      cell.count = count;
      const unit = BabelCore.util.unit;
      const m = new THREE.Matrix4();
      for (let slot = 0; slot < count; slot++) {
        const rng = lib.bookRng(fp, slot);
        const c = LEATHER[Math.floor(unit(rng) * LEATHER.length)];
        const shade = 0.75 + 0.45 * unit(rng);
        const fade = unit(rng) * 0.25; // sun-faded towards grey
        for (let k = 0; k < 3; k++) {
          const v = (c[k] * (1 - fade) + 0.4 * fade) * shade;
          cell.tints[slot * 3 + k] = v;
          cell.tint.array[slot * 3 + k] = v;
        }
        cell.variant.array[slot] = Math.floor(unit(rng) * Babel.Textures.SPINE_VARIANTS);
        const L = this._bookLayout[slot];
        const push = unit(rng) < 0.12 ? -0.012 - unit(rng) * 0.02 : unit(rng) * 0.006; // a few stand proud
        m.copy(L.m);
        m.elements[12] += L.nx * push;
        m.elements[14] += L.nz * push;
        cell.books.setMatrixAt(slot, m);
      }
      cell.books.count = count;
      cell.books.instanceMatrix.needsUpdate = true;
      cell.tint.needsUpdate = true;
      cell.variant.needsUpdate = true;
    }

    _wanted(pg, pf) {
      const v = this.view, out = [];
      for (let df = pf - v.farFloors; df <= pf + v.farFloors; df++) {
        const near = Math.abs(df - pf) <= v.nearFloors;
        const span = near ? v.nearGalleries : v.farGalleries;
        for (let dg = pg - span; dg <= pg + span; dg++) out.push([dg, df]);
      }
      return out;
    }

    /** Moves the visible window to centre on the reader's cell. */
    update(pg, pf) {
      const d = this.d;
      const changed = !this.center || this.center[0] !== pg || this.center[1] !== pf;
      if (!changed) return;
      this.center = [pg, pf];
      const wanted = this._wanted(pg, pf);
      const keep = new Set(wanted.map(([g, f]) => g + ',' + f));
      for (const [key, cell] of this.cells) {
        if (!keep.has(key)) { this._release(cell); this.cells.delete(key); }
      }
      for (const [dg, df] of wanted) {
        const key = dg + ',' + df;
        let cell = this.cells.get(key);
        if (!cell) {
          cell = this._acquire();
          this._dress(cell, dg, df);
          this.cells.set(key, cell);
          this.root.add(cell.group);
        }
        cell.group.position.set((dg - pg) * d.Dx, (df - pf) * d.Hf, 0);
      }
      this._trimCaches(pg, pf);
      this.clearHover();
    }

    _trimCaches(pg, pf) {
      for (const k of this.galleryCache.keys()) if (Math.abs(k - pg) > 12) this.galleryCache.delete(k);
      for (const k of this.floorCache.keys()) if (Math.abs(k - pf) > 12) this.floorCache.delete(k);
    }

    cell(dg, df) { return this.cells.get(dg + ',' + df) || null; }

    /** Brightens one book (the one under the reader's gaze). */
    setHover(dg, df, slot) {
      if (this.hover && this.hover.dg === dg && this.hover.df === df && this.hover.slot === slot) return;
      this.clearHover();
      const cell = this.cell(dg, df);
      if (!cell || slot >= cell.count) return;
      for (let k = 0; k < 3; k++) cell.tint.array[slot * 3 + k] = Math.min(1, cell.tints[slot * 3 + k] * 1.6 + 0.05);
      cell.tint.needsUpdate = true;
      // draw the volume a few centimetres out of the row
      const m = new THREE.Matrix4();
      cell.books.getMatrixAt(slot, m);
      const L = this._bookLayout[slot];
      const saved = m.clone();
      m.elements[12] -= L.nx * 0.05;
      m.elements[14] -= L.nz * 0.05;
      cell.books.setMatrixAt(slot, m);
      cell.books.instanceMatrix.needsUpdate = true;
      this.hover = { dg, df, slot, cell, saved };
    }

    clearHover() {
      const h = this.hover;
      if (!h) return;
      const cell = h.cell;
      if (cell.dg === h.dg && cell.df === h.df) {
        for (let k = 0; k < 3; k++) cell.tint.array[h.slot * 3 + k] = cell.tints[h.slot * 3 + k];
        cell.tint.needsUpdate = true;
        cell.books.setMatrixAt(h.slot, h.saved);
        cell.books.instanceMatrix.needsUpdate = true;
      }
      this.hover = null;
    }
  }

  Babel.World = World;
})();
