// Tests of the Library in a browser: it starts, walks, climbs, jumps and falls, reads, finds
// and dreams, as a reader would, in headless Chromium. Run with:
//
//   npm install                         (once: Playwright, which drives the browser)
//   npx playwright install chromium     (once: the browser itself)
//   npm test                            (these tests and those of the mathematics)
//
// or `node tests/browser.test.js` for these alone (`node tests/browser.test.js stair` for those
// whose names hold "stair"). The page is opened from its file, as by a
// double click. It is drawn by SwiftShader, the browser's own software renderer, so that it
// draws alike on every machine, GitHub's included; frames are slow there, so the tests move
// the reader themselves, a step at a time, rather than waiting for frames, and wait for real
// time only where the Library itself does (a dream, a link followed).
//
// Each test is a function run in the page, which returns what it saw; the checks are made
// here. Babel.debug (js/main.js) is what they reach the Library by.
'use strict';
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.log('These tests need Playwright: run npm install, then npx playwright install chromium.');
  process.exit(1);
}

const PAGE = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
let failures = 0;
const tests = [];
/** A test: `name`, and fn(page), which runs something in the page and checks what it returns. */
function test(name, fn) { tests.push({ name, fn }); }

// What every test starts from, in the page: the reader in the hexagon they woke in (or arrived
// at), on its floor, with nothing pressed; the Library still, as behind the Catalogue, so that
// frames drawn meanwhile do not move the reader; and a way to move them a step at a time.
const HELPERS = () => {
  const D = Babel.debug, P = D.player, W = D.world;
  window.T = {
    D, P, W, d: P.d,
    /** Puts the reader at site s of floor df (from the hexagon of the anchor), still. */
    quiet(s = 0, df = 0, face) {
      D.goToCell(s, df, face);
      D.setMode('terminal');
      document.getElementById('terminal').hidden = true;
      P.keys.clear();
      P.enabled = false;
    },
    /** Moves the reader on n steps of dt seconds, with these keys held. */
    step(n, dt = 1 / 60, keys = []) {
      P.keys.clear();
      for (const k of keys) P.keys.add(k);
      for (let i = 0; i < n; i++) {
        P.enabled = true; P.update(dt); P.enabled = false;
        W.update(P.site, P.cf, P.ch);
      }
      P.keys.clear();
    },
    /** Faces the reader towards the middle of their site (or away from it). */
    faceMiddle(away) { P.yaw = Math.atan2(away ? -P.x : P.x, away ? -P.z : P.z); P.pitch = 0; },
    /** The reader's height above floor 0 of the anchor. */
    height() { return P.cf * P.d.Hf + P.y; },
    frames: async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
};

/* ---------------- starting ---------------- */

test('starts, and draws the hexagon it wakes in', async (page) => {
  const r = await page.evaluate(async () => {
    await T.frames(2);
    return { started: Babel.started, cells: T.W.cells.size, hubs: T.W.hubs.size, calls: T.D.renderer.info.render.calls, mode: T.D.mode };
  });
  assert(r.started, 'Babel.started is not set');
  assert(r.cells >= 10 && r.hubs >= 1, `too little drawn: ${r.cells} hexagons, ${r.hubs} stair hexagons`);
  assert(r.calls > 0, 'nothing was drawn');
});

/* ---------------- walking ---------------- */

test('walks through sixty doorways, without getting stuck, and nothing jumps on entering a site', async (page) => {
  const r = await page.evaluate(() => {
    const { P, W, d } = T, H = Babel.Honeycomb;
    T.quiet();
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const planOf = () => { const [q, rr] = H.at(P.site), [x, z] = H.plan(q, rr); return [x * d.Dx + P.x, z * d.Dx + P.z]; };
    let last = planOf(), came = -1, stuck = null, legs = 0, maxJump = 0;
    const ring = (d.shaftA + d.aIn) / 2;
    for (let leg = 0; leg < 60 && !stuck; leg++) {
      const doors = P.around().doors;
      let pick; do { pick = Math.floor(rnd() * doors.length); } while (doors.length > 1 && P.site + doors[pick].step === came && rnd() < 0.8);
      const n = doors[pick], at = Math.atan2(n.z, n.x), from = P.site;
      for (let i = 0; i < 900 && P.site === from; i++) {
        const th = Math.atan2(P.z, P.x), rr = Math.hypot(P.x, P.z);
        const diff = Math.atan2(Math.sin(at - th), Math.cos(at - th));
        const u = P.x * Math.cos(at) + P.z * Math.sin(at), v = -P.x * Math.sin(at) + P.z * Math.cos(at);
        let a;
        if (Math.abs(diff) < 0.1 || (u > ring - 0.3 && Math.abs(v) < 0.5)) a = at + Math.atan2(-v * 1.5, 1); // out through the door, keeping to its middle
        else if (rr > d.aIn - 0.1 && u < 0) a = Math.atan2(-P.z, -P.x); // still in the doorway come by: to the ring
        else { const dir = diff > 0 ? 1 : -1; a = th + dir * Math.PI / 2 + dir * (rr - ring) * 1.2; } // round the shaft
        P.yaw = -Math.PI / 2 - a;
        T.step(1, 0.04, ['KeyW', 'ShiftLeft']);
        const now = planOf(); maxJump = Math.max(maxJump, Math.hypot(now[0] - last[0], now[1] - last[1])); last = now;
      }
      if (P.site === from) stuck = { leg, kind: P.kind, to: n.kind };
      came = from; legs++;
    }
    return { stuck, legs, maxJump, air: !!P.air, cf: P.cf };
  });
  assert.strictEqual(r.stuck, null, `stuck: ${JSON.stringify(r.stuck)}`);
  assert.strictEqual(r.legs, 60);
  assert(r.maxJump < 0.2, `the reader jumped ${r.maxJump} m on entering a site`);
  assert(!r.air && r.cf === 0, 'the reader left the floor while walking');
});

test('picks every book faced, the Catalogue, the cell door, the bed, and stands before the painting', async (page) => {
  const r = await page.evaluate(() => {
    const { D, P, W, d } = T, lib = D.lib, bad = [], miss = [];
    const hub = W.neighbours(0)[0], petals = W.neighbours(hub);
    for (const s of petals) for (let w = 0; w < d.walls; w++) for (const [sh, v] of [[0, 0], [2, 17], [3, 31]]) {
      T.quiet(s, 0, { wall: w, shelf: sh, volume: v }); P.camera.updateMatrixWorld();
      const g = P.pick(lib);
      if (!(g && g.site === s && g.wall === w && g.shelf === sh && g.volume === v)) bad.push([W.kind(s), w, sh, v]);
    }
    const yawOf = (phi) => -Math.PI / 2 - phi;
    for (const s of petals) {
      T.quiet(s, 0);
      const t = P.roomTurn(), c = Math.cos(t), sn = Math.sin(t);
      const stand = (hx, hz, phi, pitch) => { P._arrive(s, 0); P.x = hx * c - hz * sn; P.z = hx * sn + hz * c; P.y = 0; P.yaw = yawOf(t + phi); P.pitch = pitch || 0; P._rebase(); P._applyCamera(0, 0); P.camera.updateMatrixWorld(); };
      stand(d.nicheX, 0, Math.PI / 2, -0.15); const term = P.pickTerminal();
      stand(d.closetX, 0.1, -Math.PI / 2, -0.3); const door = P.pickDoor(() => 0);
      if (!(term && term.site === s)) miss.push(['Catalogue', W.kind(s)]);
      if (!(door && door.site === s)) miss.push(['door', W.kind(s)]);
      W.toggleDoor(s, 0); W.tick(2); W.tick(2);
      stand(d.closetX, -d.hallW / 2 - 0.6, -Math.PI / 2 - 0.3, -0.7); const bed = P.pickBed((x) => W.doorOpenness(x, 0));
      if (P.ground(P.x, P.z, 0) !== 0) miss.push(['cell floor', W.kind(s)]);
      if (!(bed && bed.site === s)) miss.push(['bed', W.kind(s)]);
      W.toggleDoor(s, 0); W.tick(2);
      P.facePainting(s, 0); if (P.ground(P.x, P.z, 0) !== 0) miss.push(['before the painting', W.kind(s)]);
    }
    return { bad, miss, kinds: petals.map((s) => W.kind(s)).sort().join('') };
  });
  assert.strictEqual(r.kinds, '012345', 'not every kind of hexagon was tried');
  assert.deepStrictEqual(r.bad, [], `books not picked: ${JSON.stringify(r.bad)}`);
  assert.deepStrictEqual(r.miss, [], `not picked: ${JSON.stringify(r.miss)}`);
});

test('climbs the stair a dozen floors, and back down past where it started', async (page) => {
  const r = await page.evaluate(() => {
    const { P, W, d } = T, L = d.landingTheta;
    T.quiet();
    const hub = W.neighbours(0)[0];
    P._arrive(hub, 0); P.x = (d.shaftA + 0.6) * Math.cos(L); P.z = (d.shaftA + 0.6) * Math.sin(L); P.y = 0;
    const run = (dir, n) => {
      const floors = new Set(); let stuck = 0, air = 0;
      for (let i = 0; i < n; i++) {
        const rr = Math.hypot(P.x, P.z), th = Math.atan2(P.z, P.x);
        const a = rr > 0.95 && P.y === 0 && i < 40 ? L + Math.PI : th + dir * (Math.PI / 2 + (rr - 0.72) * 1.5); // onto the landing, then round the column
        P.yaw = -Math.PI / 2 - a;
        const x0 = P.x, z0 = P.z;
        T.step(1, 0.05, ['KeyW']);
        if (Math.hypot(P.x - x0, P.z - z0) < 0.005) stuck++;
        if (P.air) air++;
        floors.add(P.cf);
      }
      return { floors: [...floors].sort((a, b) => a - b), stuck, air };
    };
    return { up: run(1, 700), down: run(-1, 1400) };
  });
  assert(r.up.floors.length >= 10 && r.up.floors[0] === 0, `climbed only floors ${r.up.floors}`);
  assert(r.down.floors[0] < 0, `came down only to floor ${r.down.floors[0]}`);
  assert.strictEqual(r.up.stuck + r.down.stuck, 0, 'stuck on the stair');
  assert.strictEqual(r.up.air + r.down.air, 0, 'fell off the stair, keeping to its middle');
});

test('stops at the railing round a shaft, and walks in across the landing', async (page) => {
  const r = await page.evaluate(() => {
    const { P, W, d } = T, L = d.landingTheta, out = {};
    T.quiet();
    const hub = W.neighbours(0)[0];
    const walk = (x, z, a, n) => { P._arrive(hub, 0); P.x = x; P.z = z; P.y = 0; P.yaw = -Math.PI / 2 - a; T.step(n, 0.05, ['KeyW']); return { r: Math.hypot(P.x, P.z), y: P.y, cf: P.cf }; };
    for (const k of [1, 2, 3, 4]) { const a = (k * Math.PI) / 3; out['side' + k] = walk((d.shaftA + 0.8) * Math.cos(a), (d.shaftA + 0.8) * Math.sin(a), a + Math.PI, 60); }
    out.landing = walk((d.shaftA + 0.8) * Math.cos(L), (d.shaftA + 0.8) * Math.sin(L), L + Math.PI, 60);
    // and round a hexagon of books' shaft
    T.quiet(); T.faceMiddle(); T.step(120, 1 / 60, ['KeyW']); out.books = { r: Math.hypot(P.x, P.z), y: P.y, cf: P.cf };
    out.edge = d.shaftA + 0.07 + P.radius;
    return out;
  });
  for (const k of [1, 2, 3, 4]) {
    const s = r['side' + k];
    assert(Math.abs(s.r - r.edge) < 0.06 && s.y === 0 && s.cf === 0, `the stair hexagon's side ${k}: stopped at ${s.r.toFixed(2)} m, not at the railing`);
  }
  assert(r.landing.r < 0.5, `did not walk in across the landing (stopped at ${r.landing.r.toFixed(2)} m)`);
  assert(r.books.y === 0 && r.books.cf === 0 && r.books.r > 1.6, 'walked into the shaft of a hexagon of books');
});

/* ---------------- jumping and falling ---------------- */

test('jumps over half a metre, and lands where it left; a low ceiling stops the head', async (page) => {
  const r = await page.evaluate(() => {
    const { P, W, d } = T, out = {};
    const jump = (secs) => { P._jumpAt = performance.now(); let top = -1; for (let i = 0; i < secs * 60; i++) { T.step(1); top = Math.max(top, T.height()); } return { top, y: P.y, cf: P.cf, air: !!P.air }; };
    T.quiet(); P.placeAtStart(0, 0); out.open = jump(1.2);
    // in the cell, its ceiling 2.15 m up
    W.toggleDoor(0, 0); W.tick(2); W.tick(2);
    const t = P.roomTurn(), c = Math.cos(t), s = Math.sin(t), x = d.closetX, z = (d.cellZ0 + d.cellZ1) / 2 + 0.3;
    P._arrive(0, 0); P.x = x * c - z * s; P.z = x * s + z * c; P.y = 0;
    out.cell = jump(1.2); out.cellRoom = d.cellH - P.bodyHeight();
    W.toggleDoor(0, 0); W.tick(2);
    return out;
  });
  assert(r.open.top > 0.55 && r.open.top < 0.7, `jumped ${r.open.top.toFixed(2)} m`);
  assert(!r.open.air && r.open.y === 0 && r.open.cf === 0, 'did not land where it left');
  assert(r.cell.top <= r.cellRoom + 1e-6 && r.cell.top > r.cellRoom - 0.05, `in the cell, jumped ${r.cell.top.toFixed(2)} m under ${r.cellRoom.toFixed(2)} m of room`);
  assert(!r.cell.air && r.cell.y === 0, 'did not land in the cell');
});

test('a running jump over the railing reaches the far side of the shaft, a floor down', async (page) => {
  const r = await page.evaluate(() => {
    const { P } = T;
    T.quiet(); P.placeAtStart(0, 0); T.faceMiddle();
    const x0 = P.x, z0 = P.z;
    P._jumpAt = performance.now();
    T.step(1, 1 / 60, ['KeyW', 'ShiftLeft']);
    for (let i = 0; i < 300 && P.air; i++) T.step(1, 1 / 60, ['KeyW', 'ShiftLeft']); // until it lands
    return { cf: P.cf, y: P.y, air: !!P.air, site: P.site, across: P.x * x0 + P.z * z0 < 0 };
  });
  assert(!r.air && r.y === 0, 'did not land');
  assert.strictEqual(r.cf, -1, `landed on floor ${r.cf}`);
  assert(r.site === 0 && r.across, 'landed on the near side of the shaft');
});

test('falls on down a shaft, in silence, until steered to its edge, and lands there', async (page) => {
  const r = await page.evaluate(() => {
    const { P } = T, out = {};
    T.quiet(); P.placeAtStart(0, 0); P.x = 0; P.z = 0; P.y = 0.3; P._takeOff(0, 0, 0); P.yaw = 0;
    T.step(180);
    out.falling = { air: !!P.air, vy: P.air && P.air.vy, cf: P.cf };
    T.step(240, 1 / 60, ['KeyW']);
    out.landed = { air: !!P.air, y: P.y, cf: P.cf, landing: !!P.landing, walkable: P._walkable(P.x, P.z, P.y) };
    T.step(60); // getting up again
    out.after = { landing: !!P.landing };
    return out;
  });
  assert(r.falling.air && r.falling.vy === -15 && r.falling.cf < -5, `not falling freely: ${JSON.stringify(r.falling)}`);
  assert(!r.landed.air && r.landed.y === 0 && r.landed.walkable === 0, `did not land on a floor: ${JSON.stringify(r.landed)}`);
  assert(r.landed.cf < r.falling.cf, 'landed above where it was falling');
  assert(!r.after.landing, 'never got up from the landing');
});

test('walks off the stair where it is above the railing and under the floor above, and not elsewhere', async (page) => {
  const r = await page.evaluate(() => {
    const { P, W } = T, out = [];
    T.quiet();
    const hub = W.neighbours(0).find((s) => W.isHub(s));
    for (const th of [0.5, 1.4, 2.4, 3.3]) {
      P._arrive(hub, 0); P.x = 0.9 * Math.cos(th); P.z = 0.9 * Math.sin(th); P.y = P._stair(P.x, P.z, 1); P.yaw = Math.atan2(-P.x, -P.z);
      const y0 = T.height();
      T.step(150, 1 / 60, ['KeyW']);
      out.push({ th, y0, y: T.height(), air: !!P.air, r: Math.hypot(P.x, P.z) });
    }
    return out;
  });
  const [low, mid, high, higher] = r;
  assert(!low.air && low.y === 0 && low.r > 1.8, `from ${low.y0.toFixed(2)} m, not stepped off onto the floor`);
  assert(!mid.air && mid.y === 0 && mid.r > 1.8, `from ${mid.y0.toFixed(2)} m, not dropped to the floor`);
  for (const k of [high, higher]) assert(!k.air && k.y > 1.5, `from ${k.y0.toFixed(2)} m, walked off under the floor above`);
});

test('on a touch screen, a double tap where nothing is looked at jumps; a tap on a book opens it', async (page) => {
  const r = await page.evaluate(() => {
    const { D, P } = T, cv = D.renderer.domElement, out = {}, right = innerWidth - 100;
    const ev = (type, id, x, y) => { const t = new Touch({ identifier: id, target: cv, clientX: x, clientY: y }); cv.dispatchEvent(new TouchEvent(type, { changedTouches: [t], touches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true })); };
    const tap = (id, x, y) => { ev('touchstart', id, x, y); ev('touchend', id, x, y); };
    // at the railing, the left thumb walking towards the shaft: a double tap on the right
    T.quiet(); P.placeAtStart(0, 0); T.faceMiddle(); D.setMode('walking'); P.enabled = true; P._emptyTap = null;
    ev('touchstart', 1, 60, 300); ev('touchmove', 1, 60, 230);
    tap(2, right, 200); tap(3, right + 4, 204);
    P.update(1 / 60);
    out.jumped = !!P.air; out.speed = P.air ? Math.hypot(P.air.vx, P.air.vz) : 0;
    ev('touchend', 1, 60, 230);
    // one tap alone does nothing
    T.quiet(); P.placeAtStart(0, 0); D.setMode('walking'); P.enabled = true; P._emptyTap = null;
    tap(4, right, 200); P.update(1 / 60); out.single = !!P.air;
    // a tap on a book opens it at once, and a second does not jump
    T.quiet(0, 0, { wall: 1, shelf: 2, volume: 5 }); D.setMode('walking'); P.enabled = true; P.camera.updateMatrixWorld();
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      P._applyCamera(0, 0); P.camera.updateMatrixWorld();
      tap(5, right, 200); out.mode = D.mode; tap(6, right, 200); out.secondJumped = !!P.air;
      D.startWalking(); done(out);
    })));
  });
  assert(r.jumped, 'a double tap did not jump');
  assert(r.speed > 1, 'the jump did not keep the pace walked');
  assert(!r.single, 'a single tap jumped');
  assert.strictEqual(r.mode, 'reading', 'a tap on a book did not open it');
  assert(!r.secondJumped, 'a second tap on a book jumped');
});

test('makes footsteps as it walks (on stone, and on the stair\'s wood, echoing in vestibules), a jump, a landing, and the wind of a fall', async (page) => {
  const r = await page.evaluate(async () => {
    const { P, W } = T, heard = [];
    const was = [P.onStep, P.onJump, P.onLand];
    P.onStep = (surface, loud) => heard.push(['step', surface, loud]);
    P.onJump = (surface) => heard.push(['jump', surface]);
    P.onLand = (surface, speed) => heard.push(['land', surface, speed]);
    const out = {};
    // two seconds walked round the shaft, then hurried, then crouched
    const ring = (T.d.shaftA + T.d.aIn) / 2;
    const walk = (keys, secs) => {
      heard.length = 0;
      for (let i = 0; i < secs * 60; i++) { const th = Math.atan2(P.z, P.x), rr = Math.hypot(P.x, P.z); P.yaw = -Math.PI / 2 - (th + Math.PI / 2 + (rr - ring) * 1.2); T.step(1, 1 / 60, keys); }
      return heard.filter((h) => h[0] === 'step');
    };
    T.quiet(); P.placeAtStart(0, 0);
    const steps = walk(['KeyW'], 2);
    out.walked = { n: steps.length, surface: steps[0] && steps[0][1], loud: steps[0] && steps[0][2] };
    T.quiet(); P.placeAtStart(0, 0);
    out.hurried = walk(['KeyW', 'ShiftLeft'], 2).length;
    T.quiet(); P.placeAtStart(0, 0); P.crouching = true; P.crouch = 1;
    const crouched = walk(['KeyW'], 2); out.crouched = { n: crouched.length, loud: crouched[0] && crouched[0][2] };
    P.crouching = false; P.crouch = 0;
    // on the stair
    const hub = W.neighbours(0).find((s) => W.isHub(s));
    P._arrive(hub, 0); P.x = 0.72 * Math.cos(1.4); P.z = 0.72 * Math.sin(1.4); P.y = P._stair(P.x, P.z, 1);
    heard.length = 0;
    for (let i = 0; i < 60; i++) { const th = Math.atan2(P.z, P.x); P.yaw = -Math.PI / 2 - (th + Math.PI / 2); T.step(1, 1 / 60, ['KeyW']); }
    out.stair = heard.filter((h) => h[0] === 'step').map((h) => h[1]);
    // a jump, and its landing
    T.quiet(); P.placeAtStart(0, 0); heard.length = 0; P._jumpAt = performance.now(); T.step(60);
    out.jump = heard.map((h) => h[0]).join(','); out.landSpeed = (heard.find((h) => h[0] === 'land') || [])[2];
    [P.onStep, P.onJump, P.onLand] = was;
    // where each sound is made, for its echo
    const d = T.d, rooms = {};
    T.quiet(); P.placeAtStart(0, 0); rooms.hexagon = P.room();
    const tt = P.roomTurn(), c = Math.cos(tt), sn = Math.sin(tt), at = (hx, hz) => { P._arrive(0, 0); P.x = hx * c - hz * sn; P.z = hx * sn + hz * c; return P.room(); };
    rooms.vestibule = at(d.hallMid - 1, 0); rooms.cell = at(d.closetX, (d.cellZ0 + d.cellZ1) / 2);
    const px = Math.cos(d.passageTurn), pz = Math.sin(d.passageTurn); rooms.passage = at(d.hallMid * px - 1 * px, d.hallMid * pz - 1 * pz);
    P._arrive(hub, 0); P.x = 2.2; P.z = 0; rooms.stair = P.room();
    out.rooms = rooms;
    // and the sounds themselves, made offline: every one makes sound, none goes wrong, and the wind rises with speed
    const render = async (fn) => {
      const ctx = new OfflineAudioContext(1, 44100 * 2, 44100), s = new Babel.Sounds({ context: ctx, volume: 0.5 });
      Object.defineProperty(s, 'ready', { get: () => true });
      ctx.suspend(0.3).then(() => { fn(s); ctx.resume(); });
      const d = (await ctx.startRendering()).getChannelData(0);
      let peak = 0, bad = false, tail = 0, energy = 0; for (const v of d) { if (!Number.isFinite(v)) bad = true; peak = Math.max(peak, Math.abs(v)); energy += v * v; }
      for (let i = Math.round(44100 * 0.6); i < 44100; i++) tail += d[i] * d[i]; // a quarter of a second after the step
      return { peak, bad, tail, energy };
    };
    out.rendered = {
      stone: await render((s) => s.step('stone', 0.9, 'hexagon')), hall: await render((s) => s.step('stone', 0.9, 'hall')), wood: await render((s) => s.step('wood', 0.9, 'stair')),
      jump: await render((s) => s.jump('stone')), soft: await render((s) => s.land('stone', 3.4)), hard: await render((s) => s.land('stone', 15)),
      calm: await render((s) => s.wind(2)), breeze: await render((s) => s.wind(8)), gale: await render((s) => s.wind(15)),
    };
    return out;
  });
  assert(r.walked.n >= 3 && r.walked.n <= 5 && r.walked.surface === 'stone', `walking 2 s (some 3 m), ${r.walked.n} footsteps on ${r.walked.surface}`);
  assert(r.hurried > r.walked.n, 'hurrying, no more footsteps than walking');
  assert(r.crouched.n < r.walked.n && r.crouched.loud < r.walked.loud, 'crouched, footsteps no fewer or softer');
  assert(r.stair.length >= 2 && r.stair.every((s) => s === 'wood'), `on the stair, footsteps on ${r.stair}`);
  assert(/^jump.*land$/.test(r.jump) && r.landSpeed > 3, `jumping, heard ${r.jump}`);
  for (const [k, v] of Object.entries(r.rendered)) assert(!v.bad && v.peak < 1, `${k}: ${JSON.stringify(v)}`);
  for (const k of ['stone', 'wood', 'jump', 'soft', 'hard', 'breeze', 'gale']) assert(r.rendered[k].peak > 0.01, `${k} made no sound`);
  assert(r.rendered.calm.peak === 0, 'a slow fall made wind');
  assert.deepStrictEqual(r.rooms, { hexagon: 'hexagon', vestibule: 'hall', cell: 'cell', passage: 'hall', stair: 'stair' });
  assert(r.rendered.hall.tail > 8 * r.rendered.stone.tail, 'a step in a vestibule echoes no more than in a hexagon of books');
  assert(r.rendered.hard.energy > 1.5 * r.rendered.soft.energy && r.rendered.gale.energy > 2 * r.rendered.breeze.energy, 'harder landings or faster falls are not louder');
});

/* ---------------- reading and finding ---------------- */

test('reads a book: its pages turn, and words are found in it', async (page) => {
  const r = await page.evaluate(async () => {
    const { D } = T, $ = (id) => document.getElementById(id);
    T.quiet(0, 0, { wall: 0, shelf: 1, volume: 3 }); D.setMode('walking');
    D.openBookAt({ location: T.W.location(0, 0, D.lib.slotOf(0, 1, 3)), slot: D.lib.slotOf(0, 1, 3), returnTo: 'walking' });
    const out = { mode: D.mode, first: $('page-input').value };
    $('next-page').click(); out.next = $('page-input').value;
    $('prev-page').click(); out.back = $('page-input').value;
    const text = [...document.querySelectorAll('#leaf-right pre')].map((p) => p.textContent).join('');
    out.chars = text.length;
    if (!D.reading.words) { $('find-words').click(); }
    for (let i = 0; i < 200 && !D.reading.words; i++) await T.sleep(50);
    out.words = D.reading.words ? D.reading.words.length : -1;
    out.line = $('book-keys').textContent;
    D.startWalking();
    return out;
  });
  assert.strictEqual(r.mode, 'reading');
  assert(+r.next > +r.first && r.back === r.first, `pages turned ${r.first} → ${r.next} → ${r.back}`);
  assert(r.chars > 1000, 'the page is nearly empty');
  assert(r.words >= 0, 'the dictionary did not load');
});

test('finds a text in the Catalogue, goes to it, and the book there begins with it', async (page) => {
  const r = await page.evaluate(() => {
    const { D, W } = T, lib = D.lib, $ = (id) => document.getElementById(id);
    const text = 'Like all men of the Library, I have traveled in my youth.';
    T.quiet(); D.terminal.open();
    $('find-text').value = text; $('find-text').dispatchEvent(new Event('input'));
    D.terminal.find();
    D.terminal._goCertain();
    const m = W.mark;
    const content = lib.bookAt(W.location(m.dh, m.df, m.slot));
    return { mode: D.mode, marked: !!m, begins: lib.toText(content, 0, text.length), picked: (() => { const g = D.player.pick(lib); return g && g.slot === m.slot && g.site === m.dh; })() };
  });
  assert(r.marked, 'no book was marked');
  assert.strictEqual(r.begins, 'Like all men of the Library, I have traveled in my youth.');
  assert(r.picked, 'the reader was not set down before the book');
});

test('jumps through the Catalogue, and says how far it went', async (page) => {
  const r = await page.evaluate(() => {
    const { D } = T, lib = D.lib, $ = (id) => document.getElementById(id);
    T.quiet(); D.terminal.open();
    const before = D.here();
    $('go-east').value = '3'; $('go-south').value = '-2'; $('go-up').value = '5'; D.terminal._goOffset();
    const after = D.here(), s = lib.hexagonSteps(before.hexagon, after.hexagon), df = lib.floorDifference(before.floor, after.floor);
    const ex = (x) => x.sign * lib.magnitude(x.digits).exact;
    D.terminal.open();
    return { cols: ex(s.columns), rows: ex(s.rows), floors: ex(df), said: $('here-journey').textContent };
  });
  assert.deepStrictEqual([r.cols, r.rows, r.floors], [3, -2, 5]);
  assert(/3 clusters east, 2 rows north and 5 floors up/.test(r.said), `said: ${r.said}`);
});

test('takes a book of the collection down once, however many ask for it at once', async (page) => {
  const r = await page.evaluate(async () => {
    const C = Babel.Collection, G = Babel.Gallery, out = {};
    let added = 0;
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.src && n.src.includes('compressed/')) added++; }).observe(document, { childList: true, subtree: true });
    const books = await C.load(), paintings = await G.load();
    out.books = books.length; out.paintings = paintings.length;
    if (books.length) { const [a, b] = await Promise.all([C.text(books[0]), C.text(books[0])]); out.same = a === b && a.length > 0; }
    await 0; out.bookLoads = added; added = 0;
    if (paintings.length) { const lib = T.D.lib; const [a, b] = await Promise.all([G.pixels(paintings[0], lib), G.pixels(paintings[0], lib)]); out.samePixels = a.length === b.length; }
    await 0; out.paintingLoads = added;
    return out;
  });
  if (r.books) { assert(r.same, 'two asking for one book got different texts'); assert.strictEqual(r.bookLoads, 1); }
  if (r.paintings) { assert(r.samePixels); assert.strictEqual(r.paintingLoads, 1); }
});

test('follows a link to a painting of the collection, and its plate names it', async (page) => {
  const r = await page.evaluate(async () => {
    const list = await Babel.Gallery.load();
    if (!list.length) return { none: true };
    const p = list[0];
    location.hash = '#painting=' + p.id; window.dispatchEvent(new HashChangeEvent('hashchange'));
    const W = T.W;
    for (let i = 0; i < 400; i++) {
      await T.sleep(50);
      const names = W._faces ? [...W._faces.values()].map((f) => f.title) : [];
      if (names.includes(p.title)) return { title: p.title, named: true };
    }
    return { title: p.title, named: false };
  });
  if (!r.none) assert(r.named, `no plate names ${r.title}`);
  await page.evaluate(() => { history.replaceState(null, '', location.pathname); T.D.startWalking(); });
});

/* ---------------- dreams ---------------- */

test('lies down, dreams, and wakes', async (page) => {
  const r = await page.evaluate(async () => {
    const { D } = T;
    T.quiet(); D.startWalking(); await T.frames(2);
    D.fallAsleep(0, 0);
    const out = { mode: D.mode };
    await T.sleep(6000);
    out.dreaming = !!(D.sleep && D.sleep.dreaming);
    D.wakeUp();
    await T.sleep(4000);
    out.awake = D.mode; out.asleep = !!D.sleep;
    return out;
  });
  assert.strictEqual(r.mode, 'sleeping');
  assert(r.dreaming, 'no dream came');
  assert.strictEqual(r.awake, 'walking');
  assert(!r.asleep, 'still asleep');
});

/* ---------------- what is drawn, and kept ---------------- */

test('behind the Catalogue, the Library is drawn again only when something in it changes', async (page) => {
  const r = await page.evaluate(async () => {
    const { D, W } = T, R = D.renderer;
    let renders = 0; const draw = R.render.bind(R); R.render = (a, b) => { renders++; return draw(a, b); };
    T.quiet(); D.startWalking(); await T.frames(4);
    renders = 0; await T.frames(8); const walking = renders;
    D.terminal.open(); await T.frames(6); renders = 0; await T.frames(10); const still = renders;
    W.toggleDoor(0, 0); renders = 0; await T.frames(6); const door = renders;
    W.toggleDoor(0, 0); await T.frames(30);
    R.render = draw; D.startWalking();
    return { walking, still, door };
  });
  assert(r.walking >= 8, `walking, drawn ${r.walking} times in 8 frames`);
  assert.strictEqual(r.still, 0, `behind the Catalogue, drawn ${r.still} times with nothing changing`);
  assert(r.door >= 5, `behind the Catalogue, a door swinging was drawn only ${r.door} times`);
});

test('adapts the Library, the mirror and the dream each on its own, down when slow and back up when easy', async (page) => {
  const r = await page.evaluate(() => {
    const { D, W } = T, Q = D.quality, R = D.renderer;
    T.quiet(); D.startWalking();
    const run = (dt, n) => { for (let i = 0; i < n; i++) D.adaptQuality(dt); return { level: Q.world.level, pr: R.getPixelRatio(), far: W.view.farFloors }; };
    const out = { size: Q.ladder.length };
    out.slow = run(0.03, 240);
    out.pauses = run(1, 500);
    out.easy = run(0.0167, 120 * 300);
    out.mirror = Q.mirror.level; out.dream = Q.dream.level;
    return out;
  });
  assert(r.size >= 3);
  assert.strictEqual(r.slow.level, 2, 'two slow spells did not lower the Library twice');
  assert.strictEqual(r.pauses.level, 2, 'pauses were taken for slow frames');
  assert.deepStrictEqual(r.easy, { level: 0, pr: r.easy.pr, far: 4 }, 'did not come back up when easy');
  assert.strictEqual(r.mirror, 0, 'the mirror was lowered for the Library\'s frames');
  assert.strictEqual(r.dream, 0, 'the dream was lowered for the Library\'s frames');
});

test('lets go of spare hexagons after a while, and draws again where they were', async (page) => {
  const r = await page.evaluate(async () => {
    const { D, P, W } = T, R = D.renderer;
    const settle = () => { for (let k = 0; k < 200 && W.pending; k++) W.update(P.site, P.cf, P.ch); };
    T.quiet();
    const hub = W.neighbours(0).find((s) => W.isHub(s));
    P.placeAtStart(hub, 0); P.site = hub; W.update(P.site, P.cf, P.ch); settle();
    const atStair = W.cells.size;
    T.quiet(); settle();
    const spare = W.pool.length;
    for (let i = 0; i < 50; i++) W.tick(1);
    const kept = W.pool.length;
    P.placeAtStart(hub, 0); P.site = hub; W.update(P.site, P.cf, P.ch); settle();
    D.startWalking(); await T.frames(3);
    return { atStair, spare, kept, back: W.cells.size, calls: R.info.render.calls };
  });
  assert(r.spare > 8, `only ${r.spare} hexagons were spare`);
  assert.strictEqual(r.kept, 8, `${r.kept} spare hexagons kept`);
  assert.strictEqual(r.back, r.atStair, 'the stair hexagon was not drawn as before');
  assert(r.calls > 0, 'nothing was drawn');
});

/* ---------------- running them ---------------- */

(async () => {
  const opts = {
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'],
  };
  if (process.env.BABEL_CHROME) opts.executablePath = process.env.BABEL_CHROME; // a browser of your own, rather than Playwright's
  const browser = await chromium.launch(opts);
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.dismiss());
  await page.goto(PAGE);
  try {
    await page.waitForFunction(() => window.Babel && Babel.started && Babel.debug && Babel.debug.world, null, { timeout: 120000 });
  } catch (e) {
    console.log(`  FAIL the Library did not start\n       ${errors.join('\n       ') || e.message}`);
    await browser.close();
    process.exit(1);
  }
  await page.evaluate(HELPERS);
  const only = process.argv[2];
  for (const { name, fn } of tests.filter((t) => !only || t.name.includes(only))) {
    const t0 = Date.now(), before = errors.length;
    try {
      await fn(page);
      if (errors.length > before) throw new Error(`the page reported: ${errors.slice(before).join('; ')}`);
      console.log(`  ok   ${name}  (${Date.now() - t0} ms)`);
    } catch (e) {
      failures++;
      console.log(`  FAIL ${name}\n       ${String(e.stack || e).split('\n').slice(0, 3).join('\n       ')}`);
    }
    await page.evaluate(() => { const D = Babel.debug; if (D.mode === 'reading' || D.mode === 'terminal') D.startWalking(); D.player.keys.clear(); });
  }
  await browser.close();
  console.log(failures ? `\n${failures} test${failures > 1 ? 's' : ''} failed` : '\nAll tests passed');
  process.exit(failures ? 1 : 0);
})();
