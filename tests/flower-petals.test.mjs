// Petals on heads: during the blossom festival a falling petal now and then lands on a friend that
// stands still and stays until the friend moves; now and then the friend notices
// (src/yard/petals.js, trips.js brushPetal).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import './support/content.mjs';
import { installDom, keepGlobals } from './support/dom.mjs';

globalThis.playPets = {
  markViewed: async () => ({ ok: true, data: null }),
  updatePet: async () => ({ ok: true, data: null }),
};
const state = await import('../src/core/state.js');
const { list } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { measureYard } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');
const { brushPetal, sendTo } = await import('../src/yard/trips.js');
const { place, syncViews } = await import('../src/yard/views.js');
const viewing = await import('../src/yard/viewing.js');
const { landPetal, petalTick, setupPetals } = await import('../src/yard/petals.js');

const MIN = 60_000;
const cherry = { id: 'c', kind: 'cherry', world: 'woodland', x: 0.5, y: 0.15, planted: 0, stage: 2 };
const blossom = { world: 'woodland', season: 'spring', period: 'day', weather: 'clear', event: 'blossom' };

// A yard of 1000 x 700 on April 5, 2027 at 10:00 local time, in the festival, with three friends
// drawn the way the page draws them (views.js), and a clock the test holds (as flower-viewing's).
function yard(t) {
  t.after(() => viewing.endViewing());
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(2027, 3, 5, 10).getTime() });
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  t.mock.method(Math, 'random', () => 0);
  installDom(t, { anyId: true });
  keepGlobals(t, 'MutationObserver');
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  document.getElementById('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700 });
  measureYard();
  const was = Object.fromEntries(Object.keys(blossom).map(key => [key, scene[key]]));
  Object.assign(scene, blossom);
  const motion = reduced.matches;
  reduced.matches = false;
  const previous = state.data;
  const pets = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, size: 100, x: 0.2 + i * 0.3, y: 0.5 }));
  state.setData({ pets, assets: [], statuses: {}, busy: [], garden: { viewed: '', decor: [], trees: [cherry] } });
  state.views.clear();
  state.setGame(null);
  state.setAiming(false);
  syncViews();
  viewing.setupViewing();
  setupPetals();
  t.after(() => {
    state.views.clear();
    state.setData(previous);
    Object.assign(scene, was);
    reduced.matches = motion;
  });
  const views = () => [...state.views.values()];
  return {
    views,
    clock: () => clock,
    tick(ms) {
      clock += ms;
      t.mock.timers.tick(ms);
    },
    // The petals resting on heads now.
    petals: () => views().filter(v => v.petal && !v.petal.removed),
  };
}
const petalsOn = v => v.label.querySelectorAll('.head-petal').filter(p => !p.removed);

// A friend gets where it was sent, as moveFriends does it: the trip is let go of before it arrives.
function arrive(v) {
  const { target, trip } = v;
  v.x = target.x;
  v.y = target.y;
  v.target = null;
  v.trip = null;
  place(v);
  trip.arrive(v, performance.now());
}

test("a petal rests on a friend's head until it moves", t => {
  const y = yard(t);
  const [v, w, u] = y.views();
  assert.equal(landPetal(v), true);
  const [petal] = petalsOn(v);
  assert.equal(petalsOn(v).length, 1, 'one petal, on its label');
  assert.equal(petal.getAttribute('aria-hidden'), 'true');
  assert.ok(petal.classList.contains('landing'), 'it floats down onto the head');
  assert.equal(landPetal(v), false, 'one at a time');
  assert.equal(petalsOn(v).length, 1);
  sendTo(v, { x: 0.2, y: 0.5 });
  assert.equal(petal.removed, true, 'a walk brushes it off');
  assert.equal(v.petal, null);
  // A press that starts a drag (or a pat) and a move by the arrow keys take it off too.
  landPetal(w);
  w.button.dispatch('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
  assert.equal(w.petal, null, 'a press brushes it off');
  landPetal(u);
  u.button.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(u.petal, null, 'an arrow key brushes it off');
});

test('now and then a friend notices its petal, but not one already gone', t => {
  const y = yard(t);
  const [v, w] = y.views();
  landPetal(v);
  y.tick(6000);
  assert.equal(v.bubble.hidden, false);
  assert.ok(list('viewing.petal_notice').includes(v.bubble.textContent));
  y.tick(10_000);
  assert.equal(v.bubble.hidden, true);
  brushPetal(v);
  landPetal(v);
  y.tick(1000);
  const timer = v.petalTimer,
    cleared = [],
    clear = globalThis.clearTimeout;
  assert.ok(timer, 'it would notice this one too');
  t.mock.method(globalThis, 'clearTimeout', id => {
    cleared.push(id);
    clear(id);
  });
  brushPetal(v);
  assert.ok(cleared.includes(timer), 'brushing it off clears the notice');
  assert.equal(v.petalTimer, null);
  y.tick(6000);
  assert.equal(v.bubble.hidden, true, 'brushed off before it noticed');
  // A friend that leaves the yard with a petal on says nothing afterwards.
  landPetal(w);
  y.tick(1000);
  state.data.pets = state.data.pets.filter(p => p.id !== 'b');
  syncViews();
  assert.equal(w.petal, null);
  assert.equal(w.petalTimer, null);
  y.tick(6000);
  assert.equal(w.bubble.hidden, true, 'a friend gone from the yard says nothing');
});

test('a friend notices its petal only now and then, and not over its own words', t => {
  const y = yard(t);
  const [v, w] = y.views();
  Math.random.mock.mockImplementation(() => 0.5);
  landPetal(v);
  y.tick(7000);
  assert.equal(v.bubble.hidden, true, 'over a third of the time it says nothing');
  Math.random.mock.mockImplementation(() => 0);
  landPetal(w);
  w.bubble.hidden = false;
  w.bubble.textContent = 'Hello';
  y.tick(6000);
  assert.equal(w.bubble.textContent, 'Hello', 'a friend talking is not cut off');
});

test('petals land only in blossom time, more often during a gathering', t => {
  const y = yard(t);
  scene.event = null;
  for (let at = 0; at < 60 * MIN; at += 1000) {
    y.tick(1000);
    petalTick(y.clock());
  }
  assert.equal(y.petals().length, 0, 'none outside the festival');
  scene.event = 'blossom';
  setupPetals();
  petalTick(y.clock());
  y.tick(60_001);
  petalTick(y.clock());
  assert.equal(y.petals().length, 1, 'one on a free friend');
  for (const v of y.views()) {
    v.bubble.hidden = true;
    brushPetal(v);
  }
  // Gathered and standing, friends get petals sooner, and keep them while they stand.
  assert.equal(viewing.startViewing('friends'), true);
  y.tick(900);
  for (const v of y.views()) arrive(v);
  petalTick(y.clock());
  y.tick(15_001);
  petalTick(y.clock());
  const [v] = y.petals();
  assert.ok(v?.viewing, 'a gathered friend got one');
  for (let at = 0; at < 30_000; at += 1000) {
    y.tick(1000);
    if (!y.petals().includes(v)) break;
  }
  assert.ok(y.petals().includes(v), 'it keeps it through the turns');
  viewing.endViewing();
  assert.ok(y.petals().includes(v), 'and where it stays when the gathering ends');
  // Then it wanders off (moveFriends sends it), and the walk brushes it off.
  sendTo(v, { x: 0.4, y: 0.6 }, { slow: true });
  assert.equal(v.petal, null);
});

test('a friend on its way, held or already wearing one gets no petal', t => {
  const y = yard(t);
  const [v, w, u] = y.views();
  sendTo(v, { x: 0.9, y: 0.9 });
  w.drag = {};
  landPetal(u);
  for (let at = 0; at < 10 * MIN; at += 1000) {
    y.tick(1000);
    petalTick(y.clock());
  }
  assert.equal(v.petal ?? null, null, 'not on its way');
  assert.equal(w.petal ?? null, null, 'not while held');
  assert.equal(petalsOn(u).length, 1, 'not a second one');
  w.drag = null;
});

test('with reduced motion petals still rest on heads, without the landing', t => {
  const y = yard(t);
  reduced.matches = true;
  const [v] = y.views();
  assert.equal(landPetal(v), true);
  const [petal] = petalsOn(v);
  assert.ok(petal);
  assert.equal(petal.classList.contains('landing'), false);
});

// What the desktop overlay loads, however indirectly (as modules.test.mjs follows imports).
async function reachable(entry) {
  const seen = new Set(),
    queue = [path.resolve(entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(file, 'utf8');
    for (const [, target] of source.matchAll(/^import\s[^;]*?from\s*'([^']+)'/gm))
      queue.push(path.resolve(path.dirname(file), target));
  }
  return seen;
}

test('the desktop overlay shows none of this', async () => {
  const loaded = await reachable('src/overlay/overlay.js');
  assert.ok(loaded.has(path.resolve('src/core/sprites.js')), 'the walk follows imports');
  for (const file of ['src/yard/petals.js', 'src/yard/viewing.js', 'src/yard/viewing-rules.js', 'src/yard/trips.js'])
    assert.equal(loaded.has(path.resolve(file)), false, `the overlay reaches ${file}`);
});
