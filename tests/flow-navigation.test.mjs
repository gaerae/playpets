import assert from 'node:assert/strict';
import test from 'node:test';
import { element, fakeStorage, installDom, installStorage, keepGlobals } from './support/dom.mjs';

let answer;
globalThis.playPets = {
  agentLinks: async () => ({ ok: true, data: { claude: 'on' } }),
  disconnectAgent: async () => answer,
};
const { setupControls, closeControls } = await import('../src/core/controls.js');
const { renderNotices } = await import('../src/core/notices.js');
const state = await import('../src/core/state.js');

function contextPage(t) {
  keepGlobals(t, 'innerWidth', 'innerHeight');
  globalThis.innerWidth = 1000;
  globalThis.innerHeight = 700;
  const { document, nodes } = installDom(t);
  const yard = element('div', { id: 'yard' });
  const context = element('div', { id: 'yard-context-menu', hidden: true, rect: { width: 200, height: 160 } });
  const side = element('div', { id: 'side-panel', hidden: false });
  const close = element('button', { id: 'close-panel' });
  let closed = 0;
  close.click = () => closed++;
  const first = element('button', { dataset: { contextFor: 'yard' } });
  context.querySelectorAll = () => [first];
  for (const node of [yard, context, side, close]) nodes.set(node.id, node);
  setupControls();
  return { document, yard, context, closed: () => closed };
}

test('a right-click leaves the chat open until something is chosen from the menu', async t => {
  const { yard, closed, context } = contextPage(t);
  await yard.dispatch('contextmenu', { clientX: 200, clientY: 150 });
  assert.equal(context.hidden, false);
  assert.equal(closed(), 0);
});

test('a menu opened again is measured at its full height, not the one it was last squeezed to', async t => {
  const { yard, context } = contextPage(t);
  await yard.dispatch('contextmenu', { clientX: 200, clientY: 650 });
  closeControls(false);
  let measuredWith = 'unset';
  context.getBoundingClientRect = () => {
    measuredWith = context.style['max-height'];
    return { width: 200, height: 160 };
  };
  await yard.dispatch('contextmenu', { clientX: 200, clientY: 650 });
  assert.equal(measuredWith, undefined);
});

test('a press on a friend closes an open menu, though the friend stops the press from bubbling', async t => {
  const { document } = installDom(t);
  const options = [];
  const add = document.addEventListener;
  document.addEventListener = (type, listener, capture) => {
    if (type === 'pointerdown') options.push(capture);
    add.call(document, type, listener, capture);
  };
  const { dropdown } = await import('../src/core/menu.js');
  dropdown(element('button'), element('div'));
  assert.deepEqual(options, [true]);
});

test('startup problems with an empty yard are open, since that yard looks like a first start', t => {
  const { nodes } = installDom(t, { ids: ['warnings', 'warning-details', 'warning-summary', 'warning-messages'] });
  renderNotices(['state.json could not be read.'], true);
  assert.equal(nodes.get('warning-details').open, true);
  renderNotices(['Another problem.'], false);
  assert.equal(nodes.get('warning-details').open, false);
});

test('a notice leaves when pressed, and a resting pointer holds it only for a while', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, nodes } = installDom(t, { ids: ['toast'] });
  document.querySelectorAll = () => [];
  const notice = nodes.get('toast');
  state.toast('Saved');
  await notice.children[0].dispatch('click');
  assert.equal(notice.children.length, 0);
  state.toast('Saved again');
  notice.children[0].matches = selector => selector === ':hover';
  for (let waited = 0; waited < 30000; waited += 500) t.mock.timers.tick(500);
  assert.equal(notice.children.length, 0);
});

test('the friend last talked to is the one selected at the next start', t => {
  installStorage(t, fakeStorage());
  state.setData({ pets: [{ id: 'a' }, { id: 'b' }] });
  assert.equal(state.lastFriend(), 'a');
  state.remember('friend', 'b');
  assert.equal(state.lastFriend(), 'b');
  state.setData({ pets: [{ id: 'a' }] });
  assert.equal(state.lastFriend(), 'a', 'a friend who left is not looked for');
});

test('the panel that was open is kept for a reload only, so a new start opens on the yard', t => {
  keepGlobals(t, 'sessionStorage');
  globalThis.sessionStorage = fakeStorage();
  installStorage(t, fakeStorage());
  state.rememberRun('panel', 'settings');
  assert.equal(state.recallRun('panel'), 'settings');
  assert.equal(state.recall('panel') ?? null, null);
});

test('a connection that could not be written says so in its own row until the next try', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = installDom(t, { ids: ['toast'] });
  answer = { ok: false, error: 'Could not save settings.json. Use Copy settings.' };
  state.setData({ pets: [], agents: [] });
  const button = element('button', { dataset: { connect: 'claude' } });
  const mark = element('span');
  const problem = element('p', { hidden: true });
  document.querySelectorAll = selector => (selector.includes('data-connect') ? [button] : []);
  document.querySelector = selector => (selector.includes('data-link-problem') ? problem : mark);
  const { linkAgent, refreshLinks } = await import('../src/panel/settings.js');
  await refreshLinks();
  await linkAgent(button);
  assert.equal(problem.hidden, false);
  assert.equal(problem.textContent, 'Could not save settings.json. Use Copy settings.');
  answer = { ok: true, data: 'on' };
  await linkAgent(button);
  assert.equal(problem.hidden, true);
});
