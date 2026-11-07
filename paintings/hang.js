#!/usr/bin/env node
/*
 * THE LIBRARY OF BABEL — hanging the paintings
 *
 * Hangs every picture of paintings/originals/ (GIF, JPEG or PNG files, which are not
 * published) in the Library, for the catalogue's "View painting":
 *
 *   paintings/index.js             the list of the paintings: title, painter, year
 *   paintings/compressed/<id>.js   each painting as the Library holds it, compressed, as a
 *                                  small script
 *
 * Each picture is fitted whole on a mat of lead white and painted in the Library's colours,
 * as the catalogue's "Find image" does when asked to fit a picture whole (paintingOfImage,
 * in js/library.js). By default a painting is 1,024 × 1,024 pixels in 128 colours; with
 * another configuration, it follows the books (see "Paintings" in README.md).
 *
 * Name each picture after its painting, "Painter - Title (Year).jpg", for instance
 * "Vincent van Gogh - The Starry Night (1889).jpg". A painting's script is named after a
 * hash of the painting, which is also its #painting= link: it is written only when a
 * picture is new or has changed, and removed when its picture is gone.
 *
 * Node.js reads PNG files itself. JPEG and GIF files are first turned into PNG by the
 * computer: on a Mac by sips, which every Mac has; elsewhere by ImageMagick or by Python's
 * Pillow, whichever is installed. Run it from anywhere:
 *
 *   node paintings/hang.js
 *
 * The git hook in .githooks/ runs it before every commit, and adds to the commit what it
 * changed. Pictures it has already hung, unchanged since, are not read again (it remembers
 * them in paintings/.hang-cache.json, which is not published), so that takes but a moment.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const zlib = require('zlib'), crypto = require('crypto'), { spawnSync } = require('child_process');

const HERE = __dirname; // paintings/
const ROOT = path.dirname(HERE);
const ORIGINALS = path.join(HERE, 'originals'); // the pictures (not published)
const HUNG = path.join(HERE, 'compressed'); // the paintings, as the catalogue reads them
const INDEX = path.join(HERE, 'index.js'); // the list of the paintings
const CACHE = path.join(HERE, '.hang-cache.json'); // what was hung, so as not to read it again (not published)
const PICTURE = /\.(gif|jpe?g|png)$/i;
const quiet = process.argv.includes('--quiet');
const say = (...a) => { if (!quiet) console.log(...a); };

/* ---------------- the Library, as config.js describes it ---------------- */

function library() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), sandbox);
  const { Library } = require(path.join(ROOT, 'js', 'library.js'));
  return new Library(sandbox.window.BABEL_CONFIG);
}

/* ---------------- reading pictures ---------------- */

/** Every row of a PNG file's pixels, unfiltered (see the PNG specification, section 9). */
function unfilter(data, width, height, bpp, rowBytes) {
  const out = Buffer.alloc(height * rowBytes);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const type = data[p++], o = y * rowBytes, prev = o - rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const raw = data[p++];
      const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[prev + x] : 0, c = x >= bpp && y ? out[prev + x - bpp] : 0;
      let v;
      if (type === 0) v = raw;
      else if (type === 1) v = raw + a;
      else if (type === 2) v = raw + b;
      else if (type === 3) v = raw + ((a + b) >> 1);
      else if (type === 4) {
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`a row of the PNG file has an unknown filter (${type})`);
      out[o + x] = v & 255;
    }
  }
  return out;
}

/** A PNG file's pixels, 4 bytes each (red, green, blue, opacity): { width, height, rgba }. */
function readPNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('it is not a PNG file');
  let p = 8, ihdr = null, palette = null, alpha = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colour: data[9], interlace: data[12] };
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') alpha = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!ihdr) throw new Error('the PNG file has no header');
  const { width, height, depth, colour, interlace } = ihdr;
  if (interlace) throw new Error('interlaced PNG files cannot be read: save it again without interlacing');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
  if (!channels) throw new Error(`the PNG file has an unknown colour type (${colour})`);
  const bitsPerPixel = channels * depth, bpp = Math.max(1, bitsPerPixel >> 3), rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const raw = unfilter(zlib.inflateSync(Buffer.concat(idat)), width, height, bpp, rowBytes);
  const rgba = new Uint8Array(width * height * 4);
  const sample = (row, i) => { // the i-th sample of a row, scaled to a byte
    if (depth === 8) return raw[row + i];
    if (depth === 16) return raw[row + 2 * i];
    const per = 8 / depth, v = (raw[row + Math.floor(i / per)] >> (8 - depth * (1 + (i % per)))) & ((1 << depth) - 1);
    return colour === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
  };
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colour === 3) {
        const i = sample(row, x);
        rgba[o] = palette[i * 3]; rgba[o + 1] = palette[i * 3 + 1]; rgba[o + 2] = palette[i * 3 + 2];
        rgba[o + 3] = alpha && i < alpha.length ? alpha[i] : 255;
      } else if (colour === 0 || colour === 4) {
        const g = sample(row, x * channels);
        rgba[o] = rgba[o + 1] = rgba[o + 2] = g;
        rgba[o + 3] = colour === 4 ? sample(row, x * channels + 1) : 255;
      } else {
        for (let k = 0; k < 3; k++) rgba[o + k] = sample(row, x * channels + k);
        rgba[o + 3] = colour === 6 ? sample(row, x * channels + 3) : 255;
      }
    }
  }
  return { width, height, rgba };
}

/** A picture's pixels: PNG files directly, others once the computer has turned them into PNG. */
function readPicture(file) {
  if (/\.png$/i.test(file)) return readPNG(file);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'babel-')), png = path.join(dir, 'picture.png');
  const ways = [
    ['sips', ['-s', 'format', 'png', file, '--out', png]],
    ['magick', [file + '[0]', png]],
    ['convert', [file + '[0]', png]],
    ['python3', ['-c', 'import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert("RGBA").save(sys.argv[2])', file, png]],
  ];
  try {
    for (const [command, args] of ways) {
      const r = spawnSync(command, args, { stdio: 'ignore' });
      if (!r.error && r.status === 0 && fs.existsSync(png)) return readPNG(png);
    }
    throw new Error('this computer could not turn it into a PNG file: save it as PNG, or install ImageMagick or Pillow (pip3 install pillow)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* ---------------- the paintings ---------------- */

/** "Vincent van Gogh - The Starry Night (1889).jpg" → { artist, title, year }. */
function describe(file) {
  const name = file.replace(PICTURE, '').normalize('NFC');
  const m = /^(.+?)\s+-\s+(.+?)(?:\s*\(([^()]*)\))?$/.exec(name);
  if (!m) return { artist: '', title: name, year: '' };
  return { artist: m[1].trim(), title: m[2].trim(), year: (m[3] || '').trim() };
}

const sha1 = (data) => crypto.createHash('sha1').update(data).digest('hex');

function main() {
  if (!fs.existsSync(ORIGINALS)) {
    say('There is no paintings/originals folder here, so the paintings stay as they are.');
    return;
  }
  const lib = library(), P = lib.painting;
  if (!P) {
    console.error('With this configuration, no painting can hang in only one hexagon (see "Paintings" in README.md), so none is hung.');
    return;
  }
  const layout = `${P.width}x${P.height}x${lib.N}`;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { /* none yet */ }
  if (cache.layout !== layout) cache = { layout, pictures: {} };
  fs.mkdirSync(HUNG, { recursive: true });

  const files = fs.readdirSync(ORIGINALS).filter((f) => PICTURE.test(f) && !f.startsWith('.')).sort();
  const hung = [], kept = new Set();
  let added = 0;
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(ORIGINALS, file)), source = sha1(bytes);
    let entry = cache.pictures[file];
    if (!entry || entry.source !== source || !fs.existsSync(path.join(HUNG, entry.id + '.js'))) {
      let picture;
      try {
        picture = readPicture(path.join(ORIGINALS, file));
      } catch (e) {
        console.error(`${file} could not be read: ${e.message}`);
        continue;
      }
      const painting = lib.paintingOfImage(picture.rgba, picture.width, picture.height, { fit: 'fit' });
      if (!lib.placeOfPainting(painting)) throw new Error(`${file} did not become a painting of this Library`);
      const id = sha1(painting).slice(0, 20);
      const packed = zlib.deflateSync(Buffer.from(painting), { level: 9 }).toString('base64');
      fs.writeFileSync(path.join(HUNG, id + '.js'),
        `// ${file}, as a painting of this Library: ${P.width} × ${P.height} colour numbers, deflated, in base64. Written by paintings/hang.js.\n` +
        `BABEL_HANG_PAINTING(${JSON.stringify(id)}, ${P.width}, ${P.height}, ${lib.N}, ${JSON.stringify(packed)});\n`);
      entry = cache.pictures[file] = { source, id, width: picture.width, height: picture.height };
      added++;
      say(`Hung ${file} (${picture.width} × ${picture.height} pixels) as ${id}.`);
    }
    kept.add(entry.id);
    hung.push(Object.assign({ file }, describe(file), { id: entry.id }));
  }
  // paintings whose picture is gone, or has changed
  let removed = 0;
  for (const f of fs.readdirSync(HUNG)) {
    if (f.endsWith('.js') && !kept.has(f.slice(0, -3))) { fs.rmSync(path.join(HUNG, f)); removed++; }
  }
  for (const f of Object.keys(cache.pictures)) if (!files.includes(f)) delete cache.pictures[f];

  // the oldest first
  const when = (p) => { const m = /\d{3,4}/.exec(p.year); return m ? Number(m[0]) : 99999; };
  hung.sort((a, b) => when(a) - when(b) || a.title.localeCompare(b.title, 'en'));
  const index = '// The paintings of this Library, for the catalogue\'s "View painting".\n' +
    '// Written by hang.js, beside it, from the pictures in originals/: run it again whenever\n' +
    '// they change (the git hook in .githooks/ does, before every commit).\n' +
    `window.BABEL_PAINTINGS = [\n${hung.map((p) => JSON.stringify(Object.assign(p, { width: P.width, height: P.height, colours: lib.N }))).join(',\n')}\n];\n`;
  const old = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : '';
  if (old !== index) fs.writeFileSync(INDEX, index);
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  say(`${hung.length} paintings hung${added ? `, ${added} of them new or changed` : ''}${removed ? `; ${removed} taken down` : ''}.`);
}

main();
