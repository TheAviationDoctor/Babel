#!/usr/bin/env node
/*
 * THE LIBRARY OF BABEL — stamps index.html with the version of every file the page loads: a
 * hash of the file's contents, after `?v=` (as in js/main.js?v=3f9c0a1b2d). Browsers, and GitHub
 * Pages, keep copies of files for a while; a file with a new version is fetched again, and a
 * file without one is not, so a change brings only the files it touched.
 *
 * Files the page loads later, as it needs them (the lists of the collection's books and
 * paintings, and the dictionary of Find words), have their versions written into the page too,
 * as window.BABEL_VERSIONS, which js/terminal.js and js/words.js read.
 *
 * The git hook (.githooks/pre-commit) runs it before every commit. To run it yourself, from the
 * repository's folder:
 *
 *   node stamp.js            stamps index.html
 *   node stamp.js --check    only says whether index.html is stamped as it should be
 *   node stamp.js --quiet    says nothing unless something goes wrong
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PAGE = path.join(ROOT, 'index.html');
// the files loaded later, as they are needed
const LATER = ['books/index.js', 'paintings/index.js', 'words/english.js'];

const args = process.argv.slice(2);
const quiet = args.includes('--quiet'), check = args.includes('--check');

/** The version of a file: the first ten hexadecimal digits of the SHA-256 hash of its contents. */
function version(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 10);
}

const before = fs.readFileSync(PAGE, 'utf8');
const missing = [];

// the page's own scripts and style sheets (not those of other sites)
let html = before.replace(/\b(src|href)="([^":?#]+\.(?:js|css))(?:\?v=[^"]*)?"/g, (whole, attr, file) => {
  if (!fs.existsSync(path.join(ROOT, file))) { missing.push(file); return whole; }
  return `${attr}="${file}?v=${version(file)}"`;
});

// the files loaded later, in a script of their own just before the page's first one
const later = {};
for (const file of LATER) if (fs.existsSync(path.join(ROOT, file))) later[file] = version(file);
const block = `<script id="versions">window.BABEL_VERSIONS = ${JSON.stringify(later)};</script>`;
if (/<script id="versions">.*?<\/script>/.test(html)) html = html.replace(/<script id="versions">.*?<\/script>/, block);
else html = html.replace(/<script src=/, `${block}\n<script src=`);

for (const file of missing) console.error(`stamp.js: index.html loads ${file}, which is not there.`);
if (check) {
  if (html !== before) { console.error('stamp.js: index.html is not stamped with the versions of its files: run node stamp.js.'); process.exit(1); }
  if (!quiet) console.log('index.html is stamped with the versions of its files.');
  process.exit(missing.length ? 1 : 0);
}
if (html !== before) fs.writeFileSync(PAGE, html);
if (!quiet) console.log(html !== before ? 'Stamped index.html with the versions of its files.' : 'index.html was already stamped.');
process.exit(missing.length ? 1 : 0);
