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
  cancelImport: async () => {
    calls.push('cancel');
    return { ok: true, data: null };
  },
  addPet: async () => ({ ok: false, error: 'Your yard is full.' }),
};
const { importLink, setupInvite, twinName } = await import('../src/panel/invite.js');
const { t } = await import('../src/core/i18n.js');
const { setupConfirm } = await import('../src/core/confirm.js');

function page(context) {
  const { nodes } = installDom(context, {
    anyId: true,
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
  nodes.get('import-form').reset = () => {
    nodes.get('import-url').value = '';
  };
  calls.length = 0;
  nodes.shown = [];
  setupInvite({ refresh: async () => {}, showInvite: () => nodes.shown.push('invite') });
  setupConfirm();
  return nodes;
}
const settled = async () => {
  for (let turn = 0; turn < 6; turn++) await Promise.resolve();
};

test('another friend from the same pet file gets the first name not taken', () => {
  assert.equal(twinName('Daisy', new Set(['Daisy'])), 'Daisy 2');
  assert.equal(twinName('Daisy', new Set(['Daisy', 'Daisy 3'])), 'Daisy 2', 'the one sent away left its number free');
  assert.equal(twinName('Daisy', new Set(['Daisy', 'Daisy 2', 'Daisy 3'])), 'Daisy 4');
  assert.equal(twinName('Daisy', new Set(['Daisy 2'])), 'Daisy');
});

test('a pending URL import prevents closing or starting a folder import', async context => {
  const nodes = page(context);
  const pending = nodes.get('import-form').onsubmit({ preventDefault() {} });
  try {
    for (const id of ['close-import', 'import-folder', 'import-submit', 'import-url'])
      assert.equal(nodes.get(id).disabled, true, `${id} stays unavailable during import`);
    assert.equal(nodes.get('cancel-import').disabled, false, 'the import can be called off');
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

test('Cancel calls off a URL import and leaves the address to change, with no error', async context => {
  const nodes = page(context);
  nodes.get('import-url').value = 'https://petdex.dev/pets/boba';
  const pending = nodes.get('import-form').onsubmit({ preventDefault() {} });
  await nodes.get('cancel-import').onclick();
  assert.equal(calls.at(-1), 'cancel');
  assert.equal(nodes.get('import-dialog').open, true);
  assert.equal(nodes.get('cancel-import').disabled, true, 'pressed once');
  finish({ ok: false, error: 'Stopped.' });
  await pending;
  assert.equal(nodes.get('import-error').textContent, '');
  assert.equal(nodes.get('import-url').value, 'https://petdex.dev/pets/boba');
  for (const id of ['close-import', 'cancel-import', 'import-submit', 'import-url'])
    assert.equal(nodes.get(id).disabled, false, `${id} returns after the import is called off`);
  nodes.get('cancel-import').onclick();
  assert.equal(nodes.get('import-dialog').open, false, 'with nothing running, Cancel closes');
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

test('idle import closes on the backdrop but protects a typed URL and reveals its message', async context => {
  const nodes = page(context);
  nodes.get('import').onclick();
  const dialog = nodes.get('import-dialog');
  await dialog.dispatch('click', { clientX: -1, clientY: -1 });
  assert.equal(dialog.open, false, 'an unchanged import closes on its backdrop');
  nodes.get('import').onclick();
  let revealed = 0;
  nodes.get('import-error').scrollIntoView = () => {
    revealed++;
  };
  nodes.get('import-url').value = 'https://example.com/new-pet';
  let prevented = false;
  await dialog.dispatch('cancel', {
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(nodes.get('import-error').textContent, t('dialog.unsaved'));
  assert.equal(revealed, 1);
  await dialog.dispatch('click', { clientX: -1, clientY: -1 });
  assert.equal(dialog.open, true);
  nodes.get('cancel-import').onclick();
  assert.equal(dialog.open, false, 'explicit Cancel discards the typed URL');
});

test('an import failure reveals its message after scrolling the form', async context => {
  const nodes = page(context);
  let revealed = 0;
  nodes.get('import-error').scrollIntoView = options => {
    assert.equal(options.block, 'nearest');
    revealed++;
  };
  const pending = nodes.get('import-form').onsubmit({ preventDefault() {} });
  finish({ ok: false, error: 'Import failed.' });
  await pending;
  assert.equal(revealed, 1);
});

test('a pet link waits for a yes and then holds the import dialog until it is done', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = page(context);
  nodes.get('confirm-dialog').open = false;
  const pending = importLink('https://petdex.dev/pets/boba');
  assert.equal(nodes.get('confirm-dialog').open, true, 'the person is asked first');
  assert.match(nodes.get('confirm-body').textContent, /petdex\.dev/);
  assert.equal(nodes.get('import-submit').disabled, true, 'the dialog waits while the link is asked about');
  nodes.get('confirm-ok').onclick();
  await settled();
  assert.deepEqual(calls, ['url']);
  await nodes.get('import-form').onsubmit({ preventDefault() {} });
  await nodes.get('import-folder').onclick();
  await importLink('https://petdex.dev/pets/other');
  assert.deepEqual(calls, ['url'], 'no second import while the link runs');
  finish({ ok: true, data: 'boba' });
  await pending;
  assert.deepEqual(nodes.shown, ['invite'], 'Invite a friend opens on the pet');
  assert.equal(nodes.get('import-submit').disabled, false, 'the dialog is free again');
});

test('a pet link that comes while the dialog imports is left alone', async context => {
  const nodes = page(context);
  const pending = nodes.get('import-form').onsubmit({ preventDefault() {} });
  nodes.get('confirm-dialog').open = false;
  await importLink('https://petdex.dev/pets/boba');
  assert.equal(nodes.get('confirm-dialog').open, false, 'no question over a running import');
  assert.deepEqual(calls, ['url']);
  finish({ ok: false, error: 'Stopped.' });
  await pending;
});
