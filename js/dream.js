/*
 * Dreams: a slowly changing picture drawn over the whole screen by one shader. Smoke-like
 * noise folded on itself, seen through a kaleidoscope, with now and then the ghost of the
 * Library's hexagons, of rings like an eye, of a spiral. Everything about it (colours,
 * symmetry, turbulence, motifs, speed) comes from a seed, so the same seed always dreams
 * the same dream: a sequence of scenes, each melting into the next.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  const VERT = `
    void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uMix;   // 0 … 1, from scene A to scene B
    uniform float uSeed;
    uniform vec3 uA[4];   // palette of scene A (a + b cos(2π(c t + d)))
    uniform vec3 uB[4];
    uniform vec4 uPA;     // folds, turbulence, scale, spin
    uniform vec4 uPB;
    uniform vec4 uMA;     // hexagons, rings, spiral, direction of the drift
    uniform vec4 uMB;
    uniform vec2 uSat;    // how much colour each scene keeps (the rest is grey)

    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p * 2.03 + 17.0; a *= 0.5; }
      return v;
    }
    vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(6.28318 * (c * t + d)); }
    vec2 fold(vec2 p, float n) {
      if (n < 1.5) return p;
      float k = 6.28318 / n;
      float a = mod(atan(p.y, p.x), k);
      a = abs(a - 0.5 * k);
      return length(p) * vec2(cos(a), sin(a));
    }
    // distance to the edge of the nearest cell of a hexagonal tiling
    float hexEdge(vec2 p) {
      vec2 r = vec2(1.0, 1.7320508);
      vec2 h = r * 0.5;
      vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
      vec2 g = dot(a, a) < dot(b, b) ? a : b;
      g = abs(g);
      return 0.5 - max(dot(g, normalize(vec2(1.0, 1.7320508))), g.x);
    }

    vec3 scene(vec2 uv, float t, vec4 P, vec4 M, vec3 a, vec3 b, vec3 c, vec3 d, float sat) {
      float ang = t * P.w;
      uv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * uv;
      vec2 k = fold(uv, P.x);
      vec2 p = k * P.z;
      vec2 drift = vec2(cos(M.w), sin(M.w)) * t * 0.06;
      vec2 q = vec2(fbm(p + drift + uSeed), fbm(p - drift + vec2(5.2, 1.3) + uSeed));
      vec2 r = vec2(fbm(p + P.y * q + vec2(1.7, 9.2) + 0.13 * t), fbm(p + P.y * q + vec2(8.3, 2.8) - 0.11 * t));
      float f = fbm(p + P.y * r);
      float hexes = smoothstep(0.07, 0.0, hexEdge(k * 3.2 + r * 0.6));
      float rad = length(uv);
      float rings = 0.5 + 0.5 * cos(rad * 22.0 - t * 0.7 + f * 5.0);
      float spiral = 0.5 + 0.5 * cos(atan(uv.y, uv.x) * 3.0 + log(rad + 0.001) * 7.0 - t * 0.5 + f * 3.0);
      float m = f + 0.35 * length(q) + M.x * hexes * 0.35 + M.y * rings * 0.16 + M.z * spiral * 0.12;
      vec3 col = palette(m + 0.015 * t, a, b, c, d);
      col *= 0.34 + 1.0 * f * f;                    // smoky darks
      col += M.x * hexes * 0.08 * palette(0.6 + f, a, b, c, d);
      col = mix(col, sqrt(max(col, 0.0)) * 0.9, 0.25 * clamp(length(r) - 0.6, 0.0, 1.0));
      float grey = dot(col, vec3(0.299, 0.587, 0.114));
      return mix(vec3(grey), col, sat);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      float t = uTime;
      // a slow breath: the picture swells and settles
      uv *= 1.0 + 0.04 * sin(t * 0.21);
      vec3 col = scene(uv, t, uPA, uMA, uA[0], uA[1], uA[2], uA[3], uSat.x);
      if (uMix > 0.001) col = mix(col, scene(uv, t, uPB, uMB, uB[0], uB[1], uB[2], uB[3], uSat.y), smoothstep(0.0, 1.0, uMix));
      col *= smoothstep(1.35, 0.25, length(uv));    // the edges of sleep
      col += (hash(gl_FragCoord.xy + fract(t * 7.0) * 113.0) - 0.5) * 0.025;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      const t = (a + b) | 0;
      a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0;
      const r = (t + d) | 0; c = (c + r) | 0;
      return (r >>> 0) / 4294967296;
    };
  }

  /*
   * The moods a scene's colours start from, as cosine palettes: colour(x) = a + b cos(2π(c x + d)),
   * for x running through the picture. Lamplight, verdigris, a bruise, bone and ash, the deep
   * sea, rust, spores, moonlight: muted, nocturnal, a little wrong.
   */
  const MOODS = [
    [[0.5, 0.4, 0.3], [0.4, 0.3, 0.2], [1, 1, 1], [0, 0.1, 0.2]],
    [[0.35, 0.45, 0.42], [0.25, 0.3, 0.28], [1, 1, 1], [0.5, 0.55, 0.6]],
    [[0.4, 0.3, 0.45], [0.3, 0.25, 0.35], [1, 1, 0.8], [0.6, 0.7, 0.8]],
    [[0.5, 0.48, 0.44], [0.3, 0.28, 0.25], [1, 1, 1], [0, 0.02, 0.05]],
    [[0.2, 0.35, 0.45], [0.2, 0.3, 0.35], [1, 1, 1], [0.3, 0.4, 0.5]],
    [[0.45, 0.25, 0.2], [0.4, 0.2, 0.15], [1, 1, 1], [0, 0.05, 0.1]],
    [[0.4, 0.45, 0.3], [0.35, 0.35, 0.25], [1, 1, 0.5], [0.8, 0.9, 0.3]],
    [[0.4, 0.42, 0.5], [0.3, 0.3, 0.35], [1, 1, 1], [0, 0.1, 0.25]],
  ];

  /** The parameters of scene number n of the dream that a seed gives. */
  function sceneOf(seed, n) {
    const rng = sfc32(seed[0] ^ Math.imul(n + 1, 0x9e3779b1), seed[1], seed[2] ^ n, seed[3]);
    for (let i = 0; i < 8; i++) rng();
    const r = (lo, hi) => lo + (hi - lo) * rng();
    const pick = (list) => list[Math.floor(rng() * list.length)];
    // a mood, shifted a little: brighter or darker, its hues turned, its bands wider or narrower
    const [a, b, c, d] = pick(MOODS);
    const light = r(0.85, 1.15), swing = r(0.8, 1.15), bands = r(0.6, 1.4), turn = r(-0.12, 0.12);
    const palette = [
      new THREE.Vector3(...a.map((v) => v * light * r(0.94, 1.06))),
      new THREE.Vector3(...b.map((v) => v * swing * r(0.9, 1.1))),
      new THREE.Vector3(...c.map((v) => v * bands)),
      new THREE.Vector3(...d.map((v) => v + turn + r(-0.04, 0.04))),
    ];
    const saturation = r(0.65, 1);
    const folds = pick([1, 1, 3, 4, 5, 6, 6, 6, 7, 8, 12]);
    const params = new THREE.Vector4(folds, r(1.2, 4.2), r(1.1, 3.2), r(-0.06, 0.06));
    const motifs = new THREE.Vector4(rng() < 0.45 ? r(0.5, 1) : 0, rng() < 0.3 ? r(0.4, 1) : 0, rng() < 0.2 ? r(0.4, 1) : 0, r(0, Math.PI * 2));
    return { palette, params, motifs, saturation };
  }

  class Dream {
    constructor() {
      this.uniforms = {
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uMix: { value: 0 }, uSeed: { value: 0 },
        uA: { value: [] }, uB: { value: [] }, uPA: { value: new THREE.Vector4() }, uPB: { value: new THREE.Vector4() },
        uMA: { value: new THREE.Vector4() }, uMB: { value: new THREE.Vector4() }, uSat: { value: new THREE.Vector2(1, 1) },
      };
      const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      quad.frustumCulled = false;
      this.scene = new THREE.Scene();
      this.scene.add(quad);
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.seed = [0, 0, 0, 0];
      this.index = -1;
    }

    /** Begins the dream of a seed (four unsigned 32-bit integers). */
    begin(seed) {
      this.seed = seed;
      this.uniforms.uSeed.value = (seed[0] % 1000) / 10;
      this._show(0, 0);
    }

    /** Shows scene n, melting (mix 0 … 1) into scene n + 1. */
    _show(n, mix) {
      if (n !== this.index) {
        const a = sceneOf(this.seed, n), b = sceneOf(this.seed, n + 1);
        this.uniforms.uA.value = a.palette; this.uniforms.uPA.value = a.params; this.uniforms.uMA.value = a.motifs;
        this.uniforms.uB.value = b.palette; this.uniforms.uPB.value = b.params; this.uniforms.uMB.value = b.motifs;
        this.uniforms.uSat.value.set(a.saturation, b.saturation);
        this.index = n;
      }
      this.uniforms.uMix.value = mix;
    }

    /** Draws the dream at time t (seconds), scene n melting into the next by `mix`. */
    render(renderer, t, n, mix) {
      this._show(n, mix);
      this.uniforms.uTime.value = t;
      renderer.getDrawingBufferSize(this.uniforms.uRes.value);
      renderer.render(this.scene, this.camera);
    }
  }

  Babel.Dream = Dream;
})();
