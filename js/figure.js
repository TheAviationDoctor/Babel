/*
 * The reader as the mirrors show them: a librarian in a monk's habit, the hood up and the
 * face lost in its shadow. Only mirrors see it (it lives on layer 1, which only their
 * cameras draw), so it costs nothing to the Library's own picture.
 *
 * All of it is made here at start-up, from a few curves: the habit turned on a lathe and
 * pleated; a short cape over the shoulders, the hood rising from it, pointed at the back;
 * wide sleeves meeting in front over the hidden hands; and a cord for a belt, knotted
 * three times at its hanging end. About 30,000 triangles in a handful of meshes, drawn
 * only into the mirror's picture, which is smaller than the screen's.
 *
 * The figure stands at the origin, its feet at y = 0, facing −z (as the camera does), its
 * right hand towards +x.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const TAU = Math.PI * 2;

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  /** A value along a list of [key, value] pairs, eased between them. */
  function along(pairs, x) {
    if (x <= pairs[0][0]) return pairs[0][1];
    for (let i = 1; i < pairs.length; i++) {
      if (x <= pairs[i][0]) return lerp(pairs[i - 1][1], pairs[i][1], smooth(pairs[i - 1][0], pairs[i][0], x));
    }
    return pairs[pairs.length - 1][1];
  }

  /**
   * A grid of vertices (columns × rows, the first and last columns meeting if `closed`) as
   * a mesh: positions from at(u, v), u and v from 0 to 1. Normals are smoothed across the
   * seam of a closed grid.
   */
  function sheet(cols, rows, at, closed, flip) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const p = at(i / cols, j / rows);
        pos.push(p[0], p[1], p[2]);
        uv.push(i / cols, j / rows);
      }
    }
    const w = cols + 1;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
        if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (closed) {
      const n = g.getAttribute('normal');
      for (let j = 0; j <= rows; j++) {
        const a = j * w, b = a + cols;
        const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
        n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
      }
    }
    return g;
  }

  /** A tube along a curve, its radius r(u) varying along it, wrinkled by wobble(u, a). */
  function tube(curve, segments, sides, r, wobble) {
    const frames = curve.computeFrenetFrames(segments, !!curve.closed);
    return sheet(sides, segments, (s, u) => {
      const k = Math.round(u * segments), p = curve.getPointAt(u), a = s * TAU;
      const rr = r(u) * (1 + (wobble ? wobble(u, a) : 0));
      const N = frames.normals[k], B = frames.binormals[k];
      return [p.x + rr * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + rr * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + rr * (Math.cos(a) * N.z + Math.sin(a) * B.z)];
    }, true);
  }

  /* ---------------- cloth ---------------- */

  /**
   * Coarse wool, as a grey texture to multiply the habit's colour with and to raise its
   * surface: a twill's diagonal ribs, the slubs and thin places of hand-spun yarn, and the
   * uneven wear of an old habit.
   */
  function woolTexture() {
    const size = 256, canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d'), img = g.createImageData(size, size), d = img.data;
    let seed = 20261107;
    const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    // value noise on a coarse grid, wrapping, for the slubs and the wear
    const grid = (n) => { const v = new Float32Array(n * n); for (let i = 0; i < v.length; i++) v[i] = rnd(); return v; };
    const noise = (v, n, x, y) => {
      const fx = (x / size) * n, fy = (y / size) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(0, 1, fx - x0), ty = smooth(0, 1, fy - y0);
      const at = (i, j) => v[((j % n) + n) % n * n + (((i % n) + n) % n)];
      return lerp(lerp(at(x0, y0), at(x0 + 1, y0), tx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
    };
    const slub = grid(64), wear = grid(8);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const rib = 0.5 + 0.5 * Math.sin(((x + y) * TAU) / 4); // a twill, every 4 threads
        const v = 0.8 + 0.05 * rib + 0.06 * (noise(slub, 64, x, y) - 0.5) + 0.07 * (noise(wear, 8, x, y) - 0.5) + 0.04 * (rnd() - 0.5);
        const o = (y * size + x) * 4, c = Math.round(255 * Math.min(1, Math.max(0, v)));
        d[o] = d[o + 1] = d[o + 2] = c; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /* ---------------- the habit ---------------- */

  // its outline, from the hem up to the neck: [height, radius]
  const PROFILE = [[0, 0.335], [0.06, 0.325], [0.3, 0.295], [0.6, 0.26], [0.88, 0.218], [1.0, 0.19], [1.08, 0.198], [1.24, 0.214], [1.36, 0.198], [1.45, 0.125], [1.52, 0.085]];
  const WAIST = 1.0; // where the cord is tied

  /** How much wider than deep the habit is, side to side (x) and front to back (z), at a height. */
  const widthAt = (y) => along([[0.85, 1.08], [1.05, 1.17]], y);
  const depthAt = (y) => along([[0.85, 0.93], [1.05, 0.78]], y);

  /** The habit's folds, as a fraction of its radius, at a height and an angle round it (0 at the back). */
  function folds(y, a) {
    const hang = 0.075 * (1 - smooth(0.05, WAIST, y)); // long folds, deepest at the hem
    const gather = 0.035 * Math.exp(-(((y - (WAIST - 0.07)) / 0.09) ** 2)) + 0.022 * Math.exp(-(((y - (WAIST + 0.07)) / 0.06) ** 2)); // gathered at the cord
    return hang * (0.6 * Math.sin(6 * a + 0.7) + 0.3 * Math.sin(11 * a + 2.1 + 0.8 * y) + 0.18 * Math.sin(19 * a + 4 - 1.3 * y)) +
      gather * Math.sin(15 * a + 1.3) + 0.008 * Math.sin(5 * a + 3 * y);
  }

  /** A point of the habit's surface: height y, angle a round it (0 at the back, π in front); `lift` raises it from the surface. */
  function habitPoint(y, a, lift) {
    const r = along(PROFILE, y) * (1 + folds(y, a)) + (lift || 0);
    return [r * widthAt(y) * Math.sin(a), y, r * depthAt(y) * Math.cos(a)];
  }

  function habitGeometry() {
    const top = PROFILE[PROFILE.length - 1][0];
    return sheet(96, 56, (u, v) => {
      const a = u * TAU, y = v * top;
      const p = habitPoint(y, a);
      // the hem, uneven: lifted where the folds stand out
      if (v === 0) p[1] = 0.012 + 0.012 * Math.max(0, Math.sin(6 * a + 0.7));
      return p;
    }, true, false);
  }

  /** The short cape over the shoulders, from which the hood rises. */
  function capeGeometry() {
    const outline = [[1.53, 0.1], [1.49, 0.15], [1.44, 0.2], [1.38, 0.236], [1.32, 0.25], [1.265, 0.255]];
    return sheet(96, 24, (u, v) => {
      const a = u * TAU, y = along(outline.map(([h], i) => [i / (outline.length - 1), h]), v);
      const r = along(outline.map(([, rr], i) => [i / (outline.length - 1), rr]), v) * (1 + 0.025 * v * v * Math.sin(9 * a + 1.1) + 0.012 * Math.sin(4 * a));
      // its lower edge a little lower in front and behind than over the arms
      const dip = v === 1 ? -0.02 * Math.cos(2 * a) - 0.01 : 0;
      return [r * 1.13 * Math.sin(a), y + dip * v, r * 0.8 * Math.cos(a)];
    }, true, true);
  }

  /* ---------------- the hood ---------------- */

  // along the hood, from the opening (t = 0) to its point behind (t = 1): depth (z), height
  // of its middle, half-width and half-height
  const HOOD = [
    [0, -0.14, 1.615, 0.1, 0.138],
    [0.12, -0.093, 1.632, 0.138, 0.175],
    [0.4, 0, 1.648, 0.16, 0.195],
    [0.65, 0.078, 1.627, 0.144, 0.176],
    [0.85, 0.146, 1.58, 0.097, 0.128],
    [1, 0.215, 1.49, 0.008, 0.012],
  ];
  const hoodAt = (k, t) => along(HOOD.map((row) => [row[0], row[k]]), t);

  /** A point of the hood: t from the opening to the point, b round it (0 at the top). */
  function hoodPoint(t, b, inset) {
    const z = hoodAt(1, t), cy = hoodAt(2, t), rx = hoodAt(3, t) - (inset || 0), ry = hoodAt(4, t) - (inset || 0);
    const s = Math.sin(b), c = Math.cos(b);
    // the brim juts forward over the brow and falls back under the chin
    const brim = (1 - smooth(0, 0.35, t)) * (0.045 * c);
    // the cloth wrinkles as it bends back over the head
    const w = 1 + 0.03 * Math.sin(5 * b + 7 * t) * smooth(0.05, 0.3, t) + 0.02 * Math.sin(9 * b - 4 * t);
    return [rx * w * s, cy + ry * w * c, z - brim];
  }

  function hoodGeometry(inset, flip) {
    return sheet(56, 32, (u, v) => hoodPoint(v, u * TAU, inset), true, flip);
  }

  /** The rolled edge round the opening of the hood. */
  function hoodRim() {
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const p = hoodPoint(0, (i / 48) * TAU, -0.004);
      pts.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
    return tube(new THREE.CatmullRomCurve3(pts, true), 96, 8, () => 0.009);
  }

  /* ---------------- sleeves and cord ---------------- */

  /** A sleeve, wide at the cuff, the arm bent so that the hands meet in front, hidden in the sleeves. */
  function sleeve(side) {
    const s = side, y0 = s > 0 ? 0.005 : -0.005, z0 = s > 0 ? -0.004 : 0.004;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.195 * s, 1.37, 0.01),
      new THREE.Vector3(0.245 * s, 1.2, 0.015),
      new THREE.Vector3(0.235 * s, 1.08, -0.03),
      new THREE.Vector3(0.14 * s, 1.045 + y0, -0.15),
      new THREE.Vector3(0.008 * s, 1.045 + y0, -0.2 + z0),
    ]);
    const radius = (u) => along([[0, 0.06], [0.45, 0.068], [0.7, 0.078], [1, 0.1]], u);
    const wrinkle = (u, a) => 0.06 * Math.sin(3 * a + 9 * u) * Math.exp(-(((u - 0.5) / 0.18) ** 2)) + 0.03 * Math.sin(5 * a - 4 * u);
    const end = curve.getPointAt(1), dir = curve.getTangentAt(1);
    return { geometry: tube(curve, 40, 20, radius, wrinkle), end, dir, r: radius(1) };
  }

  /** The cord: round the waist, then hanging down the right side, knotted three times. */
  function cord() {
    const loop = [];
    for (let i = 0; i < 48; i++) {
      // drawn tight over the gathered cloth, a little lower in front
      const a = (i / 48) * TAU, y = WAIST - 0.03 * Math.max(0, -Math.cos(a)) ** 2, r = along(PROFILE, y) * 1.035 + 0.01;
      loop.push(new THREE.Vector3(r * widthAt(y) * Math.sin(a), y, r * depthAt(y) * Math.cos(a)));
    }
    const belt = tube(new THREE.CatmullRomCurve3(loop, true), 120, 8, () => 0.011);
    // the hanging end, a hand's breadth clear of the habit
    const a = Math.PI - 0.62, hang = [];
    for (let i = 0; i <= 8; i++) {
      const y = WAIST - 0.02 - (i / 8) * 0.56, p = habitPoint(y, a, 0.035 + 0.02 * (i / 8));
      hang.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
    const curve = new THREE.CatmullRomCurve3(hang);
    const knots = [0.45, 0.64, 0.83].map((u) => curve.getPointAt(u));
    const end = tube(curve, 48, 8, (u) => 0.0105 * (1 - 0.35 * smooth(0.95, 1, u)));
    return { belt, end, knots, tip: curve.getPointAt(1) };
  }

  /* ---------------- the figure ---------------- */

  function make() {
    const wool = woolTexture();
    const cloth = (repeat) => {
      const map = wool.clone();
      map.repeat.set(repeat[0], repeat[1]);
      map.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ color: 0x5e4632, roughness: 0.97, metalness: 0, map, bumpMap: map, bumpScale: 0.025 });
    };
    const dark = new THREE.MeshLambertMaterial({ color: 0x0b0806, side: THREE.BackSide });
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackBoth = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    const rope = new THREE.MeshStandardMaterial({ color: 0xb3a585, roughness: 0.9, metalness: 0 });

    const group = new THREE.Group();
    group.add(new THREE.Mesh(habitGeometry(), cloth([10, 7])));
    const cape = new THREE.Mesh(capeGeometry(), cloth([6, 1.5]));
    cape.material.side = THREE.DoubleSide;
    group.add(cape);

    // the hood turns on the neck, as the reader looks up or down
    const head = new THREE.Group();
    head.position.set(0, 1.5, 0);
    const pivot = (mesh) => { mesh.position.y = -1.5; return mesh; };
    head.add(pivot(new THREE.Mesh(hoodGeometry(0, true), cloth([5, 4]))));
    head.add(pivot(new THREE.Mesh(hoodGeometry(0.004, true), dark))); // its lining, seen only from inside
    head.add(pivot(new THREE.Mesh(hoodRim(), cloth([12, 1]))));
    // whatever is in the hood takes no light at all
    const shadow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), black);
    shadow.scale.set(0.95, 1.18, 1.05);
    shadow.position.set(0, 0.105, -0.005);
    head.add(shadow);
    group.add(head);

    for (const side of [1, -1]) {
      const sl = sleeve(side);
      group.add(new THREE.Mesh(sl.geometry, cloth([3, 4])));
      // the inside of the cuff, dark, where the hands are
      const inside = new THREE.Mesh(new THREE.CircleGeometry(sl.r * 0.96, 20), blackBoth);
      inside.position.copy(sl.end).addScaledVector(sl.dir, -0.004);
      inside.lookAt(sl.end.clone().sub(sl.dir));
      group.add(inside);
    }

    const c = cord();
    group.add(new THREE.Mesh(c.belt, rope));
    group.add(new THREE.Mesh(c.end, rope));
    const knot = new THREE.SphereGeometry(0.021, 12, 8);
    for (const k of c.knots) { const m = new THREE.Mesh(knot, rope); m.position.copy(k); m.scale.set(1, 1.25, 1); group.add(m); }
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 8), rope);
    tassel.position.copy(c.tip).add(new THREE.Vector3(0, -0.02, 0));
    tassel.rotation.x = Math.PI;
    group.add(tassel);

    group.userData = { head, sway: 0, walk: 0, last: null };
    return group;
  }

  /**
   * Stands the figure where the reader is, turned as they are, the hood bowed or raised as
   * they look down or up, swaying a little as they walk.
   */
  function pose(figure, player, dt) {
    const u = figure.userData;
    const moved = u.last ? Math.hypot(player.x - u.last[0], player.z - u.last[1]) : 0;
    u.last = [player.x, player.z];
    const walking = dt > 0 && moved / dt > 0.3 && moved < 1 ? 1 : 0; // (a jump across the Library is no step)
    u.walk += (walking - u.walk) * Math.min(1, dt * 5);
    figure.position.set(player.x, player.y, player.z);
    figure.rotation.set(0, player.yaw, Math.sin(player.bob * 0.5) * 0.022 * u.walk);
    u.head.rotation.x = Math.max(-0.4, Math.min(0.32, player.pitch * 0.55));
  }

  Babel.Figure = { make, pose };
})();
