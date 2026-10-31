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
/** The value of a small number written as digits (least significant first) in base N. */
const valueOf = (digits, N) => digits.reduceRight((v, d) => v * N + d, 0);

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
  const hexagons = valueOf(lib.hexagonCount, N);
  for (const floor of floors) {
    let g = new Uint8Array(lib.hexagonDigits);
    for (let hi = 0; hi < hexagons; hi++) {
      const expected = lib.booksInHexagon(g, floor);
      let present = 0;
      for (let slot = 0; slot < lib.S; slot++) {
        const loc = { hexagon: g, floor, slot };
        const book = lib.bookAt(loc);
        if (!book) { empty++; assert(slot >= expected, 'a book is missing from a full shelf'); continue; }
        present++;
        const k = key(book);
        assert(!seen.has(k), 'two shelf positions hold the same book');
        seen.add(k);
        const back = lib.locateContent(book);
        assert.strictEqual(key(back.hexagon), key(g));
        assert.strictEqual(key(back.floor), key(floor));
        assert.strictEqual(back.slot, slot);
      }
      assert.strictEqual(present, expected, 'booksInHexagon disagrees with the shelves');
      g = lib.offsetHexagon(g, 1);
    }
  }
  assert.strictEqual(seen.size, total, `expected ${total} distinct books, found ${seen.size}`);
  return { lib, total, empty, floors: floors.length, hexagons };
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
  assert.strictEqual(r.empty + r.total, r.floors * r.hexagons * 6);
});

test('4-symbol alphabet (power of two), 6-symbol books, 8 per hexagon (4,096 books)', () => {
  const r = exhaustive({
    seed: 'another seed', alphabet: 'ABC.',
    book: { pagesPerBook: 2, linesPerPage: 1, charactersPerLine: 3 },
    hexagon: { wallsWithShelves: 2, shelvesPerWall: 2, booksPerShelf: 2 },
  });
  assert.strictEqual(r.empty, 0);
});

test('4-symbol alphabet, 6-symbol books, 4 per hexagon (1,024 hexagons: 32 floors of 32)', () => {
  const r = exhaustive({
    seed: 'square', alphabet: 'ABCD',
    book: { pagesPerBook: 1, linesPerPage: 1, charactersPerLine: 6 },
    hexagon: { wallsWithShelves: 1, shelvesPerWall: 1, booksPerShelf: 4 },
  });
  assert.strictEqual(r.empty, 0);
  assert.strictEqual(r.floors, 32);
  assert.strictEqual(r.hexagons, 32);
});

test('8-symbol alphabet, 4-symbol books, 6 per hexagon (683 hexagons, the last floor partly built)', () => {
  const r = exhaustive({
    seed: 'eight', alphabet: 'ABCDEFG ',
    book: { pagesPerBook: 1, linesPerPage: 2, charactersPerLine: 2 },
    hexagon: { wallsWithShelves: 1, shelvesPerWall: 2, booksPerShelf: 3 },
  });
  // 4,096 = 682 × 6 + 4: 683 hexagons, 32 along each floor (2^5, half of the 10 bits of 682, rounded down)
  assert.strictEqual(r.hexagons, 32);
  assert.strictEqual(r.floors, 22);
  assert.strictEqual(r.empty + r.total, r.floors * r.hexagons * 6);
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
console.log(`       hexagon numbers ${lib.hexagonDigits.toLocaleString('en')} symbols, floor numbers ${lib.floorDigits.toLocaleString('en')} symbols`);

test('random shelf positions round-trip through their contents', () => {
  const start = lib.wakingLocation(0);
  for (let i = 0; i < 6; i++) {
    const loc = { hexagon: lib.offsetHexagon(start.hexagon, i * 7 - 20), floor: lib.offsetFloor(start.floor, 3 - i), slot: (i * 97) % lib.S };
    const book = lib.bookAt(loc);
    assert.strictEqual(book.length, lib.M);
    const back = lib.locateContent(book);
    assert.strictEqual(key(back.hexagon), key(loc.hexagon));
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
  const fp = lib.hexagonFingerprint(s.hexagon, s.floor);
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
  assert.strictEqual(key(back.hexagon), key(loc.hexagon));
  assert.strictEqual(key(back.floor), key(loc.floor));
  assert.strictEqual(back.slot, 639);
});

console.log('\nThe catalogue');

test('texts are prepared as the catalogue searches them', () => {
  assert.strictEqual(lib.N, 128);
  // letters keep their case, and their accents where the alphabet has them
  const p = lib.prepareText('Ça va, Señor?\nOui: 42! [sic]~→ Être, Ōsaka');
  assert.strictEqual(p.text, 'Ça va, Señor? Oui: 42! [sic] Etre, Osaka');
  assert.deepStrictEqual(p.dropped.sort(), ['~', '→']);
  assert.strictEqual(p.recased, false);
  assert.deepStrictEqual(p.substitutions, [['Ê', 'E'], ['Ō', 'O']]);
  const q = lib.prepareText('\u201CQuoted\u201D \u2014 \u2018so\u2019\u2026 «oui» ¿qué? 1914–1918, ½ × 2');
  assert.strictEqual(q.text, '\u201CQuoted\u201D \u2014 \u2018so\u2019... «oui» ¿qué? 1914–1918, ½ × 2');
  assert.deepStrictEqual(q.substitutions, [['\u2026', '...']]);
  const r = lib.prepareText('Cæsar--and Œdipus, ¼ ﬁne; 3º N, £5 † ‡ Straße, ſo');
  assert.strictEqual(r.text, 'Cæsar\u2014and Œdipus, 1/4 fine; 3° N, £5 † †† Strasse, so');
  assert.deepStrictEqual(r.dropped, []);
  assert.strictEqual(r.substituted, true);
  // an accent with no letter to carry it is left out quietly
  assert.strictEqual(lib.prepareText('q\u0301e\u0301').text, 'qé');
  // the Library's first alphabet, of capitals only: letters are read as capitals, without accents
  const caps = new Library({ seed: 'x', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789' + '.,;:!?\'"-\u2014()[]_*&/$%\u00A3\u00B0\u2020\u00A7#+=' + ' ' });
  const c = caps.prepareText('Ça va? \u201CCæsar\u201D--½');
  assert.strictEqual(c.text, 'CA VA? "CAESAR"\u20141/2');
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
  const content = lib.bookAt(lib.randomLocation());
  const page = lib.pageLines(content, 0).join('');
  assert.strictEqual(lib.prepareText(page).symbols.length, lib.config.charactersPerPage);
  assert.strictEqual(Library.indexOf(content, lib.prepareText(page).symbols), 0);
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
  for (const [dh, df] of [[0, 0], [1, -1], [-123456789, 987654], [5e15, -3e15]]) {
    const g = lib.offsetHexagon(s.hexagon, dh), f = lib.offsetFloor(s.floor, df);
    const a = lib.hexagonDifference(s.hexagon, g), b = lib.floorDifference(s.floor, f);
    assert.strictEqual(a.sign * (lib.magnitude(a.digits).exact || 0), dh);
    assert.strictEqual(b.sign * (lib.magnitude(b.digits).exact || 0), df);
  }
  // across the seam, east–west and up–down
  const zeroG = new Uint8Array(lib.hexagonDigits), zeroF = new Uint8Array(lib.floorDigits);
  const a = lib.hexagonDifference(zeroG, lib.offsetHexagon(zeroG, -7));
  assert.strictEqual(a.sign, -1); assert.strictEqual(lib.magnitude(a.digits).exact, 7);
  const b = lib.floorDifference(lib.offsetFloor(zeroF, -3), lib.offsetFloor(zeroF, 2));
  assert.strictEqual(b.sign, 1); assert.strictEqual(lib.magnitude(b.digits).exact, 5);
});

test('there are as many floors as hexagons along each, or twice as many', () => {
  // 2^7,340,023 hexagons, an odd power of 2: 2^3,670,011 along each floor, and 2^3,670,012 floors
  const ratio = lib.stats.log10Floors - lib.stats.log10HexagonsPerFloor;
  assert.ok(Math.abs(ratio - Math.log10(2)) < 1e-6, ratio);
  assert.strictEqual(lib.hexagonMax[lib.hexagonDigits - 1], 3);
  assert.strictEqual(lib.floorMax[lib.floorDigits - 1], 7);
  // past the last hexagon of a floor, the first again
  assert.strictEqual(key(lib.offsetHexagon(lib.hexagonMax, 1)), key(new Uint8Array(lib.hexagonDigits)));
  assert.strictEqual(key(lib.offsetHexagon(new Uint8Array(lib.hexagonDigits), -1)), key(lib.hexagonMax));
  // an address past the last hexagon of a floor is refused
  const past = lib.hexagonMax.slice();
  past[past.length - 1] = lib.N - 1;
  assert.throws(() => lib.parseHexagonAddress(lib.hexagonAddressText(past, lib.floorMax)), /past the last hexagon/);
  // so is the first alphabet's, of 64 symbols (once 8 floors for every hexagon along one)
  const first = new Library({ alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789' + '.,;:!?\'"-\u2014()[]_*&/$%\u00A3\u00B0\u2020\u00A7#+=' + ' ' });
  const r64 = first.stats.log10Floors - first.stats.log10HexagonsPerFloor;
  assert.ok(Math.abs(r64 - Math.log10(2)) < 1e-6, r64);
});

test('full addresses can be copied and read back', () => {
  const s = lib.wakingLocation(5);
  const back = lib.parseHexagonAddress(lib.hexagonAddressText(s.hexagon, s.floor));
  assert.strictEqual(key(back.hexagon), key(s.hexagon));
  assert.strictEqual(key(back.floor), key(s.floor));
  assert.strictEqual(back.seed, 'borges');
  assert.throws(() => lib.parseHexagonAddress('Floor: ABC\nHexagon: DEF'), /symbols/);
});

test('the book that certainly exists holds the text, the rest of it blank', () => {
  const q = lib.prepareText('The catalogue of catalogues').symbols;
  const r = lib.findText(q);
  const book = lib.bookAt(r.location);
  assert.strictEqual(Library.indexOf(book, q), 0);
  const blank = lib.alphabet.indexOf(' ');
  assert.ok(book.subarray(q.length).every((v) => v === blank), 'the rest of the book is blank');
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
  const book = lib.bookAt(lib.findText(part).location);
  assert.strictEqual(Library.indexOf(book, part), 0);
  const title = lib.pageLines(book, 0).map((l) => l.trim()).filter(Boolean);
  assert.deepStrictEqual(title, ['A test', 'Nobody', '2026']);
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
    const r = small.findText(part);
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

test('positions are measured from the seam, as a fraction of the way round', () => {
  const lib = new Library({});
  const g = new Uint8Array(lib.hexagonDigits), f = new Uint8Array(lib.floorDigits);
  let p = lib.position(g, f);
  assert.strictEqual(p.east.exact, 0);
  assert.strictEqual(p.east.fraction, 0);
  assert.strictEqual(p.up.fraction, 0);
  g[g.length - 1] = (lib.hexagonMax[lib.hexagonMax.length - 1] + 1) / 2; // halfway round
  f[f.length - 1] = (lib.floorMax[lib.floorMax.length - 1] + 1) / 2; // halfway up
  p = lib.position(g, f);
  assert.ok(Math.abs(p.east.fraction - 0.5) < 1e-12, p.east.fraction);
  assert.ok(Math.abs(p.up.fraction - 0.5) < 1e-12, p.up.fraction);
  assert.ok(Math.abs(p.east.log10 - (lib.stats.log10HexagonsPerFloor - Math.log10(2))) < 1e-6);
  p = lib.position(lib.hexagonMax, lib.floorMax);
  // the last hexagon is 1 − 2^−3,670,011 of the way round: 1, as near as a double can tell
  assert.ok(p.east.fraction > 0.999999 && p.east.fraction <= 1, p.east.fraction);
  assert.ok(p.up.fraction > 0.999999 && p.up.fraction <= 1, p.up.fraction);
  // a small library whose number of floors is not a power of its alphabet
  const small = new Library({ seed: 's', alphabet: 'ABC', book: { pagesPerBook: 1, linesPerPage: 1, charactersPerLine: 7 }, hexagon: { wallsWithShelves: 1, shelvesPerWall: 1, booksPerShelf: 5 } });
  const floors = small.floorMax.reduceRight((v, d) => v * 3 + d, 0) + 1;
  const hexagons = valueOf(small.hexagonCount, 3);
  for (let n = 0; n < floors; n++) {
    const digits = new Uint8Array(small.floorDigits);
    for (let i = 0, v = n; i < digits.length; i++, v = Math.floor(v / 3)) digits[i] = v % 3;
    const q = small.position(new Uint8Array(small.hexagonDigits), digits);
    assert.ok(Math.abs(q.up.fraction - n / floors) < 1e-12, `floor ${n} of ${floors}: ${q.up.fraction}`);
  }
  const last = small.position(small.hexagonMax, small.floorMax);
  assert.ok(Math.abs(last.east.fraction - (hexagons - 1) / hexagons) < 1e-12);
});

test('random locations can be anywhere, and are real hexagons', () => {
  const lib = new Library({});
  const a = lib.randomLocation(), b = lib.randomLocation();
  for (const loc of [a, b]) {
    assert.ok(lib.hexagonExists(loc.hexagon, loc.floor));
    assert.ok(loc.slot >= 0 && loc.slot < lib.S);
  }
  assert.notStrictEqual(lib.hexagonAddressText(a.hexagon, a.floor), lib.hexagonAddressText(b.hexagon, b.floor));
  // with a seeded source of randomness, always the same
  const seeded = () => { const r = util.sfc32(1, 2, 3, 4); return () => util.unit(r); };
  const c = lib.randomLocation(seeded()), d = lib.randomLocation(seeded());
  assert.strictEqual(lib.hexagonAddressText(c.hexagon, c.floor), lib.hexagonAddressText(d.hexagon, d.floor));
  // spread over the whole Library: 32 random hexagons fall in many of 8 bands of floors
  const bands = new Set();
  for (let i = 0; i < 32; i++) {
    const l = lib.randomLocation();
    bands.add(Math.floor(lib.position(l.hexagon, l.floor).up.fraction * 8));
  }
  assert.ok(bands.size >= 4, `random hexagons fall in only ${bands.size} of 8 bands of floors`);
});

test('links to books of the collection name them by their file', () => {
  assert.strictEqual(Library.bookLink('3f6bb9d6f78e0293b56a', 1), '#book=3f6bb9d6f78e0293b56a');
  assert.strictEqual(Library.bookLink('3f6bb9d6f78e0293b56a', 3), '#book=3f6bb9d6f78e0293b56a/3');
  assert.deepStrictEqual(Library.readBookLink('#book=3f6bb9d6f78e0293b56a/3'), { id: '3f6bb9d6f78e0293b56a', part: 3 });
  assert.deepStrictEqual(Library.readBookLink('#book=3f6bb9d6f78e0293b56a'), { id: '3f6bb9d6f78e0293b56a', part: 1 });
  assert.ok(Library.readBookLink('#book=3f6bb9d6f78e0293b56a&random').error);
  assert.ok(Library.readBookLink('#book=3f6b').error);
  assert.ok(Library.readBookLink('#book=:eNpc').error);
  assert.strictEqual(Library.readBookLink('#text=x'), null);
});

test('the timing of dreams is checked', () => {
  const d = new Library({}).config;
  assert.strictEqual(d.quoteDuration, 10);
  assert.strictEqual(d.quoteInterval, 5);
  const c = new Library({ dreams: { quoteDuration: 4, quoteInterval: 0 } }).config;
  assert.strictEqual(c.quoteDuration, 4);
  assert.strictEqual(c.quoteInterval, 0);
  assert.throws(() => new Library({ dreams: { quoteDuration: 0 } }), /quoteDuration/);
  assert.throws(() => new Library({ dreams: { quoteInterval: -1 } }), /quoteInterval/);
  assert.throws(() => new Library({ dreams: { quoteLength: 3 } }), /not a setting/);
});

test('the sentences of dreams are grammatical and always the same for a hexagon', () => {
  const Quotes = require('../js/quotes.js');
  const seed = [0x12345678, 0x9abcdef0, 0x0badcafe, 0xdeadbeef];
  assert.strictEqual(Quotes.quote(seed, 3), Quotes.quote(seed.slice(), 3));
  assert.notStrictEqual(Quotes.quote(seed, 0), Quotes.quote([seed[0] ^ 1, seed[1], seed[2], seed[3]], 0));
  const seen = new Set();
  const N = 4000;
  for (let i = 0; i < N; i++) {
    const q = Quotes.quote([Math.imul(i, 0x9e3779b1) >>> 0, i, (i * 7919) >>> 0, 42], i % 16);
    seen.add(q);
    const words = q.split(' ');
    assert.ok(words.length >= 5 && words.length <= 22, `${words.length} words: ${q}`);
    assert.ok(/^[A-Z]/.test(q) && /[.?]$/.test(q), `capital and full stop: ${q}`);
    assert.ok(!/\s[,.;?]|\s\s|\b(\w+) \1\b/i.test(q), `spacing or a repeated word: ${q}`);
    for (const m of q.matchAll(/\b(a|an) (\w+)/gi)) {
      const w = m[2].toLowerCase();
      const an = /^(hour|honest|heir|honou?r)/.test(w) || (/^[aeiou]/.test(w) && !/^(uni|use|usu|eu|one|ou?ija)/.test(w));
      assert.strictEqual(m[1].toLowerCase(), an ? 'an' : 'a', `article: ${q}`);
    }
  }
  assert.ok(seen.size > N * 0.99, `only ${seen.size} different sentences in ${N}`);
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
    assert(short.startsWith('https://example.org/Babel/#text=:'));
    assert.strictEqual(plain, 'https://example.org/Babel/#text=' + encodeURIComponent(post));
    assert.strictEqual(await Library.readLink(new URL(short).hash), post);
    assert.strictEqual(await Library.readLink(new URL(plain).hash), post);
    // a short text is linked plainly, being shorter so; an "&" in the text stays in it
    assert.strictEqual(await Library.makeLink('https://example.org/', 'IN THE BEGINNING'), 'https://example.org/#text=IN%20THE%20BEGINNING');
    assert.strictEqual(await Library.readLink(new URL(await Library.makeLink('https://example.org/', 'A & B')).hash), 'A & B');
    // a link built by hand, as a browser leaves it once pasted in its address bar
    assert.strictEqual(await Library.readLink('#text=Call%20me%20Ishmael.'), 'Call me Ishmael.');
    assert.strictEqual(await Library.readLink('#text=50%25 off, 100% sure'), '50% off, 100% sure');
    assert.strictEqual(await Library.readLink('#book=3f6bb9d6f78e0293b56a'), null);
    assert.strictEqual(await Library.readLink(''), null);
    // the book: a text over several lines is set in paragraphs, as the Read tab sets a book
    // of the collection, from the very start of the first page, the rest blank
    const b = lib.bookOfText(post);
    const laid = lib.layText(post);
    assert.ok(laid.laidOut);
    assert.deepStrictEqual(laid.symbols, lib.typeset(post, {}).parts[0]);
    assert.strictEqual(b.length, laid.symbols.length);
    assert.deepStrictEqual(lib.pageLines(b.content, 0).slice(0, 4).map((l) => l.trimEnd()),
      ['   A first paragraph, with “curly quotes”, an em dash — and an', 'émigré.', '   A second paragraph.', '']);
    assert.strictEqual(laid.text, 'A first paragraph, with “curly quotes”, an em dash — and an émigré. A second paragraph.');
    assert(lib.pageLines(b.content, 1).every((l) => !l.trim()), 'the second page is blank');
    assert.strictEqual(Library.indexOf(lib.bookAt(b.location), b.content), 0);
    // a text on one line is taken as typed, whatever spaces or line break surround it
    for (const t of ['The sun rises in the west.', 'The sun rises in the west.\n', '  The sun rises in the west.']) {
      const p = lib.layText(t);
      assert.ok(!p.laidOut);
      assert.deepStrictEqual(p.symbols, lib.prepareText(t).symbols);
      assert.strictEqual(lib.bookOfText(t).length, lib.prepareText(t).symbols.length);
    }
    // a text set in more lines than a book holds is too long
    const lines = lib.M / lib.config.charactersPerLine;
    assert.ok(lib.bookOfText('a\n'.repeat(lines)));
    assert.strictEqual(lib.bookOfText('a\n'.repeat(lines + 1)), null);
    // the same book as "Find a text" finds; and whichever form of link carried the text
    const found = lib.findText(laid.symbols);
    assert.strictEqual(key(found.location.hexagon) + key(found.location.floor) + found.location.slot, key(b.location.hexagon) + key(b.location.floor) + b.location.slot);
    const again = lib.bookOfText(await Library.readLink(new URL(plain).hash));
    assert.strictEqual(key(again.location.hexagon) + key(again.location.floor) + again.location.slot, key(b.location.hexagon) + key(b.location.floor) + b.location.slot);
    // pages set from a book of one's own lead, as a link, to the very book they were found in
    const set = lib.typeset('Call me Ishmael. Some years ago, never mind how long precisely.\n\nThere now is your insular city.', {});
    const pages = lib.toText(set.parts[0]).replace(/ +$/, '');
    const own = lib.bookOfText(await Library.readLink(new URL(await Library.makeLink('https://example.org/', pages)).hash));
    assert.strictEqual(key(own.location.hexagon) + own.location.slot, key(lib.findText(set.parts[0]).location.hexagon) + lib.findText(set.parts[0]).location.slot);
    assert.strictEqual(lib.bookOfText(''), null);
    const big = 'WORD '.repeat(200000);
    assert((await Library.makeLink('https://example.org/', big)).length < big.length / 50, 'repetitive text compresses');
  });

  await testAsync('a secret link carries the text encrypted, and opens with its password only', async () => {
    const text = 'Meet me at the hexagon of the crimson books.';
    const url = await Library.makeSecretLink('https://example.org/Babel/#old', text, 'correct horse battery staple');
    assert(url.startsWith('https://example.org/Babel/#secret='));
    const hash = new URL(url).hash;
    assert.ok(Library.isSecretLink(hash) && !Library.isSecretLink('#text=x'));
    assert.ok(!/crimson|horse/.test(hash), 'neither the text nor the password shows in the link');
    assert.strictEqual(await Library.readLink(hash), null);
    assert.strictEqual(await Library.readSecretLink(hash, 'correct horse battery staple'), text);
    await assert.rejects(Library.readSecretLink(hash, 'correct horse battery stapler'), (e) => e.reason === 'password');
    await assert.rejects(Library.readSecretLink(hash.slice(0, 24), 'correct horse battery staple'), (e) => e.reason === 'broken');
    // the same text and password make another link every time, which leads to the same book
    const other = new URL(await Library.makeSecretLink('https://example.org/', text, 'correct horse battery staple')).hash;
    assert.notStrictEqual(other, hash);
    const a = lib.bookOfText(await Library.readSecretLink(other, 'correct horse battery staple')), b = lib.bookOfText(text);
    assert.strictEqual(key(a.location.hexagon) + key(a.location.floor) + a.location.slot, key(b.location.hexagon) + key(b.location.floor) + b.location.slot);
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
