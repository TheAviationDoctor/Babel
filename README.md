# Babel

A Web-based walkable simulation of Jorge Luis Borges's *[Library of Babel](https://en.wikipedia.org/wiki/The_Library_of_Babel)* adapted from his 1941 eponymous story. It contains every book that was ever written, and every book that wasn't. The complication, of course, is knowing where to look.

## Features

- Permanent book locations (deterministically generated from a seed).
- Configurable environment (seed, book format, alphabet, bookshelves, look sensitivity, field of view).
- Interactive objects (books, terminal display, doors, beds, bedside lamps).
- Reverse-search any text and teleport to the corresponding book.
- Copy and share locations of any book or text, incl. secret password-encrypted links.
- Read from an index of copyright-free texts.
- A painting for every hexagon of books, each one different, and every possible painting somewhere.
- Find the passage where any picture hangs, and view famous copyright-free paintings.
- Traces of other librarians: figures glimpsed across the shaft, above and below, and pencil marks in the margins.

## Getting started

No installation required: everything is self-contained HTML/JS/CSS. Just visit the Library online at https://babel.pellegr.in/, or download the repo and open `index.html` locally in a recent browser. It even runs offline (except for a couple of Google Fonts which will then revert to your browser's defaults). Edit the `config.js` file to configure the Library as you wish.

| | |
|---|---|
| Look | mouse (click once to capture it) |
| Walk | `W` `A` `S` `D` or arrow keys |
| Hurry | hold `Shift` or turn on `Caps Lock` |
| Crouch | tap `C` to crouch, and again to stand; or hold it to crouch only while it is held. Crouched, the lower shelves are at eye level, and one walks slowly. |
| Interact with objects | `E` or click |
| Turn book pages | `←` `→`, `Page Up` `Page Down`, `Home` `End` |
| Find words in a book | `F` |
| Put a book back | `Esc` or `E` |
| Let go of the mouse | `Esc` (click to take it back) |
| Wake from a dream | click or `Esc` |
| Turn the music off or on | `M` |

On a phone or tablet, drag on the right of the screen to look, hold and slide on the left to walk, and tap to interact with objects. Tap again to wake from a dream.

## Is the Library infinite?

No. The Library is *finite* in that it contains a fixed number of unique books, hexagons, and floors. But it is *boundless* (no hard edge) and is *cyclic* in every direction. Keep heading east from cluster to cluster and, past the last cluster of a row, you are back in the first; keep heading south, past the last row of a floor, and you are back in the first; take the stairs up or down past the last floor, and you are back at the first, just like an ant walking endlessly on the surface of a torus (which each floor is, topologically speaking; the whole Library is its three-dimensional cousin).

Positions are measured from the *seam*, which is where the numbers of the clusters, the rows and the floors roll over: east–west between the last cluster of a row and the first, north–south between the last row of a floor and the first, and up–down between the last floor and the first. The Catalogue's **Map** tab (see [The Catalogue](#the-Catalogue)) shows your distance from every seam. Walking barely changes your position, since each cluster is only `2 × 10^-736,520%` of the way along its row.

## So how big is the Library?

Using the default settings from `config.js`:

- Each book holds `2^6 = 64` characters × `2^5 = 32` lines × `2^9 = 512` pages which yields `2^20 = 1,048,576` characters per book. That's about twice the length of a typical English novel, which gives plenty of headroom to capture most published literature.

- The alphabet contains `2^7 = 128` symbols: `26` uppercase and `26` lowercase letters from the modern latin alphabet (A–Z); `27` accented letters and ligatures from French and Spanish, plus the umlauts ä and ö, and five accented capitals; `10` base-10 digits (0–9); `38` punctuation marks and signs; and the standard space. Those symbols were chosen by counting every one of the 697 million characters of 871 of the most-read literary classics: they hold 99.9% of them exactly as printed.

- There are therefore `128^(2^20) = 2^7,340,032 ≈ 6.33 × 10^2,209,569` unique books in the Library. That's one followed by over 2.2 million zeros. If you kept repeating the word 'trillion' once per second, it would take you just over 51 hours to verbalize that number.

- The Library is arranged into floors, and each floor into hexagon-shaped rooms that tile it like the cells of a honeycomb, in clusters of seven: six hexagons of books round a seventh that holds the spiral stair (see [Is the Library three-dimensional?](#is-the-library-three-dimensional)). Each hexagon of books holds `2^2 = 4` bookshelves × `2^2 = 4` shelves × `2^5 = 32` books = `2^9 = 512` books per hexagon. Therefore, the Library has `2^7,340,032 / 2^9 = 2^7,340,023 ≈ 1.24 × 10^2,209,567` hexagons of books (and a sixth as many stair hexagons). Barely two order of magnitude fewer hexagons than books; for all intents and purposes, they are the same number.

> [!TIP] 
> There are about `10^80` atoms in our observable universe. Imagine every atom contained an entire universe, each with just as many atoms as ours. Then imagine every atom in *that* nested universe contained another universe, and so on. You would need nearly `28,000` levels of Matrioshka universes before the *cumulative* number of atoms approximated the number of books or hexagons in the Library.

- There are `2^2,446,672 ≈ 4.59 × 10^736,521` clusters along each row, `2^2,446,673 ≈ 9.17 × 10^736,521` rows on each floor (twice as many), and about `4.89 × 10^736,522` floors. The clusters and the rows are counted in powers of 2; there being six hexagons of books to a cluster, the floors are not (`2^2,446,678 / 6`, rounded up: the last floor is partly empty).

- A floor is 3.56 meters high. Two neighbouring hexagons stand 11.43 meters apart, so the clusters stand 30.23 meters apart along a row (11.43 × √7), and the rows 26.18 meters apart. The floors being so much closer together than the clusters, there are about ten times as many floors as clusters along a row, and the Library is nearly a cube: `1.39 × 10^736,523` meters from east to west, `2.40 × 10^736,523` from north to south and `1.74 × 10^736,523` from top to bottom. That is as near to a cube as whole powers of 2 allow: double the clusters along a row, or the rows, and one side would be too long instead.

> [!TIP] 
> The Library spans `1.5 × 10^736,507` light-years from east to west, `2.5 × 10^736,507` from north to south and `1.8 × 10^736,507` from top to bottom. The Library could fit our observable universe `1.6 × 10^736,496` times from east to west, `2.7 × 10^736,496` times from north to south and `2.0 × 10^736,496` times from top to bottom. At walking pace, crossing the length of one row would take about `3 × 10^736,515` years.

## Is the Library three-dimensional?

At the mesoscopic (human) scale, it feels like it is: you can walk forward and back, left and right, and take the stairs up and down.

At the macroscopic scale, it is too. In the original story, Borges never says which sides of the hexagons are free, nor how the hexagons fit together. This Library follows the reading of the architect Antonio Toca Fernández ([Casa del Tiempo, October 2009](https://www.uam.mx/difusion/casadeltiempo/24_iv_oct_2009/casa_del_tiempo_eIV_num24_77_80.pdf)): the hexagons tile every floor like a honeycomb, in modules of seven, six hexagons of books joined round a seventh. Here that seventh, the *stair hexagon*, has a door in each of its six sides and holds no books: in its middle is a shaft like that of every hexagon of books, behind the same low railing, with the same walkway nearly two metres wide round it, and in the shaft the spiral stair that joins the floors. On the side of the shaft that faces one of the doorways, the railing is open and the floor runs on into the shaft as the stair's landing, a sixth of it: from there the stair goes up one way and down the other, each flight turning five sixths of the way round, 20 steps from one floor's landing to the next one's, directly above. Like the landing, the treads fill the shaft out to its edge, and a walnut string closes their outer ends; the stair has no handrail, since one could only fall back to the floor. Along the side the stair rises from the landing by, its string, rising from the floor, stands in for the railing. From the stair, or over the railing, the shaft and the stair are seen going up and down. Each of the six hexagons round it has two free sides, 120° apart, and four walls of shelves, as in the story: one free side gives onto the vestibule that leads to its stair hexagon, the other onto a passage that leads to a hexagon of the next cluster. In the middle of the vestibule, the door of the cell and the Catalogue's niche face each other across it (the cell fits in the wedge between the rooms; a small mirror hangs above its sink). The passage holds the paintings of the two hexagons it joins, each on the right as one leaves its hexagon, a third of the way along. Vestibules and passages are as wide as a bookcase without its end panelling, 2.65 metres.

Each bookcase is built in four bays of eight books, with a wooden pilaster between bays and panelling at either end: a shelf of 32 such books weighs over 100 kilograms, and would sag across the whole wall. Plates name the bookcases, `A` to `P` clockwise round the room (as many letters as there are bookcases), on the cornice above each; and on the panelling at the left of each wall, others number the rows of books, `I` at the top to `IV` at the bottom (in Roman numerals). A book's place is given by them: its bookcase, its row, and its place along the row, such as *Bookcase C, row I, volume 5*. Like the signs over the doorways, every plate is a cartouche of dark walnut, with hollowed corners and rounded ears, a gilt rule inside its edge and gilt letters.

Each cluster is joined to the six clusters round it, one passage to each, so every hexagon of a floor can be walked to from every other, in six directions. The signs over the doorways name the way one is facing: east, south-east, south-west, west, north-west or north-east. A hexagon's number on its floor is its cluster's number times six, plus its place round the stair; and a cluster's number is its row, times the number of clusters in a row, plus its place along the row. So each book's index splits into floor, row, place along the row, and place round the stair.

## Motivation

Here I explain what motivated me to build this Library.

I was mindblown by Borges' *La biblioteca de Babel* when I first read it at a young age. The story itself is rather brief (only ten pages) relative to its ambition and reads more like a stub of an idea, but its implications loom large for the imaginative reader. Central to the story is the *quest for meaning* (defined here as syntactically correct and semantically sensible permutations of text) in a gibberish-dominated universe (for which the Library is but a scaled metaphor).

A first practical implication from Borges' story is the apparent paradox of boundlessness in a finite spacetime. The Library has no hard edge; walk past any east-west, north-south or top-bottom seam and you will keep rolling over. But time is finite, so your exploration is constrained by either your resoluteness or biological lifespan (whichever is shorter). In *[A Short Stay in Hell](https://en.wikipedia.org/wiki/A_Short_Stay_in_Hell)*, author Steven L. Peck explores this theme, thought a bit awkwardly for my taste. An avid book reader dies and gets cast into a version of hell that is the Library of Babel, in which he must find a book flawlessly narrating his life's story to buy his ticket to heaven. The twist, of course, is that the protagonist is immortal, so all that matters is his resoluteness to search, which gets tested over unfathomable aeons. Lovecraft's words come to mind: *That is not dead which can eternal lie, and with strange aeons even death may die.*

Proverbially, humans call this *finding a needle in a haystack*. The odds of finding that needle are astronomically small. Given this very Library's default configuration, one should expect to find a cogent short four-word sentence (such as `A cat sat up`) in one in every `10^17` books, or one hundred quadrillion books. Scanning each book at a thousand characters per second, one would need about three trillion years, or ~200 times the age of our universe. I find poetic absurdity in the asymmetry between the size of such a trivial needle and that of the haystack.

Adjacent is the (perhaps superficially) mind-blowing implication that every text that is *yet to be written* is already contained in the Library. Like the ultimate physical instantion of the biblical aphorism *nil sub sole novum*, the Library teaches us that information-wise, there is nothing ever truly novel in this universe. All future concepts and ideas, all latent literature and poetry, all unborn love letters and technical manuals —and yes, even your entire life story— are just waiting to be discovered on some galactically distant bookshelf, like relics being unearthed from the grounds of all possibilities. Of course, the odds are squarely in favor of those texts remaining undiscovered. Which makes the Library analogous to our universe in one more way: paraphrasing Carl Sagan in *Contact*, the Library is a pretty big place; if it's just the books within human reach, it seems like an awful waste of space.

Another implication relates to meaning *itself*. With deterministic certainty, although comically and cosmically low odds, one may chance upon a book containing some sensical sentence. Alternatively, one may use the Library's reverse-search function and cheat one's way to any desired text. But what then? No author purposedly wrote those words; no librarian deliberately curated them. They are a random byproduct of the [infinite monkey theorem](https://en.wikipedia.org/wiki/Infinite_monkey_theorem). The clearest illustration of this point is that every truth and its contrary are contained in the Library. `The sun rises in the east.` and `The sun rises in the west.` are present in exactly `1.08 × 10^2,209,521` books each, but their mere existence does not make either statement true or false, respectively. That makes the galactic abundance of ideas in the Library orthogonal to their relevance, like empty calories from AI slop. There is, in fact, an analogy here with Large Language Models, which optimize for plausibility over insightfulness. Given a high-enough temperature setting, they may create any meaningless permutation of grammatically correct and semantically sensical text, like a marginally less wasteful Library of Babel.

A final angle I have to offer to this is that the search for meaning in one's life is a characteristically *anthropogenic* pursuit. Animals and plants, inert matter and energy, and the universe at large, do not seem to care about meaning, purpose, or morality. In fact, one could argue that many humans don't either, and just go through the motions of life seemingly unencumbered by existential angst (charitably, they may be the wise ones in this context). And thus, perhaps, that human longing for meaning is a red herring, an accidental and undesirable byproduct of Homo sapiens' cognitive evolution. This view is consistent with Peter Zapffe's "existential elk" reinterpretation of Nietzsche's *Übermensch* in his essay *[The Last Messiah](https://en.wikipedia.org/wiki/The_Last_Messiah)*. Put simply, we've grown too self-aware for our own good, and we create elaborate contraptions (for which the Library is again a metaphor) to isolate, anchor, distract, or sublimate ourselves away from the dread of cosmic absurdity.

One final thought: I did not mean for this Library to be just a depressing allegory for the human condition. I wanted to create a version that still played on the core concept (a quasi-infinite number of permutations of symbols), yet produced *meaning*. This is why I added a reverse-search feature to find whatever text you, dear Visitor, would like to link to and share with others, as well as an ever-growing index of copyright-free literary classics for anyone to read. Those two features combined turn an abstract concept into a practical Library. And it's free, which is a good deal considering it contains *all the books*!

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
| `sound.music` | `true` | Whether the hexagons play their music. `false` for silence, until `M` is pressed. See [Music](#music). |
| `sound.volume` | 0.5 | How loud the music is, from 0 to 1. |

A book may hold no more than `2^24 = 16,777,216` characters and a hexagon no more `2^16 = 65,536` books. The rooms are built to fit: the number of books per shelf sets the width of each hexagon (and the number of bays of its bookcases, about half a metre each), and the number of shelves the height of its bookcases, under a ceiling at least 3.2 metres high. If a value is invalid or a setting's name is misspelt, the page says which one and why.

The default alphabet is meant to hold classic literature as it was printed, so that the Catalogue can find the classics on the shelves (see [Your books](#your-books)) while staying a power of two like every other figure. It was chosen by counting every character in the Library's collection of ~1K books. After the 26 letters in both cases, the commonest characters by far are curly quotation marks, found in about half of the 871 English books. Then come the accented letters of French (é alone appears in 476 of those books), the umlauts of German names and of old spellings (Königsberg, Göttingen, coöperation), and the letters of Spanish (á, ñ). Guillemets (« ») and the inverted marks of Spanish (¿ ¡) appear in every French and Spanish book. Five accented capitals begin enough words to earn their place (À Ç É Æ Œ); other capitals lose their accents (Ê becomes E), as much French printing long did. The 27 marks and signs of the Library's first alphabet stay, and the en dash, the half and the multiplication sign complete the 128. The rest of the keyboard (`{ } | ^ ~ < > @ \` and the backquote) is left out: the collection uses it almost only for transcribers' markup and tables, and on a random page it would look like computer code. Greek is left out too: some 60 books quote it, but it would need 24 letters and their accents.

The Library's first alphabet had 64 symbols, with the letters in capitals only, as in Borges's story. It is still in `config.js`, one line away, for those who prefer it.

Any change to these values, the seed included (but not `website`, `view` or `dreams`), gives a different Library: an address copied before then no longer leads to the same books.

Borges's own figures would be 410 pages, 40 lines, 80 characters, a 25-symbol alphabet, and 4 walls of 5 shelves of 32 books. They work too in case you'd like to try them.

## How the Library is built

**Addresses.** Every shelf position has an index *v* between 0 and *N*^*M* − 1 (*N* symbols, *M* characters per book), written as *M* base-*N* digits. It decomposes as

    v = place × S + slot                (S books per hexagon; slot = wall, shelf, volume)
    place = (floor × C + cluster) × 6 + petal   (C clusters on each floor; petal = which of the cluster's 6 hexagons of books)
    cluster = row × W + column          (W clusters along each row)

so each hexagon of books has a place in the whole Library, made of a floor number and a hexagon number (its number on that floor, cluster × 6 + petal), and the cluster's number is made of a row and a column (its place along the row). W and C are chosen to make the Library as nearly a cube as can be, as wide from east to west and from north to south as it is tall, given how far apart the clusters, the rows and the floors stand: since the alphabet has 2^7 symbols, every cluster's place is a string of bits, and the column takes the lowest of them, the row the next, the floor what is left, as many to each as make the three sides most nearly equal. By default there are 2^2,446,672 clusters along every row, about 4.6 × 10^736,521, twice as many rows on every floor, and about 4.9 × 10^736,522 floors. A hexagon number is 699,050 symbols long, and a floor number 349,526. (With an alphabet whose size is not a power of 2, the numbers are split between its symbols instead, as nearly as that allows.) The stair hexagons have no numbers of their own. The Catalogue's Map tab copies the current hexagon's full address, written in the Library's own alphabet.

**Contents.** The book at index *v* is obtained by a permutation of the space of all books, keyed by the seed: a four-round Feistel network on the book's two halves. Each round adds, symbol by symbol and modulo *N*, a pseudorandom stream generated from a hash of the other half. A Feistel network can be run backwards whatever its round functions are, so the map from shelf to contents is a bijection. No two shelves hold the same book and no possible book is missing. Neighbouring books share nothing visible. Opening one takes a few hundredths of a second, and all the arithmetic on the huge numbers is done digit by digit, without big-integer multiplication.

Because the map can be inverted, any text can be located: `findText` in `js/library.js` returns the hexagon, wall, shelf, volume and page of a book containing any given passage. The Catalogue in every vestibule uses it (see below).

**Shape.** The floors, the rows and the clusters along them all wrap around: head east for 2^2,446,672 clusters, or south for 2^2,446,673 rows, and you are back where you started. The Library is finite, and from inside it has no edge. This is close to the hypothesis the narrator offers at the end of the story. The clusters of a floor hold a number of hexagons that does not divide the Library's, so the last floor is partly empty: its last hexagons have bare shelves, and, when the number of books is not a multiple of the books per hexagon, as with Borges's figures, the last hexagon with books is only partly filled.

**Paintings.** Each hexagon also has a painting in its passage, numbered the same way (see [Paintings](#paintings)).

**Cosmetics.** Spine colours and the letters on the spines come from a separate hash of the hexagon's address. They are not part of the bijection and, as in the story, they say nothing about what the pages contain. A book of the collection reached from the Catalogue, or by a link to it, goes by its own title instead, for the rest of the visit.

**Patina.** The hexagons are built alike, as in the story, but no two have aged alike. From the same hash, each has its own wear and its own lamps, the same on every visit: the texture of its plaster starts in a different place and turns a different way; its wood is a little darker or lighter, and grimy low down where feet have kicked it; damp has risen up its walls to a tide line of its own, and water has left stains on them and soot on its ceiling; its floor is worn paler where feet go, round the shaft (more on one side than the other) and along the vestibule, and here and there stained with spilt ink. The lamps above its bookcases burn a little warmer or cooler, brighter or dimmer than others. In about one hexagon in thirty, a lamp flickers, and in one in a hundred and fifty, a lamp has gone out.

**Paper.** A book opens at two facing pages, odd pages on the right as in print, so that page 1 faces the inside of the front cover; on a narrow screen, at one page at a time. It lies open on its own leather, the colour of its spine on the shelf, and the leaves already read, or still to read, show at its fore-edges. Like the spines, its paper says nothing about what the pages contain: it comes from the book's place in the Library, so it is the same on every visit. Each book has its own paper, from nearly white to deep yellow, and its own ink, a little faded on old paper. Its edges are browned by light and air (the head most of all, where the dust of the shelf settles), frayed, worn round at the corners, and here and there chipped or torn. There are clouds in the paper, and in many books foxing, small rust-brown spots in clusters; the grey of thumbs at the corner where the pages are turned; now and then a corner folded down. In some books, water once soaked in: its tide line marks the same place on every page it reached, fainter towards the last.

**Words.** Chance writes real words now and then, and in a book drawn by chance **Find words** (or `F`) makes them glow on the page, the longer the brighter and the warmer, from lamplight to crimson. A word is one of some 34,000 common English words of four to eight letters, written within a line in any mix of capitals, so that `tReE` is the word *tree*; where two overlap, the longer is kept. The line under the book names the words on the pages open, and the page of the next one. They are rare, and the longer the rarer: with the default alphabet, a book holds some 130 words of four letters, about one every other spread; one of five letters turns up once in some sixty spreads, one of six about once in a dozen books, and one of seven once in hundreds. A book that the Catalogue or a link leads to holds a text laid in it, full of words by design, so the reader does not look for words there. The finder stays on or off from one book, and one visit, to the next.

**Other librarians.** The reader never meets anyone, yet is not alone. Now and then, while they are in a hexagon, another librarian in a habit like theirs appears across the shaft, pale and a little translucent, seen only through the shaft. Perhaps they are only images of librarians of other times, with no part in the present; and perhaps, to some reader yet to come, the reader is one of them.

Every three or four minutes spent in the hexagons, on average, one stands at the railing of a floor above, looking down into the shaft: most often on the next floor, now and then two or three floors up. Looked at for a few seconds, it slowly raises its hood towards the reader. As often, another stands at a bookcase of a floor below, the next or the one after, with its back to the shaft, browsing: its hood wanders along the books, and now and then it moves along to others. It never looks up, and it is seen only by leaning over the railing and looking down.

Neither comes where the reader is already looking. Looked at for long, either fades. Look away, and it is gone. Neither is there when the reader gets there: they leave as soon as the reader leaves the hexagon, for the stairs or another hexagon, or opens a book. Unseen for a minute and a half, they go too.

Others have read the books before. About one book in four has had a reader who marked in pencil some of the real words chance wrote in it (see **Words** above): every word of six letters or more, most of those of five, a few of those of four. That is some thirty marks in a book, about one every eight spreads, and nowhere but beside a word. Each reader had one to three habits of their own, out of eight: an asterisk or an exclamation mark in the margin (doubled for a long word), a question mark, a tick, a line down the margin, an arrow at the line, the word underlined, or the word circled. The pencil is a faint grey, each reader's a little darker or lighter, and its marks show whether **Find words** is on or off. Like the paper, they come from the book's place in the Library, so they are the same on every visit. A book in which the Catalogue or a link has laid a text has no pencil marks.

## The Catalogue

Every hexagon of books has one, in the vestibule that leads to its stair hexagon. There is no menu in the Library, so the Catalogue is also where you find your bearings. It has four tabs.

**Map.** Where you are: how far from where you woke (or, after a jump, from where you arrived), and how far east of the Western seam, south of the Northern seam and above the Lower seam, with the percentage of the way round. After a jump through the Catalogue, it says how far the jump went, measured the shorter way round, such as `1.6 × 10^736,521 clusters west, 3.4 × 10^736,521 rows south and 2.2 × 10^736,522 floors down`. The rest of the tab is a map of the whole Library seen from the side (from the south, its rows one behind another), as large as the screen allows and drawn to its proportions (nearly square, the Library being nearly a cube). Its four sides are the seam, named Upper, Eastern, Lower and Western, each joining the side opposite. The hexagon you are in blinks on it, and an outlined hexagon marks where the last jump began. A button below the map copies the hexagon's full address, to come back to it later from **Jump**, and another opens this project on GitHub.

**Find.** Two sub-tabs: **Find book** and **Find painting**.

**Find book.** Type or paste anything into it, or load a plain-text file with **Upload .txt** (the file is only read by the page, and never leaves the computer). Letters keep their case, and their accents where the alphabet has them; other letters lose their accents (Ê becomes E, ō becomes o). Tabs become spaces, and `--` becomes a long dash. Other characters become their nearest equivalents in the alphabet: ß becomes ss, … becomes ..., ¼ becomes 1/4, a ligature such as ﬁ becomes fi, and so on (the screen says which). What has no equivalent, such as Greek, is left out (the screen lists it). The text is then set in lines of 64 characters, as on the pages of a book: a word that would be cut at the end of a line goes to the start of the next, no line starts with a space, and each new paragraph starts after a blank line, indented by three spaces. Blank lines separate paragraphs; in a text without any, each line is a paragraph. Spaces within a paragraph count once, so a short text on one line is set exactly as typed. The Catalogue then runs the shelving backwards. It composes the book that begins with your text, the rest of its pages blank, and the inverse permutation gives the hexagon, bookcase, row and volume where that book stands. Since every possible book exists exactly once, it is certainly there. It is also almost always astronomically far away, so the screen gives the distance as a power of ten. To read it, go there: you are set down in front of it, and the volume stands a little out of its row. You can also copy its location (the address of its hexagon, for the **Jump** tab, with its bookcase, row and volume), a public link to it, or a secret link to it (see [Links to books](#links-to-books)).

**Find painting.** Upload a picture (GIF, JPEG or PNG; it is only read by the page, and never leaves the computer) to find the passage where it hangs as a painting of the Library (see [Paintings](#paintings)). The picture is cropped to a square, keeping its middle, or, with **Fit it whole**, fitted whole on a mat of lead white; resampled to 1,024 × 1,024 pixels; and each pixel given the nearest of the 128 colours, the difference carried over to the pixels not yet given theirs (Floyd–Steinberg dithering), so that from a little way off the eye mixes the colours back. Last, in each of the first two rows, the one pixel whose change shows least is changed to keep the paintings' rule. The screen shows the painting and where it hangs; you can go there, and stand before it, or copy its location. The same picture always gives the same painting, but browsers do not all read a picture file to exactly the same pixels, so another browser may find it in another vestibule.

**Browse.** Two sub-tabs: **Browse books** and **Browse paintings**.

**Browse books.** The Catalogue can also find a whole book: any book of the Library's own collection (see [Your books](#your-books)), which it lists with a search box, by title or by author. It sets the text in pages, the way a book of this Library holds them: from the first page, 64 characters to a line and 32 lines to a page, with words kept whole and each paragraph starting on a new, indented line. The rest of the 512 pages are blank. It then finds the one book of the Library that holds exactly those pages. To read it, go and take it down from its shelf; you can also copy its location or a public link to it (see [Links to books](#links-to-books)). A text longer than one book is set in several parts, one after the other, and each part is found separately.

**Browse paintings.** Some famous copyright-free paintings, hung in the Library as **Find image** would hang them with **Fit it whole**, listed with a search box, oldest first, by title or by painter (see [Your paintings](#your-paintings)). Choose one to see it as the Library holds it and where it hangs; you can go there, copy its location, or copy a public link to it (see [Links to paintings of the collection](#links-to-paintings-of-the-collection)).

**Jump.** Move any number of clusters east or west, rows south or north, and floors up or down: you arrive in the same hexagon of the cluster reached. Paste a full address, as copied from the Map tab, to return to a hexagon you have bookmarked, even after closing the page. An address copied from a Library with another seed is refused, since its books stand elsewhere. Or go somewhere at random. After a jump, the Map tab counts your steps from where you arrived.

## Links to books

A book's address cannot serve as a link: it is as long as the book itself (1,048,576 symbols, about a megabyte). This is because shelving is a bijection, so there are exactly as many addresses as books, and addresses cannot on average be shorter than what they point to.

There are three other kinds of links instead, all written after the `#` of the Library's address, a part that browsers never send to the server: links to texts, secret links to texts, and links to the books of the collection.

### Links to texts

A link to a text carries the text itself:

    https://babel.pellegr.in/#text=<the text>

Whoever opens the link is set down in the Library before the book that holds exactly that text from the very start of its first page (set in lines as in **Find text**), with the rest of its pages blank, the volume standing a little out of its row. It is the book the Catalogue's **Find text** sub-tab finds, and the link its **Copy a public link** copies. The Library runs the shelving backwards to find it, so the same text always leads to the same book, and a link keeps leading to the book that holds its text even if the seed or the configuration change. Such a link can be built without the book ever having been found.

**Building a link.** The text after `text=` takes one of two forms; both lead to the same book.

- **Plain:** the text itself, percent-encoded, as a web address must write it: a space as `%20`, a line break as `%0A`, `é` as `%C3%A9`, and so on. For a short text, you can even type it "as is" into the address bar, and the browser will encode it.

- **Compressed:** a colon, then the text's UTF-8 bytes compressed with zlib's deflate and written in URL-safe base64 without the trailing `=` signs. It is typically about a third as long as plain text, except for short texts. The Catalogue's links use whichever form is shorter.

For text you’ve copied and you'd like to link to in the Library, this terminal command creates the link and places it straight back in your clipboard:

```
pbpaste | python3 -c "import sys,zlib,base64; t=sys.stdin.buffer.read(); print('#text=:'+base64.urlsafe_b64encode(zlib.compress(t,9)).rstrip(b'=').decode(), end='')" | pbcopy
```

If the text you'd like to link to is inside the file `mytext.txt`, use this:

```
python3 -c "import sys,zlib,base64; t=sys.stdin.buffer.read(); print('#text=:'+base64.urlsafe_b64encode(zlib.compress(t,9)).rstrip(b'=').decode())" < mytext.txt
```

The text is read as the Catalogue reads any text (see **Find text** above): letters keep their case, and their accents where the alphabet has them, other characters become their nearest equivalents, and the text is set in lines and paragraphs. A blog post of a few thousand words makes a link of a few thousand characters, well within what browsers accept; a whole novel would be too long for some browsers, which stop at about 80,000 characters.

### Secret links

A secret link carries a text encrypted with a password, so that the link alone cannot be read:

    https://babel.pellegr.in/#secret=<the text, compressed and encrypted>

The Catalogue makes one with **Copy a secret link**, beside **Copy a public link**, in the **Find text** sub-tab. Choose a password (at least 8 characters; a few words make a stronger one, and one easier to remember), then copy the link. Whoever opens it is asked for the password before the Library sets them down before the book, the same book as an ordinary link to that text would lead to. Give the password separately, by voice or in another message: it is in no link, and kept nowhere, so a forgotten password cannot be recovered. Reading the book from there, **Copy a link to it** copies the secret link again, not the text.

The text is compressed as in other links, then encrypted with AES-GCM under a key made from the password with PBKDF2 (SHA-256, 600,000 rounds, which makes guessing passwords slow). All of it happens in the browser. A secret link is about 60 characters longer than the compressed link to the same text. Whoever has the link can still try passwords one after another on their own computer, so a short or common password can be found; and whoever opens the book can read the text, and pass it on.

### Links to books of the collection

A link to a book of the collection (see [Your books](#your-books)) carries no text, only the name of the book's file in `books/compressed/`: `#book=` and 20 characters, such as `https://babel.pellegr.in/#book=347482c8cdafa33b5217` for Borges's *La Biblioteca de Babel*. A book too long for one volume is set in several parts: `#book=…/3` leads to the third. The Catalogue's **Browse books** sub-tab copies these links. They lead to the same book whatever the seed.

A book that a link or the Catalogue has led you to can be shared again from the reading view: **Copy a link to it** copies the link that leads to it.

### Links to paintings of the collection

A link to a painting of the collection names it likewise, by the name of its file in `paintings/compressed/`: `#painting=` and 20 characters, such as `https://babel.pellegr.in/#painting=0d8bc30831c03f9182fb` for Bruegel's *The Tower of Babel*. Whoever opens it is set down in its passage, before it. The **Browse paintings** sub-tab copies these links. A picture uploaded to **Find image** has no such link, since a link to it would have to carry the whole painting, over half a million characters.

## Your books

The Library has a collection of books, kept in `books/compressed/`. You can find them from the Catalogue's **Browse** tab, under **Browse books**, and read them from within the Library.

The Catalogue loads the list when **Browse books** is first opened, and a book's text only when you choose it, so the collection works the same whether the Library is opened by double-click or online.

Books are Markdown files (`.md`) that open with a front matter, between two lines of three hyphens, which gives the book's `author`, `title`, `year` and language (`lang`, as a code such as `en`, `fr` or `es`, or by name) for the list, and is not part of the book. Each property is its name, a colon right after it, a space and its value:

```
---
author: Jorge Luis Borges
lang: es
title: La Biblioteca de Babel
year: 1941
---
```

The text after it goes into the Library as it reads in print, since the Library's books have no italics, headings or footnotes: the marks of emphasis are left out (`*word*` becomes word), as are those of headings, quotations, links and code; a footnote's mark becomes its number in brackets (`[^1]` becomes [1]), and so does the start of the note itself; a rule between parts becomes three spaced asterisks. Leave a blank line between paragraphs: lines with no blank line between them are one paragraph, as in Markdown. Whatever the front matter leaves out comes from the file name, written `Author - Title (Year).md`. The front matter is read strictly: a line that is not a property as above, such as `author : Borges` with a space before the colon, is reported, and its book is left off the shelf until it is mended.

Plain-text files (`.txt`) are shelved too, as they are, their title, author and year from the file name. If a plain-text file has no blank lines, each line is taken as a paragraph, and a file written on a single line is set as one long paragraph.

**Adding books.** Put the books in `books/uncompressed/`, which is not published, then shelve them with Node.js:

```
node books/shelve.js
```

It compresses each new or changed book into a script of its own in `books/compressed/`, named after a hash of its text (which is also its `#book=` link), removes the scripts of the books whose file is gone, and rewrites the list, `books/index.js`. Books it has shelved before, unchanged since, are not read again, so it takes but a moment. A copy of the repository without `books/uncompressed/` leaves the shelf as it is.

A git hook, `.githooks/pre-commit`, runs the script before every commit and adds what it changed to the commit. Git uses it once told where the Library keeps its hooks, which is done once per copy of the repository, in its folder: `git config core.hooksPath .githooks`. Note that `books/uncompressed/` is not part of the repository, so new books on their own leave nothing to commit: run the script yourself then, and commit what it wrote.

## Paintings

Every hexagon of books has a painting, in the passage that leaves it for the next cluster: on the right as one leaves the hexagon, a third of the way along, under a small picture lamp. The painting of the hexagon at the other end hangs on the opposite wall, a third of the way along from its end. A plate under each painting bears its name: drawn by chance from the hexagon's place, like the letters on a book's spine, except for a painting of the collection reached from the Catalogue, which bears its own name. A painting is 1,024 × 1,024 pixels, each one of 128 colours: the sixteen pigments of an old painter's box (lead white, bone black, lead-tin yellow, yellow ochre, raw and burnt sienna, burnt umber, vermilion, madder lake, Tyrian purple, ultramarine, azurite, indigo, verdigris, malachite and green earth), each in eight mixtures from a shade to a tint, lead white and bone black making a scale of sixteen greys.

As with the books, every possible painting hangs somewhere, and only once. There are 128^1,048,576 pictures of that size, which is 2^7,340,032, but 512 times fewer hexagons, 2^7,340,023. So a painting keeps a rule that one picture in 512 keeps: the colour numbers of its top row add up to a multiple of 128, and those of its second row to a multiple of 4 (128 × 4 = 512). The rule is invisible, since any pixel can still take any colour, and it does not depend on the order of a row's pixels. So the mirror image of a painting, each row read backwards, is a painting too: that of some other hexagon of the Library.

Which painting hangs in which hexagon is scrambled by a Feistel network of its own, keyed by the seed like the books, so that neighbouring hexagons have unrelated paintings: the hexagon's place (its floor and hexagon numbers, 7,340,023 bits) goes through the network, and its digits fill the pixels row by row, the last pixel of the first two rows being set to keep the rule. Run backwards, the network finds the hexagon of any painting (`placeOfPainting` in `js/library.js`).

Almost every painting is coloured static, as almost every book is gibberish, and a recognisable picture is as rare as a sensible sentence. From a few steps away its million pixels blend, as a screen's few hundred pixels cannot show them all; walk up to the canvas to see them one by one. Only the paintings of the passages beside your hexagon are drawn; the others show the colour a painting averages to.

With another configuration, the paintings follow the books: as many pixels as a book has characters, in as many colours as the alphabet has symbols. When the books per hexagon are not a power of the alphabet's size times a divisor of it (with Borges's own figures, 640 books and 25 symbols), no rule on rows can make every painting unique, and the passages have no painting.

## Your paintings

The Library has a small collection of famous copyright-free paintings, hung in `paintings/compressed/` and listed in `paintings/index.js`: Leonardo's *Mona Lisa*, Bruegel's *The Tower of Babel*, Vermeer's *Girl with a Pearl Earring*, Turner's *The Shipwreck*, Friedrich's *Wanderer above the Sea of Fog*, Hokusai's *The Great Wave off Kanagawa*, Monet's *Impression, Sunrise*, Van Gogh's *The Starry Night*, Munch's *The Scream* and Klimt's *The Kiss*. The pictures are photographs of the paintings, which are in the public domain, from Wikimedia Commons. Each is kept as the Library holds it, its million colour numbers compressed into a script of its own, which the Catalogue loads only when the painting is chosen.

**Adding paintings.** Put pictures (GIF, JPEG or PNG) in `paintings/originals/`, which is not published, named after their paintings, `Painter - Title (Year).jpg`, such as `Vincent van Gogh - The Starry Night (1889).jpg`. Then hang them with Node.js:

```
node paintings/hang.js
```

It fits each new or changed picture whole on a mat, paints it in the Library's colours as **Find image** does, writes it into a script of its own in `paintings/compressed/`, named after a hash of the painting (which is also its `#painting=` link), removes the scripts of the paintings whose picture is gone, and rewrites the list, `paintings/index.js`, oldest first. Node.js reads PNG files itself; JPEG and GIF files are first turned into PNG by the computer, on a Mac by `sips` (which every Mac has), elsewhere by ImageMagick or Python's Pillow. The git hook runs it before every commit too, as it does for the books, if Node.js is installed. Pictures it has hung before, unchanged since, are not read again.

## Dreams

Lie down on the bed of a cell (look at it and press `E`, click or tap) to sleep. The Library fades to black, and a dream comes out of the black: shapes like smoke seen through a kaleidoscope, now and then with the ghost of the Library's hexagons, of rings or of a spiral, in muted colours. Sentences fade in over it, one after another. Each one stays for `dreams.quoteDuration` seconds, then fades out, and the next one begins to fade in `dreams.quoteInterval` seconds later, while the dream melts into its next scene. Click, tap or press `Esc` to wake.

The visuals and text inside a dream are deterministically seeded from the address of the hexagon you sleep in (its hexagon and floor numbers). The same hexagon always dreams the same dream, in the same order, and every other hexagon dreams another.

The sentences are grammatical but not necessarily sensible. A small English grammar (verbs agreeing with their subjects, *a* and *an*, plurals, tenses, relative clauses) builds them from some 450 single words drawn from the lexical fields of Algernon Blackwood, Jorge Luis Borges, Italo Calvino, Ted Chiang, Julio Cortázar, Brian Evenson, Thomas Ligotti, H. P. Lovecraft, Arthur Machen, Guy de Maupassant, China Miéville, Edgar Allan Poe, Clark Ashton Smith and Jeff VanderMeer. No phrase, name or invented place of theirs is used. No copyrighted materials are used.

## Music

Each hexagon plays its own soft music, made as it plays: nothing is downloaded. Like the hexagon's patina and its lamps, the music comes from a hash of its address, so it is the same on every visit. Each hexagon has its own key and mode (Lydian, Ionian, Mixolydian, Dorian or Aeolian). Over a quiet bass, a pad of four voices holds an open chord and drifts every half-minute or so to another chord of the mode. Now and then a soft bell sounds from the same scale, alone or in a short figure, and every so often two high, glassy tones swell and fade. Beneath it all is the faint breath of air in the shaft, and everything rings in a long reverb.

Walk from one hexagon to the next and the music of the one fades into the music of the other along the vestibule between them; climb the stairs and it fades into the next floor's. Browsers only let a page make sound once you have clicked, tapped or pressed a key, so the music begins then. `M` turns it off and on, and the Library remembers your choice. `sound.music` and `sound.volume` in `config.js` set whether it plays at first and how loud.

## Files

In `index.html`, every file name is followed by `?v=` and a version, such as `js/main.js?v=2026-10-27.1`. Change the version (to anything new) whenever any file changes. Browsers, and GitHub Pages, keep copies of files for a few minutes; a new version makes them fetch every file again, so that a new page is never read with an old script.

| Path | Contents |
|---|---|
| `index.html` | The page |
| `config.js` | The configuration |
| `css/style.css` | Reading view, Catalogue and dreams |
| `js/library.js` | The mathematics: addresses, the bijection, text search, setting books in pages. No graphics. |
| `js/architecture.js` | Dimensions, geometry and lighting of hexagons, vestibules, stairs and cells |
| `js/paintings.js` | Draws the paintings of the passages near the reader, a step at a time |
| `js/world.js` | Streams the hexagons around the reader and dresses their books |
| `js/figure.js` | The reader as the cell's mirror shows them: a monk in a hooded habit, the face lost in the hood's shadow |
| `js/ghost.js` | Other librarians, glimpsed now and then across the shaft, on the floors above and below |
| `js/player.js` | Walking, the spiral stair, and picking a book, door, lamp, bed or Catalogue by gaze |
| `js/terminal.js` | The Catalogue's screen: the current position, finding texts and books, and going to hexagons |
| `js/textures.js` | Wood, plaster, stone, floor tiles and leather spines, painted at start-up |
| `js/quotes.js` | The sentences of dreams: a small English grammar and its vocabulary |
| `js/dream.js` | The moving picture of dreams, drawn by one shader |
| `js/music.js` | The music of the hexagons, made as it plays |
| `js/paper.js` | The paper of the books, each aged in its own way, and the pencil marks of earlier readers |
| `js/words.js`, `words/english.js` | Find words: the words chance has written in a book, and the English words it looks for (from SCOWL; see `words/SCOWL-Copyright.txt`) |
| `js/main.js` | Start-up, reading, sleep |
| `lib/` | three.js r147 and its `Reflector` (MIT licence, see `lib/three.LICENSE`) |
| `tests/library.test.js` | Tests of the mathematics |
| `books/index.js`, `books/compressed/` | The collection, as the Catalogue reads it, written by `books/shelve.js` from the `.md` and `.txt` files in `books/uncompressed/` (which are not published) |
| `books/shelve.js` | Shelves the collection: see [Your books](#your-books) |
| `paintings/index.js`, `paintings/compressed/` | The collection of paintings, as the Catalogue reads it, written by `paintings/hang.js` from the pictures in `paintings/originals/` (which are not published) |
| `paintings/hang.js` | Hangs the collection of paintings: see [Your paintings](#your-paintings) |
| `.githooks/pre-commit` | Runs `books/shelve.js` and `paintings/hang.js` before every commit |

## Testing

With Node.js installed, run `node tests/library.test.js`. The tests enumerate every shelf of five small libraries and check that each holds a different book and that the inverse map finds every book again. They then check round trips, text search and timing on the Library described by `config.js`, and on Borges's own figures, and finally the Catalogue: preparing texts, setting whole books in pages and splitting long ones into parts, finding them in books, distances that wrap around the Library, reading back copied addresses, and making and reading links to books, secret ones included. The paintings are checked exhaustively on five small libraries, each painting different, keeping its rule and leading back to its hexagon, every picture that keeps the rule hanging somewhere, and every mirror image a painting too, then on the Library of `config.js`, with pictures made into paintings, cropped or fitted, always the same for the same picture, and mended to keep the rule. They also check the clusters and rows of each floor, the shortest way between two hexagons in rows and along them, positions measured from the seams, random hexagons to wake in, and the sentences of dreams: grammatical, varied, and always the same for the same hexagon.

## Credits

Borge's story itself is not reproduced here for translation copyright reasons. 3D rendering uses [three.js](https://threejs.org). Typefaces are Libre Bodoni and Courier Prime, from Google Fonts, under the SIL Open Font License. The words that **Find words** looks for come from [SCOWL](http://wordlist.aspell.net/) (Spell Checker Oriented Word Lists), copyright 2000-2016 by Kevin Atkinson, used under its permissive licence (see `words/SCOWL-Copyright.txt`).