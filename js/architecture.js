/*
 * Architecture: the dimensions of a hexagon and its vestibule, derived from the
 * configuration, and the geometry and materials that draw them.
 *
 * Coordinates are metres. Each "cell" holds one hexagon centred on the origin and
 * the vestibule that leaves it through its east door (+x) towards the next hexagon.
 * The two free sides of every hexagon face east and west, so each floor is one
 * endless gallery; the spiral stair in every vestibule joins the floors.
 *
 * Every hexagon is identical, so lighting is computed in the shaders from the
 * fragment's position within its cell: the two lamps of each hexagon light it the
 * same way everywhere in the Library.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const SQ3 = Math.sqrt(3);

  /* ------------------------------------------------------------------ *
   * Dimensions
   * ------------------------------------------------------------------ */

  function dimensions(cfg) {
    const d = {};
    d.books = cfg.booksPerShelf;
    d.shelves = cfg.shelvesPerWall;
    d.walls = cfg.wallsWithShelves;

    d.bookT = 0.062; // thickness of a volume
    d.bookH = 0.34;
    d.bookD = 0.23;
    d.base = 0.1; // plinth under the lowest shelf
    d.board = 0.03;
    d.cornice = 0.12;
    // vertical distance between shelves; with few shelves they spread out, so that the
    // ceiling stays a little above a librarian's head
    d.pitch = Math.max(0.5, (2.25 - d.base - d.board - d.cornice) / d.shelves);
    d.shelfDepth = 0.34;
    d.postW = 0.06;

    d.rowLen = d.books * d.bookT;
    d.shelfLen = Math.max(d.rowLen + 0.06, 1.6);
    d.sIn = d.shelfLen + 2 * d.postW; // side of the room's inner hexagon
    d.aIn = (d.sIn * SQ3) / 2; // apothem of the room (to the face of the shelves)
    d.a = d.aIn + d.shelfDepth; // apothem to the back of the shelves
    d.shaftA = Math.max(0.45, d.aIn - 1.0); // apothem of the central air shaft
    d.railH = 0.46; // "very low railings"
    d.roomH = d.base + d.shelves * d.pitch + d.board + d.cornice;
    d.slabT = 0.36;
    d.Hf = d.roomH + d.slabT; // floor-to-floor height

    d.hallW = Math.min(1.4, d.sIn - 0.3);
    d.doorH = Math.min(2.0, d.roomH - 0.12);
    d.hallLen = 4.4;
    d.Dx = 2 * d.a + d.hallLen; // distance between hexagon centres along a gallery
    d.hallX0 = d.a;
    d.hallX1 = d.Dx - d.a;

    // lamps: two per hexagon, placed across the gallery axis, above the walkway
    const mid = (d.shaftA + d.aIn) / 2;
    d.lampZ = mid / (SQ3 / 2);
    d.lampY = d.roomH - 0.3;

    // closets, mirror, stairwell (all within the vestibule)
    d.closetX = d.hallX0 + 0.72;
    d.closetW = 0.62;
    d.closetH = Math.min(1.85, d.doorH - 0.1);
    d.wellR = 1.3;
    d.openW = 1.2;
    d.colR = 0.14;
    d.wellX = d.hallX0 + d.hallLen * 0.62;
    d.wellZ = d.hallW / 2 + Math.sqrt(d.wellR * d.wellR - (d.openW / 2) * (d.openW / 2));
    d.landingHalf = (55 * Math.PI) / 180; // half-angle of the landing sector
    d.landingTheta = -Math.PI / 2; // landing faces the vestibule (−z from the stair's axis)
    d.stairStart = d.landingTheta + d.landingHalf; // the stair rises counter-clockwise from here
    d.stairSweep = 2 * Math.PI - 2 * d.landingHalf;
    d.steps = Math.max(8, Math.round(d.Hf / 0.18));
    d.riser = d.Hf / d.steps;
    d.mirrorX = d.wellX;
    d.mirrorW = 0.78;
    d.mirrorH = 1.45;
    d.mirrorY0 = 0.45;

    // Shelved sides of the hexagon, by normal angle (multiples of 60°), in the order the walls are
    // numbered. Sides 0 and 3 are the free ones. With fewer than four walls of shelves, the
    // shelved ones are spread around the room and the others are bare.
    d.shelvedSides = { 4: [1, 2, 4, 5], 3: [1, 2, 4], 2: [1, 4], 1: [1] }[d.walls];
    d.eye = 1.6;
    return d;
  }

  /* ------------------------------------------------------------------ *
   * Geometry builder
   * ------------------------------------------------------------------ */

  const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

  class Builder {
    constructor() {
      this.pos = [];
      this.nor = [];
      this.m = new THREE.Matrix4();
      this.r = new THREE.Matrix3();
    }
    setMatrix(m) { this.m.copy(m); this.r.setFromMatrix4(m); return this; }
    reset() { this.m.identity(); this.r.identity(); return this; }
    _push(p, n) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
    }
    /** Convex polygon (array of [x,y,z]) facing `normal` ([x,y,z] in builder space). */
    poly(pts, normal) {
      const P = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(this.m));
      const n = new THREE.Vector3(normal[0], normal[1], normal[2]).applyMatrix3(this.r).normalize();
      _e1.subVectors(P[1], P[0]); _e2.subVectors(P[2], P[0]); _n.crossVectors(_e1, _e2);
      if (_n.dot(n) < 0) P.reverse();
      for (let i = 1; i < P.length - 1; i++) { this._push(P[0], n); this._push(P[i], n); this._push(P[i + 1], n); }
      return this;
    }
    /** Triangle with per-vertex normals (for curved surfaces); vertices given CCW from the front. */
    triSmooth(a, b, c, na, nb, nc) {
      const P = [a, b, c].map((p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(this.m));
      const Nn = [na, nb, nc].map((n) => new THREE.Vector3(n[0], n[1], n[2]).applyMatrix3(this.r).normalize());
      // wind the triangle so that its front faces the way its normals point
      _e1.subVectors(P[1], P[0]); _e2.subVectors(P[2], P[0]); _n.crossVectors(_e1, _e2);
      const avg = _v[0].copy(Nn[0]).add(Nn[1]).add(Nn[2]);
      const order = _n.dot(avg) < 0 ? [0, 2, 1] : [0, 1, 2];
      for (const i of order) this._push(P[i], Nn[i]);
      return this;
    }
    /** Axis-aligned box. `faces` lists which faces to keep: x X y Y z Z (lower case = negative side). */
    box(x0, y0, z0, x1, y1, z1, faces) {
      faces = faces || 'xXyYzZ';
      if (faces.includes('x')) this.poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
      if (faces.includes('X')) this.poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]);
      if (faces.includes('y')) this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
      if (faces.includes('Y')) this.poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
      if (faces.includes('z')) this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]);
      if (faces.includes('Z')) this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
      return this;
    }
    /** Vertical cylindrical surface around (cx, cz). inward = normals point to the axis. */
    cylinder(cx, cz, r, th0, th1, y0, y1, inward, segs) {
      segs = segs || Math.max(6, Math.ceil(Math.abs(th1 - th0) / (Math.PI / 24)));
      for (let i = 0; i < segs; i++) {
        const a0 = th0 + ((th1 - th0) * i) / segs, a1 = th0 + ((th1 - th0) * (i + 1)) / segs;
        const p0 = [cx + r * Math.cos(a0), cz + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cz + r * Math.sin(a1)];
        const s = inward ? -1 : 1;
        const n0 = [s * Math.cos(a0), 0, s * Math.sin(a0)], n1 = [s * Math.cos(a1), 0, s * Math.sin(a1)];
        const A = [p0[0], y0, p0[1]], B = [p1[0], y0, p1[1]], C = [p1[0], y1, p1[1]], D = [p0[0], y1, p0[1]];
        this.triSmooth(A, B, C, n0, n1, n1);
        this.triSmooth(A, C, D, n0, n1, n0);
      }
      return this;
    }
    /** Flat annular sector at height y facing up (+1) or down (−1), optionally clipped to z ≥ zMin. */
    sector(cx, cz, r0, r1, th0, th1, y, up, zMin, segs) {
      segs = segs || Math.max(4, Math.ceil(Math.abs(th1 - th0) / (Math.PI / 24)));
      for (let i = 0; i < segs; i++) {
        const a0 = th0 + ((th1 - th0) * i) / segs, a1 = th0 + ((th1 - th0) * (i + 1)) / segs;
        let pts = [
          [cx + r0 * Math.cos(a0), y, cz + r0 * Math.sin(a0)],
          [cx + r1 * Math.cos(a0), y, cz + r1 * Math.sin(a0)],
          [cx + r1 * Math.cos(a1), y, cz + r1 * Math.sin(a1)],
          [cx + r0 * Math.cos(a1), y, cz + r0 * Math.sin(a1)],
        ];
        if (zMin !== undefined) pts = clipZ(pts, zMin);
        if (pts.length >= 3) this.poly(pts, [0, up, 0]);
      }
      return this;
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.computeBoundingSphere();
      return g;
    }
  }

  /** Sutherland–Hodgman clip of a planar polygon to the half-space z ≥ zMin. */
  function clipZ(pts, zMin) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const pin = p[2] >= zMin, qin = q[2] >= zMin;
      if (pin) out.push(p);
      if (pin !== qin) {
        const t = (zMin - p[2]) / (q[2] - p[2]);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, zMin]);
      }
    }
    return out;
  }

  /** Matrix placing the canonical wall frame (x along the wall, z outward) on side `j` of the hexagon. */
  function sideMatrix(j) {
    const phi = (j * Math.PI) / 3;
    const n = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
    const t = new THREE.Vector3(Math.sin(phi), 0, -Math.cos(phi));
    return new THREE.Matrix4().makeBasis(t, new THREE.Vector3(0, 1, 0), n);
  }

  /* ------------------------------------------------------------------ *
   * Hexagon
   * ------------------------------------------------------------------ */

  function hexVertex(apothem, k) {
    const R = (2 * apothem) / SQ3, ang = Math.PI / 6 + (k * Math.PI) / 3;
    return [R * Math.cos(ang), R * Math.sin(ang)];
  }

  function buildHexagon(d) {
    const wood = new Builder(), plaster = new Builder(), tiles = new Builder();

    // Floor and ceiling rings between the shaft and the shelves.
    for (let k = 0; k < 6; k++) {
      const s0 = hexVertex(d.shaftA, k - 1), s1 = hexVertex(d.shaftA, k);
      const v0 = hexVertex(d.aIn, k - 1), v1 = hexVertex(d.aIn, k);
      tiles.poly([[s0[0], 0, s0[1]], [v0[0], 0, v0[1]], [v1[0], 0, v1[1]], [s1[0], 0, s1[1]]], [0, 1, 0]);
      plaster.poly([[s0[0], d.roomH, s0[1]], [v0[0], d.roomH, v0[1]], [v1[0], d.roomH, v1[1]], [s1[0], d.roomH, s1[1]]], [0, -1, 0]);
    }

    // Slab edges around the shaft (between this ceiling and the floor above) and the lip at floor level.
    for (let j = 0; j < 6; j++) {
      const m = sideMatrix(j);
      const half = d.shaftA / SQ3;
      plaster.setMatrix(m);
      plaster.poly([[-half, d.roomH, d.shaftA], [half, d.roomH, d.shaftA], [half, d.Hf, d.shaftA], [-half, d.Hf, d.shaftA]], [0, 0, -1]);
      plaster.reset();
      // railing: posts and a top rail, set just outside the edge of the shaft
      const ra = d.shaftA + 0.035, rhalf = ra / SQ3;
      wood.setMatrix(m);
      wood.box(-rhalf, d.railH - 0.05, ra - 0.035, rhalf, d.railH, ra + 0.035, 'yYzZ');
      wood.box(-rhalf, 0, ra - 0.03, rhalf, 0.07, ra + 0.03, 'Yz'); // kerb
      const posts = Math.max(3, Math.round((2 * rhalf) / 0.24));
      for (let p = 0; p < posts; p++) {
        const x = -rhalf + (2 * rhalf * (p + 0.5)) / posts;
        wood.box(x - 0.018, 0.07, ra - 0.018, x + 0.018, d.railH - 0.05, ra + 0.018, 'xXzZ');
      }
      wood.reset();
    }

    // The six sides.
    for (let j = 0; j < 6; j++) {
      const m = sideMatrix(j);
      const free = j === 0 || j === 3;
      const half = d.sIn / 2;
      const wallIndex = d.shelvedSides.indexOf(j); // −1 for a bare wall
      if (free) {
        plaster.setMatrix(m);
        const hw = d.hallW / 2;
        plaster.poly([[-half, 0, d.aIn], [-hw, 0, d.aIn], [-hw, d.roomH, d.aIn], [-half, d.roomH, d.aIn]], [0, 0, -1]);
        plaster.poly([[hw, 0, d.aIn], [half, 0, d.aIn], [half, d.roomH, d.aIn], [hw, d.roomH, d.aIn]], [0, 0, -1]);
        plaster.poly([[-hw, d.doorH, d.aIn], [hw, d.doorH, d.aIn], [hw, d.roomH, d.aIn], [-hw, d.roomH, d.aIn]], [0, 0, -1]);
        // door reveal (the passage through the thickness of the wall)
        plaster.poly([[-hw, 0, d.aIn], [-hw, 0, d.a], [-hw, d.doorH, d.a], [-hw, d.doorH, d.aIn]], [1, 0, 0]);
        plaster.poly([[hw, 0, d.aIn], [hw, 0, d.a], [hw, d.doorH, d.a], [hw, d.doorH, d.aIn]], [-1, 0, 0]);
        plaster.poly([[-hw, d.doorH, d.aIn], [hw, d.doorH, d.aIn], [hw, d.doorH, d.a], [-hw, d.doorH, d.a]], [0, -1, 0]);
        plaster.reset();
        tiles.setMatrix(m);
        tiles.poly([[-hw, 0, d.aIn], [hw, 0, d.aIn], [hw, 0, d.a], [-hw, 0, d.a]], [0, 1, 0]);
        tiles.reset();
        // door frame and skirting
        wood.setMatrix(m);
        wood.box(-hw - 0.07, 0, d.aIn - 0.025, -hw, d.doorH + 0.07, d.aIn, 'xXyYz');
        wood.box(hw, 0, d.aIn - 0.025, hw + 0.07, d.doorH + 0.07, d.aIn, 'xXyYz');
        wood.box(-hw, d.doorH, d.aIn - 0.025, hw, d.doorH + 0.07, d.aIn, 'yYz');
        wood.box(-half, 0, d.aIn - 0.02, -hw - 0.07, 0.11, d.aIn, 'Yz');
        wood.box(hw + 0.07, 0, d.aIn - 0.02, half, 0.11, d.aIn, 'Yz');
        wood.box(-half, d.roomH - 0.08, d.aIn - 0.03, half, d.roomH, d.aIn, 'yz');
        wood.reset();
      } else if (wallIndex >= 0) {
        buildShelfUnit(wood, m, d);
      } else {
        plaster.setMatrix(m);
        plaster.poly([[-half, 0, d.aIn], [half, 0, d.aIn], [half, d.roomH, d.aIn], [-half, d.roomH, d.aIn]], [0, 0, -1]);
        plaster.reset();
        wood.setMatrix(m);
        wood.box(-half, 0, d.aIn - 0.02, half, 0.11, d.aIn, 'Yz');
        wood.box(-half, d.roomH - 0.08, d.aIn - 0.03, half, d.roomH, d.aIn, 'yz');
        wood.reset();
      }
    }
    return { wood: wood.geometry(), plaster: plaster.geometry(), tiles: tiles.geometry() };
  }

  function buildShelfUnit(wood, m, d) {
    wood.setMatrix(m);
    const L = d.shelfLen / 2, half = d.sIn / 2;
    const front = d.aIn, back = d.a;
    // back panel
    wood.poly([[-L, 0, back - 0.02], [L, 0, back - 0.02], [L, d.roomH, back - 0.02], [-L, d.roomH, back - 0.02]], [0, 0, -1]);
    // end posts (they meet the neighbouring wall's posts at the corner)
    wood.box(-half, 0, front, -L, d.roomH, back, 'Xz');
    wood.box(L, 0, front, half, d.roomH, back, 'xz');
    // plinth
    wood.box(-L, 0, front + 0.015, L, d.base, back, 'Yz');
    // shelves
    for (let i = 0; i <= d.shelves; i++) {
      const y = d.base + i * d.pitch;
      wood.box(-L, y, front, L, y + d.board, back - 0.02, i === 0 ? 'Yz' : 'yYz');
    }
    // cornice
    const top = d.base + d.shelves * d.pitch + d.board;
    wood.box(-half, top, front - 0.035, half, d.roomH, back, 'yz');
    wood.reset();
  }

  /** Lamps: two spheres hung from the ceiling, with their cords. */
  function buildLamps(d) {
    const b = new Builder();
    for (const s of [1, -1]) {
      const cx = 0, cz = s * d.lampZ, cy = d.lampY, r = 0.1;
      const rings = 8, segs = 14;
      for (let i = 0; i < rings; i++) {
        const t0 = (Math.PI * i) / rings, t1 = (Math.PI * (i + 1)) / rings;
        for (let k = 0; k < segs; k++) {
          const p0 = (2 * Math.PI * k) / segs, p1 = (2 * Math.PI * (k + 1)) / segs;
          const pt = (t, p) => [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
          const a = pt(t0, p0), bb = pt(t1, p0), c = pt(t1, p1), e = pt(t0, p1);
          const P = (u) => [cx + r * u[0], cy + r * u[1], cz + r * u[2]];
          b.triSmooth(P(a), P(c), P(bb), a, c, bb);
          b.triSmooth(P(a), P(e), P(c), a, e, c);
        }
      }
      b.box(cx - 0.006, cy + r, cz - 0.006, cx + 0.006, d.roomH, cz + 0.006, 'xXzZ');
    }
    return b.geometry();
  }

  /* ------------------------------------------------------------------ *
   * Vestibule: closets, mirror, spiral stair
   * ------------------------------------------------------------------ */

  function buildVestibule(d) {
    const wood = new Builder(), plaster = new Builder(), tiles = new Builder();
    const x0 = d.hallX0, x1 = d.hallX1, hw = d.hallW / 2, H = d.roomH;
    const ox0 = d.wellX - d.openW / 2, ox1 = d.wellX + d.openW / 2;

    tiles.poly([[x0, 0, -hw], [x1, 0, -hw], [x1, 0, hw], [x0, 0, hw]], [0, 1, 0]);
    plaster.poly([[x0, H, -hw], [x1, H, -hw], [x1, H, hw], [x0, H, hw]], [0, -1, 0]);
    // end walls above the doors
    plaster.poly([[x0, d.doorH, -hw], [x0, d.doorH, hw], [x0, H, hw], [x0, H, -hw]], [1, 0, 0]);
    plaster.poly([[x1, d.doorH, -hw], [x1, d.doorH, hw], [x1, H, hw], [x1, H, -hw]], [-1, 0, 0]);
    // south wall (−z): continuous, carries a closet door and the mirror
    plaster.poly([[x0, 0, -hw], [x1, 0, -hw], [x1, H, -hw], [x0, H, -hw]], [0, 0, 1]);
    // north wall (+z): opening onto the stair
    plaster.poly([[x0, 0, hw], [ox0, 0, hw], [ox0, H, hw], [x0, H, hw]], [0, 0, -1]);
    plaster.poly([[ox1, 0, hw], [x1, 0, hw], [x1, H, hw], [ox1, H, hw]], [0, 0, -1]);
    plaster.poly([[ox0, d.doorH, hw], [ox1, d.doorH, hw], [ox1, H, hw], [ox0, H, hw]], [0, 0, -1]);

    // skirting boards
    wood.box(x0, 0, -hw, x1, 0.1, -hw + 0.02, 'YZ');
    wood.box(x0, 0, hw - 0.02, ox0 - 0.06, 0.1, hw, 'Yzx');
    wood.box(ox1 + 0.06, 0, hw - 0.02, x1, 0.1, hw, 'YzX');
    // frame around the stair opening
    wood.box(ox0 - 0.06, 0, hw - 0.025, ox0, d.doorH + 0.06, hw, 'xXYz');
    wood.box(ox1, 0, hw - 0.025, ox1 + 0.06, d.doorH + 0.06, hw, 'xXYz');
    wood.box(ox0, d.doorH, hw - 0.025, ox1, d.doorH + 0.06, hw, 'yz');

    // the two very small closets, one on each side, doors shut
    for (const side of [-1, 1]) {
      const z = side * hw, inward = -side;
      const cx0 = d.closetX - d.closetW / 2, cx1 = d.closetX + d.closetW / 2;
      const zf = z + inward * 0.03; // door face
      const zA = Math.min(z, zf), zB = Math.max(z, zf);
      wood.box(cx0, 0.02, zA, cx1, d.closetH, zB, side < 0 ? 'xXyYZ' : 'xXyYz');
      // frame
      const zF = z + inward * 0.045, fA = Math.min(z, zF), fB = Math.max(z, zF);
      wood.box(cx0 - 0.06, 0, fA, cx0, d.closetH + 0.06, fB, side < 0 ? 'xXYZ' : 'xXYz');
      wood.box(cx1, 0, fA, cx1 + 0.06, d.closetH + 0.06, fB, side < 0 ? 'xXYZ' : 'xXYz');
      wood.box(cx0, d.closetH, fA, cx1, d.closetH + 0.06, fB, side < 0 ? 'yYZ' : 'yYz');
      // knob
      const kx = cx1 - 0.08, kz = zf + inward * 0.025;
      wood.box(kx - 0.02, 1.0, Math.min(zf, kz), kx + 0.02, 1.04, Math.max(zf, kz), 'xXyYzZ');
    }

    // mirror frame on the south wall, facing the stair
    const mx0 = d.mirrorX - d.mirrorW / 2, mx1 = d.mirrorX + d.mirrorW / 2, my0 = d.mirrorY0, my1 = d.mirrorY0 + d.mirrorH;
    const fw = 0.07, fz = -hw + 0.04;
    wood.box(mx0 - fw, my0 - fw, -hw, mx1 + fw, my0, fz, 'xXyYZ');
    wood.box(mx0 - fw, my1, -hw, mx1 + fw, my1 + fw, fz, 'xXyYZ');
    wood.box(mx0 - fw, my0, -hw, mx0, my1, fz, 'xXZ');
    wood.box(mx1, my0, -hw, mx1 + fw, my1, fz, 'xXZ');

    // ---- the stairwell ----
    const well = new Builder(), steps = new Builder();
    const cx = d.wellX, cz = d.wellZ, R = d.wellR, zc = d.hallW / 2;
    const gamma = Math.asin(d.openW / 2 / R); // half-angle of the cap cut by the vestibule wall
    // round wall, everywhere except where it meets the vestibule
    well.cylinder(cx, cz, R, -Math.PI / 2 + gamma, (3 * Math.PI) / 2 - gamma, -d.slabT, d.Hf, true, 64);
    // flat wall above the opening (stair side)
    well.poly([[ox0, d.doorH, zc], [ox1, d.doorH, zc], [ox1, d.Hf, zc], [ox0, d.Hf, zc]], [0, 0, 1]);
    // central column
    steps.cylinder(cx, cz, d.colR, 0, 2 * Math.PI, -d.slabT, d.Hf, false, 20);
    // landing (part of this floor), with its underside and edges
    const l0 = d.landingTheta - d.landingHalf, l1 = d.landingTheta + d.landingHalf;
    steps.sector(cx, cz, d.colR, R, l0, l1, 0, 1, zc, 18);
    steps.sector(cx, cz, d.colR, R, l0, l1, -d.slabT, -1, zc, 18);
    for (const th of [l0, l1]) {
      const n = th === l0 ? [Math.sin(th), 0, -Math.cos(th)] : [-Math.sin(th), 0, Math.cos(th)];
      const pA = [cx + d.colR * Math.cos(th), cz + d.colR * Math.sin(th)], pB = [cx + R * Math.cos(th), cz + R * Math.sin(th)];
      steps.poly([[pA[0], -d.slabT, pA[1]], [pB[0], -d.slabT, pB[1]], [pB[0], 0, pB[1]], [pA[0], 0, pA[1]]], n);
    }
    // treads rising counter-clockwise from the landing to the landing of the floor above
    const treads = d.steps - 1;
    const dth = d.stairSweep / treads;
    for (let k = 0; k < treads; k++) {
      const a0 = d.stairStart + k * dth, a1 = a0 + dth;
      const top = (k + 1) * d.riser, bottom = top - d.riser - 0.08;
      const r0 = d.colR, r1 = R - 0.015;
      steps.sector(cx, cz, r0, r1, a0, a1, top, 1, undefined, 3);
      steps.sector(cx, cz, r0, r1, a0, a1, bottom, -1, undefined, 3);
      const rise = (th, sign) => {
        const pA = [cx + r0 * Math.cos(th), cz + r0 * Math.sin(th)], pB = [cx + r1 * Math.cos(th), cz + r1 * Math.sin(th)];
        const n = [sign * Math.sin(th), 0, -sign * Math.cos(th)];
        steps.poly([[pA[0], bottom, pA[1]], [pB[0], bottom, pB[1]], [pB[0], top, pB[1]], [pA[0], top, pA[1]]], n);
      };
      rise(a0, 1);
      rise(a1, -1);
    }

    return {
      wood: wood.geometry(), plaster: plaster.geometry(), tiles: tiles.geometry(),
      well: well.geometry(), steps: steps.geometry(),
    };
  }

  /** Book geometry with a part attribute: 2 = spine, 1 = boards, 0 = page edges. */
  function buildBook(d) {
    const g = new THREE.BoxGeometry(d.bookT - 0.005, d.bookH, d.bookD);
    const parts = new Float32Array(24);
    // BoxGeometry face order: +x, −x, +y, −y, +z, −z (4 vertices each); the spine faces −z.
    const faceParts = [1, 1, 0, 0, 0, 2];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) parts[f * 4 + v] = faceParts[f];
    g.setAttribute('aPart', new THREE.BufferAttribute(parts, 1));
    return g;
  }

  /* ------------------------------------------------------------------ *
   * Materials
   * ------------------------------------------------------------------ */

  const LIGHTING_GLSL = `
    uniform vec4 uLights[4];
    uniform vec3 uLampColor;
    uniform float uAmbient;
    uniform float uFalloff;
    uniform float uExposure;
    vec3 lampLight(vec3 p, vec3 n) {
      vec3 sum = vec3(uAmbient);
      for (int i = 0; i < 4; i++) {
        vec3 L = uLights[i].xyz - p;
        float d2 = max(dot(L, L), 0.01);
        float ndl = dot(n, L) * inversesqrt(d2);
        float wrap = clamp((ndl + 0.25) / 1.25, 0.0, 1.0);
        sum += uLampColor * (uLights[i].w * wrap / (1.0 + d2 * uFalloff));
      }
      return sum;
    }
    vec3 expose(vec3 c) { return vec3(1.0) - exp(-c * uExposure); }
    float dither(vec2 xy) { return fract(sin(dot(xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }
  `;

  const ARCH_VERT = `
    varying vec3 vLocal;
    varying vec3 vN;
    #include <fog_pars_vertex>
    void main() {
      vec4 local = vec4(position, 1.0);
      vN = normal;
      vLocal = local.xyz;
      vec4 mvPosition = modelViewMatrix * local;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;

  const ARCH_FRAG = `
    uniform sampler2D map;
    uniform vec2 uScale;
    uniform vec3 uTint;
    varying vec3 vLocal;
    varying vec3 vN;
    ${LIGHTING_GLSL}
    #include <fog_pars_fragment>
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec2 uv;
      if (abs(n.y) > 0.6) uv = vLocal.xz;
      else { vec3 t = normalize(vec3(-n.z, 0.0, n.x)); uv = vec2(dot(vLocal, t), vLocal.y); }
      vec3 base = texture2D(map, uv * uScale).rgb * uTint;
      vec3 c = expose(base * lampLight(vLocal, n));
      gl_FragColor = vec4(c + dither(gl_FragCoord.xy) / 255.0, 1.0);
      #include <fog_fragment>
    }
  `;

  const BOOK_VERT = `
    attribute float aPart;
    attribute vec3 aTint;
    attribute float aVariant;
    uniform float uVariants;
    varying vec3 vLocal;
    varying vec3 vN;
    varying vec2 vUv;
    varying vec3 vTint;
    varying float vPart;
    #include <fog_pars_vertex>
    void main() {
      vec4 local = instanceMatrix * vec4(position, 1.0);
      vN = mat3(instanceMatrix) * normal;
      vLocal = local.xyz;
      vPart = aPart;
      vTint = aTint;
      float u = aPart > 1.5 ? uv.x : 0.5;
      vUv = vec2((aVariant + 0.08 + 0.84 * u) / uVariants, uv.y);
      vec4 mvPosition = modelViewMatrix * local;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;

  const BOOK_FRAG = `
    uniform sampler2D map;
    varying vec3 vLocal;
    varying vec3 vN;
    varying vec2 vUv;
    varying vec3 vTint;
    varying float vPart;
    ${LIGHTING_GLSL}
    #include <fog_pars_fragment>
    void main() {
      vec3 n = normalize(vN);
      vec3 tex = texture2D(map, vUv).rgb;
      vec3 col = tex.r * vTint;
      col = mix(col, vec3(0.80, 0.62, 0.30) * (0.55 + 0.5 * tex.r), tex.g);
      col = mix(col, vec3(0.70, 0.64, 0.50), tex.b * 0.85);
      if (vPart < 0.5) col = vec3(0.62, 0.57, 0.46) * (0.88 + 0.12 * fract(sin(vLocal.y * 1300.0 + vLocal.x * 70.0) * 43758.5));
      vec3 c = expose(col * lampLight(vLocal, n));
      gl_FragColor = vec4(c + dither(gl_FragCoord.xy) / 255.0, 1.0);
      #include <fog_fragment>
    }
  `;

  function lightingUniforms(lights, opts) {
    return {
      uLights: { value: lights },
      uLampColor: { value: new THREE.Color(1.0, 0.78, 0.52) },
      uAmbient: { value: opts.ambient !== undefined ? opts.ambient : 0.05 },
      uFalloff: { value: opts.falloff !== undefined ? opts.falloff : 0.55 },
      uExposure: { value: opts.exposure !== undefined ? opts.exposure : 1.35 },
    };
  }

  function archMaterial(map, scale, tint, lights, opts) {
    opts = opts || {};
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, lightingUniforms(lights, opts), {
      map: { value: map },
      uScale: { value: new THREE.Vector2(scale[0], scale[1]) },
      uTint: { value: new THREE.Color(tint) },
    });
    return new THREE.ShaderMaterial({ uniforms, vertexShader: ARCH_VERT, fragmentShader: ARCH_FRAG, fog: true, side: opts.side || THREE.FrontSide });
  }

  function bookMaterial(map, lights, variants) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, lightingUniforms(lights, {}), { map: { value: map }, uVariants: { value: variants } });
    return new THREE.ShaderMaterial({ uniforms, vertexShader: BOOK_VERT, fragmentShader: BOOK_FRAG, fog: true });
  }

  /** Light sources of each region, in cell coordinates (xyz) with intensity (w). */
  function lightSets(d) {
    const V = (x, y, z, w) => new THREE.Vector4(x, y, z, w);
    return {
      hexagon: [V(0, d.lampY, d.lampZ, 1.0), V(0, d.lampY, -d.lampZ, 1.0), V(0, d.lampY, 0, 0), V(0, 0, 0, 0)],
      vestibule: [
        V(d.hallX0 - 0.25, 1.8, 0, 0.72),
        V(d.hallX1 + 0.25, 1.8, 0, 0.72),
        V(d.wellX, 1.3, d.wellZ, 0.18),
        V(0, 0, 0, 0),
      ],
      // light from the vestibules of this floor and the floors above and below, spilling into the stairwell
      well: [
        V(d.wellX, 1.5, d.hallW / 2 - 0.15, 0.95),
        V(d.wellX, 1.5 + d.Hf, d.hallW / 2 - 0.15, 0.95),
        V(d.wellX, 1.5 - d.Hf, d.hallW / 2 - 0.15, 0.95),
        V(d.wellX, d.Hf * 0.75, d.wellZ + 0.4, 0.28),
      ],
    };
  }

  function createAssets(cfg, textures) {
    const d = dimensions(cfg);
    const L = lightSets(d);
    const hex = buildHexagon(d);
    const ves = buildVestibule(d);
    const tileScale = [1 / 0.9, 1 / (0.9 * textures.tilesAspect)];
    const wood = (lights) => archMaterial(textures.wood, [0.9, 2.2], 0xb0845a, lights);
    const materials = {
      hexWood: wood(L.hexagon),
      hexPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.hexagon),
      hexTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.hexagon),
      vesWood: wood(L.vestibule),
      vesPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.vestibule),
      vesTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.vestibule),
      wellPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc4b597, L.well, { side: THREE.DoubleSide, ambient: 0.08 }),
      wellStone: archMaterial(textures.stone, [0.7, 0.7], 0xdccdb0, L.well, { side: THREE.DoubleSide, ambient: 0.08 }),
      books: bookMaterial(textures.spines, L.hexagon, Babel.Textures.SPINE_VARIANTS),
      lamp: new THREE.MeshBasicMaterial({ color: 0xffe9c4, fog: true }),
      mirrorDark: new THREE.MeshBasicMaterial({ color: 0x1c1a17, fog: true }),
      glow: new THREE.SpriteMaterial({ map: textures.glow, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: true }),
    };
    const geometries = {
      hexWood: hex.wood, hexPlaster: hex.plaster, hexTiles: hex.tiles,
      vesWood: ves.wood, vesPlaster: ves.plaster, vesTiles: ves.tiles,
      wellPlaster: ves.well, wellStone: ves.steps,
      lamps: buildLamps(d),
      book: buildBook(d),
      mirror: new THREE.PlaneGeometry(d.mirrorW, d.mirrorH),
    };
    return { dims: d, materials, geometries, lights: L };
  }

  Babel.Architecture = { dimensions, createAssets, sideMatrix, Builder };
})();
