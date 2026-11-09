import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

const calls = [];
let chatFails = false;
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
  getChat: say('getChat', []),
  chat: async (...args) => {
    calls.push(['chat', ...args]);
    return chatFails ? { ok: false, error: 'Claude Code isn’t signed in.' } : { ok: true, data: 'hi' };
  },
  detectAi: say('detectAi'),
  cliLogin: say('cliLogin'),
  cliLoginCode: say('cliLoginCode'),
  cancelCliLogin: say('cancelCliLogin'),
  bootstrap: say('bootstrap', { pets: [], assets: [], providers: [], busy: [] }),
};
const state = await import('../src/core/state.js');
const { setData, setSelected } = state;
const { quickConnect, setupConnection } = await import('../src/panel/connection.js');
const { t } = await import('../src/core/i18n.js');
const { chatEvent, renderChat, setupChat } = await import('../src/panel/chat.js');
const { cliChoice } = await import('../src/panel/cli-login.js');

const friend = (id, providerId) => ({ id, assetId: 'cat', name: id, providerId });
const claude = { id: 'one', type: 'claude', model: '', endpoint: '' };
const signedOut = { claude: true, codex: false, ollama: [], signedIn: { claude: false, codex: false } };
function page(t2, state) {
  t2.mock.timers.reset();
  t2.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  installDom(t2, { anyId: true, props: { value: '', reset() {}, scrollHeight: 40, clientHeight: 100 } });
  globalThis.Option = class {};
  calls.length = 0;
  chatFails = false;
  setData({ detected: {}, defaults: {}, assets: [], busy: [], providers: [], ...state });
  setSelected(state.pets?.[0]?.id ?? null);
  setupConnection();
  setupChat();
  return id => document.getElementById(id);
}
const names = () => calls.map(c => c[0]);
const flush = () => new Promise(resolve => setImmediate(resolve));
const card = get => get('chat-sign-in');
const press = (host, text) =>
  host
    .querySelectorAll('button')
    .find(b => b.textContent === text)
    .onclick();

test('the CLI offered is one signed in first, and nothing is offered before the backend says', () => {
  assert.deepEqual(cliChoice({ claude: true, codex: true, signedIn: { claude: false, codex: true } }), {
    type: 'codex',
    signedIn: true,
  });
  assert.deepEqual(cliChoice({ claude: true, codex: true, signedIn: { claude: false, codex: false } }), {
    type: 'claude',
    signedIn: false,
  });
  assert.deepEqual(cliChoice({ claude: true }), { type: 'claude', signedIn: null }, 'not asked yet');
  assert.deepEqual(
    cliChoice({ claude: true, signedIn: { claude: null } }),
    { type: 'claude', signedIn: null },
    'a check that could not finish',
  );
  assert.equal(cliChoice({ ollama: ['llama3.2'] }), null);
});

test('connect now starts the sign-in instead of a connection that would fail', async context => {
  const get = page(context, { pets: [friend('a')], detected: signedOut });
  await quickConnect();
  assert.deepEqual(calls, [['cliLogin', 'claude']], 'no connection is saved, the browser opens');
  renderChat(state.data.pets[0]);
  assert.equal(card(get).hidden, false);
  assert.ok(card(get).textContent.includes(t('signin.waiting')), 'the card waits for the browser');
  await press(card(get), t('signin.cancel'));
});

test('nothing is locked while the backend has not said, or for a CLI that is not here', async context => {
  for (const detected of [
    { claude: true, ollama: [] },
    { claude: true, ollama: [], signedIn: { claude: null, codex: null } },
    { claude: false, ollama: [], signedIn: { claude: false, codex: false } },
  ]) {
    const get = page(context, { pets: [friend('a', 'one')], providers: [claude], detected });
    renderChat(state.data.pets[0]);
    assert.equal(card(get).hidden, true, JSON.stringify(detected));
    assert.equal(get('message').disabled, false, JSON.stringify(detected));
  }
});

test('a friend with no AI signs in above the message box and is connected once it ends', async context => {
  const get = page(context, { pets: [friend('a'), friend('b')], detected: signedOut });
  get('message').value = 'hello';
  renderChat(state.data.pets[0]);
  assert.equal(card(get).hidden, false);
  assert.equal(card(get).textContent.includes(t('signin.body')), true);
  // Nothing written can be sent before the sign-in, so the box waits instead of taking words.
  assert.equal(get('message').disabled, true);
  assert.equal(get('send').disabled, true);
  assert.equal(get('chat-note').textContent, t('signin.note'));
  assert.equal(get('message').placeholder, t('signin.note'), 'the box says why, where the small window shows it');
  await press(card(get), t('signin.start'));
  assert.deepEqual(calls.at(-1), ['cliLogin', 'claude']);
  assert.ok(card(get).textContent.includes(t('signin.waiting')), 'the card says where to finish');
  // Claude's page may show a code; it goes to the waiting sign-in from the card.
  const form = card(get).querySelector('form');
  form.querySelector('input').value = ' abc#123 ';
  await form.onsubmit({ preventDefault() {} });
  assert.deepEqual(calls.at(-1), ['cliLoginCode', ' abc#123 ']);
  // The backend updates the state first, then says it ended. A word left in the box is not sent
  // by itself: the box opens with it, for the person to send.
  calls.length = 0;
  let sent = 0;
  get('chat-form').requestSubmit = () => sent++;
  setData({ ...state.data, detected: { ...signedOut, signedIn: { claude: true, codex: false } } });
  chatEvent({ type: 'cliLogin', kind: 'claude', ok: true });
  await flush();
  assert.deepEqual(names(), ['saveProvider', 'updatePet', 'updatePet'], 'every friend without an AI gets it');
  assert.ok(get('toast').textContent.includes(t('signin.done', { tool: 'Claude Code' })));
  assert.equal(sent, 0);
  renderChat(state.data.pets[0]);
  assert.equal(get('message').disabled, false);
  assert.equal(get('message').placeholder, t('chat.placeholder'));
  assert.equal(get('message').value, 'hello');
});

test('writing to a friend with no AI connects a signed-in CLI without the dialog', async context => {
  const get = page(context, {
    pets: [friend('a')],
    detected: { claude: true, signedIn: { claude: true, codex: false } },
  });
  renderChat(state.data.pets[0]);
  assert.equal(card(get).hidden, true, 'nothing to sign in');
  get('message').value = 'hello';
  await get('chat-form').onsubmit({ preventDefault() {} });
  assert.deepEqual(names().slice(0, 2), ['saveProvider', 'updatePet']);
  assert.equal(get('connection-dialog').open, undefined, 'no dialog opened');
});

test('a friend whose CLI is signed out is offered the sign-in, and a failed turn asks again', async context => {
  const get = page(context, {
    pets: [friend('a', 'one')],
    providers: [claude],
    detected: { claude: true, signedIn: { claude: true, codex: false } },
  });
  renderChat(state.data.pets[0]);
  assert.equal(card(get).hidden, true);
  chatFails = true;
  get('message').value = 'hello';
  await get('chat-form').onsubmit({ preventDefault() {} });
  assert.ok(names().includes('detectAi'), 'a failed CLI turn looks again whether it is signed in');
  setData({ ...state.data, detected: { claude: true, signedIn: { claude: false, codex: false } } });
  renderChat(state.data.pets[0]);
  assert.equal(card(get).hidden, false);
  assert.equal(get('message').disabled, true);
});

test('coming back to the window looks again only while a sign-in card is shown', async context => {
  const get = page(context, {
    pets: [friend('a', 'one')],
    providers: [{ ...claude, type: 'ollama' }],
    detected: { claude: true, ollama: ['m'], signedIn: { claude: false, codex: false } },
  });
  renderChat(state.data.pets[0]);
  assert.equal(card(get).hidden, true, 'this friend talks through another AI');
  context.mock.timers.tick(10_000);
  await window.dispatch('focus');
  assert.deepEqual(names(), [], 'a CLI signed out that nobody uses is not asked about');
  state.data.providers[0].type = 'claude';
  renderChat(state.data.pets[0]);
  assert.equal(card(get).hidden, false);
  await window.dispatch('focus');
  assert.deepEqual(names(), ['detectAi']);
});

test('a sign-in finished from the connection dialog leaves the saving to the dialog', async context => {
  const get = page(context, { pets: [friend('a')], detected: signedOut });
  renderChat(state.data.pets[0]);
  await press(card(get), t('signin.start'));
  get('connection-dialog').open = true;
  calls.length = 0;
  setData({ ...state.data, detected: { ...signedOut, signedIn: { claude: true, codex: false } } });
  chatEvent({ type: 'cliLogin', kind: 'claude', ok: true });
  await flush();
  assert.deepEqual(names(), [], 'Save and connect in the dialog makes the one connection');
});

test('a sign-in that did not finish says so and offers to try again', async context => {
  const get = page(context, { pets: [friend('a')], detected: signedOut });
  renderChat(state.data.pets[0]);
  await press(card(get), t('signin.start'));
  chatEvent({ type: 'cliLogin', kind: 'claude', ok: false });
  assert.ok(card(get).textContent.includes(t('signin.failed')));
  calls.length = 0;
  await press(card(get), t('signin.retry'));
  assert.deepEqual(calls, [['cliLogin', 'claude']]);
  await press(card(get), t('signin.cancel'));
  assert.deepEqual(calls.at(-1), ['cancelCliLogin']);
  assert.ok(card(get).textContent.includes(t('signin.body')), 'cancelled, it offers the sign-in again');
});
