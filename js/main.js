/*
 * Start-up and the screens around the walk: reading and sleep. There is no title screen and
 * no menu: the reader wakes in the Library straight away (or before the book a link leads
 * to), and the catalogue in every vestibule tells them where they are.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const $ = (id) => document.getElementById(id);
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  let raw, lib, assets, world, player, renderer, scene, camera, reflector, sinkReflector, figure, figureLight, terminal;
  let mode = 'walking';
  let gaze = null, gazeKey = '';
  let reading = null;
  let lastJourney = null; // how far the last jump through the catalogue went

  function showError(message, hint) {
    Babel.failed = true;
    $('error-message').textContent = message;
    if (hint) $('error-hint').textContent = hint;
    $('error').hidden = false;
  }

  // Anything that goes wrong while the Library is being built is shown, not left as a black screen.
  const RELOAD = 'Reload the page while holding Shift, so that the browser fetches every file again. If that does not help, the browser may be too old for the Library.';
  window.addEventListener('error', (e) => {
    if (!Babel.started && !Babel.failed) showError(`Something went wrong while the Library was being built: ${e.message}`, RELOAD);
  });

  let toastTimer = 0;
  function toast(text, ms) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || 3200);
  }

  /* ---------------- building ---------------- */

  function boot() {
    raw = window.BABEL_CONFIG;
    if (!raw) return showError('The configuration file config.js was not found, or it does not define window.BABEL_CONFIG.');
    try {
      lib = new BabelCore.Library(raw);
    } catch (e) {
      return showError(e.message);
    }

    try {
      renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return showError('This browser could not start WebGL, which the Library needs to draw itself. Try a recent version of Chrome, Edge, Firefox or Safari.');
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    scene = new THREE.Scene();
    const soot = new THREE.Color(0x0d0a07);
    scene.background = soot;
    scene.fog = new THREE.FogExp2(soot, 0.082);
    camera = new THREE.PerspectiveCamera(lib.config.fieldOfView || 72, window.innerWidth / window.innerHeight, 0.05, 90);

    const textures = Babel.Textures.create();
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    for (const k of ['wood', 'plaster', 'stone', 'tiles', 'spines']) textures[k].anisotropy = aniso;
    assets = Babel.Architecture.createAssets(lib.config, textures);
    world = new Babel.World(scene, assets, lib);
    player = new Babel.Player(assets.dims, camera, renderer.domElement);
    player.sensitivity = lib.config.lookSensitivity || 1;
    player.onTap = () => { if (mode === 'walking') interact(); };
    player.doorOpen = (off) => world.isDoorOpen(player.cg + off, player.cf);

    // The mirror in the nearest vestibule. Its camera sees layer 1, where the reader's own figure lives.
    const d = assets.dims;
    reflector = new THREE.Reflector(assets.geometries.mirror, {
      textureWidth: 512, textureHeight: 512, color: 0x8d877b, clipBias: 0.002,
    });
    reflector.camera.layers.enableAll();
    scene.add(reflector);
    // The small mirror above the sink of the nearest cell.
    sinkReflector = new THREE.Reflector(assets.geometries.sinkMirror, {
      textureWidth: 512, textureHeight: 512, color: 0x8d877b, clipBias: 0.002,
    });
    sinkReflector.camera.layers.enableAll();
    sinkReflector.rotation.y = Math.PI;
    sinkReflector.visible = false;
    scene.add(sinkReflector);
    // A mirror seen in a mirror keeps its last picture rather than rendering again.
    let reflecting = false;
    for (const r of [reflector, sinkReflector]) {
      const render = r.onBeforeRender;
      r.onBeforeRender = function (a, b, c) {
        if (reflecting) return;
        reflecting = true;
        try { render.call(this, a, b, c); } finally { reflecting = false; }
      };
    }
    figure = makeFigure();
    figure.traverse((o) => o.layers.set(1));
    scene.add(figure);
    figureLight = new THREE.HemisphereLight(0xb08a5e, 0x140e09, 1.1);
    scene.add(figureLight);
    sizeMirror();

    terminal = new Babel.Terminal({
      lib: () => lib, world, player, dims: assets.dims,
      setMode, startWalking, openBookAt, toast, copyText, linkBase,
      // every journey through the catalogue says, for a while, how far it went
      goToCell: (...a) => journey(() => goToCell(...a)),
      goToAddress: (...a) => journey(() => goToAddress(...a)),
      goToRandom: () => journey(goToRandom),
      lastJourney: () => lastJourney,
    });

    wake();
    bindInterface();
    fitGlyphs();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitGlyphs).catch(() => {});
    window.addEventListener('resize', onResize);
    requestAnimationFrame(frame);
    Babel.started = true;
    void d;
  }

  /** A hooded librarian. Only mirrors show it. */
  function makeFigure() {
    const pts = [
      [0, 0], [0.27, 0], [0.28, 0.05], [0.25, 0.55], [0.22, 1.05], [0.23, 1.33], [0.17, 1.46],
      [0.1, 1.5], [0.12, 1.56], [0.135, 1.65], [0.125, 1.75], [0.08, 1.83], [0, 1.86],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 28);
    const m = new THREE.MeshLambertMaterial({ color: 0x382d24 });
    const body = new THREE.Mesh(g, m);
    const group = new THREE.Group();
    group.add(body);
    // the face, a little darker, under the hood
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshLambertMaterial({ color: 0x6b5644 }));
    face.position.set(0, 1.63, -0.07);
    group.add(face);
    return group;
  }

  function sizeMirror() {
    const pr = renderer.getPixelRatio();
    reflector.getRenderTarget().setSize(Math.round(window.innerWidth * pr * 0.6), Math.round(window.innerHeight * pr * 0.6));
    sinkReflector.getRenderTarget().setSize(Math.round(window.innerWidth * pr * 0.5), Math.round(window.innerHeight * pr * 0.5));
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    sizeMirror();
    if (mode === 'reading') sizePage();
  }

  /** Wakes the reader in a hexagon chosen at random, a different one on every visit. */
  function wake() {
    const loc = lib.randomLocation();
    world.setAnchor(loc.gallery, loc.floor);
    if (terminal) terminal.reset();
    player.origin = 'woke';
    player.placeAtStart();
    world.update(0, 0);
  }

  /** Goes to hexagon (dg, df) relative to the anchor; with `face`, stands before that book. */
  function goToCell(dg, df, face) {
    if (face) player.faceBook(dg, df, face.wall, face.shelf, face.volume);
    else player.placeAtStart(dg, df);
    world.update(player.cg, player.cf);
    startWalking();
  }

  /** Goes to a hexagon anywhere, given its absolute floor and gallery addresses. */
  function goToAddress(gallery, floor, face, mark) {
    world.setAnchor(gallery, floor);
    terminal.reset();
    player.origin = 'arrived';
    if (mark) world.setMark(Object.assign({ dg: 0, df: 0 }, mark));
    goToCell(0, 0, face);
  }

  /* ---------------- links to books ---------------- */

  /** Where links copied from the catalogue lead: the published Library, or else this page if it is on the web. */
  function linkBase() {
    if (lib.config.website) return lib.config.website;
    return /^https?:$/.test(location.protocol) ? location.href.replace(/#.*$/, '') : '';
  }

  /**
   * If the page's address is a link to a text (…/#text=…) or to a book of the collection
   * (…/#book=…), sets the reader down before the book it leads to, and returns true.
   */
  async function goToLinkedBook(travelling) {
    const hash = location.hash;
    const book = BabelCore.Library.readBookLink(hash);
    if (book) return goToCollectionBook(book, hash, travelling);
    let link;
    try {
      link = await BabelCore.Library.readLink(hash);
    } catch (e) {
      toast(/too old/.test(e.message) ? e.message : 'This link to a text could not be read. It may have been cut short.', 7000);
      return false;
    }
    if (!link) return false;
    const p = lib.prepareText(link.text);
    if (!p.symbols.length) { toast('This link carries no text that the Library can hold.', 7000); return false; }
    let loc, length = 0;
    if (link.typed) {
      // as typed, at the very start of the first page, as "Find a text" places it
      if (p.symbols.length > lib.M) { toast('The text this link carries is longer than a book of the Library.', 7000); return false; }
      loc = lib.findText(p.symbols, { fill: link.random ? 'random' : 'blank' }).location;
      length = p.symbols.length;
    } else {
      loc = lib.bookOfText(link.text, link.random).location;
    }
    const go = () => goToAddress(loc.gallery, loc.floor, lib.slotParts(loc.slot), { slot: loc.slot, start: 0, length, link: hash });
    if (travelling) journey(go); else go();
    toast(`Before you, a little out of its row, stands the book the link leads to. ${isTouch ? 'Tap it' : 'Press E'} to read it.`, 6000);
    return true;
  }

  function goToRandom() {
    const loc = lib.randomLocation();
    goToAddress(loc.gallery, loc.floor, null);
    toast('You arrive in a hexagon chosen at random.');
  }

  /** Follows a link to a book of the collection: '#book=<id>' or '#book=<id>/<part>', and '&random' after either. */
  async function goToCollectionBook(ref, hash, travelling) {
    if (ref.error) { toast(ref.error, 7000); return false; }
    let text;
    try {
      text = await Babel.Collection.text({ shelf: ref.id });
    } catch (e) {
      toast(/too old/.test(e.message) ? e.message : 'This link leads to a book that is not in the collection of this Library.', 7000);
      return false;
    }
    const books = await Babel.Collection.load();
    const book = books.find((b) => b.shelf === ref.id);
    const set = lib.typeset(BabelCore.Library.cleanEbook(text).text, {});
    const n = set.parts.length;
    if (ref.part > n) { toast(`This link leads to part ${ref.part} of a book that has ${n === 1 ? 'only one part' : `only ${n} parts`}.`, 7000); return false; }
    const r = lib.findText(set.parts[ref.part - 1], { fill: ref.random ? 'random' : 'blank' });
    const title = book ? (n > 1 ? `${book.title}, part ${ref.part} of ${n}` : book.title) : '';
    const go = () => goToAddress(r.location.gallery, r.location.floor, lib.slotParts(r.location.slot),
      { slot: r.location.slot, start: 0, length: 0, title, link: hash });
    if (travelling) journey(go); else go();
    toast(`Before you, a little out of its row, stands ${title || 'the book the link leads to'}. ${isTouch ? 'Tap it' : 'Press E'} to read it.`, 6000);
    return true;
  }

  /* ---------------- text ---------------- */

  const fmt = (n) => n.toLocaleString('en');


  /* ---------------- journeys ---------------- */

  /** The reader's hexagon, as absolute addresses. */
  function here() {
    return { gallery: world.gallery(player.cg).digits.slice(), floor: world.floor(player.cf).digits.slice() };
  }

  /** Makes a journey (`move` takes the reader somewhere) and remembers how far it went, for the catalogue. */
  function journey(move) {
    const from = here();
    move();
    const to = here();
    const dg = lib.galleryDifference(from.gallery, to.gallery), df = lib.floorDifference(from.floor, to.floor);
    if (dg.sign === 0 && df.sign === 0) return;
    const was = lib.position(from.gallery, from.floor);
    lastJourney = { dg, df, from: { east: was.east.fraction, up: was.up.fraction } };
  }

  /* ---------------- modes ---------------- */

  function lockPointer() {
    if (isTouch) return;
    const el = renderer.domElement;
    try {
      const p = el.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointer lock unavailable: drag to look instead */ }
  }

  function setMode(next) {
    if (sleep && next !== 'sleeping' && sleep.phase !== 'waking') endSleep();
    mode = next;
    $('hud').hidden = next !== 'walking';
    $('reader').hidden = next !== 'reading';
    $('terminal').hidden = next !== 'terminal';
    $('sleep').hidden = next !== 'sleeping';
    player.enabled = next === 'walking';
    if ((next === 'terminal' || next === 'reading' || next === 'sleeping') && document.pointerLockElement) document.exitPointerLock();
    if (next !== 'walking') { world.clearHover(); gaze = null; gazeKey = ''; $('gaze').hidden = true; }
    updateLookHint();
  }

  function updateLookHint() {
    const locked = document.pointerLockElement === renderer.domElement;
    $('look-hint').hidden = !(mode === 'walking' && !locked && !isTouch);
  }

  function startWalking() {
    setMode('walking');
    lockPointer();
  }

  /* ---------------- reading ---------------- */

  function interact() {
    if (!gaze) return;
    if (gaze.kind === 'door') {
      const dg = player.cg + gaze.cellOffset, df = player.cf;
      const state = world.doorState(dg, df);
      const closing = state && state.target === 1;
      if (closing && player.inDoorway(gaze.cellOffset)) { toast('Step out of the doorway first.'); return; }
      world.toggleDoor(dg, df);
      gazeKey = '';
      return;
    }
    if (gaze.kind === 'terminal') { terminal.open(); return; }
    if (gaze.kind === 'lamp') {
      world.toggleLamp(player.cg + gaze.cellOffset, player.cf);
      gazeKey = '';
      return;
    }
    if (gaze.kind === 'bed') { fallAsleep(player.cg + gaze.cellOffset, player.cf); return; }
    openBook(gaze);
  }

  /** Opens the book the reader is looking at on the shelves. */
  function openBook(target) {
    const dg = player.cg + target.off, df = player.cf;
    const mark = world.mark && world.isMarked(dg, df, target.slot) ? world.mark : null;
    openBookAt({
      location: world.location(dg, df, target.slot), slot: target.slot,
      highlight: mark && mark.length ? { start: mark.start, length: mark.length } : null, returnTo: 'walking',
      link: (mark && mark.link) || null, // the link that led to it, if a link (or the catalogue) did
    });
  }

  /**
   * Opens any book of the Library. options: { location, slot, content?, highlight?: { start, length }, returnTo }.
   */
  function openBookAt(o) {
    const content = o.content || lib.bookAt(o.location);
    if (!content) { toast('This shelf is empty. The Library ends here.'); return; }
    const fp = lib.hexagonFingerprint(o.location.gallery, o.location.floor);
    const { wall, shelf, volume } = lib.slotParts(o.slot);
    const c = lib.config;
    reading = {
      content, returnTo: o.returnTo || 'walking', highlight: o.highlight || null,
      page: o.highlight ? Math.floor(o.highlight.start / c.charactersPerPage) : 0,
      title: lib.spineTitle(fp, o.slot),
      link: o.link || null,
    };
    $('copy-book-link').hidden = !reading.link;
    $('book-title').textContent = reading.title;
    $('book-where').textContent = `Wall ${wall + 1}, shelf ${shelf + 1}, volume ${volume + 1}`;
    $('page-count').textContent = `of ${fmt(c.pagesPerBook)}`;
    $('page-input').max = c.pagesPerBook;
    $('show-passage').hidden = !reading.highlight;
    $('close-book').textContent = reading.returnTo === 'terminal' ? 'Back to the catalogue' : 'Put the book back';
    $('book-keys').textContent = reading.returnTo === 'terminal' ? 'Arrow keys turn pages. Esc returns to the catalogue.' : 'Arrow keys turn pages. Esc puts the book back.';
    setMode('reading');
    renderPage();
    $('page').focus({ preventScroll: true });
  }

  /** Fits the page to the window, whatever the number of lines and characters. */
  function sizePage() {
    const c = lib.config;
    const W = window.innerWidth - 40, H = window.innerHeight - 210;
    const size = Math.min(W / (c.charactersPerLine * 0.6 + 5.4), H / (c.linesPerPage * 1.3 + 6.9));
    $('page').style.fontSize = Math.max(6, Math.min(22, size)).toFixed(2) + 'px';
  }

  function renderPage() {
    const P = lib.config.pagesPerBook;
    sizePage();
    reading.page = Math.max(0, Math.min(P - 1, reading.page));
    const pre = $('page');
    const c = lib.config, lines = lib.pageLines(reading.content, reading.page);
    const h = reading.highlight;
    pre.textContent = '';
    // mark the passage the catalogue found, wherever it falls on this page
    const base = reading.page * c.charactersPerPage;
    lines.forEach((line, i) => {
      const s0 = base + i * c.charactersPerLine;
      const a = h ? Math.max(h.start, s0) - s0 : 0, b = h ? Math.min(h.start + h.length, s0 + c.charactersPerLine) - s0 : 0;
      if (b > a) {
        if (a > 0) appendText(pre, line.slice(0, a));
        const m = document.createElement('mark');
        appendText(m, line.slice(a, b));
        pre.appendChild(m);
        if (b < line.length) appendText(pre, line.slice(b));
      } else appendText(pre, line);
      if (i < lines.length - 1) pre.appendChild(document.createTextNode('\n'));
    });
    const folio = document.createElement('span');
    folio.className = 'folio';
    folio.textContent = String(reading.page + 1);
    pre.appendChild(folio);
    $('page-input').value = reading.page + 1;
    $('prev-page').disabled = reading.page === 0;
    $('next-page').disabled = reading.page === P - 1;
  }

  // Symbols that must be set in a column box of their own: control pictures ('ctl'), and
  // any symbol the page's typeface lacks, which another font then draws at its own width ('fit').
  let fitted = new Map();

  /** Appends text to an element, keeping every symbol to one column of the page. */
  function appendText(el, text) {
    if (!fitted.size) { el.appendChild(document.createTextNode(text)); return; }
    let run = '';
    for (const ch of text) {
      const cls = fitted.get(ch);
      if (!cls) { run += ch; continue; }
      if (run) { el.appendChild(document.createTextNode(run)); run = ''; }
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = ch;
      el.appendChild(span);
    }
    if (run) el.appendChild(document.createTextNode(run));
  }

  /**
   * Measures every symbol of the alphabet in the page's typeface. Control pictures, and
   * symbols the typeface lacks, come from other fonts at other widths: they are scaled
   * to fit one column, so that the page stays a perfect grid.
   */
  function fitGlyphs() {
    fitted = new Map();
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `100px ${getComputedStyle($('page')).fontFamily}`;
      const cell = ctx.measureText('0').width;
      let widestCtl = 0, widestFit = 0;
      for (const g of lib.glyphs) {
        const w = ctx.measureText(g).width;
        if (lib.isControlGlyph(g)) { fitted.set(g, 'ctl'); widestCtl = Math.max(widestCtl, w); }
        else if (g !== ' ' && Math.abs(w - cell) > cell * 0.03) { fitted.set(g, 'fit'); widestFit = Math.max(widestFit, w); }
      }
      const root = document.documentElement.style;
      if (widestCtl) root.setProperty('--ctl-fit', Math.min(0.85, (0.95 * cell) / widestCtl).toFixed(3));
      if (widestFit) root.setProperty('--glyph-fit', Math.min(1, (0.98 * cell) / widestFit).toFixed(3));
    } catch (e) {
      for (const g of lib.controlGlyphs) fitted.set(g, 'ctl');
    }
    if (reading) renderPage();
  }

  function turn(delta) { reading.page += delta; renderPage(); }

  function closeBook() {
    const back = reading && reading.returnTo;
    reading = null;
    if (back === 'terminal') setMode('terminal');
    else startWalking();
  }

  /* ---------------- sleep ---------------- */

  // How sleep unfolds, in seconds: the Library fades to black, the dream comes out of the
  // black, and sentences come and go over it; on waking, the dream fades to black and the
  // Library comes back. How long each sentence stays, and the pause before the next, are
  // set in config.js.
  const SLEEP = { fall: 1.6, reveal: 3, firstWords: 1, fade: 2, wakeOut: 0.9, wakeIn: 1.4, deaf: 0.5 };
  let dream = null; // the dream's shader, made the first time the reader sleeps
  let sleep = null; // the state of the sleep under way, if any

  /** Four unsigned 32-bit integers from a hexagon's address (its gallery and floor numbers). */
  function hexagonSeed(dg, df) {
    const hash = BabelCore.util.hashBytes;
    const g = world.gallery(dg).digits, f = world.floor(df).digits;
    const a = hash(g, 0x6472656d, 0x6865780a); // the address alone, whatever the Library's seed
    const b = hash(f, a[0], a[1]);
    const c = hash(g, b[0] ^ 0x51ee9, b[1]);
    return [b[0], b[1], c[0], c[1]];
  }

  /** Lies down on the bed of the cell beside gallery dg of floor df. */
  function fallAsleep(dg, df) {
    if (sleep || mode !== 'walking') return;
    if (!dream) {
      try { dream = new Babel.Dream(); } catch (e) { toast('This browser cannot dream.'); return; }
    }
    const now = performance.now() / 1000;
    sleep = {
      phase: 'falling', start: now, seed: hexagonSeed(dg, df), quote: -1,
      duration: lib.config.quoteDuration || 10, interval: lib.config.quoteInterval === undefined ? 5 : lib.config.quoteInterval,
      pixelRatio: renderer.getPixelRatio(), dreaming: false,
    };
    dream.begin(sleep.seed);
    $('dream-quote').textContent = '';
    $('dream-quote').style.opacity = 0;
    $('sleep-hint').textContent = isTouch ? 'Tap to wake' : 'Click or press Esc to wake';
    $('sleep-hint').style.opacity = 0;
    $('sleep-black').style.opacity = 0;
    $('sleep-black').hidden = false;
    setMode('sleeping');
  }

  /** Leaves the dream. With `look`, takes the mouse back to look around once awake. */
  function wakeUp(look) {
    if (!sleep || sleep.phase === 'waking') return;
    const now = performance.now() / 1000;
    if (now - sleep.start < SLEEP.deaf) return; // the click or tap that lay down, not one to wake
    sleep.phase = 'waking';
    sleep.wake = now;
    sleep.fromDream = sleep.dreaming;
    sleep.black = Number($('sleep-black').style.opacity) || 0;
    if (look) lockPointer(); // asked for now, while the click still counts
  }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

  /**
   * Moves sleep on to time `now` (seconds): the black, the sentence and the hint, and which
   * scene of the dream shows. Returns what to draw: null for the Library, or the dream's
   * time, its scene and how far that scene has melted into the next.
   */
  function updateSleep(now) {
    const S = SLEEP, z = sleep;
    const dreamStart = z.start + S.fall;
    const wordsStart = dreamStart + S.reveal + S.firstWords;
    const hold = z.duration, gap = z.interval;
    const period = 2 * S.fade + hold + gap;
    const t = now - dreamStart;
    let black;

    if (z.phase === 'falling') {
      black = ease((now - z.start) / S.fall);
      if (t >= 0) z.phase = 'dreaming';
    }
    if (z.phase === 'dreaming') {
      black = 1 - ease(t / S.reveal);
    } else if (z.phase === 'waking') {
      const since = now - z.wake;
      if (z.fromDream && since < S.wakeOut) {
        // the black comes back over the dream…
        black = z.black + (1 - z.black) * ease(since / S.wakeOut);
      } else {
        // …and lifts from the Library (or, woken before the dream came, lifts from where it was)
        if (mode === 'sleeping') leaveDream();
        const lift = z.fromDream ? (since - S.wakeOut) / S.wakeIn : since / Math.max(0.05, S.wakeIn * z.black);
        black = (z.fromDream ? 1 : z.black) * (1 - ease(lift));
        if (lift >= 1) {
          $('sleep-black').hidden = true;
          sleep = null;
          return null;
        }
      }
    }
    if (z.phase === 'dreaming' && !z.dreaming) {
      z.dreaming = true;
      // the dream is soft: one pixel of the screen per pixel drawn is plenty
      if (z.pixelRatio > 1) { renderer.setPixelRatio(1); onResize(); }
    }

    let words = 0, hint = 0, picture = null;
    if (z.dreaming) {
      // sentence k fades in at wordsStart + k × period, stays, and fades out
      const w = now - wordsStart;
      if (w >= 0) {
        const k = Math.floor(w / period), u = w - k * period;
        if (k !== z.quote) { z.quote = k; $('dream-quote').textContent = BabelQuotes.quote(z.seed, k); }
        words = u < S.fade ? ease(u / S.fade) : u < S.fade + hold ? 1 : ease(1 - (u - S.fade - hold) / S.fade);
      }
      // scene n melts into scene n + 1 while one sentence fades out and the next fades in
      const melt = 2 * S.fade + gap, m = w - (S.fade + hold);
      let n = 0, mix = 0;
      if (m >= 0) {
        const k = Math.floor(m / period), v = m - k * period;
        if (v < melt) { n = k; mix = v / melt; } else n = k + 1;
      }
      picture = { t, n, mix };
      // how to wake, said once, softly, until the first sentence has come
      hint = 0.5 * ease((t - 1) / 1.5) * ease(1 - (now - (wordsStart + S.fade + 3)) / 1.5);
    }
    $('sleep-black').style.opacity = black.toFixed(3);
    $('dream-quote').style.opacity = words.toFixed(3);
    $('sleep-hint').style.opacity = hint.toFixed(3);
    return picture;
  }

  /** Back from the dream to the Library (still under the black, which then lifts). */
  function leaveDream() {
    const z = sleep;
    if (z.dreaming) {
      z.dreaming = false;
      if (renderer.getPixelRatio() !== z.pixelRatio) { renderer.setPixelRatio(z.pixelRatio); onResize(); }
    }
    if (mode === 'sleeping') setMode('walking');
  }

  /** Ends sleep at once (when something else takes the reader away from the bed). */
  function endSleep() {
    if (renderer.getPixelRatio() !== sleep.pixelRatio) { renderer.setPixelRatio(sleep.pixelRatio); onResize(); }
    $('sleep-black').hidden = true;
    sleep = null;
  }

  /* ---------------- interface wiring ---------------- */

  function bindInterface() {
    // a link to a book, pasted into the address bar while the Library is open
    window.addEventListener('hashchange', () => { goToLinkedBook(true); });

    $('prev-page').addEventListener('click', () => turn(-1));
    $('next-page').addEventListener('click', () => turn(1));
    $('random-page').addEventListener('click', () => { reading.page = Math.floor(Math.random() * lib.config.pagesPerBook); renderPage(); });
    $('copy-page').addEventListener('click', () => {
      copyText(lib.pageLines(reading.content, reading.page).join('\n'), `Copied page ${reading.page + 1}.`);
    });
    $('close-book').addEventListener('click', closeBook);
    $('copy-book-link').addEventListener('click', () => {
      const base = linkBase();
      if (!base) { toast('To copy links from a copy of the Library on this computer, set "website" in config.js to the address where the Library is published.', 7000); return; }
      const url = base.replace(/#.*$/, '') + reading.link;
      const long = url.length > 60000 ? ` It is ${fmt(url.length)} characters long, which is more than some browsers and websites accept.` : '';
      copyText(url, `Copied a link to this book. Whoever opens it is set down before it.${long}`);
    });
    $('show-passage').addEventListener('click', () => {
      reading.page = Math.floor(reading.highlight.start / lib.config.charactersPerPage);
      renderPage();
    });
    $('page-form').addEventListener('submit', (e) => { e.preventDefault(); reading.page = Number($('page-input').value) - 1; renderPage(); $('page').focus(); });
    $('page-input').addEventListener('change', () => { reading.page = Number($('page-input').value) - 1; renderPage(); });

    // waking from a dream
    $('sleep').addEventListener('click', () => wakeUp(!isTouch));

    const canvas = renderer.domElement;
    canvas.addEventListener('click', () => {
      if (mode !== 'walking' || isTouch) return;
      if (document.pointerLockElement === canvas) interact();
      else lockPointer();
    });
    // Esc lets go of the mouse (the browser sees to that): the reader stands still until a click
    document.addEventListener('pointerlockchange', updateLookHint);

    window.addEventListener('keydown', (e) => {
      const inField = e.target && (e.target.tagName === 'INPUT');
      if (mode === 'walking') {
        if (e.code === 'KeyE') interact();
      } else if (mode === 'reading') {
        if (inField && e.code !== 'Escape') return;
        if (e.code === 'ArrowLeft' || e.code === 'PageUp') { turn(-1); e.preventDefault(); }
        else if (e.code === 'ArrowRight' || e.code === 'PageDown' || e.code === 'Space') { turn(1); e.preventDefault(); }
        else if (e.code === 'Home') { reading.page = 0; renderPage(); e.preventDefault(); }
        else if (e.code === 'End') { reading.page = lib.config.pagesPerBook - 1; renderPage(); e.preventDefault(); }
        else if (e.code === 'Escape' || e.code === 'KeyE') { closeBook(); e.preventDefault(); }
      } else if (mode === 'terminal') {
        if (e.code === 'Escape') { e.preventDefault(); terminal.close(); }
      } else if (mode === 'sleeping') {
        if (e.code === 'Escape') { e.preventDefault(); wakeUp(false); }
      }
    });

    // straight into the Library: before the book a link leads to, or in the waking hexagon
    setMode('walking');
    goToLinkedBook().then((went) => {
      // (a link that could not be followed has said why: that stays on screen instead)
      if (!went && !/^#(text|book)=/.test(location.hash)) {
        toast((isTouch ? 'Drag on the right to look around, hold and slide on the left to walk, and tap a book to read it.'
          : 'Walk with W A S D, and press E to take down a book.') + ' The catalogue in each vestibule tells you where you are.', 9000);
      }
    });
  }

  function copyText(text, done) {
    const fallback = () => toast('Copying is not allowed here. Select the text and copy it yourself.');
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(text);
      if (p && p.then) p.then(() => toast(done), fallback); else fallback();
    } catch (e) { fallback(); }
  }

  /* ---------------- frame ---------------- */

  // Lowers the resolution if frames are slow on this machine.
  const quality = { sum: 0, n: 0, level: 0 };
  function adaptQuality(rawDt) {
    if (mode !== 'walking' || document.hidden) return;
    quality.sum += rawDt; quality.n++;
    if (quality.n < 120) return;
    const avg = quality.sum / quality.n;
    quality.sum = 0; quality.n = 0;
    if (avg > 0.024 && quality.level < 3) {
      quality.level++;
      const pr = renderer.getPixelRatio();
      if (pr > 1) renderer.setPixelRatio(Math.max(1, pr - 0.375));
      else world.view.farFloors = Math.max(3, world.view.farFloors - 1);
      onResize();
      world.center = null;
    }
  }

  /** How well lit the reader is (1 in the galleries), for their reflection in the mirrors. */
  function lightOnReader() {
    const d = assets.dims;
    for (const off of [0, -1]) {
      const hx = player.x - off * d.Dx;
      if (hx > d.cellX0 - 0.1 && hx < d.cellX1 + 0.1 && player.z < -d.hallW / 2 && player.z > d.cellZ1 - 0.1) {
        const dg = player.cg + off, df = player.cf;
        const b = world.lampBrightness(dg, df), t = world.doorOpenness(dg, df);
        return b + (1 - b) * (0.03 + 0.2 * t * t * (3 - 2 * t));
      }
    }
    return 1;
  }

  let last = performance.now();
  function frame(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    adaptQuality(rawDt);
    player.update(dt);
    world.update(player.cg, player.cf);
    world.tick(dt);
    figureLight.intensity = 1.1 * lightOnReader();

    if (mode === 'walking') updateGaze();

    // the nearest mirror on this floor, and the figure it reflects
    const d = assets.dims;
    const mx = Math.abs(player.x - d.mirrorX) < Math.abs(player.x - (d.mirrorX - d.Dx)) ? d.mirrorX : d.mirrorX - d.Dx;
    reflector.position.set(mx, d.mirrorY0 + d.mirrorH / 2, -d.hallW / 2 + 0.043);
    // the sink mirror of the nearest cell, while the reader is in it or at its open door
    const off = Math.abs(player.x - d.sinkMirror.x) < Math.abs(player.x - (d.sinkMirror.x - d.Dx)) ? 0 : -1;
    const sx = d.sinkMirror.x + off * d.Dx;
    const cellShown = world.doorOpenness(player.cg + off, player.cf) > 0.05 || player.z < d.cellZ0;
    sinkReflector.visible = cellShown && Math.abs(player.y) < 1 && Math.abs(player.x - sx) < 3 && player.z < 0;
    sinkReflector.position.set(sx, d.sinkMirror.y0 + d.sinkMirror.h / 2, d.cellZ0 - 0.014);
    figure.position.set(player.x, player.y, player.z);
    figure.rotation.y = player.yaw;

    // asleep, the dream is drawn instead of the Library, and the Library while it fades
    const picture = sleep ? updateSleep(now / 1000) : null;
    // behind the catalogue or a book, the Library only needs drawing now and then
    frameCount++;
    if (picture) dream.render(renderer, picture.t, picture.n, picture.mix);
    else if (mode === 'walking' || sleep || frameCount % 4 === 0) renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  let frameCount = 0;

  function updateGaze() {
    const book = player.pick(lib);
    const door = player.pickDoor((off) => world.doorOpenness(player.cg + off, player.cf));
    const term = player.pickTerminal();
    const lamp = player.pickLamp((off) => world.doorOpenness(player.cg + off, player.cf));
    const bed = player.pickBed((off) => world.doorOpenness(player.cg + off, player.cf));
    const nearest = (hit, ...others) => hit && others.every((o) => !o || hit.t < o.t);
    if (nearest(bed, book, door, lamp, term)) {
      const dg = player.cg + bed.cellOffset, df = player.cf;
      const key = `bed,${dg},${df}`;
      if (key === gazeKey) return;
      gazeKey = key;
      world.clearHover();
      gaze = { kind: 'bed', cellOffset: bed.cellOffset };
      $('gaze-title').hidden = true;
      $('gaze-where').textContent = 'A narrow bed';
      $('gaze-hint').textContent = `${isTouch ? 'Tap' : 'Press E or click'} to sleep`;
      $('gaze').hidden = false;
      return;
    }
    if (lamp && (!book || lamp.t < book.t) && (!door || lamp.t < door.t)) {
      const dg = player.cg + lamp.cellOffset, df = player.cf;
      const on = world.isLampOn(dg, df);
      const key = `lamp,${dg},${df},${on}`;
      if (key === gazeKey) return;
      gazeKey = key;
      world.clearHover();
      gaze = { kind: 'lamp', cellOffset: lamp.cellOffset };
      $('gaze-title').hidden = true;
      $('gaze-where').textContent = on ? 'A night lamp, lit' : 'A night lamp, out';
      $('gaze-hint').textContent = `${isTouch ? 'Tap' : 'Press E or click'} to turn it ${on ? 'off' : 'on'}`;
      $('gaze').hidden = false;
      return;
    }
    if (term && (!book || term.t < book.t) && (!door || term.t < door.t)) {
      const key = `terminal,${player.cg + term.cellOffset},${player.cf}`;
      if (key === gazeKey) return;
      gazeKey = key;
      world.clearHover();
      gaze = { kind: 'terminal', cellOffset: term.cellOffset };
      $('gaze-title').hidden = false;
      $('gaze-title').textContent = 'The catalogue';
      $('gaze-where').textContent = 'Find a text or a book, or go to any hexagon';
      $('gaze-hint').textContent = `${isTouch ? 'Tap' : 'Press E or click'} to use it`;
      $('gaze').hidden = false;
      return;
    }
    if (door && (!book || door.t < book.t)) {
      const dg = player.cg + door.cellOffset, df = player.cf;
      const state = world.doorState(dg, df);
      const opening = !(state && state.target === 1);
      const key = `door,${dg},${df},${opening}`;
      if (key === gazeKey) return;
      gazeKey = key;
      world.clearHover();
      gaze = { kind: 'door', cellOffset: door.cellOffset };
      $('gaze-title').hidden = true;
      $('gaze-where').textContent = opening ? 'A door, shut' : 'A door, open';
      $('gaze-hint').textContent = `${isTouch ? 'Tap' : 'Press E or click'} to ${opening ? 'open' : 'close'} it`;
      $('gaze').hidden = false;
      return;
    }
    const target = book;
    const key = target ? `${player.cg + target.off},${player.cf},${target.slot}` : '';
    if (key === gazeKey) return;
    gazeKey = key;
    gaze = target ? Object.assign({ kind: 'book' }, target) : null;
    if (!target) { world.clearHover(); $('gaze').hidden = true; return; }
    const dg = player.cg + target.off, df = player.cf;
    world.setHover(dg, df, target.slot);
    const cell = world.cell(dg, df);
    if (!cell || target.slot >= cell.count) { $('gaze').hidden = true; gaze = null; return; }
    $('gaze-title').hidden = false;
    $('gaze-title').textContent = lib.spineTitle(cell.fingerprint, target.slot);
    const sought = world.isMarked(dg, df, target.slot) ? `The book you sought${world.mark.title ? ` (${world.mark.title})` : ''}: ` : '';
    $('gaze-where').textContent = `${sought}Wall ${target.wall + 1}, shelf ${target.shelf + 1}, volume ${target.volume + 1}`;
    $('gaze-hint').textContent = isTouch ? 'Tap to read' : 'Press E or click to read';
    $('gaze').hidden = false;
  }


  // A handle for testing from the browser console.
  Babel.debug = {
    get lib() { return lib; }, get world() { return world; }, get player() { return player; },
    get renderer() { return renderer; }, get mode() { return mode; }, get sleep() { return sleep; }, journey, here,
    get reading() { return reading; },
    openBook, openBookAt, startWalking, setMode, goToCell, goToAddress, fallAsleep, wakeUp, hexagonSeed,
    get lastJourney() { return lastJourney; },
    get terminal() { return terminal; },
  };
  Babel.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
