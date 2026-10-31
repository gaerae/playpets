import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('one Play board shows Find, Garden and Together on one page, each action once', async () => {
  const html = await readFile('src/index.html', 'utf8');
  const row = id => html.split(`id="${id}"`)[1]?.split('</div>')[0] || '';
  const ids = id => [...row(id).matchAll(/<button id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids('play-actions'), ['dig-tool', 'fish-tool', 'album-button']);
  assert.deepEqual(ids('play-garden'), ['plant-tool', 'tree-tool', 'feed']);
  assert.match(html, /id="play-games" class="play-actions"><div id="games-menu"[^>]*><\/div><button id="chatter"/);
  assert.doesNotMatch(
    html,
    /id="quick-play"|data-quick-tool|class="play-toolbar"|id="games-button"|id="play-garden-button"/,
  );
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
  const first = element('button', { dataset: { contextFor: 'yard' } });
  first.setAttribute('role', 'menuitem');
  const pin = element('button', { dataset: { contextAction: 'pin', contextFor: 'yard' } });
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
  const body = element('div', { className: 'dock-panel-body' });
  body.querySelectorAll = () => [hiddenInvite, visibleAction];
  node('play-panel').querySelectorAll = () => [hiddenInvite, visibleAction];
  node('play-panel').querySelector = selector =>
    selector === '.dock-panel-body' ? body : selector === '.playing' ? null : hiddenInvite;
  setupControls();
  openPlay();
  assert.equal(document.activeElement, visibleAction);
});

test('Play opened during a game lands on the game, the thing to stop', t => {
  const { node } = fixture(t);
  const first = element('button', { getClientRects: () => [{}] });
  const running = element('button');
  node('play-panel').querySelectorAll = () => [first, running];
  node('play-panel').querySelector = selector => (selector === '.playing' ? running : null);
  setupControls();
  openPlay();
  assert.equal(document.activeElement, running);
});

// Pressing the tiles is in game-lifecycle.test.mjs.
test('games are tiles on the Play page, with no page of their own to go back from', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.doesNotMatch(html, /data-play-back/);
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

test('opening Menu returns its page scroller to the beginning', async t => {
  const { node } = fixture(t);
  const scroll = element('div', { className: 'dock-panel-body', scrollTop: 120 });
  node('yard-controls-panel').append(scroll);
  node('yard-controls-panel').querySelectorAll = selector => (selector === '.dock-panel-body' ? [scroll] : []);
  setupControls();
  const { openControls } = await import('../src/core/controls.js');
  openControls();
  assert.equal(scroll.scrollTop, 0);
});

test('the right-click on a friend offers talking or playing with that friend', async t => {
  const { node, first, pin } = fixture(t);
  const talk = element('button', { dataset: { contextAction: 'talk', contextFor: 'friend' } });
  const play = element('button', { dataset: { contextAction: 'play-friend', contextFor: 'friend' } });
  const dig = element('button', { dataset: { contextAction: 'dig-friend', contextFor: 'friend' } });
  for (const item of [talk, play, dig]) {
    item.setAttribute('role', 'menuitem');
    item.append(element('span', { className: 'context-label' }));
  }
  const all = [first, pin, talk, play, dig];
  node('yard-context-menu').querySelectorAll = () => all;
  node('yard-context-menu').querySelector = selector =>
    all.find(item => selector.includes(`"${item.dataset.contextAction}"`))?.children[0] || null;
  const chats = [];
  setupControls({ openChat: id => chats.push(id) });
  const { openFriendMenu } = await import('../src/core/controls.js');
  openFriendMenu('friend', { x: 40, y: 40 });
  assert.equal(node('yard-context-menu').hidden, false);
  assert.deepEqual(
    all.filter(item => !item.hidden).map(item => item.dataset.contextAction),
    ['talk', 'play-friend', 'dig-friend'],
  );
  assert.match(talk.children[0].textContent, /Daisy/);
  assert.match(dig.children[0].textContent, /Daisy/);
  await node('yard-context-menu').dispatch('click', { target: talk });
  assert.deepEqual(chats, ['friend']);
  const digs = [];
  setupControls({ digWith: id => digs.push(id) });
  openFriendMenu('friend', { x: 40, y: 40 });
  await node('yard-context-menu').dispatch('click', { target: dig });
  assert.deepEqual(digs, ['friend'], 'asking a friend to dig picks up the tool for that friend');
  await node('yard').dispatch('contextmenu', { clientX: 20, clientY: 20 });
  assert.deepEqual(
    all.filter(item => !item.hidden).map(item => item.dataset.contextAction),
    [undefined, 'pin'],
    'the scenery shows its own items again',
  );
});

test('in a small window the corner button opens and closes the scenery menu', async t => {
  const { node } = fixture(t);
  document.body.classList.add('compact');
  setupControls();
  const launcher = node('compact-launcher');
  launcher.getBoundingClientRect = () => ({ right: 292, top: 166 });
  await launcher.dispatch('click');
  assert.equal(node('yard-context-menu').hidden, false);
  assert.equal(launcher.getAttribute('aria-expanded'), 'true');
  await launcher.dispatch('pointerdown');
  await document.dispatch('pointerdown', { target: launcher });
  await launcher.dispatch('click');
  assert.equal(node('yard-context-menu').hidden, true, 'a second press closes instead of reopening');
  assert.equal(launcher.getAttribute('aria-expanded'), 'false');
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

test('a right-click on bare ground offers digging there, and the scenery elsewhere does not', async t => {
  const { node, first, pin } = fixture(t);
  const dig = element('button', { dataset: { contextAction: 'dig-here', contextFor: 'yard' } });
  dig.setAttribute('role', 'menuitem');
  const all = [dig, first, pin];
  node('yard-context-menu').querySelectorAll = () => all;
  node('yard-context-menu').querySelector = selector => (selector.includes('dig-here') ? dig : null);
  const dug = [];
  setupControls({ canDigAt: (_x, y) => y > 100, digAt: (x, y) => dug.push([x, y]) });
  await node('yard').dispatch('contextmenu', { clientX: 40, clientY: 50 });
  assert.equal(dig.hidden, true, 'the sky has nothing to dig');
  await document.dispatch('pointerdown', { target: node('yard') });
  await node('yard').dispatch('contextmenu', { clientX: 40, clientY: 150 });
  assert.equal(dig.hidden, false);
  await node('yard-context-menu').dispatch('click', { target: dig });
  assert.deepEqual(dug, [[40, 150]]);
});
