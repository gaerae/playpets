import assert from 'node:assert/strict';
import test from 'node:test';

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
    'yard-controls-toggle',
    'brand',
    'pet',
  ])
    element(id);
  const body = element('body');
  body.hidden = false;
  body.classList.toggle('compact', true);
  nodes.get('panel-invite').hidden = true;
  nodes.get('pet').hidden = false;
  nodes.get('yard-controls-toggle').hidden = false;
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

test('opening a conversation keeps the small window and closing returns focus to its friend', () => {
  const { nodes } = page();
  setupTabs();
  openPanel('pet');
  assert.equal(calls.length, 0, 'conversation does not expand the native window');
  assert.ok(document.body.classList.contains('compact'));
  assert.equal(nodes.get('side-panel').hidden, false);
  nodes.get('close-panel').focus();
  nodes.get('close-panel').onclick();
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('Escape dismisses a small panel without dismissing a dialog over it', () => {
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

test('closing a small panel from a shortcut restores focus when its opener is unavailable', () => {
  const { nodes } = page();
  setupTabs();
  document.activeElement = document.body;
  openPanel('pet');
  nodes.get('close-panel').focus();
  nodes.get('close-panel').onclick();
  assert.equal(document.activeElement, nodes.get('pet'));
});

test('Invite and Settings keep the same native window', async () => {
  page();
  openPanel('invite');
  await Promise.resolve();
  assert.deepEqual(calls, []);
  page();
  openPanel('settings');
  await Promise.resolve();
  assert.deepEqual(calls, []);
});

test('Escape from Settings restores its opener focus and respects a handled Escape', () => {
  const { nodes, listeners } = page();
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

test('Escape also dismisses full Friend and Invite panels', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes, listeners } = page();
  document.body.classList.toggle('compact', false);
  setupTabs();
  for (const kind of ['pet', 'invite']) {
    openPanel(kind);
    listeners.get('keydown')({ key: 'Escape', defaultPrevented: true, preventDefault() {} });
    assert.equal(nodes.get('side-panel').hidden, false);
    listeners.get('keydown')({ key: 'Escape', preventDefault() {} });
    assert.equal(nodes.get('side-panel').hidden, true, kind);
  }
});

test('an empty compact yard regains focus after Settings closes', () => {
  const { nodes } = page();
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

test('opening a destination moves focus out of its now-hidden menu', () => {
  const { nodes } = page();
  setupTabs();
  openPanel('settings');
  assert.equal(document.activeElement, nodes.get('panel-title'));
});

test('all panel entry routes run the same pending-yard-action cleanup', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  page();
  const opened = [];
  setupTabs({ beforeOpen: kind => opened.push(kind) });
  openPanel('pet');
  openPanel('invite');
  openPanel('settings');
  openPanel(null);
  assert.deepEqual(opened, ['pet', 'invite', 'settings']);
});

test('Escape closes a task and its inline update details together', () => {
  const { nodes, listeners } = page();
  const update = { hidden: true };
  const lookup = document.getElementById;
  document.getElementById = id => (id === 'update-dialog' ? update : lookup(id));
  setupTabs();
  openPanel('pet');
  update.hidden = false;
  listeners.get('keydown')({ key: 'Escape', preventDefault() {} });
  assert.equal(nodes.get('side-panel').hidden, true);
  assert.equal(update.hidden, true);
});

test('the friend sheet names its destination instead of repeating the identity selector', () => {
  const { nodes } = page();
  nodes.get('panel-pet').dataset.title = 'tabs.friend';
  const get = document.getElementById;
  document.getElementById = id =>
    id === 'selected-name' ? { textContent: 'Clover' } : id === 'pet-panel' ? { hidden: false } : get(id);
  setupTabs();
  openPanel('pet');
  assert.notEqual(nodes.get('panel-title').textContent, 'Clover');
});
