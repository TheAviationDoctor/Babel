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

  // The symbols books are written in, in this order. Each one must appear once.
  // Here: the 26 letters, then colon, comma, exclamation mark, period, question
  // mark, and finally a space (the last character between the quotes).
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + ':,!.?' + ' ',

  hexagon: {
    wallsWithShelves: 4, // 1 to 4: the other two sides of each hexagon are its doors
    shelvesPerWall: 4,
    booksPerShelf: 32,
  },
};
