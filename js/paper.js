/*
 * Paper: the leaves of the Library's books, and what the years have done to them. No book has
 * been kept as well as another, and each shows it in its own way, drawn from its place in the
 * Library (its hexagon's fingerprint and its slot), so a book looks the same on every visit:
 *
 *   - the paper's own tone, and how far it has yellowed; the ink, a little faded on old paper;
 *   - its edges, tanned by light and air, the head (the top edge, which gathers the dust of
 *     the shelf) most of all; worn, softened at the corners, now and then chipped or torn;
 *   - clouds in the paper, and foxing: small rust-brown spots, often in clusters;
 *   - a tide line, where water once soaked into part of the book: it marks the same place on
 *     every page it reached, fading towards the last ones;
 *   - the grey of thumbs, at the corner where the pages are turned;
 *   - a corner folded down, here and there.
 *
 * Every leaf is drawn on a canvas behind its page's text, at the page's size on the screen.
 * Positions are measured from the spine, so what soaks through the book, or wears it at the
 * fore-edge, falls at the same place on left and right pages alike.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, t) => a + (b - a) * t;
  /** Smooth step from 0 at a to 1 at b (a may be greater than b, for a step down). */
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const rgba = (c, a) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a.toFixed(3)})`;

  /** A point of the integer lattice, hashed to [0, 1). */
  function lattice(x, y, s) {
    let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ s) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Smooth value noise in [0, 1). */
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = lattice(xi, yi, s), b = lattice(xi + 1, yi, s), c = lattice(xi, yi + 1, s), d = lattice(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** Noise in several octaves, each finer and fainter. */
  function fbm(x, y, s, octaves) {
    let t = 0, amp = 0.5, norm = 0;
    for (let i = 0; i < octaves; i++) {
      t += amp * noise(x, y, (s + Math.imul(i, 0x632be5ab)) | 0);
      norm += amp;
      amp *= 0.5; x *= 2.03; y *= 2.03;
    }
    return t / norm;
  }

  /** A seeded generator of numbers in [0, 1). */
  function random(a, b, c, d) {
    const U = BabelCore.util, rng = U.sfc32(a, b, c, d);
    return () => U.unit(rng);
  }

  const FRESH = [228, 218, 192]; // paper as it left the mill
  const AGED = [196, 171, 122]; // and after centuries
  const TAN = [128, 84, 38]; // the brown of oxidised edges and tide lines
  const DUST = [96, 88, 76]; // the grey of dust and thumbs
  const RUST = [142, 82, 36]; // foxing

  /**
   * A book's paper, in numbers: everything about its leaves that its place decides.
   * `pages` is the number of pages in a book.
   */
  function look(fp, slot, pages) {
    const U = BabelCore.util;
    const key = [(fp[0] ^ 0x70617065) >>> 0, (fp[1] ^ 0x72206167) >>> 0, U.fmix32((slot + 0x9e3779b9) >>> 0), (Math.imul(slot, 0x2545f491) ^ 0x65642121) >>> 0];
    const u = random(key[0], key[1], key[2], key[3]);
    const age = 0.08 + 0.92 * Math.pow(u(), 0.8); // how much the years have told on it
    const warm = u() * 2 - 1, light = u() * 2 - 1;
    const paper = [0, 1, 2].map((k) => clamp(mix(FRESH[k], AGED[k], age) + [7, 2, -7][k] * warm + 7 * light, 0, 255));
    // the ink: browner or greyer, and a little faded on old paper
    const inkTone = u();
    const ink = [mix(43, 58, inkTone), mix(35, 40, inkTone), mix(25, 24, inkTone)];
    const inkAlpha = 1 - 0.3 * age * u();
    const chance = (p) => u() < p;
    const stains = [];
    for (let i = 0; i < 2; i++) {
      if (!chance(i ? 0.12 : 0.4)) continue;
      const reach = Math.max(2, Math.round(pages * (0.03 + 0.4 * Math.pow(u(), 1.5))));
      stains.push({
        u: 0.3 + 0.85 * u(), v: u(), // its centre: from the spine, in widths, and down the page, in heights
        r: 0.18 + 0.5 * u(), // its radius, in widths, where it soaked deepest
        page: Math.floor(u() * pages), reach, // the page it soaked in from, and how far it went
        strength: 0.5 + 0.5 * u(),
        seed: Math.floor(u() * 4294967296) | 0,
      });
    }
    return {
      key, age, paper, stains,
      seed: Math.floor(u() * 4294967296) | 0,
      ink: rgba(ink, inkAlpha),
      stack: rgba(paper.map((v, k) => mix(v, TAN[k], 0.3 + 0.4 * age) * 0.82), 1), // the fore-edges of the leaves beneath, tanned
      mottle: 0.05 + 0.22 * age * u(),
      edge: (0.3 + 0.45 * u()) * (0.3 + 0.7 * age), // how dark the edges have gone
      edgeWidth: 0.025 + 0.07 * u(), // and how far in, in widths
      head: 1.1 + 0.5 * u(), // the head more so
      rough: (0.25 + 0.75 * u()) * (0.3 + 0.7 * age), // how frayed the edges are
      chips: chance(0.25) ? 0 : age * (0.2 + 0.8 * u()),
      corner: (0.1 + 0.9 * u()) * (0.3 + 0.7 * age), // how rounded the outer corners have worn
      foxing: chance(0.4) ? 0 : (0.2 + 0.8 * age) * (0.15 + 0.85 * u()),
      thumb: chance(0.35) ? 0 : (0.1 + 0.22 * u()) * (0.4 + 0.6 * age),
      dogEars: chance(0.5) ? 0 : 0.004 + 0.04 * Math.pow(u(), 2), // the chance of a page's corner folded down
      tears: chance(0.8) ? 0 : 0.01 + 0.05 * u(), // the chance of a page torn at the edge
    };
  }

  // fine grain, the same for every leaf (a tile drawn once)
  let grain = null;
  function grainTile() {
    if (grain) return grain;
    const n = 128, c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n), u = random(0x6772616e, 0x7061706e, 1, 2);
    for (let i = 0; i < n * n; i++) {
      const v = u(), p = i * 4;
      const dark = v < 0.5;
      img.data[p] = dark ? 70 : 255; img.data[p + 1] = dark ? 55 : 250; img.data[p + 2] = dark ? 35 : 235;
      img.data[p + 3] = Math.round(Math.pow(Math.abs(v - 0.5) * 2, 3) * (dark ? 46 : 30));
    }
    g.putImageData(img, 0, 0);
    return (grain = c);
  }

  /**
   * Draws one leaf on `canvas`. options: { page (0-based; -1 and `pages` are the endpapers, the
   * insides of the covers), side ('left' or 'right': which page of an open book it is; the spine
   * is on its other side), width, height (in CSS pixels), scale (device pixels to a CSS pixel),
   * em (the page's font size, in CSS pixels, by which its margins are measured), margin: { top,
   * side, bottom } (in ems; by default the padding of .page in css/style.css) }.
   */
  function draw(canvas, L, o) {
    const W = o.width, H = o.height, dpr = o.scale || 1, em = o.em;
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const page = o.page;
    const right = o.side === 'right'; // a right-hand page: the spine on its left
    // Everything is measured from the spine outwards, and X() takes it across the leaf: on a
    // left-hand page, mirrored.
    const X = (g) => (right ? g : W - g);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const U = BabelCore.util;
    const u = random(L.key[0] ^ U.fmix32((page + 0x51ed270b) >>> 0), L.key[1], (L.key[2] + page) | 0, L.key[3] ^ 0x6c656166);
    const margin = o.margin || { top: 2.1, side: 2.6, bottom: 2.4 };
    const base = L.paper;

    // ---- the outline: the head, the fore-edge and the tail, frayed and chipped; the spine straight
    const rough = L.rough * 0.22 * em; // how far in the fraying reaches
    const radius = (L.corner * (0.35 + 0.65 * u())) * 0.55 * em; // the outer corners, worn round
    const along = 2 * W + H; // the head, fore-edge and tail, from the spine round to the spine
    const chips = [];
    const nChips = Math.floor(L.chips * 7 * u() + u());
    for (let i = 0; i < nChips; i++) {
      chips.push({ at: u() * along, width: (0.25 + 1.1 * u()) * em, depth: (0.06 + 0.32 * u()) * em * (0.5 + L.age) });
    }
    let tear = null;
    if (u() < L.tears) {
      const where = u(); // the head, the fore-edge or the tail
      const edge = where < 0.25 ? 'head' : where < 0.8 ? 'fore' : 'tail';
      const room = edge === 'fore' ? margin.side : edge === 'head' ? margin.top : margin.bottom;
      const at = edge === 'fore' ? (0.1 + 0.8 * u()) * H : (0.45 + 0.5 * u()) * W;
      tear = { edge, at, length: (0.35 + 0.5 * u()) * room * em, lean: (u() - 0.5) * 0.7 };
      chips.push({ at: edge === 'head' ? at : edge === 'fore' ? W + at : W + H + (W - at), width: 0.12 * em, depth: 0.12 * em });
    }
    const fray = (s) => {
      let d = rough * fbm(s / (0.9 * em), 0.5, L.seed ^ page, 3);
      for (const c of chips) {
        const t = 1 - Math.abs(s - c.at) / c.width;
        if (t > 0) d += c.depth * Math.pow(t, 0.7) * (0.75 + 0.5 * noise(s / (0.12 * em), 3.5, L.seed));
      }
      return d;
    };
    const outline = []; // points, as distance from the spine and down
    const step = Math.max(1.5, 0.12 * em);
    const walk = (x0, y0, x1, y1, nx, ny, s0) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(len / step));
      for (let i = 0; i < n; i++) {
        const t = i / n, d = fray(s0 + t * len);
        outline.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d]);
      }
      return s0 + len;
    };
    const arc = (cx, cy, a0, a1, s0) => {
      const len = radius * Math.abs(a1 - a0), n = Math.max(1, Math.ceil(len / step));
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * (i / n), c = Math.cos(a), sn = Math.sin(a), d = fray(s0 + (i / n) * len);
        outline.push([cx + c * (radius - d), cy + sn * (radius - d)]);
      }
      return s0 + len;
    };
    let s = 0;
    s = walk(0, 0, W - radius, 0, 0, 1, s); // the head
    s = arc(W - radius, radius, -Math.PI / 2, 0, s);
    s = walk(W, radius, W, H - radius, -1, 0, s); // the fore-edge
    s = arc(W - radius, H - radius, 0, Math.PI / 2, s);
    s = walk(W - radius, H, 0, H, 0, -1, s); // the tail
    outline.push([0, H]);
    const path = (points) => {
      ctx.beginPath();
      points.forEach(([g, y], i) => (i ? ctx.lineTo(X(g), y) : ctx.moveTo(X(g), y)));
      ctx.closePath();
    };
    const roundRect = (inset) => {
      const r = Math.max(0, radius - inset), points = [[0, inset]];
      const corner = (cx, cy, a0) => {
        for (let i = 0; i <= 8; i++) { const a = a0 + (i / 8) * (Math.PI / 2); points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      };
      corner(W - inset - r, inset + r, -Math.PI / 2);
      corner(W - inset - r, H - inset - r, 0);
      points.push([0, H - inset]);
      path(points);
    };

    // ---- a corner folded down: over a line across the corner, the corner lies on the page, back up
    let fold = null;
    if (u() < L.dogEars) {
      const top = u() < 0.65;
      let a = (1.0 + 1.3 * u()) * em, b = a * (0.75 + 0.7 * u()); // along the head (or tail), and down (or up) the fore-edge
      const cy = top ? 0 : H, dir = top ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        // the folded corner stays in the margin, clear of the text
        const A = [W - a, cy], B = [W, cy + dir * b], C = [W, cy];
        const tip = reflect(C, A, B);
        if (W - tip[0] <= 0.92 * margin.side * em && W - A[0] <= 0.92 * margin.side * em) { fold = { A, B, C, tip, top }; break; }
        a *= 0.85; b *= 0.85;
      }
    }

    // ---- the page beneath, seen through chips and under a folded corner
    roundRect(0.04 * em);
    ctx.fillStyle = rgba(base.map((v, k) => mix(v, TAN[k], 0.2 + 0.7 * L.edge) * 0.92), 1); // toned at its edges, as this one is
    ctx.fill();
    ctx.strokeStyle = rgba(TAN, 0.25);
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // ---- the leaf itself
    ctx.save();
    path(outline);
    ctx.clip();
    if (fold) {
      // everything but the corner beyond the fold line
      const [A, B] = [fold.A, fold.B], far = 4 * (W + H);
      const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy), tx = dx / len, ty = dy / len;
      // the side of the line away from the corner
      const nx = -ty, ny = tx, side = (fold.C[0] - A[0]) * nx + (fold.C[1] - A[1]) * ny > 0 ? -1 : 1;
      const P = (x, y) => [x, y];
      const keep = [P(A[0] - tx * far, A[1] - ty * far), P(A[0] + tx * far, A[1] + ty * far),
        P(A[0] + tx * far + nx * side * far, A[1] + ty * far + ny * side * far), P(A[0] - tx * far + nx * side * far, A[1] - ty * far + ny * side * far)];
      path(keep);
      ctx.clip();
    }
    ctx.fillStyle = rgba(base, 1);
    ctx.fillRect(0, 0, W, H);

    // the soft marks, small, and stretched over the leaf: clouds, tanned edges, tide lines. They
    // are drawn on a canvas of their own, a new one for every leaf, never filled again: Safari
    // copies one canvas onto another a moment after it is asked to, and when one canvas served
    // both leaves, refilled at once for the right-hand page, the left-hand page now and then got
    // it half refilled, a band of it pale blue.
    const fw = Math.max(48, Math.min(224, Math.round((W * dpr) / 5))), fh = Math.max(48, Math.round((fw * H) / W));
    const field = document.createElement('canvas');
    field.width = fw;
    field.height = fh;
    const fctx = field.getContext('2d');
    const img = fctx.createImageData(fw, fh), data = img.data;
    const asp = H / W, seed = (L.seed ^ U.fmix32((page + 0x7f4a7c15) >>> 0)) | 0; // each leaf its own clouds
    const stains = [];
    for (const st of L.stains) {
      const dist = Math.abs(page - st.page) / st.reach;
      if (dist >= 1) continue;
      const k = Math.sqrt(1 - dist * dist);
      stains.push({ cu: st.u, cy: st.v * asp, r: st.r * (0.3 + 0.7 * k), k: st.strength * (0.35 + 0.65 * k), seed: st.seed, z: page * 0.045 });
    }
    const mottle = L.mottle * (0.8 + 0.4 * u());
    const edgeDark = L.edge, wd0 = L.edgeWidth, head = L.head;
    for (let j = 0; j < fh; j++) {
      const Y = ((j + 0.5) / fh) * asp; // down from the head, in widths
      for (let i = 0; i < fw; i++) {
        const x = (i + 0.5) / fw, g = right ? x : 1 - x; // from the spine, in widths
        let r = 0, gg = 0, b = 0, a = 0;
        const add = (c, w) => { r += c[0] * w; gg += c[1] * w; b += c[2] * w; a += w; };
        // clouds in the paper
        add(AGED, mottle * smooth(0.35, 0.8, fbm(g * 4, Y * 4, seed, 4)));
        add(TAN, mottle * 0.6 * smooth(0.6, 0.85, fbm(g * 2.2 + 7, Y * 2.2, L.seed, 3))); // blotches, the same through the book
        // the edges, tanned unevenly
        const n = noise(g * 11 + 3.1, Y * 11, seed + 7);
        const wd = wd0 * (0.55 + 0.9 * n);
        const tan = Math.max(head * smooth(1.3 * wd, 0, Y), smooth(wd, 0, asp - Y), smooth(wd, 0, 1 - g));
        add(TAN, edgeDark * tan + edgeDark * 0.45 * smooth(4 * wd, 0, Math.min(Y, asp - Y, 1 - g)));
        add(DUST, edgeDark * 0.5 * head * smooth(0.6 * wd, 0, Y)); // dust along the head
        // tide lines, where water soaked in
        for (const st of stains) {
          const dx = g - st.cu, dy = Y - st.cy;
          const d = Math.sqrt(dx * dx + dy * dy) / st.r + 0.2 * (fbm(g * 2.6 + st.z, Y * 2.6, st.seed, 3) - 0.5) +
            0.04 * (noise(g * 14, Y * 14, st.seed + 3) - 0.5);
          if (d > 1.05) continue;
          // the line where the water stopped: sharp outside, fading inside; a fainter one where it paused
          const line = (at, width) => (d > at ? Math.exp(-Math.pow((d - at) / (0.18 * width), 2)) : Math.exp((d - at) / width));
          add(TAN, st.k * (0.05 * smooth(1, 0.6, d) + 0.34 * line(1, 0.06) + 0.12 * line(0.78, 0.05)));
        }
        const p = (j * fw + i) * 4;
        if (a > 0) {
          data[p] = r / a; data[p + 1] = gg / a; data[p + 2] = b / a;
          data[p + 3] = clamp(a, 0, 0.85) * 255;
        }
      }
    }
    fctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(field, 0, 0, W, H);

    // the gutter, where the leaf curves down into the spine
    const gut = ctx.createLinearGradient(X(0), 0, X(0.16 * W), 0);
    gut.addColorStop(0, 'rgba(48, 30, 14, 0.42)');
    gut.addColorStop(0.18, 'rgba(48, 30, 14, 0.16)');
    gut.addColorStop(0.5, 'rgba(48, 30, 14, 0.04)');
    gut.addColorStop(1, 'rgba(48, 30, 14, 0)');
    ctx.fillStyle = gut;
    ctx.fillRect(0, 0, W, H);

    // foxing, in clusters, more of it towards the edges
    const spots = Math.round(L.foxing * 90 * (0.25 + 1.5 * u()));
    if (spots) {
      const clusters = [];
      const nc = 1 + Math.floor(3 * u());
      for (let i = 0; i < nc; i++) {
        const nearEdge = u() < 0.6;
        clusters.push([nearEdge ? W * (0.75 + 0.25 * u()) : W * u(), H * u(), (0.04 + 0.12 * u()) * W]);
      }
      for (let i = 0; i < spots; i++) {
        let gx, y;
        if (u() < 0.75) {
          const c = clusters[Math.floor(u() * nc)], t = u() * Math.PI * 2, rr = c[2] * Math.sqrt(-Math.log(1 - 0.95 * u()));
          gx = c[0] + Math.cos(t) * rr; y = c[1] + Math.sin(t) * rr;
        } else { gx = W * u(); y = H * u(); }
        const big = u() < 0.12;
        const rad = (big ? 0.3 + 0.5 * u() : 0.07 + 0.22 * Math.pow(u(), 2)) * em, k = big ? 0.15 + 0.2 * u() : 0.35 + 0.5 * u();
        const sp = ctx.createRadialGradient(X(gx), y, 0, X(gx), y, rad);
        sp.addColorStop(0, rgba(RUST, k));
        sp.addColorStop(0.45, rgba(RUST, k * 0.55));
        sp.addColorStop(1, rgba(RUST, 0));
        ctx.fillStyle = sp;
        ctx.fillRect(X(gx) - rad, y - rad, 2 * rad, 2 * rad);
      }
    }

    // thumbs, at the corner where the pages are turned
    if (L.thumb) {
      const k = L.thumb * (0.6 + 0.8 * u());
      const cx = W * (0.93 + 0.04 * u()), cy = H * (0.93 + 0.04 * u()), rx = (0.1 + 0.05 * u()) * W;
      ctx.save();
      ctx.translate(X(cx), cy);
      ctx.rotate((right ? -1 : 1) * (0.5 + 0.4 * u()));
      ctx.scale(1, 0.6);
      const th = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      th.addColorStop(0, rgba(DUST, k));
      th.addColorStop(0.6, rgba(DUST, k * 0.4));
      th.addColorStop(1, rgba(DUST, 0));
      ctx.fillStyle = th;
      ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
      ctx.restore();
    }

    // the grain of the paper
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.55 + 0.45 * L.age;
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();

    // a tear, in from the edge
    if (tear) {
      const pts = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const t = i / n, wob = (noise(i * 1.7, 9.5, L.seed ^ page) - 0.5) * 0.25 * em;
        const d = t * tear.length, sideways = tear.lean * d + wob * t;
        if (tear.edge === 'fore') pts.push([W - d, tear.at + sideways]);
        else if (tear.edge === 'head') pts.push([tear.at + sideways, d]);
        else pts.push([tear.at + sideways, H - d]);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([g, y], i) => (i ? ctx.lineTo(X(g), y) : ctx.moveTo(X(g), y)));
      ctx.strokeStyle = rgba([255, 250, 236], 0.45);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.strokeStyle = rgba(TAN.map((v) => v * 0.6), 0.6);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // the very edge, darker where it has been handled
    path(outline);
    ctx.strokeStyle = rgba(TAN.map((v) => v * 0.8), 0.25 + 0.4 * L.age);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    // ---- the folded corner, lying on the page
    if (fold) {
      const { A, B, tip } = fold;
      ctx.save();
      ctx.shadowColor = 'rgba(20, 12, 4, 0.35)';
      ctx.shadowBlur = 3 * dpr;
      ctx.shadowOffsetX = (right ? -1 : 1) * 1 * dpr;
      ctx.shadowOffsetY = (fold.top ? 1 : -1) * 1 * dpr;
      path([A, B, tip]);
      // the back of the leaf's corner, tanned towards its edges as the corner of the leaf is
      const tanned = (t) => base.map((v, k) => mix(v, TAN[k], L.edge * t));
      const sh = ctx.createLinearGradient(X((A[0] + B[0]) / 2), (A[1] + B[1]) / 2, X(tip[0]), tip[1]);
      sh.addColorStop(0, rgba(tanned(0.25).map((v) => v * 0.9), 1));
      sh.addColorStop(0.3, rgba(tanned(0.3), 1));
      sh.addColorStop(1, rgba(tanned(0.85), 1));
      ctx.fillStyle = sh;
      ctx.fill();
      ctx.restore();
      path([A, B, tip]);
      ctx.strokeStyle = rgba(TAN, 0.35);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  /** The reflection of point P across the line through A and B. */
  function reflect(P, A, B) {
    const dx = B[0] - A[0], dy = B[1] - A[1], t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / (dx * dx + dy * dy);
    const fx = A[0] + t * dx, fy = A[1] + t * dy;
    return [2 * fx - P[0], 2 * fy - P[1]];
  }

  Babel.Paper = { look, draw };
})();
