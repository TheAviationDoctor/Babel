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
  // Here, 128 symbols, chosen by counting every character of the books of the collection:
  // the 26 letters, in capitals and in small letters; the accented letters of French
  // (à â æ ç é è ê ë î ï ô œ ù û ü) and Spanish (á í ó ú ñ), the umlauts ä and ö, and the
  // five accented capitals that most often begin a word (À Ç É Æ Œ); the ten digits; the
  // 27 marks and signs of the Library's first alphabet (period, comma, semicolon, colon,
  // exclamation and question marks, apostrophe, quotation mark, hyphen, long dash,
  // parentheses, square brackets, underscore, asterisk, ampersand, slash, dollar, percent,
  // pound sterling, degree, dagger, section, number sign, plus and equals); curly
  // quotation marks, guillemets, the inverted marks of Spanish, the en dash, the half and
  // the multiplication sign; and the space last.
  //
  // When the catalogue sets a text, letters keep their case, and their accents where the
  // alphabet has them; other letters lose their accents (Ê becomes E). -- becomes —, and
  // other characters become their nearest equivalents (ß becomes ss, … becomes ..., ¼
  // becomes 1/4) or, failing that, are left out. In an alphabet of capitals only, small
  // letters become capitals.
  //
  // Any string of distinct characters works. The Library's first alphabet had 64 symbols,
  // the letters in capitals only (as in Borges's story, it had no lower case):
  //   alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789' + '.,;:!?\'"-—()[]_*&/$%£°†§#+=' + ' ',
  // All 128 characters of ASCII, control characters included:
  //   alphabet: Array.from({ length: 128 }, (_, code) => String.fromCharCode(code)).join(''),
  alphabet:
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    'abcdefghijklmnopqrstuvwxyz' +
    'ÀÇÉÆŒ' + 'àâæçéèêëîïôœùûü' + 'áíóúñ' + 'äö' +
    '0123456789' +
    '.,;:!?\'"-—()[]_*&/$%£°†§#+=' +
    '‘’“”«»¿¡–½×' +
    ' ',

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

  // What the reader dreams when they lie down on the bed of a cell: words that fade in
  // over the dream, one sentence after another.
  dreams: {
    quoteDuration: 10, // how long each sentence stays, in seconds, from 1 to 600
    quoteInterval: 5, // how long until the next one, in seconds, from 0 to 600
  },
};
