/*
 * Architecture: the dimensions of a hexagon and its vestibule, derived from the
 * configuration, and the geometry and materials that draw them.
 *
 * Coordinates are metres. The hexagons of a floor tile it like a honeycomb, in clusters of
 * seven: six hexagons of books round a seventh, which holds no books but the spiral stair
 * that joins the floors, and has a door in each of its six sides (see Honeycomb below).
 *
 * Each "cell" holds one hexagon of books centred on the origin, the vestibule that leaves
 * it through its east door (+x) towards the stair hexagon of its cluster, and the plain
 * passage that leaves it by its other door, 120° round (side 4), towards a hexagon of the
 * next cluster. So every hexagon of books has two free sides, each giving onto a narrow
 * vestibule, and four walls of shelves. The stair hexagons ("hubs") are built apart.
 *
 * Every hexagon of books is identical, and so is every hub, so lighting is computed in the
 * shaders from the fragment's position within its cell: the lamps over the bookcases of
 * each hexagon light it the same way everywhere in the Library.
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
    // bookcases stand a little above a librarian's head
    d.pitch = Math.max(0.5, (2.25 - d.base - d.board - d.cornice) / d.shelves);
    d.shelfDepth = 0.34;
    d.postW = 0.06;

    d.rowLen = d.books * d.bookT;
    // The room is as wide as its shelves alone would make it, and 1.62 m more, for a walkway round
    // the shaft (see shaftA).
    d.sIn = Math.max(d.rowLen + 0.06, 1.6) + 1.62; // side of the room's inner hexagon
    // A shelf as long as a wall's books would sag under them, so each bookcase is built in bays
    // of 8 books or so (half a metre, at most twice that), with a wooden pilaster between bays
    // and panelling at either end, which fill the rest of the wall.
    d.bays = 1;
    for (let k = 2; k <= d.books; k++) if (d.books % k === 0 && (d.books / k) * d.bookT >= 0.45) d.bays = k;
    d.perBay = d.books / d.bays;
    d.bayLen = d.bays > 1 ? d.perBay * d.bookT + 0.016 : Math.max(d.rowLen + 0.06, 1.6);
    const spare = d.sIn - d.bays * d.bayLen - 2 * (d.postW + 0.3); // what pilasters may take, leaving panels of 0.3 m at least
    d.pilasterW = d.bays > 1 ? Math.max(0.06, Math.min(0.2, spare / (d.bays - 1))) : 0;
    d.shelfLen = d.bays * d.bayLen + (d.bays - 1) * d.pilasterW; // the bookcase, from end post to end post
    d.panel = (d.sIn - d.shelfLen) / 2 - d.postW; // the panelling at either end
    // where along its bookcase (from its middle, towards +x) a volume stands, and which volume stands
    // at a place (−1 at a pilaster or past the ends)
    const bayMid = (b) => d.shelfLen / 2 - d.bayLen / 2 - b * (d.bayLen + d.pilasterW);
    d.bookX = (volume) => {
      const b = Math.floor(volume / d.perBay), i = volume - b * d.perBay;
      return bayMid(b) + (d.perBay * d.bookT) / 2 - (i + 0.5) * d.bookT;
    };
    d.volumeAt = (x) => {
      const b = Math.floor((d.shelfLen / 2 - x) / (d.bayLen + d.pilasterW));
      if (b < 0 || b >= d.bays) return -1;
      const i = Math.floor((bayMid(b) + (d.perBay * d.bookT) / 2 - x) / d.bookT);
      return i < 0 || i >= d.perBay ? -1 : b * d.perBay + i;
    };
    d.aIn = (d.sIn * SQ3) / 2; // apothem of the room (to the face of the shelves)
    d.a = d.aIn + d.shelfDepth; // apothem to the back of the shelves
    d.shaftA = Math.max(0.45, d.aIn - 1.75); // apothem of the central air shaft, with a walkway round it
    d.railH = 0.46; // "very low railings"
    d.shelfTop = d.base + d.shelves * d.pitch + d.board + d.cornice; // height of the bookcases
    d.roomH = Math.max(d.shelfTop, 3.2); // and of the ceiling, with plaster between them
    d.slabT = 0.36;
    d.Hf = d.roomH + d.slabT; // floor-to-floor height

    // the vestibules and passages are as wide as a bookcase without its panelling
    d.hallW = Math.max(1.4, Math.min(d.shelfLen, d.sIn - 0.6, 3));
    d.doorH = Math.min(2.0, d.roomH - 0.12);
    d.hallLen = 4.4;
    d.Dx = 2 * d.a + d.hallLen; // distance between hexagon centres along a floor
    d.hallX0 = d.a;
    d.hallX1 = d.Dx - d.a;
    // a wooden lintel across the top of the doorway at each end of a vestibule, bearing a
    // sign that names the way one is facing: one of the six ways of the honeycomb
    d.lintelH = Math.min(0.2, Math.max(0.06, d.roomH - d.doorH - 0.03));
    d.lintelDepth = 0.04;
    d.signW = Math.min(4.5 * (d.lintelH - 0.04), d.hallW - 0.2); // the texture's proportions: 4.5 to 1
    d.signH = d.signW / 4.5;
    d.signDepth = 0.018;
    d.signY = d.doorH + d.lintelH / 2;

    // lamps: one on the wall above each bookcase, like the picture lamp in the vestibule, shining
    // down on the books: the height of its underside, how far it stands out from the wall, half its length
    d.lampY = Math.min(d.shelfTop + 0.15, d.roomH - 0.12);
    d.lampOut = 0.3;
    d.lampHalfW = Math.min(0.5, d.shelfLen / 2 - 0.2);

    // closets, mirror, stairwell (all within the vestibule)
    d.closetW = 0.8;
    // On the vestibule's south wall, the door of the cell and the mirror stand together in its
    // middle, the door nearer the hexagon; opposite them, on the north wall, the catalogue's niche.
    d.hallMid = (d.hallX0 + d.hallX1) / 2;
    d.closetX = d.hallMid - 0.735;
    d.nicheX = d.hallMid;
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
    d.screen = { x: d.nicheX, y: 1.33, w: 0.52, h: 0.38, z: d.hallW / 2 + d.nicheDepth - 0.052 };
    // The spiral stair stands in a round drum in the middle of each hub. It is built, and lit,
    // about the point (wellX, wellZ), its doorway in the plane z = hallW / 2 and facing −z; the
    // World sets that point on the hub's middle, so that the doorway faces a corner of the hub,
    // between two of its doors.
    d.wellR = Math.min(1.3, d.aIn - 0.95);
    d.openW = Math.min(1.2, 2 * d.wellR - 0.5);
    d.colR = 0.14;
    d.wellX = d.hallX0 + d.hallLen * 0.62;
    d.wellZ = d.hallW / 2 + Math.sqrt(d.wellR * d.wellR - (d.openW / 2) * (d.openW / 2));
    d.drumR = d.wellR + 0.1; // the drum's outer face
    d.drumZ = d.hallW / 2 - d.wellZ; // the plane of its doorway, from the hub's middle (negative: the doorway faces −z)
    d.hubLamps = [0, 2, 4]; // the sides of a hub with a lamp above the door
    d.landingHalf = (55 * Math.PI) / 180; // half-angle of the landing sector
    d.landingTheta = -Math.PI / 2; // landing faces the doorway (−z from the stair's axis)
    d.stairStart = d.landingTheta + d.landingHalf; // the stair rises counter-clockwise from here
    d.stairSweep = 2 * Math.PI - 2 * d.landingHalf;
    d.steps = Math.max(8, Math.round(d.Hf / 0.18));
    d.riser = d.Hf / d.steps;
    d.mirrorX = d.hallMid + 0.735;
    d.mirrorW = 0.78;
    d.mirrorH = 1.45;
    d.mirrorY0 = 0.45;

    // Shelved sides of the room, by normal angle (multiples of 60°), in the order the walls are
    // numbered. Sides 0 and 4 are the free ones, 120° apart: side 0 gives onto the vestibule that
    // leads to the hub, side 4 onto the passage to the next cluster. With fewer than four walls
    // of shelves, the shelved ones are spread around the room and the others are bare.
    d.freeSides = [0, 4];
    d.shelvedSides = { 4: [1, 2, 3, 5], 3: [1, 3, 5], 2: [2, 5], 1: [2] }[d.walls];
    d.passageTurn = (4 * Math.PI) / 3; // the direction of the passage (radians from +x towards +z)
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
      if (_n.dot(n) < 0) P.splice(1, P.length - 1, ...P.slice(1).reverse()); // turned round, from the same first vertex
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

  /**
   * A wall in the plane z, facing nz (±1), from x0 to x1 and y0 to y1, with rectangular holes
   * [xa, xb, ya, yb]. It is drawn as a grid of rectangles that meet corner to corner: where a
   * corner of one lies along the side of another, the rasteriser can leave a seam of stray pixels
   * between them, through which whatever is behind the wall shows. ys: more heights at which to
   * divide it, so that it meets other walls corner to corner too.
   */
  function gridWall(b, x0, x1, y0, y1, z, nz, holes, ys) {
    const sorted = (v) => [...new Set(v)].sort((p, q) => p - q);
    const X = sorted([x0, x1, ...holes.flatMap((h) => [h[0], h[1]])]);
    const Y = sorted([y0, y1, ...holes.flatMap((h) => [h[2], h[3]]), ...(ys || [])]);
    for (let i = 0; i + 1 < X.length; i++) {
      for (let k = 0; k + 1 < Y.length; k++) {
        const xa = X[i], xb = X[i + 1], ya = Y[k], yb = Y[k + 1];
        if (holes.some((h) => xa >= h[0] && xb <= h[1] && ya >= h[2] && yb <= h[3])) continue;
        b.poly([[xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z]], [0, 0, nz]);
      }
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
   * The honeycomb
   * ------------------------------------------------------------------ */

  // The hexagons of a floor are the points (q, r) of a honeycomb: point (q, r) stands at
  // q × e0 + r × e1, where e0 points east (+x) and e1 60° round from it towards +z (south), each as
  // long as the distance between two hexagons. Its six neighbours lie in the directions DIRS[0…5],
  // at 0°, 60°, … 300° from east (east, south-east, south-west, west, north-west, north-east).
  //
  // One point in seven is a hub (a stair hexagon): those where 3q + r is a multiple of 7, counting
  // from any hub. They are the points a × (2, 1) + b × (−1, 3): a clusters east and b rows south.
  // The six neighbours of a hub are its petals, hexagons of books: petal k lies in direction k.
  // Petal k has a door facing its hub (direction k + 3) and another in direction k + 1, which gives
  // onto petal k + 3 of the cluster 2 × DIRS[k] + DIRS[k + 1] away. So each cluster is joined to the
  // six clusters round it, and every hexagon of a floor can be reached from every other.
  const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const KINDS = [6, 1, 5, 0, 3, 2, 4]; // by (3q + r) mod 7: the petal a point is, or 6 for a hub
  const SPAN = 1 << 20; // sites are numbered q + r × SPAN, so that a step on the honeycomb is a sum
  const mod = (v, m) => ((v % m) + m) % m;

  const Honeycomb = {
    DIRS, SPAN, HUB: 6,
    /** The number of the site (q, r), and back. */
    id(q, r) { return q + r * SPAN; },
    at(id) { const r = Math.round(id / SPAN); return [id - r * SPAN, r]; },
    /** What stands at (q, r), counted from a hub: petal 0 to 5, or 6 for a hub. */
    kind(q, r) { return KINDS[mod(3 * q + r, 7)]; },
    /** The cluster of the hub at (q, r): [clusters east, rows south]. */
    cluster(q, r) { return [(3 * q + r) / 7, (2 * r - q) / 7]; },
    /** Where (q, r) stands on the plan, in units of the distance between hexagons: [x, z]. */
    plan(q, r) { return [q + r / 2, (r * SQ3) / 2]; },
    /** The angle of direction k (radians from +x towards +z). */
    angle(k) { return (mod(k, 6) * Math.PI) / 3; },
    /** How a petal's cell is turned: its +x points at its hub. */
    turn(petal) { return (mod(petal + 3, 6) * Math.PI) / 3; },
    /**
     * The sites a reader can walk to from a site of this kind, through its doors:
     * [{ dir, step: the number to add to the site's, kind }], a hub's petals in order.
     */
    doors(kind) {
      if (kind === 6) return DIRS.map((v, k) => ({ dir: k, step: Honeycomb.id(v[0], v[1]), kind: k }));
      const hub = mod(kind + 3, 6), out = mod(kind + 1, 6);
      return [
        { dir: hub, step: Honeycomb.id(DIRS[hub][0], DIRS[hub][1]), kind: 6 },
        { dir: out, step: Honeycomb.id(DIRS[out][0], DIRS[out][1]), kind: hub },
      ];
    },
  };

  /** A point (x, z) seen from a frame at (f.x, f.z) turned by f.turn (its cosine and sine in f.c and f.s). */
  function intoFrame(f, x, z) {
    const X = x - f.x, Z = z - f.z;
    return [X * f.c + Z * f.s, -X * f.s + Z * f.c];
  }

  /** A frame at (x, z) turned by `turn` (radians from +x towards +z), for intoFrame. */
  function frameAt(x, z, turn) { return { x, z, turn, c: Math.cos(turn), s: Math.sin(turn) }; }

  /** The directions (x, z) of a room's doors in its own frame: towards its vestibule, then towards its passage. */
  function doorDirections(d) {
    return [1, 0, Math.cos(d.passageTurn), Math.sin(d.passageTurn)];
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
      // on the sides with doors, the edge is divided where the doorway's floor meets it
      const outer = [v0];
      if (d.freeSides.includes(k)) {
        const len = Math.hypot(v1[0] - v0[0], v1[1] - v0[1]), t = (len / 2 - d.hallW / 2) / len;
        outer.push([v0[0] + (v1[0] - v0[0]) * t, v0[1] + (v1[1] - v0[1]) * t], [v1[0] + (v0[0] - v1[0]) * t, v1[1] + (v0[1] - v1[1]) * t]);
      }
      outer.push(v1);
      tiles.poly([[s0[0], 0, s0[1]], ...outer.map((v) => [v[0], 0, v[1]]), [s1[0], 0, s1[1]]], [0, 1, 0]);
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

    // The six sides. Above the bookcases, if the ceiling is higher than they are, plaster.
    const above = d.roomH > d.shelfTop + 0.01;
    for (let j = 0; j < 6; j++) {
      const m = sideMatrix(j);
      const free = d.freeSides.includes(j);
      const half = d.sIn / 2;
      const wallIndex = d.shelvedSides.indexOf(j); // −1 for a bare wall
      if (free) {
        freeSide(d, m, wood, plaster, tiles);
      } else if (wallIndex >= 0) {
        buildShelfUnit(wood, m, d);
        // the lamp above the bookcase: a bar on two arms from the wall (its glowing underside is the World's, lit or not)
        wallLamp(d, m, wood);
        if (above) {
          // plaster from the top of the bookcase to the ceiling, and a moulding where they meet
          plaster.setMatrix(m);
          plaster.poly([[-half, d.shelfTop, d.aIn], [half, d.shelfTop, d.aIn], [half, d.roomH, d.aIn], [-half, d.roomH, d.aIn]], [0, 0, -1]);
          plaster.reset();
          wood.setMatrix(m);
          wood.box(-half, d.roomH - 0.08, d.aIn - 0.03, half, d.roomH, d.aIn, 'yz');
          wood.reset();
        }
      } else {
        plaster.setMatrix(m);
        plaster.poly([[-half, 0, d.aIn], [half, 0, d.aIn], [half, d.roomH, d.aIn], [-half, d.roomH, d.aIn]], [0, 0, -1]);
        plaster.reset();
        wood.setMatrix(m);
        wood.box(-half, 0, d.aIn - 0.02, half, 0.11, d.aIn, 'Yz');
        wood.box(-half, d.roomH - 0.08, d.aIn - 0.03, half, d.roomH, d.aIn, 'yz');
        wood.reset();
      }
      if (above) {
        // the line of the bookcases' cornice, carried round the room above the doors and any bare walls
        wood.setMatrix(m);
        if (wallIndex >= 0) wood.box(-half, d.shelfTop, d.aIn - 0.035, half, d.shelfTop + 0.03, d.aIn, 'Yz');
        else wood.box(-half, d.shelfTop - d.cornice, d.aIn - 0.035, half, d.shelfTop + 0.03, d.aIn, 'yYz');
        wood.reset();
      }
    }
    return { wood: wood.geometry(), plaster: plaster.geometry(), tiles: tiles.geometry() };
  }

  /** A side with a doorway: the wall round it, the passage through the wall's thickness, the door's frame. */
  function freeSide(d, m, wood, plaster, tiles) {
    const half = d.sIn / 2;
    plaster.setMatrix(m);
    const hw = d.hallW / 2;
    gridWall(plaster, -half, half, 0, d.roomH, d.aIn, -1, [[-hw, hw, 0, d.doorH]]);
    // door reveal (the passage through the thickness of the wall), divided where the vestibule's walls are, which it meets
    plaster.poly([[-hw, 0, d.aIn], [-hw, 0, d.a], [-hw, d.closetH, d.a], [-hw, d.doorH, d.a], [-hw, d.doorH, d.aIn]], [1, 0, 0]);
    plaster.poly([[hw, 0, d.aIn], [hw, 0, d.a], [hw, d.closetH, d.a], [hw, d.doorH, d.a], [hw, d.doorH, d.aIn]], [-1, 0, 0]);
    plaster.poly([[-hw, d.doorH, d.aIn], [hw, d.doorH, d.aIn], [hw, d.doorH, d.a], [-hw, d.doorH, d.a]], [0, -1, 0]);
    plaster.reset();
    tiles.setMatrix(m);
    tiles.poly([[-hw, 0, d.aIn], [hw, 0, d.aIn], [hw, 0, d.a], [-hw, 0, d.a]], [0, 1, 0]);
    tiles.reset();
    // door frame and skirting
    wood.setMatrix(m);
    // the vestibule's skirting boards, run on through the doorway up to its frame
    wood.box(-hw, 0, d.aIn, -hw + 0.02, 0.1, d.a, 'XYz');
    wood.box(hw - 0.02, 0, d.aIn, hw, 0.1, d.a, 'xYz');
    wood.box(-hw - 0.07, 0, d.aIn - 0.025, -hw, d.doorH + 0.07, d.aIn, 'xXyYz');
    wood.box(hw, 0, d.aIn - 0.025, hw + 0.07, d.doorH + 0.07, d.aIn, 'xXyYz');
    wood.box(-hw, d.doorH, d.aIn - 0.025, hw, d.doorH + 0.07, d.aIn, 'yYz');
    wood.box(-half, 0, d.aIn - 0.02, -hw - 0.07, 0.11, d.aIn, 'Yz');
    wood.box(hw + 0.07, 0, d.aIn - 0.02, half, 0.11, d.aIn, 'Yz');
    wood.box(-half, d.roomH - 0.08, d.aIn - 0.03, half, d.roomH, d.aIn, 'yz');
    wood.reset();
  }

  /** A lamp on the wall of side matrix m, like those above the bookcases: its bar on two arms. */
  function wallLamp(d, m, wood) {
    const y = d.lampY, z = d.aIn - d.lampOut, lw = d.lampHalfW;
    wood.setMatrix(m);
    wood.box(-lw - 0.01, y, z - 0.025, lw + 0.01, y + 0.045, z + 0.025, 'xXyYzZ');
    for (const ax of [-lw * 0.6, lw * 0.6]) wood.box(ax - 0.008, y + 0.015, z + 0.025, ax + 0.008, y + 0.03, d.aIn, 'xXyYz');
    wood.reset();
  }

  /**
   * A hub: a hexagon with a door in each side and no books, and in its middle the round drum
   * of the spiral stair, whose doorway faces −z, a corner of the hexagon. (The stair itself,
   * inside the drum, is buildStair's.) Lamps hang above every other door, and above the drum's.
   */
  function buildHub(d) {
    const wood = new Builder(), plaster = new Builder(), tiles = new Builder(), glow = new Builder();
    const Ro = d.drumR, zc = d.drumZ, H = d.roomH, ow = d.openW / 2, hw = d.hallW / 2;
    const g2 = Math.acos(-zc / Ro), xe = Ro * Math.sin(g2); // half the angle the doorway's flat wall cuts from the drum; half that wall's width
    const A0 = -Math.PI / 2 + g2, A1 = (3 * Math.PI) / 2 - g2; // the round of the drum, from one end of the flat wall to the other

    // Floor and ceiling, between the drum and the walls: in thin slices, cut wherever a corner of
    // the walls, a doorway or the drum's flat wall begins, so that every piece meets its neighbours corner to corner.
    const inner = (th) => { const sn = Math.sin(th); return sn < 0 && zc / sn < Ro ? zc / sn : Ro; };
    const outer = (th) => { const k = Math.round(th / (Math.PI / 3)); return d.aIn / Math.cos(th - (k * Math.PI) / 3); };
    const cuts = [];
    for (let k = 0; k < 6; k++) {
      const c = (k * Math.PI) / 3, da = Math.atan(hw / d.aIn);
      cuts.push(c - Math.PI / 6, c - da, c + da);
    }
    cuts.push(A0, A0 - 2 * g2, Math.atan2(zc, ow), Math.atan2(zc, -ow));
    for (let i = 0; i < 96; i++) cuts.push((2 * Math.PI * i) / 96);
    const TAU = 2 * Math.PI;
    const angles = [...new Set(cuts.map((a) => +(((a % TAU) + TAU) % TAU).toFixed(9)))].sort((a, b) => a - b);
    angles.push(angles[0] + TAU);
    const at = (r, th, y) => [r * Math.cos(th), y, r * Math.sin(th)];
    for (let i = 0; i + 1 < angles.length; i++) {
      const t0 = angles[i], t1 = angles[i + 1];
      if (t1 - t0 < 1e-7) continue;
      // (the walls' corners lie at odd multiples of 30°, where `outer` changes sides: each slice is taken at its own middle's side)
      const km = Math.round((t0 + t1) / 2 / (Math.PI / 3)), out = (th) => d.aIn / Math.cos(th - (km * Math.PI) / 3);
      const mid = (t0 + t1) / 2, flat = Math.sin(mid) < 0 && zc / Math.sin(mid) < Ro, inn = (th) => (flat ? zc / Math.sin(th) : Ro);
      tiles.poly([at(inn(t0), t0, 0), at(out(t0), t0, 0), at(out(t1), t1, 0), at(inn(t1), t1, 0)], [0, 1, 0]);
      plaster.poly([at(inn(t0), t0, H), at(out(t0), t0, H), at(out(t1), t1, H), at(inn(t1), t1, H)], [0, -1, 0]);
    }
    void inner; void outer;

    // the six sides, each with its door; above the doors, the line of the bookcases' cornice, as in the other hexagons
    const above = d.roomH > d.shelfTop + 0.01, half = d.sIn / 2;
    for (let j = 0; j < 6; j++) {
      const m = sideMatrix(j);
      freeSide(d, m, wood, plaster, tiles);
      if (above) {
        wood.setMatrix(m);
        wood.box(-half, d.shelfTop - d.cornice, d.aIn - 0.035, half, d.shelfTop + 0.03, d.aIn, 'yYz');
        wood.reset();
      }
      if (d.hubLamps.includes(j)) {
        wallLamp(d, m, wood);
        const lw = d.lampHalfW, z = d.aIn - d.lampOut;
        glow.setMatrix(m);
        glow.box(-lw, d.lampY - 0.002, z - 0.016, lw, d.lampY, z + 0.016, 'y');
        glow.reset();
      }
    }

    // the drum: its round wall, and the flat one its doorway is cut in
    plaster.cylinder(0, 0, Ro, A0, A1, 0, H, false, 64);
    gridWall(plaster, -xe, xe, 0, H, zc, -1, [[-ow, ow, 0, d.doorH]]);
    // skirting and a moulding under the ceiling, round the drum
    wood.cylinder(0, 0, Ro + 0.02, A0, A1, 0, 0.1, false, 64);
    wood.sector(0, 0, Ro, Ro + 0.02, A0, A1, 0.1, 1, undefined, 64);
    wood.cylinder(0, 0, Ro + 0.03, A0, A1, H - 0.08, H, false, 64);
    wood.sector(0, 0, Ro, Ro + 0.03, A0, A1, H - 0.08, -1, undefined, 64);
    wood.box(-xe, 0, zc - 0.02, -ow - 0.06, 0.1, zc, 'Yz');
    wood.box(ow + 0.06, 0, zc - 0.02, xe, 0.1, zc, 'Yz');
    wood.box(-xe, H - 0.08, zc - 0.03, xe, H, zc, 'yz');
    // the frame of the doorway
    wood.box(-ow - 0.06, 0, zc - 0.025, -ow, d.doorH + 0.06, zc, 'xXYz');
    wood.box(ow, 0, zc - 0.025, ow + 0.06, d.doorH + 0.06, zc, 'xXYz');
    wood.box(-ow, d.doorH, zc - 0.025, ow, d.doorH + 0.06, zc, 'yz');
    // and the lamp above it
    {
      const y = Math.min(d.lampY, H - 0.12), z = zc - d.lampOut, lw = Math.min(d.lampHalfW, ow);
      wood.box(-lw - 0.01, y, z - 0.025, lw + 0.01, y + 0.045, z + 0.025, 'xXyYzZ');
      for (const ax of [-lw * 0.6, lw * 0.6]) wood.box(ax - 0.008, y + 0.015, z + 0.025, ax + 0.008, y + 0.03, zc, 'xXyYZ');
      glow.box(-lw, y - 0.002, z - 0.016, lw, y, z + 0.016, 'y');
    }
    return { wood: wood.geometry(), plaster: plaster.geometry(), tiles: tiles.geometry(), glow: glow.geometry() };
  }

  /** Where the light of each of a hub's lamps comes from, in the hub's coordinates. */
  function hubLights(d) {
    const out = d.hubLamps.map((j) => {
      const f = (j * Math.PI) / 3, r = d.aIn - d.lampOut - 0.15;
      return new THREE.Vector3(r * Math.cos(f), d.lampY - 0.05, r * Math.sin(f));
    });
    out.push(new THREE.Vector3(0, Math.min(d.lampY, d.roomH - 0.12) - 0.05, d.drumZ - d.lampOut - 0.15));
    return out;
  }

  function buildShelfUnit(wood, m, d) {
    wood.setMatrix(m);
    const L = d.shelfLen / 2, half = d.sIn / 2;
    const front = d.aIn, back = d.a;
    // back panel
    wood.poly([[-L, 0, back - 0.02], [L, 0, back - 0.02], [L, d.shelfTop, back - 0.02], [-L, d.shelfTop, back - 0.02]], [0, 0, -1]);
    // end posts, with the panelling beside the shelves (they meet the neighbouring wall's at the corner)
    wood.box(-half, 0, front, -L, d.shelfTop, back, 'Xz');
    wood.box(L, 0, front, half, d.shelfTop, back, 'xz');
    // plinth
    wood.box(-L, 0, front + 0.015, L, d.base, back, 'Yz');
    // the pilasters between bays, standing a little proud of the shelves, and the shelves of each bay
    for (let k = 0; k < d.bays; k++) {
      const x1 = L - k * (d.bayLen + d.pilasterW), x0 = x1 - d.bayLen;
      if (k > 0) wood.box(x1, d.base, front - 0.02, x1 + d.pilasterW, d.shelfTop - d.cornice, back - 0.02, 'xXz');
      for (let i = 0; i <= d.shelves; i++) {
        const y = d.base + i * d.pitch;
        wood.box(x0, y, front, x1, y + d.board, back - 0.02, i === 0 ? 'Yz' : 'yYz');
      }
    }
    // cornice
    const top = d.base + d.shelves * d.pitch + d.board;
    wood.box(-half, top, front - 0.035, half, d.shelfTop, back, 'yz');
    wood.reset();
  }

  /**
   * The glowing underside of a lamp above a bookcase, in the frame of the wall it hangs on (x
   * along the wall, z towards it): the World turns one to each bookcase, so each can be lit apart.
   */
  function buildLampGlow(d) {
    const b = new Builder(), y = d.lampY, z = d.aIn - d.lampOut, lw = d.lampHalfW;
    b.box(-lw, y - 0.002, z - 0.016, lw, y, z + 0.016, 'y');
    return b.geometry();
  }

  /**
   * The wash of light on the wall round a lamp above a bookcase, in the same frame as its glowing
   * underside: from the top of the bookcase (below which the cornice would hide it) up the plaster.
   */
  function buildLampWash(d) {
    const lw = d.lampHalfW, yc = d.lampY + 0.02, z = d.aIn - 0.002;
    const yA = yc - lw, yB = yc + lw; // the texture's extent: the bar across its middle
    const y0 = Math.max(yA, d.shelfTop + 0.03), y1 = Math.min(yB, d.roomH - 0.08), v0 = (y0 - yA) / (yB - yA), v1 = (y1 - yA) / (yB - yA);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-2 * lw, y0, z, 2 * lw, y0, z, 2 * lw, y1, z, -2 * lw, y1, z], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, v0, 1, v0, 1, v1, 0, v1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    return g;
  }

  /** Where the light of each lamp above a bookcase comes from, in cell coordinates: a little in front of and below it, where it shines. */
  function lampLights(d) {
    return d.shelvedSides.map((j) => {
      const f = (j * Math.PI) / 3, r = d.aIn - d.lampOut - 0.15;
      return new THREE.Vector3(r * Math.cos(f), d.lampY - 0.05, r * Math.sin(f));
    });
  }

  /** A passage's frame turned half round about its middle: where things of the hexagon at its other end stand. */
  function otherEnd(d) {
    return new THREE.Matrix4().makeRotationY(Math.PI).setPosition(d.Dx, 0, 0);
  }

  /** The glowing undersides of the picture lamps in a passage. */
  function buildPictureGlow(d) {
    const b = new Builder(), L = d.painting.lamp;
    b.box(L.x - L.halfW, L.y - 0.002, L.z - 0.016, L.x + L.halfW, L.y, L.z + 0.016, 'y');
    b.setMatrix(otherEnd(d));
    b.box(L.x - L.halfW, L.y - 0.002, L.z - 0.016, L.x + L.halfW, L.y, L.z + 0.016, 'y');
    b.reset();
    return b.geometry();
  }

  /* ------------------------------------------------------------------ *
   * Vestibule: closets, mirror; and the spiral stair
   * ------------------------------------------------------------------ */

  /**
   * A vestibule, from the hexagon at the origin east (+x) to the next. `plain`: the passage
   * between two clusters, with nothing along its walls; otherwise the vestibule between a
   * hexagon of books and its hub, with the cell's door and the mirror on its south wall (−z),
   * the catalogue's niche and the painting on its north wall.
   */
  function buildVestibule(d, plain) {
    const wood = new Builder(), plaster = new Builder(), tiles = new Builder();
    const x0 = d.hallX0, x1 = d.hallX1, hw = d.hallW / 2, H = d.roomH;

    tiles.poly([[x0, 0, -hw], [x1, 0, -hw], [x1, 0, hw], [x0, 0, hw]], [0, 1, 0]);
    plaster.poly([[x0, H, -hw], [x1, H, -hw], [x1, H, hw], [x0, H, hw]], [0, -1, 0]);
    // end walls above the doors
    plaster.poly([[x0, d.doorH, -hw], [x0, d.doorH, hw], [x0, H, hw], [x0, H, -hw]], [1, 0, 0]);
    plaster.poly([[x1, d.doorH, -hw], [x1, d.doorH, hw], [x1, H, hw], [x1, H, -hw]], [-1, 0, 0]);
    // the lintels over the two doorways, and the boards of their signs
    const ld = d.lintelDepth, sd = d.signDepth, sw = d.signW / 2 + 0.012, sh = d.signH / 2 + 0.012, sy = d.signY;
    wood.box(x0, d.doorH, -hw, x0 + ld, d.doorH + d.lintelH, hw, 'XyY');
    wood.box(x1 - ld, d.doorH, -hw, x1, d.doorH + d.lintelH, hw, 'xyY');
    wood.box(x0 + ld, sy - sh, -sw, x0 + ld + sd, sy + sh, sw, 'XyYzZ');
    wood.box(x1 - ld - sd, sy - sh, -sw, x1 - ld, sy + sh, sw, 'xyYzZ');
    const dx0 = d.hingeX, dx1 = d.hingeX + d.closetW, dH = d.closetH, cz0 = d.cellZ0;
    const nx0 = d.nicheX - d.closetW / 2, nx1 = d.nicheX + d.closetW / 2;
    if (plain) {
      // bare walls (divided at the heights where the doorways' own walls are), and their skirting boards
      gridWall(plaster, x0, x1, 0, H, -hw, 1, [], [dH, d.doorH]);
      gridWall(plaster, x0, x1, 0, H, hw, -1, [], [dH, d.doorH]);
      wood.box(x0, 0, -hw, x1, 0.1, -hw + 0.02, 'YZ');
      wood.box(x0, 0, hw - 0.02, x1, 0.1, hw, 'Yz');
      // the paintings of the two hexagons it joins, each on the right as one leaves its hexagon,
      // a third of the way along: this one's on the north wall (+z), the other's, turned half
      // round about the passage's middle, on the south wall
      if (d.painting) {
        for (const m of [null, otherEnd(d)]) {
          if (m) wood.setMatrix(m);
          const p = d.painting, px0 = p.x - p.w / 2, px1 = p.x + p.w / 2, py0 = p.y - p.h / 2, py1 = p.y + p.h / 2;
          const pw = p.frame, pz = hw - p.depth;
          wood.box(px0 - pw, py0 - pw, pz, px1 + pw, py0, hw, 'xXyYz');
          wood.box(px0 - pw, py1, pz, px1 + pw, py1 + pw, hw, 'xXyYz');
          wood.box(px0 - pw, py0, pz, px0, py1, hw, 'xXz');
          wood.box(px1, py0, pz, px1 + pw, py1, hw, 'xXz');
          const L = p.lamp;
          wood.box(L.x - L.halfW - 0.01, L.y, L.z - 0.025, L.x + L.halfW + 0.01, L.y + 0.045, L.z + 0.025, 'xXyYzZ');
          for (const ax of [L.x - L.halfW * 0.6, L.x + L.halfW * 0.6]) wood.box(ax - 0.008, L.y + 0.015, L.z + 0.025, ax + 0.008, L.y + 0.03, hw, 'xXyYz');
          if (m) wood.reset();
        }
      }
      return { wood: wood.geometry(), plaster: plaster.geometry(), tiles: tiles.geometry() };
    }
    // south wall (−z): the door of the cell, then the mirror
    gridWall(plaster, x0, x1, 0, H, -hw, 1, [[dx0, dx1, 0, dH]], [d.doorH]);
    // the doorway through the thickness of the wall, and its threshold
    plaster.poly([[dx0, 0, -hw], [dx0, 0, cz0], [dx0, dH, cz0], [dx0, dH, -hw]], [1, 0, 0]);
    plaster.poly([[dx1, 0, -hw], [dx1, 0, cz0], [dx1, dH, cz0], [dx1, dH, -hw]], [-1, 0, 0]);
    plaster.poly([[dx0, dH, -hw], [dx1, dH, -hw], [dx1, dH, cz0], [dx0, dH, cz0]], [0, -1, 0]);
    wood.box(dx0, 0, cz0, dx1, 0.012, -hw, 'YzZ');
    // north wall (+z): the niche of the catalogue, then the painting
    gridWall(plaster, x0, x1, 0, H, hw, -1, [[nx0, nx1, 0, dH]], [d.doorH]);

    // skirting boards
    wood.box(x0, 0, -hw, dx0 - 0.06, 0.1, -hw + 0.02, 'YZX');
    wood.box(dx1 + 0.06, 0, -hw, x1, 0.1, -hw + 0.02, 'YZx');
    wood.box(x0, 0, hw - 0.02, nx0 - 0.06, 0.1, hw, 'YzX');
    wood.box(nx1 + 0.06, 0, hw - 0.02, x1, 0.1, hw, 'Yzx');
    // frame around the door of the cell (its leaf is a separate, moving object)
    wood.box(dx0 - 0.06, 0, -hw, dx0, dH + 0.06, -hw + 0.045, 'xXYZ');
    wood.box(dx1, 0, -hw, dx1 + 0.06, dH + 0.06, -hw + 0.045, 'xXYZ');
    wood.box(dx0, dH, -hw, dx1, dH + 0.06, -hw + 0.045, 'yYZ');

    // frame of the niche opposite
    wood.box(nx0 - 0.06, 0, hw - 0.045, nx0, dH + 0.06, hw, 'xXYz');
    wood.box(nx1, 0, hw - 0.045, nx1 + 0.06, dH + 0.06, hw, 'xXYz');
    wood.box(nx0, dH, hw - 0.045, nx1, dH + 0.06, hw, 'yYz');

    // mirror frame on the south wall, beside the door of the cell
    const mx0 = d.mirrorX - d.mirrorW / 2, mx1 = d.mirrorX + d.mirrorW / 2, my0 = d.mirrorY0, my1 = d.mirrorY0 + d.mirrorH;
    const fw = 0.07, fz = -hw + 0.04;
    wood.box(mx0 - fw, my0 - fw, -hw, mx1 + fw, my0, fz, 'xXyYZ');
    wood.box(mx0 - fw, my1, -hw, mx1 + fw, my1 + fw, fz, 'xXyYZ');
    wood.box(mx0 - fw, my0, -hw, mx0, my1, fz, 'xXZ');
    wood.box(mx1, my0, -hw, mx1 + fw, my1, fz, 'xXZ');
    return { wood: wood.geometry(), plaster: plaster.geometry(), tiles: tiles.geometry() };
  }

  /**
   * The spiral stair in its well, built about (wellX, wellZ) with its doorway in the plane
   * z = hallW / 2, facing −z: the well's wall seen from inside, the column, the landing and the treads.
   */
  function buildStair(d) {
    const ox0 = d.wellX - d.openW / 2, ox1 = d.wellX + d.openW / 2;
    // ---- the stairwell ----
    const well = new Builder(), steps = new Builder();
    const cx = d.wellX, cz = d.wellZ, R = d.wellR, zc = d.hallW / 2;
    const gamma = Math.asin(d.openW / 2 / R); // half-angle of the cap cut by the vestibule wall
    // round wall, everywhere except where it meets the vestibule; from this floor up to the next,
    // where the next floor's begins (behind the slab of a landing runs the wall of the floor below:
    // were the two to overlap there, they would flicker as each showed through the other)
    well.cylinder(cx, cz, R, -Math.PI / 2 + gamma, (3 * Math.PI) / 2 - gamma, 0, d.Hf, true, 64);
    // flat wall above the opening (stair side)
    well.poly([[ox0, d.doorH, zc], [ox1, d.doorH, zc], [ox1, d.Hf, zc], [ox0, d.Hf, zc]], [0, 0, 1]);
    // central column, likewise from floor to floor
    steps.cylinder(cx, cz, d.colR, 0, 2 * Math.PI, 0, d.Hf, false, 20);
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

    return { well: well.geometry(), steps: steps.geometry() };
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
    const hw = d.hallW / 2, x0 = d.nicheX - d.closetW / 2, x1 = d.nicheX + d.closetW / 2;
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

  /** The names of the six directions of the honeycomb, as the signs give them, by direction (see Honeycomb). */
  const WAYS = ['EAST', 'SOUTH-EAST', 'SOUTH-WEST', 'WEST', 'NORTH-WEST', 'NORTH-EAST'];

  /**
   * The faces of the two signs of a vestibule that heads in direction `way` of the honeycomb,
   * textured from the signs' texture, where the six directions' names are one above the other:
   * over its far doorway the name of the way it heads, over its near one the name of the way back.
   */
  function buildSignFaces(d, way) {
    const off = d.lintelDepth + d.signDepth + 0.0015;
    const yb = d.signY - d.signH / 2, yt = d.signY + d.signH / 2, w = d.signW / 2;
    const pos = [], nor = [], uv = [], idx = [];
    const quad = (x, nx, zLeft, zRight, row) => {
      const b = pos.length / 3, v0 = 1 - (row + 1) / 6, v1 = 1 - row / 6;
      // bottom left, bottom right, top right, top left, as the reader facing the sign sees them
      pos.push(x, yb, zLeft, x, yb, zRight, x, yt, zRight, x, yt, zLeft);
      for (let i = 0; i < 4; i++) nor.push(nx, 0, 0);
      uv.push(0, v0, 1, v0, 1, v1, 0, v1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    quad(d.hallX1 - off, -1, -w, w, way % 6); // read facing +x, where +z is on the right
    quad(d.hallX0 + off, 1, w, -w, (way + 3) % 6); // read facing −x, where −z is on the right
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  /**
   * Where the painting hangs:  /**
   * Where a hexagon's painting hangs: in the passage that leaves by its other door, on the
   * right as one leaves (the north wall, +z), a third of the way along, as large as the wall
   * allows for a picture of the given proportions (width ÷ height), and no more than 0.9 m high.
   */
  function paintingPlace(d, aspect) {
    const x = d.hallX0 + d.hallLen / 3, half = Math.min(x - d.hallX0 - 0.3, 1.1); // short of the doorway
    const frame = 0.045, margin = 0.035;
    let w = 2 * (half - frame - margin), h = w / aspect;
    if (h > 0.9) { h = 0.9; w = h * aspect; }
    const y = 1.4;
    // a picture lamp on two arms above the frame, its light falling on the canvas
    const lampY = y + h / 2 + frame + 0.07, lampZ = d.hallW / 2 - 0.145;
    return { x, y, w, h, frame, depth: 0.035, z: d.hallW / 2 - 0.016, lamp: { x, y: lampY, z: lampZ, halfW: Math.min(0.17, w / 2 - 0.05) } };
  }

  /**
   * The canvas of a hexagon's painting, facing south, in the frame of its passage. Its texture's first row
   * is the painting's top row, and its first column the left one as the reader sees it.
   */
  function buildCanvas(d) {
    const p = d.painting, xl = p.x + p.w / 2, xr = p.x - p.w / 2, yt = p.y + p.h / 2, yb = p.y - p.h / 2;
    const g = new THREE.BufferGeometry();
    // facing −z, the reader's left is +x
    g.setAttribute('position', new THREE.Float32BufferAttribute([xl, yt, p.z, xl, yb, p.z, xr, yb, p.z, xr, yt, p.z], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
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
    #ifndef NLIGHTS
      #define NLIGHTS 4
    #endif
    uniform vec4 uLights[NLIGHTS];
    uniform vec3 uLightColors[NLIGHTS];
    uniform float uGain[NLIGHTS]; // per light, for lights that can be dimmed or shut off
    uniform float uDown[NLIGHTS]; // per light: 1 for a lamp that shines down from under its shade, 0 for one that shines all round
    uniform float uAmbient;
    uniform float uFalloff;
    uniform float uExposure;
    vec3 lampLight(vec3 p, vec3 n) {
      vec3 sum = vec3(uAmbient);
      for (int i = 0; i < NLIGHTS; i++) {
        vec3 L = uLights[i].xyz - p;
        float d2 = max(dot(L, L), 0.01);
        float ndl = dot(n, L) * inversesqrt(d2);
        float wrap = clamp((ndl + 0.25) / 1.25, 0.0, 1.0);
        // under its shade, a lamp lights what is below it; what is above, only a little
        float down = mix(1.0, 0.3 + 0.7 * smoothstep(-0.15, 0.35, L.y * inversesqrt(d2)), uDown[i]);
        sum += uLightColors[i] * (uLights[i].w * uGain[i] * wrap * down / (1.0 + d2 * uFalloff));
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
    #ifdef PATINA
      // What time and use have done to this hexagon, the same on every visit (see World._look).
      // PATINA is 1 for plaster, 2 for wood, 3 for floor tiles.
      uniform vec4 uSeed; // where the texture starts (xy), how plaster is turned (z), a seed for the stains (w)
      uniform vec4 uPatina; // by kind: plaster (damp, tide line, stains, soot); wood (shade rgb, grime); tiles (wear, side, ink)
      uniform vec4 uSeedEast, uPatinaEast; // the same, of the hexagon at a vestibule's far end, which it turns into towards that end
      uniform vec4 uPath; // the middle of the walkway round the shaft (x), where the hexagon gives onto its vestibule (y) and the vestibule onto the next hexagon (z)
      float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
      float vnoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                   mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.07 + 7.1) + 0.15 * vnoise(p * 4.13 + 3.7); }
    #endif
    ${LIGHTING_GLSL}
    #ifdef DOORS
      // Through its doorways, a hexagon's light gives way to the light of the vestibule beyond:
      // from where a doorway begins, its own lamps fade, and where the vestibule begins, the
      // vestibule's light holds alone. So floor and walls are lit alike either side of a threshold.
      uniform vec4 uVesLights[4]; // a vestibule's lights, in the frame of the hexagon of books it belongs to (the first two, those of the hexagons at its ends)
      uniform vec3 uVesColors[4];
      uniform vec4 uPasLights[4]; // and a passage's (a hub's doors give onto the far ends of vestibules: theirs)
      uniform vec3 uPasColors[4];
      uniform vec4 uVesDown; // which of their lights shine down from under a shade (see uDown)
      uniform vec4 uPasDown;
      uniform vec2 uDoorLight; // the ambient light (x) and the falloff of the lamps (y) of vestibules and passages, whatever this room's
      uniform vec4 uVesGains; // how brightly the lights at a vestibule's two ends burn: this hexagon's own vestibule (xy: its end, the hub's), and the other (zw: the far end, this one)
      uniform vec4 uDoors; // how far from the hexagon's middle the change begins (x) and ends (y); the distance from one hexagon to the next (z); half a doorway's width (w)
      uniform vec4 uDoorDirs; // in a hexagon of books, the direction (x, z) of its door into its own vestibule (xy) and of the one into its passage (zw)
      // The nearer doorway of a room: its direction (x, z), and whether it is the door into the room's own vestibule (z = 1)
      vec3 nearDoor(vec3 p) {
        #ifdef HUB
          // a hub has a door every 60°, each giving onto the far end of a vestibule
          float f = floor(atan(p.z, p.x) / 1.0471975512 + 0.5) * 1.0471975512;
          return vec3(cos(f), sin(f), 0.0);
        #else
          return dot(p.xz, uDoorDirs.xy) >= dot(p.xz, uDoorDirs.zw) ? vec3(uDoorDirs.xy, 1.0) : vec3(uDoorDirs.zw, 0.0);
        #endif
      }
      // A point of the room seen from that doorway: how far towards it (x), how far to its left (z), and whether it is the door into the room's own vestibule (w)
      vec4 doorway(vec3 p) {
        vec3 u = nearDoor(p);
        return vec4(dot(p.xz, u.xy), p.y, dot(p.xz, vec2(-u.y, u.x)), u.z);
      }
      // The same point in the frame of the vestibule beyond that doorway (which is its own hexagon's, span metres beyond this room if this is the vestibule's far end)
      vec3 beyond(vec4 q, float span) { return q.w > 0.5 ? q.xyz : vec3(span - q.x, q.y, -q.z); }
      vec3 vesLamp(vec4 l, vec3 c, vec3 p, vec3 n, float shade) {
        vec3 L = l.xyz - p;
        float d2 = max(dot(L, L), 0.01);
        float wrap = clamp((dot(n, L) * inversesqrt(d2) + 0.25) / 1.25, 0.0, 1.0);
        float down = mix(1.0, 0.3 + 0.7 * smoothstep(-0.15, 0.35, L.y * inversesqrt(d2)), shade); // as lampLight
        return c * (l.w * wrap * down / (1.0 + d2 * uDoorLight.y));
      }
    #endif
    #include <fog_pars_fragment>
    // texture coordinates: the floor's and ceiling's own, or along a wall and up it
    vec2 uvAt(vec3 p, vec3 n) {
      if (abs(n.y) > 0.6) return p.xz;
      vec3 t = normalize(vec3(-n.z, 0.0, n.x));
      return vec2(dot(p, t), p.y);
    }
    #ifdef PATINA
      #if PATINA == 3
        uniform vec4 uTileFrame; // how this part of the floor lies on the floor's plan: its turn (cosine, sine) and where its origin falls in the tiles' pattern
      #endif
      #if PATINA == 1
        // plaster has no grain to keep upright, so each hexagon's is turned its own way
        vec3 plasterAt(vec2 uv, vec4 seed) {
          return texture2D(map, mat2(cos(seed.z), sin(seed.z), -sin(seed.z), cos(seed.z)) * uv * uScale + seed.xy).rgb;
        }
      #endif
    #endif
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec2 uv = uvAt(vLocal, n);
      #ifdef PATINA
        // along a vestibule, from its own hexagon (0) to the next (1)
        float along = smoothstep(uPath.y, uPath.z, vLocal.x);
        // away from the doorways (1), where nothing that marks one hexagon alone comes up to the threshold (0)
        #ifdef DOORS
          float own = smoothstep(0.0, 0.35, abs(doorway(vLocal).x - uPath.y));
        #else
          float own = smoothstep(0.0, 0.35, min(abs(abs(vLocal.x) - uPath.y), abs(vLocal.x - uPath.z)));
        #endif
        #if PATINA == 1
          vec3 base = plasterAt(uv, uSeed);
          // towards the east end of a vestibule, the plaster of the next hexagon, which it meets there
          float toEast = smoothstep(uPath.z - 1.0, uPath.z, vLocal.x);
          if (toEast > 0.0) base = mix(base, plasterAt(uvAt(vLocal - vec3(uPath.y + uPath.z, 0.0, 0.0), n), uSeedEast), toEast);
          base *= uTint;
        #elif PATINA == 3
          // the floor's tiles, laid across the whole floor: the same pattern wherever a hexagon,
          // vestibule, passage or hub is, and however it is turned
          vec2 fp = abs(n.y) > 0.6 ? vec2(uTileFrame.x * vLocal.x - uTileFrame.y * vLocal.z, uTileFrame.y * vLocal.x + uTileFrame.x * vLocal.z) + uTileFrame.zw : uv;
          vec3 base = texture2D(map, fp * uScale).rgb * uTint;
        #else
          vec3 base = texture2D(map, uv * uScale + uSeed.xy).rgb * uTint;
        #endif
      #else
        vec3 base = texture2D(map, uv * uScale).rgb * uTint;
      #endif
      #ifdef USE_COLOR
        base *= vPaint;
      #endif
      #ifdef PATINA
        vec3 q = vLocal + uSeed.w * vec3(1.0, 0.71, 1.37);
        #if PATINA == 1
          // damp risen from the floor, below an uneven tide line; water stains, each with a darker rim; soot on the ceiling.
          // A vestibule's walls go from its hexagon's damp to the next one's, and at the doorways the tide line is even.
          vec4 pat = mix(uPatina, uPatinaEast, along);
          float line = pat.y + 0.16 * (fbm(vec3(q.x, 0.0, q.z) * 1.6) - 0.5) * own;
          float damp = pat.x * (1.0 - smoothstep(line - 0.2, line, vLocal.y));
          float tide = pat.x * (smoothstep(line - 0.05, line, vLocal.y) - smoothstep(line, line + 0.025, vLocal.y));
          float st = fbm(q * 0.85);
          float stain = pat.z * own * smoothstep(0.6, 0.7, st);
          float rim = pat.z * own * (smoothstep(0.575, 0.6, st) - smoothstep(0.6, 0.64, st));
          float soot = n.y < -0.5 ? pat.w * fbm(q * 1.2) : 0.0;
          base *= 1.0 - 0.2 * damp - 0.16 * tide - 0.1 * stain - 0.09 * rim - 0.22 * soot;
          base *= mix(vec3(1.0), vec3(0.93, 0.96, 0.86), damp); // a greenish cast where it is damp
        #elif PATINA == 2
          // the wood's own shade, and grime low down, where feet have kicked it
          // (a vestibule's going from its hexagon's to the next one's, so that its skirting boards run on into both)
          vec4 pat = mix(uPatina, uPatinaEast, along);
          base *= pat.rgb * (1.0 - pat.a * 0.2 * (1.0 - smoothstep(0.0, 0.3, vLocal.y)) * mix(0.5, fbm(q * 4.0), own));
        #elif PATINA == 3
          // A vestibule's floor wears from its hexagon's way to the next one's; and what marks one
          // hexagon's floor alone (the grain of its wear, spilt ink) stops short of the doorways. So
          // the floor runs on unbroken from each hexagon through its vestibules into the next.
          vec4 pat = mix(uPatina, uPatinaEast, along);
          // worn where feet go: round the shaft, more on one side than the other, and out through the doors
          float circuit = exp(-pow((length(vLocal.xz) - uPath.x) / 0.32, 2.0)) * mix(1.0 - pat.y, pat.y, smoothstep(-0.5, 0.5, vLocal.z));
          #ifdef DOORS
            vec4 way = doorway(vLocal);
            float hall = exp(-pow(way.z / 0.42, 2.0)) * smoothstep(uPath.x, uPath.y, way.x);
          #else
            float hall = exp(-pow(vLocal.z / 0.42, 2.0)) * smoothstep(uPath.x, uPath.y, abs(vLocal.x));
          #endif
          float worn = pat.x * max(circuit, hall) * (0.6 + 0.4 * mix(0.5, fbm(q * 5.0), own));
          base = mix(base, vec3(dot(base, vec3(0.333))) * 1.1, 0.45 * worn); // the glaze worn off: paler, flatter
          base *= 1.0 - 0.45 * pat.z * own * smoothstep(0.7, 0.76, fbm(q * 2.3 + 11.0)); // spilt ink
        #endif
      #endif
      vec3 light = lampLight(vLocal, n);
      #ifdef DOORS
        // towards a doorway, and only in front of it (not in the corners of the shelves either side)
        vec4 at = doorway(vLocal);
        float toward = smoothstep(uDoors.x, uDoors.y, at.x) * (1.0 - smoothstep(uDoors.w + 0.05, uDoors.w + 0.3, abs(at.z)));
        if (toward > 0.0) {
          // the vestibule beyond the nearer door, as it lights itself
          vec3 p = beyond(at, uDoors.z);
          vec2 u = nearDoor(vLocal).xy;
          vec3 nv = vec3(dot(n.xz, u), n.y, dot(n.xz, vec2(-u.y, u.x)));
          if (at.w < 0.5) nv.xz = -nv.xz; // seen from its far end, a vestibule faces the other way
          vec2 g = at.w > 0.5 ? uVesGains.xy : uVesGains.zw;
          vec3 lv = vec3(uDoorLight.x);
          if (at.w > 0.5) {
            lv += vesLamp(uVesLights[0], uVesColors[0] * g.x, p, nv, uVesDown.x) + vesLamp(uVesLights[1], uVesColors[1] * g.y, p, nv, uVesDown.y)
              + vesLamp(uVesLights[2], uVesColors[2], p, nv, uVesDown.z) + vesLamp(uVesLights[3], uVesColors[3], p, nv, uVesDown.w);
          } else {
            lv += vesLamp(uPasLights[0], uPasColors[0] * g.x, p, nv, uPasDown.x) + vesLamp(uPasLights[1], uPasColors[1] * g.y, p, nv, uPasDown.y)
              + vesLamp(uPasLights[2], uPasColors[2], p, nv, uPasDown.z) + vesLamp(uPasLights[3], uPasColors[3], p, nv, uPasDown.w);
          }
          light = mix(light, lv, toward);
        }
      #endif
      vec3 c = expose(base * light);
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

  const PAINT_FRAG = `
    uniform sampler2D map;
    varying vec3 vLocal;
    varying vec3 vN;
    varying vec2 vUv;
    ${LIGHTING_GLSL}
    #include <fog_pars_fragment>
    void main() {
      vec3 n = normalize(vN);
      // sharper than the mipmaps alone would have it: a million pixels of nearly random
      // colours, averaged as a screen's few hundred pixels would average them, look a
      // uniform brown; sampled more finely, they keep their colours
      vec3 c = expose(texture2D(map, vUv, -1.5).rgb * lampLight(vLocal, n));
      gl_FragColor = vec4(c + dither(gl_FragCoord.xy) / 255.0, 1.0);
      #include <fog_fragment>
    }
  `;

  const LAMP = new THREE.Color(1.0, 0.78, 0.52); // the lamps' warm light
  // The light of the shaded lamps of the hexagons at a vestibule's or passage's ends, and of the
  // picture lamps, falls downwards, as a hexagon's own lamps' does: little reaches the ceiling.
  // Only the catalogue's glow, in a vestibule, shines all round.
  const VES_DOWN = [1, 1, 1, 0], PAS_DOWN = [1, 1, 1, 1];
  const SCREEN = new THREE.Color(0.62, 0.82, 0.78); // the catalogue's cool glow

  function lightingUniforms(lights, opts) {
    const n = lights.length;
    return {
      uLights: { value: lights },
      uLightColors: { value: lights.map((_, i) => (opts.colors && opts.colors[i]) || LAMP.clone()) },
      uGain: { value: lights.map(() => 1) },
      uDown: { value: lights.map((_, i) => (opts.down && opts.down[i]) || 0) },
      uAmbient: { value: opts.ambient !== undefined ? opts.ambient : 0.05 },
      uFalloff: { value: opts.falloff !== undefined ? opts.falloff : 0.55 },
      uExposure: { value: opts.exposure !== undefined ? opts.exposure : 1.35 },
    };
  }

  /** The shaders light with four lights unless told otherwise. */
  function lightDefines(lights) {
    return lights.length === 4 ? {} : { NLIGHTS: lights.length };
  }

  function archMaterial(map, scale, tint, lights, opts) {
    opts = opts || {};
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, lightingUniforms(lights, opts), {
      map: { value: map },
      uScale: { value: new THREE.Vector2(scale[0], scale[1]) },
      uTint: { value: new THREE.Color(tint) },
    });
    const defines = lightDefines(lights);
    if (opts.cellMatrix) { defines.USE_CELL_MATRIX = ''; uniforms.uCellMatrix = { value: new THREE.Matrix4() }; }
    if (opts.patina) {
      // no patina until a hexagon gives it one (World._look)
      defines.PATINA = { plaster: 1, wood: 2, tiles: 3 }[opts.patina];
      uniforms.uSeed = { value: new THREE.Vector4(0, 0, 0, 0) };
      uniforms.uPatina = { value: opts.patina === 'wood' ? new THREE.Vector4(1, 1, 1, 0) : new THREE.Vector4(0, 0, 0, 0) };
      uniforms.uSeedEast = { value: new THREE.Vector4(0, 0, 0, 0) };
      uniforms.uPatinaEast = { value: uniforms.uPatina.value.clone() };
      uniforms.uPath = { value: opts.path || new THREE.Vector4(0, 0, 0, 0) };
      if (opts.patina === 'tiles') uniforms.uTileFrame = { value: new THREE.Vector4(1, 0, 0, 0) };
    }
    if (opts.doors) {
      // the light of the vestibules beyond a hexagon's doors, which its doorways turn into (World._applyLamps says how brightly their door lights burn)
      defines.DOORS = '';
      uniforms.uVesLights = { value: opts.doors.lights };
      uniforms.uVesColors = { value: [LAMP, LAMP, LAMP, SCREEN] };
      uniforms.uPasLights = { value: opts.doors.passage };
      uniforms.uDoorLight = { value: new THREE.Vector2(0.05, 0.55) };
      uniforms.uVesDown = { value: new THREE.Vector4(...VES_DOWN) };
      uniforms.uPasDown = { value: new THREE.Vector4(...(opts.doors.hub ? VES_DOWN : PAS_DOWN)) }; // as vestibules and passages have (archMaterial's defaults)
      uniforms.uPasColors = { value: opts.doors.hub ? [LAMP, LAMP, LAMP, SCREEN] : [LAMP, LAMP, LAMP, LAMP] };
      uniforms.uVesGains = { value: new THREE.Vector4(1, 1, 1, 1) };
      uniforms.uDoors = { value: new THREE.Vector4(opts.doors.from, opts.doors.to, opts.doors.span, opts.doors.halfWidth) };
      uniforms.uDoorDirs = { value: new THREE.Vector4(...opts.doors.dirs) };
      // a hub's doors all give onto the far ends of vestibules
      if (opts.doors.hub) defines.HUB = '';
    }
    return new THREE.ShaderMaterial({ uniforms, defines, vertexShader: ARCH_VERT, fragmentShader: ARCH_FRAG, fog: true, side: opts.side || THREE.FrontSide, vertexColors: !!opts.vertexColors });
  }

  function signMaterial(map, lights, opts) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, lightingUniforms(lights, opts || {}), { map: { value: map } });
    return new THREE.ShaderMaterial({ uniforms, defines: lightDefines(lights), vertexShader: SIGN_VERT, fragmentShader: SIGN_FRAG, fog: true });
  }

  function paintMaterial(map, lights, opts) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, lightingUniforms(lights, opts || {}), { map: { value: map } });
    return new THREE.ShaderMaterial({ uniforms, defines: lightDefines(lights), vertexShader: SIGN_VERT, fragmentShader: PAINT_FRAG, fog: true });
  }

  function bookMaterial(map, lights, variants, opts) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, lightingUniforms(lights, opts || {}), { map: { value: map }, uVariants: { value: variants } });
    return new THREE.ShaderMaterial({ uniforms, defines: lightDefines(lights), vertexShader: BOOK_VERT, fragmentShader: BOOK_FRAG, fog: true });
  }

  /** Light sources of each region, in cell coordinates (xyz) with intensity (w). */
  function lightSets(d) {
    const V = (x, y, z, w) => new THREE.Vector4(x, y, z, w);
    // the stair hexagon at a vestibule's far end is brighter than a hexagon of books, so its
    // light there is stronger, as it is when one stands in the stair hexagon's doorway
    const HUB_END = 1.0;
    // a picture lamp lights its painting, and little more: a passage is no brighter than a hexagon
    const PICTURE = 0.45;
    return {
      // the lamps above the bookcases (as many as there are bookcases)
      hexagon: [0, 1, 2, 3].map((i) => {
        const p = lampLights(d)[i];
        return p ? V(p.x, p.y, p.z, 0.8) : V(0, 0, 0, 0);
      }),
      // a hub's lamps: above every other door, and above the stair's
      hub: hubLights(d).map((p, i) => V(p.x, p.y, p.z, i < 3 ? 1.0 : 0.5)),
      // the light of the hexagons at either end, and the catalogue's glow
      vestibule: [
        V(d.hallX0 - 0.25, 1.8, 0, 0.72),
        V(d.hallX1 + 0.25, 1.8, 0, HUB_END),
        V(0, 0, 0, 0),
        V(d.screen.x, d.screen.y, d.hallW / 2 + 0.1, 0.32),
      ],
      // a passage between two clusters: the light of the hexagons at either end, and the lamps
      // of its two paintings (the same, turned half round, from either end)
      passage: [
        V(d.hallX0 - 0.25, 1.8, 0, 0.72),
        V(d.hallX1 + 0.25, 1.8, 0, 0.72),
        ...(d.painting ? [
          V(d.painting.lamp.x, d.painting.lamp.y - 0.01, d.painting.lamp.z, PICTURE),
          V(d.Dx - d.painting.lamp.x, d.painting.lamp.y - 0.01, -d.painting.lamp.z, PICTURE),
        ] : [V(0, 0, 0, 0), V(0, 0, 0, 0)]),
      ],
      // inside the niche: the screen, and the vestibule's light
      niche: [
        V(d.screen.x, d.screen.y, d.screen.z - 0.3, 0.75),
        V(d.hallX0 - 0.25, 1.8, 0, 0.72),
        V(d.hallX1 + 0.25, 1.8, 0, HUB_END),
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
        V(d.hallX1 + 0.25, 1.8, 0, HUB_END),
        V((d.cellX0 + d.cellX1) / 2, d.cellH - 0.2, (d.cellZ0 + d.cellZ1) / 2, 0.13),
      ],
      // light from the hubs of this floor and the floors above and below, spilling into the
      // stairwell through its doorways, and a little fill halfway up, where it lights the bottom and the top of a floor's
      // stretch of the stairwell alike, so that each floor's runs on into the next without a seam
      well: [
        V(d.wellX, 1.5, d.hallW / 2 - 0.15, 0.95),
        V(d.wellX, 1.5 + d.Hf, d.hallW / 2 - 0.15, 0.95),
        V(d.wellX, 1.5 - d.Hf, d.hallW / 2 - 0.15, 0.95),
        V(d.wellX, d.Hf / 2, d.wellZ + 0.4, 0.28),
      ],
    };
  }

  /**
   * opts.painting: the layout of the Library's paintings (width and height in pixels), if
   * it has any; opts.anisotropy: the texture filtering the paintings may use.
   */
  function createAssets(cfg, textures, opts) {
    opts = opts || {};
    const d = dimensions(cfg);
    if (opts.painting) d.painting = paintingPlace(d, opts.painting.width / opts.painting.height);
    const L = lightSets(d);
    const hex = buildHexagon(d);
    const ves = buildVestibule(d, false), pas = buildVestibule(d, true);
    const hub = buildHub(d), stair = buildStair(d);
    const cell = buildCell(d);
    // About 0.9 m to a repeat of the tiles' pattern (two tiles across), but exactly a whole number
    // of repeats from one hexagon to the next, so that the pattern runs on unbroken along a floor.
    const tileRepeat = d.Dx / Math.max(1, Math.round(d.Dx / 0.9));
    const tileScale = [1 / tileRepeat, 1 / (tileRepeat * textures.tilesAspect)];
    // the walkway's middle, round the shaft, and where the hexagon gives onto its vestibule and the vestibule onto the next: for the worn path
    const path = new THREE.Vector4((d.shaftA + d.aIn) / 2, d.a, d.Dx - d.a, 0);
    const hubPath = new THREE.Vector4((d.drumR + d.aIn) / 2, d.a, d.Dx - d.a, 0); // in a hub, the walkway round the drum
    // A hexagon's doorways, where its light turns into its vestibules' (on the floor, from a little
    // before the doorway, so that the change is gentler there)
    const dirs = doorDirections(d);
    // (a hexagon's doors give onto its vestibule and its passage, a hub's onto the far ends of vestibules)
    const doors = (from, isHub) => ({ lights: L.vestibule, passage: isHub ? L.vestibule : L.passage, from, to: d.a, span: d.Dx, halfWidth: d.hallW / 2, dirs, hub: !!isHub });
    const screenLit = { colors: [null, null, null, SCREEN] };
    // along a floor, a whole number of repeats of the wood's grain from one hexagon to the next, so that skirting boards run on
    const woodScale = [Math.max(1, Math.round(d.Dx * 0.9)) / d.Dx, 2.2];
    // up the stairwell, a whole number of repeats of a texture to a floor, so that it runs on from floor to floor
    const perFloor = (scale) => Math.max(1, Math.round(d.Hf * scale)) / d.Hf;
    // the lamps above the bookcases shine down
    const shaded = [1, 1, 1, 1];
    const materials = {
      hexWood: archMaterial(textures.wood, woodScale, 0xb0845a, L.hexagon, { patina: 'wood', path, doors: doors(d.aIn), down: shaded }),
      hexPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.hexagon, { patina: 'plaster', path, doors: doors(d.aIn), down: shaded }),
      hexTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.hexagon, { patina: 'tiles', path, doors: doors(d.aIn - 0.3), down: shaded }),
      vesWood: archMaterial(textures.wood, woodScale, 0xb0845a, L.vestibule, Object.assign({ patina: 'wood', path, down: VES_DOWN }, screenLit)),
      vesPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.vestibule, Object.assign({ patina: 'plaster', path, down: VES_DOWN }, screenLit)),
      vesTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.vestibule, Object.assign({ patina: 'tiles', path, down: VES_DOWN }, screenLit)),
      // the passages between clusters
      pasWood: archMaterial(textures.wood, woodScale, 0xb0845a, L.passage, { patina: 'wood', path, down: PAS_DOWN }),
      pasPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.passage, { patina: 'plaster', path, down: PAS_DOWN }),
      pasTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.passage, { patina: 'tiles', path, down: PAS_DOWN }),
      // the hubs
      hubWood: archMaterial(textures.wood, woodScale, 0xb0845a, L.hub, { patina: 'wood', path: hubPath, doors: doors(d.aIn, true), down: shaded, falloff: 0.38, ambient: 0.16 }),
      hubPlaster: archMaterial(textures.plaster, [0.4, 0.4], 0xc9b99a, L.hub, { patina: 'plaster', path: hubPath, doors: doors(d.aIn, true), down: shaded, falloff: 0.38, ambient: 0.16 }),
      // (the hub's floor turns into the vestibule's light from further in, its light being brighter)
      hubTiles: archMaterial(textures.tiles, tileScale, 0xc8b49a, L.hub, { patina: 'tiles', path: hubPath, doors: doors(d.aIn - 0.9, true), down: shaded, falloff: 0.38, ambient: 0.16 }),
      niche: archMaterial(textures.plaster, [0.4, 0.4], 0xffffff, L.niche, { vertexColors: true, colors: [SCREEN], falloff: 1.4, ambient: 0.04 }),
      screen: new THREE.MeshBasicMaterial({ map: textures.screen, fog: true }),
      signs: signMaterial(textures.signs, L.vestibule, { colors: [null, null, null, SCREEN], ambient: 0.08, down: VES_DOWN }),
      pasSigns: signMaterial(textures.signs, L.passage, { ambient: 0.08, down: PAS_DOWN }),
      // the stairwell's walls, seen from inside it only: the flat one above the opening lies in the
      // plane of the drum's flat wall, back to back with it, and the round one meets that plane at
      // the opening's sides; seen from the hub too, each would flicker through its wall
      wellPlaster: archMaterial(textures.plaster, [0.4, perFloor(0.4)], 0xc4b597, L.well, { ambient: 0.08 }),
      wellStone: archMaterial(textures.stone, [0.7, perFloor(0.7)], 0xdccdb0, L.well, { side: THREE.DoubleSide, ambient: 0.08 }),
      cellWood: archMaterial(textures.wood, [0.9, 2.2], 0xffffff, L.cell, { vertexColors: true, falloff: 1.1, ambient: 0.05 }),
      doorWood: archMaterial(textures.wood, [0.9, 2.2], 0xb0845a, L.door, { cellMatrix: true }),
      cellSoft: archMaterial(textures.plaster, [0.4, 0.4], 0xffffff, L.cell, { vertexColors: true, falloff: 1.1, ambient: 0.05 }),
      shade: new THREE.MeshBasicMaterial({ color: 0xf5c987, side: THREE.DoubleSide, fog: true }),
      bulb: new THREE.MeshBasicMaterial({ color: 0xfff2d8, fog: true }),
      books: bookMaterial(textures.spines, L.hexagon, Babel.Textures.SPINE_VARIANTS, { down: shaded }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xffe9c4, fog: true }),
      mirrorDark: new THREE.MeshBasicMaterial({ color: 0x1c1a17, fog: true }),
      glow: new THREE.SpriteMaterial({ map: textures.glow, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: true }),
      // drawn over the wall it lies on, not into it
      lampWash: new THREE.MeshBasicMaterial({
        map: textures.wash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
        side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
      }),
    };
    const geometries = {
      hexWood: hex.wood, hexPlaster: hex.plaster, hexTiles: hex.tiles,
      vesWood: ves.wood, vesPlaster: ves.plaster, vesTiles: ves.tiles,
      pasWood: pas.wood, pasPlaster: pas.plaster, pasTiles: pas.tiles,
      hubWood: hub.wood, hubPlaster: hub.plaster, hubTiles: hub.tiles, hubGlow: hub.glow,
      wellPlaster: stair.well, wellStone: stair.steps,
      lampGlow: buildLampGlow(d),
      lampWash: d.roomH > d.shelfTop + 0.2 ? buildLampWash(d) : null,
      pictureGlow: d.painting ? buildPictureGlow(d) : null,
      book: buildBook(d),
      mirror: new THREE.PlaneGeometry(d.mirrorW, d.mirrorH),
      doorLeaf: buildDoorLeaf(d),
      niche: buildNiche(d),
      screen: new THREE.PlaneGeometry(d.screen.w, d.screen.h),
      signs: [0, 1, 2, 3, 4, 5].map((way) => buildSignFaces(d, way)), // by the direction a vestibule heads in
      cellWood: cell.wood, cellSoft: cell.soft, shade: cell.shade, bulb: cell.bulb,
      sinkMirror: new THREE.PlaneGeometry(d.sinkMirror.w, d.sinkMirror.h),
    };
    // each painting has its own texture, so its own material
    // a picture lamp's light is aimed at its painting, which it lights more than the walls round it
    const canvasLights = L.passage.map((v, i) => (i >= 2 ? v.clone().setW(0.85) : v));
    const paintingMaterial = d.painting ? (map) => paintMaterial(map, canvasLights, { down: PAS_DOWN }) : null;
    if (d.painting) geometries.canvas = buildCanvas(d);
    // the size of the tiles' pattern on the floor, in metres
    const tilePeriod = [tileRepeat, tileRepeat * textures.tilesAspect];
    return { dims: d, materials, geometries, lights: L, paintingMaterial, tilePeriod, anisotropy: opts.anisotropy || 1 };
  }

  Babel.Architecture = { dimensions, createAssets, sideMatrix, Builder, intoFrame, frameAt, WAYS };
  Babel.Honeycomb = Honeycomb;
})();
