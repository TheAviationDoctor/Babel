/*
 * THE LIBRARY OF BABEL — the text of the Catalogue's "About" tab
 *
 * Write it in Markdown between the line START and the line END below, in any text
 * editor, then save and reload the page. Markdown is plain text with a few marks:
 *
 *   # A heading            ## A smaller heading
 *   *italics*   **bold**   `code`   [a link](https://babel.pellegr.in/)
 *   - an item of a list    1. an item of a numbered list
 *   > a quotation          | a | table | (with |---|---| under its first row)
 *
 * Leave a blank line between paragraphs. The text may hold any character, except a
 * star followed straight away by a slash, which would end it there.
 */

window.BABEL_ABOUT = function () { /* START

## Where am I?

You are meandering through a simulation of Jorge Luis Borges's *[Library of Babel](https://en.wikipedia.org/wiki/The_Library_of_Babel)* adapted from his 1941 eponymous story. It contains every book that was ever written, and every book that wasn't, including your detailed life story, multiple proofs of the Riemann hypothesis, and a staggering amount of nonsense.

The challenge, of course, is knowing where to look.

## How big is this place?

Each book is a combination of `512` pages of `32` lines of `64` characters (`= 1,048,576` characters per book). Each character can be any of `128` symbols (A–Z and a–z, the accented letters of French and Spanish, 0–9, and punctuation marks). Every possible book appears exactly once in the Library. So, there are `128^1,048,576 ≈ 6.33 × 10^2,209,569` unique books in the Library. That's one followed by over 2.2 million zeros. If you kept repeating the word 'trillion' once per second, it would take you just over 51 hours to verbalize that number.

For perspective, there are about `10^80` atoms in our observable universe. Imagine every atom contained an entire universe, each with just as many atoms as its parent universe. Then imagine every atom in *that* nested universe contained another universe, etc. You would need nearly 28,000 levels of such Matrioshka universes before the *cumulative* number of atoms reached the number of books in this Library.

The books are arranged in hexagonal rooms holding `4` bookshelves of `4` shelves of `32` books (`= 512` books per hexagon). So, there are `128^1,048,576 / 512 ≈ 1.24 × 10^2,209,567` hexagons. Barely two order of magnitude fewer hexagons than books. For all intents and purposes, they are the same number.

There are `2.49 × 10^1,104,783` hexagons per floor, all arranged in one long stretch of galleries punctuated by vertical shafts, and twice as many floors, `4.97 × 10^1,104,783`. Seen from the side, the Library is nearly a square, about 1.7 times longer than it is tall. It spans `2.3 × 10^1,104,768` light-years from east to west and `1.4 × 10^1,104,768` light-years from top to bottom. For perspective, the Library could fit our observable universe `2.5 × 10^1,104,757` times from east to west and `1.5 × 10^1,104,757` times from top to bottom.

The library is *finite* (it contains a fixed number of books, hexagons, and floors). But it is *boundless* because it is *cyclic* in both directions. Walk past the last hexagon of a floor, or take the stairs up or down to the last floor, and you are back at the first, just like an ant walking endlessly on the surface of a torus (which the Library is, topologically speaking).

For more information and source code: https://github.com/TheAviationDoctor/Babel#babel
END */ };