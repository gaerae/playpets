import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

let resolveChat;
let resolveRound;
let updateSucceeds = false;
const calls = [];
const befriended = [];
globalThis.playPets = {
  getChat: async () => ({ ok: true, data: [] }),
  chat: (...args) => {
    calls.push(args);
    return new Promise(resolve => {
      resolveChat = resolve;
    });
  },
  chatWith: () =>
    new Promise(resolve => {
      resolveRound = resolve;
    }),
  updatePet: async () =>
    updateSucceeds ? { ok: true, data: null } : { ok: false, error: 'Connection could not be saved.' },
  befriend: async (...args) => {
    befriended.push(['befriend', ...args.slice(0, 2)]);
    return { ok: true, data: {} };
  },
  befriendMany: async (...args) => {
    befriended.push(['befriendMany', ...args.slice(0, 2)]);
    return { ok: true, data: {} };
  },
};
const shared = await import('../src/core/state.js');
const { companions, setData, setSelected, temporaryMessages } = shared;
const { chatEvent, setupChat, renderChat, syncBusy } = await import('../src/panel/chat.js');

function page(t) {
  installDom(t, { anyId: true, props: { value: '', scrollHeight: 40, scrollTop: 0, clientHeight: 100 } });
  globalThis.Option = class {};
  const friend = { id: 'a', assetId: 'cat', name: 'Daisy', providerId: 'local' };
  setData({ pets: [friend], providers: [], assets: [], busy: [] });
  setSelected('a');
  temporaryMessages.clear();
  companions.clear();
  calls.length = 0;
  updateSucceeds = false;
  setupChat();
  renderChat(friend);
  return id => document.getElementById(id);
}
const submit = get => get('chat-form').onsubmit({ preventDefault() {} });
const fail = () => resolveChat({ ok: false, error: 'The AI could not reply.' });

test('a failed chat restores its draft and enables retry without another input event', async t => {
  const get = page(t);
  get('message').value = 'Hello';
  const pending = submit(get);
  assert.equal(get('send').disabled, true);
  fail();
  await pending;
  assert.equal(get('message').value, 'Hello');
  assert.equal(get('send').disabled, false);
});

test('a failed chat preserves newer composer text and a pending friend cannot submit twice', async t => {
  const get = page(t);
  get('message').value = 'First';
  const pending = submit(get);
  get('message').value = 'New draft';
  const duplicate = submit(get);
  assert.equal(calls.length, 1);
  fail();
  await pending;
  await duplicate;
  assert.equal(get('message').value, 'New draft');
  assert.equal(get('send').disabled, false);
});

test('a group round nobody answered offers its question again', async t => {
  const get = page(t);
  companions.add('b');
  get('message').value = 'Where to?';
  const pending = submit(get);
  resolveRound({ ok: false, error: 'The AI could not reply.' });
  await pending;
  assert.equal(get('message').value, 'Where to?');
});

test('a group round a friend answered keeps its question in the log, not in the message box', async t => {
  const get = page(t);
  companions.add('b');
  get('message').value = 'Where to?';
  const pending = submit(get);
  chatEvent({ type: 'chat-message', petId: 'a', name: 'Daisy', message: 'The lake!' });
  resolveRound({ ok: false, error: 'The AI could not reply.' });
  await pending;
  assert.equal(get('message').value, '');
});

test('a rejected AI change shows the saved choice rather than an unsaved connection', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const get = page(context);
  get('provider-select').value = 'unsaved';
  const pending = get('provider-select').onchange();
  assert.equal(get('provider-select').disabled, true);
  await pending;
  assert.equal(get('provider-select').value, 'local');
  assert.equal(get('provider-select').disabled, false);
  assert.equal(get('toast').textContent, 'Connection could not be saved.');
});

test('an accepted AI choice stays selected while the state update is still on its way', async t => {
  const get = page(t);
  updateSucceeds = true;
  get('provider-select').value = 'accepted';
  await get('provider-select').onchange();
  assert.equal(get('provider-select').value, 'accepted');
});

test('a wait that begins or ends changes the buttons, the AI choice and the waiting line, with no whole push', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const get = page(t);
  assert.equal(get('send').hidden, false);
  shared.data.busy = ['a'];
  syncBusy();
  assert.equal(get('send').hidden, true);
  assert.equal(get('cancel').hidden, false);
  assert.equal(get('provider-select').disabled, true);
  assert.equal(get('message').readOnly, true);
  assert.ok(get('chat-log').querySelector('.waiting'), 'the conversation says an answer is on its way');
  shared.data.busy = [];
  syncBusy();
  assert.equal(get('send').hidden, false);
  assert.equal(get('cancel').hidden, true);
  assert.equal(get('provider-select').disabled, false);
  assert.equal(get('message').readOnly, false);
  const waiting = get('chat-log').querySelector('.waiting');
  assert.ok(!waiting || waiting.removed, 'and stops saying so');
});

test('a round answered counts as time together with every friend in it, in one call', async t => {
  const get = page(t);
  befriended.length = 0;
  companions.add('b');
  get('message').value = 'Where to?';
  const pending = submit(get);
  resolveRound({ ok: true, data: [] });
  await pending;
  assert.deepEqual(befriended, [['befriendMany', ['a', 'b'], 'chat']]);
});

test("a companion chip pressed after the friend's AI changed keeps the new AI", t => {
  const get = page(t);
  const before = { id: 'a', assetId: 'cat', name: 'Daisy', providerId: 'local' },
    other = { id: 'b', assetId: 'cat', name: 'Rex', providerId: 'local' };
  setData({ pets: [before, other], providers: [], assets: [], busy: [] });
  renderChat(before);
  // A push brings the friend with another AI; the chips show the same and are not built again.
  const after = { ...before, providerId: 'cloud' };
  setData({ pets: [after, other], providers: [], assets: [], busy: [] });
  renderChat(after);
  get('companion-chips').children[0].onclick();
  assert.equal(get('provider-select').value, 'cloud');
});
