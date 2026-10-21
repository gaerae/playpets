import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage } from './support/dom.mjs';

const calls = [];
globalThis.playPets = {
  receiveGift: async () => {
    calls.push('gift');
    return { ok: false, error: 'Unable to save gift.' };
  },
  play: async () => {
    calls.push('pat');
    return { ok: true };
  },
  updatePet: async () => {
    calls.push('move');
    return { ok: true };
  },
};
const { setData, setGame, views } = await import('../src/core/state.js');
const { giftTick } = await import('../src/yard/decor.js');
const { setupViews, syncViews } = await import('../src/yard/views.js');

// Every node has the yard's size and fires pointer events at one spot unless `extra` moves them.
const pointer = {
  rect: { width: 1000, height: 600 },
  fire(type, extra = {}) {
    return this.dispatch(type, { button: 0, clientX: 100, clientY: 100, pointerId: 1, ...extra });
  },
  setPointerCapture() {},
  hasPointerCapture: () => false,
};
function yard(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const wallStart = new Date(2026, 0, 5, 12).getTime();
  t.mock.method(Date, 'now', () => wallStart + now);
  const { nodes } = installDom(t, { anyId: true, props: pointer });
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  // Every first-time tip has been seen, so none of them interrupts a press.
  installStorage(t, { getItem: () => '1', setItem() {} });
  calls.length = 0;
  views.clear();
  setGame(null);
  const pet = { id: 'p', name: 'Pip', size: 100, x: 0.3, y: 0.5 };
  const state = { pets: [pet], assets: [], statuses: {}, busy: [], garden: { giftDay: '', received: [], decor: [] } };
  setData(state);
  t.after(() => views.clear());
  return {
    state,
    pet,
    now: value => {
      now = value;
    },
    nodes,
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('a saved gift day ahead of the local clock does not request another gift', async t => {
  const { state, pet } = yard(t);
  state.garden.giftDay = '9999-12-31';
  views.set(pet.id, { pet, px: 100, py: 100, bubble: {} });
  giftTick(0);
  giftTick(300001);
  await flush();
  assert.deepEqual(calls, []);
});

test('a failed daily gift waits before retrying instead of celebrating every frame', async t => {
  const { pet, now } = yard(t);
  const bubble = { textContent: '' };
  views.set(pet.id, { pet, px: 100, py: 100, bubble });
  giftTick(0);
  now(300001);
  giftTick(300001);
  await flush();
  assert.deepEqual(calls, ['gift']);
  assert.equal(bubble.textContent, '', 'a rejected gift does not announce a successful delivery');
  for (let i = 1; i < 6; i++) {
    now(300001 + i * 40);
    giftTick(300001 + i * 40);
    await flush();
  }
  assert.deepEqual(calls, ['gift']);
  now(360001);
  giftTick(360001);
  await flush();
  assert.deepEqual(calls, ['gift', 'gift']);
});

test('a click on the name tag opens the conversation its tooltip promises', async t => {
  const { pet } = yard(t);
  const opened = [];
  setupViews({
    select() {},
    patted() {},
    openChat: id => opened.push(['chat', id]),
    openActions: id => opened.push(['play', id]),
  });
  syncViews();
  const v = views.get(pet.id);
  const tag = { closest: selector => (selector === '.pet-tag' ? tag : null) };
  await v.button.fire('pointerdown', { target: tag });
  await v.button.fire('pointerup', { target: tag });
  assert.deepEqual(opened, [['chat', pet.id]]);
  assert.deepEqual(calls, [], 'talking is not a pat');
});

for (const moved of [false, true])
  test(`cancelling a ${moved ? 'drag' : 'press'} neither pats nor saves the friend`, async t => {
    const { pet } = yard(t);
    setupViews({ select() {}, patted() {}, openChat() {} });
    syncViews();
    const v = views.get(pet.id),
      original = { x: v.x, y: v.y };
    await v.button.fire('pointerdown');
    if (moved) await v.button.fire('pointermove', { clientX: 200 });
    await v.button.fire('pointercancel');
    assert.deepEqual(calls, []);
    assert.equal(v.drag, null);
    assert.deepEqual({ x: v.x, y: v.y }, original);
    assert.equal(v.button.classList.contains('pressed'), false);
  });
