/*
 * The catalogue's screen: finding where a text stands, and going to any hexagon.
 *
 * A text is found by running the shelving backwards: the catalogue composes the book
 * that begins with the text, and the inverse permutation gives the shelf it stands on.
 *
 * It talks to the rest of the game through a small context object (see main.js):
 *   ctx.lib(), ctx.world, ctx.player, ctx.dims, ctx.setMode(mode), ctx.startWalking(),
 *   ctx.openBookAt(options), ctx.goToCell(dg, df, face), ctx.goToAddress(gallery, floor, face),
 *   ctx.goToRandom(), ctx.useSeed(seed), ctx.toast(text), ctx.copyText(text, done)
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('en');
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  /** "3 hexagons east", "about 10^1,234 floors up" (HTML), or '' for zero. */
  function stretch(lib, diff, one, many, pos, neg) {
    if (diff.sign === 0) return '';
    const m = lib.magnitude(diff.digits), dir = diff.sign > 0 ? pos : neg;
    if (m.exact !== null) return `${fmt(m.exact)} ${m.exact === 1 ? one : many} ${dir}`;
    return `about 10<sup>${fmt(Math.floor(m.log10))}</sup> ${many} ${dir}`;
  }

  class Terminal {
    constructor(ctx) {
      this.ctx = ctx;
      this.query = null; // { symbols, text }
      this.certain = null; // { location, content }
      this._bind();
    }

    get lib() { return this.ctx.lib(); }

    open() {
      this.ctx.setMode('terminal');
      this._renderHere();
      this._note();
      const active = $('tab-go').getAttribute('aria-selected') === 'true' ? $('go-east') : $('find-text');
      setTimeout(() => active.focus({ preventScroll: true }), 0);
    }

    close() { this.ctx.startWalking(); }

    /** Forget everything that depended on the current shelving or anchor. */
    reset() {
      this.certain = null;
      this.query = null;
      $('find-results').hidden = true;
    }

    /* ---------------- wiring ---------------- */

    _bind() {
      $('terminal-close').addEventListener('click', () => this.close());
      for (const [tab, panel] of [['tab-find', 'panel-find'], ['tab-go', 'panel-go']]) {
        $(tab).addEventListener('click', () => this._tab(tab, panel));
      }
      $('find-text').addEventListener('input', () => this._note());
      $('find-paste').addEventListener('click', () => this._paste());
      $('find-form').addEventListener('submit', (e) => { e.preventDefault(); this.find(); });
      $('find-text').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.find(); }
      });
      for (const r of document.querySelectorAll('input[name="fill"]')) r.addEventListener('change', () => this._certain());
      $('certain-read').addEventListener('click', () => this._readCertain());
      $('certain-go').addEventListener('click', () => this._goCertain());
      $('certain-copy').addEventListener('click', () => {
        const loc = this.certain.location;
        this.ctx.copyText(this.lib.hexagonAddressText(loc.gallery, loc.floor), 'Copied the address of that hexagon.');
      });
      $('go-offset').addEventListener('submit', (e) => { e.preventDefault(); this._goOffset(); });
      $('go-address').addEventListener('submit', (e) => { e.preventDefault(); this._goAddress(); });
      $('go-random').addEventListener('click', () => this.ctx.goToRandom());
      $('term-copy').addEventListener('click', () => {
        const w = this.ctx.world, p = this.ctx.player;
        this.ctx.copyText(this.lib.hexagonAddressText(w.gallery(p.cg).digits, w.floor(p.cf).digits), 'Copied the address of this hexagon.');
      });
    }

    _tab(tab, panel) {
      for (const [t, p] of [['tab-find', 'panel-find'], ['tab-go', 'panel-go']]) {
        $(t).setAttribute('aria-selected', String(t === tab));
        $(p).hidden = p !== panel;
      }
    }

    async _paste() {
      const box = $('find-text');
      try {
        const text = await navigator.clipboard.readText();
        const s = box.selectionStart, e = box.selectionEnd;
        box.value = box.value.slice(0, s) + text + box.value.slice(e);
        box.selectionStart = box.selectionEnd = s + text.length;
        this._note();
      } catch (err) {
        $('find-note').textContent = `This browser did not let the catalogue read the clipboard. Click in the box and press ${isMac ? '⌘V' : 'Ctrl+V'} to paste.`;
      }
      box.focus();
    }

    /** Describes what will be searched for, as the reader types. */
    _note() {
      const lib = this.lib, raw = $('find-text').value;
      const p = lib.prepareText(raw);
      const parts = [];
      if (!raw) parts.push(`Up to ${fmt(lib.M)} characters, in the Library's alphabet: letters, ${lib.alphabet.filter((c) => !/\p{L}/u.test(c)).map((c) => (c === ' ' ? 'space' : c)).join(' ')}.`);
      else {
        parts.push(`${fmt(p.symbols.length)} ${p.symbols.length === 1 ? 'character' : 'characters'}.`);
        if (p.recased) parts.push('Letters are searched for as capitals.');
        if (p.dropped.length) {
          const shown = p.dropped.slice(0, 12).map((c) => `“${c}”`).join(' ');
          parts.push(`Not in the alphabet, so left out: ${shown}${p.dropped.length > 12 ? ' and others' : ''}.`);
        }
        if (p.symbols.length > lib.M) parts.push(`That is longer than a whole book, which holds ${fmt(lib.M)} characters.`);
      }
      $('find-note').textContent = parts.join(' ');
      $('find-go').disabled = !p.symbols.length || p.symbols.length > lib.M;
      return p;
    }

    /* ---------------- finding ---------------- */

    find() {
      const p = this._note();
      if (!p.symbols.length || p.symbols.length > this.lib.M) return;
      this.query = p;
      $('find-results').hidden = false;
      $('find-query').textContent = p.text.length > 160 ? p.text.slice(0, 160) + '…' : p.text;
      this._certain();
    }

    /* ---------------- where the text stands ---------------- */

    _certain() {
      if (!this.query) return;
      const lib = this.lib, world = this.ctx.world, player = this.ctx.player;
      const fill = document.querySelector('input[name="fill"]:checked').value;
      const r = lib.findText(this.query.symbols, { fill });
      this.certain = r;
      const loc = r.location, { wall, shelf, volume } = lib.slotParts(loc.slot);
      const dg = lib.galleryDifference(world.gallery(player.cg).digits, loc.gallery);
      const df = lib.floorDifference(world.floor(player.cf).digits, loc.floor);
      const parts = [stretch(lib, dg, 'hexagon', 'hexagons', 'east', 'west'), stretch(lib, df, 'floor', 'floors', 'up', 'down')].filter(Boolean);
      const far = parts.length ? `${parts.join(' and ')} from here` : 'in this very hexagon';
      $('certain-where').innerHTML =
        `<strong>Wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}, from the first page</strong>, ${far}. ` +
        `Its floor is <span class="addr">${lib.addressText(loc.floor, 16)}</span> and its gallery <span class="addr">${lib.addressText(loc.gallery, 16)}</span>.`;
    }

    _readCertain() {
      const r = this.certain;
      this.ctx.openBookAt({ location: r.location, slot: r.location.slot, content: r.content, highlight: { start: 0, length: this.query.symbols.length }, returnTo: 'terminal' });
    }

    _goCertain() {
      const r = this.certain, loc = r.location;
      const { wall, shelf, volume } = this.lib.slotParts(loc.slot);
      const length = this.query.symbols.length;
      this.ctx.goToAddress(loc.gallery, loc.floor, { wall, shelf, volume }, { slot: loc.slot, start: 0, length });
    }

    /* ---------------- going to a hexagon ---------------- */

    _goOffset() {
      const read = (id) => {
        const v = $(id).value.trim();
        if (v === '') return 0;
        const n = Number(v.replace(/[\s,_]/g, ''));
        return Number.isSafeInteger(n) ? n : null;
      };
      const east = read('go-east'), up = read('go-up');
      if (east === null || up === null) {
        $('go-offset-error').textContent = 'Use whole numbers, at most about nine quadrillion each way. To go further, paste an address below.';
        $('go-offset-error').hidden = false;
        return;
      }
      $('go-offset-error').hidden = true;
      const p = this.ctx.player;
      this.ctx.goToCell(p.cg + east, p.cf + up, null);
    }

    _goAddress() {
      const err = $('go-address-error');
      let a;
      try {
        a = this.lib.parseHexagonAddress($('go-address-text').value);
      } catch (e) {
        err.textContent = e.message;
        err.hidden = false;
        return;
      }
      err.hidden = true;
      if (a.seed && a.seed !== this.lib.seed) this.ctx.useSeed(a.seed);
      this.ctx.goToAddress(a.gallery, a.floor, null);
    }

    _renderHere() {
      const w = this.ctx.world, p = this.ctx.player, lib = this.lib;
      $('term-floor').textContent = lib.addressText(w.floor(p.cf).digits, 16);
      $('term-gallery').textContent = lib.addressText(w.gallery(p.cg).digits, 16);
      $('term-seed').textContent = lib.seed;
    }
  }

  Babel.Terminal = Terminal;
})();
