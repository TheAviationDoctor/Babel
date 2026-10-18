// Tests for the mathematical core. Run with:  node tests/library.test.js
'use strict';
const assert = require('assert');
const { Library, util } = require('../js/library.js');

let failures = 0;
function test(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    console.log(`  ok   ${name}  (${Date.now() - t0} ms)`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name}\n       ${e.stack.split('\n').slice(0, 3).join('\n       ')}`);
  }
}

const key = (a) => Buffer.from(a).toString('hex');

/** Enumerates every shelf position of a small library and checks the map is a bijection. */
function exhaustive(raw) {
  const lib = new Library(raw);
  const N = lib.N, M = lib.M;
  const total = N ** M;
  const seen = new Set();
  let empty = 0;
  const floors = [];
  let f = new Uint8Array(lib.floorDigits);
  // enumerate floors 0..floorMax
  for (;;) {
    floors.push(f);
    if (util.compareDigits(f, lib.floorMax) === 0) break;
    f = lib.offsetFloor(f, 1);
  }
  const galleries = N ** lib.galleryDigits;
  for (const floor of floors) {
    let g = new Uint8Array(lib.galleryDigits);
    for (let gi = 0; gi < galleries; gi++) {
      const expected = lib.booksInHexagon(g, floor);
      let present = 0;
      for (let slot = 0; slot < lib.S; slot++) {
        const loc = { gallery: g, floor, slot };
        const book = lib.bookAt(loc);
        if (!book) { empty++; assert(slot >= expected, 'a book is missing from a full shelf'); continue; }
        present++;
        const k = key(book);
        assert(!seen.has(k), 'two shelf positions hold the same book');
        seen.add(k);
        const back = lib.locateContent(book);
        assert.strictEqual(key(back.gallery), key(g));
        assert.strictEqual(key(back.floor), key(floor));
        assert.strictEqual(back.slot, slot);
      }
      assert.strictEqual(present, expected, 'booksInHexagon disagrees with the shelves');
      g = lib.offsetGallery(g, 1);
    }
  }
  assert.strictEqual(seen.size, total, `expected ${total} distinct books, found ${seen.size}`);
  return { lib, total, empty, floors: floors.length, galleries };
}

console.log('Reading the configuration');

test('misspelt settings are reported, and names ignore case and punctuation', () => {
  const { normalizeConfig } = require('../js/library.js');
  const a = normalizeConfig({ book: { pagesPerBook: 3, lines_per_page: 2, CharactersPerLine: 4 }, hexagon: { booksPerShelf: 5 } });
  assert.strictEqual(a.symbolsPerBook, 24);
  assert.strictEqual(a.booksPerShelf, 5);
  assert.throws(() => normalizeConfig({ book: { pages: 3 } }), /is not a setting/);
  assert.throws(() => normalizeConfig({ hexagon: { wallsWithShelves: 5 } }), /at most 4/);
  assert.throws(() => normalizeConfig({ alphabet: 'ABA' }), /more than once/);
});

console.log('\nSmall libraries, checked exhaustively');

test('3-symbol alphabet, 5-symbol books, 6 per hexagon (243 books, last hexagon partly empty)', () => {
  const r = exhaustive({
    seed: 'test', alphabet: 'AB ',
    book: { pagesPerBook: 1, linesPerPage: 1, charactersPerLine: 5 },
    hexagon: { wallsWithShelves: 1, shelvesPerWall: 2, booksPerShelf: 3 },
  });
  // 243 = 40 × 6 + 3, so 41 hexagons and 3 empty slots in the last one.
  assert.strictEqual(r.empty + r.total, r.floors * r.galleries * 6);
});

test('4-symbol alphabet (power of two), 6-symbol books, 8 per hexagon (4,096 books)', () => {
  const r = exhaustive({
    seed: 'another seed', alphabet: 'ABC.',
    book: { pagesPerBook: 2, linesPerPage: 1, charactersPerLine: 3 },
    hexagon: { wallsWithShelves: 2, shelvesPerWall: 2, booksPerShelf: 2 },
  });
  assert.strictEqual(r.empty, 0);
});

test('7-symbol alphabet, 4-symbol books, 10 per hexagon (2,401 books)', () => {
  exhaustive({
    seed: 'x', alphabet: 'ABCDEF ',
    book: { pagesPerBook: 2, linesPerPage: 2, charactersPerLine: 1 },
    hexagon: { wallsWithShelves: 1, shelvesPerWall: 2, booksPerShelf: 5 },
  });
});

test('different seeds shelve the same books differently', () => {
  const raw = (seed) => ({ seed, alphabet: 'ABCD', book: { pagesPerBook: 1, linesPerPage: 1, charactersPerLine: 6 }, hexagon: { wallsWithShelves: 1, shelvesPerWall: 1, booksPerShelf: 4 } });
  const a = new Library(raw('one')), b = new Library(raw('two'));
  const loc = a.wakingLocation(0);
  assert.notStrictEqual(key(a.bookAt(loc)), key(b.bookAt(loc)));
});

test('floor arithmetic wraps around the number of floors', () => {
  const lib = new Library({ seed: 's', alphabet: 'AB ', book: { pagesPerBook: 1, linesPerPage: 1, charactersPerLine: 5 }, hexagon: { wallsWithShelves: 1, shelvesPerWall: 2, booksPerShelf: 3 } });
  const zero = new Uint8Array(lib.floorDigits);
  const top = lib.offsetFloor(zero, -1);
  assert.strictEqual(key(top), key(lib.floorMax));
  assert.strictEqual(key(lib.offsetFloor(top, 1)), key(zero));
  const floorsCount = (() => { let n = 1, f = zero; while (util.compareDigits(f, lib.floorMax) !== 0) { f = lib.offsetFloor(f, 1); n++; } return n; })();
  assert.strictEqual(key(lib.offsetFloor(zero, floorsCount * 3 + 1)), key(lib.offsetFloor(zero, 1)));
  assert.strictEqual(key(lib.offsetFloor(zero, -floorsCount * 2 - 1)), key(top));
});

console.log('\nThe Library described by config.js');

// Read the real configuration file, as the browser does.
const fs = require('fs'), path = require('path'), vm = require('vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8'), sandbox);
const lib = new Library(sandbox.window.BABEL_CONFIG);
console.log(`       ${lib.M.toLocaleString('en')} symbols per book; about 10^${util.log10Pretty(lib.stats.log10Books)} books;`);
console.log(`       gallery addresses ${lib.galleryDigits.toLocaleString('en')} symbols, floor addresses ${lib.floorDigits.toLocaleString('en')} symbols`);

test('random shelf positions round-trip through their contents', () => {
  const start = lib.wakingLocation(0);
  for (let i = 0; i < 6; i++) {
    const loc = { gallery: lib.offsetGallery(start.gallery, i * 7 - 20), floor: lib.offsetFloor(start.floor, 3 - i), slot: (i * 97) % lib.S };
    const book = lib.bookAt(loc);
    assert.strictEqual(book.length, lib.M);
    const back = lib.locateContent(book);
    assert.strictEqual(key(back.gallery), key(loc.gallery));
    assert.strictEqual(key(back.floor), key(loc.floor));
    assert.strictEqual(back.slot, loc.slot);
  }
});

test('neighbouring books look unrelated', () => {
  const start = lib.wakingLocation(0);
  const a = lib.bookAt({ ...start, slot: 0 });
  const b = lib.bookAt({ ...start, slot: 1 });
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  const frac = same / a.length; // expect about 1/32
  assert(Math.abs(frac - 1 / 32) < 0.002, `fraction of equal symbols ${frac}`);
});

test('symbols are evenly distributed', () => {
  const book = lib.bookAt({ ...lib.wakingLocation(1), slot: 5 });
  const counts = new Array(lib.N).fill(0);
  for (const s of book) counts[s]++;
  const expected = lib.M / lib.N;
  let chi2 = 0;
  for (const c of counts) chi2 += (c - expected) ** 2 / expected;
  assert(chi2 < 80, `chi-squared ${chi2.toFixed(1)} with 31 degrees of freedom`);
});

test('any text can be found, and is on the page it was asked for', () => {
  const text = 'THE LIBRARY IS UNLIMITED AND PERIODIC.';
  const found = lib.findText(text, { page: 41, position: 128 });
  const book = lib.bookAt(found.location);
  const page = lib.pageLines(book, 41).join('');
  assert.strictEqual(page.slice(128, 128 + text.length), text);
});

test('the same seed always gives the same Library', () => {
  const other = new Library({ seed: 'borges' });
  const loc = lib.wakingLocation(3);
  assert.strictEqual(key(other.bookAt(loc).subarray(0, 4096)), key(lib.bookAt(loc).subarray(0, 4096)));
});

test('timing: one book', () => {
  const loc = { ...lib.wakingLocation(2), slot: 77 };
  const t0 = performance.now();
  const n = 5;
  for (let i = 0; i < n; i++) lib.bookAt({ ...loc, slot: i });
  const per = (performance.now() - t0) / n;
  console.log(`       ${per.toFixed(1)} ms per book`);
  assert(per < 400);
});

test('timing: hexagon fingerprint and spine title', () => {
  const s = lib.wakingLocation(0);
  const t0 = performance.now();
  const fp = lib.hexagonFingerprint(s.gallery, s.floor);
  const t1 = performance.now();
  const title = lib.spineTitle(fp, 3);
  console.log(`       fingerprint ${(t1 - t0).toFixed(1)} ms; a spine reads "${title}"`);
});

console.log("\nBorges's own figures (410 pages × 40 lines × 80 characters, 25 symbols, 640 books per hexagon)");

test('a non-power-of-two alphabet and a hexagon size that does not divide the number of books', () => {
  const b = new Library({
    seed: 'borges', alphabet: 'ABCDEFGHIJKLMNOPQRSTUV,. ',
    book: { pagesPerBook: 410, linesPerPage: 40, charactersPerLine: 80 },
    hexagon: { wallsWithShelves: 4, shelvesPerWall: 5, booksPerShelf: 32 },
  });
  const loc = { ...b.wakingLocation(0), slot: 639 };
  const t0 = performance.now();
  const book = b.bookAt(loc);
  console.log(`       ${(performance.now() - t0).toFixed(1)} ms per book; the last hexagon holds ${b.lastBookSlot + 1} of its 640 books`);
  const back = b.locateContent(book);
  assert.strictEqual(key(back.gallery), key(loc.gallery));
  assert.strictEqual(key(back.floor), key(loc.floor));
  assert.strictEqual(back.slot, 639);
});

console.log('\nThe catalogue');

test('texts are prepared as the catalogue searches them', () => {
  const p = lib.prepareText('Ça va, Señor?\nOui: 42!');
  assert.strictEqual(p.text, 'CA VA, SENOR? OUI: !');
  assert.deepStrictEqual(p.dropped.sort(), ['2', '4']);
  assert.strictEqual(p.recased, true);
});

test('a text is found in a book exactly where it was put', () => {
  const q = lib.prepareText('NEEDLE').symbols;
  const book = new Uint8Array(5000).fill(3);
  book.set(q, 4321);
  assert.strictEqual(Library.indexOf(book, q), 4321);
  book.set(q, 17);
  assert.strictEqual(Library.indexOf(book, q), 17);
  assert.strictEqual(Library.indexOf(book.subarray(0, 4325), q), 17);
  assert.strictEqual(Library.indexOf(new Uint8Array(10), q), -1);
});

test('distances between hexagons take the shorter way round', () => {
  const s = lib.wakingLocation(4);
  for (const [dg, df] of [[0, 0], [1, -1], [-123456789, 987654], [5e15, -3e15]]) {
    const g = lib.offsetGallery(s.gallery, dg), f = lib.offsetFloor(s.floor, df);
    const a = lib.galleryDifference(s.gallery, g), b = lib.floorDifference(s.floor, f);
    assert.strictEqual(a.sign * (lib.magnitude(a.digits).exact || 0), dg);
    assert.strictEqual(b.sign * (lib.magnitude(b.digits).exact || 0), df);
  }
  // across the end of a gallery and of the floors
  const zeroG = new Uint8Array(lib.galleryDigits), zeroF = new Uint8Array(lib.floorDigits);
  const a = lib.galleryDifference(zeroG, lib.offsetGallery(zeroG, -7));
  assert.strictEqual(a.sign, -1); assert.strictEqual(lib.magnitude(a.digits).exact, 7);
  const b = lib.floorDifference(lib.offsetFloor(zeroF, -3), lib.offsetFloor(zeroF, 2));
  assert.strictEqual(b.sign, 1); assert.strictEqual(lib.magnitude(b.digits).exact, 5);
});

test('full addresses can be copied and read back', () => {
  const s = lib.wakingLocation(5);
  const back = lib.parseHexagonAddress(lib.hexagonAddressText(s.gallery, s.floor));
  assert.strictEqual(key(back.gallery), key(s.gallery));
  assert.strictEqual(key(back.floor), key(s.floor));
  assert.strictEqual(back.seed, 'borges');
  assert.throws(() => lib.parseHexagonAddress('Floor: ABC\nGallery: DEF'), /symbols/);
});

test('the copy that certainly exists contains the text', () => {
  const q = lib.prepareText('The catalogue of catalogues').symbols;
  for (const fill of ['random', 'blank']) {
    const r = lib.findText(q, { fill });
    assert.strictEqual(Library.indexOf(lib.bookAt(r.location), q), 0);
  }
});

console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed');
process.exit(failures ? 1 : 0);
