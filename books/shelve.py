#!/usr/bin/env python3
"""
THE LIBRARY OF BABEL — shelving the collection

Puts every book of books/uncompressed/ (Markdown .md files, or plain-text .txt files, which
are not published) on the Library's shelf, for the catalogue's "Browse books":

  books/index.js             the list of the books: title, author, year, language, size
  books/compressed/<id>.js   each book's text, compressed, as a small script

A Markdown book opens with its front matter, between two lines of three hyphens, which
names it and is not part of its text. Each property is written as its name, a colon right
after it, a space and its value:

  ---
  author: Jorge Luis Borges
  lang: es
  title: La Biblioteca de Babel
  year: 1941
  ---

The front matter is read strictly: a line it cannot read, such as "author : Borges" with a
space before the colon, is reported, and the book is left off the shelf until it is mended.
A property it leaves out comes from the file name, "Author - Title (Year).md", and lang,
the language, as a code such as en, fr or es (or a name), is shown in the list by name.

The text after the front matter is shelved as it reads in print. The Library's books have
no italics, headings or notes in the margin, so the marks of emphasis are left out (*word*
becomes word), as are those of headings, quotations, links and code; a footnote's mark
becomes its number in brackets ([^1] becomes [1]), and so does the start of the note
itself ([^1]: at the start of a line). A plain-text book is shelved as it is, named by its
file name.

A web page cannot look inside a folder, nor, when it is opened by double-click, read a
file beside it. It can load scripts, though. So the catalogue loads the list when "Browse
books" is first opened, and a book's script only when that book is chosen. A book's script
is named after a hash of its text, which is also its #book= link: it is written only when a
book is new or its text has changed, and removed when its book is gone.

Run it from anywhere, with Python 3:

  python3 books/shelve.py

The git hook in .githooks/ runs it before every commit, and adds to the commit what it
changed. Books it has already shelved, unchanged since, are not read again (it remembers
them in books/.shelf-cache.json, which is not published), so that takes but a moment.
"""
import base64
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import unicodedata
import zlib

HERE = Path(__file__).resolve().parent  # books/
TEXTS = HERE / 'uncompressed'  # the books, as Markdown or plain-text files (not published)
SHELF = HERE / 'compressed'  # the books, as the catalogue reads them
INDEX = HERE / 'index.js'  # the list of the books
CACHE = HERE / '.shelf-cache.json'  # what was shelved, so as not to read it again (not published)

MARKDOWN = ('.md', '.markdown')
KINDS = MARKDOWN + ('.txt',)  # the files that are books
VERSION = 3  # of the way books are read: when it changes, every book is read again
MAX_BYTES = 64 * 1024 * 1024  # larger files are left out, as the catalogue leaves them out
# Windows-1252 as browsers read it: the five bytes it leaves undefined stand for themselves.
CP1252 = {i: bytes([i]).decode('cp1252') for i in range(0x80, 0xA0)
          if i not in (0x81, 0x8D, 0x8F, 0x90, 0x9D)}
# the names of the languages a front matter's lang may give by their codes (ISO 639)
LANGUAGES = {
    'af': 'Afrikaans', 'ar': 'Arabic', 'bg': 'Bulgarian', 'ca': 'Catalan', 'cs': 'Czech', 'cy': 'Welsh',
    'da': 'Danish', 'de': 'German', 'el': 'Greek', 'en': 'English', 'eo': 'Esperanto', 'es': 'Spanish',
    'et': 'Estonian', 'eu': 'Basque', 'fa': 'Persian', 'fi': 'Finnish', 'fr': 'French', 'ga': 'Irish',
    'gl': 'Galician', 'grc': 'Ancient Greek', 'he': 'Hebrew', 'hi': 'Hindi', 'hr': 'Croatian',
    'hu': 'Hungarian', 'id': 'Indonesian', 'is': 'Icelandic', 'it': 'Italian', 'ja': 'Japanese',
    'ko': 'Korean', 'la': 'Latin', 'lt': 'Lithuanian', 'lv': 'Latvian', 'nb': 'Norwegian',
    'nl': 'Dutch', 'nn': 'Norwegian', 'no': 'Norwegian', 'oc': 'Occitan', 'pl': 'Polish',
    'pt': 'Portuguese', 'ro': 'Romanian', 'ru': 'Russian', 'sk': 'Slovak', 'sl': 'Slovenian',
    'sr': 'Serbian', 'sv': 'Swedish', 'tl': 'Tagalog', 'tr': 'Turkish', 'uk': 'Ukrainian',
    'yi': 'Yiddish', 'zh': 'Chinese',
}


class Unreadable(Exception):
    """A book the shelf cannot take as it is: says why, and where."""


def read_book(path):
    """A text file as the catalogue reads one: UTF-8, or Windows-1252 if it is clearly not UTF-8."""
    data = path.read_bytes()
    text = data.decode('utf-8-sig', errors='replace')
    if '�' in text:
        text = data.decode('latin-1').translate(CP1252)
    return text


# ---------------------------------------------------------------- Markdown

def front_matter(text):
    """The properties of a Markdown book's front matter, their names in small letters, and the
    text after it. The front matter is the book's first lines, from a line of three hyphens
    to the next. Each property is "name: value", the colon right after the name, a space after
    it; a value may be in quotation marks, and a list ("[A, B]", or a line to each item, "  - A",
    under its "name:") becomes "A and B", "A, B and C". Blank lines and comments (#) are
    allowed. Anything else is not, and raises Unreadable."""
    lines = text.split('\n')
    if not lines or lines[0].rstrip() != '---':
        raise Unreadable('it does not open with a front matter (a line of three hyphens, its properties, and another)')
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].rstrip() == '---')
    except StopIteration:
        raise Unreadable('its front matter has no end (a second line of three hyphens)') from None
    unquote = lambda v: v[1:-1] if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'' else v
    fields, last = {}, None
    for number in range(1, end):
        line = lines[number].rstrip()
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        prop = re.match(r'^([A-Za-z][\w-]*):(?: (.*))?$', line)
        item = re.match(r'^[ \t]+- (.*)$', line)
        if prop:
            last, value = prop.group(1).lower(), (prop.group(2) or '').strip()
            if last in fields:
                raise Unreadable(f'line {number + 1} of its front matter gives "{last}" a second time')
            if value.startswith('[') and value.endswith(']'):
                value = [unquote(p.strip()) for p in value[1:-1].split(',') if p.strip()]
            fields[last] = unquote(value)
        elif item and last is not None and (fields[last] == '' or isinstance(fields[last], list)):
            fields[last] = (fields[last] or []) + [unquote(item.group(1).strip())]  # an item of a list
        else:
            hint = ''
            loose = re.match(r'^\s*([A-Za-z][\w-]*)\s*:\s*(.*)$', line)
            if loose:
                hint = f'; write it "{loose.group(1)}: {loose.group(2)}"'
                if re.match(r'^\s*[A-Za-z][\w-]*\s+:', line):
                    hint += ', without a space before the colon'
                elif line[:1].isspace():
                    hint += ', at the start of the line'
                else:
                    hint += ', with a space after the colon'
            raise Unreadable(f'line {number + 1} of its front matter, "{line.strip()}", is not a property{hint}')
    for k, v in fields.items():
        if isinstance(v, list):
            fields[k] = ' and '.join(v) if len(v) < 3 else ', '.join(v[:-1]) + ' and ' + v[-1]
        else:
            fields[k] = ' '.join(str(v).split())
    return fields, '\n'.join(lines[end + 1:])


def language_name(code):
    """A language's name from its code (es, fr, en-GB), or the name as given."""
    code = code.strip()
    base = re.split(r'[-_]', code)[0].lower()
    if base in LANGUAGES:
        return LANGUAGES[base]
    return code[:1].upper() + code[1:] if len(code) > 3 else code


def markdown_text(md):
    """A Markdown text as it reads in print, for a Library whose books have no italics: the
    marks of emphasis, headings, quotations, links and code left out; footnotes numbered in
    brackets; a rule between parts as three spaced asterisks. Paragraphs stay as they are,
    a blank line between them, since that is how the catalogue tells them apart too."""
    kept = []

    def keep(s):
        kept.append(s)
        return f'\x00{len(kept) - 1}\x00'

    out, fence = [], None
    for line in md.split('\n'):
        f = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
        if f and (fence is None or f.group(1)[0] == fence[0] and len(f.group(1)) >= len(fence)):
            fence = None if fence else f.group(1)  # code: kept as written
            continue
        if fence:
            out.append(keep(line))
            continue
        if re.match(r'^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$', line):  # a rule between parts
            out += ['', keep('* * *'), '']
            continue
        if re.match(r'^ {0,3}\[[^\]^][^\]]*\]:[ \t]*\S+', line):  # where a link leads: not part of the text
            continue
        line = re.sub(r'^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$', r'\1', line)  # a heading
        line = re.sub(r'^ {0,3}#{1,6}[ \t]*$', '', line)
        line = re.sub(r'^ {0,3}(?:>[ \t]?)+', '', line)  # a quotation
        # a footnote, where the notes are: [^1]: becomes [1]
        line = re.sub(r'^ {0,3}\[\^([^\]\s]+)\]:[ \t]*', lambda m: keep(f'[{m.group(1)}]') + ' ', line)
        out.append(line)
    s = '\n'.join(out)

    span = r'(?:(?!\n[ \t]*\n)[\s\S])'  # anything but the end of a paragraph
    s = re.sub(r'(`+)(' + span + r'+?)\1', lambda m: keep(' '.join(m.group(2).split())), s)  # code
    s = re.sub(r'\\([\\`*_{}\[\]()#+\-.!|<>~])', lambda m: keep(m.group(1)), s)  # escaped marks
    s = re.sub(r'\[\^([^\]\s]+)\]', lambda m: keep(f'[{m.group(1)}]'), s)  # a footnote's mark
    s = re.sub(r'!\[([^\]]*)\]\((?:[^()\s]|\([^()\s]*\))*(?:\s+"[^"]*")?\)', r'\1', s)  # a picture: its description
    s = re.sub(r'\[([^\]]+)\]\((?:[^()\s]|\([^()\s]*\))*(?:\s+"[^"]*")?\)', r'\1', s)  # a link: its words
    s = re.sub(r'\[([^\]]+)\]\[[^\]]*\]', r'\1', s)
    s = re.sub(r'<((?:https?://|mailto:)[^>\s]+)>', r'\1', s)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'</?(?:i|b|em|strong|u|s|del|sup|sub|small|span|cite|abbr|mark)\b[^>]*>', '', s, flags=re.I)
    # bold and italics, with asterisks or underscores (not within a word, for underscores)
    for _ in range(2):
        s = re.sub(r'(\*\*|__)(?=\S)(' + span + r'+?)(?<=\S)\1', r'\2', s)
        s = re.sub(r'(?<![*\w])\*(?=[^\s*])(' + span + r'+?)(?<=[^\s*])\*(?![*\w])', r'\1', s)
        s = re.sub(r'(?<![_\w])_(?=[^\s_])(' + span + r'+?)(?<=[^\s_])_(?![_\w])', r'\1', s)
    s = re.sub(r'~~(?=\S)(' + span + r'+?)(?<=\S)~~', r'\1', s)
    s = re.sub(r'(?: {2,}|\\)\n', '\n', s)  # a line broken by hand
    # characters written as entities, such as &mdash; or &#8212;
    s = re.sub(r'&(?:#\d+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);', lambda m: html.unescape(m.group(0)), s)
    for _ in range(2):
        s = re.sub(r'\x00(\d+)\x00', lambda m: kept[int(m.group(1))], s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip() + '\n'


# ---------------------------------------------------------------- a book

def describe_name(name):
    """Title, author and year from a file name such as "Author - Title (1941).md", as the catalogue reads it."""
    title = ' '.join(re.sub(r'\.(?:txt|md|markdown)$', '', name, flags=re.I).replace('_', ' ').split())
    author = year = ''
    match = re.match(r'^(.*?)\s*\((\d{1,4})\)$', title)
    if match and match.group(1):
        title, year = match.group(1), match.group(2)
    match = re.match(r'^(.+?)\s+[—–-]\s+(.+)$', title)
    if match:
        author, title = match.group(1), match.group(2)
    return title, author, year


def book(path):
    """A book's text, as it is shelved, and its entry in the list (without its shelf). Raises
    Unreadable if it cannot be shelved as it is."""
    raw = read_book(path)
    title, author, year = describe_name(path.name)
    language = ''
    text = raw  # a plain-text book, as it is
    if path.suffix.lower() in MARKDOWN:
        # its letters composed (è, not e and a grave accent, as some editors save them), so
        # that it is counted and found as it reads
        plain = unicodedata.normalize('NFC', raw.replace('\r\n', '\n').replace('\r', '\n'))
        fields, body = front_matter(plain)
        text = markdown_text(body)
        title = fields.get('title') or title
        author = fields.get('author') or author
        year = fields.get('year') or year
        language = language_name(fields.get('lang') or '')
    nfc = lambda s: unicodedata.normalize('NFC', s)
    return text, {'file': nfc(path.name), 'title': nfc(title), 'author': nfc(author), 'year': year,
                  'language': language, 'characters': len(text)}


# ---------------------------------------------------------------- the shelf

def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def shelve(quiet=False):
    """Shelves what is new or changed in uncompressed/, and takes off the shelf what is gone, or
    cannot be read. Returns whether anything changed."""
    is_book = lambda p: p.suffix.lower() in KINDS and not p.name.startswith('.') and p.is_file()
    if not TEXTS.is_dir() or not any(is_book(p) for p in TEXTS.iterdir()):
        # on a copy of the Library without the books' texts, the shelf is left as it is
        if not quiet:
            print(f'There are no books (.md or .txt files) in {TEXTS}, so the shelf is left as it is.')
        return False
    SHELF.mkdir(parents=True, exist_ok=True)
    remembered = read_json(CACHE, {})
    cache = remembered.get('books', {}) if remembered.get('version') == VERSION else {}
    seen, entries, kept, read, written, too_big, unreadable = {}, [], set(), 0, 0, [], []
    for path in sorted(p for p in TEXTS.iterdir() if is_book(p)):
        stat = path.stat()
        if stat.st_size > MAX_BYTES:
            too_big.append(path.name)
            continue
        known = cache.get(path.name)
        if (known and known.get('size') == stat.st_size and known.get('mtime') == stat.st_mtime_ns
                and (SHELF / f"{known['entry']['shelf']}.js").is_file()):
            entry = known['entry']  # unchanged since it was last shelved
        else:
            read += 1
            try:
                text, entry = book(path)
            except Unreadable as why:
                unreadable.append(f'{path.name}: {why}')
                continue
            data = text.encode('utf-8')
            key = hashlib.sha256(data).hexdigest()[:20]
            target = SHELF / f'{key}.js'
            if not target.is_file():
                packed = base64.b64encode(zlib.compress(data, 9)).decode('ascii')
                partial = SHELF / f'{key}.partial'
                partial.write_text(f'BABEL_SHELF_BOOK("{key}","{packed}");\n', encoding='ascii')
                partial.replace(target)
                written += 1
            entry['shelf'] = key
        seen[path.name] = {'size': stat.st_size, 'mtime': stat.st_mtime_ns, 'entry': entry}
        kept.add(f"{entry['shelf']}.js")
        entries.append({k: entry[k] for k in ('file', 'title', 'author', 'year', 'language', 'characters', 'shelf')})
    # the books that are gone, or cannot be read, and anything left over from shelving that was interrupted
    stale = [p for p in SHELF.iterdir() if p.suffix in ('.js', '.partial') and p.name not in kept]
    removed = 0
    for p in stale:
        try:
            p.unlink()
            removed += 1
        except OSError as exc:
            print(f'Could not remove {p.name}, which no book needs any more: {exc}')
    entries.sort(key=lambda e: (e['title'].lower(), e['file']))
    lines = ',\n'.join(json.dumps(e, separators=(',', ':')) for e in entries)
    index = ('// The books of this Library, for the catalogue\'s "Browse books".\n'
             '// Written by shelve.py, beside it, from the books (.md or .txt files) in uncompressed/:\n'
             '// run it again whenever they change (the git hook in .githooks/ does, before every commit).\n'
             f'window.BABEL_BOOKS = [\n{lines}\n];\n')
    listed = not INDEX.is_file() or INDEX.read_text(encoding='utf-8') != index
    if listed:
        INDEX.write_text(index, encoding='utf-8')
    if seen != cache or remembered.get('version') != VERSION:
        CACHE.write_text(json.dumps({'version': VERSION, 'books': seen}, ensure_ascii=False, separators=(',', ':')),
                         encoding='utf-8')
    changed = bool(written or removed or listed)
    if changed or not quiet:
        size = sum((SHELF / name).stat().st_size for name in kept)
        print(f'Shelved {len(entries)} books ({written} new or changed, {removed} removed, '
              f'{read} read again), {size / 1e6:,.1f} MB in books/compressed/.')
    if too_big:
        print('Left out, being larger than 64 MB: ' + ', '.join(too_big))
    if unreadable:
        # said even with --quiet: these books are not on the shelf until they are mended
        print('Left out until mended:\n' + '\n'.join('  ' + u for u in unreadable))
    return changed


if __name__ == '__main__':
    shelve(quiet='--quiet' in sys.argv[1:])
