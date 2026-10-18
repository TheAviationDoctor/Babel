/*
 * The reader: first-person movement, the spiral stair, and the gaze that picks a book.
 *
 * Position is kept relative to the current cell (cg, cf): x along the gallery,
 * y height above this floor, z across. Crossing half a cell east or west, or half
 * a storey up or down, moves the reader into the neighbouring cell.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const SQ3 = Math.sqrt(3);
  const TAU = Math.PI * 2;

  function hexDist(x, z) {
    return Math.max(Math.abs(x), Math.abs(x / 2 + (z * SQ3) / 2), Math.abs(x / 2 - (z * SQ3) / 2));
  }

  class Player {
    constructor(dims, camera, dom) {
      this.d = dims;
      this.camera = camera;
      this.dom = dom;
      this.radius = 0.24;
      this.cg = 0; this.cf = 0;
      this.x = 0; this.y = 0; this.z = 0;
      this.yaw = 0; this.pitch = 0;
      this.speed = 1.35;
      this.keys = new Set();
      this.sensitivity = 1;
      this.bob = 0;
      this.enabled = false;
      this.touch = { move: null, look: null };
      this.reach = 2.1;
      this._ray = { o: new THREE.Vector3(), d: new THREE.Vector3() };
      this._bindInput();
    }

    /** Places the reader on the walkway of the current hexagon, facing along the gallery. */
    placeAtStart() {
      const d = this.d;
      const mid = (d.shaftA + d.aIn) / 2;
      this.x = -mid * 0.95; this.y = 0; this.z = 0.0;
      this.yaw = -Math.PI / 2 + 0.55; // looking east across the shaft, towards a wall of books
      this.pitch = -0.08;
      this.cg = 0; this.cf = 0;
    }

    /* ---------------- input ---------------- */

    _bindInput() {
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => this.keys.clear());
      document.addEventListener('mousemove', (e) => {
        if (!this.enabled) return;
        if (document.pointerLockElement === this.dom || this._dragging) {
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
        }
        const w = this._stair(hx, z, y);
        if (w !== null) return w;
      }
      return null;
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
      const run = K.has('ShiftLeft') || K.has('ShiftRight') ? 1.9 : 1;
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
      if (this.x > d.Dx / 2) { this.x -= d.Dx; this.cg += 1; }
      else if (this.x < -d.Dx / 2) { this.x += d.Dx; this.cg -= 1; }
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
      const g = this.cg, f = this.cf;
      const n = (k, one, many) => `${Math.abs(k).toLocaleString('en')} ${Math.abs(k) === 1 ? one : many}`;
      const parts = [];
      if (g) parts.push(`${n(g, 'hexagon', 'hexagons')} ${g > 0 ? 'east' : 'west'}`);
      if (f) parts.push(`${n(f, 'floor', 'floors')} ${f > 0 ? 'up' : 'down'}`);
      return parts.length ? { short: parts.join(' and ') + ' from where you woke', sentence: 'You are ' + parts.join(' and ') + ' from where you woke.' }
        : { short: 'The hexagon where you woke', sentence: 'You are in the hexagon where you woke.' };
    }
  }

  Babel.Player = Player;
})();
