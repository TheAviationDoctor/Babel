/*
 * publish.js for an Obsidian Publish site: adds, at the end of every note, a link to the
 * book of the Library of Babel that holds the note's text.
 *
 * The link carries the note's text, compressed. Whoever follows it arrives in the
 * Library standing before that book: a title page with the note's title, then the
 * note, set in the Library's pages.
 *
 * To use it:
 *   1. Put this file at the root of your vault, named publish.js. (If the vault already
 *      has a publish.js, paste this whole file at its end instead.)
 *   2. In Obsidian, open "Publish changes", tick publish.js (it is hidden from the file
 *      explorer, but listed there) and publish.
 *   3. Reload your site, holding Shift so the browser fetches the new script.
 * Obsidian Publish runs publish.js only on sites with a custom domain.
 */
(function () {
  'use strict';

  /* ---------------- settings ---------------- */

  const LIBRARY = 'https://babel.pellegr.in/'; // where the Library is published
  const SEED = 'borges'; // the Library to send readers to
  const LABEL = 'Find this post in the Library of Babel'; // the words of the link

  /* ---------------- the link ---------------- */

  const MARK = 'babel-library-link';
  if (window.__babelLibraryLink) return; // in case the script is included twice
  window.__babelLibraryLink = true;

  // The note's properties (frontmatter), from Publish's own renderer, when it offers them.
  let props = null;
  try {
    if (window.publish && typeof window.publish.registerMarkdownPostProcessor === 'function') {
      window.publish.registerMarkdownPostProcessor((el, ctx) => {
        if (ctx && ctx.frontmatter) props = { path: location.pathname, data: ctx.frontmatter };
      });
    }
  } catch (e) { /* not available: the title comes from the page */ }

  function toBase64Url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** The text as the Library's links carry it: UTF-8, deflated, in base64url ('z'), or plain ('u'). */
  async function pack(text) {
    const bytes = new TextEncoder().encode(text);
    if (typeof CompressionStream === 'function') {
      try {
        const out = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
        return 'z' + toBase64Url(new Uint8Array(out));
      } catch (e) { /* send it uncompressed */ }
    }
    return 'u' + toBase64Url(bytes);
  }

  function currentProps() {
    return props && props.path === location.pathname ? props.data || {} : {};
  }

  function noteTitle(sizer) {
    const p = currentProps();
    if (p.title) return String(p.title).trim();
    const header = sizer.querySelector('.page-header, .inline-title');
    if (header && header.innerText.trim()) return header.innerText.trim();
    const last = location.pathname.split('/').filter(Boolean).pop() || '';
    try { return decodeURIComponent(last.replace(/\+/g, ' ')).trim() || document.title; } catch (e) { return document.title; }
  }

  function noteYear() {
    const p = currentProps();
    for (const k of ['year', 'date', 'published', 'created']) {
      const m = p[k] !== undefined && p[k] !== null && /\b(\d{4})\b/.exec(String(p[k]));
      if (m) return m[1];
    }
    return '';
  }

  /** The note's text as a reader sees it: each block of the page, separated by a blank line. */
  function noteText(sizer) {
    const blocks = [];
    for (const el of sizer.children) {
      if (el.classList.contains(MARK)) continue;
      if (el.matches('.mod-header, .mod-footer, .markdown-preview-pusher, .mod-frontmatter, .frontmatter-container, .mod-ui')) continue;
      if (el.getClientRects().length === 0) continue; // not shown, such as the properties block
      const t = el.innerText.replace(/ /g, ' ').trim();
      if (t) blocks.push(t);
    }
    return blocks.join('\n\n');
  }

  function makeBlock() {
    const block = document.createElement('div');
    block.className = MARK;
    const a = document.createElement('a');
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = LABEL;
    // keep Publish's own link handling away from this one
    a.addEventListener('click', (e) => e.stopPropagation());
    block.appendChild(a);
    return block;
  }

  function place(sizer, block) {
    const footer = sizer.querySelector(':scope > .mod-footer');
    if (footer) { if (block.nextElementSibling !== footer) sizer.insertBefore(block, footer); }
    else if (block.parentNode !== sizer || sizer.lastElementChild !== block) sizer.appendChild(block);
  }

  async function update() {
    for (const sizer of document.querySelectorAll('.markdown-preview-sizer')) {
      if (sizer.closest('.popover, .hover-popover')) continue; // previews of other notes
      let block = sizer.querySelector(':scope > .' + MARK);
      const text = noteText(sizer);
      if (!text) { if (block) block.remove(); continue; }
      const key = location.pathname + '\u0000' + text;
      if (!block) { block = makeBlock(); place(sizer, block); }
      else place(sizer, block);
      if (block.dataset.key === key) continue;
      block.dataset.key = key;
      const params = new URLSearchParams();
      params.set('book', await pack(text));
      params.set('title', noteTitle(sizer));
      const year = noteYear();
      if (year) params.set('year', year);
      params.set('seed', SEED);
      if (block.dataset.key === key) block.firstChild.href = LIBRARY + '#' + params.toString();
    }
  }

  const style = document.createElement('style');
  style.textContent =
    `.${MARK} { margin: 2.5em 0 1em; padding-top: 0.9em; border-top: 1px solid var(--background-modifier-border, rgba(127, 127, 127, 0.3));` +
    ` font-size: var(--font-smaller, 0.9em); font-style: italic; color: var(--text-muted, inherit); }` +
    `.${MARK} a { color: inherit; text-decoration: underline; text-underline-offset: 0.2em; }`;
  document.head.appendChild(style);

  // Publish draws each note after the script has run, and draws the next one in place when
  // a link is followed: look again whenever the page changes, once it has settled.
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { update().catch(() => {}); }, 400); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();
})();
