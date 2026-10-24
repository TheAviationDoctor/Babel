/*
 * The catalogue's screen: where the reader is, finding where a text or a whole book
 * stands, and going to any hexagon.
 *
 * A text is found by running the shelving backwards: the catalogue composes the book
 * that begins with the text, and the inverse permutation gives the shelf it stands on.
 * A whole book (a .txt file the reader shows it) is first set in pages, the way a book of
 * this Library holds them; then it is found the same way, and is the very book a link
 * carrying that text leads to (see "Links to books" in library.js).
 *
 * It talks to the rest of the game through a small context object (see main.js):
 *   ctx.lib(), ctx.world, ctx.player, ctx.dims, ctx.setMode(mode), ctx.startWalking(),
 *   ctx.openBookAt(options), ctx.goToCell(dg, df, face), ctx.goToAddress(gallery, floor, face),
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

  /* ---------------- the reader's own books ---------------- */

  /**
   * Remembers the books the reader showed the catalogue, in this browser's own storage
   * (IndexedDB). Where that is not allowed, it remembers them until the page is closed.
   */
  const shelf = {
    db: undefined,
    memory: new Map(),
    _open() {
      if (this.db !== undefined) return Promise.resolve(this.db);
      return new Promise((resolve) => {
        const done = (db) => { this.db = db; resolve(db); };
        try {
          const req = indexedDB.open('babel', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('books', { keyPath: 'name' });
          req.onsuccess = () => done(req.result);
          req.onerror = req.onblocked = () => done(null);
        } catch (e) { done(null); }
      });
    },
    async _do(mode, fn) {
      const db = await this._open();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('books', mode);
          const req = fn(tx.objectStore('books'));
          tx.oncomplete = () => resolve(req ? req.result : true);
          tx.onerror = tx.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    },
    async all() {
      const stored = await this._do('readonly', (s) => s.getAll());
      if (Array.isArray(stored)) for (const b of stored) if (!this.memory.has(b.name)) this.memory.set(b.name, b);
      return [...this.memory.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    },
    async put(books, replace) {
      if (replace) this.memory.clear();
      for (const b of books) this.memory.set(b.name, b);
      await this._do('readwrite', (s) => { if (replace) s.clear(); for (const b of books) s.put(b); });
    },
    async clear() {
      this.memory.clear();
      await this._do('readwrite', (s) => { s.clear(); });
    },
  };

  /** Reads a text file as UTF-8, or as Windows-1252 if it is clearly not UTF-8. */
  async function readBookFile(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\uFFFD')) {
      try { text = new TextDecoder('windows-1252').decode(buf); } catch (e) { /* keep UTF-8 */ }
    }
    return { name: file.name, text, size: file.size, lastModified: file.lastModified };
  }

  /** Title, author and year from a file name such as "Author — Title (1941).txt". */
  function describeBook(name) {
    let title = name.replace(/\.txt$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    let author = '', year = '';
    const y = /^(.*?)\s*\((\d{1,4})\)$/.exec(title);
    if (y && y[1]) { title = y[1]; year = y[2]; }
    const a = /^(.+?)\s+[\u2014\u2013-]\s+(.+)$/.exec(title);
    if (a) { author = a[1]; title = a[2]; }
    return { title, author, year };
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
    const upper = letters.filter((c) => /\p{Lu}/u.test(c)), lower = letters.filter((c) => /\p{Ll}/u.test(c));
    const rest = plain.filter((c) => !letters.includes(c) && !digits.includes(c) && c !== ' ');
    const words = [];
    if (upper.length === 26 && lower.length === 26 && letters.length === 52) words.push('the 26 letters, in capitals and in small letters');
    else if (letters.length) words.push(letters.length === 26 ? 'the 26 letters' : `${letters.length} letters`);
    if (digits.length) words.push(digits.length === 10 ? 'the ten digits' : `the digits ${digits.join(' ')}`);
    if (rest.length) words.push(rest.join(' '));
    if (a.includes(' ')) words.push('space');
    if (controls.length) {
      const list = controls.length > 3 ? `${controls[0]} ${controls[1]} … ${controls[controls.length - 1]}` : controls.join(' ');
      words.push(`${controls.length === 1 ? 'one control character' : `${controls.length} control characters`}, which books show as ${list}`);
    }
    return words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words.join('');
  }

  const TABS = [['tab-here', 'panel-here'], ['tab-find', 'panel-find'], ['tab-books', 'panel-books'], ['tab-go', 'panel-go']];

  class Terminal {
    constructor(ctx) {
      this.ctx = ctx;
      this.query = null; // { symbols, text }
      this.certain = null; // { location, content }
      this.books = []; // { name, text, size, lastModified }
      this.typeset = new Map(); // name → the book set in pages
      this.book = null; // { entry, meta, set, found: [{ location, content }] }
      this._bind();
      shelf.all().then((books) => { this.books = books; this._renderBooks(); });
    }

    get lib() { return this.ctx.lib(); }

    open() {
      this.ctx.setMode('terminal');
      this._renderHere();
      this._note();
      // the reader may have walked since: distances are measured again from here
      if (this.query) this._certain();
      if (this.book) this._placeBook();
      const tab = TABS.find(([t]) => $(t).getAttribute('aria-selected') === 'true')[0];
      const active = { 'tab-here': $('panel-here'), 'tab-find': $('find-text'), 'tab-books': $('books-folder'), 'tab-go': $('go-east') }[tab];
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
    }

    /* ---------------- wiring ---------------- */

    _bind() {
      $('terminal-close').addEventListener('click', () => this.close());
      for (const [tab, panel] of TABS) $(tab).addEventListener('click', () => this._tab(tab, panel));
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
      const folder = $('books-folder-input');
      if (!('webkitdirectory' in folder) || /iPhone|iPad|Android/.test(navigator.userAgent || '')) $('books-folder').hidden = true;
      $('books-folder').addEventListener('click', () => folder.click());
      $('books-files').addEventListener('click', () => $('books-files-input').click());
      folder.addEventListener('change', () => this._addBooks(folder, true));
      $('books-files-input').addEventListener('change', () => this._addBooks($('books-files-input'), false));
      $('books-forget').addEventListener('click', () => this._forgetBooks());
      for (const r of document.querySelectorAll('input[name="book-fill"]')) r.addEventListener('change', () => this._placeBook());
      $('go-offset').addEventListener('submit', (e) => { e.preventDefault(); this._goOffset(); });
      $('go-address').addEventListener('submit', (e) => { e.preventDefault(); this._goAddress(); });
      $('go-random').addEventListener('click', () => this.ctx.goToRandom());
      $('term-copy').addEventListener('click', () => {
        const w = this.ctx.world, p = this.ctx.player;
        this.ctx.copyText(this.lib.hexagonAddressText(w.gallery(p.cg).digits, w.floor(p.cf).digits), 'Copied the address of this hexagon.');
      });
    }

    _tab(tab, panel) {
      for (const [t, p] of TABS) {
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
      if (!raw) parts.push(`Up to ${fmt(lib.M)} characters, in the Library's alphabet: ${alphabetWords(lib)}.`);
      else {
        parts.push(`${fmt(p.symbols.length)} ${p.symbols.length === 1 ? 'character' : 'characters'}.`);
        if (p.recased) parts.push('Letters are searched for as capitals.');
        if (p.substituted) parts.push('Some characters are read as their nearest equivalents in the alphabet, such as straight quotation marks for curly ones.');
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
      this.query = Object.assign({ raw: $('find-text').value }, p);
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
      $('certain-where').innerHTML = this._whereHTML(r.location, 'from the first page');
    }

    /* ---------------- links ---------------- */

    /**
     * A link that leads anyone to this book: it carries the text, compressed, and the
     * Library finds the book again from it. Made ahead of the click, so that copying
     * happens within the click itself, as some browsers require.
     */
    _link(text) {
      const base = this.ctx.linkBase();
      if (!base) return null;
      const p = BabelCore.Library.makeLink(base, text).catch(() => null);
      const holder = { url: null, promise: p };
      p.then((url) => { holder.url = url; });
      return holder;
    }

    async _copyLink(holder) {
      if (!holder || !holder.promise) {
        this.ctx.toast('To copy links from a copy of the Library on this computer, set "website" in config.js to the address where the Library is published.');
        return;
      }
      const url = holder.url || (await holder.promise);
      if (!url) { this.ctx.toast('The link could not be made.'); return; }
      const long = url.length > 60000 ? ` It is ${fmt(url.length)} characters long, which is more than some browsers and websites accept.` : '';
      this.ctx.copyText(url, `Copied a link to this book. Whoever opens it is set down before the book.${long}`);
    }

    /** "Wall 2, shelf 3, volume 17, …, about 10^… hexagons east from here. Its floor is …" (HTML). */
    _whereHTML(loc, from) {
      const lib = this.lib, world = this.ctx.world, player = this.ctx.player;
      const { wall, shelf, volume } = lib.slotParts(loc.slot);
      const dg = lib.galleryDifference(world.gallery(player.cg).digits, loc.gallery);
      const df = lib.floorDifference(world.floor(player.cf).digits, loc.floor);
      const parts = [stretch(lib, dg, 'hexagon', 'hexagons', 'east', 'west'), stretch(lib, df, 'floor', 'floors', 'up', 'down')].filter(Boolean);
      const far = parts.length ? `${parts.join(' and ')} from here` : 'in this very hexagon';
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<strong>Wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}${from ? ', ' + from : ''}</strong>, ${far}. ` +
        `Its floor is <span class="addr">${esc(lib.addressText(loc.floor, 16))}</span> and its gallery <span class="addr">${esc(lib.addressText(loc.gallery, 16))}</span>.`;
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

    /* ---------------- finding a whole book ---------------- */

    async _addBooks(input, replace) {
      const status = $('books-status');
      const all = [...input.files];
      const files = all.filter((f) => /\.txt$/i.test(f.name) && !f.name.startsWith('.'));
      if (!files.length) {
        input.value = '';
        status.textContent = all.length ? 'There are no .txt files there. Books must be plain-text files ending in .txt.' : 'Nothing was chosen.';
        return;
      }
      status.textContent = 'Reading…';
      const big = files.filter((f) => f.size > 64 * 1024 * 1024), unread = [];
      const books = [];
      for (const f of files) {
        if (big.includes(f)) continue;
        try { books.push(await readBookFile(f)); } catch (e) { unread.push(f.name); }
      }
      input.value = ''; // so that choosing the same folder again reads it again
      if (!books.length) {
        status.textContent = `The browser could not read ${unread.length ? unread.join(', ') : 'those files'}.`;
        return;
      }
      await shelf.put(books, replace);
      this.books = await shelf.all();
      this.typeset.clear();
      this._renderBooks();
      const n = books.length;
      status.textContent = `${n === 1 ? 'One book' : `${fmt(n)} books`} ${replace ? 'in the folder' : 'added'}.` +
        (big.length ? ` Left out, being larger than 64 MB: ${big.map((f) => f.name).join(', ')}.` : '') +
        (unread.length ? ` The browser could not read ${unread.join(', ')}.` : '') +
        ' The catalogue will remember them in this browser. To add or change books, open the folder again.';
    }

    async _forgetBooks() {
      await shelf.clear();
      this.books = [];
      this.typeset.clear();
      this.book = null;
      $('book-results').hidden = true;
      this._renderBooks();
      $('books-status').textContent = 'The catalogue has forgotten your books. The files themselves are untouched.';
    }

    /**
     * The book set in pages, as the Library would hold it (kept, since it does not depend
     * on the seed). Project Gutenberg's licence is left out; the title and author come from
     * the file name, or else from the e-book's own header.
     */
    _set(entry) {
      const key = entry.name + '|' + entry.lastModified + '|' + entry.size;
      let t = this.typeset.get(key);
      if (!t) {
        const clean = BabelCore.Library.cleanEbook(entry.text);
        const named = describeBook(entry.name);
        const meta = named.author || !clean.title ? named : { title: clean.title, author: clean.author, year: named.year };
        // set as a link would set it, without a title page: the same text is the same book
        t = { meta, text: clean.text, set: this.lib.typeset(clean.text, {}), trimmed: clean.trimmed };
        this.typeset.set(key, t);
      }
      return t;
    }

    _pagesOf(part) { return Math.ceil(part.length / this.lib.config.charactersPerPage); }

    _renderBooks() {
      const list = $('books-list');
      list.textContent = '';
      $('books-forget').hidden = !this.books.length;
      for (const entry of this.books) {
        const { meta, set } = this._set(entry);
        const li = el('li');
        li.dataset.name = entry.name;
        const info = el('div');
        info.appendChild(el('cite', '', meta.title));
        const by = [meta.author, meta.year].filter(Boolean).join(', ');
        if (by) info.appendChild(el('span', 'by', by));
        const n = set.parts.length;
        info.appendChild(el('span', 'note', n === 1
          ? `${fmt(set.characters)} characters, ${fmt(this._pagesOf(set.parts[0]))} pages`
          : `${fmt(set.characters)} characters: longer than one book of the Library, so set in ${n} parts`));
        const button = el('button', '', 'Find it');
        button.type = 'button';
        button.addEventListener('click', () => this.findBook(entry));
        li.append(info, button);
        list.appendChild(li);
      }
      if (!this.books.length && !$('books-status').textContent) $('books-status').textContent = 'No books yet.';
      else if (this.books.length && $('books-status').textContent === 'No books yet.') $('books-status').textContent = '';
      this._markCurrent();
    }

    _markCurrent() {
      for (const li of $('books-list').children) li.setAttribute('aria-current', String(!!this.book && li.dataset.name === this.book.entry.name));
    }

    findBook(entry) {
      const { meta, text, set, trimmed } = this._set(entry);
      this.book = { entry, meta, text, set, trimmed, found: null };
      this._placeBook();
      this._markCurrent();
      $('book-results').hidden = false;
      $('book-found-title').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /** Runs the shelving backwards for every part of the book, with blank or random pages after it. */
    _placeBook() {
      const b = this.book;
      if (!b) return;
      const lib = this.lib, c = lib.config, set = b.set, n = set.parts.length;
      const fill = document.querySelector('input[name="book-fill"]:checked').value;
      b.found = set.parts.map((part) => lib.findText(part, { fill }));

      $('book-found-title').replaceChildren('Where ', el('cite', '', b.meta.title), ' stands');
      const how = [`The catalogue sets the text as a book of this Library holds it, from the first page: ${fmt(c.charactersPerLine)} characters to a line and ${fmt(c.linesPerPage)} lines to a page, with words kept whole and paragraphs indented.`];
      if (n === 1) how.push(`It fills ${fmt(this._pagesOf(set.parts[0]))} of the book's ${fmt(c.pagesPerBook)} pages.`);
      else how.push(`It is too long for one book, so it is set in ${n} parts, one after the other.`);
      how.push('Then the catalogue runs the shelving backwards and finds the book that holds exactly those pages. Every possible book stands somewhere, exactly once.');
      if (b.trimmed) how.push("Project Gutenberg's licence, before and after the text, is left out.");
      if (set.recased) how.push('Letters are set as capitals.');
      if (set.substituted) how.push('Some characters are set as their nearest equivalents in the alphabet: -- as —, Æ as AE, ½ as 1/2, curly quotation marks as straight ones, and so on.');
      if (set.dropped.length) {
        const shown = set.dropped.slice(0, 12).map((ch) => (ch === '\t' ? 'tab' : `“${ch}”`)).join(' ');
        how.push(`Not in the alphabet, so left out: ${shown}${set.dropped.length > 12 ? ' and others' : ''}.`);
      }
      $('book-how').textContent = how.join(' ');

      const ol = $('book-parts');
      ol.textContent = '';
      b.found.forEach((r, k) => {
        const li = el('li');
        const p = el('p', 'where');
        p.innerHTML = (n > 1 ? `Part ${k + 1} of ${n}: ` : '') + this._whereHTML(r.location, 'from the first page');
        const row = el('div', 'row');
        const read = el('button', '', 'Read it here');
        const go = el('button', 'primary', 'Go there');
        const copy = el('button', '', 'Copy its address');
        const link = el('button', '', 'Copy a link to it');
        for (const x of [read, go, copy, link]) x.type = 'button';
        // a link carries the text and leads to its book with blank pages after it: the first part, then
        const linkable = k === 0 && fill !== 'random';
        const holder = linkable ? this._link(b.text) : null;
        link.addEventListener('click', () => this._copyLink(holder));
        read.addEventListener('click', () => this.ctx.openBookAt({ location: r.location, slot: r.location.slot, content: r.content, returnTo: 'terminal' }));
        go.addEventListener('click', () => {
          const loc = r.location, face = this.lib.slotParts(loc.slot);
          const title = n > 1 ? `${b.meta.title}, part ${k + 1} of ${n}` : b.meta.title;
          this.ctx.goToAddress(loc.gallery, loc.floor, face, { slot: loc.slot, start: 0, length: 0, title });
        });
        copy.addEventListener('click', () => {
          const loc = r.location, { wall, shelf, volume } = this.lib.slotParts(loc.slot);
          this.ctx.copyText(this.lib.hexagonAddressText(loc.gallery, loc.floor), `Copied the address of its hexagon. The book is on wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}.`);
        });
        row.append(read, go, copy);
        if (linkable) row.append(link);
        li.append(p, row);
        ol.appendChild(li);
      });
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
      if (a.seed && a.seed !== this.lib.seed) {
        err.textContent = `That address is in the Library of seed "${a.seed}", where every book stands somewhere else. This Library's seed is "${this.lib.seed}"; it can be changed in config.js.`;
        err.hidden = false;
        return;
      }
      this.ctx.goToAddress(a.gallery, a.floor, null);
    }

    /** The first tab: where the reader is, from where they woke and from the seam, and the address. */
    _renderHere() {
      const w = this.ctx.world, p = this.ctx.player, lib = this.lib;
      const g = w.gallery(p.cg).digits, f = w.floor(p.cf).digits;
      const n = (m, one, many) => `${amount(m)} ${m.exact === 1 ? one : many}`;
      $('here-whereabouts').textContent = p.whereabouts().sentence;
      const pos = lib.position(g, f);
      $('here-seam').innerHTML = `This hexagon lies ${n(pos.east, 'hexagon', 'hexagons')} east of the seam (${percent(pos.east.fraction)} of the way round)` +
        ` and ${n(pos.up, 'floor', 'floors')} above it (${percent(pos.up.fraction)} of the way up).`;

      // the last jump through the catalogue, measured the shorter way round
      const j = this.ctx.lastJourney ? this.ctx.lastJourney() : null;
      const part = (d, one, many, pos, neg) => (d.sign === 0 ? '' : `${n(lib.magnitude(d.digits), one, many)} ${d.sign > 0 ? pos : neg}`);
      const parts = j ? [part(j.dg, 'hexagon', 'hexagons', 'east', 'west'), part(j.df, 'floor', 'floors', 'up', 'down')].filter(Boolean) : [];
      // a short hop is too small to show on the map, and has no shorter way round to speak of
      const far = parts.length && (Math.abs(j.from.east - pos.east.fraction) > 0.02 || Math.abs(j.from.up - pos.up.fraction) > 0.02);
      const huge = j && [j.dg, j.df].some((d) => d.sign !== 0 && lib.magnitude(d.digits).exact === null);
      $('here-journey').hidden = !parts.length;
      if (parts.length) {
        $('here-journey').innerHTML = `Your last journey through the catalogue took you ${parts.join(' and ')}${huge ? ', the shorter way round' : ''}.` +
          (far ? ' The ring on the map is where it began.' : '');
      }

      // the map of the whole Library, drawn to its proportions (within reason)
      const d = this.ctx.dims;
      const log10Ratio = lib.stats.log10Floors - lib.stats.log10GalleriesPerFloor + Math.log10(d.Hf / d.Dx);
      const ratio = Math.min(3, Math.max(1 / 3, Math.pow(10, log10Ratio))); // height ÷ width
      const map = $('seam-map');
      map.style.width = `${ratio >= 1 ? 9 / ratio : 9}rem`;
      map.style.height = `${ratio >= 1 ? 9 : 9 * ratio}rem`;
      const place = (el, at) => { el.style.left = `${100 * at.east}%`; el.style.bottom = `${100 * at.up}%`; };
      place($('seam-here'), { east: pos.east.fraction, up: pos.up.fraction });
      $('seam-was').hidden = !far;
      if (far) place($('seam-was'), j.from);

      $('term-seed').textContent = lib.seed;
      $('term-floor').textContent = lib.addressText(f, 28);
      $('term-gallery').textContent = lib.addressText(g, 28);
      $('term-lengths').textContent = `The full address is ${fmt(f.length)} symbols for the floor and ${fmt(g.length)} for the gallery. ` +
        'Copy it to come back here later from "Go to a hexagon", even after closing the page.';
    }
  }

  Babel.Terminal = Terminal;
})();
