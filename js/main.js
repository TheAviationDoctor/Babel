/*
 * Start-up and the screens around the walk: title, reading, pause.
 */
(function () {
  'use strict';
  const Babel = (window.Babel = window.Babel || {});
  const $ = (id) => document.getElementById(id);
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  const settings = { sensitivity: 1, fov: 72 };
  try {
    const saved = JSON.parse(localStorage.getItem('babel.settings') || '{}');
    if (saved.sensitivity) settings.sensitivity = saved.sensitivity;
    if (saved.fov) settings.fov = saved.fov;
  } catch (e) { /* storage unavailable: defaults */ }
  function saveSettings() {
    try { localStorage.setItem('babel.settings', JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  let raw, lib, assets, world, player, renderer, scene, camera, reflector, figure;
  let mode = 'title';
  let wakeIndex = 0;
  let gaze = null, gazeKey = '';
  let reading = null;
  let lastCell = '';

  function showError(message) {
    $('error-message').textContent = message;
    $('error').hidden = false;
    $('title').hidden = true;
  }

  let toastTimer = 0;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ---------------- building ---------------- */

  function buildLibrary(seed) {
    const cfg = Object.assign({}, raw, { seed });
    return new BabelCore.Library(cfg);
  }

  function boot() {
    raw = window.BABEL_CONFIG;
    if (!raw) return showError('The configuration file config.js was not found, or it does not define window.BABEL_CONFIG.');
    try {
      lib = buildLibrary(raw.seed);
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
    camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 90);

    const textures = Babel.Textures.create();
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    for (const k of ['wood', 'plaster', 'stone', 'tiles', 'spines']) textures[k].anisotropy = aniso;
    assets = Babel.Architecture.createAssets(lib.config, textures);
    world = new Babel.World(scene, assets, lib);
    player = new Babel.Player(assets.dims, camera, renderer.domElement);
    player.sensitivity = settings.sensitivity;
    player.onTap = () => { if (mode === 'walking') interact(); };

    // The mirror in the nearest vestibule. Its camera sees layer 1, where the reader's own figure lives.
    const d = assets.dims;
    reflector = new THREE.Reflector(assets.geometries.mirror, {
      textureWidth: 512, textureHeight: 512, color: 0x8d877b, clipBias: 0.002,
    });
    reflector.camera.layers.enableAll();
    scene.add(reflector);
    figure = makeFigure();
    figure.traverse((o) => o.layers.set(1));
    scene.add(figure);
    scene.add(new THREE.HemisphereLight(0xb08a5e, 0x140e09, 1.1));
    sizeMirror();

    wake(0);
    bindInterface();
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
    player.placeAtStart();
    world.update(0, 0);
    lastCell = '';
    renderTitleText();
  }

  function changeSeed(seed) {
    seed = String(seed || '').trim() || String(raw.seed);
    if (seed === lib.seed) return false;
    lib = buildLibrary(seed);
    world.setLibrary(lib);
    wake(0);
    $('seed-input').value = seed;
    $('seed-input-2').value = seed;
    return true;
  }

  /* ---------------- text ---------------- */

  const fmt = (n) => n.toLocaleString('en');

  function factsHTML() {
    const c = lib.config, s = lib.stats;
    return `${fmt(lib.M)} characters to a book (${fmt(c.pagesPerBook)} pages of ${fmt(c.linesPerPage)} lines of ${fmt(c.charactersPerLine)}), in an alphabet of ${fmt(lib.N)} symbols, ${fmt(lib.S)} books to a hexagon. ` +
      `About 10<sup>${fmt(Math.floor(s.log10Books))}</sup> books in all, in about 10<sup>${fmt(Math.floor(s.log10Hexagons))}</sup> hexagons.`;
  }

  function controlsHTML() {
    if (isTouch) return 'Drag on the right of the screen to look. Hold and slide on the left to walk. Tap a book to read it.';
    return 'Look with the mouse. Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, and hold <kbd>Shift</kbd> to hurry. ' +
      'Press <kbd>E</kbd> to take down the book you are looking at, and <kbd>Esc</kbd> to pause.';
  }

  function addressHead(digits, count) {
    const a = lib.alphabet, n = digits.length;
    let s = '';
    for (let i = n - 1; i >= Math.max(0, n - count); i--) s += a[digits[i]];
    return s;
  }

  function renderTitleText() {
    const f = world.floor(0).digits;
    const field = $('address-field');
    const cols = Math.ceil(window.innerWidth / 6.4), rows = Math.ceil(window.innerHeight / 14) + 2;
    field.textContent = addressHead(f, Math.min(f.length, cols * rows));
    $('address-caption').textContent = `Behind these words, the number of the floor you will wake on, in the Library's own alphabet. It runs to ${fmt(f.length)} symbols; this is its beginning.`;
    $('facts').innerHTML = factsHTML();
    $('controls-hint').innerHTML = controlsHTML();
    $('controls-hint-2').innerHTML = controlsHTML();
    document.querySelector('[data-fact="pages"]').textContent = fmt(lib.config.pagesPerBook);
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
    $('title').hidden = next !== 'title';
    $('hud').hidden = next !== 'walking';
    $('reader').hidden = next !== 'reading';
    $('pause').hidden = next !== 'paused';
    player.enabled = next === 'walking';
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
    if (gaze) openBook(gaze);
  }

  function openBook(target) {
    const dg = player.cg + target.off, df = player.cf;
    const loc = world.location(dg, df, target.slot);
    const content = lib.bookAt(loc);
    if (!content) { toast('This shelf is empty. The Library ends here.'); return; }
    const fp = world.fingerprint(dg, df);
    reading = {
      content, page: 0, target,
      title: lib.spineTitle(fp, target.slot),
    };
    $('book-title').textContent = reading.title;
    $('book-where').textContent = `Wall ${target.wall + 1}, shelf ${target.shelf + 1}, volume ${target.volume + 1}`;
    $('page-count').textContent = `of ${fmt(lib.config.pagesPerBook)}`;
    $('page-input').max = lib.config.pagesPerBook;
    setMode('reading');
    if (document.pointerLockElement) document.exitPointerLock();
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
    pre.textContent = lib.pageLines(reading.content, reading.page).join('\n');
    const folio = document.createElement('span');
    folio.className = 'folio';
    folio.textContent = String(reading.page + 1);
    pre.appendChild(folio);
    $('page-input').value = reading.page + 1;
    $('prev-page').disabled = reading.page === 0;
    $('next-page').disabled = reading.page === P - 1;
  }

  function turn(delta) { reading.page += delta; renderPage(); }

  function closeBook() {
    reading = null;
    startWalking();
  }

  /* ---------------- interface wiring ---------------- */

  function bindInterface() {
    $('seed-input').value = lib.seed;
    $('seed-input-2').value = lib.seed;

    $('seed-form').addEventListener('submit', (e) => {
      e.preventDefault();
      changeSeed($('seed-input').value);
      startWalking();
    });
    $('seed-form-2').addEventListener('submit', (e) => {
      e.preventDefault();
      const changed = changeSeed($('seed-input-2').value);
      toast(changed ? `A different Library: seed "${lib.seed}". You wake in a new hexagon.` : 'That is already the seed of this Library.');
      renderHere();
    });
    $('resume').addEventListener('click', startWalking);
    $('menu-button').addEventListener('click', pause);
    $('wake-elsewhere').addEventListener('click', () => {
      wake(wakeIndex + 1);
      toast('You wake in another hexagon.');
      startWalking();
    });
    $('copy-address').addEventListener('click', () => {
      const g = world.gallery(player.cg).digits, f = world.floor(player.cf).digits;
      const text = `Seed: ${lib.seed}\nFloor:\n${lib.addressText(f)}\nGallery:\n${lib.addressText(g)}\n`;
      copyText(text, `Copied the address (${fmt(text.length)} characters).`);
    });

    const sens = $('sensitivity'), fov = $('fov');
    sens.value = settings.sensitivity; fov.value = settings.fov;
    const showSettings = () => {
      $('sensitivity-out').textContent = Number(sens.value).toFixed(1);
      $('fov-out').textContent = `${fov.value}°`;
    };
    showSettings();
    sens.addEventListener('input', () => { settings.sensitivity = player.sensitivity = Number(sens.value); showSettings(); saveSettings(); });
    fov.addEventListener('input', () => { settings.fov = camera.fov = Number(fov.value); camera.updateProjectionMatrix(); showSettings(); saveSettings(); });

    $('prev-page').addEventListener('click', () => turn(-1));
    $('next-page').addEventListener('click', () => turn(1));
    $('random-page').addEventListener('click', () => { reading.page = Math.floor(Math.random() * lib.config.pagesPerBook); renderPage(); });
    $('copy-page').addEventListener('click', () => {
      copyText(lib.pageLines(reading.content, reading.page).join('\n'), `Copied page ${reading.page + 1}.`);
    });
    $('close-book').addEventListener('click', closeBook);
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
      }
    });

    setMode('title');
    $('seed-input').focus({ preventScroll: true });
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

  let last = performance.now();
  function frame(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    last = now;
    adaptQuality(rawDt);
    if (mode === 'title') player.yaw += dt * 0.035;
    player.update(dt);
    world.update(player.cg, player.cf);

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
    figure.position.set(player.x, player.y, player.z);
    figure.rotation.y = player.yaw;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function updateGaze() {
    const target = player.pick(lib);
    const key = target ? `${player.cg + target.off},${player.cf},${target.slot}` : '';
    if (key === gazeKey) return;
    gazeKey = key;
    gaze = target;
    if (!target) { world.clearHover(); $('gaze').hidden = true; return; }
    const dg = player.cg + target.off, df = player.cf;
    world.setHover(dg, df, target.slot);
    const cell = world.cell(dg, df);
    if (!cell || target.slot >= cell.count) { $('gaze').hidden = true; gaze = null; return; }
    $('gaze-title').textContent = lib.spineTitle(cell.fingerprint, target.slot);
    $('gaze-where').textContent = `Wall ${target.wall + 1}, shelf ${target.shelf + 1}, volume ${target.volume + 1}`;
    $('gaze-hint').textContent = isTouch ? 'Tap to read' : 'Press E or click to read';
    $('gaze').hidden = false;
  }

  // A handle for testing from the browser console.
  Babel.debug = {
    get lib() { return lib; }, get world() { return world; }, get player() { return player; },
    get renderer() { return renderer; }, get mode() { return mode; },
    openBook, startWalking, pause, setMode,
  };
  Babel.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
