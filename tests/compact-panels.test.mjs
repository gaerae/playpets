import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, keepGlobals } from './support/dom.mjs';

// The tabs use DOM visibility and focus; the native bridge is absent in Node.
const calls = [];
Object.defineProperty(globalThis, 'localStorage', { value: { setItem() {} }, configurable: true });
globalThis.requestAnimationFrame = () => {};
globalThis.playPets = {
  windowAlwaysOnTop: async on => {
    calls.push(on);
    return { ok: true };
  },
};
const { openPanel, setupTabs } = await import('../src/panel/tabs.js');
const { setSelected, views } = await import('../src/core/state.js');

// The yard window's panel parts, hidden as the page starts. The chat's own controls sit inside the
// sheet so Tab has stops to go round, and the document keeps every keydown listener the tabs add.
function page(t) {
  const { document, nodes, element } = installDom(t, { props: { hidden: true, isConnected: true, tabIndex: 0 } });
  keepGlobals(t, 'getComputedStyle');
  globalThis.getComputedStyle = () => ({ visibility: 'visible' });
  const tags = { 'close-panel': 'button', message: 'textarea', pet: 'button', 'yard-controls-toggle': 'button' };
  for (const id of [
    'layout',
    'side-panel',
    'panel-pet',
    'pet-panel',
    'message',
    'panel-invite',
    'panel-settings',
    'panel-title',
    'close-panel',
    'go-invite',
    'step-ai',
    'step-agent',
    'steps-dismiss',
    'yard-controls-toggle',
    'pet',
  ])
    nodes.set(id, element(tags[id] || 'div', { id, dataset: { title: id } }));
  const brand = element('a', { className: 'brand' });
  nodes.get('side-panel').append(nodes.get('panel-title'), nodes.get('close-panel'), nodes.get('panel-pet'));
  nodes.get('panel-pet').append(nodes.get('pet-panel'));
  nodes.get('pet-panel').append(nodes.get('message'));
  document.body.append(brand, nodes.get('layout'), nodes.get('side-panel'), nodes.get('pet'));
  document.body.hidden = false;
  document.body.classList.toggle('compact', true);
  for (const id of ['pet', 'pet-panel', 'message', 'close-panel', 'yard-controls-toggle']) nodes.get(id).hidden = false;
  document.activeElement = nodes.get('pet');
  setSelected('pet');
  views.set('pet', { button: nodes.get('pet') });
  calls.length = 0;
  return { nodes, document };
}

test('opening a conversation keeps the small window and closing returns focus to its friend', t => {
  const { nodes } = page(t);
  setupTabs();
  openPanel('pet');
  assert.equal(calls.length, 0, 'conversation does not expand the native window');
  assert.ok(document.body.classList.contains('compact'));
  assert.equal(nodes.get('side-panel').hidden, false);
  assert.equal(document.activeElement, nodes.get('message'), 'a chat opens ready to write in, however it was reached');
  nodes.get('close-panel').focus();
  nodes.get('close-panel').onclick();
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('Escape dismisses a small panel without dismissing a dialog over it', t => {
  const { nodes, document } = page(t);
  setupTabs();
  openPanel('pet');
  const key = { key: 'Escape', preventDefault() {} };
  document.querySelector = selector => (selector === 'dialog[open]' ? {} : null);
  document.dispatch('keydown', key);
  assert.equal(nodes.get('side-panel').hidden, false);
  document.querySelector = () => null;
  nodes.get('close-panel').focus();
  document.dispatch('keydown', key);
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('Tab goes round inside a small panel and passes through a wide one', t => {
  const { nodes, document } = page(t);
  setupTabs();
  openPanel('pet');
  const [close, message] = [nodes.get('close-panel'), nodes.get('message')];
  const tab = shiftKey => document.dispatch('keydown', { key: 'Tab', shiftKey });
  assert.equal(document.activeElement, message);
  tab(false);
  assert.equal(document.activeElement, close, 'past the last stop is the first, not the friends behind');
  tab(true);
  assert.equal(document.activeElement, message, 'back past the first stop is the last');
  document.body.classList.toggle('compact', false);
  tab(false);
  assert.equal(document.activeElement, message, 'beside the yard the browser moves on by itself');
});

test('closing a small panel from a shortcut restores focus when its opener is unavailable', t => {
  const { nodes } = page(t);
  setupTabs();
  document.activeElement = document.body;
  openPanel('pet');
  nodes.get('close-panel').focus();
  nodes.get('close-panel').onclick();
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('Invite and Settings keep the same native window', async t => {
  page(t);
  openPanel('invite');
  await Promise.resolve();
  assert.deepEqual(calls, []);
  page(t);
  openPanel('settings');
  await Promise.resolve();
  assert.deepEqual(calls, []);
});

test('Escape from Settings restores its opener focus and respects a handled Escape', t => {
  const { nodes, document } = page(t);
  document.body.classList.toggle('compact', false);
  setupTabs();
  const tab = {
    isConnected: true,
    matches: () => true,
    getClientRects: () => [{}],
    focus() {
      document.activeElement = this;
    },
  };
  document.querySelector = selector => (selector === '.panel-tab[aria-expanded="true"]' ? tab : null);
  document.activeElement = tab;
  openPanel('settings');
  nodes.get('close-panel').focus();
  document.dispatch('keydown', { key: 'Escape', defaultPrevented: true, preventDefault() {} });
  assert.equal(nodes.get('side-panel').hidden, false, 'a menu may consume Escape before the sheet');
  document.dispatch('keydown', { key: 'Escape', isComposing: false, keyCode: 229, preventDefault() {} });
  assert.equal(nodes.get('side-panel').hidden, false, "Escape ending a composition is the input method's");
  let prevented = false;
  document.dispatch('keydown', {
    key: 'Escape',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(document.activeElement, tab, 'focus returns to the visible Settings tab');
  assert.equal(prevented, true);
});

test('Escape also dismisses full Friend and Invite panels', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes, document } = page(t);
  document.body.classList.toggle('compact', false);
  setupTabs();
  for (const kind of ['pet', 'invite']) {
    openPanel(kind);
    document.dispatch('keydown', { key: 'Escape', defaultPrevented: true, preventDefault() {} });
    assert.equal(nodes.get('side-panel').hidden, false);
    document.dispatch('keydown', { key: 'Escape', preventDefault() {} });
    assert.equal(nodes.get('side-panel').hidden, true, kind);
  }
});

test('an empty compact yard regains focus after Settings closes', t => {
  const { nodes } = page(t);
  const yard = {
    focus: () => {
      document.activeElement = yard;
    },
  };
  const get = document.getElementById;
  document.getElementById = id => (id === 'yard' ? yard : get(id));
  views.clear();
  setSelected(null);
  document.activeElement = document.body;
  setupTabs();
  openPanel('settings');
  nodes.get('close-panel').onclick();
  assert.equal(document.activeElement, yard);
});

test('opening a destination moves focus out of its now-hidden menu', t => {
  const { nodes } = page(t);
  setupTabs();
  openPanel('settings');
  assert.equal(document.activeElement, nodes.get('panel-title'));
});

test('all panel entry routes run the same pending-yard-action cleanup', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  page(t);
  const opened = [];
  setupTabs({ beforeOpen: kind => opened.push(kind) });
  openPanel('pet');
  openPanel('invite');
  openPanel('settings');
  openPanel(null);
  assert.deepEqual(opened, ['pet', 'invite', 'settings']);
});

test('the friend sheet names its destination instead of repeating the identity selector', t => {
  const { nodes } = page(t);
  nodes.get('panel-pet').dataset.title = 'tabs.friend';
  const get = document.getElementById;
  document.getElementById = id =>
    id === 'selected-name' ? { textContent: 'Clover' } : id === 'pet-panel' ? { hidden: false } : get(id);
  setupTabs();
  openPanel('pet');
  assert.notEqual(nodes.get('panel-title').textContent, 'Clover');
});
