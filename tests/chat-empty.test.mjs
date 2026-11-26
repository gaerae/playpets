import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, keepGlobals } from './support/dom.mjs';

let history = [];
globalThis.playPets = { getChat: async () => ({ ok: true, data: history }) };
const { setData, setSelected } = await import('../src/core/state.js');
const { t: words } = await import('../src/core/i18n.js');
const { refreshChat, renderChat } = await import('../src/panel/chat.js');

function page(t, friend) {
  const { document } = installDom(t, { anyId: true, props: { value: '', scrollHeight: 0 } });
  keepGlobals(t, 'Option');
  globalThis.Option = class {};
  setData({ pets: [friend], assets: [], providers: [], busy: [] });
  setSelected(friend.id);
  return id => document.getElementById(id);
}

test('an unconnected friend selects the named no-AI option instead of a blank control', t => {
  const friend = { id: 'a' };
  const get = page(t, friend);
  renderChat(friend);
  assert.equal(get('provider-select').value, '');
});

// The model's name under the message box read like a setting; a friend that can talk switches its AI
// from its menu, so the picker is only there to give an AI to a friend that has none.
test('the AI picker shows only while the friend has no AI', t => {
  const without = { id: 'a' };
  const get = page(t, without);
  renderChat(without);
  assert.equal(get('provider-select').hidden, false);
  renderChat({ id: 'a', providerId: 'local' });
  assert.equal(get('provider-select').hidden, true);
});

// The send button's own title says Enter; the line under the box says it only until the first message.
test('the keyboard hint shows in an empty conversation and leaves once something is said', async t => {
  const friend = { id: 'b', providerId: 'local' };
  const get = page(t, friend);
  history = [];
  await refreshChat();
  renderChat(friend);
  assert.equal(get('chat-note').textContent, words('chat.note_keys'));
  assert.equal(get('chat-note').hidden, false);
  history = [{ role: 'user', content: 'Hi' }];
  await refreshChat();
  assert.equal(get('chat-note').hidden, true);
});
