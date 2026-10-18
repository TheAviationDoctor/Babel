/*
 * THE LIBRARY OF BABEL — mathematical core
 * ----------------------------------------
 * This file contains no graphics. It defines the Library as a pure
 * mathematical object:
 *
 *   • A book is a sequence of M = pages × lines × characters symbols drawn
 *     from an alphabet of N symbols. There are exactly N^M possible books.
 *
 *   • Every possible book stands on exactly one shelf. A shelf position is
 *     written as an "index" v in [0, N^M), itself stored as M base-N digits
 *     (least significant digit first). The index decomposes as
 *
 *         v = hexagon × S + slot          (S = books per hexagon)
 *         hexagon = floor × L + gallery   (L = N^m galleries per floor)
 *
 *     so every hexagon has an exact address: a floor number and a gallery
 *     number, each about M/2 symbols long.
 *
 *   • The contents of the book at index v are obtained by a seed-keyed
 *     permutation of the M-symbol space: an unbalanced Feistel network
 *     whose rounds add (mod N) a pseudorandom keystream derived from the
 *     other half. Feistel networks are invertible whatever their round
 *     functions are, so the map index ↔ contents is a bijection: no two
 *     shelves hold the same book and no possible book is missing.
 *
 *   • Because the permutation is invertible, any text can be located: build
 *     a book containing it and run the network backwards (see findText).
 *
 * All arithmetic on the huge numbers is done digit by digit with small
 * multipliers and divisors, so it costs O(M) and never needs big-integer
 * multiplication. Everything is deterministic across browsers and Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BabelCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FEISTEL_ROUNDS = 4;
  const MAX_BOOK_SYMBOLS = 1 << 24; // safety limit (16.7 million symbols per book)

  /* ------------------------------------------------------------------ *
   * Configuration
   * ------------------------------------------------------------------ */

  const DEFAULT_CONFIG = {
    seed: 'borges',
    book: { pagesPerBook: 512, linesPerPage: 32, charactersPerLine: 64 },
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789' + ':,!.?' + ';-()\'"' + ' ',
    hexagon: { wallsWithShelves: 4, shelvesPerWall: 4, booksPerShelf: 32 },
  };

  /*
   * The settings config.js may contain. A misspelt name is reported rather than
   * silently ignored. Names are matched without regard to case or punctuation.
   */
  const SETTINGS = {
    '': { seed: 'seed', book: 'book', alphabet: 'alphabet', hexagon: 'hexagon' },
    book: { pagesPerBook: 'pagesPerBook', linesPerPage: 'linesPerPage', charactersPerLine: 'charactersPerLine' },
    hexagon: { wallsWithShelves: 'wallsWithShelves', shelvesPerWall: 'shelvesPerWall', booksPerShelf: 'booksPerShelf' },
  };
  const looseKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

  /** Maps the keys of one section of a configuration onto their canonical names. */
  function readSection(obj, section) {
    const names = SETTINGS[section];
    const where = section ? `under "${section}"` : 'at the top of the configuration';
    if (obj === undefined || obj === null) return {};
    if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`"${section}" should be a group of settings in braces, like { ${Object.keys(names).map((n) => n + ': …').join(', ')} }.`);
    const byLoose = {};
    for (const canonical of Object.keys(names)) byLoose[looseKey(canonical)] = canonical;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const canonical = byLoose[looseKey(k)];
      if (!canonical) {
        const list = Object.values(names).map((n) => `"${n}"`).join(', ');
        throw new Error(`"${k}" is not a setting ${where}. The settings there are ${list}.`);
      }
      out[canonical] = v;
    }
    return out;
  }

  function positiveInt(value, name, max) {
    const n = Number(value);
    if (value === null || value === '' || typeof value === 'boolean' || !Number.isInteger(n) || n < 1) {
      throw new Error(`${name} must be a whole number of at least 1 (it is ${JSON.stringify(value)}).`);
    }
    if (max !== undefined && n > max) throw new Error(`${name} must be at most ${max} (it is ${n}).`);
    return n;
  }

  /** Validates a raw configuration object and returns a normalised copy with derived values. */
  function normalizeConfig(rawInput) {
    const raw = readSection(rawInput || {}, '');
    const book = Object.assign({}, DEFAULT_CONFIG.book, readSection(raw.book, 'book'));
    const hex = Object.assign({}, DEFAULT_CONFIG.hexagon, readSection(raw.hexagon, 'hexagon'));
    const label = (section, key) => `"${SETTINGS[section][key]}" ${section ? `(under "${section}")` : ''}`.trim();
    const alphabetSource = raw.alphabet !== undefined && raw.alphabet !== null ? raw.alphabet : DEFAULT_CONFIG.alphabet;
    const alphabet = Array.isArray(alphabetSource) ? alphabetSource.map(String) : Array.from(String(alphabetSource));
    if (alphabet.some((c) => Array.from(c).length !== 1)) throw new Error('Every alphabet entry must be exactly one character.');
    if (new Set(alphabet).size !== alphabet.length) {
      const dup = alphabet.find((c, i) => alphabet.indexOf(c) !== i);
      throw new Error(`The alphabet lists the character ${JSON.stringify(dup)} more than once.`);
    }
    if (alphabet.length < 2) throw new Error('The alphabet needs at least 2 characters.');
    if (alphabet.length > 256) throw new Error('The alphabet may have at most 256 characters.');

    const cfg = {
      seed: String(raw.seed !== undefined && raw.seed !== null ? raw.seed : DEFAULT_CONFIG.seed),
      pagesPerBook: positiveInt(book.pagesPerBook, label('book', 'pagesPerBook')),
      linesPerPage: positiveInt(book.linesPerPage, label('book', 'linesPerPage')),
      charactersPerLine: positiveInt(book.charactersPerLine, label('book', 'charactersPerLine')),
      alphabet,
      wallsWithShelves: positiveInt(hex.wallsWithShelves, label('hexagon', 'wallsWithShelves'), 4),
      shelvesPerWall: positiveInt(hex.shelvesPerWall, label('hexagon', 'shelvesPerWall'), 64),
      booksPerShelf: positiveInt(hex.booksPerShelf, label('hexagon', 'booksPerShelf'), 256),
    };
    cfg.charactersPerPage = cfg.linesPerPage * cfg.charactersPerLine;
    cfg.symbolsPerBook = cfg.pagesPerBook * cfg.charactersPerPage;
    if (cfg.symbolsPerBook < 2) throw new Error('A book must contain at least 2 characters.');
    if (cfg.symbolsPerBook > MAX_BOOK_SYMBOLS) throw new Error(`A book may contain at most ${MAX_BOOK_SYMBOLS.toLocaleString('en')} characters (pages × lines × characters = ${cfg.symbolsPerBook.toLocaleString('en')}).`);
    cfg.booksPerWall = cfg.shelvesPerWall * cfg.booksPerShelf;
    cfg.booksPerHexagon = cfg.wallsWithShelves * cfg.booksPerWall;
    if (cfg.booksPerHexagon > 65536) throw new Error('A hexagon may hold at most 65,536 books.');
    return cfg;
  }

  /** Typographic characters and the plain ones that stand for them. */
  const TYPOGRAPHY = {
    '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"', '\u00AB': '"', '\u00BB': '"', '\u2033': '"',
    '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'", '\u2032': "'", '`': "'",
    '\u2014': '-', '\u2013': '-', '\u2012': '-', '\u2015': '-', '\u2212': '-', '\u2010': '-', '\u2011': '-',
    '\u2026': '...', '\u00A0': ' ', '\u2009': ' ', '\u202F': ' ', '\u2007': ' ',
  };

  /* ------------------------------------------------------------------ *
   * Hashing and pseudorandom streams (32-bit integer arithmetic only)
   * ------------------------------------------------------------------ */

  /** 128-bit string hash (cyrb128). Returns four unsigned 32-bit words. */
  function hashString(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }

  function fmix32(h) {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** Two-lane 64-bit hash of a byte array (MurmurHash3-style mixing). */
  function hashBytes(a, seed1, seed2) {
    let h1 = seed1 | 0, h2 = seed2 | 0;
    const n = a.length, n4 = n - (n & 3);
    let k, k1, k2;
    for (let i = 0; i < n4; i += 4) {
      k = a[i] | (a[i + 1] << 8) | (a[i + 2] << 16) | (a[i + 3] << 24);
      k1 = Math.imul(k, 0xcc9e2d51); k1 = (k1 << 15) | (k1 >>> 17); k1 = Math.imul(k1, 0x1b873593);
      h1 ^= k1; h1 = (h1 << 13) | (h1 >>> 19); h1 = (Math.imul(h1, 5) + 0xe6546b64) | 0;
      k2 = Math.imul(k, 0x85ebca6b); k2 = (k2 << 17) | (k2 >>> 15); k2 = Math.imul(k2, 0xc2b2ae35);
      h2 ^= k2; h2 = (h2 << 11) | (h2 >>> 21); h2 = (Math.imul(h2, 9) + 0x7f4a7c15) | 0;
    }
    k = 0;
    for (let i = n4; i < n; i++) k |= a[i] << (8 * (i - n4));
    k1 = Math.imul(k, 0xcc9e2d51); k1 = (k1 << 15) | (k1 >>> 17); k1 = Math.imul(k1, 0x1b873593); h1 ^= k1;
    k2 = Math.imul(k, 0x85ebca6b); k2 = (k2 << 17) | (k2 >>> 15); k2 = Math.imul(k2, 0xc2b2ae35); h2 ^= k2;
    h1 ^= n; h2 ^= n;
    h1 = fmix32(h1); h2 = fmix32(h2);
    h1 = (h1 + h2) | 0; h2 = (h2 + h1) | 0;
    return [h1 >>> 0, h2 >>> 0];
  }

  /** Small fast counter PRNG (sfc32). Returns a function yielding unsigned 32-bit integers. */
  function sfc32(a, b, c, d) {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const next = function () {
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return t >>> 0;
    };
    for (let i = 0; i < 15; i++) next();
    return next;
  }

  /** Uniform float in [0, 1) from a sfc32 generator. */
  function unit(rng) { return rng() / 4294967296; }

  /* ------------------------------------------------------------------ *
   * Digit-array arithmetic (base N, least significant digit first)
   * ------------------------------------------------------------------ */

  /** digits := digits × mul + add, in place. Returns the carry that overflowed the array. */
  function mulSmallAdd(digits, mul, add, base) {
    let carry = add;
    // with small multipliers everything stays within 32-bit integers, which is fast
    const small = mul * base < 0x40000000 && add < 0x40000000;
    for (let i = 0; i < digits.length; i++) {
      const x = digits[i] * mul + carry;
      carry = small ? (x / base) | 0 : Math.floor(x / base);
      digits[i] = x - carry * base;
    }
    return carry;
  }

  /** digits := floor(digits / div), in place. Returns the remainder. */
  function divSmall(digits, div, base) {
    let rem = 0;
    const small = div * base < 0x40000000;
    for (let i = digits.length - 1; i >= 0; i--) {
      const x = rem * base + digits[i];
      const q = small ? (x / div) | 0 : Math.floor(x / div);
      digits[i] = q;
      rem = x - q * div;
    }
    return rem;
  }

  /** digits := digits + delta (delta a signed safe integer), in place, modulo base^length.
   *  Returns the signed overflow (how many times the value wrapped). */
  function addSmall(digits, delta, base) {
    let carry = delta;
    for (let i = 0; i < digits.length && carry !== 0; i++) {
      const x = digits[i] + carry;
      carry = Math.floor(x / base);
      digits[i] = x - carry * base;
    }
    return carry;
  }

  /** Compares two equal-length digit arrays. Returns -1, 0 or 1. */
  function compareDigits(a, b) {
    for (let i = a.length - 1; i >= 0; i--) {
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
  }

  /** a := a - b (equal lengths, a ≥ b), in place. */
  function subDigits(a, b, base) {
    let borrow = 0;
    for (let i = 0; i < a.length; i++) {
      let x = a[i] - b[i] - borrow;
      if (x < 0) { x += base; borrow = 1; } else borrow = 0;
      a[i] = x;
    }
  }

  /** a := a + b (equal lengths), in place. Returns the carry out. */
  function addDigits(a, b, base) {
    let carry = 0;
    for (let i = 0; i < a.length; i++) {
      let x = a[i] + b[i] + carry;
      if (x >= base) { x -= base; carry = 1; } else carry = 0;
      a[i] = x;
    }
    return carry;
  }

  function isZero(digits) {
    for (let i = 0; i < digits.length; i++) if (digits[i] !== 0) return false;
    return true;
  }

  /** Index of the most significant non-zero digit + 1 (0 for zero). */
  function significantLength(digits) {
    for (let i = digits.length - 1; i >= 0; i--) if (digits[i] !== 0) return i + 1;
    return 0;
  }

  function log10Pretty(log10) {
    // Formats 10^x with x rounded down to an integer, with thousands separators.
    return Math.floor(log10).toLocaleString('en');
  }

  /* ------------------------------------------------------------------ *
   * The Library
   * ------------------------------------------------------------------ */

  class Library {
    constructor(rawConfig) {
      const cfg = normalizeConfig(rawConfig);
      this.raw = rawConfig;
      this.config = cfg;
      this.alphabet = cfg.alphabet;
      this.N = cfg.alphabet.length;
      this.M = cfg.symbolsPerBook;
      this.S = cfg.booksPerHexagon;
      this.seed = cfg.seed;

      // Fast path for power-of-two alphabets (e.g. 32 symbols = 5 bits).
      const N = this.N;
      this.bitsPerSymbol = (N & (N - 1)) === 0 ? Math.round(Math.log2(N)) : 0;
      this.symbolsPerWord = Math.max(1, Math.floor(32 / Math.log2(N)) - 1);

      // Feistel halves (possibly unequal when M is odd).
      this.half1 = Math.floor(this.M / 2);

      // Keys derived from the seed.
      const k = hashString('babel/feistel/' + this.seed);
      this.roundKeys = [];
      for (let r = 0; r < FEISTEL_ROUNDS; r++) {
        this.roundKeys.push([
          fmix32(k[0] ^ Math.imul(r + 1, 0x9e3779b1)),
          fmix32(k[1] ^ Math.imul(r + 1, 0x85ebca77)),
          fmix32(k[2] ^ Math.imul(r + 1, 0xc2b2ae3d)),
          fmix32(k[3] ^ Math.imul(r + 1, 0x27d4eb2f)),
        ]);
      }
      this.cosmeticKey = hashString('babel/cosmetic/' + this.seed);

      // Largest hexagon number: Hmax = floor((N^M − 1) / S).
      const top = new Uint8Array(this.M).fill(N - 1);
      this.lastBookSlot = divSmall(top, this.S, N); // slot of the very last book in the Library
      this.hexagonMax = top;
      this.hexDigits = Math.max(2, significantLength(top));
      // Split hexagon numbers into gallery (low digits) and floor (high digits).
      this.galleryDigits = Math.floor(this.hexDigits / 2);
      this.floorDigits = this.hexDigits - this.galleryDigits;
      this.floorMax = top.slice(this.galleryDigits, this.hexDigits);
      this.galleryMaxOnTopFloor = top.slice(0, this.galleryDigits);

      // Sizes, as base-10 logarithms (the numbers themselves are too large to print).
      const log10N = Math.log10(N);
      this.stats = {
        log10Books: this.M * log10N,
        log10Hexagons: this.M * log10N - Math.log10(this.S),
        log10GalleriesPerFloor: this.galleryDigits * log10N,
        log10Floors: this.M * log10N - Math.log10(this.S) - this.galleryDigits * log10N,
        symbolsPerBook: this.M,
        booksPerHexagon: this.S,
        alphabetSize: N,
        galleryAddressLength: this.galleryDigits,
        floorAddressLength: this.floorDigits,
      };
    }

    /* ---------------- Feistel permutation ---------------- */

    /** Adds (sign = +1) or subtracts (sign = −1) the round keystream derived from `src` into `dst`. */
    _round(r, src, dst, sign) {
      const key = this.roundKeys[r];
      const h = hashBytes(src, key[0], key[1]);
      const rng = sfc32(key[2] ^ h[0], key[3] ^ h[1], h[0] ^ 0x6a09e667, h[1] ^ 0xbb67ae85);
      const N = this.N, n = dst.length;
      const bits = this.bitsPerSymbol;
      if (bits) {
        const mask = N - 1, per = Math.floor(32 / bits);
        let j = 0;
        while (j < n) {
          let w = rng();
          for (let t = 0; t < per && j < n; t++, j++) {
            const s = w & mask; w >>>= bits;
            dst[j] = sign > 0 ? (dst[j] + s) & mask : (dst[j] - s + N) & mask;
          }
        }
      } else {
        // Several symbols from each 32-bit word: read w / 2^32 as a fraction and take its
        // first base-N digits. Taking one digit fewer than fit keeps them uniform to within
        // a fraction of a percent.
        const per = this.symbolsPerWord;
        let j = 0;
        while (j < n) {
          let w = rng();
          for (let t = 0; t < per && j < n; t++, j++) {
            const s = Math.floor(w * N * 2.3283064365386963e-10);
            w = Math.imul(w, N) >>> 0;
            let x = sign > 0 ? dst[j] + s : dst[j] - s;
            if (x >= N) x -= N; else if (x < 0) x += N;
            dst[j] = x;
          }
        }
      }
    }

    /** Index digits → book contents (symbol values 0..N−1, in reading order). */
    contentOfIndex(indexDigits) {
      const x = indexDigits.slice();
      const A = x.subarray(0, this.half1), B = x.subarray(this.half1);
      for (let r = 0; r < FEISTEL_ROUNDS; r++) {
        if (r % 2 === 0) this._round(r, B, A, +1); else this._round(r, A, B, +1);
      }
      return x;
    }

    /** Book contents → index digits (the inverse permutation). */
    indexOfContent(content) {
      const x = content.slice();
      const A = x.subarray(0, this.half1), B = x.subarray(this.half1);
      for (let r = FEISTEL_ROUNDS - 1; r >= 0; r--) {
        if (r % 2 === 0) this._round(r, B, A, -1); else this._round(r, A, B, -1);
      }
      return x;
    }

    /* ---------------- Addresses ---------------- */

    /** Builds a location object. gallery and floor are digit arrays. */
    location(gallery, floor, slot) {
      return { gallery, floor, slot };
    }

    /** Splits a slot number into wall, shelf and volume (all 0-based). */
    slotParts(slot) {
      const c = this.config;
      const volume = slot % c.booksPerShelf;
      const shelf = Math.floor(slot / c.booksPerShelf) % c.shelvesPerWall;
      const wall = Math.floor(slot / c.booksPerWall);
      return { wall, shelf, volume };
    }

    slotOf(wall, shelf, volume) {
      const c = this.config;
      return (wall * c.shelvesPerWall + shelf) * c.booksPerShelf + volume;
    }

    /** Hexagon number digits (length hexDigits) from gallery and floor. */
    hexagonNumber(gallery, floor) {
      const h = new Uint8Array(this.hexDigits);
      h.set(gallery, 0);
      h.set(floor, this.galleryDigits);
      return h;
    }

    /** True if the hexagon lies within the Library (only false at the very end of the last floor). */
    hexagonExists(gallery, floor) {
      const c = compareDigits(floor, this.floorMax);
      if (c < 0) return true;
      if (c > 0) return false;
      return compareDigits(gallery, this.galleryMaxOnTopFloor) <= 0;
    }

    /** Index digits of the book at a location, or null if that shelf position is empty
     *  (which only happens in the final hexagon, when S does not divide N^M). */
    indexOf(loc) {
      if (!this.hexagonExists(loc.gallery, loc.floor)) return null;
      const v = new Uint8Array(this.M);
      v.set(loc.gallery, 0);
      v.set(loc.floor, this.galleryDigits);
      const carry = mulSmallAdd(v, this.S, loc.slot, this.N);
      if (carry !== 0) return null;
      return v;
    }

    /** Location of the book with the given index digits. */
    locate(indexDigits) {
      const h = indexDigits.slice();
      const slot = divSmall(h, this.S, this.N);
      // h now fits in hexDigits digits
      return {
        gallery: h.slice(0, this.galleryDigits),
        floor: h.slice(this.galleryDigits, this.hexDigits),
        slot,
      };
    }

    /** Contents of the book at a location (Uint8Array of symbol values), or null if empty. */
    bookAt(loc) {
      const v = this.indexOf(loc);
      return v ? this.contentOfIndex(v) : null;
    }

    /** Location of a book given its full contents. */
    locateContent(content) {
      return this.locate(this.indexOfContent(content));
    }

    /** gallery + delta, modulo the number of galleries per floor. Returns a new array. */
    offsetGallery(gallery, delta) {
      const g = gallery.slice();
      addSmall(g, delta, this.N); // wraps modulo N^galleryDigits automatically
      return g;
    }

    /** floor + delta, modulo the number of floors. Returns a new array. */
    offsetFloor(floor, delta) {
      const N = this.N, len = floor.length;
      // Work with enough spare digits that |delta| < 2^53 can never overflow.
      const extra = Math.ceil(53 / Math.log2(N)) + 1;
      const F = new Uint8Array(len + extra); // number of floors = floorMax + 1
      F.set(this.floorMax);
      addSmall(F, 1, N);
      const x = new Uint8Array(len + extra);
      x.set(floor);
      let borrow = addSmall(x, delta, N); // −1 if the result went negative, else 0
      while (borrow < 0) borrow += addDigits(x, F, N);
      while (compareDigits(x, F) >= 0) subDigits(x, F, N);
      return x.slice(0, len);
    }

    /** A pseudorandom (seeded) location to wake up in. `n` selects among many. */
    wakingLocation(n) {
      const k = hashString('babel/waking/' + this.seed + '/' + (n || 0));
      const rng = sfc32(k[0], k[1], k[2], k[3]);
      const v = new Uint8Array(this.M);
      for (let i = 0; i < this.M; i++) v[i] = Math.floor(unit(rng) * this.N);
      return this.locate(v);
    }

    /* ---------------- Cosmetics (not part of the bijection) ---------------- */

    /** Hash of a gallery address (cache it: it costs one pass over the address). */
    galleryKey(gallery) { return hashBytes(gallery, this.cosmeticKey[0], this.cosmeticKey[1]); }

    /** Hash of a floor address. */
    floorKey(floor) { return hashBytes(floor, this.cosmeticKey[2], this.cosmeticKey[3]); }

    /** A 64-bit fingerprint of a hexagon from its gallery and floor keys. */
    fingerprintFromKeys(gk, fk) {
      const a = fmix32((gk[0] ^ Math.imul(fk[1], 0x9e3779b1)) >>> 0);
      const b = fmix32((gk[1] + fk[0] + 0x7f4a7c15) >>> 0);
      return [fmix32((a ^ b ^ fk[0]) >>> 0), fmix32((a + Math.imul(b, 5) + fk[1]) >>> 0)];
    }

    /** A 64-bit fingerprint of a hexagon, used for spine titles and colours. */
    hexagonFingerprint(gallery, floor) {
      return this.fingerprintFromKeys(this.galleryKey(gallery), this.floorKey(floor));
    }

    /** Number of books in a hexagon: S everywhere except at the very end of the Library. */
    booksInHexagon(gallery, floor) {
      const c = compareDigits(floor, this.floorMax);
      if (c < 0) return this.S;
      if (c > 0) return 0;
      const d = compareDigits(gallery, this.galleryMaxOnTopFloor);
      if (d < 0) return this.S;
      if (d > 0) return 0;
      return this.lastBookSlot + 1;
    }

    /** Cosmetic random generator for one book. */
    bookRng(fingerprint, slot) {
      return sfc32(fingerprint[0], fingerprint[1], fmix32(slot + 0x51ed27), this.cosmeticKey[0] ^ slot);
    }

    /** The letters on a book's spine: they do not indicate what the pages say. */
    spineTitle(fingerprint, slot) {
      const rng = this.bookRng(fingerprint, slot);
      let letters = this.alphabet.filter((c) => /\p{L}/u.test(c));
      if (letters.length === 0) letters = this.alphabet.filter((c) => c.trim() !== '');
      if (letters.length === 0) letters = this.alphabet;
      const words = 1 + Math.floor(unit(rng) * 3);
      const out = [];
      for (let w = 0; w < words; w++) {
        const len = 2 + Math.floor(unit(rng) * 6);
        let s = '';
        for (let i = 0; i < len; i++) s += letters[Math.floor(unit(rng) * letters.length)];
        out.push(s);
      }
      return out.join(' ');
    }


    /* ---------------- Searching ---------------- */

    /**
     * Turns any text into symbols of the alphabet, as a catalogue would: accents are
     * removed, letters change case if only the other case is in the alphabet, line breaks
     * and tabs become spaces, and anything else is left out (and reported).
     */
    prepareText(raw) {
      const map = new Map(this.alphabet.map((c, i) => [c, i]));
      const fits = (str) => Array.from(str).every((c) => map.has(c));
      // typographic characters become their plain equivalents, if the alphabet has those
      let text = '', substituted = false;
      for (const ch of String(raw)) {
        const sub = TYPOGRAPHY[ch];
        if (!map.has(ch) && sub !== undefined && fits(sub)) { text += sub; substituted = true; } else text += ch;
      }
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\r\n?|\n|\t/g, ' ');
      const out = [], dropped = new Set();
      let recased = false;
      for (const ch of text) {
        let v = map.get(ch);
        if (v === undefined) {
          for (const alt of [ch.toUpperCase(), ch.toLowerCase()]) {
            if (alt !== ch && map.has(alt)) { v = map.get(alt); recased = true; break; }
          }
        }
        if (v === undefined) { dropped.add(ch); continue; }
        out.push(v);
      }
      const symbols = Uint8Array.from(out);
      return { symbols, text: this.toText(symbols), dropped: [...dropped], recased, substituted };
    }

    /**
     * Sets a whole text in the Library's page format, as a printer would: a title page,
     * then the text in lines of exactly `charactersPerLine` characters, broken between
     * words and padded with spaces, each paragraph indented. A text longer than one book
     * is split into parts, each with its own title page. Returns { parts: [Uint8Array],
     * dropped, recased, substituted, characters }.
     */
    typeset(rawText, meta) {
      meta = meta || {};
      const c = this.config, W = c.charactersPerLine, L = c.linesPerPage, P = c.pagesPerBook;
      const spaceIndex = this.alphabet.indexOf(' ');
      const text = String(rawText).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
      const dropped = new Set();
      let recased = false, substituted = false;
      const prep = (t) => {
        const p = this.prepareText(t);
        p.dropped.forEach((ch) => dropped.add(ch));
        recased = recased || p.recased;
        substituted = substituted || p.substituted;
        return p.text;
      };
      if (spaceIndex < 0) {
        // without a space there is no layout to speak of: the text runs on
        const p = this.prepareText(text), symbols = p.symbols;
        const parts = [];
        for (let i = 0; i < Math.max(1, symbols.length); i += this.M) parts.push(symbols.subarray(i, i + this.M));
        return { parts, dropped: p.dropped, recased: p.recased, substituted: p.substituted, characters: symbols.length };
      }
      // paragraphs: blank lines separate them if there are any; otherwise each line is one
      const blocks = /\n[ \t]*\n/.test(text) ? text.split(/\n[ \t]*\n+/) : text.split('\n');
      const paragraphs = blocks.map((b) => prep(b.replace(/\s+/g, ' ').trim())).filter((b) => b.length);
      const indent = W >= 24 ? '   ' : '';
      const lines = [];
      const pad = (s) => s + ' '.repeat(Math.max(0, W - s.length));
      for (const para of paragraphs) {
        let line = indent;
        for (const word0 of para.split(' ')) {
          let word = word0;
          if (!word) continue;
          while (word.length > W) { // a word longer than a line is cut
            if (line.trim()) { lines.push(pad(line)); line = ''; }
            lines.push(word.slice(0, W));
            word = word.slice(W);
          }
          const sep = line.trim() ? ' ' : '';
          if (line.length + sep.length + word.length > W) { lines.push(pad(line)); line = word; }
          else line += sep + word;
        }
        if (line.trim()) lines.push(pad(line));
      }
      const characters = paragraphs.reduce((n, p) => n + p.length, 0);
      // title pages
      const centre = (s) => {
        s = s.slice(0, W);
        const left = Math.floor((W - s.length) / 2);
        return pad(' '.repeat(left) + s);
      };
      const wrap = (s) => {
        const out = [];
        let line = '';
        for (const w of s.split(' ').filter(Boolean)) {
          if (line && line.length + 1 + w.length > W) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
        }
        if (line) out.push(line);
        return out;
      };
      const titleLines = wrap(prep(meta.title || ''));
      const byLines = wrap(prep(meta.author || ''));
      const bodyPagesPerPart = Math.max(1, P - 1);
      const linesPerPart = bodyPagesPerPart * L;
      const partCount = Math.max(1, Math.ceil(lines.length / linesPerPart));
      const parts = [];
      for (let k = 0; k < partCount; k++) {
        const page = [];
        const top = Math.max(0, Math.floor(L / 3) - 1);
        for (let i = 0; i < top; i++) page.push(pad(''));
        for (const t of titleLines) page.push(centre(t));
        if (byLines.length) { page.push(pad('')); for (const t of byLines) page.push(centre(t)); }
        if (meta.year) page.push(centre(prep(String(meta.year))));
        if (partCount > 1) { page.push(pad('')); page.push(centre(prep(`PART ${k + 1} OF ${partCount}`))); }
        while (page.length < L) page.push(pad(''));
        const body = lines.slice(k * linesPerPart, (k + 1) * linesPerPart);
        const str = page.slice(0, L).join('') + body.join('');
        parts.push(this.prepareText(str).symbols.subarray(0, this.M));
      }
      return { parts, dropped: [...dropped], recased, substituted, characters };
    }

    /** Position of the first occurrence of `query` in `content` (both symbol arrays), or −1. */
    static indexOf(content, query, from) {
      const L = query.length;
      if (L === 0 || L > content.length) return -1;
      const first = query[0], last = content.length - L;
      let i = content.indexOf(first, from || 0);
      while (i !== -1 && i <= last) {
        let k = 1;
        while (k < L && content[i + k] === query[k]) k++;
        if (k === L) return i;
        i = content.indexOf(first, i + 1);
      }
      return -1;
    }

    /* ---------------- Distances and addresses ---------------- */

    /** Shortest signed difference b − a around a circle of `modulus` (a digit array one digit longer than a, or null for N^len). */
    _difference(a, b, modulus) {
      const N = this.N, len = a.length;
      const d = new Uint8Array(len + 1);
      d.set(b);
      const A = new Uint8Array(len + 1);
      A.set(a);
      subDigits(d, A, N); // (b − a) mod N^(len+1)
      let mod = modulus;
      if (!mod) { mod = new Uint8Array(len + 1); mod[len] = 1; } // N^len
      // bring into [0, mod)
      if (d[len] !== 0 && compareDigits(d, mod) >= 0) {
        // went negative: add mod until it wraps back into range
        while (compareDigits(d, mod) >= 0) addDigits(d, mod, N);
      }
      while (compareDigits(d, mod) >= 0) subDigits(d, mod, N);
      const other = mod.slice();
      subDigits(other, d, N); // mod − d
      if (compareDigits(other, d) < 0) return { sign: -1, digits: other };
      return { sign: isZero(d) ? 0 : 1, digits: d };
    }

    /** Shortest signed number of galleries from gallery a to gallery b (galleries wrap around). */
    galleryDifference(a, b) { return this._difference(a, b, null); }

    /** Shortest signed number of floors from floor a to floor b (floors wrap around). */
    floorDifference(a, b) {
      const F = new Uint8Array(this.floorDigits + 1);
      F.set(this.floorMax);
      addSmall(F, 1, this.N);
      return this._difference(a, b, F);
    }

    /** Size of a non-negative number given as digits: { exact (a Number, or null if too large), log10 }. */
    magnitude(digits) {
      const N = this.N, len = significantLength(digits);
      if (len === 0) return { exact: 0, log10: -Infinity };
      if ((len - 1) * Math.log2(N) < 54) {
        let v = 0;
        for (let i = len - 1; i >= 0; i--) v = v * N + digits[i];
        if (v <= Number.MAX_SAFE_INTEGER) return { exact: v, log10: Math.log10(v) };
      }
      let lead = 0, scale = 1;
      for (let i = len - 1; i >= Math.max(0, len - 4); i--) { lead += digits[i] * scale; scale /= N; }
      return { exact: null, log10: (len - 1) * Math.log10(N) + Math.log10(lead) };
    }

    /** Reads an address written in the alphabet (most significant symbol first) into digits. */
    parseAddress(text, length, what) {
      const map = new Map(this.alphabet.map((c, i) => [c, i]));
      const chars = Array.from(text);
      if (chars.length !== length) {
        throw new Error(`A ${what} address has ${length.toLocaleString('en')} symbols; this one has ${chars.length.toLocaleString('en')}. A space at its start or end may have been lost.`);
      }
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        const v = map.get(chars[i]);
        if (v === undefined) throw new Error(`The ${what} address contains ${JSON.stringify(chars[i])}, which is not in the alphabet.`);
        out[length - 1 - i] = v;
      }
      return out;
    }

    /** Reads a full hexagon address as copied from the pause menu or the catalogue. */
    parseHexagonAddress(text) {
      const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
      let seed = null, floor = null, gallery = null;
      for (let i = 0; i < lines.length; i++) {
        const m = /^\s*(seed|floor|gallery)\s*:(.*)$/i.exec(lines[i]);
        if (!m) continue;
        const key = m[1].toLowerCase();
        let value = m[2];
        if (value.trim() === '' && i + 1 < lines.length) { value = lines[i + 1]; i++; }
        else value = value.replace(/^ /, '');
        if (key === 'seed') seed = value.trim();
        else if (key === 'floor') floor = value;
        else gallery = value;
      }
      if (floor === null || gallery === null) throw new Error('Paste an address with a "Floor:" line and a "Gallery:" line, as copied from the pause menu or from this catalogue.');
      const f = this.parseAddress(floor, this.floorDigits, 'floor');
      const g = this.parseAddress(gallery, this.galleryDigits, 'gallery');
      if (compareDigits(f, this.floorMax) > 0) throw new Error('That floor is above the last floor of the Library.');
      return { seed, floor: f, gallery: g };
    }

    /** The full address of a hexagon as text, in the form parseHexagonAddress reads. */
    hexagonAddressText(gallery, floor) {
      return `Seed: ${this.seed}\nFloor:\n${this.addressText(floor)}\nGallery:\n${this.addressText(gallery)}\n`;
    }

    /* ---------------- Text ---------------- */

    /** Converts symbol values to a string. */
    toText(symbols, start, end) {
      const a = this.alphabet;
      let s = '';
      for (let i = start || 0, e = end === undefined ? symbols.length : end; i < e; i++) s += a[symbols[i]];
      return s;
    }

    /** Lines of one page (0-based page index). */
    pageLines(content, page) {
      const c = this.config;
      const base = page * c.charactersPerPage;
      const lines = [];
      for (let l = 0; l < c.linesPerPage; l++) {
        const s = base + l * c.charactersPerLine;
        lines.push(this.toText(content, s, s + c.charactersPerLine));
      }
      return lines;
    }

    /** Writes an address (digit array) in the Library's own alphabet, most significant symbol first. */
    addressText(digits, maxLength) {
      const a = this.alphabet;
      const n = digits.length;
      if (!maxLength || n <= maxLength) {
        let s = '';
        for (let i = n - 1; i >= 0; i--) s += a[digits[i]];
        return s;
      }
      const head = Math.ceil(maxLength / 2), tail = Math.floor(maxLength / 2);
      let s = '';
      for (let i = n - 1; i >= n - head; i--) s += a[digits[i]];
      s += '…';
      for (let i = tail - 1; i >= 0; i--) s += a[digits[i]];
      return s;
    }

    /** Converts a text to symbol values; characters not in the alphabet are reported. */
    encode(text) {
      const map = new Map(this.alphabet.map((c, i) => [c, i]));
      const chars = Array.from(text);
      const out = new Uint8Array(chars.length);
      const unknown = new Set();
      chars.forEach((ch, i) => {
        let v = map.get(ch);
        if (v === undefined) v = map.get(ch.toUpperCase());
        if (v === undefined) { unknown.add(ch); v = 0; }
        out[i] = v;
      });
      return { symbols: out, unknown: [...unknown] };
    }

    /**
     * Finds a book containing `text`, starting at character `position` of page `page`
     * (both 0-based). The rest of the book is filled with seeded random symbols, so the
     * same request always returns the same book. Returns { location, page, position }.
     */
    findText(text, options) {
      options = options || {};
      let symbols;
      if (text instanceof Uint8Array) {
        symbols = text;
        text = this.toText(symbols);
      } else {
        const enc = this.encode(text);
        if (enc.unknown.length) throw new Error('These characters are not in the alphabet: ' + enc.unknown.join(' '));
        symbols = enc.symbols;
      }
      const c = this.config;
      const page = options.page || 0;
      const position = options.position || 0;
      const start = page * c.charactersPerPage + position;
      if (start + symbols.length > this.M) throw new Error('The text does not fit in one book from that position.');
      const content = new Uint8Array(this.M);
      if (options.fill === 'blank') {
        const blank = this.alphabet.indexOf(' ');
        content.fill(blank >= 0 ? blank : 0);
      } else {
        const k = hashString('babel/fill/' + this.seed + '/' + text);
        const rng = sfc32(k[0], k[1], k[2], k[3]);
        for (let i = 0; i < this.M; i++) content[i] = Math.floor(unit(rng) * this.N);
      }
      content.set(symbols, start);
      return { location: this.locateContent(content), page, position, content };
    }
  }

  return {
    Library,
    normalizeConfig,
    DEFAULT_CONFIG,
    FEISTEL_ROUNDS,
    util: { hashString, hashBytes, sfc32, unit, fmix32, mulSmallAdd, divSmall, addSmall, compareDigits, subDigits, addDigits, significantLength, isZero, log10Pretty },
  };
});
