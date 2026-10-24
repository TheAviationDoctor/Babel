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
  const frac = same / a.length; // expect about 1/N
  assert(Math.abs(frac - 1 / lib.N) < 0.002, `fraction of equal symbols ${frac}`);
});

test('symbols are evenly distributed', () => {
  const book = lib.bookAt({ ...lib.wakingLocation(1), slot: 5 });
  const counts = new Array(lib.N).fill(0);
  for (const s of book) counts[s]++;
  const expected = lib.M / lib.N;
  let chi2 = 0;
  for (const c of counts) chi2 += (c - expected) ** 2 / expected;
  const dof = lib.N - 1;
  assert(chi2 < dof + 6 * Math.sqrt(2 * dof), `chi-squared ${chi2.toFixed(1)} with ${dof} degrees of freedom`);
});

test('any text can be found, and is on the page it was asked for', () => {
  const text = 'THE LIBRARY IS UNLIMITED AND PERIODIC.';
  const found = lib.findText(text, { page: 41, position: 128 });
  const book = lib.bookAt(found.location);
  const page = lib.pageLines(book, 41).join('');
  assert.strictEqual(page.slice(128, 128 + text.length), text);
});

test('the same seed always gives the same Library', () => {
  const other = new Library(sandbox.window.BABEL_CONFIG);
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
  assert.strictEqual(lib.N, 64);
  const p = lib.prepareText('Ça va, Señor?\nOui: 42! [sic]~→');
  assert.strictEqual(p.text, 'CA VA, SENOR? OUI: 42! [SIC]');
  assert.deepStrictEqual(p.dropped.sort(), ['~', '→']);
  assert.strictEqual(p.recased, true);
  const q = lib.prepareText('\u201CQuoted\u201D \u2014 \u2018so\u2019\u2026');
  assert.strictEqual(q.text, '"QUOTED" \u2014 \'SO\'...');
  assert.strictEqual(q.substituted, true);
  const r = lib.prepareText('Cæsar--and Œdipus, ½ ﬁne; 3º N, £5 † ‡ Straße');
  assert.strictEqual(r.text, 'CAESAR\u2014AND OEDIPUS, 1/2 FINE; 3° N, £5 † †† STRASSE');
  assert.deepStrictEqual(r.dropped, []);
  // a smaller alphabet: letters are read as capitals
  const caps = new Library({ seed: 'x', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ,.? ' });
  const c = caps.prepareText('Ça va?');
  assert.strictEqual(c.text, 'CA VA?');
  assert.strictEqual(c.recased, true);
});

test('control characters are shown as control pictures, and read back from them', () => {
  const ascii = new Library({ seed: 'ascii', alphabet: Array.from({ length: 128 }, (_, c) => String.fromCharCode(c)).join('') });
  const lib = ascii;
  assert.strictEqual(lib.toText(Uint8Array.from([0, 9, 10, 31, 32, 65, 126, 127])), '␀␉␊␟ A~␡');
  const p = lib.prepareText('␀A\tB␡');
  assert.deepStrictEqual([...p.symbols], [0, 65, 32, 66, 127]);
  assert.strictEqual(lib.isControlGlyph('␊'), true);
  assert.strictEqual(lib.isControlGlyph('A'), false);
  // a page that is copied and pasted back is found again, control characters and all
  const r = lib.findText(lib.prepareText('x').symbols, { fill: 'random' });
  const page = lib.pageLines(lib.bookAt(r.location), 0).join('');
  assert.strictEqual(lib.prepareText(page).symbols.length, lib.config.charactersPerPage);
  assert.strictEqual(Library.indexOf(r.content, lib.prepareText(page).symbols), 0);
  assert.throws(() => new Library({ alphabet: 'AB\u0000\u2400' }), /control character/);
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

test('a whole text is set in pages, with a title page', () => {
  const words = [];
  for (let i = 0; i < 300; i++) words.push(['THE', 'LIBRARY', 'IS', 'UNLIMITED', 'PERIODIC', 'HEXAGON'][i % 6]);
  const text = words.slice(0, 120).join(' ') + '\n\n' + words.slice(120).join(' ');
  const t = lib.typeset(text, { title: 'A test', author: 'Nobody', year: 2026 });
  assert.strictEqual(t.parts.length, 1);
  const c = lib.config, part = t.parts[0];
  assert.strictEqual(part.length % c.charactersPerLine, 0);
  // the book that holds it, with the rest of its pages blank, is read back from its shelf
  const book = lib.bookAt(lib.findText(part, { fill: 'blank' }).location);
  assert.strictEqual(Library.indexOf(book, part), 0);
  const title = lib.pageLines(book, 0).map((l) => l.trim()).filter(Boolean);
  assert.deepStrictEqual(title, ['A TEST', 'NOBODY', '2026']);
  const lines = lib.pageLines(book, 1);
  assert(lines[0].startsWith('   THE LIBRARY'), 'paragraphs are indented');
  assert(lines.every((l) => l.length === c.charactersPerLine));
  const pages = Math.ceil(part.length / (c.charactersPerLine * c.linesPerPage));
  const body = [];
  for (let p = 1; p < pages; p++) body.push(...lib.pageLines(book, p));
  const found = body.join(' ').split(/\s+/).filter(Boolean);
  // every word is there, in order, and none is broken across two lines
  assert.deepStrictEqual(found, words);
  const second = body.findIndex((l, i) => i > 0 && l.startsWith('   '));
  assert(second > 0, 'the second paragraph starts on a new, indented line');
});

test('a text longer than one book is split into parts', () => {
  const small = new Library({ seed: 's', book: { pagesPerBook: 3, linesPerPage: 4, charactersPerLine: 24 } });
  const text = Array.from({ length: 60 }, (_, i) => 'WORD' + i).join(' ');
  const t = small.typeset(text, { title: 'Long' });
  assert(t.parts.length > 1, 'expected several parts');
  for (const [k, part] of t.parts.entries()) {
    assert(small.pageLines(part, 0).join('').toUpperCase().includes(`PART ${k + 1} OF ${t.parts.length}`));
    const r = small.findText(part, { fill: 'blank' });
    assert.strictEqual(Library.indexOf(small.bookAt(r.location), part), 0);
  }
});

test("Project Gutenberg's licence is left out of a book", () => {
  const raw = 'The Project Gutenberg eBook of Moby-Dick\r\n\r\nTitle: Moby-Dick; or The\r\n       Whale\r\nAuthor: Herman Melville\r\n\r\n' +
    '*** START OF THE PROJECT GUTENBERG EBOOK MOBY-DICK ***\r\n\r\nProduced by Someone\r\nand Others\r\n\r\n\r\nCHAPTER 1.\r\n\r\nThe text.\r\n\r\n' +
    "End of Project Gutenberg's Moby-Dick\r\n\r\n*** END OF THE PROJECT GUTENBERG EBOOK MOBY-DICK ***\r\nThe licence.\r\n";
  const e = Library.cleanEbook(raw);
  assert.strictEqual(e.text, 'CHAPTER 1.\n\nThe text.');
  assert.strictEqual(e.title, 'Moby-Dick; or The Whale');
  assert.strictEqual(e.author, 'Herman Melville');
  assert.strictEqual(e.trimmed, true);
  const plain = Library.cleanEbook('Title: not a header\nJust a text.');
  assert.strictEqual(plain.trimmed, false);
  assert.strictEqual(plain.title, '');
  assert.strictEqual(plain.text, 'Title: not a header\nJust a text.');
});

// Links to books are made and read asynchronously (compression streams).
(async () => {
  async function testAsync(name, fn) {
    const t0 = Date.now();
    try {
      await fn();
      console.log(`  ok   ${name}  (${Date.now() - t0} ms)`);
    } catch (e) {
      failures++;
      console.log(`  FAIL ${name}\n       ${e.stack.split('\n').slice(0, 3).join('\n       ')}`);
    }
  }

  await testAsync('a link carries a text, and leads to the book that holds it', async () => {
    const post = 'A first paragraph, with “curly quotes”, an em dash — and an émigré.\n\nA second paragraph.';
    const short = await Library.makeLink('https://example.org/Babel/#old', post);
    const plain = await Library.makeLink('https://example.org/Babel/', post, true);
    assert(short.startsWith('https://example.org/Babel/#book=:'));
    assert.strictEqual(plain, 'https://example.org/Babel/#book=' + encodeURIComponent(post));
    assert.strictEqual(await Library.readLink(new URL(short).hash), post);
    assert.strictEqual(await Library.readLink(new URL(plain).hash), post);
    // a link built by hand, as a browser leaves it once pasted in its address bar
    assert.strictEqual(await Library.readLink('#book=Call%20me%20Ishmael.'), 'Call me Ishmael.');
    assert.strictEqual(await Library.readLink('#book=50%25 off, 100% sure'), '50% off, 100% sure');
    assert.strictEqual(await Library.readLink('#floor=ABC'), null);
    assert.strictEqual(await Library.readLink(''), null);
    // the book: the text from the first page, words whole, paragraphs indented, the rest blank
    const b = lib.bookOfText(post);
    const lines = lib.pageLines(b.content, 0).map((l) => l.trimEnd());
    assert.deepStrictEqual(lines.slice(0, 3), ['   A FIRST PARAGRAPH, WITH "CURLY QUOTES", AN EM DASH — AND AN', 'EMIGRE.', '   A SECOND PARAGRAPH.']);
    assert(lib.pageLines(b.content, 1).every((l) => !l.trim()), 'the second page is blank');
    assert.strictEqual(Library.indexOf(lib.bookAt(b.location), b.content), 0);
    // the same text, whichever form of link carried it, is the same book
    const again = lib.bookOfText(await Library.readLink(new URL(plain).hash));
    assert.strictEqual(key(again.location.gallery) + key(again.location.floor) + again.location.slot, key(b.location.gallery) + key(b.location.floor) + b.location.slot);
    const big = 'WORD '.repeat(200000);
    assert((await Library.makeLink('https://example.org/', big)).length < big.length / 50, 'repetitive text compresses');
  });

  await testAsync('the website and view settings are checked', async () => {
    assert.strictEqual(new Library({ website: 'https://example.org/Babel/' }).config.website, 'https://example.org/Babel/');
    assert.throws(() => new Library({ website: 'example.org' }), /website/);
    const v = new Library({ view: { lookSensitivity: 1.5, fieldOfView: 80 } }).config;
    assert.strictEqual(v.lookSensitivity, 1.5);
    assert.strictEqual(v.fieldOfView, 80);
    assert.throws(() => new Library({ view: { fieldOfView: 200 } }), /fieldOfView/);
    assert.throws(() => new Library({ view: { zoom: 2 } }), /not a setting/);
  });

  console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed');
  process.exit(failures ? 1 : 0);
})();
