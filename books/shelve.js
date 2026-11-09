#!/usr/bin/env node
/*
 * THE LIBRARY OF BABEL — shelving the collection
 *
 * Puts every book of books/uncompressed/ (Markdown .md files, or plain-text .txt files, which
 * are not published) on the Library's shelf, for the catalogue's "Browse books":
 *
 *   books/index.js             the list of the books: title, author, year, language, size
 *   books/compressed/<id>.js   each book's text, compressed, as a small script
 *
 * A Markdown book opens with its front matter, between two lines of three hyphens, which
 * names it and is not part of its text. Each property is written as its name, a colon right
 * after it, a space and its value:
 *
 *   ---
 *   author: Jorge Luis Borges
 *   lang: es
 *   title: La Biblioteca de Babel
 *   year: 1941
 *   ---
 *
 * The front matter is read strictly: a line it cannot read, such as "author : Borges" with a
 * space before the colon, is reported, and the book is left off the shelf until it is mended.
 * A property it leaves out comes from the file name, "Author - Title (Year).md", and lang,
 * the language, as a code such as en, fr or es (or a name), is shown in the list by name.
 *
 * The text after the front matter is shelved as it reads in print. The Library's books have
 * no italics, headings or notes in the margin, so the marks of emphasis are left out (*word*
 * becomes word), as are those of headings, quotations, links and code; a footnote's mark
 * becomes its number in brackets ([^1] becomes [1]), and so does the start of the note
 * itself ([^1]: at the start of a line). A plain-text book is shelved as it is, named by its
 * file name.
 *
 * A web page cannot look inside a folder, nor, when it is opened by double-click, read a
 * file beside it. It can load scripts, though. So the catalogue loads the list when "Browse
 * books" is first opened, and a book's script only when that book is chosen. A book's script
 * is named after a hash of its text, which is also its #book= link: it is written only when a
 * book is new or its text has changed, and removed when its book is gone.
 *
 * Run it from anywhere, with Node.js:
 *
 *   node books/shelve.js
 *
 * The git hook in .githooks/ runs it before every commit, and adds to the commit what it
 * changed. Books it has already shelved, unchanged since, are not read again (it remembers
 * them in books/.shelf-cache.json, which is not published), so that takes but a moment.
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

const HERE = __dirname; // books/
const TEXTS = path.join(HERE, 'uncompressed'); // the books, as Markdown or plain-text files (not published)
const SHELF = path.join(HERE, 'compressed'); // the books, as the catalogue reads them
const INDEX = path.join(HERE, 'index.js'); // the list of the books
const CACHE = path.join(HERE, '.shelf-cache.json'); // what was shelved, so as not to read it again (not published)

const MARKDOWN = ['.md', '.markdown'];
const KINDS = [...MARKDOWN, '.txt']; // the files that are books
const VERSION = 4; // of the way books are read: when it changes, every book is read again
const MAX_BYTES = 64 * 1024 * 1024; // larger files are left out, as the catalogue leaves them out
// Windows-1252 as browsers read it, from byte 0x80 to 0x9F: the five bytes it leaves
// undefined stand for themselves.
const CP1252 = '€\x81‚ƒ„…†‡ˆ‰Š‹Œ\x8dŽ\x8f' +
               '\x90‘’“”•–—˜™š›œ\x9džŸ';
// the names of the languages a front matter's lang may give by their codes (ISO 639)
const LANGUAGES = {
  af: 'Afrikaans', ar: 'Arabic', bg: 'Bulgarian', ca: 'Catalan', cs: 'Czech', cy: 'Welsh',
  da: 'Danish', de: 'German', el: 'Greek', en: 'English', eo: 'Esperanto', es: 'Spanish',
  et: 'Estonian', eu: 'Basque', fa: 'Persian', fi: 'Finnish', fr: 'French', ga: 'Irish',
  gl: 'Galician', grc: 'Ancient Greek', he: 'Hebrew', hi: 'Hindi', hr: 'Croatian',
  hu: 'Hungarian', id: 'Indonesian', is: 'Icelandic', it: 'Italian', ja: 'Japanese',
  ko: 'Korean', la: 'Latin', lt: 'Lithuanian', lv: 'Latvian', nb: 'Norwegian',
  nl: 'Dutch', nn: 'Norwegian', no: 'Norwegian', oc: 'Occitan', pl: 'Polish',
  pt: 'Portuguese', ro: 'Romanian', ru: 'Russian', sk: 'Slovak', sl: 'Slovenian',
  sr: 'Serbian', sv: 'Swedish', tl: 'Tagalog', tr: 'Turkish', uk: 'Ukrainian',
  yi: 'Yiddish', zh: 'Chinese',
};
// the characters a Markdown book may write by name, such as &mdash; (those of HTML 4, and &apos;)
const ENTITIES = {
  quot: 34, amp: 38, apos: 39, lt: 60, gt: 62, nbsp: 160, iexcl: 161, cent: 162, pound: 163,
  curren: 164, yen: 165, brvbar: 166, sect: 167, uml: 168, copy: 169, ordf: 170, laquo: 171,
  not: 172, shy: 173, reg: 174, macr: 175, deg: 176, plusmn: 177, sup2: 178, sup3: 179, acute: 180,
  micro: 181, para: 182, middot: 183, cedil: 184, sup1: 185, ordm: 186, raquo: 187, frac14: 188,
  frac12: 189, frac34: 190, iquest: 191, Agrave: 192, Aacute: 193, Acirc: 194, Atilde: 195,
  Auml: 196, Aring: 197, AElig: 198, Ccedil: 199, Egrave: 200, Eacute: 201, Ecirc: 202, Euml: 203,
  Igrave: 204, Iacute: 205, Icirc: 206, Iuml: 207, ETH: 208, Ntilde: 209, Ograve: 210, Oacute: 211,
  Ocirc: 212, Otilde: 213, Ouml: 214, times: 215, Oslash: 216, Ugrave: 217, Uacute: 218,
  Ucirc: 219, Uuml: 220, Yacute: 221, THORN: 222, szlig: 223, agrave: 224, aacute: 225, acirc: 226,
  atilde: 227, auml: 228, aring: 229, aelig: 230, ccedil: 231, egrave: 232, eacute: 233,
  ecirc: 234, euml: 235, igrave: 236, iacute: 237, icirc: 238, iuml: 239, eth: 240, ntilde: 241,
  ograve: 242, oacute: 243, ocirc: 244, otilde: 245, ouml: 246, divide: 247, oslash: 248,
  ugrave: 249, uacute: 250, ucirc: 251, uuml: 252, yacute: 253, thorn: 254, yuml: 255, OElig: 338,
  oelig: 339, Scaron: 352, scaron: 353, Yuml: 376, fnof: 402, circ: 710, tilde: 732, Alpha: 913,
  Beta: 914, Gamma: 915, Delta: 916, Epsilon: 917, Zeta: 918, Eta: 919, Theta: 920, Iota: 921,
  Kappa: 922, Lambda: 923, Mu: 924, Nu: 925, Xi: 926, Omicron: 927, Pi: 928, Rho: 929, Sigma: 931,
  Tau: 932, Upsilon: 933, Phi: 934, Chi: 935, Psi: 936, Omega: 937, alpha: 945, beta: 946,
  gamma: 947, delta: 948, epsilon: 949, zeta: 950, eta: 951, theta: 952, iota: 953, kappa: 954,
  lambda: 955, mu: 956, nu: 957, xi: 958, omicron: 959, pi: 960, rho: 961, sigmaf: 962, sigma: 963,
  tau: 964, upsilon: 965, phi: 966, chi: 967, psi: 968, omega: 969, thetasym: 977, upsih: 978,
  piv: 982, ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205, lrm: 8206, rlm: 8207,
  ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221,
  bdquo: 8222, dagger: 8224, Dagger: 8225, bull: 8226, hellip: 8230, permil: 8240, prime: 8242,
  Prime: 8243, lsaquo: 8249, rsaquo: 8250, oline: 8254, frasl: 8260, euro: 8364, image: 8465,
  weierp: 8472, real: 8476, trade: 8482, alefsym: 8501, larr: 8592, uarr: 8593, rarr: 8594,
  darr: 8595, harr: 8596, crarr: 8629, lArr: 8656, uArr: 8657, rArr: 8658, dArr: 8659, hArr: 8660,
  forall: 8704, part: 8706, exist: 8707, empty: 8709, nabla: 8711, isin: 8712, notin: 8713,
  ni: 8715, prod: 8719, sum: 8721, minus: 8722, lowast: 8727, radic: 8730, prop: 8733, infin: 8734,
  ang: 8736, and: 8743, or: 8744, cap: 8745, cup: 8746, int: 8747, there4: 8756, sim: 8764,
  cong: 8773, asymp: 8776, ne: 8800, equiv: 8801, le: 8804, ge: 8805, sub: 8834, sup: 8835,
  nsub: 8836, sube: 8838, supe: 8839, oplus: 8853, otimes: 8855, perp: 8869, sdot: 8901,
  lceil: 8968, rceil: 8969, lfloor: 8970, rfloor: 8971, lang: 10216, rang: 10217, loz: 9674,
  spades: 9824, clubs: 9827, hearts: 9829, diams: 9830,
};

/** A book the shelf cannot take as it is: says why, and where. */
class Unreadable extends Error {}

/** Its words, one space between them, as "a  b\n c" becomes "a b c". */
const words = (s) => s.split(/\s+/u).filter(Boolean).join(' ');
/** How many characters it has, an emoji or a rare letter written in two halves counting as one. */
const characters = (s) => { let n = 0; for (const _ of s) n++; return n; };
/** Two names in the order of their characters' numbers in Unicode, as "Z" before "a" before "é". */
const inOrder = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isFolder = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

/** A text file as the catalogue reads one: UTF-8, or Windows-1252 if it is clearly not UTF-8. */
function readBook(file) {
  const data = fs.readFileSync(file);
  const text = new TextDecoder('utf-8').decode(data); // without its byte-order mark, if it has one
  if (!text.includes('�')) return text;
  return data.toString('latin1').replace(/[\x80-\x9f]/g, (c) => CP1252[c.charCodeAt(0) - 0x80]);
}

/* ---------------------------------------------------------------- Markdown */

/**
 * The properties of a Markdown book's front matter, their names in small letters, and the
 * text after it. The front matter is the book's first lines, from a line of three hyphens
 * to the next. Each property is "name: value", the colon right after the name, a space after
 * it; a value may be in quotation marks, and a list ("[A, B]", or a line to each item, "  - A",
 * under its "name:") becomes "A and B", "A, B and C". Blank lines and comments (#) are
 * allowed. Anything else is not, and throws Unreadable.
 */
function frontMatter(text) {
  const lines = text.split('\n');
  if (lines[0].trimEnd() !== '---') {
    throw new Unreadable('it does not open with a front matter (a line of three hyphens, its properties, and another)');
  }
  const end = lines.findIndex((line, i) => i > 0 && line.trimEnd() === '---');
  if (end < 0) throw new Unreadable('its front matter has no end (a second line of three hyphens)');
  const unquote = (v) => v.length >= 2 && v[0] === v[v.length - 1] && `"'`.includes(v[0]) ? v.slice(1, -1) : v;
  const fields = new Map();
  let last = null;
  for (let number = 1; number < end; number++) {
    const line = lines[number].trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const prop = /^([A-Za-z][\p{L}\p{N}_-]*):(?: (.*))?$/su.exec(line);
    const item = /^[ \t]+- (.*)$/su.exec(line);
    if (prop) {
      last = prop[1].toLowerCase();
      let value = (prop[2] || '').trim();
      if (fields.has(last)) throw new Unreadable(`line ${number + 1} of its front matter gives "${last}" a second time`);
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((p) => p.trim()).filter(Boolean).map(unquote);
      }
      fields.set(last, typeof value === 'string' ? unquote(value) : value);
    } else if (item && last !== null && (fields.get(last) === '' || Array.isArray(fields.get(last)))) {
      fields.set(last, [...(fields.get(last) || []), unquote(item[1].trim())]); // an item of a list
    } else {
      let hint = '';
      const loose = /^\s*([A-Za-z][\p{L}\p{N}_-]*)\s*:\s*(.*)$/su.exec(line);
      if (loose) {
        hint = `; write it "${loose[1]}: ${loose[2]}"`;
        if (/^\s*[A-Za-z][\p{L}\p{N}_-]*\s+:/u.test(line)) hint += ', without a space before the colon';
        else if (/^\s/u.test(line)) hint += ', at the start of the line';
        else hint += ', with a space after the colon';
      }
      throw new Unreadable(`line ${number + 1} of its front matter, "${line.trim()}", is not a property${hint}`);
    }
  }
  for (const [k, v] of fields) {
    if (Array.isArray(v)) fields.set(k, v.length < 3 ? v.join(' and ') : v.slice(0, -1).join(', ') + ' and ' + v[v.length - 1]);
    else fields.set(k, words(v));
  }
  return { fields, body: lines.slice(end + 1).join('\n') };
}

/** A language's name from its code (es, fr, en-GB), or the name as given. */
function languageName(code) {
  code = code.trim();
  const base = code.split(/[-_]/)[0].toLowerCase();
  if (Object.hasOwn(LANGUAGES, base)) return LANGUAGES[base];
  const [first = '', ...rest] = code;
  return rest.length >= 3 ? first.toUpperCase() + rest.join('') : code;
}

/** The character an entity such as &mdash;, &#8212; or &#x2014; stands for, as browsers read it. */
function entity(ref) {
  const name = ref.slice(1, -1);
  if (name[0] !== '#') return Object.hasOwn(ENTITIES, name) ? String.fromCodePoint(ENTITIES[name]) : ref;
  const n = /^#[xX]/.test(name) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
  if (n === 0) return '�';
  if (n === 0x0d) return '\r';
  if (n >= 0x80 && n < 0xa0) return CP1252[n - 0x80]; // as if written in Windows-1252
  if ((n >= 0xd800 && n <= 0xdfff) || n > 0x10ffff) return '�';
  if (n < 0x09 || n === 0x0b || (n >= 0x0e && n <= 0x1f) || n === 0x7f || (n >= 0xfdd0 && n <= 0xfdef) ||
      (n & 0xfffe) === 0xfffe) return ''; // characters that are not meant to be in a text
  return String.fromCodePoint(n);
}

/**
 * A Markdown text as it reads in print, for a Library whose books have no italics: the
 * marks of emphasis, headings, quotations, links and code left out; footnotes numbered in
 * brackets; a rule between parts as three spaced asterisks. Paragraphs stay as they are,
 * a blank line between them, since that is how the catalogue tells them apart too.
 */
function markdownText(md) {
  // what is already as it should read, out of the way of what follows until the end
  const kept = [];
  const keep = (s) => '\0' + (kept.push(s) - 1) + '\0';

  const out = [];
  let fence = null;
  for (let line of md.split('\n')) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f && (fence === null || (f[1][0] === fence[0] && f[1].length >= fence.length))) {
      fence = fence ? null : f[1]; // code: kept as written
      continue;
    }
    if (fence) {
      out.push(keep(line));
      continue;
    }
    if (/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line)) { // a rule between parts
      out.push('', keep('* * *'), '');
      continue;
    }
    if (/^ {0,3}\[[^\]^][^\]]*\]:[ \t]*\S+/u.test(line)) continue; // where a link leads: not part of the text
    line = line.replace(/^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/su, '$1'); // a heading
    line = line.replace(/^ {0,3}#{1,6}[ \t]*$/, '');
    line = line.replace(/^ {0,3}(?:>[ \t]?)+/, ''); // a quotation
    // a footnote, where the notes are: [^1]: becomes [1]
    line = line.replace(/^ {0,3}\[\^([^\]\s]+)\]:[ \t]*/u, (m, id) => keep(`[${id}]`) + ' ');
    out.push(line);
  }
  let s = out.join('\n');

  const span = /(?:(?!\n[ \t]*\n)[\s\S])/.source; // anything but the end of a paragraph
  const all = (source, flags = '') => new RegExp(source, 'gu' + flags);
  s = s.replace(all(`(\`+)(${span}+?)\\1`), (m, ticks, code) => keep(words(code))); // code
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/gu, (m, c) => keep(c)); // escaped marks
  s = s.replace(/\[\^([^\]\s]+)\]/gu, (m, id) => keep(`[${id}]`)); // a footnote's mark
  s = s.replace(/!\[([^\]]*)\]\((?:[^()\s]|\([^()\s]*\))*(?:\s+"[^"]*")?\)/gu, '$1'); // a picture: its description
  s = s.replace(/\[([^\]]+)\]\((?:[^()\s]|\([^()\s]*\))*(?:\s+"[^"]*")?\)/gu, '$1'); // a link: its words
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/gu, '$1');
  s = s.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/gu, '$1');
  s = s.replace(/<br\s*\/?>/giu, '\n');
  s = s.replace(/<\/?(?:i|b|em|strong|u|s|del|sup|sub|small|span|cite|abbr|mark)\b[^>]*>/giu, '');
  // bold and italics, with asterisks or underscores (not within a word, for underscores);
  // a word's letters and digits are those of any script, as in "*Fábula*"
  const w = '\\p{L}\\p{N}_';
  for (let i = 0; i < 2; i++) {
    s = s.replace(all(`(\\*\\*|__)(?=\\S)(${span}+?)(?<=\\S)\\1`), '$2');
    s = s.replace(all(`(?<![*${w}])\\*(?=[^\\s*])(${span}+?)(?<=[^\\s*])\\*(?![*${w}])`), '$1');
    s = s.replace(all(`(?<![_${w}])_(?=[^\\s_])(${span}+?)(?<=[^\\s_])_(?![_${w}])`), '$1');
  }
  s = s.replace(all(`~~(?=\\S)(${span}+?)(?<=\\S)~~`), '$1');
  s = s.replace(/(?: {2,}|\\)\n/g, '\n'); // a line broken by hand
  // characters written as entities, such as &mdash; or &#8212;
  s = s.replace(/&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g, entity);
  for (let i = 0; i < 2; i++) s = s.replace(/\0(\d+)\0/g, (m, n) => kept[n]);
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim() + '\n';
}

/* ---------------------------------------------------------------- a book */

/** Title, author and year from a file name such as "Author - Title (1941).md", as the catalogue reads it. */
function describeName(name) {
  let title = words(name.replace(/\.(?:txt|md|markdown)$/i, '').replace(/_/g, ' '));
  let author = '', year = '';
  let match = /^(.*?)\s*\((\d{1,4})\)$/su.exec(title);
  if (match && match[1]) [title, year] = [match[1], match[2]];
  match = /^(.+?)\s+[—–-]\s+(.+)$/su.exec(title);
  if (match) [author, title] = [match[1], match[2]];
  return { title, author, year };
}

/**
 * A book's text, as it is shelved, and its entry in the list (without its shelf). Throws
 * Unreadable if it cannot be shelved as it is.
 */
function book(file) {
  const raw = readBook(file);
  const name = path.basename(file);
  let { title, author, year } = describeName(name);
  let language = '';
  let text = raw; // a plain-text book, as it is
  if (MARKDOWN.includes(path.extname(name).toLowerCase())) {
    // its letters composed (è, not e and a grave accent, as some editors save them), so
    // that it is counted and found as it reads
    const plain = raw.replace(/\r\n?/g, '\n').normalize('NFC');
    const { fields, body } = frontMatter(plain);
    text = markdownText(body);
    title = fields.get('title') || title;
    author = fields.get('author') || author;
    year = fields.get('year') || year;
    language = languageName(fields.get('lang') || '');
  }
  const nfc = (s) => s.normalize('NFC');
  return { text, entry: { file: nfc(name), title: nfc(title), author: nfc(author), year, language, characters: characters(text) } };
}

/* ---------------------------------------------------------------- the shelf */

function readJson(file, otherwise) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : otherwise;
  } catch {
    return otherwise;
  }
}

/**
 * Shelves what is new or changed in uncompressed/, and takes off the shelf what is gone, or
 * cannot be read. Returns whether anything changed.
 */
function shelve(quiet = false) {
  const isBook = (name) => KINDS.includes(path.extname(name).toLowerCase()) && !name.startsWith('.') &&
    isFile(path.join(TEXTS, name));
  const names = isFolder(TEXTS) ? fs.readdirSync(TEXTS).filter(isBook).sort(inOrder) : [];
  if (!names.length) {
    // on a copy of the Library without the books' texts, the shelf is left as it is
    if (!quiet) console.log(`There are no books (.md or .txt files) in ${TEXTS}, so the shelf is left as it is.`);
    return false;
  }
  fs.mkdirSync(SHELF, { recursive: true });
  const remembered = readJson(CACHE, {});
  const cache = remembered.version === VERSION && remembered.books ? remembered.books : {};
  const seen = {}, entries = [], kept = new Set(), tooBig = [], unreadable = [];
  let read = 0, written = 0;
  for (const name of names) {
    const file = path.join(TEXTS, name);
    const stat = fs.statSync(file, { bigint: true });
    const size = Number(stat.size), mtime = String(stat.mtimeNs); // to the nanosecond, so as a string
    if (size > MAX_BYTES) {
      tooBig.push(name);
      continue;
    }
    const known = Object.hasOwn(cache, name) ? cache[name] : null;
    let entry;
    if (known && known.size === size && known.mtime === mtime && known.entry &&
        isFile(path.join(SHELF, `${known.entry.shelf}.js`))) {
      entry = known.entry; // unchanged since it was last shelved
    } else {
      read++;
      let text;
      try {
        ({ text, entry } = book(file));
      } catch (why) {
        if (!(why instanceof Unreadable)) throw why;
        unreadable.push(`${name}: ${why.message}`);
        continue;
      }
      const data = Buffer.from(text, 'utf8');
      const key = crypto.createHash('sha256').update(data).digest('hex').slice(0, 20);
      const target = path.join(SHELF, `${key}.js`);
      if (!isFile(target)) {
        const packed = zlib.deflateSync(data, { level: 9 }).toString('base64');
        const partial = path.join(SHELF, `${key}.partial`);
        fs.writeFileSync(partial, `BABEL_SHELF_BOOK("${key}","${packed}");\n`, 'ascii');
        fs.renameSync(partial, target);
        written++;
      }
      entry.shelf = key;
    }
    seen[name] = { size, mtime, entry };
    kept.add(`${entry.shelf}.js`);
    const { file: f, title, author, year, language, characters: count, shelf } = entry;
    entries.push({ file: f, title, author, year, language, characters: count, shelf });
  }
  // the books that are gone, or cannot be read, and anything left over from shelving that was interrupted
  let removed = 0;
  for (const name of fs.readdirSync(SHELF)) {
    if (!['.js', '.partial'].includes(path.extname(name)) || kept.has(name)) continue;
    try {
      fs.unlinkSync(path.join(SHELF, name));
      removed++;
    } catch (err) {
      console.log(`Could not remove ${name}, which no book needs any more: ${err.message}`);
    }
  }
  entries.sort((a, b) => inOrder(a.title.toLowerCase(), b.title.toLowerCase()) || inOrder(a.file, b.file));
  // one book to a line, in ASCII, its other characters written as \u escapes
  const ascii = (json) => json.replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const lines = entries.map((e) => ascii(JSON.stringify(e))).join(',\n');
  const index = '// The books of this Library, for the catalogue\'s "Browse books".\n' +
    '// Written by shelve.js, beside it, from the books (.md or .txt files) in uncompressed/:\n' +
    '// run it again whenever they change (the git hook in .githooks/ does, before every commit).\n' +
    `window.BABEL_BOOKS = [\n${lines}\n];\n`;
  const listed = !isFile(INDEX) || fs.readFileSync(INDEX, 'utf8') !== index;
  if (listed) fs.writeFileSync(INDEX, index, 'utf8');
  const memory = JSON.stringify({ version: VERSION, books: seen });
  if (memory !== JSON.stringify(remembered)) fs.writeFileSync(CACHE, memory, 'utf8');
  const changed = Boolean(written || removed || listed);
  if (changed || !quiet) {
    let size = 0;
    for (const name of kept) size += fs.statSync(path.join(SHELF, name)).size;
    const mb = (size / 1e6).toFixed(1).replace(/\B(?=(\d{3})+\.)/g, ',');
    console.log(`Shelved ${entries.length} books (${written} new or changed, ${removed} removed, ` +
      `${read} read again), ${mb} MB in books/compressed/.`);
  }
  if (tooBig.length) console.log('Left out, being larger than 64 MB: ' + tooBig.join(', '));
  if (unreadable.length) {
    // said even with --quiet: these books are not on the shelf until they are mended
    console.log('Left out until mended:\n' + unreadable.map((u) => '  ' + u).join('\n'));
  }
  return changed;
}

module.exports = { book, describeName, frontMatter, languageName, markdownText, shelve };

if (require.main === module) shelve(process.argv.includes('--quiet'));
