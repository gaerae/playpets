import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

const calls = [];
let failGift = false;
let refuseThanks = false;
globalThis.playPets = {
  receiveGift: async (_x, _y, day, _event, from) => {
    calls.push(['gift', day, from]);
    if (failGift) return { ok: false, error: 'fixture failure' };
    state.data.garden.giftDay = day;
    state.data.garden.giftWait = null;
    return { ok: true, data: { id: `gift-${calls.length}`, kind: 'bench', x: 0.5, y: 0.5, from, boxed: false } };
  },
  thanksGift: async (from, level) => {
    calls.push(['thanks', from, level]);
    if (refuseThanks) return { ok: false, error: 'fixture refusal' };
    state.data.garden.thanked = { ...state.data.garden.thanked, [from]: level };
    const memento = level >= 4;
    return {
      ok: true,
      data: { id: `thanks-${calls.length}`, kind: 'bench', x: 0.5, y: 0.5, from, memento, boxed: false },
    };
  },
  waitForGift: async (after, dueAt) => {
    state.data.garden.giftWait = { after, dueAt };
    return { ok: true, data: null };
  },
  befriend: async () => ({ ok: true, data: {} }),
};
const state = await import('../src/core/state.js');
const { measureYard } = await import('../src/yard/field.js');
const { daysBetween, giftDue, localDay } = await import('../src/yard/growth.js');
let imports = 0;
const fresh = () => import(`../src/yard/decor.js?gift-progress=${++imports}`);
const flush = () => new Promise(resolve => setImmediate(resolve));
const MIN = 60_000;
const DAY = 86_400_000;
const gifts = () => calls.filter(c => c[0] === 'gift');
const pet = { id: 'gift-friend', size: 100 };

function fixture(t) {
  let wall = new Date(2026, 0, 5, 12).getTime();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(Date, 'now', () => wall);
  t.mock.method(Math, 'random', () => 0);
  installDom(t, { anyId: true });
  document.getElementById('yard').getBoundingClientRect = () => ({ width: 1000, height: 700 });
  measureYard();
  calls.length = 0;
  failGift = false;
  refuseThanks = false;
  const previous = state.data;
  state.setData({
    pets: [pet],
    assets: [],
    bonds: {},
    garden: { giftDay: '2026-01-03', received: ['bench'], decor: [], boxed: [], thanked: {} },
  });
  state.views.clear();
  state.views.set(pet.id, { pet, px: 100, py: 400, bubble: element('span') });
  t.after(() => {
    state.views.clear();
    state.setData(previous);
  });
  const clock = {
    advance(ms) {
      wall += ms;
    },
    get now() {
      return wall;
    },
    get today() {
      return localDay(new Date(wall));
    },
    // Something done together today, as the backend counts it (bond.rs today).
    together(points = 3) {
      state.data.bonds[pet.id] = { ...state.data.bonds[pet.id], day: clock.today, today: points };
    },
  };
  return clock;
}

test('an everyday gift may come every other day, counted in calendar days', () => {
  assert.equal(daysBetween('2026-12-31', '2027-01-02'), 2);
  assert.equal(daysBetween('2026-01-05', '2026-01-04'), -1);
  assert.equal(giftDue('', '2026-01-05', 2), true, 'the first gift has no day before it');
  assert.equal(giftDue('2026-01-04', '2026-01-05', 2), false);
  assert.equal(giftDue('2026-01-03', '2026-01-05', 2), true);
  assert.equal(giftDue('not a day', '2026-01-05', 2), false, 'as the backend, a malformed day gives no gift');
});

test('time alone brings no gift; a friend the person did something with today brings it', async t => {
  const clock = fixture(t);
  const decor = await fresh();
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 0, 'no one did anything with the friend today');
  assert.equal(state.data.garden.giftWait, undefined, 'the wait starts only once someone plays');
  clock.together();
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 0, 'not the moment the person plays');
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.deepEqual(gifts(), [['gift', clock.today, pet.id]]);
  for (let i = 0; i < 3; i++) decor.giftTick();
  clock.advance(DAY);
  clock.together();
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 1, 'not the next day');
  clock.advance(DAY);
  clock.together();
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 2, 'the day after that');
});

test("the wait is the backend's, so a restart keeps it", async t => {
  const clock = fixture(t);
  clock.together();
  (await fresh()).giftTick();
  await flush();
  const wait = state.data.garden.giftWait;
  assert.equal(wait.after, '2026-01-03');
  assert.equal(wait.dueAt, clock.now + 10 * MIN, 'later gifts wait 10 to 20 minutes');
  clock.advance(10 * MIN - 1);
  (await fresh()).giftTick();
  await flush();
  assert.equal(gifts().length, 0);
  assert.equal(state.data.garden.giftWait, wait, 'the saved wait is kept, not drawn again');
  clock.advance(1);
  (await fresh()).giftTick();
  await flush();
  assert.equal(gifts().length, 1);
});

test('a wait set before the last gift, on an earlier day, malformed or too far ahead is drawn again', async t => {
  for (const saved of [
    { after: '2026-01-01', dueAt: 0 },
    { after: '2026-01-03', dueAt: 'later' },
    'future',
    'yesterday',
  ]) {
    await t.test(JSON.stringify(saved), async t => {
      const clock = fixture(t);
      const at = { future: clock.now + 10 * DAY, yesterday: clock.now - DAY };
      state.data.garden.giftWait = at[saved] ? { after: '2026-01-03', dueAt: at[saved] } : saved;
      clock.together();
      (await fresh()).giftTick();
      await flush();
      assert.equal(gifts().length, 0);
      assert.ok(state.data.garden.giftWait.dueAt <= clock.now + 20 * MIN);
      clock.advance(20 * MIN);
      (await fresh()).giftTick();
      await flush();
      assert.equal(gifts().length, 1);
    });
  }
});

test('the first gift waits five minutes', async t => {
  const clock = fixture(t);
  state.data.garden.giftDay = '';
  state.data.garden.received = [];
  t.mock.method(Math, 'random', () => 0.99);
  clock.together();
  const decor = await fresh();
  decor.giftTick();
  clock.advance(5 * MIN - 1);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 0);
  clock.advance(1);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 1);
});

test('a full yard sends the gift to the box; with both full no gift is asked for', async t => {
  const clock = fixture(t);
  const twelve = () => Array.from({ length: 12 }, (_, id) => ({ id: `${id}`, kind: 'bench', x: 0.5, y: 0.5 }));
  state.data.garden.decor = twelve();
  state.data.garden.boxed = twelve();
  state.data.bonds[pet.id] = { points: 500 };
  clock.together();
  const decor = await fresh();
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  // A friend at level 4 would bring a thanks gift by the second tick (the first sets its moment).
  decor.thanksTick(1e12);
  decor.thanksTick(2e12);
  await flush();
  assert.equal(calls.length, 0);
  state.data.garden.boxed = [];
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 1, 'the box has room');
});

test('a failed save waits a minute instead of retrying every frame', async t => {
  const clock = fixture(t);
  failGift = true;
  clock.together();
  const decor = await fresh();
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 1);
  clock.advance(30_000);
  for (let i = 0; i < 5; i++) decor.giftTick();
  await flush();
  assert.equal(gifts().length, 1);
  clock.advance(30_000);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 2);
});

test('a friend that grew closer brings one gift for the level it reached', async t => {
  const clock = fixture(t);
  const decor = await fresh();
  const tick = async now => {
    decor.thanksTick(now);
    await flush();
  };
  await tick(0);
  await tick(1e9);
  assert.equal(calls.length, 0, 'level 1 brings none');
  state.data.bonds[pet.id] = { points: 500 };
  await tick(2e9);
  assert.deepEqual(calls, [['thanks', pet.id, 4]], 'a friend already at 4 brings one gift, for 4');
  await tick(3e9);
  assert.equal(calls.length, 1, 'once a level');
  state.data.bonds[pet.id] = { points: 1000 };
  refuseThanks = true;
  await tick(4e9);
  await tick(5e9);
  assert.equal(calls.length, 2, 'a refused level is not asked again at once');
  refuseThanks = false;
  clock.advance(10 * 60_000);
  await tick(6e9);
  assert.deepEqual(calls.at(-1), ['thanks', pet.id, 5], 'but is asked again after a while');
});

test('a level reached while there was no room still brings its gift, one level at a time', async t => {
  fixture(t);
  const decor = await fresh();
  state.data.garden.thanked = { [pet.id]: 2 };
  state.data.bonds[pet.id] = { points: 500 };
  for (const now of [1e9, 2e9, 3e9, 4e9]) {
    decor.thanksTick(now);
    await flush();
  }
  assert.deepEqual(calls, [
    ['thanks', pet.id, 3],
    ['thanks', pet.id, 4],
  ]);
});

test('the card says where a gift went: set out, or in the box, a memento as such', async () => {
  const { broughtCard } = await fresh();
  assert.equal(broughtCard({}, 'decor.brought'), 'decor.brought');
  assert.equal(broughtCard({ boxed: true }, 'decor.brought'), 'decor.brought_boxed');
  assert.equal(broughtCard({ memento: true }, 'decor.brought_thanks'), 'decor.brought_memento');
  assert.equal(broughtCard({ memento: true, boxed: true }, 'decor.brought_thanks'), 'decor.brought_memento_boxed');
});
