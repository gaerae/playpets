// Flower viewing: during the blossom festival friends gather once a day under a cherry tree the
// person grew (or on a picnic blanket, or in the field's middle), look up and talk in turns, then
// wander off (src/yard/viewing.js). Whatever the person starts takes a friend out of it.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom, installStorage, keepGlobals } from './support/dom.mjs';

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
const { list, t: t0 } = await import('../src/core/i18n.js');
const { reduced } = await import('../src/core/sprites.js');
const { EDGE, fieldToYard, geometry, measureYard, petHeight, sizeOf, yardZoom } = await import('../src/yard/field.js');
const { treeSize } = await import('../src/yard/planted-trees.js');
const { scene, setScenery } = await import('../src/yard/world.js');
const { release, sendTo } = await import('../src/yard/trips.js');
const { place, syncViews } = await import('../src/yard/views.js');
const { decorPlacement } = await import('../src/yard/decor.js');
const { endFishing, fishingNow, setupCatch } = await import('../src/yard/catch.js');
const { autoDig, cancelDiscoveryWork, digging, sendDiscovery } = await import('../src/yard/discovery.js');
const viewing = await import('../src/yard/viewing.js');
const { gatherShoot, setupShoots, shootDigging } = await import('../src/yard/shoots.js');

const MIN = 60_000;
const cherry = { id: 'c', kind: 'cherry', world: 'woodland', x: 0.5, y: 0.15, planted: 0, stage: 2 };
const blossom = { world: 'woodland', season: 'spring', period: 'day', weather: 'clear', event: 'blossom' };

// A yard of 1000 x 700 on April 5, 2027 at 10:00 local time, in the festival, with `count` friends
// drawn the way the page draws them (views.js), and a clock the test holds.
function yard(t, { count = 3, garden = {}, statuses = {}, at = new Date(2027, 3, 5, 10) } = {}) {
  // First registered, so first to run: the gathering ends while the page's nodes are still there.
  t.after(() => viewing.endViewing());
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

test('friends do not gather while one of them fishes or digs, though two others are free', async t => {
  const y = yard(t);
  installStorage(t);
  document.getElementById('yard').dataset.environment = 'illustrated';
  state.setSelected('a');
  setupCatch();
  await document.getElementById('fish-tool').dispatch('click');
  assert.equal(fishingNow(), true);
  y.pastCadence();
  assert.equal(viewing.viewing(), false, 'not while a friend fishes');
  endFishing();
  sendDiscovery(state.views.get('a'), { x: 0.3, y: 0.5 }, 'dig', null);
  assert.equal(digging(), true);
  y.pastCadence();
  assert.equal(viewing.viewing(), false, 'not while a friend digs');
  assert.deepEqual(viewed, []);
  cancelDiscoveryWork();
  state.setSelected(null);
});

test('friends do not gather while one of them digs up a spring shoot', async t => {
  const y = yard(t);
  installStorage(t).setItem(
    'shoots',
    JSON.stringify({
      morning: '2027-04-05',
      rainAt: 0,
      out: [{ id: 'm', kind: 'morel', world: 'woodland', x: 0.3, y: 0.6, at: Date.now() }],
    }),
  );
  setupShoots();
  state.setSelected('a');
  const a = state.views.get('a');
  t.after(() => {
    release(a);
    state.setSelected(null);
  });
  assert.equal(gatherShoot('m'), true);
  assert.equal(shootDigging(), true);
  y.pastCadence();
  assert.equal(viewing.viewing(), false, 'not while a friend goes for a shoot');
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
  for (const line of lines) assert.ok([...list('viewing.lines'), ...list('viewing.tree_lines')].includes(line), line);
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

test('the fish tool takes a gathered friend when every friend is gathered, and the gathering lets it go', async t => {
  const y = yard(t);
  installStorage(t);
  document.getElementById('yard').dataset.environment = 'illustrated';
  setupCatch();
  gathered(y);
  document.getElementById('toast').replaceChildren();
  await document.getElementById('fish-tool').dispatch('click');
  assert.equal(fishingNow(), true, 'someone went fishing');
  assert.equal(document.getElementById('toast').children.length, 0, 'nobody is told everyone is busy');
  const fisher = y.views().find(v => v.target);
  assert.ok(fisher, 'a friend set off for the lake');
  assert.equal(fisher.viewing, null);
  assert.equal(fisher.away, false);
  assert.equal(fisher.button.dataset.tilt, undefined);
  assert.equal(viewing.viewing(), true, 'the others keep viewing');
  for (const v of y.views()) if (v !== fisher) assert.ok(v.viewing, `${v.pet.id} still views`);
  endFishing();
});

test('the fish tool takes a free friend before a gathered one, even the chosen one', async t => {
  const y = yard(t);
  installStorage(t);
  document.getElementById('yard').dataset.environment = 'illustrated';
  setupCatch();
  const [a, , c] = y.views();
  c.doing = { end() {} };
  assert.equal(viewing.startViewing('friends'), true);
  y.tick(900);
  for (const v of y.views()) if (v.target) arrive(v);
  c.doing = null;
  assert.equal(c.viewing ?? null, null, 'c stayed out of it');
  state.setSelected('a');
  t.after(() => state.setSelected(null));
  await document.getElementById('fish-tool').dispatch('click');
  assert.ok(c.target, 'the free friend goes');
  assert.ok(a.viewing, 'the chosen one keeps viewing');
  endFishing();
});

test("friends' own doings never take a gathered friend", t => {
  const y = yard(t);
  gathered(y);
  assert.equal(
    autoDig(() => 0.5),
    false,
    'Let them dig finds no one',
  );
  for (const v of y.views()) assert.ok(v.viewing, `${v.pet.id} still views`);
  viewing.endViewing();
  assert.equal(
    autoDig(() => 0.5),
    true,
    'it would have, with a friend free',
  );
  cancelDiscoveryWork();
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

test('moving to another place ends a gathering at its next turn', t => {
  const y = yard(t);
  gathered(y);
  scene.world = 'lakeside';
  y.tick(9000);
  assert.equal(viewing.viewing(), false);
  for (const v of y.views()) assert.equal(v.viewing, null);
});

test('a gathering whose walk never finishes still ends on time', t => {
  const y = yard(t);
  assert.equal(viewing.startViewing('friends'), true);
  y.tick(900);
  // Nobody arrives: the frame loop rests while the window is hidden.
  y.tick(59_000);
  assert.equal(viewing.viewing(), true);
  y.tick(2000);
  assert.equal(viewing.viewing(), false);
  for (const v of y.views()) {
    assert.equal(v.target, null);
    assert.equal(v.away, false);
  }
});

test('under the tree a friend may talk about its branches', t => {
  const y = yard(t);
  gathered(y);
  for (const v of y.views()) v.bubble.hidden = true;
  const { lines } = watch(y, 58_000);
  assert.ok(
    lines.some(line => list('viewing.tree_lines').includes(line)),
    'a branch line comes up',
  );
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
  // A branch line belongs under a tree.
  for (const line of lines) assert.ok([...list('viewing.lines'), ...picnic].includes(line), line);
});

// The play menu's Flower viewing button (viewing.js syncViewingAction): the page's `viewing-tool`.
const tool = () => document.getElementById('viewing-tool');
const said = () => document.getElementById('toast').children.at(-1)?.dataset.words ?? null;
// The menu opened on a yard with `count` friends: the toast is empty, the button synced.
function menu(t, options) {
  const y = yard(t, options);
  document.getElementById('toast').replaceChildren();
  viewing.syncViewingAction();
  return y;
}

test('the play menu offers flower viewing only in blossom time', t => {
  const y = menu(t);
  assert.equal(tool().hidden, false);
  assert.equal(tool().disabled, false);
  assert.equal(tool().title, t0('viewing.action_title'));
  scene.event = null;
  viewing.syncViewingAction();
  assert.equal(tool().hidden, true, 'outside the festival');
  scene.event = 'blossom';
  scene.weather = 'rain';
  viewing.syncViewingAction();
  assert.equal(tool().hidden, true, 'in the rain');
  scene.weather = 'clear';
  viewing.syncViewingAction();
  assert.equal(tool().hidden, false);
  state.setGame({ kind: 'hide', ids: [], hint: '', timers: new Set() });
  viewing.syncViewingAction();
  assert.equal(tool().disabled, true, 'while a game is on');
  assert.equal(tool().title, t0('viewing.action_title'));
  state.setGame(null);
  viewing.syncViewingAction();
  assert.equal(tool().disabled, false);
  tool().onclick();
  assert.equal(viewing.viewing(), true);
  assert.equal(tool().disabled, true, 'during a gathering, so no one is told everyone is busy');
  assert.equal(tool().title, t0('viewing.action_title'), 'disabled, it does not say to wait');
  viewing.endViewing();
  viewing.syncViewingAction();
  assert.equal(tool().disabled, false);
  y.pets.length = 0;
  state.data.pets = [];
  viewing.syncViewingAction();
  assert.equal(tool().disabled, true, 'with no friends');
});

test('the menu syncs without the button on the page', t => {
  menu(t);
  const lookup = document.getElementById;
  t.mock.method(document, 'getElementById', id => (id === 'viewing-tool' ? null : lookup.call(document, id)));
  assert.doesNotThrow(() => viewing.syncViewingAction());
});

test('calling friends works at most once an hour', t => {
  const y = menu(t);
  tool().onclick();
  assert.equal(viewing.viewing(), true);
  assert.deepEqual(viewed, ['2027-04-05']);
  assert.equal(state.data.garden.viewed, '2027-04-05');
  viewing.endViewing();
  y.tick(30 * MIN);
  viewing.syncViewingAction();
  assert.equal(tool().getAttribute('aria-disabled'), 'true');
  assert.equal(tool().title, t0('viewing.wait'));
  tool().onclick();
  assert.equal(said(), t0('viewing.wait'));
  assert.equal(viewing.viewing(), false);
  y.tick(31 * MIN);
  viewing.syncViewingAction();
  assert.equal(tool().getAttribute('aria-disabled'), 'false');
  assert.equal(tool().title, t0('viewing.action_title'));
  tool().onclick();
  assert.equal(viewing.viewing(), true);
});

test('a call with every friend busy says so', t => {
  const y = menu(t);
  for (const v of y.views()) v.doing = { end() {} };
  tool().onclick();
  assert.equal(said(), t0('viewing.none_free'));
  assert.equal(viewing.viewing(), false);
  assert.deepEqual(viewed, []);
  // A call that failed does not start the hour.
  for (const v of y.views()) v.doing = null;
  tool().onclick();
  assert.equal(viewing.viewing(), true);
});

test('a friend out for a stroll comes along, one on an errand does not', t => {
  const y = menu(t);
  const [a, b, c] = y.views();
  // As moveFriends sends a friend wandering, and as a decoration visit sends one.
  sendTo(a, { x: 0.9, y: 0.6 }, { slow: true });
  sendTo(b, { x: 0.1, y: 0.6 }, { slow: true, arrive() {} });
  tool().onclick();
  assert.equal(viewing.viewing(), true);
  assert.equal(a.away, true, 'the stroller joins');
  y.tick(900);
  assert.ok(a.seat && a.target, 'and walks to its seat');
  assert.ok(b.trip?.arrive && !b.away, 'the errand is kept');
  assert.equal(c.away, true);
});

test('a call just after blossom time ended hides the button and says nothing', t => {
  const y = menu(t);
  assert.equal(tool().hidden, false);
  // Night came within the minute before the menu's next sync.
  scene.period = 'night';
  tool().onclick();
  assert.equal(said(), null, 'no toast');
  assert.equal(tool().hidden, true, 'the button follows the sky');
  assert.equal(viewing.viewing(), false);
  assert.equal(
    y.views().every(v => !v.away),
    true,
  );
});

test('a call with one free friend still gathers', t => {
  const y = menu(t);
  const [first, ...rest] = y.views();
  for (const v of rest) v.doing = { end() {} };
  tool().onclick();
  assert.equal(viewing.viewing(), true);
  assert.equal(first.away, true);
});

test('petals fall a little thicker around the tree from the first arrival to the end', t => {
  const y = yard(t);
  const bands = [];
  setScenery({ gather: band => bands.push(band) });
  t.after(() => setScenery(null));
  assert.equal(viewing.startViewing('friends'), true);
  y.tick(900);
  assert.deepEqual(bands, [], 'not while they walk');
  const [first, ...rest] = y.views();
  arrive(first);
  const x = fieldToYard(cherry).x,
    w = treeSize('cherry', 2)[0] * yardZoom();
  assert.equal(bands.length, 1);
  assert.equal(bands[0].x, x);
  assert.ok(Math.abs(bands[0].width - Math.max(160 * yardZoom(), w * 1.3)) < 1e-6);
  for (const v of rest) arrive(v);
  assert.equal(bands.length, 1, 'once, on the first arrival');
  y.tick(91_000);
  assert.equal(viewing.viewing(), false);
  assert.deepEqual(bands.slice(1), [null], 'and a null at the end');
});

// Friends with an AI talk in their own voices through the chatter command (chat/mod.rs).
const chats = [];
// `chatter` answers with `reply` (a promise's resolver can be taken by `hold`); `ai` friends have a provider.
function voices(t, { ai = ['a', 'b'], auto = true, reply = { ok: true, data: null }, hold = false, ...options } = {}) {
  const y = yard(t, options);
  chats.length = 0;
  const was = globalThis.playPets.chatter;
  let release;
  globalThis.playPets.chatter = async (...args) => {
    chats.push(args);
    if (hold) await new Promise(resolve => (release = resolve));
    return reply;
  };
  t.after(() => {
    globalThis.playPets.chatter = was;
  });
  for (const p of state.data.pets) if (ai.includes(p.id)) p.providerId = 'p';
  state.data.autoChatter = auto;
  return { ...y, finish: () => release() };
}
const stringLines = () =>
  new Set([...list('viewing.lines'), ...list('viewing.tree_lines'), ...list('viewing.mat_lines')]);
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

test("a gathering the person called talks in the friends' own voices", async t => {
  const y = voices(t, { auto: false, count: 3 });
  viewing.startViewing('person');
  y.tick(900);
  for (const v of y.views()) arrive(v);
  y.tick(1500);
  await flush();
  assert.equal(chats.length, 1);
  const [period, weather, about, ids] = chats[0];
  assert.deepEqual([period, weather, about, [...ids].sort()], ['day', 'clear', 'blossom', ['a', 'b']]);
  const { lines, ups } = watch(y, 20_000);
  assert.deepEqual(
    lines.filter(line => stringLines().has(line)),
    [],
    'the AI speaks, not the strings',
  );
  assert.ok(ups.length >= 1, 'the tilts go on');
});

test('friends starting one use the AI only with Let them chat on their own', async t => {
  const off = voices(t, { auto: false });
  gathered(off);
  const { lines } = watch(off, 20_000);
  await flush();
  assert.deepEqual(chats, []);
  assert.ok(lines.some(line => stringLines().has(line)));
  viewing.endViewing();
  chats.length = 0;
  state.data.autoChatter = true;
  state.data.garden.viewed = '';
  gathered(off);
  watch(off, 3000);
  await flush();
  assert.equal(chats.length, 1);
});

test('fewer than two friends with an AI means the string lines', async t => {
  const y = voices(t, { ai: ['a'], auto: true });
  gathered(y);
  const { lines } = watch(y, 20_000);
  await flush();
  assert.deepEqual(chats, []);
  assert.ok(lines.some(line => stringLines().has(line)));
});

test('when the AI cannot talk, the string lines carry on', async t => {
  const y = voices(t, { reply: { ok: false, error: 'x' } });
  gathered(y);
  y.tick(1500);
  await flush();
  assert.equal(chats.length, 1);
  const { lines } = watch(y, 9000);
  assert.ok(
    lines.some(line => stringLines().has(line)),
    'the string lines',
  );
});

test('string lines wait while the AI answers, and a state event leaves friends in their seats', async t => {
  const y = voices(t, { hold: true });
  gathered(y);
  const seats = new Map(y.views().map(v => [v, { x: v.x, y: v.y }]));
  const { lines } = watch(y, 20_000);
  assert.equal(chats.length, 1);
  assert.deepEqual(
    lines.filter(line => stringLines().has(line)),
    [],
  );
  syncViews();
  for (const v of y.views()) assert.deepEqual({ x: v.x, y: v.y }, seats.get(v), 'still in its seat');
  assert.equal(viewing.viewing(), true);
});

for (const [name, reply] of [
  ['an answer', { ok: true, data: null }],
  ['a failure', { ok: false, error: 'x' }],
])
  test(`${name} that comes after the gathering ended starts nothing`, async t => {
    const y = voices(t, { hold: true, reply });
    gathered(y);
    y.tick(1500);
    assert.equal(chats.length, 1);
    viewing.endViewing();
    // A new gathering is on when the old one's answer comes, in weather that would end a stale turn.
    assert.equal(viewing.startViewing('person'), true);
    scene.weather = 'rain';
    const wander = y.views().map(v => v.nextWander);
    y.finish();
    await flush();
    assert.equal(viewing.viewing(), true, 'the answer did not end or take over the new gathering');
    scene.weather = 'clear';
    const { lines } = watch(y, 20_000);
    assert.deepEqual(
      lines.filter(line => stringLines().has(line)),
      [],
      'no string turn after the end',
    );
    assert.deepEqual(
      y.views().map(v => v.nextWander),
      wander,
    );
  });

test('a place change while the AI round runs still ends the gathering within a turn', t => {
  const y = voices(t, { hold: true });
  gathered(y);
  y.tick(1500);
  assert.equal(chats.length, 1);
  scene.world = 'lakeside';
  y.tick(20_000);
  assert.equal(viewing.viewing(), false);
});
