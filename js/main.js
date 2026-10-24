/*
 * Start-up and the screens around the walk: reading, pause. There is no title screen:
 * the reader wakes in the Library straight away (or before the book a link leads to).
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const $ = (id) => document.getElementById(id);
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  let raw, lib, assets, world, player, renderer, scene, camera, reflector, sinkReflector, figure, figureLight, terminal;
  let mode = 'walking';
  let wakeIndex = 0;
  let gaze = null, gazeKey = '';
  let reading = null;
  let lastCell = '';

  function showError(message) {
    $('error-message').textContent = message;
    $('error').hidden = false;
  }

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
    camera = new THREE.PerspectiveCamera(lib.config.fieldOfView, window.innerWidth / window.innerHeight, 0.05, 90);

    const textures = Babel.Textures.create();
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    for (const k of ['wood', 'plaster', 'stone', 'tiles', 'spines']) textures[k].anisotropy = aniso;
    assets = Babel.Architecture.createAssets(lib.config, textures);
    world = new Babel.World(scene, assets, lib);
    player = new Babel.Player(assets.dims, camera, renderer.domElement);
    player.sensitivity = lib.config.lookSensitivity;
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
      setMode, startWalking, openBookAt, goToCell, goToAddress, goToRandom, toast, copyText, linkBase,
    });

    wake(0);
    bindInterface();
    fitGlyphs();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitGlyphs).catch(() => {});
    window.addEventListener('resize', onResize);
    requestAnimationFrame(frame);
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

  /** Puts the reader in waking hexagon number n of the current seed. */
  function wake(n) {
    wakeIndex = n;
    const loc = lib.wakingLocation(n);
    world.setAnchor(loc.gallery, loc.floor);
    if (terminal) terminal.reset();
    player.origin = 'woke';
    player.placeAtStart();
    world.update(0, 0);
    lastCell = '';
  }

  /** Goes to hexagon (dg, df) relative to the anchor; with `face`, stands before that book. */
  function goToCell(dg, df, face) {
    if (face) player.faceBook(dg, df, face.wall, face.shelf, face.volume);
    else player.placeAtStart(dg, df);
    world.update(player.cg, player.cf);
    lastCell = '';
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
   * If the page's address is a link to a book (…/#book=…), sets the reader down before the
   * book that holds the link's text, and returns true.
   */
  async function goToLinkedBook() {
    if (!/^#book=/.test(location.hash)) return false;
    let text;
    try {
      text = await BabelCore.Library.readLink(location.hash);
    } catch (e) {
      toast(/too old/.test(e.message) ? e.message : 'This link to a book could not be read. It may have been cut short.', 6000);
      return false;
    }
    if (!text || !lib.prepareText(text).symbols.length) {
      toast('This link carries no text that the Library can hold.', 6000);
      return false;
    }
    const b = lib.bookOfText(text);
    goToAddress(b.location.gallery, b.location.floor, lib.slotParts(b.location.slot), { slot: b.location.slot, start: 0, length: 0 });
    toast(`Before you, a little out of its row, stands the book the link leads to. ${isTouch ? 'Tap it' : 'Press E'} to read it.`, 6000);
    return true;
  }

  function goToRandom() {
    const loc = lib.wakingLocation(1 + Math.floor(Math.random() * 4294967295));
    goToAddress(loc.gallery, loc.floor, null);
    toast('You arrive in a hexagon chosen at random.');
  }

  /* ---------------- text ---------------- */

  const fmt = (n) => n.toLocaleString('en');

  function controlsHTML() {
    if (isTouch) return 'Drag on the right of the screen to look. Hold and slide on the left to walk. Tap a book to read it, a door to open it, or the catalogue to use it.';
    return 'Look with the mouse. Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, and hold <kbd>Shift</kbd> to hurry. ' +
      'Press <kbd>E</kbd> to take down the book you are looking at, open a door or use the catalogue, and <kbd>Esc</kbd> to pause.';
  }


  function renderHere() {
    const g = world.gallery(player.cg).digits, f = world.floor(player.cf).digits;
    $('addr-floor').textContent = lib.addressText(f, 28);
    $('addr-gallery').textContent = lib.addressText(g, 28);
    $('addr-lengths').textContent = `The full address is ${fmt(f.length)} symbols for the floor and ${fmt(g.length)} for the gallery. ${player.whereabouts().sentence}`;
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
    mode = next;
    $('hud').hidden = next !== 'walking';
    $('reader').hidden = next !== 'reading';
    $('pause').hidden = next !== 'paused';
    $('terminal').hidden = next !== 'terminal';
    player.enabled = next === 'walking';
    if ((next === 'terminal' || next === 'reading') && document.pointerLockElement) document.exitPointerLock();
    if (next !== 'walking') { world.clearHover(); gaze = null; gazeKey = ''; $('gaze').hidden = true; }
    if (next === 'paused') renderHere();
    updateMenuButton();
  }

  function updateMenuButton() {
    const locked = document.pointerLockElement === renderer.domElement;
    $('menu-button').hidden = !(mode === 'walking' && !locked);
    $('look-hint').hidden = !(mode === 'walking' && !locked && !isTouch);
  }

  function startWalking() {
    setMode('walking');
    lockPointer();
  }

  function pause() {
    if (mode !== 'walking') return;
    setMode('paused');
    if (document.pointerLockElement) document.exitPointerLock();
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
    openBook(gaze);
  }

  /** Opens the book the reader is looking at on the shelves. */
  function openBook(target) {
    const dg = player.cg + target.off, df = player.cf;
    const mark = world.mark && world.isMarked(dg, df, target.slot) ? world.mark : null;
    openBookAt({
      location: world.location(dg, df, target.slot), slot: target.slot,
      highlight: mark && mark.length ? { start: mark.start, length: mark.length } : null, returnTo: 'walking',
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
    };
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

  /* ---------------- interface wiring ---------------- */

  function bindInterface() {
    $('controls-hint').innerHTML = controlsHTML();
    // a link to a book, pasted into the address bar while the Library is open
    window.addEventListener('hashchange', () => { goToLinkedBook(); });
    $('resume').addEventListener('click', startWalking);
    $('menu-button').addEventListener('click', pause);
    $('wake-elsewhere').addEventListener('click', () => {
      wake(wakeIndex + 1);
      toast('You wake in another hexagon.');
      startWalking();
    });
    $('copy-address').addEventListener('click', () => {
      const g = world.gallery(player.cg).digits, f = world.floor(player.cf).digits;
      const text = lib.hexagonAddressText(g, f);
      copyText(text, `Copied the address (${fmt(text.length)} characters).`);
    });

    $('prev-page').addEventListener('click', () => turn(-1));
    $('next-page').addEventListener('click', () => turn(1));
    $('random-page').addEventListener('click', () => { reading.page = Math.floor(Math.random() * lib.config.pagesPerBook); renderPage(); });
    $('copy-page').addEventListener('click', () => {
      copyText(lib.pageLines(reading.content, reading.page).join('\n'), `Copied page ${reading.page + 1}.`);
    });
    $('close-book').addEventListener('click', closeBook);
    $('show-passage').addEventListener('click', () => {
      reading.page = Math.floor(reading.highlight.start / lib.config.charactersPerPage);
      renderPage();
    });
    $('page-form').addEventListener('submit', (e) => { e.preventDefault(); reading.page = Number($('page-input').value) - 1; renderPage(); $('page').focus(); });
    $('page-input').addEventListener('change', () => { reading.page = Number($('page-input').value) - 1; renderPage(); });

    const canvas = renderer.domElement;
    canvas.addEventListener('click', () => {
      if (mode !== 'walking' || isTouch) return;
      if (document.pointerLockElement === canvas) interact();
      else lockPointer();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (!locked && mode === 'walking') pause();
      updateMenuButton();
    });

    window.addEventListener('keydown', (e) => {
      const inField = e.target && (e.target.tagName === 'INPUT');
      if (mode === 'walking') {
        if (e.code === 'KeyE') interact();
        else if (e.code === 'Escape' || e.code === 'KeyP') pause();
      } else if (mode === 'reading') {
        if (inField && e.code !== 'Escape') return;
        if (e.code === 'ArrowLeft' || e.code === 'PageUp') { turn(-1); e.preventDefault(); }
        else if (e.code === 'ArrowRight' || e.code === 'PageDown' || e.code === 'Space') { turn(1); e.preventDefault(); }
        else if (e.code === 'Home') { reading.page = 0; renderPage(); e.preventDefault(); }
        else if (e.code === 'End') { reading.page = lib.config.pagesPerBook - 1; renderPage(); e.preventDefault(); }
        else if (e.code === 'Escape' || e.code === 'KeyE') { closeBook(); e.preventDefault(); }
      } else if (mode === 'paused') {
        if (e.code === 'Escape' && !inField) startWalking();
      } else if (mode === 'terminal') {
        if (e.code === 'Escape') { e.preventDefault(); terminal.close(); }
      }
    });

    // straight into the Library: before the book a link leads to, or in the waking hexagon
    setMode('walking');
    goToLinkedBook().then((went) => {
      if (!went) {
        toast(isTouch ? 'Drag on the right to look around, hold and slide on the left to walk, and tap a book to read it.'
          : 'Walk with W A S D, press E to take down a book, and Esc for the menu.', 7000);
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

    const cellKey = player.cg + ',' + player.cf;
    if (cellKey !== lastCell) {
      lastCell = cellKey;
      $('whereabouts').textContent = player.whereabouts().short;
    }

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

    // behind the catalogue, a book or the pause menu, the Library only needs drawing now and then
    frameCount++;
    if (mode === 'walking' || frameCount % 4 === 0) renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  let frameCount = 0;

  function updateGaze() {
    const book = player.pick(lib);
    const door = player.pickDoor((off) => world.doorOpenness(player.cg + off, player.cf));
    const term = player.pickTerminal();
    const lamp = player.pickLamp((off) => world.doorOpenness(player.cg + off, player.cf));
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
    get renderer() { return renderer; }, get mode() { return mode; },
    openBook, openBookAt, startWalking, pause, setMode, goToCell, goToAddress,
    get terminal() { return terminal; },
  };
  Babel.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
