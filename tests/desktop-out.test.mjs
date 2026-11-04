// Sending one friend or one gift out to the desktop: the yard's right-click menu has a check item for
// it, and a gift's menu puts it away too (src/core/controls.js; the backend is desktop/items.rs).

import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const calls = [];
globalThis.playPets = {
  setOnDesktop: async (...args) => {
    calls.push(['setOnDesktop', ...args]);
    return { ok: true, data: null };
  },
};
const { openDecorMenu, openFriendMenu, setupControls } = await import('../src/core/controls.js');
const state = await import('../src/core/state.js');
const flush = () => new Promise(resolve => setImmediate(resolve));

function menu(t, { pets = [], decor = [] } = {}) {
  keepGlobals(t, 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 600;
  globalThis.innerHeight = 400;
  installDom(t, { anyId: true });
  installStorage(t);
  const previous = state.data;
  state.setData({ pets, assets: [], garden: { decor, boxed: [], received: [] } });
  t.after(() => state.setData(previous));
  calls.length = 0;
  const context = document.getElementById('yard-context-menu');
  context.hidden = true;
  const item = (contextFor, contextAction, role = 'menuitem') => {
    const button = element('button', { dataset: { contextFor, contextAction } });
    button.setAttribute('role', role);
    button.append(element('span', { className: 'context-label' }));
    return button;
  };
  const all = [
    item('yard', 'scene'),
    item('friend', 'talk'),
    item('friend', 'play-friend'),
    item('friend', 'desktop-friend', 'menuitemcheckbox'),
    item('decor', 'desktop-decor', 'menuitemcheckbox'),
    item('decor', 'put-away'),
  ];
  context.querySelectorAll = () => all;
  context.querySelector = selector =>
    all.find(button => selector.includes(`"${button.dataset.contextAction}"`))?.children[0] || null;
  const shown = () => all.filter(button => !button.hidden).map(button => button.dataset.contextAction);
  const find = action => all.find(button => button.dataset.contextAction === action);
  return { context, shown, find };
}

test("a friend's menu sends just that friend out to the desktop, or brings it in", async t => {
  // The first time out says how things work there, in a toast that fades on a timer.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { context, shown, find } = menu(t, { pets: [{ id: 'miso', name: 'Miso', onDesktop: false }] });
  setupControls();
  openFriendMenu('miso', { x: 40, y: 40 });
  assert.deepEqual(shown(), ['talk', 'play-friend', 'desktop-friend']);
  assert.equal(find('desktop-friend').getAttribute('aria-checked'), 'false');
  await context.dispatch('click', { target: find('desktop-friend') });
  await flush();
  assert.deepEqual(calls, [['setOnDesktop', 'miso', true]]);
  assert.equal(localStorage.getItem('desktop-tip'), '1', 'said once, the first time');
  state.data.pets[0].onDesktop = true;
  openFriendMenu('miso', { x: 40, y: 40 });
  assert.equal(find('desktop-friend').getAttribute('aria-checked'), 'true');
  await context.dispatch('click', { target: find('desktop-friend') });
  await flush();
  assert.deepEqual(calls.at(-1), ['setOnDesktop', 'miso', false]);
});

test("a gift's menu sends it out to the desktop or puts it away", async t => {
  const { context, shown, find } = menu(t, { decor: [{ id: 'g1', kind: 'bench', x: 0.5, y: 0.5, onDesktop: true }] });
  const putAway = [];
  setupControls({ putAway: id => putAway.push(id) });
  openDecorMenu('g1', { x: 40, y: 40 });
  assert.equal(context.hidden, false);
  assert.deepEqual(shown(), ['desktop-decor', 'put-away']);
  assert.equal(find('desktop-decor').getAttribute('aria-checked'), 'true');
  await context.dispatch('click', { target: find('desktop-decor') });
  await flush();
  assert.deepEqual(calls, [['setOnDesktop', 'g1', false]]);
  openDecorMenu('g1', { x: 40, y: 40 });
  await context.dispatch('click', { target: find('put-away') });
  assert.deepEqual(putAway, ['g1']);
  assert.equal(context.hidden, true);
});
