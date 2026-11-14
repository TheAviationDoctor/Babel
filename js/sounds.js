/*
 * Sounds: what the reader's own body makes heard, as against the music of the hexagons (see
 * js/music.js). Their footsteps, the soft shuffle of a monk's sandals: the weight coming down, the
 * sole brushing the floor, the ball of the foot; on the walnut of the stair, duller and fuller;
 * the push of a jump; the landing, from a soft step down to a heavy thud, the harder the further
 * they fell; and the wind of a fall, rising as they go faster. Every sound differs a little from
 * the last, as steps do.
 *
 * They echo as the place they are made in would: hardly at all in a hexagon of books, whose
 * panelling and books take up the sound; between the bare plaster walls of a vestibule or a
 * passage, most; somewhat round the stair; a little in a cell.
 *
 * Everything is synthesised as it plays, from filtered noise (no tones, which would ring like a
 * drum): nothing is downloaded. Browsers only let a page make sound once the reader has
 * clicked, tapped or pressed a key, so they begin then (start).
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  /** A random number between a and b. */
  const vary = (a, b) => a + (b - a) * Math.random();
  // how much of a sound goes into the echo, by where it is made: 'hexagon' (of books), 'hall' (a
  // vestibule or a passage), 'stair' (the stair hexagon) or 'cell'
  const ECHO = { hexagon: 0, cell: 0.1, stair: 0.6, hall: 0.85 };

  class Sounds {
    /** opts: { volume (0 to 1), on (whether to make them), context (an AudioContext, else one is made at start) } */
    constructor(opts) {
      opts = opts || {};
      this.volume = opts.volume === undefined ? 0.5 : opts.volume;
      this.on = opts.on !== false;
      this.ctx = null;
      this._windLevel = 0;
      if (opts.context) this._build(opts.context);
    }

    /** Begins (or resumes) making sounds: to be called from a click, tap or key press. */
    start() {
      if (!this.on) return;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this._build(new AC()); } catch (e) { return; }
      }
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    }

    /** Stops making sound while the page is out of sight, and goes on when it is back. */
    setVisible(visible) {
      if (!this.ctx || !this.ctx.suspend) return;
      if (!visible) this.ctx.suspend().catch(() => {});
      else if (this.on) this.ctx.resume().catch(() => {});
    }

    /** Whether a sound can be made now. */
    get ready() { return !!(this.on && this.ctx && this.ctx.state === 'running'); }

    _build(ctx) {
      this.ctx = ctx;
      // the volume, and a gentle limiter
      this.master = ctx.createGain();
      this.master.gain.value = this.volume; // (footsteps a little under the music, a hard landing over it)
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -10; limit.knee.value = 8; limit.ratio.value = 4; limit.attack.value = 0.003; limit.release.value = 0.25;
      this.master.connect(limit).connect(ctx.destination);
      // each sound as it is, and some of it (as much as the place it is made in gives back,
      // see ECHO) through a reverb, as of a bare plaster corridor
      this.dry = ctx.createGain();
      this.dry.connect(this.master);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(1.5, 0.42);
      this.reverb.connect(this.master);
      this._echo = 0; // how much of the sounds being made now goes into it
      // noise, for every sound to take a stretch of
      const n = Math.floor(ctx.sampleRate * 3), buf = ctx.createBuffer(1, n, ctx.sampleRate), data = buf.getChannelData(0);
      let s = 0x6d2b79f5;
      for (let i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; data[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
      this.noise = buf;
    }

    /** A reverb's impulse response: noise dying away over `seconds`, darker as it dies. */
    _impulse(seconds, tau) {
      const ctx = this.ctx, rate = ctx.sampleRate, n = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, n, rate);
      let s = 0x1b873593;
      const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let y = 0, energy = 0;
        const pre = Math.floor(rate * 0.012);
        for (let i = pre; i < n; i++) {
          const t = (i - pre) / rate;
          const a = 0.7 * Math.exp(-t / 0.5) + 0.08;
          y += a * (rand() - y);
          d[i] = y * Math.exp(-t / tau);
          energy += d[i] * d[i];
        }
        const k = 1 / Math.sqrt(energy);
        for (let i = 0; i < n; i++) d[i] *= k;
      }
      return buf;
    }

    /* ---------------- the pieces sounds are made of ---------------- */

    /**
     * A burst of noise at time t through a filter (band-pass at f, unless `type` says otherwise)
     * of quality q: loud `gain`, rising in `attack` and dying with time constant `decay` (seconds).
     */
    _burst(t, f, q, gain, attack, decay, type) {
      const ctx = this.ctx, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise;
      filter.type = type || 'bandpass';
      filter.frequency.value = f;
      filter.Q.value = q;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.setTargetAtTime(0, t + attack, decay);
      src.connect(filter).connect(g).connect(this.dry);
      if (this._echo > 0) {
        const send = ctx.createGain();
        send.gain.value = this._echo;
        g.connect(send).connect(this.reverb);
      }
      const offset = Math.random() * (this.noise.duration - 1);
      src.start(t, offset);
      src.stop(t + attack + decay * 7);
    }

    /* ---------------- what the reader makes heard ---------------- */

    /**
     * A footstep, on `surface` ('stone' or 'wood'), `loud` from 0 to about 1.5 (a crouched shuffle
     * to a hurried stride), in `room` (see ECHO). Footsteps are kept soft, under the music.
     */
    step(surface, loud, room) {
      this._echo = ECHO[room] || 0;
      this._feet(surface, 0.75 * loud);
    }

    /**
     * The feet coming down on `surface`, `loud` as given: the weight on the heel, a muffled pat; the
     * sole brushing the floor; and a moment later the ball of the foot. Nothing in it rings.
     */
    _feet(surface, loud) {
      if (!this.ready || loud <= 0) return;
      const t = this.ctx.currentTime + 0.005, k = 2 * loud * vary(0.8, 1.15), toe = vary(0.07, 0.11) * (loud > 1.2 ? 0.75 : 1);
      const wood = surface === 'wood';
      // the weight coming down: low and soft, a little fuller on a tread over the shaft
      this._burst(t, wood ? vary(260, 340) : vary(420, 600), 0.5, (wood ? 0.42 : 0.34) * k, 0.006, wood ? 0.032 : 0.024, 'lowpass');
      if (wood) this._burst(t, vary(200, 250), 0.9, 0.1 * k, 0.008, 0.04); // the tread taking it, dull
      // the muffled pat of the sole
      this._burst(t + 0.003, vary(1000, 1400), 0.6, 0.07 * k, 0.005, 0.014);
      // the sole and the hem brushing the floor: a soft swish, swelling and falling away
      this._burst(t + vary(0.015, 0.04), vary(2000, 3000), 0.5, vary(0.03, 0.05) * k, vary(0.025, 0.045), vary(0.045, 0.08));
      // the ball of the foot
      this._burst(t + toe, wood ? vary(400, 500) : vary(600, 800), 0.5, 0.14 * k, 0.008, 0.02, 'lowpass');
    }

    /** The push of a jump, from `surface` in `room`: both feet at once, and the habit's cloth in the air. */
    jump(surface, room) {
      if (!this.ready) return;
      this._echo = ECHO[room] || 0;
      const t = this.ctx.currentTime + 0.005;
      this._feet(surface, 1.1);
      this._burst(t + 0.02, 700, 0.6, 0.06, 0.06, 0.08, 'lowpass');
    }

    /**
     * Landing on `surface` in `room` at `speed` metres a second: from a soft step down to a heavy
     * thud, the knees taking it, the habit settling.
     */
    land(surface, speed, room) {
      if (!this.ready) return;
      this._echo = ECHO[room] || 0;
      const t = this.ctx.currentTime + 0.005, k = clamp((speed - 1) / 12, 0, 1);
      this._feet(surface, 0.8 + 0.7 * k);
      // the body's weight coming down: a low thud, deeper and longer the harder (noise, not a tone)
      this._burst(t + 0.01, 220 - 90 * k, 0.6, (0.15 + 0.85 * k) * (surface === 'wood' ? 0.9 : 0.75), 0.008, 0.04 + 0.07 * k, 'lowpass');
      if (surface === 'wood') this._burst(t + 0.01, 170, 0.8, 0.35 * k, 0.01, 0.08); // the tread taking it
      // the scuff of the feet, and the habit settling
      this._burst(t + 0.03, 1400, 0.6, 0.06 + 0.12 * k, 0.01, 0.04 + 0.05 * k);
      this._burst(t + 0.06, 600, 0.5, 0.05 + 0.08 * k, 0.05, 0.12, 'lowpass');
    }

    /**
     * The wind of a fall, for a reader moving at `speed` metres a second (0 on the ground): only
     * heard once they fall fast, then louder and higher the faster, and gusting. Called every frame.
     */
    wind(speed) {
      if (!this.ctx) return;
      const level = this.on ? clamp((speed - 3) / 12, 0, 1) : 0;
      if (level === 0 && this._windLevel === 0) return;
      this._windLevel = level;
      if (!this._wind) this._makeWind();
      const t = this.ctx.currentTime, w = this._wind;
      // quick to rise, quicker to stop on landing
      w.gain.gain.setTargetAtTime(0.5 * level * level, t, level > 0 ? 0.12 : 0.05);
      w.low.frequency.setTargetAtTime(250 + 700 * level, t, 0.2);
      w.high.frequency.setTargetAtTime(900 + 1800 * level, t, 0.2);
    }

    /** The wind's sound: two bands of noise, each swaying, always running but silent until needed. */
    _makeWind() {
      const ctx = this.ctx, t = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.master); // (the wind is all about the reader: no room rings with it)
      const band = (f, q, rate, depth, level) => {
        const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noise; src.loop = true;
        filter.type = 'bandpass'; filter.frequency.value = f; filter.Q.value = q;
        g.gain.value = level;
        // gusts: the band swaying in pitch and loudness
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = rate; lg.gain.value = depth;
        lfo.connect(lg).connect(filter.frequency);
        const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
        lfo2.frequency.value = rate * 1.7; lg2.gain.value = level * 0.4;
        lfo2.connect(lg2).connect(g.gain);
        src.connect(filter).connect(g).connect(gain);
        src.start(t, Math.random() * 2); lfo.start(t); lfo2.start(t);
        return filter;
      };
      const low = band(400, 0.8, 0.31, 120, 1);
      const high = band(1500, 1.6, 0.53, 400, 0.35);
      this._wind = { gain, low, high };
    }
  }

  Babel.Sounds = Sounds;
})();
