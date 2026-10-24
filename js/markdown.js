/*
 * A small Markdown reader, for the catalogue's About tab: headings, paragraphs, bold and
 * italics, code, links (and bare web addresses), lists, tables, quotations and rules,
 * which is what README.md uses. HTML written in the text is shown as text, never run.
 *
 * BabelMarkdown.render(text) returns the HTML.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BabelMarkdown = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const blank = (line) => /^\s*$/.test(line);
  const indentOf = (line) => /^ */.exec(line)[0].length;
  const LIST = /^( *)([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
  const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
  const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
  const SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

  /** Only web, mail and in-page addresses are linked to. */
  function safeUrl(url) {
    const u = url.replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|#|\/|\.{0,2}\/)/i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u)) return esc(u);
    return '#';
  }

  /** Bold, italics, code, links and line breaks within a block. */
  function inline(text) {
    const kept = [];
    const keep = (html) => { kept.push(html); return `\u0000${kept.length - 1}\u0000`; };
    // code spans, then backslash escapes, are kept as they are
    let s = text.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m, ticks, code) => keep(`<code>${esc(code.replace(/\n/g, ' ').trim() || code)}</code>`));
    s = s.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, (m, c) => keep(esc(c)));
    s = esc(s);
    // links: [text](address), <address>, and bare web addresses
    s = s.replace(/\[([^\]]+)\]\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;[\s\S]*?&quot;)?\s*\)/g, (m, label, url) => keep(`<a href="${safeUrl(url)}">`) + label + keep('</a>'));
    s = s.replace(/&lt;((?:https?:\/\/|mailto:)[^\s&]+)&gt;/g, (m, url) => keep(`<a href="${safeUrl(url)}">${url}</a>`));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)'"\]])/g, (m, before, url) => before + keep(`<a href="${safeUrl(url)}">${url}</a>`));
    // bold, then italics
    s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
    s = s.replace(/(^|[^*\w])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_\w])_(?=[^\s_])([\s\S]*?[^\s_])_(?![_\w])/g, '$1<em>$2</em>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    // a line ending with two spaces or a backslash breaks there
    s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');
    for (let k = 0; k < 2; k++) s = s.replace(/\u0000(\d+)\u0000/g, (m, n) => kept[Number(n)]);
    return s;
  }

  /** The cells of a table row, split at bars that are not inside code or escaped. */
  function cells(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const out = [];
    let cell = '', ticks = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\' && s[i + 1] === '|') { cell += '|'; i++; continue; }
      if (c === '`') ticks ^= 1;
      if (c === '|' && !ticks) { out.push(cell.trim()); cell = ''; continue; }
      cell += c;
    }
    out.push(cell.trim());
    return out;
  }

  const isTable = (lines, i) => lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && SEPARATOR.test(lines[i + 1]);

  /** Whether a line begins a block of its own (so ends the paragraph before it). */
  function startsBlock(lines, i) {
    const l = lines[i];
    if (/^ {0,3}#{1,6}(\s|$)/.test(l) || FENCE.test(l) || RULE.test(l) || /^ {0,3}>/.test(l) || isTable(lines, i)) return true;
    const m = LIST.exec(l);
    return !!m && m[4] !== '' && (!/\d/.test(m[2]) || /^1[.)]$/.test(m[2]));
  }

  function table(lines, i) {
    const head = cells(lines[i]);
    const align = cells(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : /^:-+/.test(c) ? 'left' : ''));
    const cell = (tag, text, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(text || '')}</${tag}>`;
    let html = '<table>';
    if (head.some(Boolean)) html += `<thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead>`;
    html += '<tbody>';
    i += 2;
    while (i < lines.length && !blank(lines[i]) && lines[i].includes('|')) {
      const row = cells(lines[i++]);
      html += `<tr>${head.map((c, k) => cell('td', row[k], k)).join('')}</tr>`;
    }
    return { html: html + '</tbody></table>', i };
  }

  function list(lines, i) {
    const first = LIST.exec(lines[i]);
    const base = first[1].length, ordered = /\d/.test(first[2]);
    const items = [];
    let loose = false;
    while (i < lines.length) {
      const m = LIST.exec(lines[i]);
      if (!m || m[1].length !== base || /\d/.test(m[2]) !== ordered) break;
      const inner = m[1].length + m[2].length + Math.min(4, Math.max(1, m[3].length));
      const body = [m[4]];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (blank(l)) {
          let j = i;
          while (j < lines.length && blank(lines[j])) j++;
          if (j < lines.length && indentOf(lines[j]) >= inner) { // the item goes on after the blank line
            while (i < j) { body.push(''); i++; }
            loose = true;
            continue;
          }
          break;
        }
        if (indentOf(l) >= inner) { body.push(l.slice(inner)); i++; continue; }
        if (LIST.test(l) || startsBlock(lines, i)) break;
        body.push(l.trim()); // the paragraph goes on without being indented
        i++;
      }
      items.push(body.join('\n'));
      let j = i;
      while (j < lines.length && blank(lines[j])) j++;
      const next = j < lines.length ? LIST.exec(lines[j]) : null;
      if (next && next[1].length === base && /\d/.test(next[2]) === ordered) {
        if (j > i) loose = true;
        i = j;
      } else break;
    }
    const start = ordered ? parseInt(first[2], 10) : 1;
    const tag = ordered ? 'ol' : 'ul';
    const lis = items.map((item) => {
      let html = render(item);
      if (!loose) html = html.replace(/<p>([\s\S]*?)<\/p>/g, '$1');
      return `<li>${html}</li>`;
    });
    return { html: `<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>${lis.join('')}</${tag}>`, i };
  }

  /** The HTML for a whole text. */
  function render(markdown) {
    const lines = String(markdown).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
    const out = [];
    let i = 0, m;
    while (i < lines.length) {
      const line = lines[i];
      if (blank(line)) { i++; continue; }
      if ((m = FENCE.exec(line))) {
        const close = new RegExp(`^ {0,3}\\${m[1][0]}{${m[1].length},}\\s*$`), body = [];
        i++;
        while (i < lines.length && !close.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
        continue;
      }
      if (/^ {4,}\S/.test(line)) {
        const body = [];
        while (i < lines.length && (/^ {4}/.test(lines[i]) || blank(lines[i]))) body.push(lines[i++].slice(4));
        while (body.length && blank(body[body.length - 1])) body.pop();
        out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
        continue;
      }
      if ((m = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/.exec(line))) {
        out.push(`<h${m[1].length}>${inline(m[2] || '')}</h${m[1].length}>`);
        i++;
        continue;
      }
      if (RULE.test(line)) { out.push('<hr>'); i++; continue; }
      if (isTable(lines, i)) { const t = table(lines, i); out.push(t.html); i = t.i; continue; }
      if (/^ {0,3}>/.test(line)) {
        const body = [];
        while (i < lines.length && !blank(lines[i]) && (/^ {0,3}>/.test(lines[i]) || !startsBlock(lines, i))) body.push(lines[i++].replace(/^ {0,3}> ?/, ''));
        out.push(`<blockquote>${render(body.join('\n'))}</blockquote>`);
        continue;
      }
      if (LIST.test(line) && LIST.exec(line)[4] !== '') { const l = list(lines, i); out.push(l.html); i = l.i; continue; }
      const para = [line.trim()];
      i++;
      while (i < lines.length && !blank(lines[i]) && !startsBlock(lines, i)) para.push(lines[i++].replace(/^ +/, ''));
      out.push(`<p>${inline(para.join('\n'))}</p>`);
    }
    return out.join('\n');
  }

  return { render, inline };
});
