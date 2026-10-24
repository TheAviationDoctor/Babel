# Babel

A Web-based walkable rendering of Jorge Luis Borges's short story *The Library of Babel* (1941). The Library is deterministically generated from a seed, and every possible book no longer than 512 pages exists exactly once on its shelves somewhere, which makes the Library finite too (although extremely large). You can wander its galleries, climb its stairs, take down any volume, and read it. You can also use the catalogue to search for specific strings or even locate literature classics, and be teleported to that gallery.

Every text ever written, including your own life story, as well as every text *never* written, is contained somewhere in the Library.

## Getting started

Everything is pure HTML/JS/CSS, so nothing needs installing. Just visit the Library online at https://babel.pellegr.in/, or download the repo and open `index.html` locally in a recent browser (Chrome, Edge, Firefox, or Safari). It even runs offline (except for a couple of Google Fonts which will then revert to your browser's defaults). There is no title screen: you wake in a hexagon of the Library chosen at random, a different one on every visit (any of its hexagons may come up). Click once to look around with the mouse. If, just after an update, the page stays black or says that the Library did not start, reload it while holding Shift, so that the browser fetches every file again.

| | |
|---|---|
| Look | mouse (click once to capture it) |
| Walk | `W` `A` `S` `D` or the arrow keys |
| Hurry | hold `Shift`, or turn on `Caps Lock` to keep hurrying until you turn it off |
| Interact with objects (books, catalogue, doors, lamps, beds) | `E` or click |
| Turn pages | `←` `→`, `Page Up` `Page Down`, `Home` `End` |
| Put the book back | `Esc` or `E` |
| Let go of the mouse | `Esc` (click to take it back) |
| Wake from a dream | click or `Esc` |

On a phone or tablet, drag on the right of the screen to look, hold and slide on the left to walk, and tap to interact with objects. Tap again to wake from a dream.

## Is the Library infinite?

No. The library is *finite*, meaning it has a fixed number of books (each one unique), hexagons, and floors. But it is *boundless* (it has no hard boundary) because it is *cyclic* in both directions. Walk past the last hexagon of a floor, or take the stairs up or down to the last floor, and you are back at the first, just like an ant walking endlessly on the surface of a torus (which the Library is, topologically speaking).

Since there is no edge, positions are measured from the *seam*, where the numbers of the galleries and floors start again: east–west between the last hexagon of a floor and the first, and up–down between the last floor and the first. Nothing marks it. The catalogue's **Current position** tab (see [The catalogue](#the-catalogue)) gives your position from it, for example `1.1 × 10^946,956 hexagons east of the seam (24.0% of the way round) and 1.6 × 10^946,957 floors above it (40.7% of the way up)`. Walking barely changes these figures, since each hexagon is only `2 × 10^-946,955` % of the way round.

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
| `seed` | `'borges'` | Decides which book stands on which shelf. The same seed always gives the same Library. It can only be changed here, so that every visitor finds every book in the same place. |
| `book.pagesPerBook` | 512 | Adapted from Borges' story (410 pages) to be a power of 2. |
| `book.linesPerPage` | 32 | Adapted from Borges' story (40 lines) to be a power of 2. |
| `book.charactersPerLine` | 64 | Adapted from Borges' story (80 characters) to be a power of 2. |
| `alphabet` | 64 symbols: the 26 capital letters from the modern latin alphabet, ten digits, the symbols `. , ; : ! ? ' " - — ( ) [ ] _ * & / $ % £ ° † § # + =`, and space. | These are all the symbols books are written in. Each must appear once; at most 256 symbols. Any string of distinct characters works. Adapted from Borges' story (25 symbols) to be a power of 2 (32 symbols were not sufficient to represent most literature classics, so the next option was 64). |
| `website` | `'https://babel.pellegr.in/'` | Where the Library is published. Links copied from the catalogue lead there, wherever they were copied from. |
| `hexagon.wallsWithShelves` | 4 | 1 to 4. The other two sides of every hexagon are its vestibules. |
| `hexagon.shelvesPerWall` | 4 | Adapted from Borges' story (5 shelves) to be a power of 2. |
| `hexagon.booksPerShelf` | 32 | |
| `view.lookSensitivity` | 1 | How fast the view turns with the mouse, from 0.1 to 5. |
| `view.fieldOfView` | 72 | How wide the view is, in degrees, from 30 to 120. |
| `dreams.quoteDuration` | 10 | How long each sentence of a dream stays, in seconds, once it has faded in, from 1 to 600. See [Dreams](#dreams). |
| `dreams.quoteInterval` | 5 | How long after a sentence has faded out the next one begins to fade in, in seconds, from 0 to 600. |

A book may hold no more than `2^24 = 16,777,216` characters and a hexagon no more `2^16 = 65,536` books. The rooms are built to fit: the number of books per shelf sets the width of each hexagon, and the number of shelves sets the height of its ceiling. If a value is invalid or a setting's name is misspelt, the page says which one and why.

The default alphabet is meant to hold classic literature, so that the catalogue can find the classics on the shelves (see [Your books](#your-books)) while staying a power of two like every other figure. The Library has no lower case, as in Borges's story, which leaves room for every mark that literature uses. In 18 public-domain classics, from Austen to Whitman and the King James Bible (11.7 million characters), the 19 commonest marks make up 99.9% of the punctuation. The other eight slots hold the long dash, written `--` in plain-text editions, and signs found in older books: the pound sterling, the degree, the dagger, the section mark, the number sign, plus and equals.

Any change to these values, the seed included (but not `website`, `view` or `dreams`), gives a different Library: an address copied before then no longer leads to the same books.

Borges's own figures would be 410 pages, 40 lines, 80 characters, a 25-symbol alphabet, and 4 walls of 5 shelves of 32 books. They work too in case you'd like to try them.

## How the Library is built

**Addresses.** Every shelf position has an index *v* between 0 and *N*^*M* − 1 (*N* symbols, *M* characters per book), written as *M* base-*N* digits. It decomposes as

    v = hexagon × S + slot              (S books per hexagon; slot = wall, shelf, volume)
    hexagon = floor × L + gallery       (L = N^m galleries per floor)

so each hexagon has a floor number and a gallery number, each about half a million symbols long. By default there are 64^524,287 = 2^3,145,722 hexagons along every gallery, about 10^946,956, and 64^524,289 / 512 = 2^3,145,725 floors, about 10^946,957. The catalogue's Current position tab shows the current hexagon's address, written in the Library's own alphabet, and can copy it in full.

**Contents.** The book at index *v* is obtained by a permutation of the space of all books, keyed by the seed: a four-round Feistel network on the book's two halves. Each round adds, symbol by symbol and modulo *N*, a pseudorandom stream generated from a hash of the other half. A Feistel network can be run backwards whatever its round functions are, so the map from shelf to contents is a bijection. No two shelves hold the same book and no possible book is missing. Neighbouring books share nothing visible. Opening one takes a few hundredths of a second, and all the arithmetic on the huge numbers is done digit by digit, without big-integer multiplication.

Because the map can be inverted, any text can be located: `findText` in `js/library.js` returns the hexagon, wall, shelf, volume and page of a book containing any given passage. The catalogue in every vestibule uses it (see below).

**Shape.** Both the galleries and the floors wrap around: walk east for 2^3,145,722 hexagons and you are back where you started. The Library is finite, and from inside it has no edge. This is close to the hypothesis the narrator offers at the end of the story. When the number of books is not a multiple of the books per hexagon, as with Borges's figures, the very last hexagon is only partly filled.

**Cosmetics.** Spine colours and the letters on the spines come from a separate hash of the hexagon's address. They are not part of the bijection and, as in the story, they say nothing about what the pages contain.

## Architecture

The story leaves room for interpretation. This version reads it as follows.

- The hexagons are identical. Four sides carry shelves floor to ceiling, and the ceiling is a little above a librarian's head.
- The two free sides are opposite each other, so every floor is a single straight gallery of hexagons running east and west.
- Each free side opens onto a narrow vestibule leading to the next hexagon. It has a door on each side, a mirror, and a spiral stair that climbs and descends through every floor.
- Borges gives the vestibule two very small closets, one to sleep in standing up and one for bodily needs. Here the south door opens into a single cell of 2.2 × 2.1 m that serves both purposes. It holds a single bed, a small table fixed to the wall with a night lamp, a toilet, and a sink with a mirror. The bed can be slept in (see [Dreams](#dreams)), and the lamp can be turned off. The cell is then dark, apart from what light comes in through the open door, and the lampshade keeps only a faint glow. The north door stays shut. The cell sits in the wedge of space between two neighbouring hexagons. That wedge is about 4 m wide beside the vestibule and widens further away, so the cell fits whatever the size of the hexagons.
- Opposite the cell, the north door now gives onto a shallow niche holding a touchscreen: the catalogue (see below). It is the one thing in the Library that Borges did not put there, and it glows with a cooler light than the lamps.
- Over the doorway at each end of the vestibule, a wooden lintel bears a small sign in gilt capitals: EAST over the doorway to the next hexagon east, WEST over the one to the west. Walking along a vestibule, one always faces the name of the way one is heading.
- In the middle of each hexagon an air shaft, with a very low railing, shows the floors above and below.
- Two spherical lamps hang in each hexagon, placed across the gallery. They are the only light.

## The catalogue

Every vestibule has one. There is no menu in the Library, so the catalogue is also where you find your bearings. It does four things.

**Current position.** Where you are: how far from where you woke (or, after a jump, from where you arrived), and how far east of the seam and above it, with the percentage of the way round. After a jump through the catalogue, it says how far the jump went, measured the shorter way round, such as `2.2 × 10^946,956 hexagons west and 1.9 × 10^946,957 floors down`. A small map of the whole Library, drawn to its proportions (it is about 2.4 times taller than it is long), shows where you are, and where the last jump began. The tab also explains the seam, shows the hexagon's address and can copy it in full, and lists the controls.

**Find a text.** Type or paste anything into it. Small letters are read as capitals, accents are removed, line breaks and tabs become spaces, and `--` becomes a long dash. Other characters become their nearest equivalents in the alphabet: curly quotation marks become straight ones, Æ becomes AE, ß becomes SS, ½ becomes 1/2, a ligature such as ﬁ becomes FI, and so on. What has no equivalent is left out (the screen lists it). The catalogue then runs the shelving backwards. It composes the book that begins with your text, with the rest of the book either random characters or blank, and the inverse permutation gives the hexagon, wall, shelf and volume where that book stands. Since every possible book exists exactly once, it is certainly there. It is also almost always astronomically far away, so the screen gives the distance as a power of ten. You can read the book on the spot, with your text highlighted, copy its address, or go there: you are set down in front of it, and the volume stands a little out of its row.

**Find a book.** The catalogue can also find a whole book: any book of the Library's own collection (see [Your books](#your-books)), which it lists with a search box, most read first, by title or by author, or a plain-text file of your own. It sets the text in pages, the way a book of this Library holds them: from the first page, 64 characters to a line and 32 lines to a page, with words kept whole and each paragraph starting on a new, indented line. The rest of the 512 pages are blank (or random characters, if you prefer). It then finds the one book of the Library that holds exactly those pages, and you can read it on the spot, go and take it down from its shelf, or copy a link to it (see [Links to books](#links-to-books)). A text longer than one book is set in several parts, one after the other, and each part is found separately.

**Go to a hexagon.** Move any number of hexagons east or west and floors up or down. Paste a full address, as copied from the Current position tab, to return to a hexagon you have bookmarked, even after closing the page. An address copied from a Library with another seed is refused, since its books stand elsewhere. Or go somewhere at random. After a jump, the Current position tab counts your steps from where you arrived.

A fifth tab, **About**, tells the reader about the Library. Its text is in `js/about.js`, written in Markdown like this README (of which it is, to begin with, a copy), and can be edited like `config.js`: in any text editor, then save and reload the page.

## Links to books

A book's address cannot serve as a link: it is as long as the book itself, 1,048,576 symbols, about a megabyte. That is no accident of design. The shelving is a bijection, so there are exactly as many addresses as books, and addresses cannot on average be shorter than what they point to.

A link to a book carries the book's text instead, after the `#` of the Library's address, a part that browsers never send to the server:

    https://babel.pellegr.in/#book=<the text>

Whoever opens the link is set down in the Library before the book that holds exactly that text, the volume standing a little out of its row. That book is the text set in pages as the catalogue's **Find a book** sets it (from the first page, words kept whole, a new indented line for each paragraph), with the rest of its pages blank. The Library runs the shelving backwards to find it, so the same text always leads to the same book, and a link keeps leading to the book that holds its text even if the seed or the configuration change.

**Building a link.** The text after `book=` takes one of two forms; both lead to the same book.

- **Plain:** the text itself, percent-encoded, as a web address must write it: a space as `%20`, a line break as `%0A`, `é` as `%C3%A9`, and so on. Every language and spreadsheet has a function for it: `encodeURIComponent(text)` in JavaScript, `urllib.parse.quote(text, safe='')` in Python, `ENCODEURL(A1)` in Excel or Google Sheets. For example `https://babel.pellegr.in/#book=Call%20me%20Ishmael.` For a short text you can even type `https://babel.pellegr.in/#book=Call me Ishmael.` into the address bar, and the browser encodes it.
- **Compressed:** a colon, then the text's UTF-8 bytes compressed with zlib's deflate and written in URL-safe base64 without the trailing `=` signs. It is about a third as long. In Python: `':' + base64.urlsafe_b64encode(zlib.compress(text.encode('utf-8'))).rstrip(b'=').decode()`. This is the form that `publish.js` and the catalogue's **Copy a link to it** make.

Separate paragraphs with a blank line (`%0A%0A`); a single line break then counts as a space. In a text with no blank line at all, each line is taken as a paragraph. The text is otherwise read as the catalogue reads any text: in capitals, without accents, with curly quotation marks made straight, and so on. A blog post of a few thousand words makes a link of a few thousand characters, well within what browsers accept; a whole novel would be too long for some browsers, which stop at about 80,000 characters.

### Linking a blog

`obsidian/publish.js` adds, at the end of every note of a site made with [Obsidian Publish](https://obsidian.md/publish), a link to the book of the Library that holds the note's text as a reader sees it, and nothing else: no title, no author. To use it:

1. Copy `obsidian/publish.js` to the root of the vault, as `publish.js`. If the vault already has a `publish.js`, paste its contents at the end of that file instead.
2. In Obsidian, open **Publish changes**, tick `publish.js` (it is hidden from the file explorer but listed there) and publish.
3. Reload the site, holding Shift so that the browser fetches the new script.

Obsidian Publish runs `publish.js` only on sites with a custom domain. The settings at the top of the file give the address of the Library (`https://babel.pellegr.in/`) and the words of the link. The script reads the page as Obsidian Publish draws it, which Obsidian does not document and may change; if the link stops appearing, that is the place to look.

## Your books

The Library has a collection of books for the catalogue's **Find a book**: the plain-text files (`.txt`) in the `books/uncompressed` folder. For now, they are 957 of the 1,024 most read books of [Project Gutenberg](https://www.gutenberg.org), downloaded by `books/download_gutenberg_top1024.py`.

A web page is not allowed to look inside a folder, and a page opened by double-click cannot even read a file beside it, but it can load scripts. So after downloading, the script also *shelves* the books:

- `books/index.js` lists them: title, author, language, length, and rank by downloads (about 180 KB);
- `books/compressed/` holds one small script per book, its text compressed (about half the size of the `.txt` file; 402 MB for the 957 books).

The catalogue loads the list when **Find a book** is first opened, and a book's text only when you choose it, so the collection works the same whether the Library is opened by double-click or online. Commit `books/index.js` and `books/compressed/` to publish the collection with the Library. The `.txt` files in `books/uncompressed`, the script and its manifest stay out of the repository (see `.gitignore`). GitHub Pages allows a site of up to 1 GB, which leaves room for roughly as many books again.

To add a book of your own to the collection, save it as a plain-text file (preferably UTF-8) in the `books/uncompressed` folder, named `Author — Title (Year).txt`, and shelve the books again without downloading anything:

```
python3 books/download_gutenberg_top1024.py --output books --shelve-only
```

The title, author and year come from the file name. If the name does not give an author, they come from the e-book's header, as for the Gutenberg files. Those can be added as they are: the catalogue leaves out the licence that comes before and after the text, and the volunteers' credits. Leave a blank line between paragraphs. If there are no blank lines, each line is taken as a paragraph, and a file written on a single line is set as one long paragraph. Each book's script is named after its text, so shelving again only writes the books that are new or changed, and removes those that are gone.

Under **Other books**, anyone can also show the catalogue a `.txt` file of their own with **Choose book files**. Browsers word this as "uploading", but the file is only read by the page and never leaves the computer. The catalogue remembers those books in that browser until **Forget these books** is pressed.

## Dreams

Lie down on the bed of a cell (look at it and press `E`, click or tap) to sleep. The Library fades to black, and a dream comes out of the black: shapes like smoke seen through a kaleidoscope, now and then with the ghost of the Library's hexagons, of rings or of a spiral, in muted colours. Sentences fade in over it, one after another. Each one stays for `dreams.quoteDuration` seconds, then fades out, and the next one begins to fade in `dreams.quoteInterval` seconds later, while the dream melts into its next scene. Click, tap or press `Esc` to wake.

Everything in a dream comes from the address of the hexagon you sleep in (its gallery and floor numbers). The same hexagon always dreams the same dream, in the same order, and every other hexagon dreams another.

The sentences are grammatical but not necessarily sensible, like surreal poetry: *Every hill inhales a chimera; every chimera keeps a hill.* A small English grammar (verbs agreeing with their subjects, *a* and *an*, plurals, tenses, relative clauses) builds them from some 450 single words drawn from the lexical fields of Algernon Blackwood, Jorge Luis Borges, Italo Calvino, Ted Chiang, Julio Cortázar, Brian Evenson, Thomas Ligotti, H. P. Lovecraft, Arthur Machen, Guy de Maupassant, China Miéville, Edgar Allan Poe, Clark Ashton Smith and Jeff VanderMeer: labyrinths and mirrors, spores and lighthouses, puppets, crypts, willows, clockwork and salt. No phrase, name or invented place of theirs is used.

## Files

In `index.html`, every file name is followed by `?v=` and a version, such as `js/main.js?v=2026-10-24.11`. Change the version (to anything new) whenever any file changes. Browsers, and GitHub Pages, keep copies of files for a few minutes; a new version makes them fetch every file again, so that a new page is never read with an old script.

| Path | Contents |
|---|---|
| `index.html` | The page |
| `config.js` | The configuration |
| `css/style.css` | Reading view, catalogue and dreams |
| `js/library.js` | The mathematics: addresses, the bijection, text search, setting books in pages. No graphics. |
| `js/architecture.js` | Dimensions, geometry and lighting of hexagons, vestibules, stairs and cells |
| `js/world.js` | Streams the hexagons around the reader and dresses their books |
| `js/player.js` | Walking, the spiral stair, and picking a book, door, lamp, bed or catalogue by gaze |
| `js/about.js` | The text of the catalogue's About tab, in Markdown |
| `js/markdown.js` | Reads the Markdown of the About tab |
| `js/terminal.js` | The catalogue's screen: the current position, finding texts and books, and going to hexagons |
| `js/textures.js` | Wood, plaster, stone, floor tiles and leather spines, painted at start-up |
| `js/quotes.js` | The sentences of dreams: a small English grammar and its vocabulary |
| `js/dream.js` | The moving picture of dreams, drawn by one shader |
| `js/main.js` | Start-up, reading, sleep |
| `lib/` | three.js r147 and its `Reflector` (MIT licence, see `lib/three.LICENSE`) |
| `tests/library.test.js` | Tests of the mathematics |
| `obsidian/publish.js` | For an Obsidian Publish site: a link under every note to its book in the Library |
| `books/index.js`, `books/compressed/` | The collection, as the catalogue reads it, written by `books/download_gutenberg_top1024.py` from the `.txt` files in `books/uncompressed/` (which are not published) |

## Tests

With Node.js installed, run `node tests/library.test.js`. The tests enumerate every shelf of three small libraries and check that each holds a different book and that the inverse map finds every book again. They then check round trips, text search and timing on the Library described by `config.js`, and on Borges's own figures, and finally the catalogue: preparing texts, setting whole books in pages and splitting long ones into parts, leaving out Project Gutenberg's licence, finding them in books, distances that wrap around the Library, reading back copied addresses, and making and reading links to books. They also check positions measured from the seam, random hexagons to wake in, the Markdown of the About tab, and the sentences of dreams: grammatical, varied, and always the same for the same hexagon.

## Credits

Borge's story itself is not reproduced here for translation copyright reasons. 3D rendering uses [three.js](https://threejs.org). Typefaces are Libre Bodoni and Courier Prime, from Google Fonts, under the SIL Open Font License.
