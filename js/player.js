/*
 * The reader: first-person movement, the spiral stair, jumping and falling, and the gaze
 * that picks a book.
 *
 * Position is kept relative to the site the reader is in (see Honeycomb in
 * js/architecture.js): `site`, a hexagon of books or a hub, on floor `cf`; x east and z
 * south from the site's middle, y height above this floor. Crossing the middle of a
 * vestibule, or half a storey up or down, moves the reader into the next site. `ch` is
 * the reader's hexagon of books: the site itself, or in a hub the nearest of the six round it.
 *
 * Walls, doors and books are tested in the frame of the cell they belong to (a hexagon of
 * books at its origin, its vestibule along +x), each cell being turned to face its hub.
 *
 * Off the ground (a jump, or a step off an edge), the reader is a body of their height and
 * radius, falling: it fits where it is clear of walls and ceilings, of the edges of the floors
 * round a shaft (each floor's slab, and the railing on it), and of the stair's treads; and it
 * lands on the highest floor or tread under it. Every floor being like the others, only the
 * body's place within its storey counts, so it can fall through any number of them.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const SQ3 = Math.sqrt(3);
  const TAU = Math.PI * 2;
  // Off the ground (metres, seconds): gravity; the fastest one falls (air holds a body back); how
  // high a jump lifts the feet, enough to clear a shaft's low railing; how fast the reader can
  // steer in the air, and drift where they did not leave the ground moving; and how fast one
  // slips off a railing landed on.
  const AIR = { gravity: 9.81, terminal: 15, jump: 0.62, steer: 2.2, drift: 0.9, slip: 1.2 };

  /** Distance along a ray to an axis-aligned box [x0,y0,z0,x1,y1,z1], or null. */
  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    let tmin = 0, tmax = Infinity;
    const o = [ox, oy, oz], dir = [dx, dy, dz];
    for (let i = 0; i < 3; i++) {
      const lo = b[i], hi = b[i + 3];
      if (Math.abs(dir[i]) < 1e-9) { if (o[i] < lo || o[i] > hi) return null; continue; }
      let t1 = (lo - o[i]) / dir[i], t2 = (hi - o[i]) / dir[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin;
  }

  /** A ray (origin o, direction dir) in the frame `f` (see Architecture.frameAt). */
  function rayInto(f, o, dir) {
    const X = o.x - f.x, Z = o.z - f.z;
    return { ox: X * f.c + Z * f.s, oy: o.y, oz: -X * f.s + Z * f.c, dx: dir.x * f.c + dir.z * f.s, dy: dir.y, dz: -dir.x * f.s + dir.z * f.c };
  }

  /** The yaw that looks along direction phi (radians from +x towards +z). */
  function yawOf(phi) { return -Math.PI / 2 - phi; }

  const HUB = 6;

  // how long it takes to recover from landing (seconds), the hardest landing the longest
  const LANDING = 0.6;
  const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  function hexDist(x, z) {
    return Math.max(Math.abs(x), Math.abs(x / 2 + (z * SQ3) / 2), Math.abs(x / 2 - (z * SQ3) / 2));
  }

  class Player {
    constructor(dims, camera, dom) {
      this.d = dims;
      this.camera = camera;
      this.dom = dom;
      this.radius = 0.24;
      this.site = 0; this.kind = 0; this.ch = 0; this.cf = 0;
      this.x = 0; this.y = 0; this.z = 0;
      this.yaw = 0; this.pitch = 0;
      this.speed = 1.55; // metres a second, walking (hurrying, 1.9 times as fast)
      this.capsLock = false;
      this.keys = new Set();
      // Crouching, to see the lower shelves without looking down: whether the reader means to
      // crouch, and how far down they are (0 standing, 1 crouched), which follows it smoothly.
      this.crouching = false;
      this.crouch = 0;
      // Jumping and falling: while the reader is off the ground, how they move ({ vx, vy, vz }:
      // metres a second, and `t`, seconds since they left it), or null; and the landing they are
      // recovering from ({ t: seconds since, depth: how hard, 0 to 1 }), or null.
      this.air = null;
      this.landing = null;
      this._jumpAt = -1; // when the space bar was last pressed (a jump asked a moment early still counts)
      this.sensitivity = 1;
      this.bob = 0;
      this.enabled = false;
      this.touch = { move: null, look: null };
      this.reach = 2.1;
      this._ray = { o: new THREE.Vector3(), d: new THREE.Vector3() };
      // what stands at a site (petal 0 to 5, or 6 for a hub): main.js asks the World
      this.kindOf = () => 0;
      // what lies round a site of each kind, from its middle: the cells whose walls the reader may
      // meet there (each with its frame), the hubs, and the sites next door
      const A = Babel.Architecture, H = Babel.Honeycomb, D = dims.Dx;
      const cellAt = (step, v, petal) => {
        const [x, z] = H.plan(v[0], v[1]);
        return { step, petal, frame: A.frameAt(x * D, z * D, H.turn(petal)) };
      };
      this._around = [0, 1, 2, 3, 4, 5, 6].map((kind) => {
        const doors = H.doors(kind).map((n) => {
          const v = H.DIRS[n.dir], [x, z] = H.plan(v[0], v[1]);
          return { step: n.step, kind: n.kind, x: x * D, z: z * D, v };
        });
        if (kind === HUB) return { doors, hubs: [{ step: 0, x: 0, z: 0 }], cells: doors.map((n) => cellAt(n.step, n.v, n.kind)) };
        return { doors, hubs: [{ step: doors[0].step, x: doors[0].x, z: doors[0].z }], cells: [cellAt(0, [0, 0], kind), cellAt(doors[1].step, doors[1].v, doors[1].kind)] };
      });
      this._pc = Math.cos(dims.passageTurn); this._ps = Math.sin(dims.passageTurn);
      this._bindInput();
    }

    /* ---------------- frames ---------------- */

    /** What lies round the reader's site: { cells: [{ step, petal, frame }], hubs: [{ step, x, z }], doors: [{ step, kind, x, z }] }. */
    around() { return this._around[this.kind]; }

    /** The cells round the reader, each with its site: [{ site, petal, frame }]. */
    cells() { return this.around().cells.map((c) => ({ site: this.site + c.step, petal: c.petal, frame: c.frame })); }

    /** The reader's place (or the point (x, z) of their site) in a cell's frame. */
    inFrame(frame, x, z) { return Babel.Architecture.intoFrame(frame, x === undefined ? this.x : x, z === undefined ? this.z : z); }

    /** Whether the reader's site is a hexagon of books, and how it is turned (radians from +x towards +z): its vestibule heads that way. */
    get inRoom() { return this.kind !== HUB; }

    roomTurn() { return this.kind === HUB ? 0 : Babel.Honeycomb.turn(this.kind); }

    /** The camera's ray, in a frame. */
    _gaze(frame) {
      this.camera.updateMatrixWorld();
      const dir = this._ray.d;
      this.camera.getWorldDirection(dir);
      return rayInto(frame, this.camera.position, dir);
    }

    /**
     * Where the reader is between their site and the next one, for the music: { here, there (the
     * site they are nearest to going into), along (metres from this site's middle towards it) }.
     */
    hearing() {
      let best = null, far = -Infinity;
      for (const n of this.around().doors) {
        const along = (this.x * n.x + this.z * n.z) / this.d.Dx;
        if (along > far) { far = along; best = n; }
      }
      return { here: this.site, there: this.site + best.step, along: far };
    }

    /** Sets the reader in a site, and works out the rest (what the site is, and the reader's hexagon). */
    _arrive(site, cf) {
      this.site = site; this.cf = cf || 0;
      this.air = null; this.landing = null;
      this.kind = this.kindOf(site);
      this._home();
    }

    /** The reader's hexagon of books: their site, or in a hub the hexagon they are nearest (keeping to the last, when it is nearly as near). */
    _home() {
      if (this.kind !== HUB) { this.ch = this.site; return; }
      let best = null, far = -Infinity, kept = -Infinity;
      for (const n of this.around().doors) {
        const along = this.x * n.x + this.z * n.z;
        if (along > far) { far = along; best = n; }
        if (this.site + n.step === this.ch) kept = along;
      }
      if (kept < far - 3) this.ch = this.site + best.step;
    }

    /** Places the reader on the walkway of hexagon (ch, cf) (by default the anchor), looking across the shaft. */
    placeAtStart(ch, cf) {
      const d = this.d;
      this._arrive(ch || 0, cf);
      // on the far side of the shaft from the door to the hub, looking across it towards a wall of books
      const mid = (d.shaftA + d.aIn) / 2, t = this.roomTurn();
      this.x = -mid * 0.95 * Math.cos(t); this.y = 0; this.z = -mid * 0.95 * Math.sin(t);
      this.yaw = yawOf(t - 0.55);
      this.pitch = -0.08;
    }

    /* ---------------- input ---------------- */

    _bindInput() {
      // Caps Lock, while on, makes the reader hurry as Shift does. Browsers only say whether it
      // is on as part of a key or mouse event, so every such event is asked.
      const caps = (e) => { if (e.getModifierState) this.capsLock = e.getModifierState('CapsLock'); };
      // C crouches: a tap crouches or stands up again; held, it crouches only while held (or,
      // crouched, stands only while held). (Not Control, as many games have it: in a browser,
      // Control and W, held together to walk crouched, close the tab.)
      const isCrouch = (e) => e.code === 'KeyC' && !e.ctrlKey && !e.metaKey && !e.altKey;
      window.addEventListener('keydown', (e) => {
        caps(e);
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        this.keys.add(e.code);
        if (!this.enabled) return;
        if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
          this._jumpAt = performance.now();
          e.preventDefault(); // (not to scroll the page)
        }
        if (isCrouch(e) && !e.repeat) {
          this._crouchKey = { at: performance.now(), was: this.crouching };
          this.crouching = !this.crouching;
        }
      });
      window.addEventListener('keyup', (e) => {
        caps(e);
        this.keys.delete(e.code);
        if (e.code === 'KeyC' && this._crouchKey) {
          if (performance.now() - this._crouchKey.at > 350) this.crouching = this._crouchKey.was; // held: back as before
          this._crouchKey = null;
        }
      });
      window.addEventListener('blur', () => this.keys.clear());
      for (const type of ['mousemove', 'mousedown', 'wheel']) window.addEventListener(type, caps, { passive: true });
      // Some browsers report one large jump just as the pointer is captured; ignore it.
      document.addEventListener('pointerlockchange', () => { this._settleUntil = performance.now() + 120; });
      document.addEventListener('mousemove', (e) => {
        if (!this.enabled) return;
        if (document.pointerLockElement === this.dom || this._dragging) {
          if (performance.now() < (this._settleUntil || 0)) return;
          if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
          this.look(e.movementX, e.movementY);
        }
      });
      // fallback when pointer lock is unavailable: drag to look
      this.dom.addEventListener('mousedown', (e) => { if (this.enabled && document.pointerLockElement !== this.dom) this._dragging = true; void e; });
      window.addEventListener('mouseup', () => { this._dragging = false; });

      // touch: left half moves, right half looks
      const tstart = (e) => {
        if (!this.enabled) return;
        for (const t of e.changedTouches) {
          const left = t.clientX < window.innerWidth * 0.45;
          const slot = left ? 'move' : 'look';
          if (!this.touch[slot]) this.touch[slot] = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() };
        }
      };
      const tmove = (e) => {
        for (const t of e.changedTouches) {
          for (const slot of ['move', 'look']) {
            const s = this.touch[slot];
            if (s && s.id === t.identifier) {
              if (slot === 'look') this.look((t.clientX - s.x) * 2.2, (t.clientY - s.y) * 2.2);
              s.x = t.clientX; s.y = t.clientY;
            }
          }
        }
        if (this.enabled) e.preventDefault();
      };
      const tend = (e) => {
        for (const t of e.changedTouches) {
          for (const slot of ['move', 'look']) {
            const s = this.touch[slot];
            if (s && s.id === t.identifier) {
              if (slot === 'look' && performance.now() - s.t0 < 250 && Math.hypot(s.x - s.x0, s.y - s.y0) < 12) this._tapped(s.x, s.y);
              this.touch[slot] = null;
            }
          }
        }
      };
      this.dom.addEventListener('touchstart', tstart, { passive: true });
      this.dom.addEventListener('touchmove', tmove, { passive: false });
      this.dom.addEventListener('touchend', tend);
      this.dom.addEventListener('touchcancel', tend);
    }

    /**
     * A tap on the half of the screen that looks, at (x, y): it uses what the reader looks at (a
     * book, a door, a lamp, the bed, the Catalogue); with nothing there to use, two such taps in
     * quick succession, near each other, jump (while the other thumb walks, a running jump).
     */
    _tapped(x, y) {
      if (this.onTap && this.onTap()) { this._emptyTap = null; return; }
      const now = performance.now(), last = this._emptyTap;
      if (last && now - last.at < 350 && Math.hypot(x - last.x, y - last.y) < 60) {
        this._emptyTap = null;
        if (this.enabled) this._jumpAt = now;
        return;
      }
      this._emptyTap = { at: now, x, y };
    }

    look(dx, dy) {
      const k = 0.0022 * this.sensitivity;
      this.yaw -= dx * k;
      this.pitch -= dy * k;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }

    /* ---------------- walkable space ---------------- */

    /** Ground height at (x, z) for a reader currently at height y, or null where one cannot stand. */
    ground(x, z, y) {
      if (Math.abs(y) < 0.35 && this._floorAt(x, z) !== null) return 0;
      for (const h of this.around().hubs) {
        const g = this._stair(x - h.x, z - h.z, y);
        if (g !== null) return g;
      }
      return null;
    }

    /**
     * Whether a reader standing at (x, z) on a floor (any floor: they are all alike) would be on
     * it, clear of its walls, and if so, how high above it the ceiling over them is; else null.
     */
    _floorAt(x, z) {
      const d = this.d, r = this.radius, A = this.around(), I = Babel.Architecture.intoFrame;
      for (const c of A.cells) {
        const [hx, hz] = I(c.frame, x, z);
        // the hexagon, round its shaft
        const hd = hexDist(hx, hz);
        if (hd <= d.aIn - r && hd >= d.shaftA + 0.07 + r) return d.roomH;
        // its vestibule, including the passages through the walls at either end (as low as the
        // doors there, where the reader's head would be under their lintels)
        const hall = (u, v) => (u >= d.aIn - r - 0.05 && u <= d.Dx - d.aIn + r + 0.05 && Math.abs(v) <= d.hallW / 2 - r
          ? (u < d.a + r || u > d.Dx - d.a - r ? d.doorH : d.roomH) : null);
        let h = hall(hx, hz);
        if (h !== null) return h;
        // the cell behind the vestibule's south door
        if (this._inCell(hx, hz, this.site + c.step)) return hz > d.cellZ0 - r ? d.closetH : d.cellH;
        // its passage to the next cluster, which leaves by its other door
        h = hall(hx * this._pc + hz * this._ps, -hx * this._ps + hz * this._pc);
        if (h !== null) return h;
      }
      for (const hb of A.hubs) {
        const ux = x - hb.x, uz = z - hb.z, hd = hexDist(ux, uz);
        if (hd > d.aIn - r) continue;
        // round the shaft, behind its railing
        if (hd >= d.shaftA + 0.07 + r) return d.roomH;
        // the landing, where the railing is open: a sixth of the shaft, between the column and the floor
        const c = Math.cos(d.landingTheta), s = Math.sin(d.landingTheta);
        const pn = ux * c + uz * s, pt = -ux * s + uz * c;
        if (pn <= d.shaftA + 0.07 + r + 0.02 && Math.abs(pt) <= pn * Math.tan(d.landingHalf) - r / Math.cos(d.landingHalf) && Math.hypot(ux, uz) >= d.colR + r) return d.roomH;
      }
      return null;
    }

    /** Whether a reader of this radius fits at (hx, z) in or at the door of a cell. */
    _inCell(hx, z, site) {
      const d = this.d, r = this.radius;
      const open = this.doorOpen ? this.doorOpen(site) : false;
      // the doorway, only while the door stands open
      if (open && Math.abs(hx - d.closetX) <= d.closetW / 2 - r && z <= -d.hallW / 2 + r + 0.02 && z >= d.cellZ0 - r - 0.02) return true;
      if (hx < d.cellX0 + r || hx > d.cellX1 - r || z > d.cellZ0 - r || z < d.cellZ1 + r) return false;
      const blocks = open ? d.cellObstacles.concat([d.cellDoor]) : d.cellObstacles;
      for (const o of blocks) {
        const cx = Math.max(o.x0, Math.min(hx, o.x1)), cz = Math.max(o.z0, Math.min(z, o.z1));
        if ((hx - cx) * (hx - cx) + (z - cz) * (z - cz) < r * r) return false;
      }
      return true;
    }

    /** True if the reader stands where the door of that site's cell would sweep as it closes. */
    inDoorway(site) {
      const d = this.d, c = this.cells().find((k) => k.site === site);
      if (!c) return false;
      const [hx, hz] = this.inFrame(c.frame);
      const dx = hx - d.doorPivot[0], dz = hz - d.doorPivot[1];
      return Math.abs(this.y) < 0.35 && Math.hypot(dx, dz) < d.closetW + this.radius + 0.05 && hx > d.hingeX - this.radius && hx < d.hingeX + d.closetW + this.radius && hz < -d.hallW / 2 + this.radius + 0.05;
    }

    /** The cell door the reader is looking at, if within reach: { site, t }. `openness(site)`: how far open each is. */
    pickDoor(openness) {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      let best = null;
      for (const c of this.cells()) {
        const g = this._gaze(c.frame);
        const t0 = openness(c.site);
        const px = d.doorPivot[0], pz = d.doorPivot[1], w = d.closetW;
        const box = t0 < 0.5
          ? [d.hingeX, 0, pz - 0.035, d.hingeX + w, d.closetH, pz + 0.04]
          : [px - 0.04, 0, pz - w, px + 0.04, d.closetH, pz + 0.02];
        const t = rayBox(g.ox, g.oy, g.oz, g.dx, g.dy, g.dz, box);
        if (t !== null && t < this.reach && (!best || t < best.t)) best = { site: c.site, t };
      }
      return best;
    }

    /**
     * The night lamp the reader is looking at, if within reach: { site, t }. It can
     * be seen from inside its cell, or from outside through the doorway while the door is open.
     */
    pickLamp(openness) {
      const L = this.d.nightLamp;
      return this._pickInCell([L[0] - 0.14, L[1], L[2] - 0.14, L[0] + 0.14, L[1] + 0.38, L[2] + 0.14], openness);
    }

    /** The bed of the nearest cell, if the reader is looking at it within reach: { site, t }. */
    pickBed(openness) {
      const B = this.d.bed;
      return this._pickInCell([B.x0, 0, B.z0, B.x1, 0.62, B.z1], openness);
    }

    /**
     * Something in a cell (a box [x0, y0, z0, x1, y1, z1] in its hexagon's frame), seen
     * from inside the cell or through its open door.
     */
    _pickInCell(box, openness) {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      let best = null;
      for (const c of this.cells()) {
        const g = this._gaze(c.frame);
        const t = rayBox(g.ox, g.oy, g.oz, g.dx, g.dy, g.dz, box);
        if (t === null || t >= this.reach || (best && t >= best.t)) continue;
        const inside = g.ox > d.cellX0 && g.ox < d.cellX1 && g.oz < d.cellZ0 && g.oz > d.cellZ1;
        if (!inside) {
          if (openness(c.site) < 0.5 || g.dz >= -1e-6) continue;
          const tw = (d.cellZ0 - g.oz) / g.dz; // where the gaze passes through the cell's wall
          const wx = g.ox + g.dx * tw, wy = g.oy + g.dy * tw;
          if (tw < 0 || tw > t || wx < d.hingeX || wx > d.hingeX + d.closetW || wy > d.closetH) continue;
        }
        best = { site: c.site, t };
      }
      return best;
    }

    /** The catalogue the reader is looking at, if within reach: { site, t }. */
    pickTerminal() {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      let best = null;
      const hw = d.hallW / 2;
      for (const c of this.cells()) {
        const g = this._gaze(c.frame);
        const box = [d.nicheX - d.closetW / 2, 0, hw - 0.02, d.nicheX + d.closetW / 2, d.closetH, hw + d.nicheDepth];
        const t = rayBox(g.ox, g.oy, g.oz, g.dx, g.dy, g.dz, box);
        if (t !== null && t < this.reach && (!best || t < best.t)) best = { site: c.site, t };
      }
      return best;
    }

    /**
     * Stands the reader in front of a book of the hexagon in cell (ch, cf), facing it.
     */
    faceBook(ch, cf, wall, shelf, volume) {
      const d = this.d;
      this._arrive(ch, cf);
      const j = d.shelvedSides[wall], phi = (j * Math.PI) / 3 + this.roomTurn();
      const nx = Math.cos(phi), nz = Math.sin(phi), tx = Math.sin(phi), tz = -Math.cos(phi);
      let xc = d.bookX(volume);
      const r = Math.max(d.aIn - 0.6, d.shaftA + 0.07 + this.radius + 0.03);
      // books near a corner are seen from a little way along the wall
      let x = 0, z = 0;
      for (let k = 0; k < 20; k++) {
        x = nx * r + tx * xc; z = nz * r + tz * xc;
        if (this.ground(x, z, 0) === 0) break;
        xc *= 0.85;
      }
      this.x = x; this.y = 0; this.z = z;
      const bookX = nx * (d.aIn + 0.03) + tx * d.bookX(volume);
      const bookZ = nz * (d.aIn + 0.03) + tz * d.bookX(volume);
      const bookY = d.base + (d.shelves - 1 - shelf) * d.pitch + d.board + d.bookH / 2;
      const dx = bookX - x, dz = bookZ - z;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = Math.atan2(bookY - this.eyeHeight(), Math.hypot(dx, dz));
      this._applyCamera(0, 0);
    }

    /** Places the reader in the passage of hexagon (ch, cf), a step from its painting, looking at it. */
    facePainting(ch, cf) {
      const d = this.d, p = d.painting;
      if (!p) { this.placeAtStart(ch, cf); return; }
      this._arrive(ch, cf);
      const back = Math.min(1.3, d.hallW - 0.25 - this.radius); // across the passage
      // in the passage's frame, the painting hangs on its north wall (+z), on the right as one leaves the hexagon
      const t = this.roomTurn() + d.passageTurn, c = Math.cos(t), s = Math.sin(t), hx = p.x, hz = p.z - back;
      this.x = hx * c - hz * s; this.y = 0; this.z = hx * s + hz * c;
      this.yaw = yawOf(t + Math.PI / 2);
      this.pitch = Math.atan2(p.y - this.eyeHeight(), back);
      this._rebase();
      this._applyCamera(0, 0);
    }

    /** Height on the spiral stair (continuous ramp), choosing the turn nearest to y. */
    _stair(hx, z, y) {
      const d = this.d, r = this.radius;
      const dx = hx, dz = z; // (about the hub's middle)
      const dist = Math.hypot(dx, dz);
      if (dist < d.colR + r || hexDist(dx, dz) > d.stairA - r) return null; // between the column and the treads' outer ends
      const th = Math.atan2(dz, dx);
      let u = (th - d.stairStart) % TAU;
      if (u < 0) u += TAU;
      const s = u < d.stairSweep ? (d.Hf * u) / d.stairSweep : d.Hf; // landing sits at a whole storey
      const k = Math.round((y - s) / d.Hf);
      return s + k * d.Hf;
    }

    /* ---------------- off the ground ---------------- */

    /** How tall the reader is, standing or crouched: from their feet to the top of their head. */
    bodyHeight() { return this.eyeHeight() + 0.12; }

    /**
     * The shaft at (x, z), if the reader is in one or at its edge: { hub (whether it is a stair's),
     * hd (how far from its middle, as an apothem), ox, oz (the way out of it, towards its floor),
     * side (the side of the shaft they are by, 0 to 5) }, or null.
     */
    _shaftAt(x, z) {
      const d = this.d, r = this.radius, A = this.around(), I = Babel.Architecture.intoFrame;
      const out = (dx, dz, hub, hd, th) => {
        const n = Math.hypot(dx, dz) || 1;
        const side = (((Math.round(th / (Math.PI / 3)) % 6) + 6) % 6);
        return { hub, hd, ox: dx / n, oz: dz / n, side };
      };
      for (const c of A.cells) {
        const [hx, hz] = I(c.frame, x, z), hd = hexDist(hx, hz);
        if (hd < d.shaftA + 0.07 + r) return out(x - c.frame.x, z - c.frame.z, false, hd, 0);
      }
      for (const h of A.hubs) {
        const ux = x - h.x, uz = z - h.z, hd = hexDist(ux, uz);
        if (hd < d.shaftA + 0.07 + r) return out(ux, uz, true, hd, Math.atan2(uz, ux));
      }
      return null;
    }

    /** The heights of the stair's treads over (ux, uz) from a hub's middle: the one at or just under y, and the storey to the next. */
    _treadUnder(ux, uz, y) {
      const d = this.d;
      let u = (Math.atan2(uz, ux) - d.stairStart) % TAU;
      if (u < 0) u += TAU;
      const base = u < d.stairSweep ? (d.Hf * u) / d.stairSweep : d.Hf;
      return base + Math.floor((y + 0.05 - base) / d.Hf) * d.Hf;
    }

    /**
     * Whether the reader fits at (x, z) with their feet at height y (from floor cf: any height, any
     * floor): clear of walls, ceilings, the edges of the floors round a shaft and their railings,
     * and the stair's treads. Each floor is like the others, so only y's place in its storey counts.
     */
    _fits(x, z, y) {
      const d = this.d, r = this.radius, H = d.Hf;
      const yl = y - Math.floor(y / H) * H, top = yl + this.bodyHeight();
      const ceiling = this._floorAt(x, z);
      if (ceiling !== null) return top <= ceiling + 1e-6; // over a floor, under its ceiling
      const sh = this._shaftAt(x, z);
      if (!sh) return false; // in a wall
      if (sh.hub) {
        const h = this.around().hubs.find((k) => hexDist(x - k.x, z - k.z) < d.shaftA + 0.07 + r);
        const ux = x - h.x, uz = z - h.z;
        if (Math.hypot(ux, uz) < d.colR + r) return false; // the column
        // over the treads: above the one under the feet, and under the one a storey higher
        if (sh.hd <= d.stairA + 0.05 && y + this.bodyHeight() > this._treadUnder(ux, uz, y) + H - 0.3) return false;
        if (sh.hd + r <= d.shaftA || sh.side === d.landingSide) return true; // clear of the edge (or where the landing runs on)
        if (sh.side === (d.landingSide + 1) % 6) return yl <= d.roomH && top <= d.roomH; // the edge without a railing
        return yl >= d.railH && top <= d.roomH;
      }
      // a shaft among the hexagons of books: open, but at its edge, where each floor's slab and
      // the railing on it stand, only between the railing's top and the slab above
      if (sh.hd + r <= d.shaftA) return true;
      return yl >= d.railH && top <= d.roomH;
    }

    /** The highest thing to stand on under (x, z), at or just under height y: a floor, or a tread of a stair; −Infinity down a shaft. */
    _support(x, z, y) {
      const d = this.d, H = d.Hf;
      const floor = Math.floor((y + 1e-4) / H) * H;
      if (this._floorAt(x, z) !== null) return floor;
      const sh = this._shaftAt(x, z);
      if (!sh) return floor;
      if (sh.hub && sh.hd <= d.stairA + 0.05) {
        const h = this.around().hubs.find((k) => hexDist(x - k.x, z - k.z) < d.shaftA + 0.07 + this.radius);
        return this._treadUnder(x - h.x, z - h.z, y);
      }
      return sh.hd >= d.shaftA + 0.035 ? floor : -Infinity; // beyond the railing, its floor
    }

    /** Where the reader can walk to (x, z) from height y: the height they would stand at, or null. */
    _walkable(x, z, y) {
      const g = this.ground(x, z, y);
      if (g !== null) return g;
      // the very edge of a floor or a stair's tread, where the reader still fits
      if (!this._fits(x, z, y)) return null;
      const s = this._support(x, z, y);
      return s >= y - 0.35 && s <= y + 0.05 ? s : null;
    }

    /** Leaves the ground, moving at (vx, vz) along it and vy up. */
    _takeOff(vx, vy, vz) {
      this.air = { vx, vy, vz, t: 0, cap: Math.max(Math.hypot(vx, vz), AIR.drift) };
    }

    /** Back on the ground, met at `speed` metres a second: the knees give a little, the harder the further. */
    _land(speed) {
      this.air = null;
      const depth = Math.max(0, Math.min(1, (speed - 2.5) / 9));
      if (speed > 2.5) this.landing = { t: 0, depth: 0.25 + 0.75 * depth };
    }

    /**
     * Moves the reader through the air for dt seconds: gravity, the way they were going, and a
     * little steering (f forward, s sideways, each −1 to 1). Landing on a floor or a tread ends it.
     */
    _fly(dt, f, s) {
      const a = this.air, d = this.d;
      a.t += dt;
      // steering: slow, and never faster than the reader left the ground (or than a slow drift)
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      a.vx += (-sy * f + cy * s) * AIR.steer * dt;
      a.vz += (-cy * f - sy * s) * AIR.steer * dt;
      const h = Math.hypot(a.vx, a.vz);
      if (h > a.cap) { a.vx *= a.cap / h; a.vz *= a.cap / h; }
      a.vy = Math.max(a.vy - AIR.gravity * dt, -AIR.terminal);
      const steps = Math.max(1, Math.ceil((Math.max(h, Math.abs(a.vy)) * dt) / 0.04));
      for (let i = 0; i < steps && this.air; i++) {
        const ddx = (a.vx * dt) / steps, ddz = (a.vz * dt) / steps, ddy = (a.vy * dt) / steps;
        // along: blocked by what it meets, sliding along it (the way they were going is kept, so
        // that past a railing's top, or below a floor's edge, they go on)
        if (this._fits(this.x + ddx, this.z + ddz, this.y)) { this.x += ddx; this.z += ddz; }
        else if (this._fits(this.x + ddx, this.z, this.y)) this.x += ddx;
        else if (this._fits(this.x, this.z + ddz, this.y)) this.z += ddz;
        // up or down
        if (ddy > 0) {
          if (this._fits(this.x, this.z, this.y + ddy)) this.y += ddy;
          else a.vy = 0; // the head meets a ceiling
        } else {
          const ground = this._support(this.x, this.z, this.y);
          if (this.y + ddy <= ground) {
            this.y = ground;
            this._land(-a.vy);
          } else if (this._fits(this.x, this.z, this.y + ddy)) this.y += ddy;
          else {
            // the feet meet the top of a railing (or the edge of a floor): the reader rests on it a
            // moment and slips off, onto the floor if they were going that way or are already over
            // it, or else back into the shaft
            if (a.vy < -6) this.landing = { t: 0, depth: Math.min(1, (-a.vy - 2.5) / 9) * 0.6 };
            a.vy = 0;
            const sh = this._shaftAt(this.x, this.z);
            if (sh) {
              const onward = a.vx * sh.ox + a.vz * sh.oz > 0 || sh.hd > d.shaftA + 0.035 || !this._fits(this.x - sh.ox * 0.05, this.z - sh.oz * 0.05, this.y);
              const k = onward ? 1 : -1, along = Math.max(AIR.slip, Math.abs(a.vx * sh.ox + a.vz * sh.oz));
              a.vx = k * sh.ox * along; a.vz = k * sh.oz * along;
              a.cap = Math.max(a.cap, along);
            }
          }
        }
        this._rebase();
      }
    }

    /* ---------------- update ---------------- */

    update(dt) {
      if (!this.enabled) { this._applyCamera(dt, 0); return; }
      const K = this.keys;
      let f = 0, s = 0;
      if (K.has('KeyW') || K.has('ArrowUp')) f += 1;
      if (K.has('KeyS') || K.has('ArrowDown')) f -= 1;
      if (K.has('KeyD')) s += 1;
      if (K.has('KeyA')) s -= 1;
      if (K.has('ArrowLeft')) this.yaw += 1.6 * dt;
      if (K.has('ArrowRight')) this.yaw -= 1.6 * dt;
      const m = this.touch.move;
      if (m) {
        const tx = (m.x - m.x0) / 60, ty = (m.y - m.y0) / 60;
        s += Math.max(-1, Math.min(1, tx));
        f += Math.max(-1, Math.min(1, -ty));
      }
      let len = Math.hypot(f, s);
      if (len > 1) { f /= len; s /= len; len = 1; }
      if (this.landing && (this.landing.t += dt) > LANDING) this.landing = null;
      // in the air, the reader falls, steering a little
      if (this.air) {
        this._jumpAt = -1;
        this._fly(dt, f, s);
        this._applyCamera(dt, 0);
        return;
      }
      // crouched, the reader shuffles slowly, and cannot hurry; landing hard, they take a moment
      // to find their feet
      let run = this.crouch > 0.5 ? 0.5 : K.has('ShiftLeft') || K.has('ShiftRight') || this.capsLock ? 1.9 : 1;
      if (this.landing) run *= 1 - 0.7 * this.landing.depth * (1 - this.landing.t / LANDING);
      const v = this.speed * run;
      // forward is −z rotated by yaw
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const vx = (-sy * f + cy * s) * v, vz = (-cy * f - sy * s) * v;
      // the space bar (pressed just now, or a moment before landing) jumps
      if (this._jumpAt >= 0 && performance.now() - this._jumpAt < 150 && (!this.landing || this.landing.t > 0.2)) {
        this._jumpAt = -1;
        this._takeOff(vx, Math.sqrt(2 * AIR.gravity * AIR.jump), vz);
        this._fly(dt, 0, 0);
        this._applyCamera(dt, 0);
        return;
      }
      let moved = 0;
      const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.04));
      // with nothing underfoot (a floor's edge, a tread walked off, a place arrived at in the
      // air), the reader falls; and if they are somehow standing where nobody can stand, they
      // are let walk out
      const here = this._walkable(this.x, this.z, this.y);
      if (here === null && this._fits(this.x, this.z, this.y)) {
        this._takeOff(vx, 0, vz);
        this._fly(dt, 0, 0);
        this._applyCamera(dt, 0);
        return;
      }
      const stuck = here === null;
      for (let i = 0; i < steps; i++) {
        const ddx = (vx * dt) / steps, ddz = (vz * dt) / steps;
        const ox = this.x, oz = this.z;
        let g = this._walkable(this.x + ddx, this.z + ddz, this.y);
        if (stuck && g === null) { this.x += ddx; this.z += ddz; }
        else if (g !== null) { this.x += ddx; this.z += ddz; this.y = g; }
        else if (this._fits(this.x + ddx, this.z + ddz, this.y) && this._support(this.x + ddx, this.z + ddz, this.y) < this.y - 0.35) {
          // over an edge, with nothing to stop the reader: off it, at the pace they were walking
          this.x += ddx; this.z += ddz;
          this._takeOff(vx, 0, vz);
          moved += Math.hypot(this.x - ox, this.z - oz);
          this._rebase();
          break;
        }
        else if ((g = this._walkable(this.x + ddx, this.z, this.y)) !== null) { this.x += ddx; this.y = g; }
        else if ((g = this._walkable(this.x, this.z + ddz, this.y)) !== null) { this.z += ddz; this.y = g; }
        moved += Math.hypot(this.x - ox, this.z - oz);
        this._rebase();
      }
      this._applyCamera(dt, moved);
    }

    _rebase() {
      const d = this.d;
      // into the next site, once past the middle of the vestibule that leads to it
      for (const n of this.around().doors) {
        if ((this.x * n.x + this.z * n.z) / d.Dx > d.Dx / 2) {
          this.x -= n.x; this.z -= n.z;
          this.site += n.step;
          this.kind = this.kindOf(this.site);
          break;
        }
      }
      this._home();
      while (this.y > d.Hf / 2) { this.y -= d.Hf; this.cf += 1; }
      while (this.y < -d.Hf / 2) { this.y += d.Hf; this.cf -= 1; }
    }

    /** The height of the reader's eyes above the floor, standing or crouched. */
    eyeHeight() {
      const d = this.d, k = this.crouch * this.crouch * (3 - 2 * this.crouch);
      return d.eye + (d.crouchEye - d.eye) * k;
    }

    /** How far the eyes are lowered by the landing being recovered from: quickly down, slowly up. */
    _landingDip() {
      const L = this.landing;
      if (!L) return 0;
      const down = 0.1, t = L.t, k = t < down ? Math.sin((t / down) * Math.PI / 2) : 1 - smoothstep((t - down) / (LANDING - down));
      return L.depth * 0.55 * (this.d.eye - this.d.crouchEye) * k;
    }

    _applyCamera(dt, moved) {
      // crouching down, or standing up, takes about a third of a second
      const goal = this.crouching ? 1 : 0;
      if (dt > 0) this.crouch += Math.sign(goal - this.crouch) * Math.min(Math.abs(goal - this.crouch), dt / 0.32);
      this.bob += moved * 5.2;
      const bobY = moved > 0 ? Math.sin(this.bob) * 0.018 : 0;
      this.camera.position.set(this.x, this.y + this.eyeHeight() - this._landingDip() + bobY, this.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }

    /* ---------------- gaze ---------------- */

    /** Which book the reader is looking at, if any: { site, wall, shelf, volume, slot, t }. */
    pick(lib) {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      let best = null;
      for (const c of this.cells()) {
        const g = this._gaze(c.frame), ox = g.ox, oz = g.oz, dir = { x: g.dx, y: g.dy, z: g.dz };
        if (hexDist(ox, oz) > d.aIn + 0.5) continue;
        for (let w = 0; w < d.walls; w++) {
          const j = d.shelvedSides[w], phi = (j * Math.PI) / 3;
          const nx = Math.cos(phi), nz = Math.sin(phi);
          const denom = nx * dir.x + nz * dir.z;
          if (denom <= 1e-4) continue;
          const plane = d.aIn + 0.03;
          const t = (plane - (nx * ox + nz * oz)) / denom;
          if (t <= 0 || t > this.reach || (best && t >= best.t)) continue;
          const px = ox + dir.x * t, py = g.oy + dir.y * t, pz = oz + dir.z * t;
          const xc = px * Math.sin(phi) - pz * Math.cos(phi); // canonical x along the wall
          const volume = d.volumeAt(xc);
          if (volume < 0) continue;
          const i = Math.floor((py - d.base) / d.pitch);
          if (i < 0 || i >= d.shelves) continue;
          const yb = d.base + i * d.pitch + d.board;
          if (py < yb || py > yb + d.bookH) continue;
          const shelf = d.shelves - 1 - i;
          best = { site: c.site, wall: w, shelf, volume, slot: lib.slotOf(w, shelf, volume), t };
        }
      }
      return best;
    }

    /** Plain-words description of where the reader is relative to the waking hexagon. `whereOf(site)`: its cluster, counted from the waking one. */
    whereabouts() {
      const at = this.whereOf ? this.whereOf(this.ch) : { east: 0, south: 0 }, f = this.cf;
      const n = (k, one, many) => `${Math.abs(k).toLocaleString('en')} ${Math.abs(k) === 1 ? one : many}`;
      const parts = [];
      if (at.east) parts.push(`${n(at.east, 'cluster', 'clusters')} ${at.east > 0 ? 'east' : 'west'}`);
      if (at.south) parts.push(`${n(at.south, 'row', 'rows')} ${at.south > 0 ? 'south' : 'north'}`);
      if (f) parts.push(`${n(f, 'floor', 'floors')} ${f > 0 ? 'up' : 'down'}`);
      const verb = this.origin || 'woke';
      const list = parts.length < 3 ? parts.join(' and ') : `${parts[0]}, ${parts[1]} and ${parts[2]}`;
      if (parts.length) return { short: `${list} from where you ${verb}`, sentence: `You are ${list} from where you ${verb}.` };
      if (this.ch !== 0) return { short: `The cluster where you ${verb}`, sentence: `You are in the cluster of hexagons where you ${verb}, in another of its hexagons.` };
      return { short: `The hexagon where you ${verb}`, sentence: `You are in the hexagon where you ${verb}.` };
    }
  }

  Babel.Player = Player;
})();
