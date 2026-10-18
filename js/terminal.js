/*
 * The catalogue's screen: finding a text, and going to any hexagon.
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

  function relative(dg, df) {
    const parts = [];
    if (dg) parts.push(`${fmt(Math.abs(dg))} ${Math.abs(dg) === 1 ? 'hexagon' : 'hexagons'} ${dg > 0 ? 'east' : 'west'}`);
    if (df) parts.push(`${fmt(Math.abs(df))} ${Math.abs(df) === 1 ? 'floor' : 'floors'} ${df > 0 ? 'up' : 'down'}`);
    return parts;
  }

  /** 10^x as a plain number when small, or as a power of ten (HTML). */
  function count(log10) {
    if (!isFinite(log10)) return 'never';
    if (log10 < 3) return fmt(Math.max(1, Math.round(Math.pow(10, log10))));
    if (log10 < 6) return fmt(Number(Math.pow(10, log10).toPrecision(2)));
    return `10<sup>${fmt(Math.floor(log10))}</sup>`;
  }

  function duration(seconds) {
    if (!isFinite(seconds)) return 'forever';
    if (seconds < 1.5) return 'a second or so';
    if (seconds < 90) return `about ${Math.round(seconds)} seconds`;
    if (seconds < 5400) return `about ${Math.round(seconds / 60)} minutes`;
    if (seconds < 172800) return `about ${Math.round(seconds / 3600)} hours`;
    const years = seconds / 31557600;
    if (years < 2) return `about ${Math.round(seconds / 86400)} days`;
    if (years < 1e6) return `about ${fmt(Math.round(years))} years`;
    return `about 10<sup>${fmt(Math.floor(Math.log10(years)))}</sup> years`;
  }

  const AUTO_SEARCH_BOOKS = 2e5; // read nearby automatically when a copy should turn up within this many books

  class Terminal {
    constructor(ctx) {
      this.ctx = ctx;
      this.search = null;
      this.query = null; // { symbols, text }
      this.found = null; // nearest result
      this.certain = null;
      this.lastProgress = 0;
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
      if (this.search) this.search.stop('silent');
      this.search = null;
      this.found = null;
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
      $('nearest-stop').addEventListener('click', () => { if (this.search) this.search.stop('stopped'); });
      $('nearest-start').addEventListener('click', () => this._startSearch());
      $('nearest-read').addEventListener('click', () => this._readNearest());
      $('nearest-go').addEventListener('click', () => this._goNearest());
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
      if (this.search) this.search.stop('silent');
      this.search = null;
      this.found = null;
      this.query = p;
      const world = this.ctx.world, player = this.ctx.player;
      this.center = [player.cg, player.cf];
      this.anchor = world.anchor;
      $('find-results').hidden = false;
      $('find-query').textContent = p.text.length > 160 ? p.text.slice(0, 160) + '…' : p.text;
      this.rarity = this.lib.rarity(p.symbols.length);
      this._certain();
      if (Math.pow(10, this.rarity.log10Books) <= AUTO_SEARCH_BOOKS) this._startSearch();
      else this._nearestIdle('far');
    }

    _rarityText() {
      const r = this.rarity;
      if (r.log10Books < 0.05) return 'Most books hold a text this short.';
      return `A copy of a text this long turns up about once in every ${count(r.log10Books)} books.`;
    }

    _nearestIdle(why, progress) {
      const r = this.rarity;
      let status = this._rarityText() + ' ';
      if (why === 'far') {
        status += `The nearest copy is probably about ${count(r.log10Distance)} hexagons away: too far to find by reading the books in between.`;
      } else if (why === 'stopped' || why === 'limit') {
        status = `Stopped after reading ${fmt(progress.books)} books in ${fmt(progress.hexagons)} hexagons; none held the text. ` + this._rarityText();
      }
      $('nearest-status').innerHTML = status;
      $('nearest-where').innerHTML = '';
      this._buttons({ start: true });
      $('nearest-start').textContent = why === 'far' ? 'Search nearby anyway' : 'Search further';
    }

    _buttons(show) {
      for (const k of ['read', 'go', 'stop', 'start']) $('nearest-' + k).hidden = !show[k];
    }

    _startSearch() {
      if (!this.query) return;
      if (this.search) this.search.stop('silent');
      const self = this;
      // when searching further, start again one ring inside where the last search stopped
      const resumeRing = this.lastStop ? Math.max(0, this.lastStop.ring - 1) : 0;
      this.lastStop = null;
      this.searchStart = performance.now();
      this.search = new Babel.NearestSearch({
        lib: this.lib,
        anchor: this.anchor,
        center: this.center,
        query: this.query.symbols,
        maxRing: 100000,
        startRing: resumeRing,
        booksBefore: this.lastStop ? this.lastStop.books : 0,
        hexagonsBefore: this.lastStop ? this.lastStop.hexagons : 0,
        onProgress: (p) => self._progress(p),
        onEnd: (reason, best) => self._ended(reason, best),
      });
      this._buttons({ stop: true });
      $('nearest-where').innerHTML = '';
      $('nearest-status').innerHTML = 'Reading the books around you…';
      this.search.start();
    }

    _progress(p) {
      this.progress = p;
      const now = performance.now();
      if (now - this.lastProgress < 120) return;
      this.lastProgress = now;
      const expected = Math.pow(10, this.rarity.log10Books);
      const eta = p.rate > 0 ? expected / p.rate : Infinity;
      const s = this.search;
      if (s) { p = Object.assign({}, p, { books: p.books + s.booksBefore, hexagons: p.hexagons + s.hexagonsBefore }); }
      const where = p.ring === 0
        ? `Reading the books of this hexagon: ${fmt(p.books)} so far`
        : `Reading the books around you: ${fmt(p.books)} so far, ${fmt(p.hexagons)} ${p.hexagons === 1 ? 'hexagon' : 'hexagons'} read through, now ${fmt(p.ring)} ${p.ring === 1 ? 'hexagon' : 'hexagons'} away`;
      $('nearest-status').innerHTML =
        `${where}, at ${fmt(Math.round(p.rate))} books a second. ${this._rarityText()} At this speed a copy should turn up within ${duration(eta)}.`;
    }

    _ended(reason, best) {
      const s = this.search;
      const progress = { books: s ? s.books + s.booksBefore : 0, hexagons: s ? s.hexagonsDone + s.hexagonsBefore : 0, ring: s ? s.cursor.d : 0 };
      this.search = null;
      if (reason === 'found' && best) {
        this.found = best;
        this._showFound(progress);
      } else {
        this.lastStop = progress;
        this._nearestIdle(reason, progress);
      }
    }

    _showFound(progress) {
      const b = this.found, lib = this.lib;
      const { wall, shelf, volume } = lib.slotParts(b.slot);
      const c = lib.config;
      const page = Math.floor(b.index / c.charactersPerPage), within = b.index % c.charactersPerPage;
      const line = Math.floor(within / c.charactersPerLine), col = within % c.charactersPerLine;
      const rel = relative(b.dg - this.center[0], b.df - this.center[1]);
      const here = rel.length ? `${rel.join(' and ')} from here` : 'In this very hexagon';
      $('nearest-status').innerHTML = `Found after reading ${fmt(progress.books)} ${progress.books === 1 ? 'book' : 'books'}` +
        (rel.length ? ` in ${fmt(progress.hexagons + 1)} hexagons. No nearer hexagon holds the text.` : '.');
      $('nearest-where').innerHTML =
        `<strong>${here.charAt(0).toUpperCase() + here.slice(1)}.</strong> Wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}; page ${fmt(page + 1)}, line ${line + 1}, from character ${col + 1}.`;
      this._buttons({ read: true, go: true });
      $('nearest-go').textContent = rel.length ? 'Go to it' : 'Show me the book';
    }

    _readNearest() {
      const b = this.found, lib = this.lib, world = this.ctx.world;
      const location = world.location(b.dg, b.df, b.slot);
      this.ctx.openBookAt({ location, slot: b.slot, highlight: { start: b.index, length: this.query.symbols.length }, returnTo: 'terminal' });
    }

    _goNearest() {
      const b = this.found;
      const { wall, shelf, volume } = this.lib.slotParts(b.slot);
      this.ctx.world.setMark({ dg: b.dg, df: b.df, slot: b.slot, start: b.index, length: this.query.symbols.length });
      this.ctx.goToCell(b.dg, b.df, { wall, shelf, volume });
    }

    /* ---------------- the copy that certainly exists ---------------- */

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
