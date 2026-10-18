/*
 * THE LIBRARY OF BABEL — world configuration
 *
 * Edit the values below, save, and reload the page. They are read once, when the
 * Library is built. Every combination of values describes a different Library;
 * the same values always describe the same one.
 */
window.BABEL_CONFIG = {
  // Arranges the books on the shelves. Any word or number; the same seed always
  // gives the same Library. It can also be changed from the title screen.
  seed: 'borges',

  book: {
    pagesPerBook: 512,
    linesPerPage: 32,
    charactersPerLine: 64,
  },

  // The symbols books are written in, in this order. Each one must appear once, and
  // there may be up to 256 of them.
  //
  // Here: all 128 characters of ASCII, in the order of their codes, 0 to 127. Besides
  // the letters in both cases, the digits, punctuation and the space, ASCII has 33
  // control characters, such as tab and line feed, which have no printed form. Books
  // show each of them as a small symbol of its own: ␀ ␁ ␂ … ␟ for codes 0 to 31, ␡ for 127.
  //
  // Any string of distinct characters works too. For example, 26 capitals, a few
  // punctuation marks and the space:
  //   alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + ':,!.?' + ' ',
  alphabet: Array.from({ length: 128 }, (_, code) => String.fromCharCode(code)).join(''),

  hexagon: {
    wallsWithShelves: 4, // 1 to 4: the other two sides of each hexagon are its doors
    shelvesPerWall: 4,
    booksPerShelf: 32,
  },
};
