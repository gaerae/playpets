import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

let finishModels;
globalThis.playPets = {
  listModels: () =>
    new Promise(resolve => {
      finishModels = resolve;
    }),
  saveProvider: async () => ({ ok: false, error: 'Connection failed.' }),
};
const { setupConnection, openConnectionDialog } = await import('../src/panel/connection.js');
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');

function page(context) {
  const { nodes, element } = installDom(context, { anyId: true, props: { value: '', reset() {} } });
  const radio = element('input', { value: 'ollama', checked: true });
  const form = document.getElementById('connection-form');
  form.querySelectorAll = selector => (selector === 'input[name="ai-type"]' ? [radio] : []);
  form.querySelector = () => (radio.checked ? radio : null);
  setData({
    detected: { ollama: ['llama3.2'] },
    defaults: { ollamaEndpoint: 'http://localhost:11434' },
    providers: [],
    pets: [],
  });
  setupConnection();
  openConnectionDialog(null);
  return nodes;
}

test('automatic Ollama model selection does not make an untouched dialog dirty', async context => {
  const nodes = page(context);
  finishModels({ ok: true, data: ['llama3.2'] });
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(nodes.get('ai-model').value, 'llama3.2');
  let prevented = false;
  await nodes.get('connection-dialog').dispatch('cancel', {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false, 'automatic defaults remain the unchanged baseline');
});

test('a late automatic model does not erase real edits and reveals the unsaved message', async context => {
  const nodes = page(context);
  let revealed = 0;
  nodes.get('connection-error').scrollIntoView = options => {
    assert.equal(options.block, 'nearest');
    revealed++;
  };
  nodes.get('ai-endpoint').value = 'http://localhost:11435';
  finishModels({ ok: true, data: ['llama3.2'] });
  await new Promise(resolve => queueMicrotask(resolve));
  let prevented = false;
  await nodes.get('connection-dialog').dispatch('cancel', {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(nodes.get('connection-error').textContent, t('dialog.unsaved'));
  assert.equal(revealed, 1);
});

test('failed connection saves reveal their inline error', async context => {
  const nodes = page(context);
  let revealed = 0;
  nodes.get('connection-error').scrollIntoView = () => {
    revealed++;
  };
  finishModels({ ok: true, data: [] });
  await nodes.get('connection-form').onsubmit({ preventDefault() {} });
  assert.equal(nodes.get('connection-error').textContent, 'Connection failed.');
  assert.equal(revealed, 1);
});

test('model discovery errors reveal their inline status', async context => {
  const nodes = page(context);
  let revealed = 0;
  nodes.get('model-status').scrollIntoView = () => {
    revealed++;
  };
  finishModels({ ok: false, error: 'The model server is unavailable.' });
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(nodes.get('model-status').textContent, 'The model server is unavailable.');
  assert.equal(revealed, 1);
});

test('editing a connection from Settings saves it without moving the selected friend to it', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const before = { ...globalThis.playPets };
  globalThis.playPets.saveProvider = async config => {
    calls.push(['saveProvider', config.id]);
    return { ok: true, data: { id: config.id || 'new' } };
  };
  globalThis.playPets.updatePet = async (id, change) => {
    calls.push(['updatePet', id, change.providerId]);
    return { ok: true, data: {} };
  };
  context.after(() => Object.assign(globalThis.playPets, before));
  const nodes = page(context);
  const { setSelected } = await import('../src/core/state.js');
  setData({
    detected: {},
    defaults: {},
    providers: [{ id: 'a' }, { id: 'b', type: 'ollama' }],
    pets: [{ id: 'daisy', providerId: 'a' }],
  });
  setSelected('daisy');
  openConnectionDialog({ id: 'b', type: 'ollama', model: '', endpoint: '' }, () => {}, { forFriend: null });
  await nodes.get('connection-form').onsubmit({ preventDefault() {} });
  assert.deepEqual(calls, [['saveProvider', 'b']], 'Daisy keeps connection a');
});

test('from Settings the connection opens in place, without a second window over the sheet', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(context);
  nodes.get('connection-dialog').open = false;
  let modals = 0;
  nodes.get('connection-dialog').showModal = () => modals++;
  const host = document.getElementById('ai-editor');
  host.hidden = true;
  const { closeConnectionEditor } = await import('../src/panel/connection.js');
  openConnectionDialog({ id: 'b', type: 'ollama', model: '', endpoint: '' }, () => {}, {
    forFriend: null,
    inline: host,
  });
  assert.equal(modals, 0, 'no modal window');
  assert.equal(host.hidden, false);
  assert.equal(nodes.get('connection-form').parentNode, host, 'the form sits inside Settings → Friends & AI');
  assert.equal(nodes.get('ai-connections').hidden, true, 'the list steps aside while one is edited');
  closeConnectionEditor();
  assert.equal(host.hidden, true);
  assert.equal(nodes.get('ai-connections').hidden, false);
  assert.equal(
    nodes.get('connection-form').parentNode,
    nodes.get('connection-dialog'),
    'the form goes home for friend edits',
  );
});
