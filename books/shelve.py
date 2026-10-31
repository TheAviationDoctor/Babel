#!/usr/bin/env python3
"""
THE LIBRARY OF BABEL — shelving the collection

Puts every book of books/uncompressed/ (plain-text .txt files, which are not published)
on the Library's shelf, for the catalogue's "Find a book":

  books/index.js             the list of the books: title, author, year, language, size, rank
  books/compressed/<id>.js   each book's text, compressed, as a small script

A web page cannot look inside a folder, nor, when it is opened by double-click, read a
file beside it. It can load scripts, though. So the catalogue loads the list when "Find
a book" is first opened, and a book's script only when that book is chosen. A book's
script is named after a hash of its text, which is also its #book= link: it is written
only when a book is new or its text has changed, and removed when its book is gone.

Run it from anywhere, with Python 3:

  python3 books/shelve.py

The git hook in .githooks/ runs it before every commit, and adds to the commit what it
changed. Books it has already shelved, unchanged since, are not read again (it remembers
them in books/.shelf-cache.json, which is not published), so that takes but a moment.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import sys
import zlib

HERE = Path(__file__).resolve().parent  # books/
TEXTS = HERE / 'uncompressed'  # the books, as plain-text files (not published)
SHELF = HERE / 'compressed'  # the books, as the catalogue reads them
INDEX = HERE / 'index.js'  # the list of the books
CACHE = HERE / '.shelf-cache.json'  # what was shelved, so as not to read it again (not published)
MANIFEST = HERE / 'manifest.json'  # optional: a ranking of the books, most read first (not published)

MAX_BYTES = 64 * 1024 * 1024  # larger files are left out, as the catalogue leaves them out
# Windows-1252 as browsers read it: the five bytes it leaves undefined stand for themselves.
CP1252 = {i: bytes([i]).decode('cp1252') for i in range(0x80, 0xA0)
          if i not in (0x81, 0x8D, 0x8F, 0x90, 0x9D)}
GUTENBERG_START = re.compile(r'^\*{3}\s*START OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*$'
                             r'|^\*END\*THE SMALL PRINT[^\n]*$', re.M | re.I)


def read_book(path):
    """A text file as the catalogue reads one: UTF-8, or Windows-1252 if it is clearly not UTF-8."""
    data = path.read_bytes()
    text = data.decode('utf-8-sig', errors='replace')
    if '�' in text:
        text = data.decode('latin-1').translate(CP1252)
    return text


def header_lines(head, name):
    """The lines of a field of a Gutenberg header, such as Title: or Author:."""
    match = re.search(r'^' + name + r':[ \t]*(.+(?:\n[ \t]+\S.*)*)', head, re.M | re.I)
    if not match:
        return []
    return [line for line in (' '.join(part.split()) for part in match.group(1).split('\n')) if line]


def header_title(head):
    """A book's title from its header, a subtitle on the next line after a colon."""
    lines = header_lines(head, 'Title')
    if len(lines) > 1 and not re.search(r'[:;,.!?(—-]$', lines[0]):
        lines = [lines[0] + ':'] + lines[1:]
    return ' '.join(lines)


def header_authors(head):
    """A book's authors from its header, where each has a line: "A", "A and B", "A, B and C"."""
    lines = header_lines(head, 'Author')
    return ' and '.join(lines) if len(lines) < 3 else ', '.join(lines[:-1]) + ' and ' + lines[-1]


def describe_name(name):
    """Title, author and year from a file name such as "Author — Title (1941).txt", as the catalogue reads it."""
    title = ' '.join(re.sub(r'\.txt$', '', name, flags=re.I).replace('_', ' ').split())
    author = year = ''
    match = re.match(r'^(.*?)\s*\((\d{1,4})\)$', title)
    if match and match.group(1):
        title, year = match.group(1), match.group(2)
    match = re.match(r'^(.+?)\s+[—–-]\s+(.+)$', title)
    if match:
        author, title = match.group(1), match.group(2)
    return title, author, year


def describe(path, text, key, titles):
    """A book's entry in the list (without its rank): as the catalogue names it."""
    plain = text.replace('\r\n', '\n').replace('\r', '\n')
    start = GUTENBERG_START.search(plain)
    head = plain[:start.start()] if start else ''
    # from the file name if it names an author, else from the e-book's header
    title, author, year = describe_name(path.name)
    if not author and header_title(head):
        title, author = header_title(head), header_authors(head)
    elif not author and titles.get(path.name):
        title = titles[path.name]
    return {'file': path.name, 'title': title, 'author': author, 'year': year,
            'language': ' '.join(header_lines(head, 'Language')), 'characters': len(text), 'shelf': key}


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def rankings():
    """Each book's rank (most read first) and title, as far as anything says: the manifest
    of the Gutenberg download if there is one, else the list as it was last written."""
    ranks, titles = {}, {}
    for i, b in enumerate(read_json(MANIFEST, {}).get('books', [])):
        if isinstance(b, dict) and 'id' in b:
            ranks[f"pg{b['id']}.txt"] = i + 1
            titles[f"pg{b['id']}.txt"] = b.get('title') or ''
    if not ranks and INDEX.is_file():
        listed = re.search(r'window\.BABEL_BOOKS\s*=\s*(\[[\s\S]*\])\s*;', INDEX.read_text(encoding='utf-8'))
        for e in read_json_text(listed.group(1) if listed else '[]'):
            if isinstance(e, dict) and e.get('rank'):
                ranks[e.get('file')] = e['rank']
    return ranks, titles


def read_json_text(text):
    try:
        return json.loads(text)
    except ValueError:
        return []


def shelve(quiet=False):
    """Shelves what is new or changed in uncompressed/, and takes off the shelf what is gone. Returns
    whether anything changed."""
    if not TEXTS.is_dir() or not any(p.suffix.lower() == '.txt' for p in TEXTS.iterdir()):
        # on a copy of the Library without the books' texts, the shelf is left as it is
        if not quiet:
            print(f'There are no .txt files in {TEXTS}, so the shelf is left as it is.')
        return False
    SHELF.mkdir(parents=True, exist_ok=True)
    ranks, titles = rankings()
    cache = read_json(CACHE, {}).get('books', {})
    seen, entries, kept, read, written, too_big = {}, [], set(), 0, 0, []
    files = sorted(p for p in TEXTS.iterdir() if p.suffix.lower() == '.txt' and not p.name.startswith('.'))
    for path in files:
        stat = path.stat()
        if stat.st_size > MAX_BYTES:
            too_big.append(path.name)
            continue
        known = cache.get(path.name)
        if (known and known.get('size') == stat.st_size and known.get('mtime') == stat.st_mtime_ns
                and (SHELF / f"{known['entry']['shelf']}.js").is_file()):
            entry = known['entry']  # unchanged since it was last shelved
        else:
            text = read_book(path)
            read += 1
            data = text.encode('utf-8')
            key = hashlib.sha256(data).hexdigest()[:20]
            target = SHELF / f'{key}.js'
            if not target.is_file():
                packed = base64.b64encode(zlib.compress(data, 9)).decode('ascii')
                partial = SHELF / f'{key}.partial'
                partial.write_text(f'BABEL_SHELF_BOOK("{key}","{packed}");\n', encoding='ascii')
                partial.replace(target)
                written += 1
            entry = describe(path, text, key, titles)
        seen[path.name] = {'size': stat.st_size, 'mtime': stat.st_mtime_ns, 'entry': entry}
        kept.add(f"{entry['shelf']}.js")
        e = dict(entry)
        entries.append({'file': e['file'], 'title': e['title'], 'author': e['author'], 'year': e['year'],
                        'language': e['language'], 'characters': e['characters'],
                        'rank': ranks.get(path.name), 'shelf': e['shelf']})
    # the books that are gone, and anything left over from shelving that was interrupted
    stale = [p for p in SHELF.iterdir() if p.suffix in ('.js', '.partial') and p.name not in kept]
    removed = 0
    for p in stale:
        try:
            p.unlink()
            removed += 1
        except OSError as exc:
            print(f'Could not remove {p.name}, which no book needs any more: {exc}')
    entries.sort(key=lambda e: (e['rank'] or 10 ** 9, e['title'].lower(), e['file']))
    lines = ',\n'.join(json.dumps(e, separators=(',', ':')) for e in entries)
    index = ('// The books of this Library, for the catalogue\'s "Find a book".\n'
             '// Written by shelve.py, beside it, from the .txt files in uncompressed/: run it\n'
             '// again whenever they change (the git hook in .githooks/ does, before every commit).\n'
             f'window.BABEL_BOOKS = [\n{lines}\n];\n')
    listed = not INDEX.is_file() or INDEX.read_text(encoding='utf-8') != index
    if listed:
        INDEX.write_text(index, encoding='utf-8')
    if seen != cache:
        CACHE.write_text(json.dumps({'books': seen}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    changed = bool(written or removed or listed)
    if changed or not quiet:
        size = sum((SHELF / name).stat().st_size for name in kept)
        print(f'Shelved {len(entries)} books ({written} new or changed, {removed} removed, '
              f'{read} read again), {size / 1e6:,.0f} MB in books/compressed/.')
    if too_big:
        print('Left out, being larger than 64 MB: ' + ', '.join(too_big))
    return changed


if __name__ == '__main__':
    shelve(quiet='--quiet' in sys.argv[1:])
