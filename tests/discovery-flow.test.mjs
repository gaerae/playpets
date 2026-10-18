import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const commands = [];
let resolveDig;
globalThis.playPets = {
  dig: async (...args) => {
    commands.push(args);
    return new Promise(resolve => {
      resolveDig = resolve;
    });
  },
};
const { sendDiscovery, setupDiscovery, beginDiscovery, cancelDiscovery } = await import('../src/yard/discovery.js');
const state = await import('../src/core/state.js');
const { setData, setSelected, views } = state;
const { measureYard } = await import('../src/yard/field.js');
const { release } = await import('../src/yard/trips.js');
const { useWorlds } = await import('../src/yard/worlds.js');
const { scene } = await import('../src/yard/world.js');

function fixture(t) {
  let v;
  t.after(() => {
    if (v) release(v);
    views.clear();
    cancelDiscovery();
  });
  installDom(t, { anyId: true });
  installStorage(t);
  keepGlobals(t, 'setTimeout', 'clearTimeout');
  const timers = [];
  globalThis.setTimeout = fn => {
    timers.push(fn);
    return timers.length;
  };
  globalThis.clearTimeout = () => {};
  document.getElementById('yard').getBoundingClientRect = () => ({ width: 1000, height: 700, left: 0, top: 0 });
  measureYard();
  useWorlds([{ id: 'woodland', capabilities: { soil: true, sky: true, fishing: false }, geometry: { fieldTop: 0.6 } }]);
  scene.world = 'woodland';
  const pet = { id: 'friend', size: 112, name: 'Clover' };
  v = { pet, px: 200, py: 400, x: 0.2, y: 0.5, pose: 'idle', bubble: element('span') };
  views.clear();
  views.set(pet.id, v);
  setData({
    pets: [pet],
    garden: { plants: [], decor: [], trees: [] },
    album: { treasures: {} },
    statuses: {},
    busy: [],
  });
  setSelected(pet.id);
  commands.length = 0;
  return { v, timers };
}

test('walking or cancelling before arrival never rolls or awards a discovery', async t => {
  const { v } = fixture(t);
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const trip = v.trip;
  assert.ok(v.target);
  assert.equal(commands.length, 0);
  release(v);
  await trip.arrive();
  assert.equal(commands.length, 0);
});

test('arrival commits once and cancellation during the backend wait removes presentation only', async t => {
  const { v } = fixture(t);
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  v.trip = null;
  v.target = null;
  const pending = arrive();
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].slice(0, 4), ['friend', 'woodland', 0.5, 0.5]);
  assert.equal(commands[0][4].soil, true);
  const effect = document.getElementById('yard').children.at(-1);
  release(v);
  resolveDig({ ok: true, data: { outcome: 'empty', attemptId: 'once' } });
  await pending;
  assert.equal(commands.length, 1);
  assert.equal(effect.removed, true);
  assert.equal(v.doing, null);
  assert.equal(v.bubble.textContent, '');
});

test('ground selection refuses sky clicks and Escape cancels the armed tool', async t => {
  const { v } = fixture(t);
  setupDiscovery();
  beginDiscovery('dig');
  assert.equal(state.aiming, 'dig');
  await document.getElementById('yard').dispatch('click', { clientX: 500, clientY: 20 });
  assert.equal(v.trip, undefined);
  assert.equal(commands.length, 0);
  await document.dispatch('keydown', { key: 'Escape' });
  assert.equal(state.aiming, false);
  assert.equal(document.getElementById('discovery-target').hidden, true);
});

test('a layout change cancels a discovery trip before stale geometry can award it', async t => {
  const { v } = fixture(t);
  const { cancelDiscoveryWork } = await import('../src/yard/discovery.js');
  sendDiscovery(v, { x: 0.5, y: 0.5 }, 'dig');
  const arrive = v.trip.arrive;
  cancelDiscoveryWork();
  await arrive();
  assert.equal(v.target, null);
  assert.equal(commands.length, 0);
});
