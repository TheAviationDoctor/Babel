# Babel

A walkable rendering of Jorge Luis Borges's short story *The Library of Babel* (1941). The Library is generated from a seed, and every possible book stands on exactly one of its shelves. You can wander its galleries, climb its stairs, take down any volume and read it.

## Playing

Open `index.html` in a recent browser (Chrome, Edge, Firefox or Safari). Double-clicking the file works; nothing needs installing. To put it online, turn on GitHub Pages for this repository (Settings → Pages → Deploy from a branch → `main`, folder `/`). It will then be served at `https://theaviationdoctor.github.io/Babel/`.

| | |
|---|---|
| Look | mouse (click once to capture it) |
| Walk | `W` `A` `S` `D` or the arrow keys |
| Hurry | hold `Shift` |
| Take down the book you are looking at | `E` or click |
| Open or close the door you are looking at | `E` or click |
| Use the catalogue (the screen in the niche opposite the cell) | `E` or click |
| Turn pages | `←` `→`, `Page Up` `Page Down`, `Home` `End` |
| Put the book back | `Esc` or `E` |
| Pause | `Esc` or `P` |

On a phone or tablet, drag on the right of the screen to look, hold and slide on the left to walk, and tap a book, a door or the catalogue.

The two typefaces load from Google Fonts. Without an internet connection the game still runs, with system fonts.

## Configuration

Everything about the Library's size lives in `config.js`, which is read once when the page loads. Edit it in any text editor, save, and reload the page.

| Setting | Default | Meaning |
|---|---|---|
| `seed` | `'borges'` | Decides which book stands on which shelf. The same seed always gives the same Library. It can also be changed from the title screen and the pause menu. |
| `book.pagesPerBook` | 512 | |
| `book.linesPerPage` | 32 | |
| `book.charactersPerLine` | 64 | |
| `alphabet` | 26 letters, ten digits, then `:` `,` `!` `.` `?` `;` `-` `(` `)` `'` `"` and space | The symbols books are written in, in order. Each must appear once, at most 256 symbols. |
| `hexagon.wallsWithShelves` | 4 | 1 to 4. The other two sides of every hexagon are its doors. |
| `hexagon.shelvesPerWall` | 4 | |
| `hexagon.booksPerShelf` | 32 | |

A book may hold up to 16,777,216 characters and a hexagon up to 65,536 books. The rooms are built to fit: the number of books per shelf sets the width of each hexagon, and the number of shelves sets the height of its ceiling. If a value is invalid or a setting's name is misspelt, the page says which one and why.

Any change to these values, the seed included, gives a different Library: an address copied before then no longer leads to the same books.

Borges's own figures would be 410 pages, 40 lines, 80 characters, a 25-symbol alphabet, and 4 walls of 5 shelves of 32 books. They work too.

## How the Library is built

With the default configuration a book holds 512 × 32 × 64 = 2²⁰ = 1,048,576 characters from an alphabet of 48 symbols. There are therefore 48^(2²⁰) possible books, about 10^1,762,909. Each hexagon holds 4 × 4 × 32 = 2⁹ = 512 of them, so the Library has about 10^1,762,906 hexagons.

**Addresses.** Every shelf position has an index *v* between 0 and *N*^*M* − 1 (*N* symbols, *M* characters per book), written as *M* base-*N* digits. It decomposes as

    v = hexagon × S + slot              (S books per hexagon; slot = wall, shelf, volume)
    hexagon = floor × L + gallery       (L = N^m galleries per floor)

so each hexagon has a floor number and a gallery number, each about half a million symbols long. By default there are 48^524,287 hexagons along every gallery, about 10^881,452, and 48^524,289 / 512 floors, about 10^881,453. The pause menu shows the current hexagon's address, written in the Library's own alphabet, and can copy it in full.

**Contents.** The book at index *v* is obtained by a permutation of the space of all books, keyed by the seed: a four-round Feistel network on the book's two halves. Each round adds, symbol by symbol and modulo *N*, a pseudorandom stream generated from a hash of the other half. A Feistel network can be run backwards whatever its round functions are, so the map from shelf to contents is a bijection. No two shelves hold the same book and no possible book is missing. Neighbouring books share nothing visible. Opening one takes a few tens of milliseconds, and all the arithmetic on the huge numbers is done digit by digit, without big-integer multiplication.

Because the map can be inverted, any text can be located: `findText` in `js/library.js` returns the hexagon, wall, shelf, volume and page of a book containing any given passage. The catalogue in every vestibule uses it (see below).

**Shape.** Both the galleries and the floors wrap around: walk east for 48^524,287 hexagons and you are back where you started. The Library is finite, and from inside it has no edge. This is close to the hypothesis the narrator offers at the end of the story. When the number of books is not a multiple of the books per hexagon, as with Borges's figures, the very last hexagon is only partly filled.

**Cosmetics.** Spine colours and the letters on the spines come from a separate hash of the hexagon's address. They are not part of the bijection and, as in the story, they say nothing about what the pages contain.

## Architecture

The story leaves room for interpretation. This version reads it as follows.

- The hexagons are identical. Four sides carry shelves floor to ceiling, and the ceiling is a little above a librarian's head.
- The two free sides are opposite each other, so every floor is a single straight gallery of hexagons running east and west.
- Each free side opens onto a narrow vestibule leading to the next hexagon. It has a door on each side, a mirror, and a spiral stair that climbs and descends through every floor.
- Borges gives the vestibule two very small closets, one to sleep in standing up and one for bodily needs. Here the south door opens into a single cell of 2.2 × 2.1 m that serves both purposes. It holds a single bed, a small table fixed to the wall with a night lamp, a toilet, and a sink with a mirror. The north door stays shut. The cell sits in the wedge of space between two neighbouring hexagons. That wedge is about 4 m wide beside the vestibule and widens further away, so the cell fits whatever the size of the hexagons.
- Opposite the cell, the north door now gives onto a shallow niche holding a touchscreen: the catalogue (see below). It is the one thing in the Library that Borges did not put there, and it glows with a cooler light than the lamps.
- In the middle of each hexagon an air shaft, with a very low railing, shows the floors above and below.
- Two spherical lamps hang in each hexagon, placed across the gallery. They are the only light.

## The catalogue

Every vestibule has one. It does three things.

**Find a text.** Type or paste anything into it. Accents are removed, lower-case letters are read as capitals, line breaks become spaces, curly quotation marks and long dashes become plain ones, and characters that are not in the alphabet are left out (the screen lists them). The catalogue then runs the shelving backwards. It composes the book that begins with your text, with the rest of the book either random characters or blank, and the inverse permutation gives the hexagon, wall, shelf and volume where that book stands. Since every possible book exists exactly once, it is certainly there. It is also almost always astronomically far away, so the screen gives the distance as a power of ten. You can read the book on the spot, with your text highlighted, copy its address, or go there: you are set down in front of it, and the volume stands a little out of its row.

**Find a book.** The catalogue can also find a whole book: any plain-text file in the `books` folder. It sets the text in pages, the way a book of this Library holds them: a title page with the title, author and year, then the text at 64 characters to a line and 32 lines to a page, with words kept whole and each paragraph starting on a new, indented line. The rest of the 512 pages are blank (or random characters, if you prefer). It then finds the one book of the Library that holds exactly those pages, and you can read it on the spot or go and take it down from its shelf. A text longer than one book is set in several parts, each with its own title page, and each part is found separately.

**Go to a hexagon.** Move any number of hexagons east or west and floors up or down. Paste a full address, as copied from the pause menu or the catalogue, to return to a hexagon you have bookmarked, even after closing the page. Or go somewhere at random. After a jump, the corner of the screen counts your steps from where you arrived.

## Your books

To add a book, save it as a plain-text file (`.txt`, preferably UTF-8) in the `books` folder, named `Author — Title (Year).txt`. The catalogue reads the title, author and year from the name; any other name is used as the title. Leave a blank line between paragraphs. If there are no blank lines, each line is taken as a paragraph, and a file written on a single line is set as one long paragraph.

A page opened straight from your computer is not allowed to look into folders by itself, so the first time, press **Open the books folder** in the catalogue and choose the `books` folder. Browsers word this as "uploading" the files, but they are only read by the page and never leave your computer. The catalogue then remembers the books in this browser, even after the page is closed, until you press **Forget these books**. After adding or changing a book, open the folder again. On a phone or tablet, use **Choose book files** instead.

## Files

| Path | Contents |
|---|---|
| `index.html` | The page |
| `config.js` | The configuration |
| `css/style.css` | Title screen, reading view and menus |
| `js/library.js` | The mathematics: addresses, the bijection, text search, setting books in pages. No graphics. |
| `js/architecture.js` | Dimensions, geometry and lighting of hexagons, vestibules, stairs and cells |
| `js/world.js` | Streams the hexagons around the reader and dresses their books |
| `js/player.js` | Walking, the spiral stair, and picking a book, door or catalogue by gaze |
| `js/terminal.js` | The catalogue's screen: finding texts and books, and going to hexagons |
| `js/textures.js` | Wood, plaster, stone, floor tiles and leather spines, painted at start-up |
| `js/main.js` | Start-up, reading, pause menu |
| `lib/` | three.js r147 and its `Reflector` (MIT licence, see `lib/three.LICENSE`) |
| `tests/library.test.js` | Tests of the mathematics |
| `books/` | Your own books, as `.txt` files, for the catalogue to find |

## Tests

With Node.js installed, run `node tests/library.test.js`. The tests enumerate every shelf of three small libraries and check that each holds a different book and that the inverse map finds every book again. They then check round trips, text search and timing on the Library described by `config.js`, and on Borges's own figures, and finally the catalogue: preparing texts, setting whole books in pages and splitting long ones into parts, finding them in books, distances that wrap around the Library, and reading back copied addresses.

## Credits

The story itself is not reproduced here. 3D rendering uses [three.js](https://threejs.org). Typefaces are Libre Bodoni and Courier Prime, from Google Fonts, under the SIL Open Font License.
