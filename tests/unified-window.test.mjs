import assert from 'node:assert/strict';
import test from 'node:test';
import { element, installDom, keepGlobals } from './support/dom.mjs';

const calls = [];
globalThis.playPets = Object.fromEntries(
  [
    'windowFullscreen',
    'windowIsFullscreen',
    'windowAlwaysOnTop',
    'windowResize',
    'windowDrag',
    'windowHide',
    'quitApp',
  ].map(name => [
    name,
    async (...args) => {
      calls.push([name, ...args]);
      return { ok: true, data: args[0] };
    },
  ]),
);
const windowUi = await import('../src/window.js');
const { setData } = await import('../src/core/state.js');

function page(t) {
  keepGlobals(t, 'window', 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 1180;
  globalThis.innerHeight = 850;
  globalThis.window = element();
  const { document, nodes } = installDom(t);
  for (const id of [
    'fullscreen',
    'fullscreen-label',
    'always-on-top',
    'window-drag',
    'hide-window',
    'yard',
    'yard-controls-toggle',
    'yard-controls-panel',
  ])
    nodes.set(id, element('button', { id, hidden: id === 'yard-controls-panel' }));
  for (const direction of ['North', 'NorthEast', 'East', 'SouthEast', 'South', 'SouthWest', 'West', 'NorthWest']) {
    const grip = element('div', { dataset: { resize: direction } });
    document.body.append(grip);
  }
  for (const id of ['menu-quit', 'confirm-dialog', 'confirm-title', 'confirm-body', 'confirm-ok', 'confirm-cancel'])
    nodes.set(id, element('button', { id }));
  setData({ pets: [], alwaysOnTop: false });
  calls.length = 0;
  return { document, nodes };
}

test('pinning works without friends and never resizes or changes the current layout', async t => {
  const { document, nodes } = page(t);
  assert.equal(typeof windowUi.setAlwaysOnTop, 'function');
  windowUi.setupWindow();
  await nodes.get('always-on-top').onclick();
  assert.deepEqual(calls, [['windowAlwaysOnTop', true]]);
  assert.equal(nodes.get('always-on-top').getAttribute('aria-pressed'), 'true');
  assert.equal(document.body.classList.contains('compact'), false);
  await nodes.get('always-on-top').onclick();
  assert.deepEqual(calls.at(-1), ['windowAlwaysOnTop', false]);
  assert.equal(nodes.get('always-on-top').getAttribute('aria-pressed'), 'false');
});

test('closing only hides the window and quitting acts at once, like the tray and the menu bar', async t => {
  const { nodes } = page(t);
  windowUi.setupWindow();
  await nodes.get('hide-window').onclick();
  assert.deepEqual(calls, [['windowHide']]);
  calls.length = 0;
  await nodes.get('menu-quit').onclick();
  assert.deepEqual(calls, [['quitApp']]);
});

test('small layout follows viewport size independently of pinning', async t => {
  const { document } = page(t);
  windowUi.setupWindow();
  globalThis.innerWidth = 460;
  globalThis.innerHeight = 320;
  await window.dispatch('resize');
  assert.equal(document.body.classList.contains('compact'), true);
  assert.deepEqual(calls, [], 'resizing does not invoke a native mode or pin command');
  globalThis.innerWidth = 1180;
  globalThis.innerHeight = 400;
  await window.dispatch('resize');
  assert.equal(document.body.classList.contains('compact'), true);
  globalThis.innerHeight = 850;
  await window.dispatch('resize');
  assert.equal(document.body.classList.contains('compact'), false);
});

test('every frameless edge starts native resize only with the primary pointer', async t => {
  const { document } = page(t);
  windowUi.setupWindow();
  for (const grip of document.querySelectorAll('[data-resize]')) {
    await grip.dispatch('pointerdown', { button: 2 });
    assert.equal(calls.length, 0);
  }
  for (const grip of document.querySelectorAll('[data-resize]')) await grip.dispatch('pointerdown', { button: 0 });
  assert.deepEqual(
    calls.map(call => call.slice(0, 2)),
    [...document.querySelectorAll('[data-resize]')].map(grip => ['windowResize', grip.dataset.resize]),
  );
});

test('fullscreen toggles the shared menu label and Escape preserves other dismissals', async t => {
  const { document, nodes } = page(t);
  windowUi.setupWindow();
  await nodes.get('fullscreen').onclick();
  assert.deepEqual(calls.at(-1), ['windowFullscreen', true]);
  assert.equal(nodes.get('fullscreen').getAttribute('aria-pressed'), 'true');
  assert.equal(document.body.classList.contains('fullscreen'), true);
  const restoreLabel = nodes.get('fullscreen-label').textContent;
  await window.dispatch('keydown', { key: 'Escape', defaultPrevented: true });
  assert.deepEqual(calls.at(-1), ['windowFullscreen', true]);
  await window.dispatch('keydown', { key: 'Escape' });
  assert.deepEqual(calls.at(-1), ['windowFullscreen', false]);
  assert.equal(document.body.classList.contains('fullscreen'), false);
  assert.notEqual(nodes.get('fullscreen-label').textContent, restoreLabel);
  assert.equal(
    calls.some(([name]) => name === 'windowAlwaysOnTop'),
    false,
  );
});

test('fullscreen keeps the current state on failure and ignores duplicate transitions', async t => {
  const { nodes, document } = page(t);
  windowUi.setupWindow();
  const original = globalThis.playPets.windowFullscreen;
  t.after(() => {
    globalThis.playPets.windowFullscreen = original;
  });
  let finish;
  globalThis.playPets.windowFullscreen = () =>
    new Promise(resolve => {
      finish = resolve;
    });
  const pending = windowUi.setFullscreen(true);
  assert.equal(nodes.get('fullscreen').disabled, true);
  await windowUi.setFullscreen(false);
  finish({ ok: true, data: true });
  await pending;
  assert.equal(document.body.classList.contains('fullscreen'), true);
  assert.equal(nodes.get('fullscreen').disabled, false);
  globalThis.playPets.windowFullscreen = async () => ({ ok: false, error: 'Native transition failed' });
  await assert.rejects(windowUi.setFullscreen(false), /Native transition failed/);
  assert.equal(document.body.classList.contains('fullscreen'), true);
  assert.equal(nodes.get('fullscreen').disabled, false);
});

test('Escape closes a yard menu first and leaves an open dialog to its own handler', async t => {
  const { document, nodes } = page(t);
  windowUi.setupWindow();
  await windowUi.setFullscreen(true);
  calls.length = 0;
  nodes.get('yard-controls-panel').hidden = false;
  await window.dispatch('keydown', { key: 'Escape' });
  assert.equal(nodes.get('yard-controls-panel').hidden, true);
  assert.equal(document.activeElement, nodes.get('yard-controls-toggle'));
  assert.deepEqual(calls, []);
  const dialog = nodes.get('confirm-dialog');
  let cancelEvent;
  dialog.open = true;
  dialog.dispatchEvent = event => {
    cancelEvent = event;
    return false;
  };
  const query = document.querySelector.bind(document);
  document.querySelector = selector => (selector === 'dialog[open]' && dialog.open ? dialog : query(selector));
  await window.dispatch('keydown', { key: 'Escape' });
  assert.deepEqual(calls, []);
  assert.equal(cancelEvent?.type, 'cancel');
  assert.equal(cancelEvent?.cancelable, true);
  assert.equal(dialog.open, true, 'a cancelled dismissal protects unsaved changes');
  dialog.dispatchEvent = () => true;
  await window.dispatch('keydown', { key: 'Escape' });
  assert.equal(dialog.open, false);
  assert.equal(document.body.classList.contains('fullscreen'), true);
});

test('resizing keeps the shared Play board and its current task open', async t => {
  const { document, nodes } = page(t);
  windowUi.setupWindow();
  const board = element('div', { id: 'play-panel', hidden: false });
  nodes.set('play-panel', board);
  document.activeElement = board;
  globalThis.innerWidth = 300;
  globalThis.innerHeight = 210;
  await window.dispatch('resize');
  assert.equal(board.hidden, false, 'one responsive board does not need to be replaced at a size breakpoint');
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  await window.dispatch('resize');
  assert.equal(board.hidden, false);
});

test('Escape leaves an open management task to its own handler before fullscreen', async t => {
  const { nodes } = page(t);
  windowUi.setupWindow();
  await windowUi.setFullscreen(true);
  calls.length = 0;
  nodes.set('side-panel', element('aside', { id: 'side-panel', hidden: false }));
  await window.dispatch('keydown', { key: 'Escape' });
  assert.deepEqual(calls, [], 'closing management must not also leave fullscreen');
});
