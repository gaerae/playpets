import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

let resolveChat;
globalThis.playPets = {
  getChat: async () => ({ ok: true, data: [] }),
  chat: () => new Promise(resolve => (resolveChat = resolve)),
};
const state = await import('../src/core/state.js');
const { setData, setSelected, temporaryMessages } = state;
const { setupChat, renderChat, swapDraft, chatShown, refreshChat } = await import('../src/panel/chat.js');

// Drafts outlive a page here as in the app, so each test talks to friends of its own.
let round = 0;
const friendIds = () => [`a${round}`, `b${round}`];
function page(t, log = {}) {
  round++;
  // A toast's line leaves on a timer that would outlive the page.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(t, { anyId: true, props: { value: '', scrollHeight: 400, scrollTop: 0, clientHeight: 100 } });
  globalThis.Option = class {};
  const friends = friendIds().map(id => ({ id, assetId: 'cat', name: id, providerId: 'local' }));
  setData({ pets: friends, providers: [], assets: [], busy: [] });
  setSelected(friendIds()[0]);
  temporaryMessages.clear();
  swapDraft(null, friendIds()[0]);
  setupChat();
  renderChat(friends[0]);
  const get = id => document.getElementById(id);
  Object.assign(get('chat-log'), log);
  return get;
}
const talkTo = id => {
  swapDraft(state.selected, id);
  setSelected(id);
};

test('what is being written stays with the friend it was written to', t => {
  const get = page(t);
  const [a, b] = friendIds();
  get('message').value = 'Remember the lake tonight';
  talkTo(b);
  assert.equal(get('message').value, '');
  get('message').value = 'Hi';
  talkTo(a);
  assert.equal(get('message').value, 'Remember the lake tonight');
  talkTo(b);
  assert.equal(get('message').value, 'Hi');
});

test('Enter ending a composition stays in the box, as macOS WebKit reports it after the composition', t => {
  const get = page(t);
  let sent = 0;
  get('chat-form').requestSubmit = () => sent++;
  let handler;
  const add = get('message').addEventListener;
  get('message').addEventListener = (type, run, ...rest) => {
    if (type === 'keydown') handler = run;
    return add?.call(get('message'), type, run, ...rest);
  };
  setupChat();
  handler({ key: 'Enter', isComposing: false, keyCode: 229, preventDefault() {} });
  assert.equal(sent, 0);
  handler({ key: 'Enter', isComposing: false, keyCode: 13, preventDefault() {} });
  assert.equal(sent, 1);
});

test('a failed message comes back to its friend after the person moved to another', async t => {
  const get = page(t);
  const [a, b] = friendIds();
  get('message').value = 'Lost words';
  const pending = get('chat-form').onsubmit({ preventDefault() {} });
  talkTo(b);
  resolveChat({ ok: false, error: 'The AI could not reply.' });
  await pending;
  assert.equal(get('message').value, '');
  talkTo(a);
  assert.equal(get('message').value, 'Lost words');
});

test('a log filled while hidden shows its end the first time it is seen', async t => {
  const get = page(t, { clientHeight: 0, scrollTop: 0 });
  await refreshChat();
  get('chat-log').clientHeight = 300;
  get('chat-log').scrollTop = 0;
  chatShown();
  assert.equal(get('chat-log').scrollTop, get('chat-log').scrollHeight);
  get('chat-log').scrollTop = 7;
  chatShown();
  assert.equal(get('chat-log').scrollTop, 7, 'where the person scrolled to is kept after that');
});
