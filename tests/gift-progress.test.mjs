import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, fakeStorage, installDom, installStorage } from './support/dom.mjs';

const calls = [];
let failGift = false;
globalThis.playPets = {
  receiveGift: async (_x, _y, day) => {
    calls.push(day);
    if (failGift) return { ok: false, error: 'fixture failure' };
    state.data.garden.giftDay = day;
    return { ok: true, data: { id: 'gift', kind: 'future_gift', x: 0.5, y: 0.5 } };
  },
  befriend: async () => ({ ok: true, data: {} }),
};
const state = await import('../src/core/state.js');
const { measureYard } = await import('../src/yard/field.js');
const { localDay } = await import('../src/yard/growth.js');
let imports = 0;
const fresh = () => import(`../src/yard/decor.js?gift-progress=${++imports}`);
const flush = () => new Promise(resolve => setImmediate(resolve));
const MIN = 60_000;
const profile = '/profiles/gift-test/pets';
const key = `gift-progress:${profile}`;
function fixture(t, storage = fakeStorage()) {
  let wall = new Date(2026, 0, 5, 12).getTime(),
    monotonic = 0;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(Date, 'now', () => wall);
  t.mock.method(performance, 'now', () => monotonic);
  t.mock.method(Math, 'random', () => 0);
  installDom(t, { anyId: true });
  installStorage(t, storage);
  document.getElementById('yard').getBoundingClientRect = () => ({ width: 1000, height: 700 });
  measureYard();
  calls.length = 0;
  failGift = false;
  const previous = state.data;
  const pet = { id: 'gift-friend', size: 100 };
  state.setData({
    pets: [pet],
    assets: [],
    petFolders: { downloaded: profile },
    garden: { giftDay: '2026-01-04', received: ['bench'], decor: [] },
  });
  state.views.clear();
  state.views.set(pet.id, { pet, px: 100, py: 400, bubble: element('span') });
  t.after(() => {
    state.views.clear();
    state.setData(previous);
  });
  return {
    storage,
    advance(ms) {
      wall += ms;
    },
    performance(value) {
      monotonic = value;
    },
    get now() {
      return wall;
    },
  };
}

test('gift wait survives repeated ten-minute sessions and performance clock resets', async t => {
  const clock = fixture(t);
  (await fresh()).giftTick(0);
  clock.advance(10 * MIN);
  clock.performance(10 * MIN);
  (await fresh()).giftTick(0);
  await flush();
  assert.equal(calls.length, 0);
  clock.advance(10 * MIN + 1);
  clock.performance(0);
  (await fresh()).giftTick(0);
  await flush();
  assert.equal(calls.length, 1);
  for (let i = 0; i < 3; i++) (await fresh()).giftTick(1e12);
  await flush();
  assert.equal(calls.length, 1, 'one gift for the whole yard on the same local date');
});

test('full decor capacity keeps overdue gift progress across a restart', async t => {
  const clock = fixture(t);
  state.data.garden.decor = Array.from({ length: 12 }, (_, id) => ({ id, kind: 'bench', x: 0.5, y: 0.5 }));
  (await fresh()).giftTick(0);
  clock.advance(25 * MIN);
  (await fresh()).giftTick(1e12);
  await flush();
  assert.equal(calls.length, 0);
  state.data.garden.decor = [];
  (await fresh()).giftTick(0);
  await flush();
  assert.equal(calls.length, 1);
});

test('failed gift saves persist a sixty-second retry instead of retrying every frame or launch', async t => {
  const clock = fixture(t);
  failGift = true;
  (await fresh()).giftTick(0);
  clock.advance(20 * MIN);
  (await fresh()).giftTick(0);
  await flush();
  assert.equal(calls.length, 1);
  clock.advance(30_000);
  const retry = await fresh();
  for (let i = 0; i < 5; i++) retry.giftTick(1e12);
  await flush();
  assert.equal(calls.length, 1);
  clock.advance(30_000);
  (await fresh()).giftTick(0);
  await flush();
  assert.equal(calls.length, 2);
});

test('wall time owns deadlines and an unrelated profile never inherits overdue progress', async t => {
  const clock = fixture(t);
  const module = await fresh();
  module.giftTick(0);
  clock.performance(1e12);
  module.giftTick(1e12);
  await flush();
  assert.equal(calls.length, 0);
  clock.advance(25 * MIN);
  state.data.petFolders.downloaded = '/profiles/other/pets';
  (await fresh()).giftTick(0);
  await flush();
  assert.equal(calls.length, 0);
  state.data.petFolders.downloaded = profile;
  (await fresh()).giftTick(0);
  await flush();
  assert.equal(calls.length, 1);
});

test('malformed and distant future deadlines recover within the normal wait', async t => {
  for (const saved of ['not json', 'null', '{"dueAt":"later"}', 'future']) {
    await t.test(saved, async t => {
      const clock = fixture(t);
      clock.storage.setItem(
        key,
        saved === 'future' ? JSON.stringify({ after: '2026-01-04', dueAt: clock.now + 10 * 86400_000 }) : saved,
      );
      (await fresh()).giftTick(0);
      const repaired = JSON.parse(clock.storage.getItem(key));
      assert.ok(Number.isSafeInteger(repaired.dueAt));
      assert.ok(repaired.dueAt <= clock.now + 40 * MIN);
      clock.advance(20 * MIN);
      (await fresh()).giftTick(0);
      await flush();
      assert.equal(calls.length, 1);
    });
  }
});

test('unavailable storage still permits in-session progress and first gift keeps its five-minute wait', async t => {
  const clock = fixture(t, {
    getItem() {
      throw Error('unavailable');
    },
    setItem() {
      throw Error('unavailable');
    },
  });
  state.data.garden.giftDay = '';
  state.data.garden.received = [];
  const module = await fresh();
  module.giftTick(0);
  clock.advance(5 * MIN - 1);
  module.giftTick(1e12);
  await flush();
  assert.equal(calls.length, 0);
  clock.advance(1);
  module.giftTick(0);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0], localDay(new Date(clock.now)));
});
