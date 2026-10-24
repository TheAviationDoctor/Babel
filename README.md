# Babel

A Web-based walkable rendering of Jorge Luis Borges's short story *The Library of Babel* (1941). The Library is deterministically generated from a seed, and every possible book no longer than 512 pages exists exactly once on its shelves somewhere, which makes the Library finite too (although extremely large). You can wander its galleries, climb its stairs, take down any volume, and read it. You can also use the catalogue to search for specific strings or even locate literature classics, and be teleported to that gallery.

Every text ever written, including your own life story, as well as every text *never* written, is contained somewhere in the Library.

## Getting started

Everything is pure HTML/JS/CSS, so nothing needs installing. Just visit the Library online at https://theaviationdoctor.github.io/Babel/, or download the repo and open `index.html` locally in a recent browser (Chrome, Edge, Firefox, or Safari). It even runs offline (except for a couple of Google Fonts which will then revert to your browser's defaults).

| | |
|---|---|
| Look | mouse (click once to capture it) |
| Walk | `W` `A` `S` `D` or the arrow keys |
| Hurry | hold `Shift` |
| Interact with objects (books, catalogue, doors, lamps) | `E` or click |
| Turn pages | `←` `→`, `Page Up` `Page Down`, `Home` `End` |
| Put the book back | `Esc` or `E` |
| Pause | `Esc` or `P` |

On a phone or tablet, drag on the right of the screen to look, hold and slide on the left to walk, and tap to interact with objects.

## Is the Library infinite?

No. The library is *finite*, meaning it has a fixed number of books (each one unique), hexagons, and floors. But it is *boundless* (it has no hard boundary) because it is *cyclic* in both directions. Walk past the last hexagon of a floor, or take the stairs up or down to the last floor, and you are back at the first, just like an ant walking endlessly on the surface of a torus (which the Library is, topologically speaking).

## So how big is the Library?

With the default settings:

- Each book holds `2^5 = 32` characters per line, `2^6 = 64` lines per page, and `2^9 = 512` pages. That's a total of `2^20 = 1,048,576` characters per book. That's probably about twice the length of a typical English novel, which gives plenty of headroom to capture most books ever published.

- The alphabet contains `2^6 = 64` symbols (`26` uppercase letters A–Z, `10` digits 0–9, and `28` punctuation marks). That's exactly half as many symbols as the ASCII set, but this parsimonious choice was empirically tested and verified to represent virtually every one of the 11.7 million characters sampled across 18 public-domain classics from the Gutenberg website.

- There are therefore `64^(2^20) = 2^6,291,456 ≈ 9.38 × 10^1,893,916` unique books in the Library (which does not contain duplicates). That's one followed by nearly two million zeros. If you kept repeating the word 'trillion' once per second, it would take you nearly 44 hours to verbalize that number.

- Each hexagonal room holds `2^2 = 4` bookshelves of `2^2 = 4` shelves each and `2^5 = 32` books per shelf. That's a total of `2^9 = 512` books per hexagon. So, the Library has `2^6,291,456 / 2^9 = 2^6,291,447 ≈ 1.83× 10^1,893,914` hexagons. Barely two order of magnitude fewer hexagons than books.

- For perspective: there are about `10^80` atoms in the observable universe. Imagine every atom contained an entire universe, each with just as many atoms as ours. Then imagine every atom in that nested universe contained another universe, etc. You would need nearly 24,000 levels of nested universes before the *cumulative* number of atoms reached the number of books or hexagons in the Library.

- To balance the horizontal and vertical coordinates within the Library, the hexagons are split about evenly along the east-west gallery and vertically across the floors. There are `2^3,145,722 ≈ 4.79 × 10^946,956` hexagons per floor and `2^3,145,725 ≈ 3.83 × 10^946,957` floors.

- Technically, a floor is only 2.61 meters high against 8.83 meters in length per hexagon, but there are 8 times as many floors as hexagons per floor, so the Library is about 2.4 times taller than it is long. Each floor's gallery is `4.2 × 10^946,957` meters long from east to west and the Library is `1.0 × 10^946,958` meters tall.

- For perspective: our observable universe is only `8.7 × 10^26` meters across, so `1.1 × 10^946,931` of them could fit on top of each other in the Library.

- Conveniently, the doorways line up on one straight east-west axis along each gallery, and the air shafts line up vertically through every floor. So one could shine a laser through both and (ignoring dissipation and slightly slower speed from the air medium) measure how long it would take for light to come back around to its starting position. From east to west, that time would be `4.5 × 10^946,941` years, and from top to bottom, `1.1 × 10^946,942` years. At walking pace, traversing one floor's gallery would take about `10^946,950` years. For perspective, our universe is only `1.4 × 10^10` years old.

## Is the Library three-dimensional?

At the mesoscopic scale (the human player's), it feels like it is.

At the macroscopic scale (the network of hexagons), however, it is two-dimensional. You can only traverse the gallery east-west and the floors up-down. There is no north–south direction. The whole building is only one hexagon wide, shaped like a vertical sheet a few metres thick but astronomically long and tall.

Note that in the original story, Borges never says which sides of the hexagons are free. If the doorless sides met at 120° instead of 180°, galleries could branch, and the Library could be a 3D honeycomb. That would mean splitting each book’s index into three coordinates instead of two.

## Configuration

Everything about the Library's size lives in `config.js`, which is read once when the page loads. Once you download the repo, you can edit this file in any text editor to fit your own preferences, save, and reload the page.

| Setting | Default | Meaning |
|---|---|---|
| `seed` | `'borges'` | Decides which book stands on which shelf. The same seed always gives the same Library. It can also be changed from the title screen and the pause menu. |
| `book.pagesPerBook` | 512 | Adapted from Borges' story (410 pages) to be a power of 2. |
| `book.linesPerPage` | 32 | Adapted from Borges' story (40 lines) to be a power of 2. |
| `book.charactersPerLine` | 64 | Adapted from Borges' story (80 characters) to be a power of 2. |
| `alphabet` | 64 symbols: the 26 capital letters from the modern latin alphabet, ten digits, the symbols `. , ; : ! ? ' " - — ( ) [ ] _ * & / $ % £ ° † § # + =`, and space. | These are all the symbols books are written in. Each must appear once; at most 256 symbols. Any string of distinct characters works. Adapted from Borges' story (25 symbols) to be a power of 2 (32 symbols were not sufficient to represent most literature classics, so the next option was 64). |
| `website` | `'https://theaviationdoctor.github.io/Babel/'` | Where the Library is published. Links copied from the catalogue lead there, wherever they were copied from. |
| `hexagon.wallsWithShelves` | 4 | 1 to 4. The other two sides of every hexagon are its vestibules. |
| `hexagon.shelvesPerWall` | 4 | Adapted from Borges' story (5 shelves) to be a power of 2. |
| `hexagon.booksPerShelf` | 32 | |

A book may hold no more than `2^24 = 16,777,216` characters and a hexagon no more `2^16 = 65,536` books. The rooms are built to fit: the number of books per shelf sets the width of each hexagon, and the number of shelves sets the height of its ceiling. If a value is invalid or a setting's name is misspelt, the page says which one and why.

The default alphabet is meant to hold classic literature, so that the catalogue can find the classics on the shelves (see [Your books](#your-books)) while staying a power of two like every other figure. The Library has no lower case, as in Borges's story, which leaves room for every mark that literature uses. In 18 public-domain classics, from Austen to Whitman and the King James Bible (11.7 million characters), the 19 commonest marks make up 99.9% of the punctuation. The other eight slots hold the long dash, written `--` in plain-text editions, and signs found in older books: the pound sterling, the degree, the dagger, the section mark, the number sign, plus and equals.

Any change to these values, the seed included, gives a different Library: an address copied before then no longer leads to the same books.

Borges's own figures would be 410 pages, 40 lines, 80 characters, a 25-symbol alphabet, and 4 walls of 5 shelves of 32 books. They work too in case you'd like to try them.

## How the Library is built

**Addresses.** Every shelf position has an index *v* between 0 and *N*^*M* − 1 (*N* symbols, *M* characters per book), written as *M* base-*N* digits. It decomposes as

    v = hexagon × S + slot              (S books per hexagon; slot = wall, shelf, volume)
    hexagon = floor × L + gallery       (L = N^m galleries per floor)

so each hexagon has a floor number and a gallery number, each about half a million symbols long. By default there are 64^524,287 = 2^3,145,722 hexagons along every gallery, about 10^946,956, and 64^524,289 / 512 = 2^3,145,725 floors, about 10^946,957. The pause menu shows the current hexagon's address, written in the Library's own alphabet, and can copy it in full.

**Contents.** The book at index *v* is obtained by a permutation of the space of all books, keyed by the seed: a four-round Feistel network on the book's two halves. Each round adds, symbol by symbol and modulo *N*, a pseudorandom stream generated from a hash of the other half. A Feistel network can be run backwards whatever its round functions are, so the map from shelf to contents is a bijection. No two shelves hold the same book and no possible book is missing. Neighbouring books share nothing visible. Opening one takes a few hundredths of a second, and all the arithmetic on the huge numbers is done digit by digit, without big-integer multiplication.

Because the map can be inverted, any text can be located: `findText` in `js/library.js` returns the hexagon, wall, shelf, volume and page of a book containing any given passage. The catalogue in every vestibule uses it (see below).

**Shape.** Both the galleries and the floors wrap around: walk east for 2^3,145,722 hexagons and you are back where you started. The Library is finite, and from inside it has no edge. This is close to the hypothesis the narrator offers at the end of the story. When the number of books is not a multiple of the books per hexagon, as with Borges's figures, the very last hexagon is only partly filled.

**Cosmetics.** Spine colours and the letters on the spines come from a separate hash of the hexagon's address. They are not part of the bijection and, as in the story, they say nothing about what the pages contain.

## Architecture

The story leaves room for interpretation. This version reads it as follows.

- The hexagons are identical. Four sides carry shelves floor to ceiling, and the ceiling is a little above a librarian's head.
- The two free sides are opposite each other, so every floor is a single straight gallery of hexagons running east and west.
- Each free side opens onto a narrow vestibule leading to the next hexagon. It has a door on each side, a mirror, and a spiral stair that climbs and descends through every floor.
- Borges gives the vestibule two very small closets, one to sleep in standing up and one for bodily needs. Here the south door opens into a single cell of 2.2 × 2.1 m that serves both purposes. It holds a single bed, a small table fixed to the wall with a night lamp, a toilet, and a sink with a mirror. The lamp can be turned off. The cell is then dark, apart from what light comes in through the open door, and the lampshade keeps only a faint glow. The north door stays shut. The cell sits in the wedge of space between two neighbouring hexagons. That wedge is about 4 m wide beside the vestibule and widens further away, so the cell fits whatever the size of the hexagons.
- Opposite the cell, the north door now gives onto a shallow niche holding a touchscreen: the catalogue (see below). It is the one thing in the Library that Borges did not put there, and it glows with a cooler light than the lamps.
- Over the doorway at each end of the vestibule, a wooden lintel bears a small sign in gilt capitals: EAST over the doorway to the next hexagon east, WEST over the one to the west. Walking along a vestibule, one always faces the name of the way one is heading.
- In the middle of each hexagon an air shaft, with a very low railing, shows the floors above and below.
- Two spherical lamps hang in each hexagon, placed across the gallery. They are the only light.

## The catalogue

Every vestibule has one. It does three things.

**Find a text.** Type or paste anything into it. Small letters are read as capitals, accents are removed, line breaks and tabs become spaces, and `--` becomes a long dash. Other characters become their nearest equivalents in the alphabet: curly quotation marks become straight ones, Æ becomes AE, ß becomes SS, ½ becomes 1/2, a ligature such as ﬁ becomes FI, and so on. What has no equivalent is left out (the screen lists it). The catalogue then runs the shelving backwards. It composes the book that begins with your text, with the rest of the book either random characters or blank, and the inverse permutation gives the hexagon, wall, shelf and volume where that book stands. Since every possible book exists exactly once, it is certainly there. It is also almost always astronomically far away, so the screen gives the distance as a power of ten. You can read the book on the spot, with your text highlighted, copy its address, or go there: you are set down in front of it, and the volume stands a little out of its row.

**Find a book.** The catalogue can also find a whole book: any plain-text file in the `books` folder. It sets the text in pages, the way a book of this Library holds them: a title page with the title, author and year, then the text at 64 characters to a line and 32 lines to a page, with words kept whole and each paragraph starting on a new, indented line. The rest of the 512 pages are blank (or random characters, if you prefer). It then finds the one book of the Library that holds exactly those pages, and you can read it on the spot or go and take it down from its shelf. A text longer than one book is set in several parts, each with its own title page, and each part is found separately.

**Go to a hexagon.** Move any number of hexagons east or west and floors up or down. Paste a full address, as copied from the pause menu or the catalogue, to return to a hexagon you have bookmarked, even after closing the page. Or go somewhere at random. After a jump, the corner of the screen counts your steps from where you arrived.

## Links to books

A book's address cannot serve as a link: it is as long as the book itself, 1,048,576 symbols, about a megabyte. That is no accident of design. The shelving is a bijection, so there are exactly as many addresses as books, and addresses cannot on average be shorter than what they point to.

A link to a book carries the book's text instead, compressed, after the `#` of the Library's address, a part that browsers never send to the server. Whoever opens the link is told which book it leads to; on entering the Library, they are set down before it, the volume standing a little out of its row. The Library sets the text in pages exactly as the catalogue does and runs the shelving backwards to find the book, so a link keeps leading to the right book even if the seed or the configuration change. A blog post of a few thousand words makes a link of a few thousand characters. In the catalogue, **Copy a link to it** copies such a link for any text found with **Find a text** or any book found with **Find a book**. The format is described in `js/library.js`, under "Links to books".

### Linking a blog

`obsidian/publish.js` adds, at the end of every note of a site made with [Obsidian Publish](https://obsidian.md/publish), a link to the book of the Library that holds the note: a title page with the note's title, the author's name and the year from the note's `date` property, if it has one, then the note's text as a reader sees it. To use it:

1. Copy `obsidian/publish.js` to the root of the vault, as `publish.js`. If the vault already has a `publish.js`, paste its contents at the end of that file instead.
2. In Obsidian, open **Publish changes**, tick `publish.js` (it is hidden from the file explorer but listed there) and publish.
3. Reload the site, holding Shift so that the browser fetches the new script.

Obsidian Publish runs `publish.js` only on sites with a custom domain. The settings at the top of the file give the author's name, the words of the link and the address of the Library. The script reads the page as Obsidian Publish draws it, which Obsidian does not document and may change; if the link stops appearing, that is the place to look.

## Your books

To add a book, save it as a plain-text file (`.txt`, preferably UTF-8) in the `books` folder, named `Author — Title (Year).txt`. The catalogue reads the title, author and year from the name. Files from [Project Gutenberg](https://www.gutenberg.org) can be added as they are: the catalogue leaves out the licence that comes before and after the text, and the volunteers' credits, and if the file name does not name an author, it takes the title and author from the e-book's header. Any other name is used as the title. Leave a blank line between paragraphs. If there are no blank lines, each line is taken as a paragraph, and a file written on a single line is set as one long paragraph.

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
| `obsidian/publish.js` | For an Obsidian Publish site: a link under every note to its book in the Library |
| `books/` | Your own books, as `.txt` files, for the catalogue to find |

## Tests

With Node.js installed, run `node tests/library.test.js`. The tests enumerate every shelf of three small libraries and check that each holds a different book and that the inverse map finds every book again. They then check round trips, text search and timing on the Library described by `config.js`, and on Borges's own figures, and finally the catalogue: preparing texts, setting whole books in pages and splitting long ones into parts, leaving out Project Gutenberg's licence, finding them in books, distances that wrap around the Library, reading back copied addresses, and making and reading links to books.

## Credits

Borge's story itself is not reproduced here for translation copyright reasons. 3D rendering uses [three.js](https://threejs.org). Typefaces are Libre Bodoni and Courier Prime, from Google Fonts, under the SIL Open Font License.
