# Babel

A walkable rendering of Jorge Luis Borges's short story *The Library of Babel* (1941). The Library is generated from a seed, and every possible book stands on exactly one of its shelves. You can wander its galleries, climb its stairs, take down any volume and read it.

## Playing

On a Mac, double-click **`Play.command`**. It starts a small web server on your own computer (nothing is shared with the network) and opens the Library in your browser. Close its Terminal window to stop it. The first time, macOS may ask you to confirm that you want to open it.

A web server is needed because browsers do not let a page opened straight from the disk read `config.yaml`. If you double-click `index.html` instead, the page says so and offers to play with the default settings. On another system, run `python3 -m http.server` in this folder and open `http://localhost:8000`.

To put the Library online, turn on GitHub Pages for this repository (Settings → Pages → Deploy from a branch → `main`, folder `/`). It will then be served at `https://theaviationdoctor.github.io/Babel/`, and `config.yaml` is read from there.

| | |
|---|---|
| Look | mouse (click once to capture it) |
| Walk | `W` `A` `S` `D` or the arrow keys |
| Hurry | hold `Shift` |
| Take down the book you are looking at | `E` or click |
| Open or close the door you are looking at | `E` or click |
| Turn pages | `←` `→`, `Page Up` `Page Down`, `Home` `End` |
| Put the book back | `Esc` or `E` |
| Pause | `Esc` or `P` |

On a phone or tablet, drag on the right of the screen to look, hold and slide on the left to walk, and tap a book or a door.

The two typefaces load from Google Fonts. Without an internet connection the game still runs, with system fonts.

## Configuration

Everything about the Library's size lives in `config.yaml`, which is read once when the page loads. Edit it in any text editor, save, and reload the page.

```yaml
seed: borges

book:
  pages per book: 512
  lines per page: 32
  characters per line: 64

alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ:,!.? "

hexagon:
  walls with shelves: 4
  shelves per wall: 4
  books per shelf: 32
```

| Setting | Meaning |
|---|---|
| `seed` | Decides which book stands on which shelf. Any word or number; the same seed always gives the same Library. It can also be changed from the title screen and the pause menu. |
| `pages per book`, `lines per page`, `characters per line` | The size of every book. |
| `alphabet` | The symbols books are written in, in order. Each must appear once, at most 256 symbols. Keep the quotes, so that the punctuation and the final space are part of the text. |
| `walls with shelves` | 1 to 4. The other two sides of every hexagon are its doors. |
| `shelves per wall`, `books per shelf` | The size of the bookcases. |

Setting names may also be written `pages_per_book` or `pagesPerBook`. A book may hold up to 16,777,216 characters and a hexagon up to 65,536 books. The rooms are built to fit: the number of books per shelf sets the width of each hexagon, and the number of shelves sets the height of its ceiling. If a value is invalid, or the file is not valid YAML, the page says which line or setting is wrong.

Borges's own figures would be 410 pages, 40 lines, 80 characters, a 25-symbol alphabet, and 4 walls of 5 shelves of 32 books. They work too.

## How the Library is built

With the default configuration a book holds 512 × 32 × 64 = 2²⁰ = 1,048,576 characters from an alphabet of 32 = 2⁵ symbols. There are therefore 32^(2²⁰) = 2^5,242,880 possible books, about 10^1,578,264. Each hexagon holds 4 × 4 × 32 = 2⁹ = 512 of them, so the Library has 2^5,242,871 hexagons.

**Addresses.** Every shelf position has an index *v* between 0 and *N*^*M* − 1 (*N* symbols, *M* characters per book), written as *M* base-*N* digits. It decomposes as

    v = hexagon × S + slot              (S books per hexagon; slot = wall, shelf, volume)
    hexagon = floor × L + gallery       (L = N^m galleries per floor)

so each hexagon has a floor number and a gallery number, each about half a million symbols long. By default there are 32^524,287 = 2^2,621,435 hexagons along every gallery and 2 × 32^524,287 = 2^2,621,436 floors. The pause menu shows the current hexagon's address, written in the Library's own alphabet, and can copy it in full.

**Contents.** The book at index *v* is obtained by a permutation of the space of all books, keyed by the seed: a four-round Feistel network on the book's two halves. Each round adds, symbol by symbol and modulo *N*, a pseudorandom stream generated from a hash of the other half. A Feistel network can be run backwards whatever its round functions are, so the map from shelf to contents is a bijection. No two shelves hold the same book and no possible book is missing. Neighbouring books share nothing visible. Opening one takes a few tens of milliseconds, and all the arithmetic on the huge numbers is done digit by digit, without big-integer multiplication.

Because the map can be inverted, any text can be located. `findText` in `js/library.js` returns the hexagon, wall, shelf, volume and page of a book containing any given passage. The game does not use it yet.

**Shape.** Both the galleries and the floors wrap around: walk east for 2^2,621,435 hexagons and you are back where you started. The Library is finite, and from inside it has no edge. This is close to the hypothesis the narrator offers at the end of the story. When the number of books is not a multiple of the books per hexagon, as with Borges's figures, the very last hexagon is only partly filled.

**Cosmetics.** Spine colours and the letters on the spines come from a separate hash of the hexagon's address. They are not part of the bijection and, as in the story, they say nothing about what the pages contain.

## Architecture

The story leaves room for interpretation. This version reads it as follows.

- The hexagons are identical. Four sides carry shelves floor to ceiling, and the ceiling is a little above a librarian's head.
- The two free sides are opposite each other, so every floor is a single straight gallery of hexagons running east and west.
- Each free side opens onto a narrow vestibule leading to the next hexagon. It has a door on each side, a mirror, and a spiral stair that climbs and descends through every floor.
- Borges gives the vestibule two very small closets, one to sleep in standing up and one for bodily needs. Here the south door opens into a single cell of 2.2 × 2.1 m that serves both purposes. It holds a single bed, a small table fixed to the wall with a night lamp, a toilet, and a sink with a mirror. The north door stays shut. The cell sits in the wedge of space between two neighbouring hexagons. That wedge is about 4 m wide beside the vestibule and widens further away, so the cell fits whatever the size of the hexagons.
- In the middle of each hexagon an air shaft, with a very low railing, shows the floors above and below.
- Two spherical lamps hang in each hexagon, placed across the gallery. They are the only light.

## Files

| Path | Contents |
|---|---|
| `index.html` | The page |
| `config.yaml` | The configuration |
| `Play.command` | Double-click on a Mac to play locally |
| `css/style.css` | Title screen, reading view and menus |
| `js/library.js` | The mathematics: addresses, the bijection, text search. No graphics. |
| `js/architecture.js` | Dimensions, geometry and lighting of hexagons, vestibules, stairs and cells |
| `js/world.js` | Streams the hexagons around the reader and dresses their books |
| `js/player.js` | Walking, the spiral stair, and picking a book by gaze |
| `js/textures.js` | Wood, plaster, stone, floor tiles and leather spines, painted at start-up |
| `js/main.js` | Start-up, reading, pause menu |
| `lib/` | three.js r147 and its `Reflector`, and js-yaml 4.1.0, which reads `config.yaml` (both MIT licence; see the `.LICENSE` files) |
| `tests/library.test.js` | Tests of the mathematics |

## Tests

With Node.js installed, run `node tests/library.test.js`. The tests enumerate every shelf of three small libraries and check that each holds a different book and that the inverse map finds every book again. They then check round trips, text search and timing on the Library described by `config.yaml`, and on Borges's own figures.

## Credits

The story itself is not reproduced here. 3D rendering uses [three.js](https://threejs.org). Typefaces are Libre Bodoni and Courier Prime, from Google Fonts, under the SIL Open Font License.
