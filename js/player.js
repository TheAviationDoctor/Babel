/*
 * The reader: first-person movement, the spiral stair, and the gaze that picks a book.
 *
 * Position is kept relative to the current cell (ch, cf): x along the floor (east),
 * y height above this floor, z across. Crossing half a cell east or west, or half
 * a storey up or down, moves the reader into the neighbouring cell.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const SQ3 = Math.sqrt(3);
  const TAU = Math.PI * 2;

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

  function hexDist(x, z) {
    return Math.max(Math.abs(x), Math.abs(x / 2 + (z * SQ3) / 2), Math.abs(x / 2 - (z * SQ3) / 2));
  }

  class Player {
    constructor(dims, camera, dom) {
      this.d = dims;
      this.camera = camera;
      this.dom = dom;
      this.radius = 0.24;
      this.ch = 0; this.cf = 0;
      this.x = 0; this.y = 0; this.z = 0;
      this.yaw = 0; this.pitch = 0;
      this.speed = 1.35;
      this.capsLock = false;
      this.keys = new Set();
      this.sensitivity = 1;
      this.bob = 0;
      this.enabled = false;
      this.touch = { move: null, look: null };
      this.reach = 2.1;
      this._ray = { o: new THREE.Vector3(), d: new THREE.Vector3() };
      this._bindInput();
    }

    /** Places the reader on the walkway of hexagon (ch, cf) (by default the anchor), looking across the shaft. */
    placeAtStart(ch, cf) {
      const d = this.d;
      const mid = (d.shaftA + d.aIn) / 2;
      this.x = -mid * 0.95; this.y = 0; this.z = 0.0;
      this.yaw = -Math.PI / 2 + 0.55; // looking east across the shaft, towards a wall of books
      this.pitch = -0.08;
      this.ch = ch || 0; this.cf = cf || 0;
    }

    /* ---------------- input ---------------- */

    _bindInput() {
      // Caps Lock, while on, makes the reader hurry as Shift does. Browsers only say whether it
      // is on as part of a key or mouse event, so every such event is asked.
      const caps = (e) => { if (e.getModifierState) this.capsLock = e.getModifierState('CapsLock'); };
      window.addEventListener('keydown', (e) => {
        caps(e);
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => { caps(e); this.keys.delete(e.code); });
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
              if (slot === 'look' && performance.now() - s.t0 < 250 && Math.hypot(s.x - s.x0, s.y - s.y0) < 12 && this.onTap) this.onTap();
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

    look(dx, dy) {
      const k = 0.0022 * this.sensitivity;
      this.yaw -= dx * k;
      this.pitch -= dy * k;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }

    /* ---------------- walkable space ---------------- */

    /** Ground height at (x, z) for a reader currently at height y, or null where one cannot stand. */
    ground(x, z, y) {
      const d = this.d, r = this.radius;
      const onFloor = Math.abs(y) < 0.35;
      if (onFloor) {
        for (const off of [0, d.Dx, -d.Dx]) {
          const hd = hexDist(x - off, z);
          if (hd <= d.aIn - r && hd >= d.shaftA + 0.07 + r) return 0;
        }
      }
      for (const off of [0, -d.Dx]) {
        const hx = x - off;
        if (onFloor) {
          // vestibule, including the passages through the hexagon walls
          if (hx >= d.aIn - r - 0.05 && hx <= d.Dx - d.aIn + r + 0.05 && Math.abs(z) <= d.hallW / 2 - r) return 0;
          // the doorway onto the stair landing
          if (Math.abs(hx - d.wellX) <= d.openW / 2 - r && z >= d.hallW / 2 - r - 0.01 && z <= d.hallW / 2 + 0.5) return 0;
          // the cell behind the south door
          if (this._inCell(hx, z, off === 0 ? 0 : -1)) return 0;
        }
        const w = this._stair(hx, z, y);
        if (w !== null) return w;
      }
      return null;
    }

    /** Whether a reader of this radius fits at (hx, z) in or at the door of a cell. */
    _inCell(hx, z, cellOffset) {
      const d = this.d, r = this.radius;
      const open = this.doorOpen ? this.doorOpen(cellOffset) : false;
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

    /** True if the reader stands where a closing door would sweep. */
    inDoorway(cellOffset) {
      const d = this.d, hx = this.x - cellOffset * d.Dx;
      const dx = hx - d.doorPivot[0], dz = this.z - d.doorPivot[1];
      return Math.abs(this.y) < 0.35 && Math.hypot(dx, dz) < d.closetW + this.radius + 0.05 && hx > d.hingeX - this.radius && hx < d.hingeX + d.closetW + this.radius && this.z < -d.hallW / 2 + this.radius + 0.05;
    }

    /** The cell door the reader is looking at, if within reach: { cellOffset, t }. */
    pickDoor(openness) {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      this.camera.updateMatrixWorld();
      const o = this.camera.position, dir = this._ray.d;
      this.camera.getWorldDirection(dir);
      let best = null;
      for (const off of [0, -1]) {
        const ox = o.x - off * d.Dx;
        const t0 = openness(off);
        const px = d.doorPivot[0], pz = d.doorPivot[1], w = d.closetW;
        const box = t0 < 0.5
          ? [d.hingeX, 0, pz - 0.035, d.hingeX + w, d.closetH, pz + 0.04]
          : [px - 0.04, 0, pz - w, px + 0.04, d.closetH, pz + 0.02];
        const t = rayBox(ox, o.y, o.z, dir.x, dir.y, dir.z, box);
        if (t !== null && t < this.reach && (!best || t < best.t)) best = { cellOffset: off, t };
      }
      return best;
    }

    /**
     * The night lamp the reader is looking at, if within reach: { cellOffset, t }. It can
     * be seen from inside its cell, or from outside through the doorway while the door is open.
     */
    pickLamp(openness) {
      const L = this.d.nightLamp;
      return this._pickInCell([L[0] - 0.14, L[1], L[2] - 0.14, L[0] + 0.14, L[1] + 0.38, L[2] + 0.14], openness);
    }

    /** The bed of the nearest cell, if the reader is looking at it within reach: { cellOffset, t }. */
    pickBed(openness) {
      const B = this.d.bed;
      return this._pickInCell([B.x0, 0, B.z0, B.x1, 0.62, B.z1], openness);
    }

    /**
     * Something in a cell (a box [x0, y0, z0, x1, y1, z1] in the coordinates of the cell
     * beside hexagon 0), seen from inside the cell or through its open door.
     */
    _pickInCell(box, openness) {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      this.camera.updateMatrixWorld();
      const o = this.camera.position, dir = this._ray.d;
      this.camera.getWorldDirection(dir);
      let best = null;
      for (const off of [0, -1]) {
        const ox = o.x - off * d.Dx;
        const t = rayBox(ox, o.y, o.z, dir.x, dir.y, dir.z, box);
        if (t === null || t >= this.reach || (best && t >= best.t)) continue;
        const inside = ox > d.cellX0 && ox < d.cellX1 && o.z < d.cellZ0 && o.z > d.cellZ1;
        if (!inside) {
          if (openness(off) < 0.5 || dir.z >= -1e-6) continue;
          const tw = (d.cellZ0 - o.z) / dir.z; // where the gaze passes through the cell's wall
          const wx = ox + dir.x * tw, wy = o.y + dir.y * tw;
          if (tw < 0 || tw > t || wx < d.hingeX || wx > d.hingeX + d.closetW || wy > d.closetH) continue;
        }
        best = { cellOffset: off, t };
      }
      return best;
    }

    /** The catalogue the reader is looking at, if within reach: { cellOffset, t }. */
    pickTerminal() {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      this.camera.updateMatrixWorld();
      const o = this.camera.position, dir = this._ray.d;
      this.camera.getWorldDirection(dir);
      let best = null;
      const hw = d.hallW / 2;
      for (const off of [0, -1]) {
        const ox = o.x - off * d.Dx;
        const box = [d.closetX - d.closetW / 2, 0, hw - 0.02, d.closetX + d.closetW / 2, d.closetH, hw + d.nicheDepth];
        const t = rayBox(ox, o.y, o.z, dir.x, dir.y, dir.z, box);
        if (t !== null && t < this.reach && (!best || t < best.t)) best = { cellOffset: off, t };
      }
      return best;
    }

    /**
     * Stands the reader in front of a book of the hexagon in cell (ch, cf), facing it.
     */
    faceBook(ch, cf, wall, shelf, volume) {
      const d = this.d;
      const j = d.shelvedSides[wall], phi = (j * Math.PI) / 3;
      const nx = Math.cos(phi), nz = Math.sin(phi), tx = Math.sin(phi), tz = -Math.cos(phi);
      let xc = d.rowLen / 2 - (volume + 0.5) * d.bookT;
      const r = Math.max(d.aIn - 0.6, d.shaftA + 0.07 + this.radius + 0.03);
      // books near a corner are seen from a little way along the wall
      let x = 0, z = 0;
      for (let k = 0; k < 20; k++) {
        x = nx * r + tx * xc; z = nz * r + tz * xc;
        if (this.ground(x, z, 0) === 0) break;
        xc *= 0.85;
      }
      this.ch = ch; this.cf = cf; this.x = x; this.y = 0; this.z = z;
      const bookX = nx * (d.aIn + 0.03) + tx * (d.rowLen / 2 - (volume + 0.5) * d.bookT);
      const bookZ = nz * (d.aIn + 0.03) + tz * (d.rowLen / 2 - (volume + 0.5) * d.bookT);
      const bookY = d.base + (d.shelves - 1 - shelf) * d.pitch + d.board + d.bookH / 2;
      const dx = bookX - x, dz = bookZ - z;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = Math.atan2(bookY - d.eye, Math.hypot(dx, dz));
      this._applyCamera(0, 0);
    }

    /** Height on the spiral stair (continuous ramp), choosing the turn nearest to y. */
    _stair(hx, z, y) {
      const d = this.d, r = this.radius;
      const dx = hx - d.wellX, dz = z - d.wellZ;
      const dist = Math.hypot(dx, dz);
      if (dist < d.colR + r || dist > d.wellR - r) return null;
      if (z < d.hallW / 2 + r) return null;
      const th = Math.atan2(dz, dx);
      let u = (th - d.stairStart) % TAU;
      if (u < 0) u += TAU;
      const s = u < d.stairSweep ? (d.Hf * u) / d.stairSweep : d.Hf; // landing sits at a whole storey
      const k = Math.round((y - s) / d.Hf);
      return s + k * d.Hf;
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
      const run = K.has('ShiftLeft') || K.has('ShiftRight') || this.capsLock ? 1.9 : 1;
      const v = this.speed * run;
      // forward is −z rotated by yaw
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const vx = (-sy * f + cy * s) * v, vz = (-cy * f - sy * s) * v;
      let moved = 0;
      const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.04));
      // If the reader is somehow standing where nobody can stand, let them walk out.
      const stuck = this.ground(this.x, this.z, this.y) === null;
      for (let i = 0; i < steps; i++) {
        const ddx = (vx * dt) / steps, ddz = (vz * dt) / steps;
        const ox = this.x, oz = this.z;
        let g = this.ground(this.x + ddx, this.z + ddz, this.y);
        if (stuck && g === null) { this.x += ddx; this.z += ddz; }
        else if (g !== null) { this.x += ddx; this.z += ddz; this.y = g; }
        else if ((g = this.ground(this.x + ddx, this.z, this.y)) !== null) { this.x += ddx; this.y = g; }
        else if ((g = this.ground(this.x, this.z + ddz, this.y)) !== null) { this.z += ddz; this.y = g; }
        moved += Math.hypot(this.x - ox, this.z - oz);
        this._rebase();
      }
      this._applyCamera(dt, moved);
    }

    _rebase() {
      const d = this.d;
      if (this.x > d.Dx / 2) { this.x -= d.Dx; this.ch += 1; }
      else if (this.x < -d.Dx / 2) { this.x += d.Dx; this.ch -= 1; }
      if (this.y > d.Hf / 2) { this.y -= d.Hf; this.cf += 1; }
      else if (this.y < -d.Hf / 2) { this.y += d.Hf; this.cf -= 1; }
    }

    _applyCamera(dt, moved) {
      this.bob += moved * 5.2;
      const bobY = moved > 0 ? Math.sin(this.bob) * 0.018 : 0;
      this.camera.position.set(this.x, this.y + this.d.eye + bobY, this.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }

    /* ---------------- gaze ---------------- */

    /** Which book the reader is looking at, if any: { off, wall, shelf, volume, slot, t }. */
    pick(lib) {
      const d = this.d;
      if (Math.abs(this.y) > 0.05) return null;
      this.camera.updateMatrixWorld();
      const o = this.camera.position, dir = this._ray.d;
      this.camera.getWorldDirection(dir);
      let best = null;
      for (const off of [0, 1, -1]) {
        const ox = o.x - off * d.Dx, oz = o.z;
        if (hexDist(ox, oz) > d.aIn + 0.5) continue;
        for (let w = 0; w < d.walls; w++) {
          const j = d.shelvedSides[w], phi = (j * Math.PI) / 3;
          const nx = Math.cos(phi), nz = Math.sin(phi);
          const denom = nx * dir.x + nz * dir.z;
          if (denom <= 1e-4) continue;
          const plane = d.aIn + 0.03;
          const t = (plane - (nx * ox + nz * oz)) / denom;
          if (t <= 0 || t > this.reach || (best && t >= best.t)) continue;
          const px = ox + dir.x * t, py = o.y + dir.y * t, pz = oz + dir.z * t;
          const xc = px * Math.sin(phi) - pz * Math.cos(phi); // canonical x along the wall
          if (Math.abs(xc) > d.rowLen / 2) continue;
          const i = Math.floor((py - d.base) / d.pitch);
          if (i < 0 || i >= d.shelves) continue;
          const yb = d.base + i * d.pitch + d.board;
          if (py < yb || py > yb + d.bookH) continue;
          const volume = Math.min(d.books - 1, Math.floor((d.rowLen / 2 - xc) / d.bookT));
          const shelf = d.shelves - 1 - i;
          best = { off, wall: w, shelf, volume, slot: lib.slotOf(w, shelf, volume), t };
        }
      }
      return best;
    }

    /** Plain-words description of where the reader is relative to the waking hexagon. */
    whereabouts() {
      const g = this.ch, f = this.cf;
      const n = (k, one, many) => `${Math.abs(k).toLocaleString('en')} ${Math.abs(k) === 1 ? one : many}`;
      const parts = [];
      if (g) parts.push(`${n(g, 'hexagon', 'hexagons')} ${g > 0 ? 'east' : 'west'}`);
      if (f) parts.push(`${n(f, 'floor', 'floors')} ${f > 0 ? 'up' : 'down'}`);
      const verb = this.origin || 'woke';
      return parts.length ? { short: `${parts.join(' and ')} from where you ${verb}`, sentence: `You are ${parts.join(' and ')} from where you ${verb}.` }
        : { short: `The hexagon where you ${verb}`, sentence: `You are in the hexagon where you ${verb}.` };
    }
  }

  Babel.Player = Player;
})();
