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

test("the agent's state dot sits in the name tag, beside the name", t => {
  yard(t);
  setupViews({ select() {}, patted() {}, openChat() {} });
  syncViews();
  const { tag, tagName, dot } = views.get('p');
  assert.equal(dot.parentNode, tag);
  assert.equal(tag.children.indexOf(dot), tag.children.indexOf(tagName) + 1, 'right after the name');
});

test('a double-click on a friend is two pats, and talking is on its menu, not a double-click', async t => {
  const { pet } = yard(t);
  const opened = [];
  setupViews({
    select() {},
    patted() {},
    openChat: id => opened.push(['chat', id]),
    friendMenu: id => opened.push(['menu', id]),
  });
  syncViews();
  const v = views.get(pet.id);
  for (let i = 0; i < 2; i++) {
    await v.button.fire('pointerdown');
    await v.button.fire('pointerup');
  }
  await v.button.fire('dblclick');
  await flush();
  assert.deepEqual(opened, [], 'a double-click opens nothing');
  assert.deepEqual(calls, ['pat', 'pat']);
  await v.button.fire('contextmenu', { preventDefault() {}, clientX: 10, clientY: 10 });
  assert.deepEqual(opened, [['menu', pet.id]], 'the right-click menu has Talk to');
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

test('an arrow key moves the friend at once and saves where it stands', async t => {
  const { pet } = yard(t);
  setupViews({ select() {}, patted() {}, openChat() {} });
  syncViews();
  const v = views.get(pet.id),
    before = v.button.style.translate;
  await v.button.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(Math.round(v.x * 100), 34);
  assert.notEqual(v.button.style.translate, before, 'the friend is drawn where it went');
  assert.deepEqual(calls, ['move']);
});

test('holding a key down pats a friend once, not on every repeat', async t => {
  const { pet } = yard(t);
  setupViews({ select() {}, patted() {}, openChat() {} });
  syncViews();
  const v = views.get(pet.id);
  await v.button.dispatch('keydown', { key: 'Enter' });
  await v.button.dispatch('keydown', { key: 'Enter', repeat: true });
  await v.button.dispatch('keydown', { key: 'Enter', repeat: true });
  assert.deepEqual(calls, ['pat']);
});
