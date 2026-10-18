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
    // a wooden lintel across the top of the doorway at each end of the vestibule, bearing a
    // sign that names the way one is facing: EAST at the east end, WEST at the west end
    d.lintelH = Math.min(0.2, Math.max(0.06, d.roomH - d.doorH - 0.03));
    d.lintelDepth = 0.04;
    d.signW = Math.min(4.5 * (d.lintelH - 0.04), d.hallW - 0.2); // the texture's proportions: 4.5 to 1
    d.signH = d.signW / 4.5;
    d.signDepth = 0.018;
    d.signY = d.doorH + d.lintelH / 2;

    // lamps: two per hexagon, placed across the gallery axis, above the walkway
    const mid = (d.shaftA + d.aIn) / 2;
    d.lampZ = mid / (SQ3 / 2);
    d.lampY = d.roomH - 0.3;

    // closets, mirror, stairwell (all within the vestibule)
    d.closetW = 0.8;
    d.closetX = d.hallX0 + 0.32 + d.closetW / 2;
    d.closetH = Math.min(1.95, d.doorH - 0.05);
    d.hingeX = d.closetX - d.closetW / 2; // the south door is hung on its west side and opens inwards

    // The cell behind the south door: a bed, a small table with a night lamp, a toilet,
    // and a sink with a mirror. It sits in the wedge between two hexagons, which widens
    // away from the vestibule, so it never meets a hexagon.
    d.cellWall = 0.12;
    d.cellX0 = d.hingeX - 0.07;
    d.cellX1 = d.cellX0 + 2.2;
    d.cellZ0 = -(d.hallW / 2 + d.cellWall); // inside face of its north wall
    d.cellZ1 = d.cellZ0 - 2.1; // inside face of its south wall
    d.cellH = Math.min(d.roomH, 2.15);
    const R = (x0, x1, z0, z1, extra) => Object.assign({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }, extra);
    d.bed = R(d.cellX0, d.cellX0 + 1.95, d.cellZ1, d.cellZ1 + 0.92, { h: 0.5 });
    d.nightTable = R(d.cellX0, d.cellX0 + 0.36, d.cellZ1 + 0.95, d.cellZ1 + 1.29, { h: 0.62 });
    d.nightLamp = [d.cellX0 + 0.18, d.nightTable.h, (d.nightTable.z0 + d.nightTable.z1) / 2];
    d.toilet = R(d.cellX1 - 0.66, d.cellX1, d.cellZ0 - 0.53, d.cellZ0 - 0.93, { h: 0.43 });
    d.sink = R(d.cellX1 - 1.15, d.cellX1 - 0.7, d.cellZ0, d.cellZ0 - 0.38, { h: 0.84 });
    d.sinkMirror = { x: (d.sink.x0 + d.sink.x1) / 2, w: 0.42, y0: 1.15, h: 0.6 };
    d.doorPivot = [d.hingeX + 0.02, -(d.hallW / 2) - 0.025]; // hinge axis (x, z)
    d.cellDoor = R(d.hingeX - 0.005, d.hingeX + 0.05, d.doorPivot[1] - d.closetW, d.cellZ0); // the door, once open
    d.cellObstacles = [d.bed, d.nightTable, d.toilet, d.sink];

    // The north door gives onto a shallow niche holding the catalogue's touchscreen.
    d.nicheDepth = 0.45;
    d.screen = { x: d.closetX, y: 1.33, w: 0.52, h: 0.38, z: d.hallW / 2 + d.nicheDepth - 0.052 };
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
      this.col = [];
      this.color = [1, 1, 1];
      this.coloured = false;
      this.m = new THREE.Matrix4();
      this.r = new THREE.Matrix3();
    }
    setMatrix(m) { this.m.copy(m); this.r.setFromMatrix4(m); return this; }
    reset() { this.m.identity(); this.r.identity(); return this; }
    /** Colour (multiplies the texture) for the vertices added from now on. */
    tint(hex) {
      const c = new THREE.Color(hex);
      this.color = [c.r, c.g, c.b];
      this.coloured = true;
      return this;
    }
    _push(p, n) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.col.push(this.color[0], this.color[1], this.color[2]);
    }
    /** Vertical solid with an elliptical section (rx along x, rz along z), with optional caps. */
    ellipse(cx, cz, rx, rz, y0, y1, caps, segs) {
      segs = segs || 24;
      caps = caps === undefined ? 'top' : caps;
      for (let i = 0; i < segs; i++) {
        const a0 = (2 * Math.PI * i) / segs, a1 = (2 * Math.PI * (i + 1)) / segs;
        const P = (a, y) => [cx + rx * Math.cos(a), y, cz + rz * Math.sin(a)];
        const N = (a) => [Math.cos(a) / rx, 0, Math.sin(a) / rz];
        this.triSmooth(P(a0, y0), P(a1, y0), P(a1, y1), N(a0), N(a1), N(a1));
        this.triSmooth(P(a0, y0), P(a1, y1), P(a0, y1), N(a0), N(a1), N(a0));
        if (caps === 'top' || caps === 'both') this.poly([[cx, y1, cz], P(a0, y1), P(a1, y1)], [0, 1, 0]);
        if (caps === 'bottom' || caps === 'both') this.poly([[cx, y0, cz], P(a0, y0), P(a1, y0)], [0, -1, 0]);
      }
      return this;
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
      if (this.coloured) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
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
    // south wall (−z): the door of the cell, then the mirror
    const dx0 = d.hingeX, dx1 = d.hingeX + d.closetW, dH = d.closetH, cz0 = d.cellZ0;
    plaster.poly([[x0, 0, -hw], [dx0, 0, -hw], [dx0, H, -hw], [x0, H, -hw]], [0, 0, 1]);
    plaster.poly([[dx1, 0, -hw], [x1, 0, -hw], [x1, H, -hw], [dx1, H, -hw]], [0, 0, 1]);
    plaster.poly([[dx0, dH, -hw], [dx1, dH, -hw], [dx1, H, -hw], [dx0, H, -hw]], [0, 0, 1]);
    // the doorway through the thickness of the wall, and its threshold
    plaster.poly([[dx0, 0, -hw], [dx0, 0, cz0], [dx0, dH, cz0], [dx0, dH, -hw]], [1, 0, 0]);
    plaster.poly([[dx1, 0, -hw], [dx1, 0, cz0], [dx1, dH, cz0], [dx1, dH, -hw]], [-1, 0, 0]);
    plaster.poly([[dx0, dH, -hw], [dx1, dH, -hw], [dx1, dH, cz0], [dx0, dH, cz0]], [0, -1, 0]);
    wood.box(dx0, 0, cz0, dx1, 0.012, -hw, 'YzZ');
    // north wall (+z): the niche of the catalogue, then the opening onto the stair
    const nx0 = d.closetX - d.closetW / 2, nx1 = d.closetX + d.closetW / 2;
    plaster.poly([[x0, 0, hw], [nx0, 0, hw], [nx0, H, hw], [x0, H, hw]], [0, 0, -1]);
    plaster.poly([[nx1, 0, hw], [ox0, 0, hw], [ox0, H, hw], [nx1, H, hw]], [0, 0, -1]);
    plaster.poly([[nx0, dH, hw], [nx1, dH, hw], [nx1, H, hw], [nx0, H, hw]], [0, 0, -1]);
    plaster.poly([[ox1, 0, hw], [x1, 0, hw], [x1, H, hw], [ox1, H, hw]], [0, 0, -1]);
    plaster.poly([[ox0, d.doorH, hw], [ox1, d.doorH, hw], [ox1, H, hw], [ox0, H, hw]], [0, 0, -1]);

    // the lintels over the two doorways, and the boards of their signs
    const ld = d.lintelDepth, sd = d.signDepth, sw = d.signW / 2 + 0.012, sh = d.signH / 2 + 0.012, sy = d.signY;
    wood.box(x0, d.doorH, -hw, x0 + ld, d.doorH + d.lintelH, hw, 'XyY');
    wood.box(x1 - ld, d.doorH, -hw, x1, d.doorH + d.lintelH, hw, 'xyY');
    wood.box(x0 + ld, sy - sh, -sw, x0 + ld + sd, sy + sh, sw, 'XyYzZ');
    wood.box(x1 - ld - sd, sy - sh, -sw, x1 - ld, sy + sh, sw, 'xyYzZ');

    // skirting boards
    wood.box(x0, 0, -hw, dx0 - 0.06, 0.1, -hw + 0.02, 'YZX');
    wood.box(dx1 + 0.06, 0, -hw, x1, 0.1, -hw + 0.02, 'YZx');
    wood.box(x0, 0, hw - 0.02, nx0 - 0.06, 0.1, hw, 'YzX');
    wood.box(nx1 + 0.06, 0, hw - 0.02, ox0 - 0.06, 0.1, hw, 'Yzx');
    wood.box(ox1 + 0.06, 0, hw - 0.02, x1, 0.1, hw, 'YzX');
    // frame around the stair opening
    wood.box(ox0 - 0.06, 0, hw - 0.025, ox0, d.doorH + 0.06, hw, 'xXYz');
    wood.box(ox1, 0, hw - 0.025, ox1 + 0.06, d.doorH + 0.06, hw, 'xXYz');
    wood.box(ox0, d.doorH, hw - 0.025, ox1, d.doorH + 0.06, hw, 'yz');
    // frame around the door of the cell (its leaf is a separate, moving object)
    wood.box(dx0 - 0.06, 0, -hw, dx0, dH + 0.06, -hw + 0.045, 'xXYZ');
    wood.box(dx1, 0, -hw, dx1 + 0.06, dH + 0.06, -hw + 0.045, 'xXYZ');
    wood.box(dx0, dH, -hw, dx1, dH + 0.06, -hw + 0.045, 'yYZ');

    // frame of the niche opposite
    wood.box(nx0 - 0.06, 0, hw - 0.045, nx0, dH + 0.06, hw, 'xXYz');
    wood.box(nx1, 0, hw - 0.045, nx1 + 0.06, dH + 0.06, hw, 'xXYz');
    wood.box(nx0, dH, hw - 0.045, nx1, dH + 0.06, hw, 'yYz');

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

  /** The leaf of the cell's door, in the frame of its hinge (x along the door, z across it). */
  function buildDoorLeaf(d) {
    const b = new Builder();
    const w = d.closetW, h = d.closetH;
    b.box(-0.018, 0.012, -0.02, w - 0.026, h - 0.006, 0.02);
    for (const s of [-1, 1]) {
      const z0 = s * 0.02, z1 = s * 0.03, zA = Math.min(z0, z1), zB = Math.max(z0, z1);
      const f = s > 0 ? 'xXyYZ' : 'xXyYz';
      b.box(0.07, 0.12, zA, w - 0.1, h * 0.42, zB, f);
      b.box(0.07, h * 0.5, zA, w - 0.1, h - 0.1, zB, f);
      const kx = w - 0.11, k0 = s * 0.02, k1 = s * 0.055;
      b.box(kx - 0.02, 1.0, Math.min(k0, k1), kx + 0.02, 1.04, Math.max(k0, k1), 'xXyYzZ');
    }
    return b.geometry();
  }

  /** The niche of the catalogue: its walls, and the terminal's casing (the screen is separate). */
  function buildNiche(d) {
    const b = new Builder();
    const hw = d.hallW / 2, x0 = d.closetX - d.closetW / 2, x1 = d.closetX + d.closetW / 2;
    const z0 = hw, z1 = hw + d.nicheDepth, H = d.closetH, sc = d.screen;
    b.tint(0xd5d0c2);
    b.poly([[x0, 0, z0], [x0, 0, z1], [x0, H, z1], [x0, H, z0]], [1, 0, 0]);
    b.poly([[x1, 0, z0], [x1, 0, z1], [x1, H, z1], [x1, H, z0]], [-1, 0, 0]);
    b.poly([[x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1]], [0, 0, -1]);
    b.poly([[x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1]], [0, -1, 0]);
    b.tint(0x9a958a);
    b.poly([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], [0, 1, 0]);
    // the casing, dark and plain, and a narrow ledge beneath it
    b.tint(0x2a2b2a);
    b.box(sc.x - sc.w / 2 - 0.04, sc.y - sc.h / 2 - 0.05, z1 - 0.05, sc.x + sc.w / 2 + 0.04, sc.y + sc.h / 2 + 0.04, z1, 'xXyYz');
    b.box(sc.x - sc.w / 2 + 0.02, sc.y - sc.h / 2 - 0.1, z1 - 0.14, sc.x + sc.w / 2 - 0.02, sc.y - sc.h / 2 - 0.07, z1, 'xXyYz');
    b.tint(0x3a3c3a);
    b.box(sc.x - 0.012, sc.y - sc.h / 2 - 0.035, z1 - 0.053, sc.x + 0.012, sc.y - sc.h / 2 - 0.025, z1 - 0.05, 'z');
    return b.geometry();
  }

  /** The cell: walls, floor, bed, night table and lamp, toilet, sink and its mirror. */
  function buildCell(d) {
    const wood = new Builder(), soft = new Builder();
    const X0 = d.cellX0, X1 = d.cellX1, Z0 = d.cellZ0, Z1 = d.cellZ1, H = d.cellH;
    const dx0 = d.hingeX, dx1 = d.hingeX + d.closetW, dH = d.closetH;
    const LIME = 0xe2d6bb, LINEN = 0xe6dfcf, PILLOW = 0xf0ebdf, WOOL = 0x7b4132, PORCELAIN = 0xf3efe6, METAL = 0x5d564c;

    // walls and ceiling, limewashed
    soft.tint(LIME);
    soft.poly([[X0, 0, Z0], [dx0, 0, Z0], [dx0, H, Z0], [X0, H, Z0]], [0, 0, -1]);
    soft.poly([[dx1, 0, Z0], [X1, 0, Z0], [X1, H, Z0], [dx1, H, Z0]], [0, 0, -1]);
    soft.poly([[dx0, dH, Z0], [dx1, dH, Z0], [dx1, H, Z0], [dx0, H, Z0]], [0, 0, -1]);
    soft.poly([[X0, 0, Z1], [X1, 0, Z1], [X1, H, Z1], [X0, H, Z1]], [0, 0, 1]);
    soft.poly([[X0, 0, Z0], [X0, 0, Z1], [X0, H, Z1], [X0, H, Z0]], [1, 0, 0]);
    soft.poly([[X1, 0, Z0], [X1, 0, Z1], [X1, H, Z1], [X1, H, Z0]], [-1, 0, 0]);
    soft.poly([[X0, H, Z0], [X1, H, Z0], [X1, H, Z1], [X0, H, Z1]], [0, -1, 0]);

    // floorboards and skirting
    wood.tint(0x9a7552);
    wood.poly([[X0, 0, Z0], [X1, 0, Z0], [X1, 0, Z1], [X0, 0, Z1]], [0, 1, 0]);
    wood.tint(0x8a6a4c);
    wood.box(X0, 0, Z1, X1, 0.08, Z1 + 0.015, 'YZ');
    wood.box(X0, 0, Z1, X0 + 0.015, 0.08, Z0, 'YX');
    wood.box(X1 - 0.015, 0, Z1, X1, 0.08, Z0, 'Yx');
    wood.box(X0, 0, Z0 - 0.015, dx0 - 0.06, 0.08, Z0, 'Yz');
    wood.box(dx1 + 0.06, 0, Z0 - 0.015, X1, 0.08, Z0, 'Yz');
    // door frame on this side
    wood.box(dx0 - 0.06, 0, Z0 - 0.035, dx0, dH + 0.06, Z0, 'xXYz');
    wood.box(dx1, 0, Z0 - 0.035, dx1 + 0.06, dH + 0.06, Z0, 'xXYz');
    wood.box(dx0, dH, Z0 - 0.035, dx1, dH + 0.06, Z0, 'yYz');

    // the bed: a plain wooden frame, headboard against the west wall
    const B = d.bed;
    wood.tint(0x8b6040);
    for (const [px, pz] of [[B.x0 + 0.05, B.z0 + 0.03], [B.x0 + 0.05, B.z1 - 0.03], [B.x1 - 0.03, B.z0 + 0.03], [B.x1 - 0.03, B.z1 - 0.03]]) {
      wood.box(px - 0.025, 0, pz - 0.025, px + 0.025, 0.3, pz + 0.025, 'xXzZ');
    }
    wood.box(B.x0 + 0.05, 0.16, B.z0 + 0.005, B.x1 - 0.03, 0.3, B.z0 + 0.03, 'yYzZ');
    wood.box(B.x0 + 0.05, 0.16, B.z1 - 0.03, B.x1 - 0.03, 0.3, B.z1 - 0.005, 'yYzZ');
    wood.box(B.x0, 0, B.z0, B.x0 + 0.05, 0.95, B.z1, 'xXYzZ');
    wood.box(B.x1 - 0.05, 0, B.z0, B.x1, 0.6, B.z1, 'xXYzZ');
    soft.tint(LINEN);
    soft.box(B.x0 + 0.05, 0.3, B.z0 + 0.035, B.x1 - 0.05, 0.47, B.z1 - 0.035, 'xXYzZ');
    soft.tint(PILLOW);
    soft.box(B.x0 + 0.08, 0.47, B.z0 + 0.13, B.x0 + 0.52, 0.565, B.z1 - 0.13, 'xXYzZ');
    soft.tint(WOOL);
    soft.box(B.x0 + 0.62, 0.24, B.z0 + 0.022, B.x1 - 0.052, 0.492, B.z1 - 0.022, 'xYzZ');

    // the small table fixed to the wall beside the bed, on a bracket
    const T = d.nightTable;
    wood.tint(0x7c5638);
    wood.box(T.x0, T.h - 0.03, T.z0, T.x1, T.h, T.z1, 'xXyYzZ');
    const tz = (T.z0 + T.z1) / 2;
    for (const zz of [tz - 0.01, tz + 0.01]) {
      wood.poly([[T.x0, T.h - 0.03, zz], [T.x0 + 0.26, T.h - 0.03, zz], [T.x0, T.h - 0.3, zz]], [0, 0, zz < tz ? -1 : 1]);
    }
    {
      const a = [T.x0 + 0.26, T.h - 0.03], b = [T.x0, T.h - 0.3];
      const n = [b[1] - a[1], -(b[0] - a[0])];
      const len = Math.hypot(n[0], n[1]);
      wood.poly([[a[0], a[1], tz - 0.01], [b[0], b[1], tz - 0.01], [b[0], b[1], tz + 0.01], [a[0], a[1], tz + 0.01]], [-n[0] / len, -n[1] / len, 0]);
    }
    // the night lamp's foot and stem
    const L = d.nightLamp;
    soft.tint(METAL);
    soft.ellipse(L[0], L[2], 0.06, 0.06, L[1], L[1] + 0.02, 'top', 18);
    soft.ellipse(L[0], L[2], 0.008, 0.008, L[1] + 0.02, L[1] + 0.2, 'none', 8);

    // the toilet, its cistern against the east wall
    const W = d.toilet, wz = (W.z0 + W.z1) / 2, bx = X1 - 0.4;
    soft.tint(PORCELAIN);
    soft.box(X1 - 0.19, 0.42, W.z0 + 0.02, X1, 0.8, W.z1 - 0.02, 'xyzZ');
    soft.box(X1 - 0.205, 0.8, W.z0 + 0.01, X1, 0.83, W.z1 - 0.01, 'xyYzZ');
    soft.ellipse(bx + 0.03, wz, 0.13, 0.11, 0, 0.3, 'none', 20);
    soft.ellipse(bx, wz, 0.22, 0.17, 0.3, 0.4, 'bottom', 24);
    wood.tint(0x8f6a4a);
    wood.ellipse(bx - 0.005, wz, 0.235, 0.18, 0.4, 0.43, 'top', 24);
    wood.box(X1 - 0.2, 0.4, wz - 0.12, X1 - 0.17, 0.46, wz + 0.12, 'xXYzZ');

    // the sink, fixed to the north wall, with its mirror above
    const K = d.sink, kx = (K.x0 + K.x1) / 2, top = K.h, bot = K.h - 0.16, rim = 0.035;
    soft.tint(PORCELAIN);
    soft.box(K.x0, bot, K.z0, K.x1, top, K.z1, 'xXyz');
    const ix0 = K.x0 + rim, ix1 = K.x1 - rim, iz0 = K.z0 + rim, iz1 = K.z1 - 0.06, ib = top - 0.12;
    soft.poly([[K.x0, top, K.z0], [K.x1, top, K.z0], [K.x1, top, iz0], [K.x0, top, iz0]], [0, 1, 0]);
    soft.poly([[K.x0, top, iz1], [K.x1, top, iz1], [K.x1, top, K.z1], [K.x0, top, K.z1]], [0, 1, 0]);
    soft.poly([[K.x0, top, iz0], [ix0, top, iz0], [ix0, top, iz1], [K.x0, top, iz1]], [0, 1, 0]);
    soft.poly([[ix1, top, iz0], [K.x1, top, iz0], [K.x1, top, iz1], [ix1, top, iz1]], [0, 1, 0]);
    soft.poly([[ix0, ib, iz0], [ix1, ib, iz0], [ix1, ib, iz1], [ix0, ib, iz1]], [0, 1, 0]);
    soft.poly([[ix0, ib, iz0], [ix1, ib, iz0], [ix1, top, iz0], [ix0, top, iz0]], [0, 0, 1]);
    soft.poly([[ix0, ib, iz1], [ix1, ib, iz1], [ix1, top, iz1], [ix0, top, iz1]], [0, 0, -1]);
    soft.poly([[ix0, ib, iz0], [ix0, ib, iz1], [ix0, top, iz1], [ix0, top, iz0]], [1, 0, 0]);
    soft.poly([[ix1, ib, iz0], [ix1, ib, iz1], [ix1, top, iz1], [ix1, top, iz0]], [-1, 0, 0]);
    soft.tint(METAL);
    soft.ellipse(kx, Z0 - 0.1, 0.02, 0.02, 0, bot, 'none', 10);
    soft.ellipse(kx, Z0 - 0.035, 0.012, 0.012, top, top + 0.15, 'top', 10);
    soft.box(kx - 0.012, top + 0.125, Z0 - 0.14, kx + 0.012, top + 0.15, Z0 - 0.035, 'xXyYz');
    const M = d.sinkMirror, mx0 = M.x - M.w / 2, mx1 = M.x + M.w / 2, my0 = M.y0, my1 = M.y0 + M.h;
    wood.tint(0x6e4c32);
    wood.box(mx0 - 0.04, my0 - 0.04, Z0 - 0.025, mx1 + 0.04, my0, Z0, 'xXyYz');
    wood.box(mx0 - 0.04, my1, Z0 - 0.025, mx1 + 0.04, my1 + 0.04, Z0, 'xXyYz');
    wood.box(mx0 - 0.04, my0, Z0 - 0.025, mx0, my1, Z0, 'xXz');
    wood.box(mx1, my0, Z0 - 0.025, mx1 + 0.04, my1, Z0, 'xXz');

    // the lamp's fabric shade and bulb, which glow
    const shade = new THREE.CylinderGeometry(0.075, 0.125, 0.17, 24, 1, true);
    shade.translate(L[0], L[1] + 0.27, L[2]);
    const bulb = new THREE.SphereGeometry(0.03, 12, 8);
    bulb.translate(L[0], L[1] + 0.22, L[2]);
    return { wood: wood.geometry(), soft: soft.geometry(), shade, bulb };
  }

  /** The faces of the two signs, textured from the signs' texture (EAST above, WEST below). */
  function buildSignFaces(d) {
    const off = d.lintelDepth + d.signDepth + 0.0015;
    const yb = d.signY - d.signH / 2, yt = d.signY + d.signH / 2, w = d.signW / 2;
    const pos = [], nor = [], uv = [], idx = [];
    const quad = (x, nx, zLeft, zRight, v0, v1) => {
      const b = pos.length / 3;
      // bottom left, bottom right, top right, top left, as the reader facing the sign sees them
      pos.push(x, yb, zLeft, x, yb, zRight, x, yt, zRight, x, yt, zLeft);
      for (let i = 0; i < 4; i++) nor.push(nx, 0, 0);
      uv.push(0, v0, 1, v0, 1, v1, 0, v1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    quad(d.hallX1 - off, -1, -w, w, 0.5, 1); // EAST, read facing east (+x), where +z is on the right
    quad(d.hallX0 + off, 1, w, -w, 0, 0.5); // WEST, read facing west, where −z is on the right
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
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
    uniform vec3 uLightColors[4];
    uniform float uGain[4]; // per light, for lights that can be dimmed or shut off
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
        sum += uLightColors[i] * (uLights[i].w * uGain[i] * wrap / (1.0 + d2 * uFalloff));
      }
      return sum;
    }
    vec3 expose(vec3 c) { return vec3(1.0) - exp(-c * uExposure); }
    float dither(vec2 xy) { return fract(sin(dot(xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }
  `;

  const ARCH_VERT = `
    varying vec3 vLocal;
    varying vec3 vN;
    #ifdef USE_COLOR
      varying vec3 vPaint;
    #endif
    #include <fog_pars_vertex>
    #ifdef USE_CELL_MATRIX
      uniform mat4 uCellMatrix; // places a moving part (a door) in its cell, for lighting
    #endif
    void main() {
      vec4 local = vec4(position, 1.0);
      vN = normal;
      #ifdef USE_CELL_MATRIX
        vN = mat3(uCellMatrix) * normal;
        vLocal = (uCellMatrix * local).xyz;
      #else
        vLocal = local.xyz;
      #endif
      #ifdef USE_COLOR
        vPaint = color;
      #endif
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
    #ifdef USE_COLOR
      varying vec3 vPaint;
    #endif
    ${LIGHTING_GLSL}
    #include <fog_pars_fragment>
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec2 uv;
      if (abs(n.y) > 0.6) uv = vLocal.xz;
      else { vec3 t = normalize(vec3(-n.z, 0.0, n.x)); uv = vec2(dot(vLocal, t), vLocal.y); }
      vec3 base = texture2D(map, uv * uScale).rgb * uTint;
      #ifdef USE_COLOR
        base *= vPaint;
      #endif
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

  const SIGN_VERT = `
    varying vec3 vLocal;
    varying vec3 vN;
    varying vec2 vUv;
    #include <fog_pars_vertex>
    void main() {
      vLocal = position;
      vN = normal;
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;

  const SIGN_FRAG = `
    uniform sampler2D map;
    varying vec3 vLocal;
    varying vec3 vN;
    varying vec2 vUv;
    ${LIGHTING_GLSL}
    #include <fog_pars_fragment>
    void main() {
      vec3 n = normalize(vN);
      vec3 base = texture2D(map, vUv).rgb;
      float gilt = smoothstep(0.22, 0.36, base.r - base.b); // gold leaf catches more of the light
      vec3 c = expose(base * lampLight(vLocal, n) * (1.0 + 2.6 * gilt));
      gl_FragColor = vec4(c + dither(gl_FragCoord.xy) / 255.0, 1.0);
      #include <fog_fragment>
    }
  `;

  const LAMP = new THREE.Color(1.0, 0.78, 0.52); // the lamps' warm light
  const SCREEN = new THREE.Color(0.62, 0.82, 0.78); // the catalogue's cool glow

  function lightingUniforms(lights, opts) {
    return {
      uLights: { value: lights },
      uLightColors: { value: [0, 1, 2, 3].map((i) => (opts.colors && opts.colors[i]) || LAMP.clone()) },
      uGain: { value: [1, 1, 1, 1] },
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
    const defines = {};
    if (opts.cellMatrix) { defines.USE_CELL_MATRIX = ''; uniforms.uCellMatrix = { value: new THREE.Matrix4() }; }
    return new THREE.ShaderMaterial({ uniforms, defines, vertexShader: ARCH_VERT, fragmentShader: ARCH_FRAG, fog: true, side: opts.side || THREE.FrontSide, vertexColors: !!opts.vertexColors });
  }

  function signMaterial(map, lights, opts) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, lightingUniforms(lights, opts || {}), { map: { value: map } });
    return new THREE.ShaderMaterial({ uniforms, vertexShader: SIGN_VERT, fragmentShader: SIGN_FRAG, fog: true });
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
        V(d.screen.x, d.screen.y, d.hallW / 2 + 0.1, 0.32),
      ],
      // inside the niche: the screen, and the vestibule's light
      niche: [
        V(d.screen.x, d.screen.y, d.screen.z - 0.3, 0.75),
        V(d.hallX0 - 0.25, 1.8, 0, 0.72),
        V(d.hallX1 + 0.25, 1.8, 0, 0.72),
        V(0, 0, 0, 0),
      ],
      // the night lamp, light from the vestibule through the door, a little fill
      cell: [
        V(d.nightLamp[0], d.nightLamp[1] + 0.24, d.nightLamp[2], 1.15),
        V(d.closetX, 1.5, -d.hallW / 2 + 0.1, 0.24),
        V((d.cellX0 + d.cellX1) / 2, d.cellH - 0.2, (d.cellZ0 + d.cellZ1) / 2, 0.13),
        V(0, 0, 0, 0),
      ],
      // the door of the cell stands between the vestibule and the cell
      door: [
        V(d.nightLamp[0], d.nightLamp[1] + 0.24, d.nightLamp[2], 1.15),
        V(d.hallX0 - 0.25, 1.8, 0, 0.72),
        V(d.hallX1 + 0.25, 1.8, 0, 0.72),
        V((d.cellX0 + d.cellX1) / 2, d.cellH - 0.2, (d.cellZ0 + d.cellZ1) / 2, 0.13),
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
    const cell = buildCell(d);
    const tileScale = [1 / 0.9, 1 / (0.9 * textures.tilesAspect)];
    const wood = (lights) => archMaterial(textures.wood, [0.9, 2.2], 0xb0845a, lights);
    const materials = {
      hexWood: wood(L.hexagon),
      hexPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.hexagon),
      hexTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.hexagon),
      vesWood: archMaterial(textures.wood, [0.9, 2.2], 0xb0845a, L.vestibule, { colors: [null, null, null, SCREEN] }),
      vesPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.vestibule, { colors: [null, null, null, SCREEN] }),
      vesTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.vestibule, { colors: [null, null, null, SCREEN] }),
      niche: archMaterial(textures.plaster, [0.4, 0.4], 0xffffff, L.niche, { vertexColors: true, colors: [SCREEN], falloff: 1.4, ambient: 0.04 }),
      screen: new THREE.MeshBasicMaterial({ map: textures.screen, fog: true }),
      signs: signMaterial(textures.signs, L.vestibule, { colors: [null, null, null, SCREEN], ambient: 0.08 }),
      wellPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc4b597, L.well, { side: THREE.DoubleSide, ambient: 0.08 }),
      wellStone: archMaterial(textures.stone, [0.7, 0.7], 0xdccdb0, L.well, { side: THREE.DoubleSide, ambient: 0.08 }),
      cellWood: archMaterial(textures.wood, [0.9, 2.2], 0xffffff, L.cell, { vertexColors: true, falloff: 1.1, ambient: 0.05 }),
      doorWood: archMaterial(textures.wood, [0.9, 2.2], 0xb0845a, L.door, { cellMatrix: true }),
      cellSoft: archMaterial(textures.plaster, [0.4, 0.4], 0xffffff, L.cell, { vertexColors: true, falloff: 1.1, ambient: 0.05 }),
      shade: new THREE.MeshBasicMaterial({ color: 0xf5c987, side: THREE.DoubleSide, fog: true }),
      bulb: new THREE.MeshBasicMaterial({ color: 0xfff2d8, fog: true }),
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
      doorLeaf: buildDoorLeaf(d),
      niche: buildNiche(d),
      screen: new THREE.PlaneGeometry(d.screen.w, d.screen.h),
      signs: buildSignFaces(d),
      cellWood: cell.wood, cellSoft: cell.soft, shade: cell.shade, bulb: cell.bulb,
      sinkMirror: new THREE.PlaneGeometry(d.sinkMirror.w, d.sinkMirror.h),
    };
    return { dims: d, materials, geometries, lights: L };
  }

  Babel.Architecture = { dimensions, createAssets, sideMatrix, Builder };
})();
