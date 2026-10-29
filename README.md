# Babel

A Web-based walkable simulation of Jorge Luis Borges's *[Library of Babel](https://en.wikipedia.org/wiki/The_Library_of_Babel)* adapted from his 1941 eponymous story. It contains every book that was ever written, and every book that wasn't.

## Features

- Permanent book locations (deterministic generation from a seed)
- Fully configurable (seed, book length, alphabet, bookshelves, look sensitivity, field of view)
- Fully walkable
- Interactive objects (books, terminal, doors, beds, bedside lamps)
- Search for and teleport to any book
- Copy and share book locations
- Read ~1K literature classics (all copyright-free) from the terminal index

## Getting started

No installation required: everything is self-contained HTML/JS/CSS. Visit the Library online at https://babel.pellegr.in/, or download the repo and open `index.html` locally in a recent browser. It even runs offline (except for a couple of Google Fonts which will then revert to your browser's defaults). Edit the `config.js` file to configure the Library as you wish.

| | |
|---|---|
| Look | mouse (click once to capture it) |
| Walk | `W` `A` `S` `D` or arrow keys |
| Hurry | hold `Shift` or turn on `Caps Lock` |
| Interact with objects | `E` or click |
| Turn book pages | `←` `→`, `Page Up` `Page Down`, `Home` `End` |
| Put a book back | `Esc` or `E` |
| Let go of the mouse | `Esc` (click to take it back) |
| Wake from a dream | click or `Esc` |

On a phone or tablet, drag on the right of the screen to look, hold and slide on the left to walk, and tap to interact with objects. Tap again to wake from a dream.

## Is the Library infinite?

No. The Library is *finite*, meaning it has a fixed number of unique books, hexagons, and floors. But it is *boundless* (it has no hard edge) and is *cyclic* in both directions. Walk past the last hexagon of a floor, or take the stairs up or down to the last floor, and you are back at the first, just like an ant walking endlessly on the surface of a torus (which the Library is, topologically speaking). Positions are measured from the *seam*, which is where the numbers of the galleries roll over: east–west between the last hexagon of a floor and the first, and up–down between the last floor and the first. The Catalogue's **Current position** tab (see [The Catalogue](#the-Catalogue)) gives your position from the seam. Walking barely changes your position, since each hexagon is only `4 × 10^-1,104,782%` of the way round.

## So how big is the Library?

Using the default settings from `config.js`:

- Each book holds `2^6 = 64` characters per line, `2^5 = 32` lines per page, and `2^9 = 512` pages. That's a total of `2^20 = 1,048,576` characters per book. That's about twice the length of a typical English novel, which gives plenty of headroom to capture most books ever published.

- The alphabet contains `2^7 = 128` symbols: the `26` letters A–Z in capitals and in small letters, `27` accented letters and ligatures (for French and Spanish, the umlauts ä and ö, and five accented capitals), `10` digits 0–9, `38` punctuation marks and signs, and the space. They were chosen by counting every character of the ~1K classics in the Library's collection, and hold 99.9% of the 697 million characters of its 871 English books exactly as printed, small letters, accents and curly quotation marks included.

- There are therefore `128^(2^20) = 2^7,340,032 ≈ 6.33 × 10^2,209,569` unique books in the Library. That's one followed by over 2.2 million zeros. If you kept repeating the word 'trillion' once per second, it would take you just over 51 hours to verbalize that number.

- Each hexagonal room holds `2^2 = 4` bookshelves of `2^2 = 4` shelves each and `2^5 = 32` books per shelf. That's a total of `2^9 = 512` books per hexagon. So, the Library has `2^7,340,032 / 2^9 = 2^7,340,023 ≈ 1.24 × 10^2,209,567` hexagons. Barely two order of magnitude fewer hexagons than books. For all intents and purposes, they are the same number.

- For perspective: there are about `10^80` atoms in the observable universe. Imagine every atom contained an entire universe, each with just as many atoms as ours. Then imagine every atom in *that* nested universe contained another universe, etc. You would need nearly 28,000 levels of Matrioshka universes before the *cumulative* number of atoms reached the number of books or hexagons in the Library.

- There are `2^3,670,011 ≈ 2.49 × 10^1,104,783` hexagons per floor, all arranged in one long stretch of galleries punctuated by vertical shafts, and `2^3,670,012 ≈ 4.97 × 10^1,104,783` floors. That's twice as many floors as hexagons per floor, as even as it gets: the `2^7,340,023` hexagons, an odd power of 2, cannot be split into two equal powers of 2.

- A floor is only 2.61 meters high against 8.83 meters in length per hexagon, so with twice as many floors as hexagons per floor, the Library is about 1.7 times longer than it is tall: seen from the side, nearly a square. (Of the shapes the number of hexagons allows, this is the nearest to a square: with 8 times as many floors, it would be 2.4 times taller than long.) The Library spans `2.3 × 10^1,104,768` light-years from east to west and `1.4 × 10^1,104,768` light-years from top to bottom. For perspective, the Library could fit our observable universe `2.5 × 10^1,104,757` times from east to west and `1.5 × 10^1,104,757` times from top to bottom. At walking pace, traversing one floor's gallery would take about `5 × 10^1,104,776` years.

## Is the Library three-dimensional?

At the mesoscopic (human) scale, it feels like it is.

At the macroscopic scale, however, it is two-dimensional. You can only traverse the galleries east-west and the floors up-down. There is no north–south direction. The whole building is only one hexagon wide, shaped like a vertical sheet a few metres thick but astronomically long and tall.

Note that in the original story, Borges never says which sides of the hexagons are free. If the doorless sides met at 120° instead of 180°, galleries could branch, and the Library could be a 3D honeycomb. That would mean splitting each book’s index into three coordinates instead of two.

## Configuration

Everything about the Library's size lives in `config.js`, which is read once when the page loads. Once you download the repo, you can edit this file in any text editor to fit your own preferences, save, and reload `index.html`.

| Setting | Default | Meaning |
|---|---|---|
| `seed` | `'borges'` | Decides which book stands on which shelf. The same seed always gives the same Library. |
| `book.pagesPerBook` | 512 | Adapted from 410 pages in Borges' story to be a power of 2. |
| `book.linesPerPage` | 32 | Adapted from 40 lines in Borges' story to be a power of 2. |
| `book.charactersPerLine` | 64 | Adapted from 80 characters in Borges' story to be a power of 2. |
| `alphabet` | 128 symbols: A–Z and a–z, `À Ç É Æ Œ à â æ ç é è ê ë î ï ô œ ù û ü á í ó ú ñ ä ö`, 0–9, the symbols `. , ; : ! ? ' " - — ( ) [ ] _ * & / $ % £ ° † § # + = ‘ ’ “ ” « » ¿ ¡ – ½ ×`, and space. | These are all the symbols books are written in. Each must appear once; at most 256 symbols. Any string of distinct characters works. Adapted from 25 symbols in Borges' story to be a power of 2 (32 symbols were too few for most literature classics; 64 held them in capitals only; 128 holds them as printed). |
| `website` | `'https://babel.pellegr.in/'` | Where the Library is currently published. Links copied from the Catalogue lead there. |
| `hexagon.wallsWithShelves` | 4 | 1–4. The other two sides of every hexagon are its vestibules. |
| `hexagon.shelvesPerWall` | 4 | Adapted from 5 shelves in Borges' story to be a power of 2. |
| `hexagon.booksPerShelf` | 32 | |
| `view.lookSensitivity` | 1 | How fast the view turns with the mouse, from 0.1 to 5. |
| `view.fieldOfView` | 72 | How wide the view is, in degrees, from 30 to 120. |
| `dreams.quoteDuration` | 10 | How long each sentence of a dream stays, in seconds, once it has faded in, from 1 to 600. See [Dreams](#dreams). |
| `dreams.quoteInterval` | 5 | How long after a sentence has faded out the next one begins to fade in, in seconds, from 0 to 600. |

A book may hold no more than `2^24 = 16,777,216` characters and a hexagon no more `2^16 = 65,536` books. The rooms are built to fit: the number of books per shelf sets the width of each hexagon, and the number of shelves sets the height of its ceiling. If a value is invalid or a setting's name is misspelt, the page says which one and why.

The default alphabet is meant to hold classic literature as it was printed, so that the Catalogue can find the classics on the shelves (see [Your books](#your-books)) while staying a power of two like every other figure. It was chosen by counting every character in the Library's collection of ~1K books. After the 26 letters in both cases, the commonest characters by far are curly quotation marks, found in about half of the 871 English books. Then come the accented letters of French (é alone appears in 476 of those books), the umlauts of German names and of old spellings (Königsberg, Göttingen, coöperation), and the letters of Spanish (á, ñ). Guillemets (« ») and the inverted marks of Spanish (¿ ¡) appear in every French and Spanish book. Five accented capitals begin enough words to earn their place (À Ç É Æ Œ); other capitals lose their accents (Ê becomes E), as much French printing long did. The 27 marks and signs of the Library's first alphabet stay, and the en dash, the half and the multiplication sign complete the 128. The rest of the keyboard (`{ } | ^ ~ < > @ \` and the backquote) is left out: the collection uses it almost only for transcribers' markup and tables, and on a random page it would look like computer code. Greek is left out too: some 60 books quote it, but it would need 24 letters and their accents.

The Library's first alphabet had 64 symbols, with the letters in capitals only, as in Borges's story. It is still in `config.js`, one line away, for those who prefer it.

Any change to these values, the seed included (but not `website`, `view` or `dreams`), gives a different Library: an address copied before then no longer leads to the same books.

Borges's own figures would be 410 pages, 40 lines, 80 characters, a 25-symbol alphabet, and 4 walls of 5 shelves of 32 books. They work too in case you'd like to try them.

## How the Library is built

**Addresses.** Every shelf position has an index *v* between 0 and *N*^*M* − 1 (*N* symbols, *M* characters per book), written as *M* base-*N* digits. It decomposes as

    v = hexagon × S + slot              (S books per hexagon; slot = wall, shelf, volume)
    hexagon = floor × L + gallery       (L hexagons along each floor)

so each hexagon has a floor number and a gallery number. L is chosen to make the floors as many as the hexagons along each: since the alphabet has 2^7 symbols, every hexagon number is a string of bits, and the gallery number takes the lower half of them, the floor number the upper half. By default the hexagon numbers have 7,340,023 bits, an odd number, and the floor number has the odd bit: there are 2^3,670,011 hexagons along every gallery, about 10^1,104,783, and twice as many floors, 2^3,670,012. Both numbers are 524,288 symbols long. (With an alphabet whose size is not a power of 2, the numbers are split between two symbols instead, as evenly as that allows.) The Catalogue's Current position tab shows the current hexagon's address, written in the Library's own alphabet, and can copy it in full.

**Contents.** The book at index *v* is obtained by a permutation of the space of all books, keyed by the seed: a four-round Feistel network on the book's two halves. Each round adds, symbol by symbol and modulo *N*, a pseudorandom stream generated from a hash of the other half. A Feistel network can be run backwards whatever its round functions are, so the map from shelf to contents is a bijection. No two shelves hold the same book and no possible book is missing. Neighbouring books share nothing visible. Opening one takes a few hundredths of a second, and all the arithmetic on the huge numbers is done digit by digit, without big-integer multiplication.

Because the map can be inverted, any text can be located: `findText` in `js/library.js` returns the hexagon, wall, shelf, volume and page of a book containing any given passage. The Catalogue in every vestibule uses it (see below).

**Shape.** Both the galleries and the floors wrap around: walk east for 2^3,670,011 hexagons and you are back where you started. The Library is finite, and from inside it has no edge. This is close to the hypothesis the narrator offers at the end of the story. When the number of books is not a multiple of the books per hexagon, as with Borges's figures, the very last hexagon is only partly filled.

**Cosmetics.** Spine colours and the letters on the spines come from a separate hash of the hexagon's address. They are not part of the bijection and, as in the story, they say nothing about what the pages contain.

## The Catalogue

Every vestibule has one. There is no menu in the Library, so the Catalogue is also where you find your bearings. It does four things.

**Current position.** Where you are: how far from where you woke (or, after a jump, from where you arrived), and how far east of the Western seam and above the Lower seam, with the percentage of the way round. After a jump through the Catalogue, it says how far the jump went, measured the shorter way round, such as `1.2 × 10^1,104,783 hexagons west and 2.2 × 10^1,104,783 floors down`. The rest of the tab is a map of the whole Library seen from the side, as large as the screen allows and drawn to its proportions (it is about 1.7 times longer than it is tall). Its four sides are the seam, named Upper, Eastern, Lower and Western, each joining the side opposite. The hexagon you are in blinks on it, and an outlined hexagon marks where the last jump began. A button below the map copies the hexagon's full address, to come back to it later from **Go to a hexagon**.

**Find a text.** Type or paste anything into it. Letters keep their case, and their accents where the alphabet has them; other letters lose their accents (Ê becomes E, ō becomes o). Line breaks and tabs become spaces, and `--` becomes a long dash. Other characters become their nearest equivalents in the alphabet: ß becomes ss, … becomes ..., ¼ becomes 1/4, a ligature such as ﬁ becomes fi, and so on (the screen says which). What has no equivalent, such as Greek, is left out (the screen lists it). The Catalogue then runs the shelving backwards. It composes the book that begins with your text, with the rest of the book either random characters or blank, and the inverse permutation gives the hexagon, wall, shelf and volume where that book stands. Since every possible book exists exactly once, it is certainly there. It is also almost always astronomically far away, so the screen gives the distance as a power of ten. You can read the book on the spot, with your text highlighted, copy its address or a link to it (see [Links to books](#links-to-books)), or go there: you are set down in front of it, and the volume stands a little out of its row.

**Find a book.** The Catalogue can also find a whole book: any book of the Library's own collection (see [Your books](#your-books)), which it lists with a search box, most read first, by title or by author, or a plain-text file of your own. It sets the text in pages, the way a book of this Library holds them: from the first page, 64 characters to a line and 32 lines to a page, with words kept whole and each paragraph starting on a new, indented line. The rest of the 512 pages are blank (or random characters, if you prefer). It then finds the one book of the Library that holds exactly those pages, and you can read it on the spot, go and take it down from its shelf, or copy a link to it (see [Links to books](#links-to-books)). A text longer than one book is set in several parts, one after the other, and each part is found separately.

**Go to a hexagon.** Move any number of hexagons east or west and floors up or down. Paste a full address, as copied from the Current position tab, to return to a hexagon you have bookmarked, even after closing the page. An address copied from a Library with another seed is refused, since its books stand elsewhere. Or go somewhere at random. After a jump, the Current position tab counts your steps from where you arrived.

A fifth tab, **About**, tells the reader about the Library. Its text is in `js/about.js`, written in Markdown like this README, and can be edited like `config.js`: in any text editor, then save and reload the page. A link in that text to a text or a book of the collection, such as `[a text](#text=:eNpc…)` or `[a book](#book=3f6bb9d6f78e0293b56a)`, leads to its book in the same Library, whether the Library was opened from your computer or on the web: it may be written `#text=…`, `/#text=…` or with the Library's full address.

## Links to books

A book's address cannot serve as a link: it is as long as the book itself (1,048,576 symbols, about a megabyte). This is because shelving is a bijection, so there are exactly as many addresses as books, and addresses cannot on average be shorter than what they point to.

There are two other kinds of links instead, both written after the `#` of the Library's address, a part that browsers never send to the server: links to texts, and links to the books of the collection.

### Links to texts

A link to a text carries the text itself:

    https://babel.pellegr.in/#text=<the text>

Whoever opens the link is set down in the Library before the book that holds exactly that text, the volume standing a little out of its row. That book is the text set in pages as the Catalogue's **Find a book** sets it (from the first page, words kept whole, a new indented line for each paragraph), with the rest of its pages blank. The Library runs the shelving backwards to find it, so the same text always leads to the same book, and a link keeps leading to the book that holds its text even if the seed or the configuration change. Such a link can be built without the book ever having been found.

**Building a link.** The text after `text=` takes one of two forms; both lead to the same book.

- **Plain:** the text itself, percent-encoded, as a web address must write it: a space as `%20`, a line break as `%0A`, `é` as `%C3%A9`, and so on. For a short text, you can even type it "as is" into the address bar, and the browser will encode it.

- **Compressed:** a colon, then the text's UTF-8 bytes compressed with zlib's deflate and written in URL-safe base64 without the trailing `=` signs. It is typically about a third as long as plain text, except for short texts. The Catalogue's links use whichever form is shorter.

Two options may follow the text, in any order:

- `&typed`: the text as typed, at the very start of the first page, rather than set in pages. This is the book the Catalogue's **Find a text** finds, and the link its **Copy a link to it** copies.
- `&random`: the rest of the book in random characters rather than blank pages. The random characters come from the seed, so such a link leads to the same book only in a Library with the same seed and dimensions.

For text you’ve copied and you'd like to link to in the Library, this terminal command creates the link and places it straight back in your clipboard:

```
pbpaste | python3 -c "import sys,zlib,base64; t=sys.stdin.buffer.read(); print('#text=:'+base64.urlsafe_b64encode(zlib.compress(t,9)).rstrip(b'=').decode(), end='')" | pbcopy
```

If the text you'd like to link to is inside the file `mytext.txt`, use this:

```
python3 -c "import sys,zlib,base64; t=sys.stdin.buffer.read(); print('#text=:'+base64.urlsafe_b64encode(zlib.compress(t,9)).rstrip(b'=').decode())" < mytext.txt
```

Separate paragraphs with a blank line (`%0A%0A`); a single line break then counts as a space. In a text with no blank line at all, each line is taken as a paragraph. The text is otherwise read as the Catalogue reads any text (see **Find a text** above): letters keep their case, and their accents where the alphabet has them, and other characters become their nearest equivalents. A blog post of a few thousand words makes a link of a few thousand characters, well within what browsers accept; a whole novel would be too long for some browsers, which stop at about 80,000 characters.

### Links to books of the collection

A link to a book of the collection (see [Your books](#your-books)) carries no text, only the name of the book's file in `books/compressed/`: `#book=` and 20 characters, such as `https://babel.pellegr.in/#book=3f6bb9d6f78e0293b56a` for *Pride and Prejudice*. A book too long for one volume is set in several parts: `#book=…/3` leads to the third. And `&random` may follow, as for texts. The Catalogue's **Find a book** copies these links. Without `&random`, they lead to the same book whatever the seed.

A book that a link or the Catalogue has led you to can be shared again from the reading view: **Copy a link to it** copies the link that leads to it.

## Your books

The Library has a collection of ~1K copyright-free literature classics from the list of most read books of [Project Gutenberg](https://www.gutenberg.org). They are kept in `books/compressed/`. You can access those from the Catalogue's **Find a book** tab and read them from within the Library.

The Catalogue loads the list when **Find a book** is first opened, and a book's text only when you choose it, so the collection works the same whether the Library is opened by double-click or online.

The title, author and year come from the file name. If the name does not give an author, they come from the e-book's header, as for the Gutenberg files. Those can be added as they are: the Catalogue leaves out the licence that comes before and after the text, and the volunteers' credits. Leave a blank line between paragraphs. If there are no blank lines, each line is taken as a paragraph, and a file written on a single line is set as one long paragraph. Each book's script is named after its text, so shelving again only writes the books that are new or changed, and removes those that are gone.

Under **Other books**, anyone can also show the Catalogue a `.txt` file of their own with **Choose book files**. Browsers word this as "uploading", but the file is only read by the page and never leaves the computer. The Catalogue remembers those books in that browser until **Forget these books** is pressed.

## Dreams

Lie down on the bed of a cell (look at it and press `E`, click or tap) to sleep. The Library fades to black, and a dream comes out of the black: shapes like smoke seen through a kaleidoscope, now and then with the ghost of the Library's hexagons, of rings or of a spiral, in muted colours. Sentences fade in over it, one after another. Each one stays for `dreams.quoteDuration` seconds, then fades out, and the next one begins to fade in `dreams.quoteInterval` seconds later, while the dream melts into its next scene. Click, tap or press `Esc` to wake.

The visuals and text inside a dream are deterministically seeded from the address of the hexagon you sleep in (its gallery and floor numbers). The same hexagon always dreams the same dream, in the same order, and every other hexagon dreams another.

The sentences are grammatical but not necessarily sensible. A small English grammar (verbs agreeing with their subjects, *a* and *an*, plurals, tenses, relative clauses) builds them from some 450 single words drawn from the lexical fields of Algernon Blackwood, Jorge Luis Borges, Italo Calvino, Ted Chiang, Julio Cortázar, Brian Evenson, Thomas Ligotti, H. P. Lovecraft, Arthur Machen, Guy de Maupassant, China Miéville, Edgar Allan Poe, Clark Ashton Smith and Jeff VanderMeer. No phrase, name or invented place of theirs is used. No copyrighted materials are used.

## Files

In `index.html`, every file name is followed by `?v=` and a version, such as `js/main.js?v=2026-10-27.1`. Change the version (to anything new) whenever any file changes. Browsers, and GitHub Pages, keep copies of files for a few minutes; a new version makes them fetch every file again, so that a new page is never read with an old script.

| Path | Contents |
|---|---|
| `index.html` | The page |
| `config.js` | The configuration |
| `css/style.css` | Reading view, Catalogue and dreams |
| `js/library.js` | The mathematics: addresses, the bijection, text search, setting books in pages. No graphics. |
| `js/architecture.js` | Dimensions, geometry and lighting of hexagons, vestibules, stairs and cells |
| `js/world.js` | Streams the hexagons around the reader and dresses their books |
| `js/player.js` | Walking, the spiral stair, and picking a book, door, lamp, bed or Catalogue by gaze |
| `js/about.js` | The text of the Catalogue's About tab, in Markdown |
| `js/markdown.js` | Reads the Markdown of the About tab |
| `js/terminal.js` | The Catalogue's screen: the current position, finding texts and books, and going to hexagons |
| `js/textures.js` | Wood, plaster, stone, floor tiles and leather spines, painted at start-up |
| `js/quotes.js` | The sentences of dreams: a small English grammar and its vocabulary |
| `js/dream.js` | The moving picture of dreams, drawn by one shader |
| `js/main.js` | Start-up, reading, sleep |
| `lib/` | three.js r147 and its `Reflector` (MIT licence, see `lib/three.LICENSE`) |
| `tests/library.test.js` | Tests of the mathematics |
| `books/index.js`, `books/compressed/` | The collection, as the Catalogue reads it, written by `books/download_gutenberg_top1024.py` from the `.txt` files in `books/uncompressed/` (which are not published) |

## Testing

With Node.js installed, run `node tests/library.test.js`. The tests enumerate every shelf of five small libraries and check that each holds a different book and that the inverse map finds every book again. They then check round trips, text search and timing on the Library described by `config.js`, and on Borges's own figures, and finally the Catalogue: preparing texts, setting whole books in pages and splitting long ones into parts, leaving out Project Gutenberg's licence, finding them in books, distances that wrap around the Library, reading back copied addresses, and making and reading links to books. They also check positions measured from the seam, random hexagons to wake in, the Markdown of the About tab, and the sentences of dreams: grammatical, varied, and always the same for the same hexagon.

## Credits

Borge's story itself is not reproduced here for translation copyright reasons. 3D rendering uses [three.js](https://threejs.org). Typefaces are Libre Bodoni and Courier Prime, from Google Fonts, under the SIL Open Font License.