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
 *   ctx.openBookAt(options), ctx.goToCell(dh, df, face), ctx.goToAddress(hexagon, floor, face),
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
   * Remembers the books the reader showed the catalogue themselves (not those of the
   * collection), in this browser's own storage (IndexedDB). Where that is not allowed, it
   * remembers them until the page is closed.
   */
  const shelf = {
    db: undefined,
    memory: new Map(),
    _open() {
      if (this.db !== undefined) return Promise.resolve(this.db);
      return new Promise((resolve) => {
        const done = (db) => { this.db = db; resolve(db); };
        try {
          const req = indexedDB.open('babel', 2);
          req.onupgradeneeded = () => {
            const db = req.result;
            // the first store could hold a whole books folder, which the collection now replaces
            if (db.objectStoreNames.contains('books')) db.deleteObjectStore('books');
            if (!db.objectStoreNames.contains('own-books')) db.createObjectStore('own-books', { keyPath: 'name' });
          };
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
          const tx = db.transaction('own-books', mode);
          const req = fn(tx.objectStore('own-books'));
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
    _script(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => { s.remove(); resolve(); };
        s.onerror = () => { s.remove(); reject(new Error(`its file, ${src.replace(/\?.*$/, '')}, is missing`)); };
        document.head.appendChild(s);
      });
    },
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
      if (typeof DecompressionStream !== 'function') throw new Error('This browser is too old to open the books of the collection.');
      const bin = atob(packed), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const out = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
      return new TextDecoder('utf-8').decode(out);
    },
  };
  Babel.Collection = collection; // main.js follows links to the collection's books with it

  // each book's script calls this with its text
  window.BABEL_SHELF_BOOK = (id, packed) => {
    const resolve = collection._arrived.get(id);
    if (resolve) { collection._arrived.delete(id); resolve(packed); }
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

  const TABS = [['tab-here', 'panel-here'], ['tab-find', 'panel-find'], ['tab-books', 'panel-books'], ['tab-go', 'panel-go'], ['tab-about', 'panel-about']];

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
      if (tab === 'tab-books') this._openShelf();
      if (tab === 'tab-about') this._renderAbout();
      const active = { 'tab-here': $('panel-here'), 'tab-find': $('find-text'), 'tab-books': $('shelf-filter'), 'tab-go': $('go-east'), 'tab-about': $('panel-about') }[tab];
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
      $('certain-read').addEventListener('click', () => this._readCertain());
      $('certain-go').addEventListener('click', () => this._goCertain());
      $('certain-link').addEventListener('click', () => this._copyLink(this.certainLink));
      $('certain-secret').addEventListener('click', () => this._toggleSecret($('certain-secret-box'), () => this.query.raw));
      $('certain-copy').addEventListener('click', () => {
        const loc = this.certain.location;
        this.ctx.copyText(this.lib.hexagonAddressText(loc.hexagon, loc.floor), 'Copied the address of that hexagon.');
      });
      $('books-files').addEventListener('click', () => $('books-files-input').click());
      $('shelf-filter').addEventListener('input', () => this._filterShelf());
      $('shelf-order').addEventListener('change', () => this._renderShelf());
      $('books-files-input').addEventListener('change', () => this._addBooks($('books-files-input')));
      $('books-forget').addEventListener('click', () => this._forgetBooks());
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
      if (tab === 'tab-books') this._openShelf();
      if (tab === 'tab-about') this._renderAbout();
    }

    /** The About tab: the Markdown of js/about.js, read the first time the tab is shown. */
    _renderAbout() {
      if (this._aboutShown) return;
      this._aboutShown = true;
      const box = $('about-text');
      const source = typeof window.BABEL_ABOUT === 'function' ? String(window.BABEL_ABOUT) : '';
      const m = /\/\*[ \t]*START[^\n]*\n([\s\S]*?)\n?[ \t]*END[ \t]*\*\/\s*\}\s*$/.exec(source);
      if (!m || !window.BabelMarkdown) {
        box.textContent = source
          ? 'The text of js/about.js could not be found between its lines START and END.'
          : 'The file js/about.js, which holds the text of this tab, could not be read. Check that it is in the js folder, and that its text holds no star followed straight away by a slash.';
        return;
      }
      box.innerHTML = window.BabelMarkdown.render(m[1]);
      // headings take ids as on GitHub, so that links such as [Dreams](#dreams) lead to them
      const used = new Map();
      for (const h of box.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
        const base = h.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
        const n = used.get(base) || 0;
        used.set(base, n + 1);
        h.dataset.anchor = n ? `${base}-${n}` : base;
      }
      for (const a of box.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href');
        const book = href.search(/#(text|book)=/);
        if (book !== -1) {
          // A link to a text or to a book of the collection (#text=…, #book=…), however it is
          // written (#text=…, /#text=… or with the Library's full address), leads there in this
          // same Library, whether it was opened from the computer or on the web.
          const hash = href.slice(book);
          a.setAttribute('href', hash);
          a.addEventListener('click', (e) => {
            e.preventDefault();
            if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
            else location.hash = hash; // main.js follows the link when the address changes
          });
        } else if (href.startsWith('#')) {
          a.addEventListener('click', (e) => {
            e.preventDefault(); // the address bar keeps its own #… (it may be a link to a book)
            const target = [...box.querySelectorAll('[data-anchor]')].find((h) => h.dataset.anchor === decodeURIComponent(href.slice(1)));
            if (target) target.scrollIntoView({ block: 'start' });
          });
        } else {
          a.target = '_blank';
          a.rel = 'noopener';
        }
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
        if (p.recased) parts.push(`Letters are searched for as ${oneCase(lib)}.`);
        if (p.substitutions.length) parts.push(`Some characters are read as their nearest equivalents in the alphabet: ${equivalents(p.substitutions)}.`);
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

    _readCertain() {
      const r = this.certain;
      const h = this.certainLink, link = h && h.url ? h.url.slice(h.url.indexOf('#')) : null;
      this.ctx.openBookAt({ location: r.location, slot: r.location.slot, content: r.content, highlight: { start: 0, length: this.query.symbols.length }, returnTo: 'terminal', link });
    }

    _goCertain() {
      const r = this.certain, loc = r.location;
      const { wall, shelf, volume } = this.lib.slotParts(loc.slot);
      const length = this.query.symbols.length;
      const h = this.certainLink, link = h && h.url ? h.url.slice(h.url.indexOf('#')) : null;
      this.ctx.goToAddress(loc.hexagon, loc.floor, { wall, shelf, volume }, { slot: loc.slot, start: 0, length, link });
    }

    /* ---------------- finding a whole book ---------------- */

    async _addBooks(input) {
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
      input.value = ''; // so that choosing the same files again reads them again
      if (!books.length) {
        status.textContent = `The browser could not read ${unread.length ? unread.join(', ') : 'those files'}.`;
        return;
      }
      await shelf.put(books, false);
      this.books = await shelf.all();
      this.typeset.clear();
      this._renderBooks();
      const n = books.length;
      status.textContent = `${n === 1 ? 'One book' : `${fmt(n)} books`} added.` +
        (big.length ? ` Left out, being larger than 64 MB: ${big.map((f) => f.name).join(', ')}.` : '') +
        (unread.length ? ` The browser could not read ${unread.join(', ')}.` : '') +
        ' The catalogue will remember them in this browser.';
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
      const key = entry.key;
      let t = this.typeset.get(key);
      if (!t) {
        const clean = BabelCore.Library.cleanEbook(entry.text);
        const named = describeBook(entry.name);
        const meta = entry.meta || (named.author || !clean.title ? named : { title: clean.title, author: clean.author, year: named.year });
        // set as a link would set it, without a title page: the same text is the same book
        t = { meta, text: clean.text, set: this.lib.typeset(clean.text, {}), trimmed: clean.trimmed };
        this.typeset.set(key, t);
        // books of the collection can be long: keep only the last few of them set
        const kept = [...this.typeset.keys()].filter((k) => k.startsWith('shelf:'));
        for (const k of kept.slice(0, Math.max(0, kept.length - 6))) this.typeset.delete(k);
      }
      return t;
    }

    _pagesOf(part) { return Math.ceil(part.length / this.lib.config.charactersPerPage); }

    _renderBooks() {
      const list = $('books-list');
      list.textContent = '';
      $('books-forget').hidden = !this.books.length;
      for (const entry of this.books) {
        entry.key = 'own:' + entry.name + '|' + entry.lastModified + '|' + entry.size;
        const { meta, set } = this._set(entry);
        const li = el('li');
        li.dataset.key = entry.key;
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
      this._markCurrent();
    }

    _markCurrent() {
      for (const list of [$('books-list'), $('shelf-list')]) {
        for (const li of list.children) li.setAttribute('aria-current', String(!!this.book && li.dataset.key === this.book.entry.key));
      }
    }

    /* ---------------- the collection ---------------- */

    /** Shows the collection, loading its list the first time. */
    async _openShelf() {
      if (this._shelfShown) return;
      this._shelfShown = true;
      $('shelf-status').textContent = 'Opening the shelves…';
      const books = await collection.load();
      if (!books.length) {
        $('shelf-intro').textContent = 'This Library has no collection of books yet. To give it one, put plain-text files (.txt) in its books/uncompressed folder and run python3 books/shelve.py. Meanwhile, you can show the catalogue your own books below.';
        $('shelf-status').textContent = '';
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
        const button = el('button', '', 'Find it');
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
      $('shelf-status').textContent = words.length
        ? (shown ? `${fmt(shown)} of ${fmt(books.length)} books.` : 'No book of the collection matches.')
        : `${fmt(books.length)} books.`;
    }

    /** Takes a book of the collection down from its shelf, then finds it in the Library. */
    async findShelfBook(book) {
      const ticket = (this._ticket = (this._ticket || 0) + 1);
      $('book-results').hidden = false;
      $('book-found-title').replaceChildren('Where ', el('cite', '', book.title), ' stands');
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
      const lib = this.lib, c = lib.config, set = b.set, n = set.parts.length;
      b.found = set.parts.map((part) => lib.findText(part));

      $('book-found-title').replaceChildren('Where ', el('cite', '', b.meta.title), ' stands');
      const how = [`The catalogue sets the text as a book of this Library holds it, from the first page: ${fmt(c.charactersPerLine)} characters to a line and ${fmt(c.linesPerPage)} lines to a page, with words kept whole and paragraphs indented.`];
      if (n === 1) how.push(`It fills ${fmt(this._pagesOf(set.parts[0]))} of the book's ${fmt(c.pagesPerBook)} pages.`);
      else how.push(`It is too long for one book, so it is set in ${n} parts, one after the other.`);
      how.push('Then the catalogue runs the shelving backwards and finds the book that holds exactly those pages. Every possible book stands somewhere, exactly once.');
      if (b.trimmed) how.push("Project Gutenberg's licence, before and after the text, is left out.");
      if (set.recased) how.push(`Letters are set as ${oneCase(lib)}.`);
      if (set.substitutions.length) how.push(`Some characters are set as their nearest equivalents in the alphabet: ${equivalents(set.substitutions)}.`);
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
        const secret = el('button', '', 'Copy a secret link');
        for (const x of [read, go, copy, link, secret]) x.type = 'button';
        // a link to a book of the collection names it; a link to another book carries the
        // pages of this part as set, which its book holds from the start of its first page
        // (the blank at their end, which the rest of the book is anyway, left out)
        const bookHash = b.entry.shelf ? BabelCore.Library.bookLink(b.entry.shelf, k + 1) : null;
        const pages = () => lib.toText(set.parts[k]).replace(/ +$/, '');
        const holder = bookHash ? this._shortLink(bookHash) : this._link(pages());
        link.addEventListener('click', () => this._copyLink(holder));
        const secretBox = el('div');
        secret.addEventListener('click', () => this._toggleSecret(secretBox, pages));
        const linkOf = () => bookHash || (holder && holder.url ? holder.url.slice(holder.url.indexOf('#')) : null);
        read.addEventListener('click', () => this.ctx.openBookAt({ location: r.location, slot: r.location.slot, content: r.content, returnTo: 'terminal', link: linkOf() }));
        go.addEventListener('click', () => {
          const loc = r.location, face = this.lib.slotParts(loc.slot);
          const title = n > 1 ? `${b.meta.title}, part ${k + 1} of ${n}` : b.meta.title;
          this.ctx.goToAddress(loc.hexagon, loc.floor, face, { slot: loc.slot, start: 0, length: 0, title, link: linkOf() });
        });
        copy.addEventListener('click', () => {
          const loc = r.location, { wall, shelf, volume } = this.lib.slotParts(loc.slot);
          this.ctx.copyText(this.lib.hexagonAddressText(loc.hexagon, loc.floor), `Copied the address of its hexagon. The book is on wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}.`);
        });
        row.append(read, go, copy, link);
        // the books of the collection are public: a secret link is for books of one's own
        if (!bookHash) row.append(secret);
        li.append(p, row, secretBox);
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
      const glass = panel.closest('.glass'), css = getComputedStyle(screen), west = $('seam-west'), east = $('seam-east');
      // the width of the panel, less the names of the western and eastern seams beside the map
      const gap = parseFloat(getComputedStyle($('seam-frame')).columnGap) || 0;
      const across = panel.clientWidth - west.offsetWidth - east.offsetWidth - 2 * gap;
      // the height of the screen, less everything else on the glass (measured without the map
      // and the names beside it, which are as tall as their words)
      map.style.width = map.style.height = '0px';
      west.style.display = east.style.display = 'none';
      const room = screen.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - glass.scrollHeight;
      west.style.display = east.style.display = '';
      const least = 120; // pixels: on a screen too small, the map keeps this width and the glass scrolls
      const width = Math.max(least, Math.floor(Math.min(across, room * this._aspect)));
      map.style.width = `${width}px`;
      map.style.height = `${Math.round(width / this._aspect)}px`;
    }
  }

  Babel.Terminal = Terminal;
})();
