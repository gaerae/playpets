import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

const calls = [];
const say =
  (name, data = null) =>
  async (...args) => {
    calls.push([name, ...args]);
    return { ok: true, data };
  };
globalThis.playPets = {
  saveProvider: say('saveProvider', { id: 'new' }),
  updatePet: say('updatePet'),
  listModels: say('listModels', []),
  addPet: say('addPet', { id: 'c' }),
  getChat: say('getChat', []),
  chat: say('chat', 'hi'),
  bootstrap: say('bootstrap', { pets: [], assets: [], providers: [], busy: [] }),
};
const { setData, setSelected } = await import('../src/core/state.js');
const { quickConnect, setupConnection, sharedConnection } = await import('../src/panel/connection.js');
const { t } = await import('../src/core/i18n.js');
const { setupChat, renderChat } = await import('../src/panel/chat.js');
const { arrived, invite, setupInvite } = await import('../src/panel/invite.js');

const friend = (id, providerId) => ({ id, assetId: 'cat', name: id, providerId });
const claude = { id: 'one', type: 'claude', model: '', endpoint: '' };
function page(t2, state, first = () => {}) {
  // A toast's line leaves on a timer that would outlive the page.
  t2.mock.timers.reset();
  t2.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t2, { anyId: true, props: { value: '', reset() {}, scrollHeight: 40, clientHeight: 100 } });
  globalThis.Option = class {};
  calls.length = 0;
  setData({ detected: {}, defaults: {}, assets: [], busy: [], ...state });
  setSelected(state.pets?.[0]?.id ?? null);
  setupConnection({ first });
  return id => document.getElementById(id);
}
const names = () => calls.map(c => c[0]);

test('the connection friends share, or the only one saved, is what a new friend can take', t => {
  page(t, { providers: [claude], pets: [friend('a', 'one'), friend('b')] });
  assert.equal(sharedConnection(), 'one');
  page(t, { providers: [claude], pets: [] });
  assert.equal(sharedConnection(), 'one', 'the last friend left, the connection stayed');
  page(t, { providers: [claude, { ...claude, id: 'two' }], pets: [friend('a', 'one'), friend('b', 'two')] });
  assert.equal(sharedConnection(), null, 'two in use: the person chooses');
  page(t, { providers: [claude, { ...claude, id: 'two' }], pets: [friend('a')] });
  assert.equal(sharedConnection(), null, 'two saved and none in use: the person chooses');
  page(t, { providers: [], pets: [friend('a')] });
  assert.equal(sharedConnection(), null);
});

test('connect now uses a saved connection instead of making a second one', async t => {
  page(t, { providers: [claude], pets: [friend('a')], detected: { claude: true } });
  await quickConnect();
  assert.deepEqual(calls, [['updatePet', 'a', { providerId: 'one' }]]);
});

test('connecting in one press says what the plan still costs', async context => {
  const get = page(context, { providers: [], pets: [friend('a')], detected: { claude: true } });
  await quickConnect();
  assert.deepEqual(names(), ['saveProvider', 'updatePet']);
  assert.ok(get('toast').textContent.includes(t('connection.note_claude')));
});

test('a connection saved with no friend around does not send anyone to greet nobody', async t => {
  const reached = [];
  const get = page(t, { providers: [], pets: [] }, able => reached.push(able));
  await get('connection-form').onsubmit({ preventDefault() {} });
  assert.deepEqual(names(), ['saveProvider']);
  assert.deepEqual(reached, []);
});

test('writing to a friend with no AI uses the shared connection instead of asking again', async t => {
  const a = friend('a', 'one'),
    b = friend('b');
  const get = page(t, { providers: [claude], pets: [b, a] });
  setupChat();
  renderChat(b);
  get('message').value = 'Hello';
  await get('chat-form').onsubmit({ preventDefault() {} });
  assert.deepEqual(
    calls.filter(c => c[0] !== 'getChat'),
    [
      ['updatePet', 'b', { providerId: 'one' }],
      ['chat', 'b', 'Hello'],
    ],
  );
});

test('a failed answer is said aloud while the chat cannot be seen', async t => {
  const a = friend('a', 'one');
  const get = page(t, { providers: [claude], pets: [a] });
  const before = globalThis.playPets.chat;
  globalThis.playPets.chat = async () => ({ ok: false, error: 'The AI could not reply.' });
  t.after(() => (globalThis.playPets.chat = before));
  setupChat();
  renderChat(a);
  get('panel-pet').hidden = true;
  get('message').value = 'Hello';
  await get('chat-form').onsubmit({ preventDefault() {} });
  assert.equal(get('toast').textContent, 'The AI could not reply.');
});

test('a friend invited into a yard with one connection can talk right away', async t => {
  page(t, { providers: [claude], pets: [friend('a', 'one')] });
  setupInvite({ refresh: async () => {} });
  await invite('dog');
  assert.deepEqual(calls.slice(0, 2), [
    ['addPet', 'dog', { visualStyle: 'illustrated' }],
    ['updatePet', 'c', { providerId: 'one' }],
  ]);
});

test('an import that worked is not reported as a failure when the yard is full', async context => {
  const pets = Array.from({ length: 12 }, (_, n) => friend(`f${n}`));
  const get = page(context, { providers: [], pets, assets: [{ id: 'new', displayName: 'Lulu' }] });
  let closed = 0;
  get('import-dialog').close = () => closed++;
  setupInvite({ refresh: async () => {} });
  await arrived('new');
  assert.deepEqual(names(), [], 'no friend is added past the limit');
  assert.equal(closed, 1);
  assert.equal(get('toast').textContent, t('invite.linked', { name: 'Lulu' }));
});

test('importing a pet already in the yard makes no twin', async t => {
  const get = page(t, {
    providers: [],
    pets: [{ ...friend('a'), assetId: 'lulu' }],
    assets: [{ id: 'lulu', displayName: 'Lulu' }],
  });
  get('import-dialog').close = () => {};
  setupInvite({ refresh: async () => {} });
  await arrived('lulu');
  assert.deepEqual(names(), []);
});
