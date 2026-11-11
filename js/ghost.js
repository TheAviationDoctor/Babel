/*
 * Other librarians, glimpsed. Now and then, while the reader is in a hexagon, a figure in a
 * habit like theirs appears across the shaft: pale, a little translucent, seen only through the
 * shaft. Perhaps they are only images of librarians of other times, with no part in the
 * present; and perhaps, to some reader yet to come, the reader is one of them.
 *
 * - Above: a librarian stands at the railing of a floor above, looking down into the shaft.
 *   Looked at for long, it slowly raises its hood towards the reader, then fades.
 * - Below: a librarian stands at a bookcase of a floor below, its back to the shaft, browsing
 *   the shelves: its hood moves along the books, now and then it steps along to others. It
 *   never looks up. Looked at for long, it fades.
 *
 * Looked away from, either is gone; and neither is there when the reader gets there, since
 * they leave as soon as the reader makes for the stairs or another hexagon. Each comes about
 * once every few minutes spent in the hexagons, never where the reader is already looking,
 * and goes unseen if the reader does not look up, or lean over the railing and look down.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const SQ3 = Math.sqrt(3);

  const MEAN_WAIT = 150; // seconds in the hexagons, on average, between two librarians above; as many below
  const UNSEEN_FOR = 90; // seconds a librarian waits to be seen
  const GAZE = 9; // seconds it bears being looked at before it fades
  const FADE = 3;

  /** Distance from the centre of a hexagon in its own measure: the apothem of the hexagon through (x, z). */
  const hexDist = (x, z) => Math.max(Math.abs(x), Math.abs(x / 2 + (z * SQ3) / 2), Math.abs(x / 2 - (z * SQ3) / 2));
  /** A wait drawn so that, on average, it lasts `mean` seconds. */
  const wait = (mean) => -Math.log(1 - Math.random() * 0.999) * mean;
  /** The angle between two directions, from 0 to π. */
  const apart = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  /** The figure of the mirrors, made of mist: pale, brighter at its edges, translucent. */
  function make() {
    const figure = Babel.Figure.make();
    const mist = (colour, strength) => new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uColour: { value: new THREE.Color(colour[0], colour[1], colour[2]) },
        uOpacity: { value: 1 },
        uStrength: { value: strength },
      }]),
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        #include <fog_pars_vertex>
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uColour;
        uniform float uOpacity;
        uniform float uStrength;
        varying vec3 vNormal;
        varying vec3 vView;
        #include <fog_pars_fragment>
        void main() {
          float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
          float alpha = uOpacity * uStrength * (0.08 + 0.92 * pow(rim, 2.2));
          gl_FragColor = vec4(uColour * (0.55 + 0.6 * rim), alpha);
          #include <fog_fragment>
          #ifdef USE_FOG
            gl_FragColor.a *= 1.0 - fogFactor;
          #endif
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    const pale = mist([0.6, 0.63, 0.66], 0.42), hollow = mist([0.01, 0.01, 0.015], 0.55);
    figure.traverse((o) => {
      if (!o.isMesh) return;
      // the dark of the hood and the cuffs stays dark; the rest is mist
      const dark = o.material.color && o.material.color.getHex() <= 0x0b0806;
      o.material = dark ? hollow : pale;
      o.renderOrder = dark ? 3 : 2; // the hollow of the hood over the mist of it
    });
    figure.userData.head.rotation.order = 'YXZ'; // the hood turns, then bows or rises
    figure.userData.materials = [pale, hollow];
    figure.visible = false;
    return figure;
  }

  /** One librarian at a time, on the floors above the reader's (`below` false) or on those below. */
  class Apparition {
    constructor(scene, dims, below) {
      this.scene = scene;
      this.d = dims;
      this.below = below;
      this.figure = null; // made the first time a librarian comes
      this.here = null; // the librarian now there, if any
      this.wait = wait(MEAN_WAIT);
      this._v = new THREE.Vector3();
      this._m = [new THREE.Vector3(), new THREE.Vector3()];
    }

    /**
     * Where a librarian might stand, `floors` floors up or down (1 to 3 up, 1 or 2 down).
     * Above: at the railing, across the shaft from the reader, or at angle `at` round it.
     * Below: before a bookcase across the shaft, or that of side `at`, facing the books.
     */
    _place(player, floors, at) {
      const d = this.d, across = Math.atan2(player.z, player.x) + Math.PI;
      if (!this.below) {
        const k = floors || (Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3);
        const a = at !== undefined ? at : across + (Math.random() - 0.5) * 1.3;
        const s = (d.shaftA + 0.36) / hexDist(Math.cos(a), Math.sin(a)); // just behind the railing
        const x = Math.cos(a) * s, z = Math.sin(a) * s;
        return { k, x, z, yaw: Math.atan2(x, z), pitch: -0.42 }; // facing the middle of the shaft (the figure faces −z), looking down
      }
      const k = -(floors || (Math.random() < 0.75 ? 1 : 2));
      let j = at;
      if (j === undefined) {
        // the bookcase across the shaft, or now and then one beside it
        const sides = d.shelvedSides.filter((s) => apart((s * Math.PI) / 3, across) < 1.9);
        if (!sides.length) return null;
        sides.sort((p, q) => apart((p * Math.PI) / 3, across) - apart((q * Math.PI) / 3, across));
        j = sides[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * sides.length)];
      }
      const phi = (j * Math.PI) / 3, nx = Math.cos(phi), nz = Math.sin(phi);
      const reach = Math.max(0, d.shelfLen / 2 - 0.35);
      return {
        k, side: j, nx, nz, reach,
        along: (Math.random() * 2 - 1) * reach, // from the middle of the bookcase
        yaw: Math.atan2(-nx, -nz) + (Math.random() - 0.5) * 0.4, // facing the books, give or take
        pitch: -0.1,
      };
    }

    /** Sets the figure where the librarian stands. */
    _stand() {
      const h = this.here, d = this.d, f = this.figure;
      if (this.below) {
        const r = d.aIn - 0.42; // a step back from the shelves
        h.x = h.nx * r - h.nz * h.along; // and along the bookcase
        h.z = h.nz * r + h.nx * h.along;
      }
      f.position.set(h.x, h.k * d.Hf, h.z);
    }

    /**
     * Sets a librarian `floors` floors above or below the reader, across the shaft from them,
     * or at `at` (see _place). Returns whether one came: never where the reader is already
     * looking, nor, below, where they could not see it from the railing.
     */
    spawn(player, camera, floors, at) {
      if (!this.figure) { this.figure = make(); this.scene.add(this.figure); }
      const forced = at !== undefined;
      for (let tries = forced ? 1 : 4; tries > 0; tries--) {
        const p = this._place(player, tries === 1 && !forced && this.below ? 1 : floors, at);
        if (!p) break;
        this.here = Object.assign(p, {
          ch: player.ch, cf: player.cf, age: 0, seen: 0, unseen: 0, looked: false, fade: 1,
          sway: Math.random() * 10, rest: 4 + Math.random() * 8, goal: null,
        });
        this.here.goal = this.here.along;
        this._stand();
        const f = this.figure;
        f.rotation.set(0, this.here.yaw, 0);
        f.userData.head.rotation.set(this.here.pitch, 0, 0);
        this._setFade(1);
        f.visible = true;
        if (forced) return true;
        if (this.inSight(player, camera)) break; // never where the reader is looking
        if (!this.below || this.seeable(player)) return true;
      }
      this.leave();
      return false;
    }

    leave() {
      this.here = null;
      if (this.figure) this.figure.visible = false;
    }

    _setFade(t) {
      for (const m of this.figure.userData.materials) m.uniforms.uOpacity.value = t;
    }

    /** Whether the line from `e` to `p` goes through the holes of the shaft in every floor between. */
    _clear(e, p) {
      const h = this.here, d = this.d;
      for (let j = 1; j <= Math.abs(h.k); j++) {
        const top = h.k > 0 ? j * d.Hf : -(j - 1) * d.Hf; // the floors on the way up, or the reader's and those on the way down
        for (const level of [top, top - d.slabT]) {
          const t = (level - e.y) / (p.y - e.y);
          if (t <= 0 || t >= 1) return false;
          if (hexDist(e.x + (p.x - e.x) * t, e.z + (p.z - e.z) * t) > d.shaftA - 0.03) return false;
        }
      }
      return true;
    }

    /** The librarian's chest and hood. */
    _marks() {
      const h = this.here, y = h.k * this.d.Hf;
      this._m[0].set(h.x, y + 1.15, h.z);
      this._m[1].set(h.x, y + 1.5, h.z);
      return this._m;
    }

    /** Whether the reader could see the librarian below by leaning over the railing on their side of the shaft. */
    seeable(player) {
      const d = this.d, a = Math.atan2(player.z, player.x);
      const s = (d.shaftA + 0.07 + 0.24 + 0.02) / hexDist(Math.cos(a), Math.sin(a)); // as close to the railing as a reader gets
      const e = { x: Math.cos(a) * s, y: d.eye, z: Math.sin(a) * s };
      return this._marks().some((p) => this._clear(e, p));
    }

    /** Whether the reader can see the librarian: in their picture, and through the holes of the shaft. */
    inSight(player, camera) {
      const h = this.here, d = this.d;
      if (!h || hexDist(player.x, player.z) > d.aIn) return false; // from a vestibule, walls are in the way
      camera.updateMatrixWorld();
      const e = camera.position;
      for (const p of this._marks()) {
        const v = this._v.copy(p).project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
        if (this._clear(e, p)) return true;
      }
      return false;
    }

    /** Each frame: comes, stays, turns to the reader or browses, fades, or goes. `walking`: the reader is in the Library, not in a book or the catalogue. */
    update(dt, player, camera, walking) {
      const d = this.d;
      const inHexagon = hexDist(player.x, player.z) < d.aIn && Math.abs(player.y) < 0.3;
      if (!this.here) {
        if (!walking || !inHexagon) return;
        this.wait -= dt;
        if (this.wait > 0) return;
        this.wait = this.spawn(player, camera) ? wait(MEAN_WAIT) : 5;
        return;
      }
      const h = this.here, f = this.figure, hr = f.userData.head.rotation;
      // gone as soon as the reader makes for another floor or another hexagon
      if (player.ch !== h.ch || player.cf !== h.cf || !walking) { this.leave(); return; }
      h.age += dt;
      h.sway += dt;
      const seen = this.inSight(player, camera);
      if (seen) { h.seen += dt; h.unseen = 0; if (h.seen > 0.5) h.looked = true; }
      else { h.unseen += dt; h.seen = 0; }
      if ((h.looked && h.unseen > 0.8) || (!h.looked && h.age > UNSEEN_FOR && !seen)) { this.leave(); return; }
      if (this.below) this._browse(dt);
      else if (h.seen > 2) {
        // looked at, it slowly turns its hood to the reader
        const cam = camera.position, head = 1.5 + h.k * d.Hf;
        let dy = Math.atan2(h.x - cam.x, h.z - cam.z) - h.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        h.yaw += dy * Math.min(1, dt * 0.35);
        const pitch = Math.atan2(cam.y - head, Math.hypot(cam.x - h.x, cam.z - h.z));
        hr.x += (clamp(pitch, -0.6, 0.3) - hr.x) * Math.min(1, dt * 0.5);
      }
      // looked at for long, it fades
      if (h.seen > GAZE) {
        h.fade = Math.max(0, h.fade - dt / FADE);
        if (h.fade === 0) { this.leave(); return; }
      }
      f.rotation.set(0, h.yaw, Math.sin(h.sway * 0.7) * 0.012);
      this._setFade(h.fade * (0.9 + 0.1 * Math.sin(h.sway * 1.7)));
    }

    /** Below, heedless of the reader: the hood wanders along the books, and now and then the librarian moves along to others. */
    _browse(dt) {
      const h = this.here, hr = this.figure.userData.head.rotation, t = h.sway;
      hr.y = 0.28 * Math.sin(t * 0.21) + 0.1 * Math.sin(t * 0.53 + 1.3);
      hr.x = -0.12 + 0.2 * Math.sin(t * 0.13 + 0.7) + 0.06 * Math.sin(t * 0.41);
      if (h.goal === h.along) {
        h.rest -= dt;
        if (h.rest <= 0) {
          const step = (0.2 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1);
          h.goal = clamp(h.along + (Math.abs(h.along + step) > h.reach ? -step : step), -h.reach, h.reach);
          h.rest = 6 + Math.random() * 12;
        }
        return;
      }
      const left = h.goal - h.along, v = Math.min(Math.abs(left), dt * 0.18 * clamp(Math.abs(left) / 0.1, 0.25, 1));
      h.along = Math.abs(left) <= v ? h.goal : h.along + Math.sign(left) * v;
      this._stand();
    }
  }

  /** The librarians of the floors above and of those below, each coming in its own time. */
  class Ghost {
    constructor(scene, dims) {
      this.above = new Apparition(scene, dims, false);
      this.below = new Apparition(scene, dims, true);
    }

    update(dt, player, camera, walking) {
      this.above.update(dt, player, camera, walking);
      this.below.update(dt, player, camera, walking);
    }
  }

  Babel.Ghost = Ghost;
})();
