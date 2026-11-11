/*
 * Words: the real words that chance has written in the Library's books. The reader's "Find
 * words" makes them glow on the page, the longer the brighter. Every page is chance, so they
 * are rare, and the longer the rarer: with the default alphabet, a book holds some 130 words
 * of four letters, about one every other spread; one of five letters turns up once in some
 * sixty spreads, one of six about once in a dozen books, and one of seven once in hundreds.
 *
 * A word is one of some 34,000 common English words of four to eight letters (in
 * words/english.js, from SCOWL), written in a single line whatever its capitals, so that
 * "tReE" is the word tree. Where two words overlap, the longer is kept.
 *
 * Only in books drawn by chance: a book in which the Catalogue, or a link, has laid a text
 * is full of words by design, so the reader does not look for them there (BabelWords.written).
 *
 * BabelWords.load() reads the list of words (in the browser, the first time it is needed);
 * BabelWords.inBook(lib, content) then gives every word of a book, in order.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BabelWords = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SHORTEST = 4;
  const LIST = 'words/english.js?v=1';
  let words = null; // the words, once read
  let longest = 0;
  let loading = null;

  /** Takes the list of words as words/english.js gives it: for each length, the words one after the other. */
  function use(data) {
    const set = new Set();
    let most = 0;
    for (const [k, run] of Object.entries(data)) {
      const n = Number(k);
      for (let i = 0; i + n <= run.length; i += n) set.add(run.slice(i, i + n));
      most = Math.max(most, n);
    }
    words = set;
    longest = most;
  }

  /** Reads the list of words, as a script beside the page (which a page opened by double-click may load). */
  function load() {
    if (words) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = LIST;
        script.onload = () => {
          script.remove();
          if (!window.BABEL_WORDS) { loading = null; reject(new Error('the list of words is not what was expected')); return; }
          use(window.BABEL_WORDS);
          delete window.BABEL_WORDS;
          resolve();
        };
        script.onerror = () => { script.remove(); loading = null; reject(new Error('the list of words could not be read')); };
        document.head.appendChild(script);
      });
    }
    return loading;
  }

  /**
   * Whether a book was written rather than drawn by chance: in a book drawn by chance every
   * symbol is about as common as every other, whereas a text laid in a book by the Catalogue
   * or a link is followed by blank pages, so one symbol (the space) is far more common.
   */
  function written(lib, content) {
    const N = lib.glyphs.length, counts = new Uint32Array(N);
    for (let i = 0; i < content.length; i++) counts[content[i]]++;
    let most = 0;
    for (let s = 0; s < N; s++) if (counts[s] > most) most = counts[s];
    return most > (4 * content.length) / N;
  }

  /**
   * Every word of a book, in order: { at (the position of its first symbol in the book),
   * length, word (in small letters) }. Words are looked for within each line, in its runs of
   * letters; where two overlap, the longer is kept (the first, if they are as long).
   */
  function inBook(lib, content) {
    if (!words) throw new Error('the list of words has not been read');
    const perLine = lib.config.charactersPerLine;
    const letter = lib.glyphs.map((g) => (/^[A-Za-z]$/.test(g) ? g.toLowerCase() : ''));
    const found = [];
    for (let line = 0; line < content.length; line += perLine) {
      const end = Math.min(content.length, line + perLine);
      let i = line;
      while (i < end) {
        if (!letter[content[i]]) { i++; continue; }
        let j = i + 1;
        while (j < end && letter[content[j]]) j++;
        if (j - i >= SHORTEST) inRun(content, i, j, letter, found);
        i = j;
      }
    }
    return found;
  }

  /** The words in a run of letters, from `from` to `to`, added to `found`. */
  function inRun(content, from, to, letter, found) {
    const candidates = [];
    for (let s = from; s + SHORTEST <= to; s++) {
      let t = '';
      for (let k = s; k < to && k - s < longest; k++) {
        t += letter[content[k]];
        if (t.length >= SHORTEST && words.has(t)) candidates.push({ at: s, length: t.length, word: t });
      }
    }
    if (!candidates.length) return;
    candidates.sort((a, b) => b.length - a.length || a.at - b.at);
    const kept = [];
    for (const c of candidates) {
      if (kept.every((k) => c.at + c.length <= k.at || k.at + k.length <= c.at)) kept.push(c);
    }
    kept.sort((a, b) => a.at - b.at);
    for (const k of kept) found.push(k);
  }

  return { SHORTEST, use, load, written, inBook, ready: () => !!words };
});
