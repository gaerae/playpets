import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

// Imports wait on an isolated bridge, without native dialogs or downloaded files.
const calls = [];
let finish;
globalThis.playPets = {
  importUrl: () => {
    calls.push('url');
    return new Promise(resolve => {
      finish = resolve;
    });
  },
  importFolder: () => {
    calls.push('folder');
    return new Promise(resolve => {
      finish = resolve;
    });
  },
  addPet: async () => ({ ok: false, error: 'Your yard is full.' }),
};
const { setupInvite } = await import('../src/panel/invite.js');
const { t } = await import('../src/core/i18n.js');

function page(context) {
  const { nodes } = installDom(context, {
    ids: [
      'show-all-kinds',
      'import',
      'close-import',
      'cancel-import',
      'import-folder',
      'import-dialog',
      'import-form',
      'import-submit',
      'import-url',
      'import-error',
    ],
    props: { disabled: false, value: 'https://example.com/pet', open: true },
  });
  calls.length = 0;
  setupInvite({ refresh: async () => {} });
  return nodes;
}

test('a pending URL import prevents closing or starting a folder import', async context => {
  const nodes = page(context);
  const pending = nodes.get('import-form').onsubmit({ preventDefault() {} });
  try {
    for (const id of ['close-import', 'cancel-import', 'import-folder', 'import-submit', 'import-url'])
      assert.equal(nodes.get(id).disabled, true, `${id} stays unavailable during import`);
    nodes.get('close-import').onclick();
    assert.equal(nodes.get('import-dialog').open, true);
    await nodes.get('import-folder').onclick();
    assert.deepEqual(calls, ['url']);
  } finally {
    finish({ ok: false, error: 'The pet could not be imported.' });
    await pending;
  }
  assert.equal(nodes.get('import-error').textContent, 'The pet could not be imported.');
  for (const id of ['close-import', 'cancel-import', 'import-folder', 'import-submit', 'import-url'])
    assert.equal(nodes.get(id).disabled, false, `${id} returns after failure`);
});

test('a pending folder picker prevents URL imports and returns after cancellation', async context => {
  const nodes = page(context);
  const pending = nodes.get('import-folder').onclick();
  try {
    assert.equal(nodes.get('import-submit').disabled, true);
    await nodes.get('import-form').onsubmit({ preventDefault() {} });
    assert.deepEqual(calls, ['folder']);
    let prevented = false;
    nodes.get('import-dialog').dispatch('cancel', {
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, true);
  } finally {
    finish({ ok: true, data: null });
    await pending;
  }
  assert.equal(nodes.get('import-dialog').open, true);
  assert.equal(nodes.get('import-submit').disabled, false);
  assert.equal(nodes.get('import-submit').textContent, t('invite.import_go'));
});

test('an imported pet that cannot join the yard leaves its error visible', async context => {
  for (const source of ['url', 'folder']) {
    const nodes = page(context);
    const pending =
      source === 'url'
        ? nodes.get('import-form').onsubmit({ preventDefault() {} })
        : nodes.get('import-folder').onclick();
    finish({ ok: true, data: 'new-pet' });
    await pending;
    assert.equal(nodes.get('import-dialog').open, true, `${source} leaves the error dialog visible`);
    assert.equal(nodes.get('import-error').textContent, 'Your yard is full.');
  }
});
