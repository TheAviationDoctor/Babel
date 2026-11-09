/*
 * The visible Library: the hexagons around the reader, kept in a pool of "cells"
 * and re-dressed (book colours, spine designs) as the reader moves.
 *
 * Positions are relative: the cell the reader stands in is always at the origin,
 * so the Library can be walked for ever without losing numerical precision.
 * Absolute addresses (floor and hexagon numbers, each about half a million symbols
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

  const SHADE_OUT = new THREE.Color(0.085, 0.05, 0.022);
  const BULB_OUT = new THREE.Color(0.1, 0.04, 0.014);
  const TAU = Math.PI * 2;

  // the surfaces that age, and how
  const PATINAS = [['hexWood', 'wood'], ['hexPlaster', 'plaster'], ['hexTiles', 'tiles'], ['vesWood', 'wood'], ['vesPlaster', 'plaster'], ['vesTiles', 'tiles']];

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
      this.cells = new Map(); // key "dh,df" → cell
      this.pool = [];
      this.hexagonCache = new Map();
      this.floorCache = new Map();
      this.center = null;
      this.root = new THREE.Group();
      scene.add(this.root);
      this._bookLayout = this._layoutBooks();
      this.hover = null;
      this.view = { nearFloors: 1, nearHexagons: 3, farFloors: 6, farHexagons: 1 };
      this.doors = new Map(); // "dh,df" → { target: 0 or 1, t: 0…1 } for doors that have been touched
      this.lamps = new Map(); // "dh,df" → { target: 0 or 1, t: 0…1 } for night lamps that have been switched
      this.time = 0; // for the lamps that flicker
      // the painting in each vestibule, if the Library has paintings
      this.paintings = assets.paintingMaterial && library.painting ? new Babel.Paintings(library, assets) : null;
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

    /** Swings doors, dims lamps towards their targets, and goes on making the nearest paintings. */
    tick(dt) {
      this.time += dt;
      for (const cell of this.cells.values()) if (cell.looks && cell.looks.flickers) this._applyLamps(cell);
      if (this.paintings && this.paintings.step(6)) this._showPaintings();
      for (const [key, s] of this.doors) {
        if (s.t === s.target) continue;
        s.t = s.target ? Math.min(1, s.t + dt / 0.75) : Math.max(0, s.t - dt / 0.75);
        const cell = this.cells.get(key);
        if (cell) { this._applyDoor(cell); this._applyLight(cell); }
        if (s.t === 0 && s.target === 0) this.doors.delete(key);
      }
      for (const [key, s] of this.lamps) {
        if (s.t === s.target) continue;
        s.t = s.target ? Math.min(1, s.t + dt / 0.12) : Math.max(0, s.t - dt / 0.4);
        const cell = this.cells.get(key);
        if (cell) this._applyLight(cell);
        if (s.t === 1 && s.target === 1) this.lamps.delete(key);
      }
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
      this.anchor = { hexagon, floor };
      if (this.doors) this.doors.clear();
      if (this.lamps) this.lamps.clear();
      this.mark = null;
      this.hexagonCache.clear();
      this.floorCache.clear();
      for (const cell of this.cells.values()) this._release(cell);
      this.cells.clear();
      this.center = null;
    }

    /** Replaces the Library (a new seed) — the geometry stays, the books change. */
    setLibrary(library) { this.lib = library; }

    hexagon(dh) {
      let e = this.hexagonCache.get(dh);
      if (!e) {
        const digits = this.lib.offsetHexagon(this.anchor.hexagon, dh);
        e = { digits, key: this.lib.hexagonKey(digits) };
        this.hexagonCache.set(dh, e);
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
      // each hexagon has its own patina and its own lamps, so its own copies of what they colour
      const mine = (m) => {
        const c = m.clone();
        if (c.uniforms.map) c.uniforms.map.value = m.uniforms.map.value; // share the texture
        c.uniforms.uLightColors.value = m.uniforms.uLightColors.value.map((x) => x.clone());
        if (c.uniforms.uPath) c.uniforms.uPath.value = m.uniforms.uPath.value;
        return c;
      };
      const look = { mats: {}, hex: [], ves: [], lamps: [] };
      for (const k of ['hexWood', 'hexPlaster', 'hexTiles', 'vesWood', 'vesPlaster', 'vesTiles', 'wellPlaster', 'wellStone']) {
        const ages = PATINAS.some(([name]) => name === k), mat = ages ? mine(M[k]) : M[k];
        group.add(new THREE.Mesh(G[k], mat));
        if (ages) { look.mats[k] = mat; (k.startsWith('hex') ? look.hex : look.ves).push(mat); }
      }
      // the two lamps of the hexagon, the first towards +z as its light is
      for (const s of [1, -1]) {
        const globe = new THREE.Mesh(G.lamp, M.lamp.clone());
        globe.position.z = s * d.lampZ;
        const glow = new THREE.Sprite(M.glow.clone());
        glow.position.set(0, d.lampY, s * d.lampZ);
        glow.scale.set(1.5, 1.5, 1.5);
        group.add(globe, glow);
        look.lamps.push({ globe, glow });
      }
      if (G.pictureGlow) group.add(new THREE.Mesh(G.pictureGlow, M.lamp));
      const mirror = new THREE.Mesh(G.mirror, M.mirrorDark);
      mirror.position.set(d.mirrorX, d.mirrorY0 + d.mirrorH / 2, -d.hallW / 2 + 0.041);
      group.add(mirror);

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
      const signs = new THREE.Mesh(G.signs, M.signs);
      group.add(signs);

      // the painting opposite the mirror
      let canvas = null;
      if (this.paintings) {
        canvas = new THREE.Mesh(G.canvas, this.paintings.blank);
        group.add(canvas);
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
      sinkMirror.position.set(d.sinkMirror.x, d.sinkMirror.y0 + d.sinkMirror.h / 2, d.cellZ0 - 0.012);
      sinkMirror.rotation.y = Math.PI;
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
      group.add(books);
      return { group, books, tint, variant, tints: new Float32Array(S * 3), dh: 0, df: 0, door, interior, niche, signs, light, canvas, look, looks: null };
    }

    _acquire() { return this.pool.pop() || this._createCell(); }

    _release(cell) {
      this.root.remove(cell.group);
      this.pool.push(cell);
    }

    /** Dresses a cell for hexagon (dh, df): which books exist, and how each one looks. */
    _dress(cell, dh, df) {
      cell.dh = dh; cell.df = df;
      const lib = this.lib;
      const g = this.hexagon(dh), f = this.floor(df);
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
     * How time and use have marked a hexagon, and how its two lamps burn: drawn from its
     * fingerprint, so the same on every visit. Cosmetic, like the spines: it says nothing of
     * the books. Most lamps burn a little warmer or cooler, brighter or dimmer than others;
     * about one hexagon in forty has a lamp that flickers, and one in two hundred a lamp gone out.
     */
    _look(dh, df) {
      const fp = this.fingerprint(dh, df), U = BabelCore.util;
      const rng = U.sfc32(fp[0] ^ 0x51ed270b, fp[1], 0x2545f491, 0x9e3779b9), u = () => U.unit(rng);
      const lamps = [0, 1].map(() => ({ gain: 0.84 + 0.26 * u(), warmth: 2 * u() - 1, flicker: 0, dark: false }));
      const fault = u(), which = u() < 0.5 ? 0 : 1;
      if (fault < 1 / 200) { lamps[which].dark = true; lamps[which].gain = 0; }
      else if (fault < 1 / 200 + 1 / 40) lamps[which].flicker = 1 + 97 * u();
      const shade = 0.86 + 0.26 * u(), red = 2 * u() - 1;
      return {
        seed: [u(), u(), u() * TAU, 40 * u()], // where the textures start, how plaster turns, the stains
        plaster: [Math.pow(u(), 1.5), 0.22 + 0.6 * u(), Math.pow(u(), 2), u()], // damp, its tide line, stains, soot
        wood: [shade * (1 + 0.05 * red), shade, shade * (1 - 0.07 * red), u()], // shade, grime
        tiles: [0.35 + 0.65 * u(), u(), Math.pow(u(), 3), 0], // wear, which side of the shaft more, ink
        lamps,
      };
    }

    /** Gives a cell the look of its hexagon (and its vestibule the light of the next hexagon's lamps too). */
    _applyLook(cell) {
      const me = this._look(cell.dh, cell.df), east = this._look(cell.dh + 1, cell.df), west = this._look(cell.dh - 1, cell.df);
      // the next hexagons' lamps light the vestibules either side, and so this hexagon's doorways
      cell.looks = { me, east, west, flickers: [me, east, west].some((k) => k.lamps.some((l) => l.flicker)) };
      // the tiles run on unbroken along a floor, from hexagon to vestibule to hexagon, so their
      // pattern starts where the floor's does, not where the hexagon's
      const fk = this.floor(cell.df).key;
      for (const [k, kind] of PATINAS) {
        const un = cell.look.mats[k].uniforms;
        un.uSeed.value.fromArray(me.seed);
        if (kind === 'tiles') un.uSeed.value.set(fk[0] / 4294967296, fk[1] / 4294967296, 0, me.seed[3]);
        un.uSeedEast.value.fromArray(east.seed);
        un.uPatina.value.fromArray(me[kind]);
        un.uPatinaEast.value.fromArray(east[kind]);
      }
      this._applyLamps(cell);
    }

    /**
     * Lights a hexagon by its own two lamps, and its vestibule by them at its west end and by the
     * next hexagon's at its east end; the hexagon's doorways turn into the vestibules beyond, lit so.
     */
    _applyLamps(cell) {
      const { me, east, west } = cell.looks, t = this.time;
      const burn = (l) => (l.dark ? 0 : l.gain * (l.flicker ? flicker(t, l.flicker) : 1));
      const mean = (k) => (burn(k.lamps[0]) + burn(k.lamps[1])) / 2;
      const here = me.lamps.map(burn), mHere = (here[0] + here[1]) / 2, mEast = mean(east), mWest = mean(west);
      for (const m of cell.look.hex) {
        const u = m.uniforms, g = u.uGain.value, c = u.uLightColors.value;
        for (let i = 0; i < 2; i++) { g[i] = here[i]; c[i].setRGB(1, 0.78 + 0.045 * me.lamps[i].warmth, 0.52 + 0.07 * me.lamps[i].warmth); }
        if (u.uVesGains) u.uVesGains.value.set(mHere, mEast, mWest, mHere);
      }
      for (const m of cell.look.ves) {
        const g = m.uniforms.uGain.value;
        g[0] = mHere;
        g[1] = mEast;
      }
      cell.look.lamps.forEach(({ globe, glow }, i) => {
        const v = here[i], w = me.lamps[i].warmth;
        globe.material.color.setRGB(1, 0.914 + 0.03 * w, 0.77 + 0.06 * w).multiplyScalar(0.16 + 0.84 * Math.min(1, v));
        glow.material.color.setRGB(1, 0.95 + 0.03 * w, 0.88 + 0.06 * w);
        glow.material.opacity = 0.9 * Math.min(1, v);
      });
    }

    _wanted(ph, pf) {
      const v = this.view, out = [];
      for (let df = pf - v.farFloors; df <= pf + v.farFloors; df++) {
        const near = Math.abs(df - pf) <= v.nearFloors;
        const span = near ? v.nearHexagons : v.farHexagons;
        for (let dh = ph - span; dh <= ph + span; dh++) out.push([dh, df]);
      }
      return out;
    }

    /** Moves the visible window to centre on the reader's cell. */
    update(ph, pf) {
      const d = this.d;
      const changed = !this.center || this.center[0] !== ph || this.center[1] !== pf;
      if (!changed) return;
      this.center = [ph, pf];
      const wanted = this._wanted(ph, pf);
      const keep = new Set(wanted.map(([g, f]) => g + ',' + f));
      for (const [key, cell] of this.cells) {
        if (!keep.has(key)) { this._release(cell); this.cells.delete(key); }
      }
      for (const [dh, df] of wanted) {
        const key = dh + ',' + df;
        let cell = this.cells.get(key);
        if (!cell) {
          cell = this._acquire();
          this._dress(cell, dh, df);
          this.cells.set(key, cell);
          this.root.add(cell.group);
        }
        cell.group.position.set((dh - ph) * d.Dx, (df - pf) * d.Hf, 0);
        // cells can only be seen from close by, through their door
        cell.interior.visible = Math.abs(df - pf) <= 1 && Math.abs(dh - ph) <= 3;
        cell.door.visible = Math.abs(df - pf) <= 1;
        cell.niche.visible = Math.abs(df - pf) <= 1;
        cell.signs.visible = Math.abs(df - pf) <= 1;
        if (cell.canvas) cell.canvas.visible = Math.abs(df - pf) <= 1;
      }
      if (this.paintings) {
        // the paintings of the vestibules either side of the reader's hexagon and the next one
        // east, then the two beyond, made ahead of the reader
        const f = this.floor(pf);
        this.paintings.want([0, -1, 1, 2, -2].map((o) => {
          const g = this.hexagon(ph + o);
          return { key: this.paintings.key(g, f), hexagon: g.digits, floor: f.digits };
        }));
        this._showPaintings();
      }
      this._trimCaches(ph, pf);
      this.clearHover();
    }

    /** Hangs each painting that is ready in the vestibules near the reader; the others show the far colour. */
    _showPaintings() {
      if (!this.center) return;
      const [ph, pf] = this.center, P = this.paintings;
      for (const cell of this.cells.values()) {
        const near = cell.df === pf && cell.dh >= ph - 1 && cell.dh <= ph + 1;
        cell.canvas.material = near ? P.material(P.key(this.hexagon(cell.dh), this.floor(cell.df))) : P.blank;
      }
    }

    _trimCaches(ph, pf) {
      for (const k of this.hexagonCache.keys()) if (Math.abs(k - ph) > 12) this.hexagonCache.delete(k);
      for (const k of this.floorCache.keys()) if (Math.abs(k - pf) > 12) this.floorCache.delete(k);
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

  Babel.World = World;
})();
