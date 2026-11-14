/*
 * Music: soft ambient music that the Library plays for each hexagon. Like a hexagon's patina
 * and its lamps, its music is drawn from its fingerprint, so each hexagon has its own, the same
 * on every visit: a key and a mode; a slow pad of a few voices on a chord of them, drifting from
 * chord to chord; now and then a soft bell from the same scale; a swell of high, glassy tones;
 * and the faint breath of air in the shaft. All of it rings in a long reverb.
 *
 * Walking from one hexagon to the next, the music of the one fades into the music of the
 * other along the vestibule between them; climbing the stair, from one floor's into the next's.
 * Everything is synthesised as it plays: nothing is downloaded.
 *
 * Browsers only let a page make sound once the reader has clicked, tapped or pressed a key, so
 * the music begins then (start), and goes on with each frame (update).
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  // modes, as semitones above the tonic, and how often a hexagon is in each
  const MODES = [
    { steps: [0, 2, 4, 6, 7, 9, 11], weight: 3 }, // Lydian: bright, floating
    { steps: [0, 2, 4, 5, 7, 9, 11], weight: 2 }, // Ionian
    { steps: [0, 2, 4, 5, 7, 9, 10], weight: 2 }, // Mixolydian
    { steps: [0, 2, 3, 5, 7, 9, 10], weight: 3 }, // Dorian: wistful
    { steps: [0, 2, 3, 5, 7, 8, 10], weight: 2 }, // Aeolian: dark
  ];
  // chords, as degrees of the scale above the chord's root (7 is its octave): open, airy voicings
  const VOICINGS = [[0, 4, 8, 9], [0, 4, 7, 11], [0, 4, 9, 13], [0, 2, 4, 8], [0, 4, 8, 12]];
  const VOICES = 4;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /** A hexagon's music, in numbers: everything about it that its fingerprint decides. */
  function compose(fp) {
    const U = BabelCore.util;
    const rng = U.sfc32(fp[0] ^ 0x6d757369, fp[1] ^ 0x63616c21, 0x2f6b8a17, 0x9e3779b9), u = () => U.unit(rng);
    const pick = (list) => list[Math.floor(u() * list.length)];
    let w = u() * MODES.reduce((s, m) => s + m.weight, 0), mode = MODES[0];
    for (const m of MODES) { if ((w -= m.weight) < 0) { mode = m; break; } }
    const steps = mode.steps;
    const deg = (d) => 12 * Math.floor(d / 7) + steps[((d % 7) + 7) % 7]; // a degree of the scale, in semitones above the tonic
    // the chords it drifts between: the tonic's, then others whose fifth is perfect (no diminished chords)
    const moves = [1, 2, 3, 4, 5].filter((k) => deg(k + 4) - deg(k) === 7);
    const chords = [0];
    while (chords.length < 3 + Math.floor(u() * 2) && moves.length) chords.push(moves.splice(Math.floor(u() * moves.length), 1)[0]);
    return {
      tonic: 48 + Math.floor(u() * 12), // the key, from C3 to B3: the pad's voices above it, and a quiet bass an octave below
      deg, chords, voicing: pick(VOICINGS),
      chordTime: 18 + 22 * u(), // seconds on each chord
      glide: 2.5 + 2 * u(), // how slowly the voices slide to the next chord
      detune: 3 + 6 * u(), // cents between a voice's two oscillators
      bright: 520 + 900 * u(), // the pad's filter
      sway: [0.02 + 0.04 * u(), 300 + 600 * u()], // how fast and far the filter sways (cents)
      breaths: Array.from({ length: VOICES }, () => [0.015 + 0.04 * u(), 2 * Math.PI * u()]), // each voice's swell: rate, phase
      bells: 4 + 7 * u(), // seconds between bells, on average
      bellRatio: pick([2, 3, 3.5, 1.4142, 4.2]), bellIndex: 0.6 + 2.2 * u(), bellDecay: 2.8 + 3.5 * u(),
      shimmer: 25 + 35 * u(), // seconds between swells of high tones, on average
      air: [350 + 550 * u(), 0.5 + 0.6 * u(), 0.03 + 0.05 * u()], // breath of air: band, its level, how fast it comes and goes
      seed: [fp[0] ^ 0x5bd1e995, fp[1] ^ 0x1b873593],
    };
  }

  /** A hexagon's music, playing: built on the context, to its own outputs, which the Music fades in and out. */
  class Soundscape {
    constructor(music, fp, t0) {
      const ctx = (this.ctx = music.ctx);
      const c = (this.c = compose(fp));
      const U = BabelCore.util;
      const r = U.sfc32(c.seed[0], c.seed[1], 0x51ed270b, 0x2545f491);
      this.u = () => U.unit(r); // the order of its events, from the same fingerprint
      this.nodes = [];
      this.sources = [];
      // two outputs, faded together: dry, and into the reverb
      this.level = 0;
      this.dry = this._gain(0); this.wet = this._gain(0);
      this.dry.connect(music.bus); this.wet.connect(music.reverb);
      const send = (dry, wet) => { const g = this._gain(1), d = this._gain(dry), w = this._gain(wet); g.connect(d).connect(this.dry); g.connect(w).connect(this.wet); return g; };

      // the pad: four voices, each two oscillators a few cents apart, through a swaying filter
      this.padIn = send(0.55, 0.6);
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass'; this.filter.frequency.value = c.bright; this.filter.Q.value = 0.4;
      this.filter.connect(this.padIn);
      this.nodes.push(this.filter);
      this._lfo(this.filter.detune, c.sway[0], c.sway[1], 0, t0);
      this.chord = 0;
      const notes = this._chordNotes(0, null);
      this.voices = notes.map((m, i) => {
        const level = i === 0 ? 0.045 : 0.06;
        const vg = this._gain(level);
        this._lfo(vg.gain, c.breaths[i][0], level * 0.5, c.breaths[i][1], t0);
        // a sine, a triangle a few cents off it, and a faint sine an octave up, for air
        const a = this._osc('sine', mtof(m), t0), b = this._osc('triangle', mtof(m), t0), o = this._osc('sine', mtof(m), t0);
        b.detune.value = (i % 2 ? 1 : -1) * c.detune;
        o.detune.value = 1200 + (i % 2 ? -1 : 1) * c.detune;
        const bg = this._gain(0.35), og = this._gain(i ? 0.14 : 0.05);
        a.connect(vg); b.connect(bg).connect(vg); o.connect(og).connect(vg);
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { pan.pan.value = [0, -0.35, 0.35, 0.1][i] || 0; vg.connect(pan).connect(this.filter); this.nodes.push(pan); } else vg.connect(this.filter);
        return { a, b, o, note: m };
      });
      this.nextChord = t0 + c.chordTime;

      // the bells and the high swells
      this.bellIn = send(0.3, 1.0);
      this.nextBell = t0 + 1.5 + c.bells * this.u();
      this.nextShimmer = t0 + c.shimmer * (0.3 + this.u());

      // the breath of air in the shaft
      const noise = ctx.createBufferSource();
      noise.buffer = music.noise; noise.loop = true;
      noise.loopStart = this.u() * 2; // each hexagon's air its own
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass'; band.frequency.value = c.air[0]; band.Q.value = 0.7;
      const ag = this._gain(0.018 * c.air[1]);
      this._lfo(ag.gain, c.air[2], 0.018 * c.air[1] * 0.8, this.u() * 6.28, t0);
      noise.connect(band).connect(ag).connect(send(0.6, 0.3));
      noise.start(t0, noise.loopStart);
      this.nodes.push(noise, band);
      this.sources.push(noise);
    }

    _gain(v) { const g = this.ctx.createGain(); g.gain.value = v; this.nodes.push(g); return g; }

    _osc(type, f, t0) {
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = f; o.start(t0);
      this.nodes.push(o);
      this.sources.push(o);
      return o;
    }

    /** A slow sine wobbling `param` by ±depth, starting at `phase` (radians). */
    _lfo(param, rate, depth, phase, t0) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, Math.sin(phase)]), new Float32Array([0, Math.cos(phase)])));
      o.frequency.value = rate;
      const g = this._gain(depth);
      o.connect(g).connect(param);
      o.start(t0);
      this.nodes.push(o);
      this.sources.push(o);
    }

    /** The pad's notes for chord k of the hexagon's progression, each voice moving as little as it can from `from`. */
    _chordNotes(k, from) {
      const c = this.c, root = c.chords[k];
      const tones = c.voicing.map((v) => c.tonic + c.deg(root + v));
      return tones.map((m, i) => {
        if (i === 0) {
          // the bass, on the chord's root, an octave or so below the tonic
          let b = c.tonic - 12 + c.deg(root) % 12;
          if (b > c.tonic - 5) b -= 12;
          return b;
        }
        if (!from) return m;
        let best = m;
        for (const o of [-24, -12, 0, 12, 24]) {
          const n = m + o;
          if (n < c.tonic || n > c.tonic + 26) continue;
          if (Math.abs(n - from[i]) < Math.abs(best - from[i])) best = n;
        }
        return best;
      });
    }

    /** Plans what is to happen up to time `until`: the next chords, bells and swells. */
    schedule(until, music) {
      const c = this.c;
      while (this.nextChord < until) {
        const t = this.nextChord;
        this.chord = (this.chord + 1) % c.chords.length;
        const notes = this._chordNotes(this.chord, this.voices.map((v) => v.note));
        this.voices.forEach((v, i) => {
          // one voice after another, as a choir changes chord
          const at = t + i * 0.9 * this.u();
          for (const o of [v.a, v.b, v.o]) o.frequency.setTargetAtTime(mtof(notes[i]), at, c.glide);
          v.note = notes[i];
        });
        this.nextChord = t + c.chordTime * (0.8 + 0.4 * this.u());
      }
      while (this.nextBell < until) {
        const t = this.nextBell;
        // a bell, now and then two or three in a falling or rising figure
        const n = this.u() < 0.3 ? 2 + Math.floor(this.u() * 2) : 1;
        let note = this._bellNote();
        for (let k = 0; k < n; k++) {
          this._bell(t + k * (0.45 + 0.5 * this.u()), note, k ? 0.7 : 1);
          note = this._bellNote(note);
        }
        // bells come at random, on average every c.bells seconds
        this.nextBell = t + Math.max(1.2, -Math.log(1 - this.u() * 0.95) * c.bells);
      }
      while (this.nextShimmer < until) {
        const t = this.nextShimmer;
        this._shimmer(t);
        this.nextShimmer = t + c.shimmer * (0.6 + 0.8 * this.u());
      }
      void music;
    }

    /** A note for a bell, from the chord's tones and the scale's, high up; near `prev`, if a figure goes on. */
    _bellNote(prev) {
      const c = this.c, root = c.chords[this.chord];
      const pool = [];
      for (let d = 0; d < 14; d++) {
        const m = c.tonic + 24 + c.deg(d);
        if (m < 72 || m > 93) continue;
        // the chord's tones twice as likely as the others; no fourth or seventh, which jar
        const step = d % 7;
        if (step === 3 || step === 6) continue;
        const inChord = c.voicing.some((v) => ((root + v) % 7) === step);
        pool.push(m); if (inChord) pool.push(m);
      }
      if (prev !== undefined) {
        const near = pool.filter((m) => m !== prev && Math.abs(m - prev) <= 5);
        if (near.length) return near[Math.floor(this.u() * near.length)];
      }
      return pool[Math.floor(this.u() * pool.length)];
    }

    _bell(t, m, loud) {
      const ctx = this.ctx, c = this.c, f = mtof(m);
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), env = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * c.bellRatio;
      const decay = c.bellDecay * (0.8 + 0.4 * this.u());
      // the strike's brightness dies away faster than the note
      mg.gain.setValueAtTime(f * c.bellIndex, t);
      mg.gain.exponentialRampToValueAtTime(f * c.bellIndex * 0.04, t + decay * 0.5);
      const amp = 0.065 * loud * (0.7 + 0.3 * this.u());
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(amp, t + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      mod.connect(mg).connect(car.frequency);
      car.connect(env);
      let out = env;
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = 1.2 * (this.u() - 0.5); env.connect(p); out = p; }
      out.connect(this.bellIn);
      car.start(t); mod.start(t);
      car.stop(t + decay + 0.1); mod.stop(t + decay + 0.1);
      car.onended = () => { for (const n of [car, mod, mg, env, out]) n.disconnect(); };
    }

    /** Two high tones of the chord swelling in and out, glassy. */
    _shimmer(t) {
      const ctx = this.ctx, c = this.c, root = c.chords[this.chord];
      const env = ctx.createGain();
      const up = 4 + 3 * this.u(), hold = 1 + 2 * this.u(), down = 7 + 4 * this.u();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.022, t + up);
      env.gain.setValueAtTime(0.022, t + up + hold);
      env.gain.linearRampToValueAtTime(0, t + up + hold + down);
      env.connect(this.bellIn);
      const oscs = [0, 4].map((v, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = mtof(c.tonic + 24 + c.deg(root + v + (i ? 0 : 7)));
        o.detune.value = (i ? 4 : -4);
        let out = o;
        if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = i ? 0.6 : -0.6; o.connect(p); out = p; }
        out.connect(env);
        o.start(t); o.stop(t + up + hold + down + 0.1);
        return [o, out];
      });
      oscs[0][0].onended = () => { for (const [o, p] of oscs) { o.disconnect(); p.disconnect(); } env.disconnect(); };
    }

    /** Fades the hexagon's music to `level` (0 to 1), smoothly, from time t. */
    fade(level, t, tau) {
      if (Math.abs(level - this.level) < 0.003 && (level > 0 || this.level === 0)) return;
      this.level = level;
      const g = Math.sqrt(level); // as loud in all, two hexagons' music crossing
      for (const out of [this.dry, this.wet]) out.gain.setTargetAtTime(g, t, tau);
    }

    stop(t) {
      for (const s of this.sources) { try { s.stop(t); } catch (e) { /* already stopped */ } }
      setTimeout(() => { for (const n of this.nodes) n.disconnect(); }, Math.max(0, (t - this.ctx.currentTime) * 1000) + 200);
    }
  }

  class Music {
    /** opts: { volume (0 to 1), on (whether to play), context (an AudioContext to play on, else one is made at start) } */
    constructor(opts) {
      opts = opts || {};
      this.volume = opts.volume === undefined ? 0.5 : opts.volume;
      this.on = opts.on !== false;
      this.ctx = null;
      this.scapes = new Map(); // key → { scape, idle }
      if (opts.context) this._build(opts.context);
    }

    /** Begins (or resumes) the music: to be called from a click, tap or key press. */
    start() {
      if (!this.on) return;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this._build(new AC()); } catch (e) { return; }
      }
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    }

    _build(ctx) {
      this.ctx = ctx;
      const t = ctx.currentTime;
      // master: the volume, and a gentle limiter
      this.master = ctx.createGain();
      this.master.gain.setValueAtTime(0, t);
      this.master.gain.linearRampToValueAtTime(this.on ? this._level() : 0, t + 6);
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -16; limit.knee.value = 12; limit.ratio.value = 4; limit.attack.value = 0.03; limit.release.value = 0.5;
      this.master.connect(limit).connect(ctx.destination);
      this.bus = ctx.createGain();
      this.bus.connect(this.master);
      // a long, dark reverb, as of a tall stone stairwell
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(6.5, 1.05);
      const back = ctx.createGain();
      back.gain.value = 0.9;
      this.reverb.connect(back).connect(this.master);
      // noise for the air, shared by every hexagon
      const n = Math.floor(ctx.sampleRate * 4), buf = ctx.createBuffer(1, n, ctx.sampleRate), data = buf.getChannelData(0);
      let s = 0x9e3779b9;
      for (let i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; data[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
      this.noise = buf;
    }

    _level() { return 1.3 * this.volume; }

    /** A reverb's impulse response: noise dying away over `seconds`, darker as it dies. */
    _impulse(seconds, tau) {
      const ctx = this.ctx, rate = ctx.sampleRate, n = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, n, rate);
      let s = 0x2545f491;
      const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let y = 0, energy = 0;
        const pre = Math.floor(rate * 0.025);
        for (let i = pre; i < n; i++) {
          const t = (i - pre) / rate;
          const a = 0.6 * Math.exp(-t / 1.4) + 0.06; // the tail duller than the onset
          y += a * (rand() - y);
          d[i] = y * Math.exp(-t / tau) * Math.min(1, t / 0.04);
          energy += d[i] * d[i];
        }
        const k = 1 / Math.sqrt(energy); // as loud, on the whole, as what goes in
        for (let i = 0; i < n; i++) d[i] *= k;
      }
      return buf;
    }

    /** Turns the music on or off; returns whether it is now on. */
    setOn(on) {
      this.on = on;
      if (on) this.start();
      if (!this.ctx) return on;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(on ? this._level() : 0, t + (on ? 3 : 1.2));
      clearTimeout(this._sleepTimer);
      if (!on) this._sleepTimer = setTimeout(() => { if (!this.on && this.ctx.suspend) this.ctx.suspend().catch(() => {}); }, 1500);
      return on;
    }

    /** Stops making sound while the page is out of sight, and goes on when it is back. */
    setVisible(visible) {
      if (!this.ctx || !this.ctx.suspend) return;
      if (!visible) this.ctx.suspend().catch(() => {});
      else if (this.on) this.ctx.resume().catch(() => {});
    }

    /**
     * Moves the music on to now: `spots` are the hexagons to hear, { key, fp, weight }, their
     * weights adding up to 1. The ones not listed fade away, and are let go once silent.
     */
    update(spots, now) {
      const ctx = this.ctx;
      if (!ctx || (now === undefined && ctx.state !== 'running')) return;
      const t = now === undefined ? ctx.currentTime : now;
      const seen = new Set();
      for (const s of spots) {
        if (s.weight < 0.002 && !this.scapes.has(s.key)) continue;
        let e = this.scapes.get(s.key);
        if (!e) { e = { scape: new Soundscape(this, s.fp, t + 0.05), idle: 0 }; this.scapes.set(s.key, e); }
        e.scape.fade(s.weight, t, 0.8);
        e.idle = s.weight < 0.002 ? e.idle || t : 0;
        seen.add(s.key);
      }
      for (const [key, e] of this.scapes) {
        if (!seen.has(key)) { e.scape.fade(0, t, 0.8); if (!e.idle) e.idle = t; }
        if (e.idle && t - e.idle > 8) { e.scape.stop(t + 0.1); this.scapes.delete(key); continue; }
        // only what can be heard is planned
        if (e.scape.level > 0.002) e.scape.schedule(t + 1.5, this);
      }
    }

    /**
     * Which hexagons the reader hears from where they stand, and how much of each: the one they
     * are in, fading into the next along the vestibule between them, and on the stair into the
     * floor above or below. h: where the reader is between two sites (Player.hearing); y: their
     * height above floor cf; d: the Library's dimensions.
     */
    static hearing(h, y, cf, d) {
      const tx = smooth(d.a - 0.8, d.Dx - d.a + 0.8, h.along); // from just inside one doorway to just inside the next
      let f = cf, ty;
      if (y >= 0) ty = smooth(0, d.Hf, y); else { f = cf - 1; ty = smooth(0, d.Hf, y + d.Hf); }
      return [
        { dh: h.here, df: f, weight: (1 - tx) * (1 - ty) }, { dh: h.there, df: f, weight: tx * (1 - ty) },
        { dh: h.here, df: f + 1, weight: (1 - tx) * ty }, { dh: h.there, df: f + 1, weight: tx * ty },
      ];
    }
  }

  Babel.Music = Music;
  Babel.Music.compose = compose;
})();
