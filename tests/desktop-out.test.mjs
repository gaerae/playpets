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
const { openDecorMenu, openFriendMenu, openPlantMenu, openTreeMenu, setupControls } =
  await import('../src/core/controls.js');
const state = await import('../src/core/state.js');
const flush = () => new Promise(resolve => setImmediate(resolve));

function menu(t, { pets = [], decor = [], plants = [], trees = [] } = {}) {
  keepGlobals(t, 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 600;
  globalThis.innerHeight = 400;
  installDom(t, { anyId: true });
  installStorage(t);
  const previous = state.data;
  state.setData({ pets, assets: [], garden: { decor, plants, trees, boxed: [], received: [] } });
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
    item('decor', 'dress-decor'),
    item('decor', 'put-away'),
    item('plant', 'desktop-plant', 'menuitemcheckbox'),
    item('plant', 'pull-plant'),
    item('tree', 'desktop-tree', 'menuitemcheckbox'),
    item('tree', 'remove-tree'),
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

// Everything the yard shows can go out on the desktop, a snowman too (the overlay draws what it
// wears); only a snowman has things to wear.
test("a snowman's menu dresses it and sends it out as any gift's does; a bench's has nothing to wear", async t => {
  const { context, shown, find } = menu(t, {
    decor: [
      { id: 's', kind: 'snowman', x: 0.5, y: 0.7 },
      { id: 'g1', kind: 'bench', x: 0.5, y: 0.5 },
    ],
  });
  const dressed = [];
  setupControls({ dress: id => dressed.push(id), canDress: id => id === 's' });
  openDecorMenu('s', { x: 40, y: 40 });
  assert.deepEqual(shown(), ['desktop-decor', 'dress-decor', 'put-away']);
  await context.dispatch('click', { target: find('dress-decor') });
  assert.deepEqual(dressed, ['s']);
  assert.equal(context.hidden, true);
  setupControls();
  openDecorMenu('g1', { x: 40, y: 40 });
  assert.deepEqual(shown(), ['desktop-decor', 'put-away']);
});

// A flower and a planted tree have a menu as a gift does: out to the desktop, or pulled up.
test("a flower's and a planted tree's menus send them out or pull them up", async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { context, shown, find } = menu(t, {
    plants: [{ id: 'p1', kind: 'tulip', x: 0.5, y: 0.5, planted: 1 }],
    trees: [{ id: 't1', kind: 'cherry', world: 'meadow', x: 0.4, y: 0.4, planted: 1, stage: 2, onDesktop: true }],
  });
  const pulled = [],
    removed = [];
  setupControls({ pullPlant: id => pulled.push(id), removeTree: id => removed.push(id) });
  openPlantMenu('p1', { x: 40, y: 40 });
  assert.equal(context.hidden, false);
  assert.deepEqual(shown(), ['desktop-plant', 'pull-plant']);
  assert.equal(find('desktop-plant').getAttribute('aria-checked'), 'false');
  await context.dispatch('click', { target: find('desktop-plant') });
  await flush();
  assert.deepEqual(calls, [['setOnDesktop', 'p1', true]]);
  openPlantMenu('p1', { x: 40, y: 40 });
  await context.dispatch('click', { target: find('pull-plant') });
  assert.deepEqual(pulled, ['p1']);
  assert.equal(context.hidden, true);
  openTreeMenu('t1', { x: 40, y: 40 });
  assert.deepEqual(shown(), ['desktop-tree', 'remove-tree']);
  assert.equal(find('desktop-tree').getAttribute('aria-checked'), 'true');
  await context.dispatch('click', { target: find('desktop-tree') });
  await flush();
  assert.deepEqual(calls.at(-1), ['setOnDesktop', 't1', false]);
  openTreeMenu('t1', { x: 40, y: 40 });
  await context.dispatch('click', { target: find('remove-tree') });
  assert.deepEqual(removed, ['t1']);
  assert.deepEqual(pulled, ['p1'], 'a tree is not pulled as a flower is');
});
