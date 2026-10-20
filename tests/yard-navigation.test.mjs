import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('one Play board owns four primary actions and the original action buttons at every size', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const strip = html.split('id="play-actions"')[1]?.split('</div>')[0] || '';
  assert.equal((strip.match(/<button/g) || []).length, 4);
  for (const id of ['dig-tool', 'play-garden-button', 'fish-tool', 'games-button'])
    assert.ok(strip.includes(`id="${id}"`));
  assert.doesNotMatch(html, /id="quick-play"|data-quick-tool|class="play-toolbar"/);
  for (const id of ['feed', 'chatter', 'plant-tool', 'tree-tool', 'album-button', 'games-menu'])
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id} has one real control`);
});

import { closeControls, openPlay, setupControls } from '../src/core/controls.js';
import { setData, setSelected } from '../src/core/state.js';
import { element, installDom, keepGlobals } from './support/dom.mjs';

function fixture(t) {
  keepGlobals(t, 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 300;
  globalThis.innerHeight = 210;
  const dom = installDom(t, { anyId: true });
  const lookup = document.getElementById;
  document.getElementById = id => (id === 'quick-play' ? null : lookup(id));
  setData({ pets: [{ id: 'friend', name: 'Daisy' }], assets: [] });
  setSelected('friend');
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
  node('play-panel').querySelector = () => node('dig-tool');
  node('yard-controls-panel').querySelector = () => node('menu-friends');
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
  assert.equal(document.activeElement, node('dig-tool'));
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

test('small and large windows open the same board and actual actions run once', async t => {
  const { node } = fixture(t);
  document.body.classList.add('compact');
  setupControls();
  openPlay();
  assert.equal(node('play-panel').hidden, false);
  assert.equal(node('play-title').textContent.includes('Daisy'), true);
  let digs = 0;
  const action = node('dig-tool');
  action.localName = 'button';
  action.addEventListener('click', () => digs++);
  await action.dispatch('click');
  await node('play-panel').dispatch('click', { target: action });
  assert.equal(digs, 1, 'the board uses the actual action instead of a proxy click');
  assert.equal(node('play-panel').hidden, true);
  openPlay();
  await node('play-panel').dispatch('keydown', { key: 'Escape' });
  assert.equal(node('play-panel').hidden, true);
  document.body.classList.remove('compact');
  openPlay();
  assert.equal(node('play-panel').hidden, false);
  assert.equal(document.getElementById('quick-play'), null);
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

test('group games use an inline board view and Stop calls the supplied action directly', async t => {
  const { node } = fixture(t);
  const { setGame } = await import('../src/core/state.js');
  t.after(() => setGame(null));
  let stops = 0;
  setupControls({ stopGame: () => stops++ });
  openPlay();
  const button = node('games-button');
  button.localName = 'button';
  await node('play-panel').dispatch('click', { target: button });
  assert.equal(node('play-games').hidden, false);
  assert.equal(node('play-actions').hidden, true);
  setGame({ kind: 'parade' });
  closeControls();
  openPlay();
  await node('play-panel').dispatch('click', { target: button });
  assert.equal(stops, 1);
  assert.equal(node('play-panel').hidden, true);
});

test('Play refreshes the real controls before exposing its first view', t => {
  const { node } = fixture(t);
  node('dig-tool').disabled = true;
  setupControls({
    beforeOpen: () => {
      node('dig-tool').disabled = false;
    },
  });
  openPlay();
  assert.equal(node('dig-tool').disabled, false);
});

test('opening Menu returns its active page scroller to the beginning', async t => {
  const { node } = fixture(t);
  const scroll = element('div', { className: 'management-page', scrollTop: 120 });
  node('yard-controls-panel').append(scroll);
  setupControls();
  const { openControls } = await import('../src/core/controls.js');
  openControls();
  assert.equal(scroll.scrollTop, 0);
});

test('management tabs keep one visible page and support predictable arrow navigation', async t => {
  const { node } = fixture(t);
  const tabs = ['friends', 'settings', 'window'].map(name => {
    const tab = element('button', { dataset: { managementTab: name } });
    tab.setAttribute('data-management-tab', name);
    document.body.append(tab);
    node(`management-${name}`).hidden = name !== 'friends';
    return tab;
  });
  setupControls();
  await tabs[1].dispatch('click');
  assert.equal(node('management-settings').hidden, false);
  assert.equal(node('management-friends').hidden, true);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  await tabs[1].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, tabs[2]);
  assert.equal(node('management-window').hidden, false);
  assert.equal(node('management-settings').hidden, true);
  await tabs[2].dispatch('keydown', { key: 'Home' });
  assert.equal(document.activeElement, tabs[0]);
  assert.equal(node('management-friends').hidden, false);
});

test('management click bubbling preserves the task details opened by its destination', async t => {
  const { node } = fixture(t);
  setupControls();
  const destination = element('button');
  destination.setAttribute('data-panel', 'settings');
  // The destination already closed management and opened its inline update task.
  node('yard-controls-panel').hidden = true;
  node('side-panel').hidden = false;
  node('update-dialog').hidden = false;
  await node('yard-controls-panel').dispatch('click', { target: destination, detail: 0 });
  assert.equal(node('update-dialog').hidden, false);
  assert.equal(node('side-panel').hidden, false);
});
