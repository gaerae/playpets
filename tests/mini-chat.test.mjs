import assert from 'node:assert/strict';
import test from 'node:test';

// The tabs use DOM visibility and focus; the native bridge is absent in Node.
const calls = [];
Object.defineProperty(globalThis, 'localStorage', { value: { setItem() {} }, configurable: true });
globalThis.requestAnimationFrame = () => {};
globalThis.playPets = {
  windowMini: async on => {
    calls.push(on);
    return { ok: true };
  },
};
const { openPanel, setupTabs } = await import('../src/panel/tabs.js');
const { setSelected, views } = await import('../src/core/state.js');

function page() {
  const nodes = new Map(),
    listeners = new Map();
  const element = id => {
    const classes = new Set();
    const node = {
      hidden: true,
      dataset: { title: id },
      isConnected: true,
      classList: {
        contains: name => classes.has(name),
        toggle(name, on) {
          if (on) classes.add(name);
          else classes.delete(name);
        },
      },
      setAttribute() {},
      getAttribute() {
        return 'false';
      },
      addEventListener() {},
      querySelector() {
        return null;
      },
      focus() {
        document.activeElement = node;
      },
      getClientRects() {
        return node.hidden ? [] : [{}];
      },
      matches() {
        return id !== 'body';
      },
    };
    nodes.set(id, node);
    return node;
  };
  for (const id of [
    'layout',
    'side-panel',
    'panel-pet',
    'panel-invite',
    'panel-settings',
    'panel-title',
    'close-panel',
    'go-invite',
    'step-ai',
    'step-agent',
    'steps-dismiss',
    'unmini',
    'brand',
    'pet',
  ])
    element(id);
  const body = element('body');
  body.hidden = false;
  body.classList.toggle('mini', true);
  nodes.get('panel-invite').hidden = true;
  nodes.get('pet').hidden = false;
  nodes.get('unmini').hidden = false;
  globalThis.document = {
    body,
    activeElement: nodes.get('pet'),
    getElementById: id => nodes.get(id),
    querySelector: selector => (selector === '.brand' ? nodes.get('brand') : null),
    querySelectorAll: () => [],
    addEventListener: (type, fn) => listeners.set(type, fn),
  };
  setSelected('pet');
  views.set('pet', { button: nodes.get('pet') });
  calls.length = 0;
  return { nodes, listeners };
}

test('opening a conversation keeps the mini yard and closing returns focus to its friend', () => {
  const { nodes } = page();
  setupTabs();
  openPanel('pet');
  assert.equal(calls.length, 0, 'conversation does not expand the native window');
  assert.ok(nodes.get('layout').classList.contains('mini-chat-open'));
  assert.equal(nodes.get('side-panel').hidden, false);
  nodes.get('close-panel').focus();
  nodes.get('close-panel').onclick();
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('Escape dismisses mini chat without dismissing a dialog over it', () => {
  const { nodes, listeners } = page();
  setupTabs();
  openPanel('pet');
  const key = { key: 'Escape', preventDefault() {} };
  document.querySelector = selector => (selector === 'dialog[open]' ? {} : null);
  listeners.get('keydown')(key);
  assert.equal(nodes.get('side-panel').hidden, false);
  document.querySelector = () => null;
  nodes.get('close-panel').focus();
  listeners.get('keydown')(key);
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('closing mini chat from a shortcut restores focus when its opener is unavailable', () => {
  const { nodes } = page();
  setupTabs();
  document.activeElement = document.body;
  openPanel('pet');
  nodes.get('close-panel').focus();
  nodes.get('close-panel').onclick();
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('Invite and Settings still leave mini mode', async () => {
  page();
  openPanel('invite');
  await Promise.resolve();
  assert.deepEqual(calls, [false]);
  page();
  openPanel('settings');
  await Promise.resolve();
  assert.deepEqual(calls, [false]);
});

test('Escape from Settings restores its tab focus and respects a handled Escape', () => {
  const { nodes, listeners } = page();
  document.body.classList.toggle('mini', false);
  setupTabs();
  const tab = {
    focus() {
      document.activeElement = this;
    },
  };
  document.querySelector = selector => (selector === '.panel-tab[aria-expanded="true"]' ? tab : null);
  openPanel('settings');
  nodes.get('close-panel').focus();
  listeners.get('keydown')({ key: 'Escape', defaultPrevented: true, preventDefault() {} });
  assert.equal(nodes.get('side-panel').hidden, false, 'a menu may consume Escape before the sheet');
  let prevented = false;
  listeners.get('keydown')({
    key: 'Escape',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(document.activeElement, tab, 'focus returns to the visible Settings tab');
  assert.equal(prevented, true);
});

test('leaving mini closes its quick conversation, so the next stay starts with the yard alone', async () => {
  const { nodes } = page();
  const { setMini } = await import('../src/window.js');
  nodes.get('layout').classList.toggle('mini-chat-open', true);
  await setMini(false);
  assert.equal(nodes.get('layout').classList.contains('mini-chat-open'), false);
});
