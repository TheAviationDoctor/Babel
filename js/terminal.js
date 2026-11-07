/*
 * The catalogue's screen: where the reader is, finding where a text or a whole book
 * stands and where a picture hangs, and going to any hexagon.
 *
 * A text is found by running the shelving backwards: the catalogue composes the book
 * that begins with the text, and the inverse permutation gives the shelf it stands on.
 * A book of the collection is first set in pages, the way a book of this Library holds
 * them; then it is found the same way.
 *
 * It talks to the rest of the game through a small context object (see main.js):
 *   ctx.lib(), ctx.world, ctx.player, ctx.dims, ctx.setMode(mode), ctx.startWalking(),
 *   ctx.openBookAt(options), ctx.goToCell(dh, df, face), ctx.goToAddress(hexagon, floor, face),
 *   ctx.goToPainting(hexagon, floor, { title, link }),
 *   ctx.goToRandom(), ctx.toast(text), ctx.copyText(text, done), ctx.linkBase(),
 *   ctx.lastJourney() (how far the last jump through the catalogue went, or null)
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

  /** A count of hexagons or floors, exactly if it is small, else to two figures: "4.8 × 10^946,956" (HTML). */
  function amount(m) {
    if (m.exact !== null && m.exact < 1e9) return fmt(m.exact);
    let e = Math.floor(m.log10), mantissa = Math.pow(10, m.log10 - e);
    if (mantissa >= 9.95) { mantissa = 1; e++; }
    return `${mantissa.toFixed(1)}&#8239;×&#8239;10<sup>${fmt(e)}</sup>`;
  }

  /** A fraction of the way round, as a percentage with one decimal. */
  function percent(x) {
    if (x <= 0) return '0%';
    if (x < 0.001) return 'under 0.1%';
    if (x > 0.999) return 'over 99.9%';
    return `${(100 * x).toFixed(1)}%`;
  }

  // Books once shown to the catalogue were kept in this browser's own storage. The
  // catalogue no longer keeps any, so whatever it kept is forgotten.
  try { if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase('babel'); } catch (e) { /* nothing kept, then */ }

  /** Loads a script beside the page: a page opened by double-click may load scripts, though it may not read files. */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => { s.remove(); resolve(); };
      s.onerror = () => { s.remove(); reject(new Error(`its file, ${src.replace(/\?.*$/, '')}, is missing`)); };
      document.head.appendChild(s);
    });
  }

  /** Bytes deflated and written in base64, back as they were. */
  async function inflate(packed, what) {
    if (typeof DecompressionStream !== 'function') throw new Error(`This browser is too old to open the ${what} of the collection.`);
    const bin = atob(packed), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  }

  /*
   * The Library's own collection of books, shelved in books/ by the download script from
   * the plain-text files in books/uncompressed/: books/index.js lists them, and
   * books/compressed/<id>.js holds each one's text,
   * deflated and in base64. They are scripts because a page opened by double-click may
   * load scripts but not read files; so the collection works there as on the web.
   */
  const collection = {
    books: null, // the list, once loaded
    _loading: null,
    _arrived: new Map(), // shelf id → the function waiting for that book's text
    _script: loadScript,
    /** The list of books, or [] if none has been shelved beside this Library. */
    load() {
      if (!this._loading) {
        this._loading = this._script(`books/index.js?t=${Date.now()}`)
          .then(() => (Array.isArray(window.BABEL_BOOKS) ? window.BABEL_BOOKS : []), () => [])
          .then((books) => { this.books = books; return books; });
      }
      return this._loading;
    },
    /** The text of a book of the collection. */
    async text(book) {
      const packed = await new Promise((resolve, reject) => {
        this._arrived.set(book.shelf, resolve);
        this._script(`books/compressed/${book.shelf}.js`).then(() => {
          if (this._arrived.delete(book.shelf)) reject(new Error('its file on the shelf is not what was expected'));
        }, (e) => { this._arrived.delete(book.shelf); reject(e); });
      });
      return new TextDecoder('utf-8').decode(await inflate(packed, 'books'));
    },
  };
  Babel.Collection = collection; // main.js follows links to the collection's books with it

  // each book's script calls this with its text
  window.BABEL_SHELF_BOOK = (id, packed) => {
    const resolve = collection._arrived.get(id);
    if (resolve) { collection._arrived.delete(id); resolve(packed); }
  };

  /*
   * The Library's own collection of paintings, hung in paintings/ by paintings/hang.js from
   * the pictures in paintings/originals/: paintings/index.js lists them, and
   * paintings/compressed/<id>.js holds each one as the Library holds it, its colour numbers
   * deflated and in base64. Scripts too, for the same reason as the books.
   */
  const gallery = {
    paintings: null, // the list, once loaded
    _loading: null,
    _arrived: new Map(), // id → the function waiting for that painting
    /** The list of paintings, or [] if none has been hung beside this Library. */
    load() {
      if (!this._loading) {
        this._loading = loadScript(`paintings/index.js?t=${Date.now()}`)
          .then(() => (Array.isArray(window.BABEL_PAINTINGS) ? window.BABEL_PAINTINGS : []), () => [])
          .then((list) => { this.paintings = list; return list; });
      }
      return this._loading;
    },
    /** A painting's colour numbers, if it was hung for this Library's paintings. */
    async pixels(painting, lib) {
      const got = await new Promise((resolve, reject) => {
        this._arrived.set(painting.id, resolve);
        loadScript(`paintings/compressed/${painting.id}.js`).then(() => {
          if (this._arrived.delete(painting.id)) reject(new Error('its file is not what was expected'));
        }, (e) => { this._arrived.delete(painting.id); reject(e); });
      });
      const P = lib.painting;
      if (!P || got.width !== P.width || got.height !== P.height || got.colours !== lib.N) {
        throw new Error(`it was hung for paintings of ${got.width} × ${got.height} pixels in ${got.colours} colours, ` +
          (P ? `and this Library's are ${P.width} × ${P.height} in ${lib.N}` : 'and this Library has no paintings') + ': run node paintings/hang.js again');
      }
      const pixels = await inflate(got.packed, 'paintings');
      if (pixels.length !== P.width * P.height) throw new Error('its file is damaged');
      return pixels;
    },
  };
  Babel.Gallery = gallery; // main.js follows links to the collection's paintings with it

  // each painting's script calls this with its colour numbers
  window.BABEL_HANG_PAINTING = (id, width, height, colours, packed) => {
    const resolve = gallery._arrived.get(id);
    if (resolve) { gallery._arrived.delete(id); resolve({ width, height, colours, packed }); }
  };

  /** A picture file's pixels, { width, height, rgba }, read by the browser, and made no larger than 4,096 pixels a side. */
  async function readPicture(file) {
    let bitmap = await createImageBitmap(file);
    const most = 4096, side = Math.max(bitmap.width, bitmap.height);
    if (side > most) {
      const k = most / side, w = Math.max(1, Math.round(bitmap.width * k)), h = Math.max(1, Math.round(bitmap.height * k));
      bitmap.close();
      bitmap = await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(bitmap, 0, 0);
    bitmap.close();
    return { width: canvas.width, height: canvas.height, rgba: g.getImageData(0, 0, canvas.width, canvas.height).data };
  }

  /** Draws a painting on a canvas, smaller: each of its pixels the average, in linear light, of a square of the painting's. */
  function drawPainting(canvas, pixels, lib) {
    const P = lib.painting, pal = lib.paintingPalette();
    const f = Math.max(1, Math.ceil(Math.max(P.width, P.height) / 256)), w = Math.max(1, Math.floor(P.width / f)), h = Math.max(1, Math.floor(P.height / f));
    const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lin = Float64Array.from(pal, toLin);
    const toByte = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d'), img = g.createImageData(w, h), d = img.data, n = f * f;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, gg = 0, b = 0;
        for (let v = 0; v < f; v++) {
          for (let u = 0; u < f; u++) {
            const c = pixels[(y * f + v) * P.width + x * f + u] * 3;
            r += lin[c]; gg += lin[c + 1]; b += lin[c + 2];
          }
        }
        const o = (y * w + x) * 4;
        d[o] = toByte(r / n); d[o + 1] = toByte(gg / n); d[o + 2] = toByte(b / n); d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  /** The year to order a painting by: the first one its dates give. */
  const yearKey = (p) => { const m = /\d{3,4}/.exec(p.year || ''); return m ? Number(m[0]) : 99999; };

  /** The name to order a painter by: "Pieter Bruegel the Elder" → "bruegel". */
  const painterKey = (artist) => {
    const words = fold(artist).replace(/\s+the\s+(elder|younger)$/, '').split(/\s+/).filter(Boolean);
    return words.length ? words[words.length - 1] : '\uffff';
  };

  /** Lower case, without accents: for searching. */
  const fold = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /** The surname to order an author by: "Arthur Conan Doyle" → "doyle", "Karl Marx and Friedrich Engels" → "marx". */
  function surname(author) {
    const first = fold(author).split(/\s+and\s+|,|;/)[0].replace(/\s+(jr|sr)\.?$/, '').trim();
    const words = first.split(/\s+/).filter(Boolean);
    return words.length ? words[words.length - 1] : '\uffff';
  }

  /** A title to order by, without a leading "The", "A" or "An". */
  const titleKey = (title) => fold(title).replace(/^(the|a|an)\s+/, '');

  /** Reads a text file as UTF-8, or as Windows-1252 if it is clearly not UTF-8. */
  async function readTextFile(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\uFFFD')) {
      try { text = new TextDecoder('windows-1252').decode(buf); } catch (e) { /* keep UTF-8 */ }
    }
    return text.replace(/^\uFEFF/, '');
  }

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  /** "the 26 letters, the ten digits, : , ! . ? and space", or the like, for any alphabet. */
  function alphabetWords(lib) {
    const a = lib.alphabet, shown = lib.glyphs;
    const controls = shown.filter((g, i) => g !== a[i]);
    const plain = a.filter((c, i) => shown[i] === c);
    const letters = plain.filter((c) => /\p{L}/u.test(c)), digits = plain.filter((c) => /\p{Nd}/u.test(c));
    const upper = letters.filter((c) => /^[A-Z]$/.test(c)), lower = letters.filter((c) => /^[a-z]$/.test(c));
    const others = letters.filter((c) => !upper.includes(c) && !lower.includes(c));
    const rest = plain.filter((c) => !letters.includes(c) && !digits.includes(c) && c !== ' ');
    const words = [];
    if (upper.length === 26 && lower.length === 26) words.push('the 26 letters, in capitals and in small letters');
    else if (upper.length === 26 && !lower.length) words.push('the 26 letters');
    else if (upper.length + lower.length) words.push(`${upper.length + lower.length} of the letters A to Z`);
    if (others.length) words.push(others.length <= 40 ? `${others.length} more letters (${others.join(' ')})` : `${others.length} more letters`);
    if (digits.length) words.push(digits.length === 10 ? 'the ten digits' : `the digits ${digits.join(' ')}`);
    if (rest.length) words.push(rest.join(' '));
    if (a.includes(' ')) words.push('space');
    if (controls.length) {
      const list = controls.length > 3 ? `${controls[0]} ${controls[1]} … ${controls[controls.length - 1]}` : controls.join(' ');
      words.push(`${controls.length === 1 ? 'one control character' : `${controls.length} control characters`}, which books show as ${list}`);
    }
    return words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words.join('');
  }

  /** "“ß” as “ss”, “…” as “...”": what the catalogue put in place of characters the alphabet lacks. */
  function equivalents(substitutions) {
    const shown = substitutions.slice(0, 8).map(([from, to]) => `“${from}” as “${to}”`);
    return shown.join(', ') + (substitutions.length > 8 ? ' and others' : '');
  }

  /** "capitals" or "small letters": the one case of an alphabet that has only one. */
  const oneCase = (lib) => (lib.alphabet.some((c) => /\p{Lu}/u.test(c)) ? 'capitals' : 'small letters');

  const TABS = [['tab-here', 'panel-here'], ['tab-browse', 'panel-browse'], ['tab-find', 'panel-find'], ['tab-go', 'panel-go']];
  // within two of them, two kinds of thing
  const SUBTABS = {
    books: [['sub-books', 'browse-books'], ['sub-paintings', 'browse-paintings']],
    find: [['sub-text', 'find-text-panel'], ['sub-image', 'find-painting-panel']],
  };
  const SUBTAB_FOCUS = { 'sub-text': 'find-text', 'sub-image': 'image-upload', 'sub-books': 'shelf-filter', 'sub-paintings': 'gallery-filter' };

  class Terminal {
    constructor(ctx) {
      this.ctx = ctx;
      this.query = null; // { symbols, text }
      this.certain = null; // { location, content }
      this.typeset = new Map(); // key → a book of the collection set in pages
      this.book = null; // { entry, meta, set, found: [{ location, content }] }
      this.painting = null; // a painting of the collection: { entry, pixels, place }
      this.image = null; // a picture uploaded: { name, picture, pixels, place }
      this._bind();
    }

    get lib() { return this.ctx.lib(); }

    open() {
      this.ctx.setMode('terminal');
      this._renderHere();
      this._note();
      // the reader may have walked since: distances are measured again from here
      if (this.query) this._certain();
      if (this.book) this._placeBook();
      if (this.painting) this._placePainting();
      if (this.image && this.image.place) this._placeImage();
      const tab = TABS.find(([t]) => $(t).getAttribute('aria-selected') === 'true')[0];
      if (tab === 'tab-browse') this._openBrowse();
      const active = {
        'tab-here': $('panel-here'), 'tab-find': $(SUBTAB_FOCUS[this._selected('find')]),
        'tab-browse': $(SUBTAB_FOCUS[this._selected('books')]), 'tab-go': $('go-east'),
      }[tab];
      setTimeout(() => active.focus({ preventScroll: true }), 0);
    }

    close() { this.ctx.startWalking(); }

    /** Forget everything that depended on the current shelving or anchor. */
    reset() {
      this.certain = null;
      this.query = null;
      $('find-results').hidden = true;
      this.book = null;
      $('book-results').hidden = true;
      this._markCurrent();
      this.painting = null;
      $('painting-results').hidden = true;
      this._markGallery();
      this.image = null;
      $('image-results').hidden = true;
      $('image-status').textContent = '';
    }

    /* ---------------- wiring ---------------- */

    _bind() {
      $('terminal-close').addEventListener('click', () => this.close());
      for (const [tab, panel] of TABS) $(tab).addEventListener('click', () => this._tab(tab, panel));
      for (const group of Object.keys(SUBTABS)) for (const [tab] of SUBTABS[group]) $(tab).addEventListener('click', () => this._subtab(group, tab));
      // a picture, found as a painting
      $('image-upload').addEventListener('click', () => $('image-upload-input').click());
      $('image-upload-input').addEventListener('change', () => this._uploadImage($('image-upload-input')));
      for (const r of document.querySelectorAll('input[name="image-fit"]')) r.addEventListener('change', () => this._hangImage());
      $('image-go').addEventListener('click', () => this._goPainting(this.image.place, 'your picture, as a painting of the Library', null));
      $('image-copy').addEventListener('click', () => this._copyPlace(this.image.place));
      // the collection of paintings
      $('gallery-filter').addEventListener('input', () => this._filterGallery());
      $('gallery-order').addEventListener('change', () => this._renderGallery());
      $('painting-go').addEventListener('click', () => {
        const p = this.painting;
        this._goPainting(p.place, p.entry.title, BabelCore.Library.paintingLink(p.entry.id));
      });
      $('painting-copy').addEventListener('click', () => this._copyPlace(this.painting.place));
      $('painting-link').addEventListener('click', () => {
        this._copyLink(this._shortLink(BabelCore.Library.paintingLink(this.painting.entry.id)), 'Copied a link to this painting. Whoever opens it is set down before it.');
      });
      $('find-text').addEventListener('input', () => this._note());
      $('find-upload').addEventListener('click', () => $('find-upload-input').click());
      $('find-upload-input').addEventListener('change', () => this._upload($('find-upload-input')));
      $('find-paste').addEventListener('click', () => this._paste());
      $('find-form').addEventListener('submit', (e) => { e.preventDefault(); this.find(); });
      $('find-text').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.find(); }
      });
      $('certain-go').addEventListener('click', () => this._goCertain());
      $('certain-link').addEventListener('click', () => this._copyLink(this.certainLink));
      $('certain-secret').addEventListener('click', () => this._toggleSecret($('certain-secret-box'), () => this.query.raw));
      $('certain-copy').addEventListener('click', () => {
        const loc = this.certain.location;
        this.ctx.copyText(this.lib.hexagonAddressText(loc.hexagon, loc.floor), 'Copied the location of its hexagon. Paste it in the Jump tab to go there, even after closing the page.');
      });
      $('shelf-filter').addEventListener('input', () => this._filterShelf());
      $('shelf-order').addEventListener('change', () => this._renderShelf());
      $('go-offset').addEventListener('submit', (e) => { e.preventDefault(); this._goOffset(); });
      $('go-address').addEventListener('submit', (e) => { e.preventDefault(); this._goAddress(); });
      $('go-random').addEventListener('click', () => this.ctx.goToRandom());
      window.addEventListener('resize', () => this._fitMap());
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this._fitMap()).catch(() => {});
      $('term-copy').addEventListener('click', () => {
        const w = this.ctx.world, p = this.ctx.player;
        this.ctx.copyText(this.lib.hexagonAddressText(w.hexagon(p.ch).digits, w.floor(p.cf).digits), 'Copied the address of this hexagon.');
      });
    }

    _tab(tab, panel) {
      for (const [t, p] of TABS) {
        $(t).setAttribute('aria-selected', String(t === tab));
        $(p).hidden = p !== panel;
      }
      if (tab === 'tab-here') this._fitMap();
      if (tab === 'tab-browse') this._openBrowse();
    }

    /** The sub-tab chosen in a group ('find' or 'books'). */
    _selected(group) { return SUBTABS[group].find(([t]) => $(t).getAttribute('aria-selected') === 'true')[0]; }

    _subtab(group, tab) {
      for (const [t, p] of SUBTABS[group]) {
        $(t).setAttribute('aria-selected', String(t === tab));
        $(p).hidden = t !== tab;
      }
      if (group === 'books') this._openBrowse();
      setTimeout(() => $(SUBTAB_FOCUS[tab]).focus({ preventScroll: true }), 0);
    }

    /** Opens the list of the Browse tab's sub-tab: the books, or the paintings. */
    _openBrowse() {
      if (this._selected('books') === 'sub-paintings') this._openGallery();
      else this._openShelf();
    }

    /** Puts the text of a .txt file in the box, in place of what was there. */
    async _upload(input) {
      const file = input.files && input.files[0];
      input.value = ''; // so that choosing the same file again reads it again
      if (!file) return;
      const note = $('find-note'), box = $('find-text');
      if (!/\.txt$/i.test(file.name) && file.type !== 'text/plain') {
        note.textContent = 'Only plain-text files (.txt) can be read here.';
        return;
      }
      // no character takes more than 4 bytes: a larger file holds more than a book can
      if (file.size > 4 * this.lib.M) {
        note.textContent = `${file.name} is longer than a book of the Library, which holds ${fmt(this.lib.M)} characters.`;
        return;
      }
      try {
        box.value = await readTextFile(file);
      } catch (e) {
        note.textContent = `The browser could not read ${file.name}.`;
        return;
      }
      box.selectionStart = box.selectionEnd = 0;
      box.scrollTop = 0;
      this._note();
      box.focus();
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
      const p = lib.layText(raw);
      const parts = [];
//      if (!raw) parts.push(`Up to ${fmt(lib.M)} characters, in the Library's alphabet: ${alphabetWords(lib)}.`);
      if (!raw) parts.push(`Up to ${fmt(lib.M)} characters (A–Z, a-z, accented letters, digits, and punctuation).`);
      else {
        const chars = `${fmt(p.characters)} ${p.characters === 1 ? 'character' : 'characters'}`;
        parts.push(p.lines > 1 ? `Search ${chars}, set in ${fmt(p.lines)} lines of ${lib.config.charactersPerLine}, with no word cut at the end of a line, and a blank line before each new, indented paragraph.` : `Search ${chars}.`);
        if (p.recased) parts.push(`Letters are searched for as ${oneCase(lib)}.`);
        if (p.substitutions.length) parts.push(`Some characters are read as their nearest equivalents in the alphabet: ${equivalents(p.substitutions)}.`);
        if (p.dropped.length) {
          const shown = p.dropped.slice(0, 12).map((c) => `“${c}”`).join(' ');
          parts.push(`Not in the alphabet, so left out: ${shown}${p.dropped.length > 12 ? ' and others' : ''}.`);
        }
        if (p.symbols.length > lib.M) parts.push(`That is longer than a whole book, which holds ${fmt(lib.M / lib.config.charactersPerLine)} lines of ${lib.config.charactersPerLine} characters.`);
      }
      $('find-note').textContent = parts.join(' ');
      $('find-go').disabled = !p.symbols.length || p.symbols.length > lib.M;
      return p;
    }

    /* ---------------- finding ---------------- */

    find() {
      const p = this._note();
      if (!p.symbols.length || p.symbols.length > this.lib.M) return;
      this.query = Object.assign({ raw: $('find-text').value }, p);
      $('find-results').hidden = false;
      $('find-query').textContent = p.text.length > 160 ? p.text.slice(0, 160) + '…' : p.text;
      $('certain-secret-box').textContent = '';
      this._certain();
    }

    /* ---------------- where the text stands ---------------- */

    _certain() {
      if (!this.query) return;
      const lib = this.lib, world = this.ctx.world, player = this.ctx.player;
      const r = lib.findText(this.query.symbols);
      this.certain = r;
      // a link to this very book: the text, which it holds from the start of its first page
      this.certainLink = this._link(this.query.raw);
      $('certain-where').innerHTML = this._whereHTML(r.location, 'from the first page');
    }

    /* ---------------- links ---------------- */

    /**
     * A link that leads anyone to this book: it carries the text, compressed, and the
     * Library finds the book again from it. Made ahead of the click, so that copying
     * happens within the click itself, as some browsers require.
     */
    /** A short link already made, in the form _copyLink takes. */
    _shortLink(hash) {
      const base = this.ctx.linkBase();
      if (!base) return null;
      const url = base.replace(/#.*$/, '') + hash;
      return { url, promise: Promise.resolve(url) };
    }

    _link(text) {
      const base = this.ctx.linkBase();
      if (!base) return null;
      const p = BabelCore.Library.makeLink(base, text).catch(() => null);
      const holder = { url: null, promise: p };
      p.then((url) => { holder.url = url; });
      return holder;
    }

    async _copyLink(holder, done) {
      if (!holder || !holder.promise) {
        this.ctx.toast('To copy links from a copy of the Library on this computer, set "website" in config.js to the address where the Library is published.');
        return;
      }
      const url = holder.url || (await holder.promise);
      if (!url) { this.ctx.toast('The link could not be made.'); return; }
      const long = url.length > 60000 ? ` It is ${fmt(url.length)} characters long, which is more than some browsers and websites accept.` : '';
      this.ctx.copyText(url, `${done || 'Copied a link to this book. Whoever opens it is set down before the book.'}${long}`);
    }

    /** Shows, or hides again, the form that makes a secret link to a text, in `box`. */
    _toggleSecret(box, getText) {
      if (box.firstChild) { box.textContent = ''; return; }
      const form = this._secretForm(getText);
      box.appendChild(form);
      form.querySelector('input').focus();
    }

    /**
     * The form that makes a secret link: a password, twice, then the link, copied with a
     * second click (encrypting takes a moment, and browsers only copy within a click).
     */
    _secretForm(getText) {
      const form = el('form', 'secret-make');
      form.autocomplete = 'off';
      const note = el('p', 'note', 'A secret link carries the text encrypted with a password of your choosing. Whoever opens it is asked for the password: give it to them separately, since the link alone cannot be read. The password is kept nowhere, and cannot be recovered.');
      const field = (label) => {
        const input = el('input');
        input.type = 'password';
        input.autocomplete = 'new-password';
        input.spellcheck = false;
        input.placeholder = label;
        input.setAttribute('aria-label', label);
        return input;
      };
      const password = field('Password'), again = field('The password again');
      const make = el('button', 'primary', 'Make the secret link');
      make.type = 'submit';
      const error = el('p', 'error');
      error.hidden = true;
      const out = el('input', 'secret-link');
      out.type = 'text';
      out.readOnly = true;
      out.setAttribute('aria-label', 'The secret link');
      const copy = el('button', 'primary', 'Copy the secret link');
      copy.type = 'button';
      const made = el('div', 'row');
      made.hidden = true;
      made.append(out, copy);
      const fields = el('div', 'row');
      fields.append(password, again, make);
      form.append(note, fields, error, made);

      let url = null;
      const forget = () => { url = null; made.hidden = true; };
      password.addEventListener('input', forget);
      again.addEventListener('input', forget);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fail = (text) => { error.textContent = text; error.hidden = false; };
        error.hidden = true;
        forget();
        if (password.value.length < 8) return fail('Choose a password of at least 8 characters. A few words make a stronger one, and one easier to remember.');
        if (password.value !== again.value) return fail('The two passwords are not the same.');
        const base = this.ctx.linkBase();
        if (!base) return fail('To make links from a copy of the Library on this computer, set "website" in config.js to the address where the Library is published.');
        make.disabled = true;
        make.textContent = 'Encrypting…';
        try {
          url = await BabelCore.Library.makeSecretLink(base, getText(), password.value);
          out.value = url;
          made.hidden = false;
          copy.focus();
        } catch (x) {
          fail(x.message || 'The secret link could not be made.');
        } finally {
          make.disabled = false;
          make.textContent = 'Make the secret link';
        }
      });
      copy.addEventListener('click', () => {
        if (!url) return;
        const long = url.length > 60000 ? ` It is ${fmt(url.length)} characters long, which is more than some browsers and websites accept.` : '';
        this.ctx.copyText(url, `Copied the secret link. Whoever opens it is asked for its password, which the link does not hold.${long}`);
      });
      return form;
    }

    /** "Wall 2, shelf 3, volume 17, …, about 10^… hexagons east from here. Its floor is …" (HTML). */
    _whereHTML(loc, from) {
      const lib = this.lib, world = this.ctx.world, player = this.ctx.player;
      const { wall, shelf, volume } = lib.slotParts(loc.slot);
      const dh = lib.hexagonDifference(world.hexagon(player.ch).digits, loc.hexagon);
      const df = lib.floorDifference(world.floor(player.cf).digits, loc.floor);
      const parts = [stretch(lib, dh, 'hexagon', 'hexagons', 'east', 'west'), stretch(lib, df, 'floor', 'floors', 'up', 'down')].filter(Boolean);
      const far = parts.length ? `${parts.join(' and ')} from here` : 'in this very hexagon';
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<strong>Wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}${from ? ', ' + from : ''}</strong>, ${far}. ` +
        `It stands on floor <span class="addr">${esc(lib.addressText(loc.floor, 16))}</span>, in hexagon <span class="addr">${esc(lib.addressText(loc.hexagon, 16))}</span> of that floor.`;
    }

    _goCertain() {
      const r = this.certain, loc = r.location;
      const { wall, shelf, volume } = this.lib.slotParts(loc.slot);
      const h = this.certainLink, link = h && h.url ? h.url.slice(h.url.indexOf('#')) : null;
      this.ctx.goToAddress(loc.hexagon, loc.floor, { wall, shelf, volume }, { slot: loc.slot, link });
    }

    /* ---------------- finding a whole book ---------------- */

    /**
     * A book of the collection set in pages, as the Library would hold it (kept, since it
     * does not depend on the seed). Project Gutenberg's licence is left out.
     */
    _set(entry) {
      const key = entry.key;
      let t = this.typeset.get(key);
      if (!t) {
        const clean = BabelCore.Library.cleanEbook(entry.text);
        // without a title page: the same text is the same book, whatever its title
        t = { meta: entry.meta, text: clean.text, set: this.lib.typeset(clean.text, {}), trimmed: clean.trimmed };
        this.typeset.set(key, t);
        // books of the collection can be long: keep only the last few of them set
        const kept = [...this.typeset.keys()].filter((k) => k.startsWith('shelf:'));
        for (const k of kept.slice(0, Math.max(0, kept.length - 6))) this.typeset.delete(k);
      }
      return t;
    }

    _markCurrent() {
      for (const li of $('shelf-list').children) li.setAttribute('aria-current', String(!!this.book && li.dataset.key === this.book.entry.key));
    }

    /* ---------------- the collection ---------------- */

    /** Shows the collection, loading its list the first time. */
    async _openShelf() {
      if (this._shelfShown) return;
      this._shelfShown = true;
      $('shelf-intro').textContent = 'Opening the shelves…';
      const books = await collection.load();
      if (!books.length) {
        $('shelf-intro').textContent = 'This Library has no collection of books yet. To give it one, put plain-text files (.txt) in its books/uncompressed folder and run python3 books/shelve.py.';
        $('shelf-list').hidden = true;
        document.querySelector('#panel-books .shelf-tools').hidden = true;
        return;
      }
      for (const b of books) b.search = fold([b.title, b.author, b.language].join(' '));
      this._renderShelf();
    }

    /** Lists the collection in the order chosen. */
    _renderShelf() {
      const books = collection.books;
      if (!books || !books.length) return;
      const order = $('shelf-order').value;
      const sorted = books.slice();
      if (order === 'title') sorted.sort((a, b) => titleKey(a.title).localeCompare(titleKey(b.title), 'en'));
      else if (order === 'author') sorted.sort((a, b) => surname(a.author).localeCompare(surname(b.author), 'en') || fold(a.author).localeCompare(fold(b.author), 'en') || titleKey(a.title).localeCompare(titleKey(b.title), 'en'));
      const list = $('shelf-list');
      list.textContent = '';
      for (const book of sorted) {
        const li = el('li');
        li.dataset.key = 'shelf:' + book.file;
        li._book = book;
        const info = el('div');
        info.appendChild(el('cite', '', book.title));
        const by = [book.author, book.year].filter(Boolean).join(', ');
        const line = el('span', 'note');
        if (by) line.appendChild(el('span', 'by', by));
        line.append([by ? '' : null, book.language && !/^english$/i.test(book.language) ? book.language : null, `${fmt(book.characters)} characters`].filter((x) => x !== null).join(' · '));
        info.appendChild(line);
        const button = el('button', '', 'Locate it');
        button.type = 'button';
        button.addEventListener('click', () => this.findShelfBook(book));
        li.append(info, button);
        list.appendChild(li);
      }
      this._filterShelf();
      this._markCurrent();
    }

    /** Shows only the books whose title, author or language holds every word searched for. */
    _filterShelf() {
      const books = collection.books;
      if (!books || !books.length) return;
      const words = fold($('shelf-filter').value).split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const li of $('shelf-list').children) {
        const ok = words.every((w) => li._book.search.includes(w));
        li.hidden = !ok;
        if (ok) shown++;
      }
      // how many books there are, and how many match the search, in the line above it
      const index = `An index of ${fmt(books.length)} literary classics`;
      $('shelf-intro').textContent = !words.length ? `${index}. Pick one and find it in the Library.`
        : shown ? `${index}, of which ${fmt(shown)} ${shown === 1 ? 'matches' : 'match'} your search. Pick one and find it in the Library.`
          : `${index}, none of which matches your search.`;
    }

    /** Takes a book of the collection down from its shelf, then finds it in the Library. */
    async findShelfBook(book) {
      const ticket = (this._ticket = (this._ticket || 0) + 1);
      $('book-results').hidden = false;
      $('book-found-title').replaceChildren('Where ', el('cite', '', book.title), ' stands');
      $('book-how').hidden = false;
      $('book-how').textContent = 'Taking it down from the shelf…';
      $('book-parts').textContent = '';
      $('book-found-title').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      let text;
      try {
        text = await collection.text(book);
      } catch (e) {
        if (ticket === this._ticket) $('book-how').textContent = `It could not be taken down: ${e.message}`;
        return;
      }
      if (ticket !== this._ticket) return; // another book was chosen meanwhile
      $('book-how').textContent = 'Setting it in pages and finding its shelf…';
      await new Promise((r) => setTimeout(r, 30)); // let that be seen before the work begins
      if (ticket !== this._ticket) return;
      this.findBook({ key: 'shelf:' + book.file, name: book.file, shelf: book.shelf, text, meta: { title: book.title, author: book.author, year: book.year } });
    }

    findBook(entry) {
      this._ticket = (this._ticket || 0) + 1;
      const { meta, text, set, trimmed } = this._set(entry);
      this.book = { entry, meta, text, set, trimmed, found: null };
      this._placeBook();
      this._markCurrent();
      $('book-results').hidden = false;
      $('book-found-title').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /** Runs the shelving backwards for every part of the book, its pages after the text blank. */
    _placeBook() {
      const b = this.book;
      if (!b) return;
      const lib = this.lib, set = b.set, n = set.parts.length;
      b.found = set.parts.map((part) => lib.findText(part));

      $('book-found-title').replaceChildren('Where ', el('cite', '', b.meta.title), ' stands');
      $('book-how').textContent = '';
      $('book-how').hidden = true;

      const ol = $('book-parts');
      ol.textContent = '';
      b.found.forEach((r, k) => {
        const li = el('li');
        const p = el('p', 'where');
        p.innerHTML = (n > 1 ? `Part ${k + 1} of ${n}: ` : '') + this._whereHTML(r.location, 'from the first page');
        const row = el('div', 'row');
        const go = el('button', 'primary', 'Go there');
        const copy = el('button', '', 'Copy its location');
        const link = el('button', '', 'Copy a public link');
        for (const x of [go, copy, link]) x.type = 'button';
        // a link to a book of the collection names it, and the part
        const bookHash = BabelCore.Library.bookLink(b.entry.shelf, k + 1);
        const holder = this._shortLink(bookHash);
        link.addEventListener('click', () => this._copyLink(holder));
        const linkOf = () => bookHash;
        go.addEventListener('click', () => {
          const loc = r.location, face = this.lib.slotParts(loc.slot);
          const title = n > 1 ? `${b.meta.title}, part ${k + 1} of ${n}` : b.meta.title;
          this.ctx.goToAddress(loc.hexagon, loc.floor, face, { slot: loc.slot, title, link: linkOf() });
        });
        copy.addEventListener('click', () => {
          const loc = r.location, { wall, shelf, volume } = this.lib.slotParts(loc.slot);
          this.ctx.copyText(this.lib.hexagonAddressText(loc.hexagon, loc.floor), `Copied the location of its hexagon. Paste it in the Jump tab to go there; the book is on wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}.`);
        });
        row.append(go, copy, link);
        li.append(p, row);
        ol.appendChild(li);
      });
    }

    /* ---------------- paintings ---------------- */

    /** "In the vestibule east of its hexagon, opposite the mirror, … from here. Its hexagon is on floor …" (HTML). */
    _hangsHTML(place) {
      const lib = this.lib, world = this.ctx.world, player = this.ctx.player;
      const dh = lib.hexagonDifference(world.hexagon(player.ch).digits, place.hexagon);
      const df = lib.floorDifference(world.floor(player.cf).digits, place.floor);
      const parts = [stretch(lib, dh, 'hexagon', 'hexagons', 'east', 'west'), stretch(lib, df, 'floor', 'floors', 'up', 'down')].filter(Boolean);
      const far = parts.length ? `${parts.join(' and ')} from here` : 'in the vestibule of this very hexagon';
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<strong>In the vestibule east of its hexagon</strong>, ${far}. ` +
        `Its hexagon is on floor <span class="addr">${esc(lib.addressText(place.floor, 16))}</span>, hexagon <span class="addr">${esc(lib.addressText(place.hexagon, 16))}</span> of that floor.`;
    }

    _goPainting(place, title, link) { this.ctx.goToPainting(place.hexagon, place.floor, { title, link }); }

    _copyPlace(place) {
      this.ctx.copyText(this.lib.hexagonAddressText(place.hexagon, place.floor), 'Copied the location of its hexagon. Paste it in the Jump tab to go there; the painting hangs in the vestibule east of that hexagon, opposite the mirror.');
    }

    /** Shows the collection of paintings, loading its list the first time. */
    async _openGallery() {
      if (this._galleryShown) return;
      this._galleryShown = true;
      $('gallery-intro').textContent = 'Opening the gallery…';
      const paintings = await gallery.load();
      if (!this.lib.painting) {
        $('gallery-intro').textContent = "With this Library's configuration, no painting can hang in only one hexagon, so its vestibules have none (see Paintings in README.md).";
        $('gallery-list').hidden = true;
        document.querySelector('#browse-paintings .gallery-tools').hidden = true;
        return;
      }
      if (!paintings.length) {
        $('gallery-intro').textContent = 'This Library has no collection of paintings yet. To give it one, put pictures (GIF, JPEG, or PNG) in its paintings/originals folder and run node paintings/hang.js.';
        $('gallery-list').hidden = true;
        document.querySelector('#browse-paintings .gallery-tools').hidden = true;
        return;
      }
      for (const p of paintings) p.search = fold([p.title, p.artist, p.year].join(' '));
      this._renderGallery();
    }

    /** Lists the paintings in the order chosen. */
    _renderGallery() {
      const paintings = gallery.paintings;
      if (!paintings || !paintings.length) return;
      const order = $('gallery-order').value, sorted = paintings.slice();
      if (order === 'year') sorted.sort((a, b) => yearKey(a) - yearKey(b) || titleKey(a.title).localeCompare(titleKey(b.title), 'en'));
      else if (order === 'title') sorted.sort((a, b) => titleKey(a.title).localeCompare(titleKey(b.title), 'en'));
      else sorted.sort((a, b) => painterKey(a.artist).localeCompare(painterKey(b.artist), 'en') || yearKey(a) - yearKey(b));
      const list = $('gallery-list');
      list.textContent = '';
      for (const painting of sorted) {
        const li = el('li');
        li.dataset.key = painting.id;
        li._painting = painting;
        const info = el('div');
        info.appendChild(el('cite', '', painting.title));
        const line = el('span', 'note');
        line.appendChild(el('span', 'by', [painting.artist, painting.year].filter(Boolean).join(', ')));
        info.appendChild(line);
        const button = el('button', '', 'Locate it');
        button.type = 'button';
        button.addEventListener('click', () => this.findPainting(painting));
        li.append(info, button);
        list.appendChild(li);
      }
      this._filterGallery();
      this._markGallery();
    }

    /** Shows only the paintings whose title, painter or date holds every word searched for. */
    _filterGallery() {
      const paintings = gallery.paintings;
      if (!paintings || !paintings.length) return;
      const words = fold($('gallery-filter').value).split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const li of $('gallery-list').children) {
        const ok = words.every((w) => li._painting.search.includes(w));
        li.hidden = !ok;
        if (ok) shown++;
      }
      const index = `An index of ${fmt(paintings.length)} ${paintings.length === 1 ? 'painting' : 'paintings'}`;
      $('gallery-intro').textContent = !words.length ? `${index}. Pick one and find it in the Library.`
        : shown ? `${index}, of which ${fmt(shown)} ${shown === 1 ? 'matches' : 'match'} your search. Pick one and find it in the Library.`
          : `${index}, none of which matches your search.`;
    }

    _markGallery() {
      for (const li of $('gallery-list').children) li.setAttribute('aria-current', String(!!this.painting && li.dataset.key === this.painting.entry.id));
    }

    /** Takes a painting of the collection down from its wall, then finds the vestibule it hangs in. */
    async findPainting(painting) {
      const ticket = (this._paintingTicket = (this._paintingTicket || 0) + 1);
      this.painting = null;
      this._markGallery();
      $('painting-results').hidden = false;
      $('painting-found').hidden = true;
      $('painting-found-title').replaceChildren('Where ', el('cite', '', painting.title), ' hangs');
      $('painting-how').hidden = false;
      $('painting-how').textContent = 'Taking it down from the wall…';
      $('painting-found-title').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      let pixels;
      try {
        pixels = await gallery.pixels(painting, this.lib);
      } catch (e) {
        if (ticket === this._paintingTicket) $('painting-how').textContent = `It could not be taken down: ${e.message}.`;
        return;
      }
      if (ticket !== this._paintingTicket) return; // another painting was chosen meanwhile
      const place = this.lib.placeOfPainting(pixels);
      if (!place) { $('painting-how').textContent = "It is not a painting of this Library: run node paintings/hang.js again."; return; }
      this.painting = { entry: painting, pixels, place };
      drawPainting($('painting-preview'), pixels, this.lib);
      this._placePainting();
      this._markGallery();
    }

    _placePainting() {
      const p = this.painting;
      if (!p) return;
      $('painting-how').hidden = true;
      $('painting-found').hidden = false;
      $('painting-where').innerHTML = this._hangsHTML(p.place);
      $('painting-preview').setAttribute('aria-label', `${p.entry.title}, as the Library holds it`);
    }

    /** Reads a picture, then finds where it hangs as a painting. */
    async _uploadImage(input) {
      const file = input.files && input.files[0];
      input.value = ''; // so that choosing the same file again reads it again
      if (!file) return;
      const status = $('image-status');
      if (!/\.(gif|jpe?g|png)$/i.test(file.name) && !/^image\/(gif|jpeg|png)$/.test(file.type)) {
        status.textContent = 'Only GIF, JPEG, and PNG pictures can be read here.';
        return;
      }
      if (!this.lib.painting) {
        status.textContent = "With this Library's configuration, no painting can hang in only one hexagon, so its vestibules have none (see Paintings in README.md).";
        return;
      }
      status.textContent = `Reading ${file.name}…`;
      let picture;
      try {
        picture = await readPicture(file);
      } catch (e) {
        status.textContent = `The browser could not read ${file.name} as a picture.`;
        return;
      }
      this.image = { name: file.name, picture };
      this._hangImage();
    }

    /** Paints the picture in the Library's colours, cropped or fitted as chosen, and finds its vestibule. */
    _hangImage() {
      const im = this.image;
      if (!im) return;
      const fit = document.querySelector('input[name="image-fit"]:checked').value;
      const ticket = (this._imageTicket = (this._imageTicket || 0) + 1);
      $('image-status').textContent = `Painting ${im.name} in the Library's colours…`;
      setTimeout(() => { // let that be seen before the work begins
        if (ticket !== this._imageTicket || this.image !== im) return;
        const lib = this.lib, { width, height, rgba } = im.picture;
        im.pixels = lib.paintingOfImage(rgba, width, height, { fit });
        im.place = lib.placeOfPainting(im.pixels);
        const P = lib.painting, square = P.width === P.height;
        $('image-status').textContent = `${im.name}, ${fmt(width)} × ${fmt(height)} pixels, ` +
          (fit === 'fit' ? 'fitted whole on a mat of lead white' : square ? 'cropped to a square' : "cropped to the painting's proportions") +
          `, as a painting of ${fmt(P.width)} × ${fmt(P.height)} pixels in the Library's ${lib.N} colours.`;
        drawPainting($('image-preview'), im.pixels, lib);
        this._placeImage();
        $('image-results').hidden = false;
        $('image-title').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 30);
    }

    _placeImage() {
      if (this.image && this.image.place) $('image-where').innerHTML = this._hangsHTML(this.image.place);
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
      this.ctx.goToCell(p.ch + east, p.cf + up, null);
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
      if (a.seed && a.seed !== this.lib.seed) {
        err.textContent = `That address is in the Library of seed "${a.seed}", where every book stands somewhere else. This Library's seed is "${this.lib.seed}"; it can be changed in config.js.`;
        err.hidden = false;
        return;
      }
      this.ctx.goToAddress(a.hexagon, a.floor, null);
    }

    /** The first tab: where the reader is, from where they woke and from the seam, and the address. */
    _renderHere() {
      const w = this.ctx.world, p = this.ctx.player, lib = this.lib;
      const g = w.hexagon(p.ch).digits, f = w.floor(p.cf).digits;
      const n = (m, one, many) => `${amount(m)} ${m.exact === 1 ? one : many}`;
      $('here-whereabouts').textContent = p.whereabouts().sentence;
      const pos = lib.position(g, f);
      $('here-seam').innerHTML = `This hexagon lies ${n(pos.east, 'hexagon', 'hexagons')} east of the Western seam (${percent(pos.east.fraction)} of the way round)` +
        ` and ${n(pos.up, 'floor', 'floors')} above the Lower seam (${percent(pos.up.fraction)} of the way up).`;

      // the last jump through the catalogue, measured the shorter way round
      const j = this.ctx.lastJourney ? this.ctx.lastJourney() : null;
      const part = (d, one, many, pos, neg) => (d.sign === 0 ? '' : `${n(lib.magnitude(d.digits), one, many)} ${d.sign > 0 ? pos : neg}`);
      const parts = j ? [part(j.dh, 'hexagon', 'hexagons', 'east', 'west'), part(j.df, 'floor', 'floors', 'up', 'down')].filter(Boolean) : [];
      // a short hop is too small to show on the map, and has no shorter way round to speak of
      const far = parts.length && (Math.abs(j.from.east - pos.east.fraction) > 0.02 || Math.abs(j.from.up - pos.up.fraction) > 0.02);
      const huge = j && [j.dh, j.df].some((d) => d.sign !== 0 && lib.magnitude(d.digits).exact === null);
      $('here-journey').hidden = !parts.length;
      if (parts.length) {
        $('here-journey').innerHTML = ` Your last journey through the catalogue took you ${parts.join(' and ')}${huge ? ', the shorter way round' : ''}.` +
          (far ? ' The outlined hexagon on the map is where it began.' : '');
      }

      // the map of the whole Library seen from the side, drawn to its proportions (within reason)
      const d = this.ctx.dims;
      const log10Ratio = lib.stats.log10Floors - lib.stats.log10HexagonsPerFloor + Math.log10(d.Hf / d.Dx);
      this._aspect = 1 / Math.min(8, Math.max(1 / 8, Math.pow(10, log10Ratio))); // width ÷ height
      const place = (el, at) => { el.style.left = `${100 * at.east}%`; el.style.bottom = `${100 * at.up}%`; };
      place($('seam-here'), { east: pos.east.fraction, up: pos.up.fraction });
      $('seam-was').hidden = !far;
      if (far) place($('seam-was'), j.from);
      this._fitMap();
    }

    /** Makes the map as large as the catalogue's screen allows, keeping the Library's proportions. */
    _fitMap() {
      const panel = $('panel-here'), screen = $('terminal'), map = $('seam-map');
      if (panel.hidden || screen.hidden || !this._aspect) return;
      // the room the tab leaves the map's frame, less the names of the seams around the map
      const frame = $('seam-frame'), css = getComputedStyle(frame);
      const gapX = parseFloat(css.columnGap) || 0, gapY = parseFloat(css.rowGap) || 0;
      const across = frame.clientWidth - $('seam-west').offsetWidth - $('seam-east').offsetWidth - 2 * gapX;
      const room = frame.clientHeight - frame.querySelector('.seam-top').offsetHeight - frame.querySelector('.seam-bottom').offsetHeight - 2 * gapY;
      const least = 120; // pixels: on a screen too small, the map keeps this width and the tab scrolls
      const width = Math.max(least, Math.floor(Math.min(across, room * this._aspect)));
      map.style.width = `${width}px`;
      map.style.height = `${Math.round(width / this._aspect)}px`;
    }
  }

  Babel.Terminal = Terminal;
})();
