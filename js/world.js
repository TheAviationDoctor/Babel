/*
 * The visible Library: the hexagons around the reader, kept in a pool of "cells"
 * and re-dressed (book colours, spine designs) as the reader moves.
 *
 * The hexagons stand on a honeycomb, in clusters of seven (see Honeycomb in
 * js/architecture.js): six hexagons of books, each a "cell" with its vestibule and its
 * passage, round a hub with the spiral stair. A place on the honeycomb is a "site", numbered
 * from the waking hexagon (site 0), so that the sites round one are a sum away.
 *
 * Positions are relative: the site the reader stands in is always at the origin, so the
 * Library can be walked for ever without losing numerical precision. Absolute addresses
 * (floor and hexagon numbers, hundreds of thousands of symbols long) are worked out from
 * the waking hexagon's and the reader's way from it, and only when they are needed.
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

  /** A book's leather, from its own random generator: its colour, how dark, how sun-faded (towards grey). */
  function leatherOf(rng) {
    const unit = BabelCore.util.unit;
    const c = LEATHER[Math.floor(unit(rng) * LEATHER.length)];
    const shade = 0.75 + 0.45 * unit(rng);
    const fade = unit(rng) * 0.25;
    return c.map((v) => (v * (1 - fade) + 0.4 * fade) * shade);
  }

  const SHADE_OUT = new THREE.Color(0.085, 0.05, 0.022);
  const BULB_OUT = new THREE.Color(0.1, 0.04, 0.014);
  const TAU = Math.PI * 2;

  // the surfaces that age, and how
  const PATINAS = [['hexWood', 'wood'], ['hexPlaster', 'plaster'], ['hexTiles', 'tiles'], ['vesWood', 'wood'], ['vesPlaster', 'plaster'], ['vesTiles', 'tiles'],
    ['pasWood', 'wood'], ['pasPlaster', 'plaster'], ['pasTiles', 'tiles']];
  const HUB_PATINAS = [['hubWood', 'wood'], ['hubPlaster', 'plaster'], ['hubTiles', 'tiles']];
  const HUB = 6; // the kind of a site that is a hub; the others are petals 0 to 5

  /** A failing filament: steady most of the time, now and then a burst of quick dips. */
  function flicker(t, seed) {
    const noise = (x) => {
      const i = Math.floor(x), f = x - i, w = f * f * (3 - 2 * f);
      const h = (k) => { const v = Math.sin((k + seed * 13.1) * 127.1) * 43758.5453; return v - Math.floor(v); };
      return h(i) * (1 - w) + h(i + 1) * w;
    };
    const b = Math.min(1, Math.max(0, (noise(t * 0.6) - 0.55) / 0.15)), burst = b * b * (3 - 2 * b);
    return 1 - burst * 0.7 * (1 - noise(t * 23)) - 0.03 * noise(t * 3);
  }

  class World {
    constructor(scene, assets, library) {
      this.scene = scene;
      this.assets = assets;
      this.d = assets.dims;
      this.lib = library;
      this.cells = new Map(); // key "site,df" → cell (a hexagon of books, its vestibule and its passage)
      this.pool = [];
      this.hubs = new Map(); // key "site,df" → hub
      this.hubPool = [];
      this.siteCache = new Map(); // site → what stands there, and (once asked) its key and number
      this.columnCache = new Map(); // clusters east of the waking one → { digits, key }
      this.rowCache = new Map(); // rows south of it → { digits, key }
      this.floorCache = new Map();
      this.center = null;
      this.root = new THREE.Group();
      scene.add(this.root);
      this._bookLayout = this._layoutBooks();
      this.hover = null;
      // how far the Library is drawn: through how many doors on the reader's floor, and up and down the shaft of their hexagon
      this.hurried = false; // the reader is falling fast: only their own shaft is dressed at once (see main.js)
      this.busy = false; // frames are not easy on this machine: less time for work spread over them (see main.js)
      this.view = { depth: 2, farFloors: 4 }; // (from behind the railing, no more floors can be seen down or up the shaft)
      this.doors = new Map(); // "dh,df" → { target: 0 or 1, t: 0…1 } for doors that have been touched
      this.lamps = new Map(); // "dh,df" → { target: 0 or 1, t: 0…1 } for night lamps that have been switched
      this.time = 0; // for the lamps that flicker
      // the painting in each vestibule, if the Library has paintings
      this.paintings = assets.paintingMaterial && library.painting ? new Babel.Paintings(library, assets) : null;
      this.paintingTitles = new Map(); // the names of paintings sought in the catalogue, by their hexagons' keys
    }

    /* ---------------- doors of the cells ---------------- */

    doorState(dh, df) { return this.doors.get(dh + ',' + df) || null; }

    /** How far open (0 shut … 1 open) the door of the cell beside vestibule (dh, df) is. */
    doorOpenness(dh, df) {
      const s = this.doorState(dh, df);
      return s ? s.t : 0;
    }

    isDoorOpen(dh, df) { return this.doorOpenness(dh, df) > 0.9; }

    /* ---------------- the book the catalogue found ---------------- */

    /** Marks a book (drawn a little out of its row and brighter). Pass null to clear. */
    setMark(mark) {
      const old = this.mark;
      this.clearHover();
      this.mark = mark;
      for (const m of [old, mark]) {
        if (!m) continue;
        const cell = this.cell(m.dh, m.df);
        if (cell) this._dress(cell, cell.dh, cell.df);
      }
    }

    isMarked(dh, df, slot) {
      const m = this.mark;
      return !!m && m.dh === dh && m.df === df && m.slot === slot;
    }

    toggleDoor(dh, df) {
      const key = dh + ',' + df;
      let s = this.doors.get(key);
      if (!s) { s = { target: 0, t: 0 }; this.doors.set(key, s); }
      s.target = s.target ? 0 : 1;
      return s.target === 1;
    }

    /* ---------------- night lamps of the cells ---------------- */

    /** Whether the night lamp of the cell beside vestibule (dh, df) is on (or turning on). Lamps start lit. */
    isLampOn(dh, df) {
      const s = this.lamps.get(dh + ',' + df);
      return s ? s.target === 1 : true;
    }

    toggleLamp(dh, df) {
      const key = dh + ',' + df;
      let s = this.lamps.get(key);
      if (!s) { s = { target: 1, t: 1 }; this.lamps.set(key, s); }
      s.target = s.target ? 0 : 1;
      return s.target === 1;
    }

    /** How brightly (0 … 1) the night lamp of that cell shines. */
    lampBrightness(dh, df) {
      const s = this.lamps.get(dh + ',' + df);
      return s ? s.t * s.t : 1; // a filament dims quickly, then glows out
    }

    /**
     * Swings doors, dims lamps towards their targets, and goes on making the nearest paintings.
     * `still`: the Library is only seen behind something else, so its lamps need not flicker.
     * Returns whether anything that can be seen has changed.
     */
    tick(dt, still) {
      this.time += dt;
      let moved = false;
      if (!still) for (const cell of this.cells.values()) if (cell.looks && cell.looks.flickers) { this._applyLamps(cell); moved = true; }
      if (this.paintings && this.paintings.step(this.busy ? 3 : 6)) { this._showPaintings(); moved = true; }
      this._trimPools();
      for (const [key, s] of this.doors) {
        if (s.t === s.target) continue;
        moved = true;
        s.t = s.target ? Math.min(1, s.t + dt / 0.75) : Math.max(0, s.t - dt / 0.75);
        const cell = this.cells.get(key);
        if (cell) { this._applyDoor(cell); this._applyLight(cell); }
        if (s.t === 0 && s.target === 0) this.doors.delete(key);
      }
      for (const [key, s] of this.lamps) {
        if (s.t === s.target) continue;
        moved = true;
        s.t = s.target ? Math.min(1, s.t + dt / 0.12) : Math.max(0, s.t - dt / 0.4);
        const cell = this.cells.get(key);
        if (cell) this._applyLight(cell);
        if (s.t === 1 && s.target === 1) this.lamps.delete(key);
      }
      return moved;
    }

    _applyDoor(cell) {
      const t = this.doorOpenness(cell.dh, cell.df);
      const e = t * t * (3 - 2 * t);
      cell.door.rotation.y = e * Math.PI * 0.5 * 0.97;
    }

    /**
     * Lights a cell's interior for its lamp and its door. With the lamp out, the only
     * light is what comes in from the vestibule through the doorway, and the shade
     * keeps a faint glow.
     */
    _applyLight(cell) {
      const b = this.lampBrightness(cell.dh, cell.df);
      const t = this.doorOpenness(cell.dh, cell.df), e = t * t * (3 - 2 * t);
      const L = cell.light, dark = 1 - b;
      const spill = 0.05 + 0.95 * e; // the vestibule's light, through the doorway
      const fill = b + dark * 0.3 * e; // light bouncing about the cell
      for (const m of [L.wood, L.soft]) {
        const g = m.uniforms.uGain.value;
        g[0] = b; g[1] = spill; g[2] = fill;
        m.uniforms.uAmbient.value = 0.05 * b + dark * (0.004 + 0.012 * e);
      }
      const g = L.door.uniforms.uGain.value;
      g[0] = b; g[3] = fill;
      L.door.uniforms.uAmbient.value = 0.05 * b + dark * 0.02;
      // out, the shade and bulb keep the faintest warm glow, enough to make out the lamp's outline
      L.shade.color.copy(SHADE_OUT).lerp(L.shadeColor, b);
      L.bulb.color.copy(BULB_OUT).lerp(L.bulbColor, b);
      L.glow.opacity = 0.9 * b + 0.04 * dark;
    }

    /** Sets the waking hexagon (absolute addresses) and clears everything cached. */
    setAnchor(hexagon, floor) {
      const c = this.lib.clusterOf(hexagon);
      // (the waking hexagon is petal `petal` of its cluster: it stands one step from its hub, that way)
      this.anchor = { hexagon, floor, row: c.row, column: c.column, petal: c.petal, at: Babel.Honeycomb.DIRS[c.petal] };
      this._wantedKey = null; // (which sites are stairs, and so what is drawn, depends on where the anchor is)
      if (this.doors) this.doors.clear();
      if (this.lamps) this.lamps.clear();
      this.mark = null;
      this.siteCache.clear();
      this.columnCache.clear();
      this.rowCache.clear();
      this.floorCache.clear();
      for (const cell of this.cells.values()) this._release(cell);
      this.cells.clear();
      for (const hub of this.hubs.values()) this._releaseHub(hub);
      this.hubs.clear();
      this.center = null;
    }

    /** Replaces the Library (a new seed) — the geometry stays, the books change. */
    setLibrary(library) { this.lib = library; }

    /* ---------------- sites ---------------- */

    /**
     * What stands at a site: { kind (petal 0 to 5, or 6 for a hub), east, south (its cluster,
     * from the waking hexagon's), hub (the site of its cluster's hub; a hub's is itself) }.
     */
    site(s) {
      let e = this.siteCache.get(s);
      if (!e) {
        const H = Babel.Honeycomb, [dq, dr] = H.at(s), a = this.anchor.at;
        const q = a[0] + dq, r = a[1] + dr, kind = H.kind(q, r); // counted from the waking cluster's hub
        const hq = kind === HUB ? q : q - H.DIRS[kind][0], hr = kind === HUB ? r : r - H.DIRS[kind][1];
        const [east, south] = H.cluster(hq, hr);
        e = { site: s, kind, east, south, hub: H.id(hq - a[0], hr - a[1]), key: null };
        this.siteCache.set(s, e);
      }
      return e;
    }

    /** Petal 0 to 5, or 6 for a hub. */
    kind(s) { return this.site(s).kind; }

    isHub(s) { return this.site(s).kind === HUB; }

    /** The sites next to a site through its doors: a hub's six petals in order; a petal's hub, then the hexagon beyond its passage. */
    neighbours(s) { return Babel.Honeycomb.doors(this.site(s).kind).map((n) => s + n.step); }

    _column(east) {
      let e = this.columnCache.get(east);
      if (!e) {
        const digits = east ? this.lib._wrap(this.anchor.column, east, this.lib.columnCount) : this.anchor.column;
        e = { digits, key: this.lib.columnKey(digits) };
        this.columnCache.set(east, e);
      }
      return e;
    }

    _row(south) {
      let e = this.rowCache.get(south);
      if (!e) {
        const digits = south ? this.lib._wrap(this.anchor.row, south, this.lib.rowCount) : this.anchor.row;
        e = { digits, key: this.lib.rowKey(digits) };
        this.rowCache.set(south, e);
      }
      return e;
    }

    /**
     * A site's key (a hash of where it is on its floor), and, for a hexagon of books, its number
     * (`digits`), worked out when first asked for: it costs a few passes over a very long number.
     */
    hexagon(s) {
      const e = this.site(s);
      if (!e.key) {
        const lib = this.lib, col = this._column(e.east), row = this._row(e.south);
        e.key = lib.petalKey(lib.clusterKey(col.key, row.key), e.kind);
        let digits = s === 0 ? this.anchor.hexagon : null;
        Object.defineProperty(e, 'digits', {
          get() {
            if (!digits && e.kind !== HUB) digits = lib.hexagonAt(row.digits, col.digits, e.kind);
            return digits;
          },
        });
      }
      return e;
    }

    floor(df) {
      let e = this.floorCache.get(df);
      if (!e) {
        const digits = this.lib.offsetFloor(this.anchor.floor, df);
        e = { digits, key: this.lib.floorKey(digits), top: this.lib.isTopFloor(digits) };
        this.floorCache.set(df, e);
      }
      return e;
    }

    /** Absolute location object of a book in cell (dh, df). */
    location(dh, df, slot) {
      return { hexagon: this.hexagon(dh).digits, floor: this.floor(df).digits, slot };
    }

    fingerprint(dh, df) {
      return this.lib.fingerprintFromKeys(this.hexagon(dh).key, this.floor(df).key);
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
        const x = d.bookX(volume);
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
      // each hexagon has its own patina and its own lamps, so its own copies of what they colour
      const mine = (m) => {
        const c = m.clone();
        if (c.uniforms.map) c.uniforms.map.value = m.uniforms.map.value; // share the texture
        c.uniforms.uLightColors.value = m.uniforms.uLightColors.value.map((x) => x.clone());
        if (c.uniforms.uPath) c.uniforms.uPath.value = m.uniforms.uPath.value;
        return c;
      };
      const look = { mats: {}, hex: [], ves: [], pas: [], lamps: [] };
      // the passage to the next cluster leaves by the hexagon's other door: it is built like a
      // vestibule (along +x), and turned to that door
      const passage = new THREE.Group();
      passage.rotation.y = -d.passageTurn;
      group.add(passage);
      const room = group;
      for (const [k] of PATINAS) {
        const mat = mine(M[k]), part = k.slice(0, 3);
        (part === 'pas' ? passage : group).add(new THREE.Mesh(G[k], mat));
        look.mats[k] = mat;
        look[part].push(mat);
      }
      const pasSigns = new THREE.Mesh(G.signs[0], M.pasSigns);
      passage.add(pasSigns);
      if (G.pictureGlow) passage.add(new THREE.Mesh(G.pictureGlow, M.lamp)); // and above its paintings
      // the lamps above the bookcases, in the order of their lights: each one's glowing underside
      // and the light it throws on the wall round it, both turned to its wall
      for (const j of d.shelvedSides) {
        const turn = Math.PI / 2 - (j * Math.PI) / 3;
        const under = new THREE.Mesh(G.lampGlow, M.lamp.clone());
        under.rotation.y = turn;
        room.add(under);
        let wash = null;
        if (G.lampWash) {
          wash = new THREE.Mesh(G.lampWash, M.lampWash.clone());
          wash.rotation.y = turn;
          room.add(wash);
        }
        look.lamps.push({ under, wash });
      }
      // the plates of the bookcases and of their rows
      room.add(new THREE.Mesh(G.plates, M.plates));

      // the door of the cell, turning on its hinge
      // each cell has its own lamp, so its interior and its door have their own materials
      const own = (m) => {
        const c = m.clone();
        if (c.uniforms && c.uniforms.map) c.uniforms.map.value = m.uniforms.map.value; // share the texture
        return c;
      };
      const light = {
        wood: own(M.cellWood), soft: own(M.cellSoft), door: own(M.doorWood),
        shade: M.shade.clone(), bulb: M.bulb.clone(), glow: M.glow.clone(),
        shadeColor: M.shade.color.clone(), bulbColor: M.bulb.color.clone(),
      };
      const door = new THREE.Group();
      door.position.set(d.doorPivot[0], 0, d.doorPivot[1]);
      const leaf = new THREE.Mesh(G.doorLeaf, light.door);
      // light the leaf as if it stood in its cell, whichever way it has turned
      leaf.onBeforeRender = () => {
        light.door.uniforms.uCellMatrix.value.copy(door.matrix);
        light.door.uniformsNeedUpdate = true;
      };
      door.add(leaf);
      group.add(door);

      // the catalogue in its niche opposite
      const niche = new THREE.Group();
      niche.add(new THREE.Mesh(G.niche, M.niche));
      const screen = new THREE.Mesh(G.screen, M.screen);
      screen.position.set(d.screen.x, d.screen.y, d.screen.z);
      screen.rotation.y = Math.PI;
      niche.add(screen);
      group.add(niche);

      // the signs over the two doorways of the vestibule
      const signs = new THREE.Mesh(G.signs[0], M.signs);
      group.add(signs);

      // the paintings in the passage: this hexagon's, and, turned half round about the passage's
      // middle, the painting of the hexagon at its other end
      let canvas = null, farCanvas = null, plate = null, farPlate = null;
      if (this.paintings) {
        canvas = new THREE.Mesh(G.canvas, this.paintings.blank);
        farCanvas = new THREE.Mesh(G.canvas, this.paintings.blank);
        farCanvas.position.set(d.Dx, 0, 0);
        farCanvas.rotation.y = Math.PI;
        passage.add(canvas, farCanvas);
        // and the plates under them: blank and hidden until a painting near the reader is named on
        // one (the lettered faces are few, and lent to whichever plates need them; see _showPaintings)
        plate = new THREE.Mesh(G.paintingPlate, this.paintings.blank);
        farPlate = new THREE.Mesh(G.paintingPlate, this.paintings.blank);
        plate.visible = farPlate.visible = false;
        farPlate.position.set(d.Dx, 0, 0);
        farPlate.rotation.y = Math.PI;
        passage.add(plate, farPlate);
      }

      // the cell itself, drawn only near the reader
      const interior = new THREE.Group();
      interior.add(new THREE.Mesh(G.cellWood, light.wood));
      interior.add(new THREE.Mesh(G.cellSoft, light.soft));
      interior.add(new THREE.Mesh(G.shade, light.shade));
      interior.add(new THREE.Mesh(G.bulb, light.bulb));
      const lampGlow = new THREE.Sprite(light.glow);
      lampGlow.position.set(d.nightLamp[0], d.nightLamp[1] + 0.25, d.nightLamp[2]);
      lampGlow.scale.set(0.7, 0.7, 0.7);
      interior.add(lampGlow);
      const sinkMirror = new THREE.Mesh(G.sinkMirror, M.mirrorDark);
      sinkMirror.position.set(d.sinkMirror.x - 0.012, d.sinkMirror.y0 + d.sinkMirror.h / 2, d.sinkMirror.z);
      sinkMirror.rotation.y = -Math.PI / 2; // on the east wall, facing west
      interior.add(sinkMirror);
      group.add(interior);

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
      const booksLit = mine(M.books);
      look.hex.push(booksLit);
      const books = new THREE.InstancedMesh(geo, booksLit, S);
      books.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      room.add(books);
      return { group, passage, pasSigns, books, tint, variant, tints: new Float32Array(S * 3), dh: 0, df: 0, kind: 0, door, interior, niche, signs, light, canvas, farCanvas, plate, farPlate, look, looks: null, owned: this._owned(group) };
    }

    /** The materials of a cell or hub just made that are its own, not shared with the others. */
    _owned(group) {
      if (!this._shared) this._shared = new Set([...Object.values(this.assets.materials), this.paintings && this.paintings.blank]);
      const owned = new Set();
      group.traverse((o) => { if (o.material && !this._shared.has(o.material)) owned.add(o.material); });
      return [...owned];
    }

    /**
     * Lets go of a cell or hub for good (one kept spare that has not been needed for a while):
     * its own materials, and its books' own buffers. The geometry it shares with the others,
     * the books' shape included, stays.
     */
    _dispose(item) {
      for (const m of item.owned) m.dispose();
      if (item.books) {
        const g = item.books.geometry;
        for (const name of ['position', 'normal', 'uv', 'aPart']) g.deleteAttribute(name);
        g.setIndex(null);
        g.dispose(); // (only its own attributes, the tints and variants, are left to go)
        item.books.dispose(); // and the books' places
      }
    }

    /**
     * Every few seconds, lets go of the cells and hubs kept spare beyond a few, once they have
     * not been needed for half a minute: the most there have been (round a stair, or before the
     * Library was drawn less far) need not be kept for good.
     */
    _trimPools() {
      if (this.time - (this._trimmed || 0) < 5) return;
      this._trimmed = this.time;
      const trim = (pool, keep) => {
        // (the pool is taken from at its end, so its oldest are first)
        while (pool.length > keep && this.time - pool[0].released > 30) this._dispose(pool.shift());
      };
      trim(this.pool, 8);
      trim(this.hubPool, 3);
    }

    /** A hub: its walls, floor and lamps, its shaft, and the stair in it. */
    _createHub() {
      const A = this.assets, G = A.geometries, M = A.materials, d = this.d;
      const group = new THREE.Group(), mats = {};
      for (const [k] of HUB_PATINAS) {
        const mat = M[k].clone();
        mat.uniforms.map.value = M[k].uniforms.map.value; // share the texture
        mat.uniforms.uPath.value = M[k].uniforms.uPath.value;
        mats[k] = mat;
        group.add(new THREE.Mesh(G[k], mat));
      }
      group.add(new THREE.Mesh(G.hubGlow, M.lamp));
      // the spiral stair, up the shaft from this floor's landing to the next one's
      group.add(new THREE.Mesh(G.stairWalnut, M.stairWalnut));
      return { group, mats, site: 0, df: 0, owned: this._owned(group) };
    }

    /**
     * Lays a part of the floor's tiles on the floor's plan: the part belongs to site s, whose frame
     * is turned by `turn`, so that the pattern runs on unbroken from every part of a floor into
     * the next, and is the same wherever one stands (it starts where the floor's key says).
     */
    _tileFrame(un, s, df, turn) {
      const H = Babel.Honeycomb, d = this.d, [px, pz] = this.assets.tilePeriod, fk = this.floor(df).key;
      const [q, r] = H.at(s), [x, z] = H.plan(q, r);
      const mod = (v, p) => ((v % p) + p) % p;
      un.uTileFrame.value.set(Math.cos(turn), Math.sin(turn), mod(x * d.Dx + (fk[0] / 4294967296) * px, px), mod(z * d.Dx + (fk[1] / 4294967296) * pz, pz));
    }

    _releaseHub(hub) {
      this.root.remove(hub.group);
      hub.released = this.time;
      this.hubPool.push(hub);
    }

    /** Gives a hub the look of its place: how time has marked its walls and floor. Its lamps burn steadily. */
    _dressHub(hub, site, df) {
      hub.site = site; hub.df = df;
      const me = this._look(site, df), fk = this.floor(df).key;
      for (const [k, kind] of HUB_PATINAS) {
        const un = hub.mats[k].uniforms;
        un.uSeed.value.fromArray(me.seed);
        if (kind === 'tiles' || kind === 'wood') un.uSeed.value.set(fk[0] / 4294967296, fk[1] / 4294967296, 0, me.seed[3]);
        if (kind === 'tiles') this._tileFrame(un, site, df, 0);
        un.uSeedEast.value.copy(un.uSeed.value);
        un.uPatina.value.fromArray(me[kind]);
        un.uPatinaEast.value.fromArray(me[kind]);
      }
    }

    _acquire() { return this.pool.pop() || this._createCell(); }

    _release(cell) {
      this.root.remove(cell.group);
      cell.released = this.time;
      this.pool.push(cell);
    }

    /** Dresses a cell for hexagon (dh, df): which books exist, and how each one looks. */
    _dress(cell, dh, df) {
      cell.dh = dh; cell.df = df;
      // which of its cluster's hexagons it is: the signs over its doorways name the ways they lead
      const kind = this.kind(dh);
      cell.kind = kind;
      cell.signs.geometry = this.assets.geometries.signs[(kind + 3) % 6]; // its vestibule heads for the hub
      cell.pasSigns.geometry = this.assets.geometries.signs[(kind + 1) % 6]; // its passage, one door round
      const lib = this.lib;
      const g = this.hexagon(dh), f = this.floor(df);
      // (every hexagon is full but, on the last floor, the last one, and those after it are missing)
      const count = f.top ? lib.booksInHexagon(g.digits, f.digits) : lib.S;
      const fp = lib.fingerprintFromKeys(g.key, f.key);
      cell.fingerprint = fp;
      cell.count = count;
      const unit = BabelCore.util.unit;
      const m = new THREE.Matrix4();
      for (let slot = 0; slot < count; slot++) {
        const rng = lib.bookRng(fp, slot);
        const leather = leatherOf(rng);
        for (let k = 0; k < 3; k++) {
          cell.tints[slot * 3 + k] = leather[k];
          cell.tint.array[slot * 3 + k] = leather[k];
        }
        cell.variant.array[slot] = Math.floor(unit(rng) * Babel.Textures.SPINE_VARIANTS);
        const L = this._bookLayout[slot];
        const push = unit(rng) < 0.12 ? -0.012 - unit(rng) * 0.02 : unit(rng) * 0.006; // a few stand proud
        m.copy(L.m);
        m.elements[12] += L.nx * push;
        m.elements[14] += L.nz * push;
        cell.books.setMatrixAt(slot, m);
      }
      const mk = this.mark;
      if (mk && mk.dh === dh && mk.df === df && mk.slot < count) {
        const L = this._bookLayout[mk.slot];
        cell.books.getMatrixAt(mk.slot, m);
        m.elements[12] -= L.nx * 0.07;
        m.elements[14] -= L.nz * 0.07;
        cell.books.setMatrixAt(mk.slot, m);
        for (let k = 0; k < 3; k++) {
          const v = Math.min(1, cell.tints[mk.slot * 3 + k] * 1.35 + 0.08);
          cell.tints[mk.slot * 3 + k] = v;
          cell.tint.array[mk.slot * 3 + k] = v;
        }
      }
      cell.books.count = count;
      this._applyDoor(cell);
      this._applyLight(cell);
      this._applyLook(cell);
      cell.books.instanceMatrix.needsUpdate = true;
      cell.tint.needsUpdate = true;
      cell.variant.needsUpdate = true;
    }

    /* ---------------- each hexagon's own look ---------------- */

    /**
     * How time and use have marked a hexagon, and how the lamps above its bookcases burn: drawn
     * from its fingerprint, so the same on every visit. Cosmetic, like the spines: it says nothing
     * of the books. Most lamps burn a little warmer or cooler, brighter or dimmer than others;
     * about one hexagon in thirty has a lamp that flickers, and one in a hundred and fifty a lamp gone out.
     * One hexagon of books in 64 is a crimson hexagon: its plaster is crimson.
     */
    _look(dh, df) {
      const fp = this.fingerprint(dh, df), U = BabelCore.util;
      const rng = U.sfc32(fp[0] ^ 0x51ed270b, fp[1], 0x2545f491, 0x9e3779b9), u = () => U.unit(rng);
      const hub = this.isHub(dh), n = hub ? 4 : this.d.shelvedSides.length;
      const lamp = () => ({ gain: 0.84 + 0.26 * u(), warmth: 2 * u() - 1, flicker: 0, dark: false });
      const lamps = [lamp(), lamp()];
      const fault = u(), which = Math.min(n - 1, Math.floor(u() * n));
      const shade = 0.86 + 0.26 * u(), red = 2 * u() - 1;
      const look = {
        seed: [u(), u(), u() * TAU, 40 * u()], // where the textures start, how plaster turns, the stains
        plaster: [Math.pow(u(), 1.5), 0.22 + 0.6 * u(), Math.pow(u(), 2), u()], // damp, its tide line, stains, soot
        wood: [shade * (1 + 0.05 * red), shade, shade * (1 - 0.07 * red), u()], // shade, grime
        tiles: [0.35 + 0.65 * u(), u(), Math.pow(u(), 3), 0], // wear, which side of the shaft more, ink
        lamps,
        // (from a hash of its own, so that the rest of the look is as it was without it)
        crimson: !hub && (U.fmix32((fp[0] ^ U.fmix32(fp[1] ^ 0x63726d73)) >>> 0) & 63) === 0,
      };
      // (the lamps after the first two are drawn last, so that the rest of the look is as it was with two)
      while (lamps.length < n) lamps.push(lamp());
      lamps.length = n;
      if (hub) for (const l of lamps) { l.gain = 1; l.warmth = 0; } // a hub's lamps are all alike, and none fails
      else if (fault < 1 / 150) { lamps[which].dark = true; lamps[which].gain = 0; }
      else if (fault < 1 / 150 + 1 / 30) lamps[which].flicker = 1 + 97 * u();
      return look;
    }

    /** Gives a cell the look of its hexagon; its vestibule turns into its hub's look, and its passage into the look of the hexagon beyond. */
    _applyLook(cell) {
      const [hubSite, outSite] = this.neighbours(cell.dh);
      const me = this._look(cell.dh, cell.df), hub = this._look(hubSite, cell.df), out = this._look(outSite, cell.df);
      // the hexagon beyond the passage lights its far end, and so this hexagon's doorway onto it
      cell.looks = { me, hub, out, flickers: [me, out].some((k) => k.lamps.some((l) => l.flicker)) };
      // the tiles and the skirting boards run on along a floor, from hexagon to vestibule to
      // hexagon, so their pattern starts where the floor's does, not where the hexagon's
      const fk = this.floor(cell.df).key;
      for (const [k, kind] of PATINAS) {
        const un = cell.look.mats[k].uniforms, far = k.startsWith('pas') ? out : hub;
        un.uSeed.value.fromArray(me.seed);
        if (kind === 'tiles' || kind === 'wood') un.uSeed.value.set(fk[0] / 4294967296, fk[1] / 4294967296, 0, me.seed[3]);
        if (kind === 'tiles') this._tileFrame(un, cell.dh, cell.df, Babel.Honeycomb.turn(cell.kind) + (k.startsWith('pas') ? this.d.passageTurn : 0));
        un.uSeedEast.value.fromArray(far.seed);
        un.uPatina.value.fromArray(me[kind]);
        un.uPatinaEast.value.fromArray(far[kind]);
        if (un.uCrimson) un.uCrimson.value = k === 'hexPlaster' && me.crimson ? 1 : 0; // (the hexagon's own walls, not its vestibule's or passage's)
      }
      this._applyLamps(cell);
    }

    /**
     * Lights a hexagon by its own lamps, its vestibule by them at its near end and by the hub's
     * at its far end, and its passage by them and by the lamps of the hexagon beyond; the
     * hexagon's doorways turn into the vestibule and the passage, lit so.
     */
    _applyLamps(cell) {
      const { me, hub, out } = cell.looks, t = this.time;
      const burn = (l) => (l.dark ? 0 : l.gain * (l.flicker ? flicker(t, l.flicker) : 1));
      const mean = (k) => k.lamps.reduce((s, l) => s + burn(l), 0) / k.lamps.length;
      const here = me.lamps.map(burn), mHere = here.reduce((s, v) => s + v, 0) / here.length, mHub = mean(hub), mOut = mean(out);
      for (const m of cell.look.hex) {
        const u = m.uniforms, g = u.uGain.value, c = u.uLightColors.value;
        here.forEach((v, i) => { g[i] = v; c[i].setRGB(1, 0.78 + 0.045 * me.lamps[i].warmth, 0.52 + 0.07 * me.lamps[i].warmth); });
        if (u.uVesGains) u.uVesGains.value.set(mHere, mHub, mOut, mHere);
      }
      for (const m of cell.look.ves) {
        const g = m.uniforms.uGain.value;
        g[0] = mHere;
        g[1] = mHub;
      }
      for (const m of cell.look.pas) {
        const g = m.uniforms.uGain.value;
        g[0] = mHere;
        g[1] = mOut;
      }
      cell.look.lamps.forEach(({ under, wash }, i) => {
        const v = here[i], w = me.lamps[i].warmth;
        under.material.color.setRGB(1, 0.914 + 0.03 * w, 0.77 + 0.06 * w).multiplyScalar(0.16 + 0.84 * Math.min(1, v));
        if (wash) {
          wash.material.color.setRGB(1, 0.95 + 0.03 * w, 0.88 + 0.06 * w);
          wash.material.opacity = 0.45 * Math.min(1, v);
        }
      });
    }

    /**
     * What to draw for a reader at site `ps` of floor `pf`, whose hexagon (the one they are in,
     * or nearest) is `home`: the sites within a few doors on their floor; on the floors next
     * above and below, the nearest of those; and their own hexagon, up and down its shaft.
     * Returns { cells, hubs }: lists of [site, floor, how many doors away, order], nearest first.
     */
    _wanted(ps, pf, home) {
      const v = this.view, depth = new Map([[ps, 0]]);
      let edge = [ps];
      for (let n = 1; n <= v.depth; n++) {
        const next = [];
        for (const s of edge) for (const t of this.neighbours(s)) if (!depth.has(t)) { depth.set(t, n); next.push(t); }
        edge = next;
      }
      if (!depth.has(home)) depth.set(home, 1);
      const cells = [], hubs = [];
      for (const [s, n] of depth) {
        const hub = this.isHub(s);
        for (let df = pf - 2; df <= pf + 2; df++) {
          const up = Math.abs(df - pf), order = n + 3 * up;
          if (hub) { if (up === 0 || (n <= 1 && up <= 2)) hubs.push([s, df, n, order]); }
          else if (up === 0 || (up === 1 && (n <= 1 || s === home))) cells.push([s, df, n, order]);
        }
      }
      for (let df = pf - v.farFloors; df <= pf + v.farFloors; df++) {
        if (Math.abs(df - pf) > 1) cells.push([home, df, depth.get(home), 3 + Math.abs(df - pf)]);
      }
      cells.sort((a, b) => a[3] - b[3]);
      return { cells, hubs, depth };
    }

    /**
     * Moves the visible window to centre on the reader's site (`home`: their hexagon, if the
     * site is a hub). The hexagons seen at once (the reader's own, those through its doors, and
     * its own up and down one floor) are dressed straight away; the others a few milliseconds'
     * worth a frame, nearest first, so that neither arriving nor walking on stops to shelve them
     * all at once. Returns whether anything was done.
     */
    update(ps, pf, home) {
      const d = this.d, H = Babel.Honeycomb;
      if (home === undefined) home = this.isHub(ps) ? this.neighbours(ps)[0] : ps;
      const changed = !this.center || this.center[0] !== ps || this.center[1] !== pf || this.center[2] !== home;
      if (!changed && !this.pending) return false;
      this.center = [ps, pf, home];
      // what to draw is worked out once for each place the reader stands, not again every frame
      // while it is being dressed
      const wantedKey = [ps, pf, home, this.view.depth, this.view.farFloors].join(',');
      if (this._wantedKey !== wantedKey) { this._wantedKey = wantedKey; this._wantedList = this._wanted(ps, pf, home); }
      const wanted = this._wantedList;
      const keep = new Set(wanted.cells.map(([s, f]) => s + ',' + f));
      for (const [key, cell] of this.cells) {
        if (!keep.has(key)) { this._release(cell); this.cells.delete(key); }
      }
      const keepHubs = new Set(wanted.hubs.map(([s, f]) => s + ',' + f));
      for (const [key, hub] of this.hubs) {
        if (!keepHubs.has(key)) { this._releaseHub(hub); this.hubs.delete(key); }
      }
      // where a site stands from the reader's, on the plan
      const [pq, pr] = H.at(ps);
      const place = (group, s, df) => {
        const [q, r] = H.at(s), [x, z] = H.plan(q - pq, r - pr);
        group.position.set(x * d.Dx, (df - pf) * d.Hf, z * d.Dx);
      };
      for (const [s, df] of wanted.hubs) {
        const key = s + ',' + df;
        let hub = this.hubs.get(key);
        if (!hub) {
          hub = this.hubPool.pop() || this._createHub();
          this._dressHub(hub, s, df);
          this.hubs.set(key, hub);
          this.root.add(hub.group);
        }
        place(hub.group, s, df);
      }
      // the others, while there is time left in this frame (a little more on arriving, when
      // there is nothing yet to walk through), and always at least one
      const start = performance.now(), budget = !this.cells.size ? 8 : this.busy ? 1.5 : 3;
      let dressed = 0;
      this.pending = false;
      for (const [s, df, n] of wanted.cells) {
        const key = s + ',' + df;
        let cell = this.cells.get(key);
        if (!cell) {
          const seen = this.hurried ? s === home && Math.abs(df - pf) <= 1 : (df === pf && n <= 1) || (s === home && Math.abs(df - pf) <= 1);
          if (!seen && dressed > 0 && performance.now() - start > budget) { this.pending = true; continue; }
          dressed++;
          cell = this._acquire();
          this._dress(cell, s, df);
          this.cells.set(key, cell);
          this.root.add(cell.group);
        }
        place(cell.group, s, df);
        cell.group.rotation.y = -H.turn(cell.kind); // its vestibule points at its hub
        const up = Math.abs(df - pf);
        // cells can only be seen from close by, through their door
        cell.interior.visible = up <= 1 && n <= 2;
        cell.door.visible = up <= 1;
        cell.niche.visible = up <= 1;
        cell.signs.visible = up <= 1;
        if (cell.canvas) cell.canvas.visible = cell.farCanvas.visible = up <= 1;
      }
      // A passage belongs to both the hexagons it joins: it is drawn by the one that is petal 0, 1
      // or 2 of its cluster, or by the other if that one is not drawn.
      for (const cell of this.cells.values()) {
        cell.passage.visible = cell.kind < 3 || !this.cells.has(this.neighbours(cell.dh)[1] + ',' + cell.df);
      }
      if (this.paintings) {
        // the paintings of the hexagons nearest the reader, their own hexagon's first, made ahead of them
        const f = this.floor(pf);
        const near = wanted.cells.filter(([s, df, n]) => df === pf && n <= 2).sort((a, b) => (b[0] === home) - (a[0] === home) || a[2] - b[2]).slice(0, 6);
        this._paintingSites = new Set(near.map(([s]) => s));
        this.paintings.want(near.map(([s]) => {
          const g = this.hexagon(s);
          return { key: this.paintings.key(g, f), hexagon: g.digits, floor: f.digits };
        }));
        this._showPaintings();
      }
      this._trimCaches(ps, pf);
      this.clearHover();
      return true;
    }

    /** Names the painting of site s of floor df (as the catalogue knows it), on the plate under it. */
    namePainting(s, df, title) {
      if (!this.paintings || !title) return;
      const key = this.paintings.key(this.hexagon(s), this.floor(df));
      this.paintingTitles.set(key, title); // (shown at the next update)
      const face = this._faces && this._faces.get(key);
      if (face) face.title = null; // to be lettered again
    }

    /** The lettered face for the painting of `key` (site s of floor df), lent from the few there are. */
    _plateFace(key, s, df) {
      this._faces = this._faces || new Map(); // the faces lent, by painting
      this._spareFaces = this._spareFaces || [];
      let face = this._faces.get(key);
      if (!face) {
        face = this._spareFaces.pop();
        if (!face) {
          const plate = Babel.Textures.titlePlate();
          face = { plate, material: this.assets.plateMaterial(plate.texture), title: null };
        }
        face.title = null;
        this._faces.set(key, face);
      }
      // its name: the one it was sought by in the catalogue, or else the one its hexagon gives it
      if (face.title === null) {
        face.title = this.paintingTitles.get(key) || this.lib.paintingTitle(this.fingerprint(s, df));
        face.plate.show(face.title);
      }
      face.used = true;
      return face;
    }

    /** Hangs each painting that is ready in the passages near the reader; the others show the far colour. */
    _showPaintings() {
      if (!this.center) return;
      const pf = this.center[1], P = this.paintings, near = this._paintingSites || new Set();
      const hang = (canvas, plate, s, df) => {
        const key = P.key(this.hexagon(s), this.floor(df));
        const close = df === pf && near.has(s);
        canvas.material = close ? P.material(key) : P.blank;
        // only the plates of the paintings near the reader are lettered; the others are not drawn
        plate.visible = close;
        if (close) plate.material = this._plateFace(key, s, df).material;
      };
      if (this._faces) for (const face of this._faces.values()) face.used = false;
      for (const cell of this.cells.values()) {
        hang(cell.canvas, cell.plate, cell.dh, cell.df);
        hang(cell.farCanvas, cell.farPlate, this.neighbours(cell.dh)[1], cell.df); // the hexagon beyond the passage
      }
      // the faces no plate needs now go back to be lent again
      if (this._faces) for (const [key, face] of this._faces) if (!face.used) { this._faces.delete(key); this._spareFaces.push(face); }
    }

    /** Forgets what was worked out for places the reader has left far behind. */
    _trimCaches(ps, pf) {
      for (const k of this.floorCache.keys()) if (Math.abs(k - pf) > 12) this.floorCache.delete(k);
      if (this.siteCache.size < 600) return;
      const H = Babel.Honeycomb, [pq, pr] = H.at(ps), here = this.site(ps);
      for (const [s, e] of this.siteCache) {
        const [q, r] = H.at(s), dq = q - pq, dr = r - pr;
        if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) > 9) this.siteCache.delete(s);
        void e;
      }
      for (const k of this.columnCache.keys()) if (Math.abs(k - here.east) > 6) this.columnCache.delete(k);
      for (const k of this.rowCache.keys()) if (Math.abs(k - here.south) > 6) this.rowCache.delete(k);
    }

    cell(dh, df) { return this.cells.get(dh + ',' + df) || null; }

    /** Brightens one book (the one under the reader's gaze). */
    setHover(dh, df, slot) {
      if (this.hover && this.hover.dh === dh && this.hover.df === df && this.hover.slot === slot) return;
      this.clearHover();
      const cell = this.cell(dh, df);
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
      this.hover = { dh, df, slot, cell, saved };
    }

    clearHover() {
      const h = this.hover;
      if (!h) return;
      const cell = h.cell;
      if (cell.dh === h.dh && cell.df === h.df) {
        for (let k = 0; k < 3; k++) cell.tint.array[h.slot * 3 + k] = cell.tints[h.slot * 3 + k];
        cell.tint.needsUpdate = true;
        cell.books.setMatrixAt(h.slot, h.saved);
        cell.books.instanceMatrix.needsUpdate = true;
      }
      this.hover = null;
    }
  }

  /** The leather of the book in `slot` of the hexagon with fingerprint `fp`, as on the shelf (linear RGB). */
  World.leather = (lib, fp, slot) => leatherOf(lib.bookRng(fp, slot));

  Babel.World = World;
})();
