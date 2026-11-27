import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

const calls = [];
const events = [];
let failGift = false;
let refuseThanks = false;
globalThis.playPets = {
  receiveGift: async (_x, _y, day, event, from) => {
    events.push(event);
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
const { scene } = await import('../src/yard/world.js');
const { daysBetween, giftDue, localDay } = await import('../src/yard/growth.js');
let imports = 0;
const fresh = () => import(`../src/yard/decor.js?gift-progress=${++imports}`);
const flush = () => new Promise(resolve => setImmediate(resolve));
const MIN = 60_000;
const DAY = 86_400_000;
const gifts = () => calls.filter(c => c[0] === 'gift');
const pet = { id: 'gift-friend', size: 100 };

function fixture(t, start = new Date(2026, 0, 5, 12)) {
  let wall = start.getTime();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(Date, 'now', () => wall);
  t.mock.method(Math, 'random', () => 0);
  installDom(t, { anyId: true });
  document.getElementById('yard').getBoundingClientRect = () => ({ width: 1000, height: 700 });
  measureYard();
  calls.length = 0;
  events.length = 0;
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

// The loop asks every frame; the system's time zone (Intl) is dear to read that often (4.9 ms a
// second of the yard's idle frames in Chrome's profile), and a day's event changes at most once a
// minute: alone with no one played with it is not read at all, and while a gift waits, once a minute.
test('a gift waiting reads the time zone at most once a minute, and not at all before anyone plays', async t => {
  const clock = fixture(t);
  const decor = await fresh();
  let asked = 0;
  const real = Intl.DateTimeFormat;
  t.mock.method(Intl, 'DateTimeFormat', (...args) => {
    asked++;
    return new real(...args);
  });
  for (let i = 0; i < 20; i++) decor.giftTick();
  assert.equal(asked, 0, 'no one played today');
  clock.together();
  for (let i = 0; i < 20; i++) decor.giftTick();
  assert.equal(asked, 1);
  clock.advance(MIN);
  for (let i = 0; i < 20; i++) decor.giftTick();
  assert.equal(asked, 2);
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

// Gifts wait in the album without a limit of their own: a friend brings none only once every
// everyday kind is out or waiting already, since one of each waits (garden.rs give).
async function fullYard(t) {
  const clock = fixture(t);
  const { GIFTS, eventGifts } = await import('../src/yard/catalog.js');
  state.data.garden.decor = Array.from({ length: 12 }, (_, id) => ({ id: `${id}`, kind: 'bench', x: 0.5, y: 0.5 }));
  state.data.garden.boxed = GIFTS.filter(g => !g.event && !g.built && g.id !== 'bench').map(g => ({
    id: `w-${g.id}`,
    kind: g.id,
    x: 0.5,
    y: 0.5,
  }));
  // The fixture's day is in the New Year days: their own gift came already.
  state.data.garden.received = ['bench', ...eventGifts('newyear')];
  state.data.bonds[pet.id] = { points: 500 };
  return clock;
}

test('a full yard sends the gift to wait in the album; with every kind out or waiting none is asked for', async t => {
  const clock = await fullYard(t);
  // The friend's memento waits in the album already, so its thanks gift would be an everyday one.
  state.data.garden.boxed.push({ id: 'm', kind: 'swing', x: 0.5, y: 0.5, from: pet.id, memento: true });
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
  state.data.garden.boxed = state.data.garden.boxed.slice(1);
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 1, 'a kind not out or waiting can come');
});

// What a full yard still takes, as the backend does: an event's own gift not yet received, and a
// friend's memento when it has none out or waiting (garden.rs gift, thanks).
test("with every kind out or waiting, an event's new gift and a friend's memento still come", async t => {
  const clock = await fullYard(t);
  state.data.garden.received = ['bench'];
  clock.together();
  const decor = await fresh();
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.deepEqual(gifts(), [['gift', clock.today, pet.id]]);
  assert.deepEqual(events, ['newyear']);
  decor.thanksTick(1e12);
  decor.thanksTick(2e12);
  await flush();
  assert.deepEqual(
    calls.filter(c => c[0] === 'thanks'),
    [['thanks', pet.id, 4]],
  );
});

test('finds set out from the album leave the gifts their room', async t => {
  const clock = fixture(t);
  state.data.garden.decor = Array.from({ length: 12 }, (_, id) => ({
    id: `${id}`,
    kind: 'fish_out',
    holds: ['carp'],
    x: 0.5,
    y: 0.5,
  }));
  state.data.garden.boxed = [];
  clock.together();
  const decor = await fresh();
  decor.giftTick();
  clock.advance(20 * MIN);
  decor.giftTick();
  await flush();
  assert.equal(gifts().length, 1);
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
  state.data.bonds[pet.id] = { points: 500 };
  decor.thanksTick(1);
  decor.thanksTick(1e9);
  await flush();
  assert.equal(calls.length, 0, 'not on a day the person did nothing with it');
  clock.together();
  state.data.bonds[pet.id].points = 0;
  const tick = async now => {
    decor.thanksTick(now);
    await flush();
  };
  await tick(0);
  await tick(1e9);
  assert.equal(calls.length, 0, 'level 1 brings none');
  state.data.bonds[pet.id] = { ...state.data.bonds[pet.id], points: 500 };
  await tick(2e9);
  assert.deepEqual(calls, [['thanks', pet.id, 4]], 'a friend already at 4 brings one gift, for 4');
  await tick(3e9);
  assert.equal(calls.length, 1, 'once a level');
  state.data.bonds[pet.id] = { ...state.data.bonds[pet.id], points: 1000 };
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
  const clock = fixture(t);
  const decor = await fresh();
  state.data.garden.thanked = { [pet.id]: 2 };
  clock.together();
  state.data.bonds[pet.id].points = 500;
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

test('no thanks gift is asked for while another gift is on its way', async t => {
  const clock = fixture(t);
  const decor = await fresh();
  clock.together();
  state.data.bonds[pet.id].points = 500;
  decor.thanksTick(1);
  // Both before the first answer comes back: the second waits.
  decor.thanksTick(1e9);
  decor.thanksTick(2e9);
  assert.equal(calls.length, 1);
  await flush();
  assert.deepEqual(calls, [['thanks', pet.id, 4]]);
});

test('during the winter lights the gift asks for them in the garden workshop too', async t => {
  for (const [start, giftDay, expected] of [
    [new Date(2026, 11, 15, 12), '2026-12-01', ['lights']],
    [new Date(2026, 3, 5, 12), '2026-03-20', [null]],
  ]) {
    await t.test(`${start.toDateString()}`, async t => {
      const clock = fixture(t, start);
      const before = { world: scene.world, event: scene.event };
      t.after(() => Object.assign(scene, before));
      state.data.garden.giftDay = giftDay;
      scene.world = 'workshop';
      scene.event = null;
      clock.together();
      const decor = await fresh();
      decor.giftTick();
      clock.advance(20 * MIN);
      decor.giftTick();
      await flush();
      assert.deepEqual(events, expected);
    });
  }
});
