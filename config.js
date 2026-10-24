/*
 * THE LIBRARY OF BABEL — world configuration
 *
 * Edit the values below, save, and reload the page. They are read once, when the
 * Library is built. Every combination of values describes a different Library;
 * the same values always describe the same one.
 */
window.BABEL_CONFIG = {
  // Arranges the books on the shelves. Any word or number; the same seed always
  // gives the same Library, and everyone who visits it finds every book in the same place.
  seed: 'borges',

  book: {
    pagesPerBook: 512,
    linesPerPage: 32,
    charactersPerLine: 64,
  },

  // The symbols books are written in, in this order. Each one must appear once, and
  // there may be up to 256 of them.
  //
  // Here, 64 symbols: the 26 letters, in capitals only (as in Borges's story, the Library
  // has no lower case), the ten digits, 27 punctuation marks and signs, and the space last.
  // The marks are those that classic literature uses: period, comma, semicolon, colon,
  // exclamation and question marks, apostrophe, quotation mark, hyphen, long dash,
  // parentheses, square brackets, underscore (plain-text editions mark italics with it),
  // asterisk, ampersand, slash, dollar, percent, pound sterling, degree, dagger, section,
  // number sign, plus and equals.
  //
  // When the catalogue sets a text, small letters become capitals, accents are dropped,
  // -- becomes —, and other characters become their nearest equivalents (Æ becomes AE,
  // ½ becomes 1/2, curly quotation marks become straight ones) or, failing that, are left out.
  //
  // Any string of distinct characters works. For all 128 characters of ASCII, for example:
  //   alphabet: Array.from({ length: 128 }, (_, code) => String.fromCharCode(code)).join(''),
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789' + '.,;:!?\'"-—()[]_*&/$%£°†§#+=' + ' ',

  // Where this Library is published. Links copied from the catalogue lead there, so that
  // they work for anyone, wherever they were copied from (this computer included).
  website: 'https://babel.pellegr.in/',

  hexagon: {
    wallsWithShelves: 4, // 1 to 4: the other two sides of each hexagon are its doors
    shelvesPerWall: 4,
    booksPerShelf: 32,
  },

  // How the reader sees the Library.
  view: {
    lookSensitivity: 1, // how fast the view turns with the mouse, from 0.1 to 5
    fieldOfView: 72, // how wide the view is, in degrees, from 30 to 120
  },
};
