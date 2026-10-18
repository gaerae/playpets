import assert from 'node:assert/strict';
import test from 'node:test';
import { closeControls, openPlay, setupControls } from '../src/core/controls.js';
import { element, installDom, keepGlobals } from './support/dom.mjs';

function fixture(t) {
  keepGlobals(t, 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 300;
  globalThis.innerHeight = 210;
  const dom = installDom(t, { anyId: true });
  const node = id => document.getElementById(id);
  for (const id of [
    'yard-controls-panel',
    'play-panel',
    'yard-context-menu',
    'scene-menu',
    'side-panel',
    'update-dialog',
  ])
    node(id).hidden = true;
  node('yard-context-menu').getBoundingClientRect = () => ({ width: 244, height: 194 });
  const first = element('button');
  first.setAttribute('role', 'menuitem');
  const pin = element('button', { dataset: { contextAction: 'pin' } });
  pin.setAttribute('role', 'menuitemcheckbox');
  node('yard-context-menu').append(first, pin);
  node('yard-context-menu').querySelectorAll = () => [first, pin];
  node('play-panel').querySelector = () => node('feed');
  node('yard-controls-panel').querySelector = () => node('menu-scene');
  return { ...dom, node, first, pin };
}

test('Play is a separate destination and closes competing surfaces without hiding its tools', async t => {
  const { node } = fixture(t);
  setupControls();
  node('yard-controls-panel').hidden = false;
  node('scene-menu').hidden = false;
  node('update-dialog').hidden = false;
  openPlay();
  assert.equal(node('play-panel').hidden, false);
  for (const id of ['yard-controls-panel', 'scene-menu', 'update-dialog']) assert.equal(node(id).hidden, true, id);
  assert.equal(document.activeElement, node('feed'));
  document.body.classList.add('compact');
  closeControls();
  assert.equal(node('play-panel').hidden, true);
  assert.equal(document.activeElement, node('yard'));
  await node('yard').dispatch('contextmenu', { clientX: 20, clientY: 20 });
  await document.dispatch('pointerdown', { target: node('yard') });
  assert.equal(node('yard-context-menu').hidden, true, 'a click on empty scenery dismisses the pointer menu');
});

test('right click opens a bounded short menu, supports checked items and restores visible focus', async t => {
  const { node, first, pin } = fixture(t);
  document.body.classList.add('compact');
  setupControls();
  await node('yard').dispatch('click');
  assert.equal(node('yard-context-menu').hidden, true, 'ordinary clicks never open the context menu');
  await node('yard').dispatch('contextmenu', { clientX: 299, clientY: 209 });
  assert.equal(node('yard-context-menu').hidden, false);
  assert.equal(node('yard-controls-panel').hidden, true);
  assert.equal(node('yard-context-menu').style.left, '48px');
  assert.equal(node('yard-context-menu').style.top, '8px');
  assert.equal(document.activeElement, first);
  await node('yard-context-menu').dispatch('keydown', { key: 'End' });
  assert.equal(document.activeElement, pin);
  await node('yard-context-menu').dispatch('keydown', { key: 'Home' });
  assert.equal(document.activeElement, first);
  let toggles = 0;
  node('always-on-top').click = () => toggles++;
  await node('yard-context-menu').dispatch('click', { target: pin });
  assert.equal(toggles, 1);
  assert.equal(node('yard-context-menu').hidden, true);
  assert.equal(document.activeElement, node('yard'));
});

test('small-window play opens a brief action strip, executes once and returns to scenery', async t => {
  const { node } = fixture(t);
  node('quick-play').hidden = true;
  document.body.classList.add('compact');
  setupControls();
  openPlay();
  assert.equal(node('quick-play').hidden, false);
  assert.equal(node('play-panel').hidden, true, 'small-window play never opens the large activity panel');
  let picnics = 0;
  node('feed').click = () => picnics++;
  const action = element('button', { dataset: { quickTool: 'feed' } });
  await node('quick-play').dispatch('click', { target: action });
  assert.equal(picnics, 1);
  assert.equal(node('quick-play').hidden, true);
  assert.equal(document.activeElement, node('yard'));
  openPlay();
  await node('quick-play').dispatch('keydown', { key: 'Escape' });
  assert.equal(node('quick-play').hidden, true);
  document.body.classList.remove('compact');
  openPlay();
  assert.equal(node('quick-play').hidden, true);
  assert.equal(node('play-panel').hidden, false, 'larger windows keep the full activity destination');
});

test('the Play trigger toggles closed across the actual pointerdown and click sequence', async t => {
  const { node } = fixture(t);
  setupControls();
  openPlay();
  await document.dispatch('pointerdown', { target: node('play-button') });
  await node('play-button').dispatch('click');
  assert.equal(node('play-panel').hidden, true);
});

test('opening Play skips invitation controls in a collapsed empty-state section', t => {
  const { node } = fixture(t);
  const hiddenInvite = element('button', { getClientRects: () => [] });
  const visibleAction = element('button', { getClientRects: () => [{}] });
  node('play-panel').querySelectorAll = () => [hiddenInvite, visibleAction];
  node('play-panel').querySelector = () => hiddenInvite;
  setupControls();
  openPlay();
  assert.equal(document.activeElement, visibleAction);
});

test('an active game offers Stop without an empty Explore branch in small windows', async t => {
  const { node } = fixture(t);
  const { setGame } = await import('../src/core/state.js');
  t.after(() => setGame(null));
  setGame({ kind: 'parade' });
  document.body.classList.add('compact');
  setupControls();
  openPlay();
  assert.equal(node('quick-play-explore-button').hidden, true);
  assert.match(node('quick-play-games-label').textContent, /Stop/);
});

test('Play refreshes availability before copying its small-window actions', async t => {
  const { node } = fixture(t);
  const state = await import('../src/core/state.js');
  const before = state.data;
  t.after(() => state.setData(before));
  state.setData({ ...before, pets: [{ id: 'friend' }] });
  document.body.classList.add('compact');
  const dig = element('button', { dataset: { quickTool: 'dig-tool' } });
  node('quick-play').querySelectorAll = () => [dig];
  node('dig-tool').disabled = true;
  setupControls({
    beforeOpen: () => {
      node('dig-tool').disabled = false;
    },
  });
  openPlay();
  assert.equal(dig.disabled, false);
});
