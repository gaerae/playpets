// Flower viewing: during the blossom festival friends gather once a day under a cherry tree the
// person grew (or on a picnic blanket, or in the field's middle), look up and talk in turns, then
// wander off (src/yard/viewing.js). Whatever the person starts takes a friend out of it.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom, keepGlobals } from './support/dom.mjs';

const viewed = [];
const saved = [];
globalThis.playPets = {
  markViewed: async day => {
    viewed.push(day);
    return { ok: true, data: null };
  },
  updatePet: async (id, at) => {
    saved.push([id, at]);
    return { ok: true, data: null };
  },
};
const state = await import('../src/core/state.js');
const { list } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { EDGE, fieldToYard, geometry, measureYard, petHeight, sizeOf, yardZoom } = await import('../src/yard/field.js');
const { treeSize } = await import('../src/yard/planted-trees.js');
const { scene } = await import('../src/yard/world.js');
const { release, sendTo } = await import('../src/yard/trips.js');
const { place, syncViews } = await import('../src/yard/views.js');
const { decorPlacement } = await import('../src/yard/decor.js');
const viewing = await import('../src/yard/viewing.js');

const MIN = 60_000;
const cherry = { id: 'c', kind: 'cherry', world: 'woodland', x: 0.5, y: 0.15, planted: 0, stage: 2 };
const blossom = { world: 'woodland', season: 'spring', period: 'day', weather: 'clear', event: 'blossom' };

// A yard of 1000 x 700 on April 5, 2027 at 10:00 local time, in the festival, with `count` friends
// drawn the way the page draws them (views.js), and a clock the test holds.
function yard(t, { count = 3, garden = {}, statuses = {}, at = new Date(2027, 3, 5, 10) } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: at.getTime() });
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
  viewed.length = 0;
  saved.length = 0;
  const previous = state.data;
  const pets = ['a', 'b', 'c'].slice(0, count).map((id, i) => ({ id, name: id, size: 100, x: 0.2 + i * 0.3, y: 0.5 }));
  state.setData({
    pets,
    assets: [],
    statuses,
    busy: [],
    garden: { viewed: '', decor: [], trees: [cherry], ...garden },
  });
  state.views.clear();
  state.setGame(null);
  state.setAiming(false);
  syncViews();
  viewing.setupViewing();
  t.after(() => {
    viewing.endViewing();
    state.views.clear();
    state.setGame(null);
    state.setAiming(false);
    state.setData(previous);
    Object.assign(scene, was);
    reduced.matches = motion;
  });
  const views = () => [...state.views.values()];
  const tick = ms => {
    clock += ms;
    t.mock.timers.tick(ms);
  };
  return {
    pets,
    views,
    tick,
    clock: () => clock,
    // Ticks the frame loop's look past the wait between suggestions (2 minutes, with random 0).
    pastCadence() {
      viewing.viewingTick(clock);
      tick(2 * MIN + 1);
      viewing.viewingTick(clock);
    },
    // Friends that said `key`'s line now.
    saying: key => views().filter(v => !v.bubble.hidden && list(key).includes(v.bubble.textContent)),
  };
}

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
// Where a friend's feet come to at the end of its trip, in yard pixels.
function footAt(v) {
  const { w, h, top } = geometry(v.pet);
  return { x: EDGE + v.target.x * w + sizeOf(v.pet) / 2, y: top + v.target.y * h + petHeight(v.pet) };
}
// No two friends' feet closer than most of a friend's width: neither friends nor tags overlap.
function apart(feet, size) {
  for (let i = 0; i < feet.length; i++)
    for (let j = i + 1; j < feet.length; j++)
      assert.ok(Math.hypot(feet[i].x - feet[j].x, feet[i].y - feet[j].y) >= 0.85 * size - 1e-6, 'apart');
}
// A gathering under way, every friend in its seat.
function gathered(y) {
  assert.equal(viewing.startViewing('friends'), true);
  y.tick(900);
  for (const v of y.views()) arrive(v);
}
// Everything friends say over `ms`, a line each time a bubble shows new words, each time a friend
// looked up, with how long it did, and the most bubbles showing at once.
function watch(y, ms) {
  const lines = [],
    ups = [],
    last = new Map(),
    since = new Map();
  let most = 0;
  for (let at = 0; at < ms; at += 100) {
    y.tick(100);
    most = Math.max(most, y.views().filter(v => !v.bubble.hidden).length);
    for (const v of y.views()) {
      const words = v.bubble.hidden ? '' : v.bubble.textContent;
      if (words && words !== last.get(v)) lines.push(words);
      last.set(v, words);
      const up = v.button.classList.contains('looking-up');
      if (up && !since.has(v)) since.set(v, y.clock());
      if (!up && since.has(v)) {
        ups.push(y.clock() - since.get(v));
        since.delete(v);
      }
    }
  }
  return { lines, ups, most };
}

test('friends suggest flower viewing once a day and walk to the cherry tree', t => {
  const y = yard(t);
  y.pastCadence();
  assert.equal(y.saying('viewing.suggest').length, 1);
  assert.deepEqual(viewed, ['2027-04-05']);
  assert.equal(state.data.garden.viewed, '2027-04-05');
  assert.equal(viewing.viewing(), true);
  y.tick(900);
  for (const v of y.views()) {
    assert.ok(v.target, `${v.pet.id} is on its way`);
    assert.equal(v.trip.save, false, 'the seat is not where it lives');
  }
  viewing.endViewing();
  assert.equal(viewing.viewing(), false);
  for (const v of y.views()) {
    v.bubble.hidden = true;
    assert.equal(v.target, null, 'the walk stops with the gathering');
  }
  for (let i = 0; i < 60; i++) {
    y.tick(MIN);
    viewing.viewingTick(y.clock());
    assert.equal(y.saying('viewing.suggest').length, 0, 'not twice in a day');
  }
  assert.deepEqual(viewed, ['2027-04-05']);
});

test('a new local day allows another gathering', t => {
  const y = yard(t, { at: new Date(2027, 3, 5, 23, 59) });
  assert.equal(viewing.startViewing('friends'), true);
  viewing.endViewing();
  assert.deepEqual(viewed, ['2027-04-05']);
  for (const v of y.views()) v.bubble.hidden = true;
  t.mock.timers.setTime(new Date(2027, 3, 6, 10).getTime());
  y.pastCadence();
  assert.equal(y.saying('viewing.suggest').length, 1);
  assert.deepEqual(viewed, ['2027-04-05', '2027-04-06']);
});

test('a gathering waits for two free idle friends and for nothing the person started', t => {
  const y = yard(t, { count: 1 });
  y.pastCadence();
  assert.equal(viewing.viewing(), false, 'one friend does not gather alone');
  state.data.pets.push({ id: 'b', name: 'b', size: 100, x: 0.8, y: 0.5 });
  syncViews();
  state.setGame({ kind: 'hide', ids: [], hint: '', timers: new Set() });
  y.pastCadence();
  assert.equal(viewing.viewing(), false, 'not during a game');
  state.setGame(null);
  state.setAiming('treat');
  y.pastCadence();
  assert.equal(viewing.viewing(), false, 'not while a treat is aimed');
  state.setAiming(false);
  state.data.statuses = { a: { state: 'working', source: 'agent', at: Date.now() } };
  y.pastCadence();
  assert.equal(viewing.viewing(), false, 'a friend at work is not the second of two');
  assert.equal(y.saying('viewing.suggest').length, 0);
  assert.deepEqual(viewed, []);
});

test('under the tree friends stand apart to both sides of the trunk, its crown left open', t => {
  const y = yard(t);
  assert.equal(viewing.startViewing('friends'), true);
  y.tick(900);
  const feet = y.views().map(footAt),
    size = sizeOf(y.views()[0].pet),
    trunk = fieldToYard(cherry).x,
    crown = treeSize('cherry', 2)[0] * yardZoom();
  for (const foot of feet) assert.ok(Math.abs(foot.x - trunk) >= crown / 2, 'nobody in front of the trunk');
  assert.ok(feet.some(foot => foot.x < trunk) && feet.some(foot => foot.x > trunk), 'both sides');
  apart(feet, size);
});

test('friends stand facing the tree, look up now and then, and talk in turns', t => {
  const y = yard(t);
  gathered(y);
  for (const v of y.views()) {
    assert.ok(v.doing, `${v.pet.id} stays where it stands`);
    assert.ok(['left', 'right'].includes(v.viewing?.side));
    assert.equal(v.button.dataset.tilt, v.viewing.side);
    assert.equal(Math.sign(v.look.x), v.viewing.side === 'left' ? -1 : 1, 'it looks toward the tree');
    assert.ok(v.look.y < 0, 'and up');
  }
  // The suggestion still shows when the first turn comes.
  const { lines: all, ups, most } = watch(y, 20_000);
  const lines = all.filter(line => !list('viewing.suggest').includes(line));
  assert.ok(lines.length >= 2, `${lines.length} lines`);
  assert.equal(most, 1, 'one talks at a time');
  for (const line of lines) assert.ok(list('viewing.lines').includes(line), line);
  assert.equal(new Set(lines).size, lines.length, 'no line twice');
  assert.ok(ups.length >= 1, 'someone looked up');
  for (const ms of ups) assert.ok(ms <= 1600, `looked up for ${ms} ms`);
});

test('the gathering ends after 60 to 90 seconds and friends wander off', t => {
  const y = yard(t);
  gathered(y);
  y.tick(59_000);
  assert.equal(viewing.viewing(), true);
  y.tick(2000);
  assert.equal(viewing.viewing(), false);
  for (const v of y.views()) {
    assert.equal(v.doing, null);
    assert.equal(v.viewing, null);
    assert.equal(v.button.dataset.tilt, undefined);
    assert.equal(v.button.classList.contains('looking-up'), false);
    assert.equal(v.away, false);
    assert.ok(v.nextWander <= y.clock() + 5000, 'it wanders off soon');
  }
});

test('a state event during a gathering or after it leaves friends where they stand', t => {
  const y = yard(t);
  gathered(y);
  const seats = new Map(y.views().map(v => [v, { x: v.x, y: v.y }]));
  for (const v of y.views()) assert.notDeepEqual(seats.get(v), { x: v.pet.x, y: v.pet.y }, 'it left its place');
  syncViews();
  for (const v of y.views()) assert.deepEqual({ x: v.x, y: v.y }, seats.get(v), 'still in its seat');
  viewing.endViewing();
  syncViews();
  for (const v of y.views()) {
    assert.deepEqual({ x: v.x, y: v.y }, seats.get(v), 'it stays where the gathering ended');
    assert.ok(
      saved.some(([id, at]) => id === v.pet.id && at.x === v.x && at.y === v.y),
      'and that is where it lives now',
    );
  }
});

test('a friend taken by something else leaves, and the last one leaving ends it', t => {
  const y = yard(t);
  gathered(y);
  const [v1, v2, v3] = y.views();
  // A game, the fishing rod or a drag takes a friend this way.
  release(v1);
  assert.equal(v1.viewing, null);
  assert.equal(v1.doing, null);
  assert.equal(v1.away, false);
  assert.ok(v2.viewing && v2.doing && v3.viewing && v3.doing);
  // A treat or a dig sends it somewhere.
  sendTo(v2, { x: 0.1, y: 0.5 });
  assert.equal(v2.viewing, null);
  assert.equal(v2.doing, null);
  assert.deepEqual(v2.target, { x: 0.1, y: 0.5 });
  assert.equal(viewing.viewing(), true);
  release(v3);
  assert.equal(viewing.viewing(), false);
});

test('outside blossom time nothing gathers, and a gathering under way ends at its next turn', t => {
  const y = yard(t);
  scene.weather = 'rain';
  assert.equal(viewing.startViewing('person'), false);
  scene.weather = 'clear';
  gathered(y);
  scene.period = 'night';
  y.tick(9000);
  assert.equal(viewing.viewing(), false);
  for (const v of y.views()) assert.equal(v.viewing, null);
});

test('with reduced motion friends gather and talk but never tilt', t => {
  const y = yard(t);
  reduced.matches = true;
  gathered(y);
  for (const v of y.views()) v.bubble.hidden = true;
  const { lines, ups } = watch(y, 20_000);
  assert.ok(lines.length >= 2);
  assert.deepEqual(ups, []);
  for (const v of y.views()) assert.equal(v.button.classList.contains('looking-up'), false);
});

test('on a picnic blanket friends sit on it and beside it in one row and may say a picnic line', t => {
  const mat = { id: 'p', kind: 'picnic', x: 0.5, y: 0.5 };
  const y = yard(t, { garden: { trees: [], decor: [mat] } });
  assert.equal(viewing.startViewing('friends'), true);
  y.tick(900);
  const box = decorPlacement(mat),
    feet = y.views().map(footAt);
  // One row across the blanket's depth, around its middle, on it and beside it.
  for (const foot of feet) {
    assert.ok(Math.abs(foot.y - feet[0].y) < 1e-6, 'one row');
    assert.ok(foot.y <= box.y && foot.y >= box.y - box.h, 'at the blanket');
  }
  assert.ok(
    feet.some(foot => Math.abs(foot.x - box.x) <= box.w / 2),
    'someone sits on it',
  );
  apart(feet, sizeOf(y.views()[0].pet));
  for (const v of y.views()) arrive(v);
  for (const v of y.views()) v.bubble.hidden = true;
  const { lines } = watch(y, 58_000);
  const picnic = list('viewing.mat_lines');
  assert.ok(
    lines.some(line => picnic.includes(line)),
    'a picnic line comes up',
  );
  for (const line of lines) assert.ok([...list('viewing.lines'), ...picnic].includes(line), line);
});
