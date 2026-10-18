/*
 * Procedural textures, painted once on canvases at start-up.
 * Nothing is downloaded: wood, plaster, floor tiles and leather spines are drawn here.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  function rngFrom(seed) {
    const k = BabelCore.util.hashString('textures/' + seed);
    const r = BabelCore.util.sfc32(k[0], k[1], k[2], k[3]);
    return () => r() / 4294967296;
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /** Tileable value noise on a grid, returned as a Float32Array in [0,1]. */
  function valueNoise(w, h, cells, rand, octaves) {
    const out = new Float32Array(w * h);
    let amp = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
      const cx = cells << o, cy = Math.max(1, Math.round((cells << o) * h / w));
      const grid = new Float32Array(cx * cy).map(() => rand());
      for (let y = 0; y < h; y++) {
        const gy = (y / h) * cy, y0 = Math.floor(gy), fy = gy - y0;
        const sy = fy * fy * (3 - 2 * fy);
        for (let x = 0; x < w; x++) {
          const gx = (x / w) * cx, x0 = Math.floor(gx), fx = gx - x0;
          const sx = fx * fx * (3 - 2 * fx);
          const a = grid[(y0 % cy) * cx + (x0 % cx)], b = grid[(y0 % cy) * cx + ((x0 + 1) % cx)];
          const c = grid[((y0 + 1) % cy) * cx + (x0 % cx)], d = grid[((y0 + 1) % cy) * cx + ((x0 + 1) % cx)];
          out[y * w + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
        }
      }
      total += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
  }

  function toTexture(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }

  /** Dark walnut with horizontal grain (u = along the board). */
  function wood() {
    const w = 512, h = 512, rand = rngFrom('wood');
    const c = canvas(w, h), g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const n1 = valueNoise(w, h, 2, rand, 4);
    const n2 = valueNoise(w, h, 8, rand, 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        // grain: rings stretched along x, wobbled by noise
        const v = y / h * 18 + n1[i] * 6;
        const ring = 0.5 + 0.5 * Math.sin(v * Math.PI * 2);
        const fine = n2[i];
        let l = 0.55 + 0.25 * Math.pow(ring, 3) + 0.2 * (fine - 0.5);
        l = Math.max(0, Math.min(1, l));
        img.data[i * 4] = 140 * l + 20;
        img.data[i * 4 + 1] = 92 * l + 12;
        img.data[i * 4 + 2] = 58 * l + 8;
        img.data[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c);
  }

  /** Old lime plaster, mottled. */
  function plaster() {
    const w = 512, h = 512, rand = rngFrom('plaster');
    const c = canvas(w, h), g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const n = valueNoise(w, h, 4, rand, 5);
    for (let i = 0; i < w * h; i++) {
      const s = rand() * 0.06;
      const l = 0.78 + 0.22 * (n[i] - 0.5) * 2 - s;
      img.data[i * 4] = 205 * l;
      img.data[i * 4 + 1] = 190 * l;
      img.data[i * 4 + 2] = 166 * l;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return toTexture(c);
  }

  /** Worn grey stone. */
  function stone() {
    const w = 512, h = 512, rand = rngFrom('stone');
    const c = canvas(w, h), g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const n = valueNoise(w, h, 6, rand, 5);
    for (let i = 0; i < w * h; i++) {
      const l = 0.62 + 0.38 * (n[i] - 0.5) * 2 + (rand() - 0.5) * 0.08;
      img.data[i * 4] = 170 * l;
      img.data[i * 4 + 1] = 160 * l;
      img.data[i * 4 + 2] = 146 * l;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return toTexture(c);
  }

  /** Hexagonal floor tiles (the Library is hexagons all the way down). Returns {texture, metresPerRepeat}. */
  function hexTiles() {
    const W = 512;
    const R = W / (2 * Math.sqrt(3)); // two hexagons across
    const colStep = Math.sqrt(3) * R, rowStep = 1.5 * R;
    const H = Math.round(4 * rowStep); // four rows = one vertical period
    const rand = rngFrom('tiles');
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = 'rgb(52,44,36)';
    g.fillRect(0, 0, W, H);
    const noise = valueNoise(W, H, 8, rand, 3);
    for (let row = -1; row <= 4; row++) {
      for (let col = -1; col <= 2; col++) {
        const cx = col * colStep + (row & 1 ? colStep / 2 : 0);
        const cy = row * rowStep;
        const shade = 0.78 + rand() * 0.22;
        const hue = rand();
        const r = (150 + 25 * hue) * shade, gg = (128 + 10 * hue) * shade, b = (104 - 10 * hue) * shade;
        for (const [ox, oy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) {
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k * Math.PI) / 3;
            const px = cx + ox + (R - 3) * Math.cos(a), py = cy + oy + (R - 3) * Math.sin(a);
            k ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.closePath();
          g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
          g.fill();
        }
      }
    }
    // wear
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < W * H; i++) {
      const f = 0.8 + 0.35 * noise[i] + (rand() - 0.5) * 0.06;
      img.data[i * 4] *= f; img.data[i * 4 + 1] *= f; img.data[i * 4 + 2] *= f;
    }
    g.putImageData(img, 0, 0);
    return { texture: toTexture(c), aspect: H / W };
  }

  /**
   * Spine atlas. Each of VARIANTS columns is one spine design.
   * Channels: red = leather lightness (multiplied by the book's colour),
   * green = gilt tooling mask, blue = paper label mask.
   */
  const SPINE_VARIANTS = 8;
  function spineAtlas() {
    const cw = 64, h = 512, w = cw * SPINE_VARIANTS;
    const rand = rngFrom('spines');
    const c = canvas(w, h), g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const n = valueNoise(w, h, 16, rand, 4);
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = Math.floor(i / w);
      const xc = (x % cw) / cw; // across the spine
      const round = 0.82 + 0.18 * Math.sin(xc * Math.PI); // rounded spine
      img.data[i * 4] = 255 * Math.min(1, (0.72 + 0.28 * n[i]) * round);
      img.data[i * 4 + 1] = 0;
      img.data[i * 4 + 2] = 0;
      img.data[i * 4 + 3] = 255;
      void y;
    }
    // bands, gilt and labels per variant
    for (let v = 0; v < SPINE_VARIANTS; v++) {
      const x0 = v * cw;
      const bands = 3 + (v % 3);
      const top = 40, bottom = h - 40;
      for (let b = 0; b <= bands; b++) {
        const y = Math.round(top + ((bottom - top) * b) / bands);
        for (let yy = y - 5; yy <= y + 5; yy++) {
          for (let x = x0; x < x0 + cw; x++) {
            const i = (yy * w + x) * 4;
            const d = Math.abs(yy - y) / 5;
            img.data[i] = Math.min(255, img.data[i] * (1.15 - 0.45 * d * d));
            if (v % 2 === 0 && (Math.abs(yy - y) === 4)) img.data[i + 1] = 200; // gilt fillets
          }
        }
      }
      if (v % 4 === 1 || v === 6) {
        // paper label in the second panel
        const y0 = Math.round(top + (bottom - top) / bands + 14), y1 = y0 + 46;
        for (let yy = y0; yy < y1; yy++) for (let x = x0 + 9; x < x0 + cw - 9; x++) img.data[(yy * w + x) * 4 + 2] = 255;
      } else if (v % 2 === 0) {
        // gilt lettering block (illegible at this scale, as it should be)
        const y0 = Math.round(top + (bottom - top) / bands + 18);
        for (let line = 0; line < 3; line++) {
          for (let k = 0; k < 6; k++) {
            if (rand() < 0.3) continue;
            const yy0 = y0 + line * 14, xx0 = x0 + 12 + k * 7;
            for (let yy = yy0; yy < yy0 + 8; yy++) for (let x = xx0; x < xx0 + 5; x++) img.data[(yy * w + x) * 4 + 1] = 150 + rand() * 80;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    const t = toTexture(c, false);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  /** Soft radial glow for the lamps. */
  function glow() {
    const s = 128, c = canvas(s, s), g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,224,170,1)');
    grd.addColorStop(0.16, 'rgba(255,200,130,0.62)');
    grd.addColorStop(0.4, 'rgba(255,172,96,0.2)');
    grd.addColorStop(0.75, 'rgba(255,160,80,0.05)');
    grd.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return toTexture(c, false);
  }

  Babel.Textures = {
    SPINE_VARIANTS,
    create() {
      const tiles = hexTiles();
      return {
        wood: wood(),
        plaster: plaster(),
        stone: stone(),
        tiles: tiles.texture,
        tilesAspect: tiles.aspect,
        spines: spineAtlas(),
        glow: glow(),
      };
    },
  };
})();
