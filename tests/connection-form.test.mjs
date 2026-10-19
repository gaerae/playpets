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
