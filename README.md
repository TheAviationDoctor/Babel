# Babel

A Web-based walkable simulation of Jorge Luis Borges's *[Library of Babel](https://en.wikipedia.org/wiki/The_Library_of_Babel)* adapted from his 1941 eponymous story. It contains every book that was ever written, and every book that wasn't. The complication, of course, is knowing where to look.

## Features

- Permanent book locations (deterministically generated from a seed)
- Configurable environment (seed, book format, alphabet, bookshelves, look sensitivity, field of view)
- Interactive objects (books, terminal, doors, beds, bedside lamps)
- Reverse-search any text and teleport to the corresponding book
- Copy and share locations of any book or text, incl. secret password-encrypted links
- Read from an index of ~1K literature classics (all copyright-free)

## Getting started

No installation required: everything is self-contained HTML/JS/CSS. Just visit the Library online at https://babel.pellegr.in/, or download the repo and open `index.html` locally in a recent browser. It even runs offline (except for a couple of Google Fonts which will then revert to your browser's defaults). Edit the `config.js` file to configure the Library as you wish.

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

No. The Library is *finite* in that it contains a fixed number of unique books, hexagons, and floors. But it is *boundless* (no hard edge) and is *cyclic* in both directions. Walk past the last hexagon of a floor, or take the stairs up or down to the last floor, and you are back at the first, just like an ant walking endlessly on the surface of a torus (which the Library is, topologically speaking).

Positions are measured from the *seam*, which is where the numbers of the hexagons and the floors roll over: east–west between the last hexagon of a floor and the first, and up–down between the last floor and the first. The Catalogue's **Map** tab (see [The Catalogue](#the-Catalogue)) shows your distance from every seam. Walking barely changes your position, since each hexagon is only `4 × 10^-1,104,782%` of the way round.

## So how big is the Library?

Using the default settings from `config.js`:

- Each book holds `2^6 = 64` characters × `2^5 = 32` lines × `2^9 = 512` pages which yields `2^20 = 1,048,576` characters per book. That's about twice the length of a typical English novel, which gives plenty of headroom to capture most published literature.

- The alphabet contains `2^7 = 128` symbols: `26` uppercase and `26` lowercase letters from the modern latin alphabet (A–Z); `27` accented letters and ligatures from French and Spanish, plus the umlauts ä and ö, and five accented capitals; `10` base-10 digits (0–9); `38` punctuation marks and signs; and the standard space. Those symbols were chosen by enumerating and de-duplicating all 697 million characters from Gutenberg.org's top 871 most-read books of all time. The chosen symbols hold 99.9% of the resulting set exactly as printed.

- There are therefore `128^(2^20) = 2^7,340,032 ≈ 6.33 × 10^2,209,569` unique books in the Library. That's one followed by over 2.2 million zeros. If you kept repeating the word 'trillion' once per second, it would take you just over 51 hours to verbalize that number.

- The Library is arranged into floors, and each floor into a single east-west gallery of hexagon-shaped rooms. Each hexagon holds `2^2 = 4` bookshelves × `2^2 = 4` shelves × `2^5 = 32` books = `2^9 = 512` books per hexagon. Therefore, the Library has `2^7,340,032 / 2^9 = 2^7,340,023 ≈ 1.24 × 10^2,209,567` hexagons. Barely two order of magnitude fewer hexagons than books; for all intents and purposes, they are the same number.

> [!TIP] 
> There are about `10^80` atoms in our observable universe. Imagine every atom contained an entire universe, each with just as many atoms as ours. Then imagine every atom in *that* nested universe contained another universe, and so on. You would need nearly `28,000` levels of Matrioshka universes before the *cumulative* number of atoms approximated the number of books or hexagons in the Library.

- There are `2^3,670,011 ≈ 2.49 × 10^1,104,783` hexagons per floor and `2^3,670,012 ≈ 4.97 × 10^1,104,783` floors. That's twice as many floors as hexagons per floor, which is as even as it gets: the `2^7,340,023` hexagons are an odd power of 2, and thus cannot be split into two equal powers of 2.

- A floor is 2.61 meters high, and a hexagon (with its vestibule) 8.83 meters long, so despite having twice as many floors as hexagons per floor, the Library is about 1.7 times longer than it is tall. Seen from the side, the Library would look like a rectangle. Of the possible shape arrangements that the number of hexagons allows, this one is the nearest to being a square.

> [!TIP] 
> The Library spans `2.3 × 10^1,104,768` light-years from east to west and `1.4 × 10^1,104,768` light-years from top to bottom. The Library could fit our observable universe `2.5 × 10^1,104,757` times from east to west and `1.5 × 10^1,104,757` times from top to bottom. At walking pace, walking the length of one floor would take about `5 × 10^1,104,776` years.

## Is the Library three-dimensional?

At the mesoscopic (human) scale, it feels like it is: you can walk forward and back, left and right, and take the stairs up and down.

At the macroscopic scale, however, it is essentially two-dimensional. You can only walk east–west along a floor, and up–down between floors. There is no north–south direction. The whole building is only one hexagon wide, shaped like a vertical sheet a few metres thick but astronomically long and tall.

Note that in the original story, Borges never says which sides of the hexagons are free. If the doorless sides met at 120° instead of 180°, the rows of hexagons could branch, and the Library could be a 3D honeycomb. That would mean splitting each book’s index into three coordinates instead of two.

## Motivation

Here I explain what motivated me to build this Library.

I was mindblown by Borges' *La biblioteca de Babel* when I first read it at a young age. The story itself is rather brief (only ten pages) relative to its ambition and reads more like a stub of an idea, but its implications loom large for the imaginative reader. Central to the story is the *quest for meaning* (defined here as syntactically correct and semantically sensible permutations of text) in a gibberish-dominated universe (for which the Library is but a scaled metaphor).

A first practical implication from Borges' story is the apparent paradox of boundlessness in a finite spacetime. The Library has no hard edge; walk past any east-west or top-bottom seam and you will keep rolling over. But time is finite, so your exploration is constrained by either your resoluteness or biological lifespan (whichever is shorter). In *[A Short Stay in Hell](https://en.wikipedia.org/wiki/A_Short_Stay_in_Hell)*, author Steven L. Peck explores this theme, thought a bit awkwardly for my taste. An avid book reader dies and gets cast into a version of hell that is the Library of Babel, in which he must find a book flawlessly narrating his life's story to buy his ticket to heaven. The twist, of course, is that the protagonist is immortal, so all that matters is his resoluteness to search, which gets tested over unfathomable aeons. Lovecraft's words come to mind: *That is not dead which can eternal lie, and with strange aeons even death may die.*

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

A book may hold no more than `2^24 = 16,777,216` characters and a hexagon no more `2^16 = 65,536` books. The rooms are built to fit: the number of books per shelf sets the width of each hexagon, and the number of shelves sets the height of its ceiling. If a value is invalid or a setting's name is misspelt, the page says which one and why.

The default alphabet is meant to hold classic literature as it was printed, so that the Catalogue can find the classics on the shelves (see [Your books](#your-books)) while staying a power of two like every other figure. It was chosen by counting every character in the Library's collection of ~1K books. After the 26 letters in both cases, the commonest characters by far are curly quotation marks, found in about half of the 871 English books. Then come the accented letters of French (é alone appears in 476 of those books), the umlauts of German names and of old spellings (Königsberg, Göttingen, coöperation), and the letters of Spanish (á, ñ). Guillemets (« ») and the inverted marks of Spanish (¿ ¡) appear in every French and Spanish book. Five accented capitals begin enough words to earn their place (À Ç É Æ Œ); other capitals lose their accents (Ê becomes E), as much French printing long did. The 27 marks and signs of the Library's first alphabet stay, and the en dash, the half and the multiplication sign complete the 128. The rest of the keyboard (`{ } | ^ ~ < > @ \` and the backquote) is left out: the collection uses it almost only for transcribers' markup and tables, and on a random page it would look like computer code. Greek is left out too: some 60 books quote it, but it would need 24 letters and their accents.

The Library's first alphabet had 64 symbols, with the letters in capitals only, as in Borges's story. It is still in `config.js`, one line away, for those who prefer it.

Any change to these values, the seed included (but not `website`, `view` or `dreams`), gives a different Library: an address copied before then no longer leads to the same books.

Borges's own figures would be 410 pages, 40 lines, 80 characters, a 25-symbol alphabet, and 4 walls of 5 shelves of 32 books. They work too in case you'd like to try them.

## How the Library is built

**Addresses.** Every shelf position has an index *v* between 0 and *N*^*M* − 1 (*N* symbols, *M* characters per book), written as *M* base-*N* digits. It decomposes as

    v = place × S + slot                (S books per hexagon; slot = wall, shelf, volume)
    place = floor × L + hexagon         (L hexagons along each floor)

so each hexagon has a place in the whole Library, made of a floor number and a hexagon number (its number along that floor). L is chosen to make the floors as many as the hexagons along each: since the alphabet has 2^7 symbols, every place is a string of bits, and the hexagon number takes the lower half of them, the floor number the upper half. By default the places have 7,340,023 bits, an odd number, and the floor number has the odd bit: there are 2^3,670,011 hexagons along every floor, about 10^1,104,783, and twice as many floors, 2^3,670,012. Both numbers are 524,288 symbols long. (With an alphabet whose size is not a power of 2, the numbers are split between two symbols instead, as evenly as that allows.) The Catalogue's Map tab copies the current hexagon's full address, written in the Library's own alphabet.

**Contents.** The book at index *v* is obtained by a permutation of the space of all books, keyed by the seed: a four-round Feistel network on the book's two halves. Each round adds, symbol by symbol and modulo *N*, a pseudorandom stream generated from a hash of the other half. A Feistel network can be run backwards whatever its round functions are, so the map from shelf to contents is a bijection. No two shelves hold the same book and no possible book is missing. Neighbouring books share nothing visible. Opening one takes a few hundredths of a second, and all the arithmetic on the huge numbers is done digit by digit, without big-integer multiplication.

Because the map can be inverted, any text can be located: `findText` in `js/library.js` returns the hexagon, wall, shelf, volume and page of a book containing any given passage. The Catalogue in every vestibule uses it (see below).

**Shape.** Both the floors and the hexagons along them wrap around: walk east for 2^3,670,011 hexagons and you are back where you started. The Library is finite, and from inside it has no edge. This is close to the hypothesis the narrator offers at the end of the story. When the number of books is not a multiple of the books per hexagon, as with Borges's figures, the very last hexagon is only partly filled.

**Cosmetics.** Spine colours and the letters on the spines come from a separate hash of the hexagon's address. They are not part of the bijection and, as in the story, they say nothing about what the pages contain.

## The Catalogue

Every vestibule has one. There is no menu in the Library, so the Catalogue is also where you find your bearings. It has four tabs.

**Map.** Where you are: how far from where you woke (or, after a jump, from where you arrived), and how far east of the Western seam and above the Lower seam, with the percentage of the way round. After a jump through the Catalogue, it says how far the jump went, measured the shorter way round, such as `1.2 × 10^1,104,783 hexagons west and 2.2 × 10^1,104,783 floors down`. The rest of the tab is a map of the whole Library seen from the side, as large as the screen allows and drawn to its proportions (it is about 1.7 times longer than it is tall). Its four sides are the seam, named Upper, Eastern, Lower and Western, each joining the side opposite. The hexagon you are in blinks on it, and an outlined hexagon marks where the last jump began. A button below the map copies the hexagon's full address, to come back to it later from **Jump**, and another opens this project on GitHub.

**Search.** Type or paste anything into it, or load a plain-text file with **Upload .txt** (the file is only read by the page, and never leaves the computer). Letters keep their case, and their accents where the alphabet has them; other letters lose their accents (Ê becomes E, ō becomes o). Tabs become spaces, and `--` becomes a long dash. Other characters become their nearest equivalents in the alphabet: ß becomes ss, … becomes ..., ¼ becomes 1/4, a ligature such as ﬁ becomes fi, and so on (the screen says which). What has no equivalent, such as Greek, is left out (the screen lists it). The text is then set in lines of 64 characters, as on the pages of a book: a word that would be cut at the end of a line goes to the start of the next, no line starts with a space, and each new paragraph starts after a blank line, indented by three spaces. Blank lines separate paragraphs; in a text without any, each line is a paragraph. Spaces within a paragraph count once, so a short text on one line is set exactly as typed. The Catalogue then runs the shelving backwards. It composes the book that begins with your text, the rest of its pages blank, and the inverse permutation gives the hexagon, wall, shelf and volume where that book stands. Since every possible book exists exactly once, it is certainly there. It is also almost always astronomically far away, so the screen gives the distance as a power of ten. To read it, go there: you are set down in front of it, and the volume stands a little out of its row. You can also copy its location (the address of its hexagon, for the **Jump** tab, with its wall, shelf and volume), a public link to it, or a secret link to it (see [Links to books](#links-to-books)).

**Read.** The Catalogue can also find a whole book: any book of the Library's own collection (see [Your books](#your-books)), which it lists with a search box, most read first, by title or by author. It sets the text in pages, the way a book of this Library holds them: from the first page, 64 characters to a line and 32 lines to a page, with words kept whole and each paragraph starting on a new, indented line. The rest of the 512 pages are blank. It then finds the one book of the Library that holds exactly those pages. To read it, go and take it down from its shelf; you can also copy its location or a public link to it (see [Links to books](#links-to-books)). A text longer than one book is set in several parts, one after the other, and each part is found separately.

**Jump.** Move any number of hexagons east or west and floors up or down. Paste a full address, as copied from the Map tab, to return to a hexagon you have bookmarked, even after closing the page. An address copied from a Library with another seed is refused, since its books stand elsewhere. Or go somewhere at random. After a jump, the Map tab counts your steps from where you arrived.

## Links to books

A book's address cannot serve as a link: it is as long as the book itself (1,048,576 symbols, about a megabyte). This is because shelving is a bijection, so there are exactly as many addresses as books, and addresses cannot on average be shorter than what they point to.

There are three other kinds of links instead, all written after the `#` of the Library's address, a part that browsers never send to the server: links to texts, secret links to texts, and links to the books of the collection.

### Links to texts

A link to a text carries the text itself:

    https://babel.pellegr.in/#text=<the text>

Whoever opens the link is set down in the Library before the book that holds exactly that text from the very start of its first page (set in lines as in **Search**), with the rest of its pages blank, the volume standing a little out of its row. It is the book the Catalogue's **Search** tab finds, and the link its **Copy a public link** copies. The Library runs the shelving backwards to find it, so the same text always leads to the same book, and a link keeps leading to the book that holds its text even if the seed or the configuration change. Such a link can be built without the book ever having been found.

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

The text is read as the Catalogue reads any text (see **Search** above): letters keep their case, and their accents where the alphabet has them, other characters become their nearest equivalents, and the text is set in lines and paragraphs. A blog post of a few thousand words makes a link of a few thousand characters, well within what browsers accept; a whole novel would be too long for some browsers, which stop at about 80,000 characters.

### Secret links

A secret link carries a text encrypted with a password, so that the link alone cannot be read:

    https://babel.pellegr.in/#secret=<the text, compressed and encrypted>

The Catalogue makes one with **Copy a secret link**, beside **Copy a public link**, in the **Search** tab. Choose a password (at least 8 characters; a few words make a stronger one, and one easier to remember), then copy the link. Whoever opens it is asked for the password before the Library sets them down before the book, the same book as an ordinary link to that text would lead to. Give the password separately, by voice or in another message: it is in no link, and kept nowhere, so a forgotten password cannot be recovered. Reading the book from there, **Copy a link to it** copies the secret link again, not the text.

The text is compressed as in other links, then encrypted with AES-GCM under a key made from the password with PBKDF2 (SHA-256, 600,000 rounds, which makes guessing passwords slow). All of it happens in the browser. A secret link is about 60 characters longer than the compressed link to the same text. Whoever has the link can still try passwords one after another on their own computer, so a short or common password can be found; and whoever opens the book can read the text, and pass it on.

### Links to books of the collection

A link to a book of the collection (see [Your books](#your-books)) carries no text, only the name of the book's file in `books/compressed/`: `#book=` and 20 characters, such as `https://babel.pellegr.in/#book=3f6bb9d6f78e0293b56a` for *Pride and Prejudice*. A book too long for one volume is set in several parts: `#book=…/3` leads to the third. The Catalogue's **Read** tab copies these links. They lead to the same book whatever the seed.

A book that a link or the Catalogue has led you to can be shared again from the reading view: **Copy a link to it** copies the link that leads to it.

## Your books

The Library has a collection of ~1K copyright-free literature classics from the list of most read books of [Project Gutenberg](https://www.gutenberg.org). They are kept in `books/compressed/`. You can access those from the Catalogue's **Read** tab and read them from within the Library.

The Catalogue loads the list when **Read** is first opened, and a book's text only when you choose it, so the collection works the same whether the Library is opened by double-click or online.

The title, author and year come from the file name. If the name does not give an author, they come from the e-book's header, as for the Gutenberg files. Those can be added as they are: the Catalogue leaves out the licence that comes before and after the text, and the volunteers' credits. Leave a blank line between paragraphs. If there are no blank lines, each line is taken as a paragraph, and a file written on a single line is set as one long paragraph.

**Adding books.** Put plain-text files (`.txt`) in `books/uncompressed/`, which is not published, then shelve them with Python 3:

```
python3 books/shelve.py
```

It compresses each new or changed book into a script of its own in `books/compressed/`, named after a hash of its text (which is also its `#book=` link), removes the scripts of the books whose `.txt` file is gone, and rewrites the list, `books/index.js`. Books it has shelved before, unchanged since, are not read again, so it takes but a moment. A copy of the repository without `books/uncompressed/` leaves the shelf as it is.

A git hook, `.githooks/pre-commit`, runs the script before every commit and adds what it changed to the commit. Git uses it once told where the Library keeps its hooks, which is done once per copy of the repository, in its folder: `git config core.hooksPath .githooks`. Note that `books/uncompressed/` is not part of the repository, so new books on their own leave nothing to commit: run the script yourself then, and commit what it wrote.

## Dreams

Lie down on the bed of a cell (look at it and press `E`, click or tap) to sleep. The Library fades to black, and a dream comes out of the black: shapes like smoke seen through a kaleidoscope, now and then with the ghost of the Library's hexagons, of rings or of a spiral, in muted colours. Sentences fade in over it, one after another. Each one stays for `dreams.quoteDuration` seconds, then fades out, and the next one begins to fade in `dreams.quoteInterval` seconds later, while the dream melts into its next scene. Click, tap or press `Esc` to wake.

The visuals and text inside a dream are deterministically seeded from the address of the hexagon you sleep in (its hexagon and floor numbers). The same hexagon always dreams the same dream, in the same order, and every other hexagon dreams another.

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
| `js/terminal.js` | The Catalogue's screen: the current position, finding texts and books, and going to hexagons |
| `js/textures.js` | Wood, plaster, stone, floor tiles and leather spines, painted at start-up |
| `js/quotes.js` | The sentences of dreams: a small English grammar and its vocabulary |
| `js/dream.js` | The moving picture of dreams, drawn by one shader |
| `js/main.js` | Start-up, reading, sleep |
| `lib/` | three.js r147 and its `Reflector` (MIT licence, see `lib/three.LICENSE`) |
| `tests/library.test.js` | Tests of the mathematics |
| `books/index.js`, `books/compressed/` | The collection, as the Catalogue reads it, written by `books/shelve.py` from the `.txt` files in `books/uncompressed/` (which are not published) |
| `books/shelve.py` | Shelves the collection: see [Your books](#your-books) |
| `.githooks/pre-commit` | Runs `books/shelve.py` before every commit |

## Testing

With Node.js installed, run `node tests/library.test.js`. The tests enumerate every shelf of five small libraries and check that each holds a different book and that the inverse map finds every book again. They then check round trips, text search and timing on the Library described by `config.js`, and on Borges's own figures, and finally the Catalogue: preparing texts, setting whole books in pages and splitting long ones into parts, leaving out Project Gutenberg's licence, finding them in books, distances that wrap around the Library, reading back copied addresses, and making and reading links to books, secret ones included. They also check positions measured from the seam, random hexagons to wake in, and the sentences of dreams: grammatical, varied, and always the same for the same hexagon.

## Credits

Borge's story itself is not reproduced here for translation copyright reasons. 3D rendering uses [three.js](https://threejs.org). Typefaces are Libre Bodoni and Courier Prime, from Google Fonts, under the SIL Open Font License.