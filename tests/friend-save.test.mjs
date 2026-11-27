import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

let finish;
let saves = 0;
let lastPatch;
globalThis.playPets = {
  updatePet: (_id, patch) => {
    lastPatch = patch;
    saves++;
    return new Promise(resolve => {
      finish = resolve;
    });
  },
};
const { openFriendSettings, setupFriendSettings } = await import('../src/panel/friend-settings.js');
const { setData, setSelected } = await import('../src/core/state.js');

test('friend settings keep one pending save open and return editable after failure', async t => {
  const { nodes } = installDom(t, {
    ids: [
      'size-range',
      'size-label',
      'edit-pet',
      'use-intro',
      'close-pet-dialog',
      'cancel-pet-dialog',
      'pet-dialog',
      'pet-form',
      'pet-dialog-name',
      'pet-name',
      'pet-persona',
      'persona-help',
      'pet-call-me',
      'pet-error',
      'remove',
      'remove-friend',
      'pet-appearance',
    ],
    props: { disabled: false, value: '', open: false },
  });
  const relation = [{ disabled: false }];
  relation.value = '';
  const visualStyle = [];
  visualStyle.value = 'illustrated';
  const controls = [nodes.get('pet-name'), nodes.get('cancel-pet-dialog'), nodes.get('close-pet-dialog')];
  Object.assign(nodes.get('pet-form'), {
    elements: { relation, visualStyle },
    reset() {},
    querySelectorAll: () => controls,
  });
  setData({
    pets: [{ id: 'daisy', assetId: 'daisy', size: 128 }],
    assets: [{ id: 'daisy', place: 'builtin', realisticSpriteUrls: { default: 'legacy-recovery' } }],
  });
  setSelected('daisy');
  setupFriendSettings({ refresh: async () => {} });
  openFriendSettings();
  assert.equal(
    nodes.get('pet-appearance').hidden,
    true,
    'built-in compatibility recovery never advertises a different named companion as a look',
  );
  const dialog = nodes.get('pet-dialog');
  let revealed = 0;
  nodes.get('pet-error').scrollIntoView = options => {
    assert.equal(options.block, 'nearest');
    revealed++;
  };
  nodes.get('pet-name').value = 'A changed name';
  await dialog.dispatch('cancel');
  assert.equal(revealed, 1, 'unsaved edits reveal the message even below the scrolled form');

  const submit = () => nodes.get('pet-form').onsubmit({ preventDefault() {} });
  const pending = submit();
  try {
    assert.equal(lastPatch.visualStyle, 'illustrated', 'the appearance is included in the saved friend settings');
    assert.equal(
      controls.every(control => control.disabled),
      true,
    );
    nodes.get('cancel-pet-dialog').onclick();
    assert.equal(dialog.open, true, 'Cancel cannot close an in-flight save');
    let prevented = false;
    dialog.dispatch('cancel', {
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, true, 'Escape cannot close an in-flight save');
    await submit();
    assert.equal(saves, 1, 'repeated submission does not race the first save');
  } finally {
    finish({ ok: false, error: 'Your friend could not be saved.' });
    await pending;
  }
  assert.equal(dialog.open, true);
  assert.equal(nodes.get('pet-error').textContent, 'Your friend could not be saved.');
  assert.equal(revealed, 2, 'save failures reveal their inline message too');
  assert.equal(
    controls.some(control => control.disabled),
    false,
  );
  nodes.get('cancel-pet-dialog').onclick();
  assert.equal(dialog.open, false, 'Cancel works again after failure');
  openFriendSettings();
  const resize = nodes.get('size-range').onchange();
  nodes.get('cancel-pet-dialog').onclick();
  setData({ pets: [{ id: 'clover', assetId: 'clover', size: 128 }], assets: [{ id: 'clover' }] });
  setSelected('clover');
  openFriendSettings();
  finish({ ok: false, error: 'The previous friend could not be resized.' });
  await resize;
  assert.equal(nodes.get('pet-error').textContent, '', 'a late resize error cannot appear for another friend');
});

// The friend card's value is empty (a friend is no relationship at all), and a browser's radio list
// checks no card for an empty value: the dialog showed nothing picked for every friend.
test('friend settings pick the friend card for a friend with no other relationship', t => {
  const { document } = installDom(t, { anyId: true, props: { disabled: false, value: '', open: false } });
  const get = id => document.getElementById(id);
  const cards = ['', 'partner', 'senior', 'junior'].map(value => ({ value, checked: false }));
  const relation = Object.defineProperty([...cards], 'value', {
    // As in a browser: the first card with the value is checked, and an empty value checks none.
    set(v) {
      for (const card of cards) card.checked = false;
      const card = v ? cards.find(c => c.value === v) : null;
      if (card) card.checked = true;
    },
    get() {
      return cards.find(c => c.checked)?.value ?? '';
    },
  });
  const visualStyle = [];
  Object.assign(get('pet-form'), {
    elements: { relation, visualStyle },
    reset() {
      for (const card of cards) card.checked = false;
    },
    querySelector: () => null,
  });
  get('pet-dialog').showModal = () => {};
  setData({ pets: [{ id: 'daisy', assetId: 'daisy', size: 128 }], assets: [{ id: 'daisy', place: 'builtin' }] });
  setSelected('daisy');
  openFriendSettings();
  assert.deepEqual(
    cards.map(c => c.checked),
    [true, false, false, false],
  );
  setData({
    pets: [{ id: 'daisy', assetId: 'daisy', size: 128, relation: 'senior' }],
    assets: [{ id: 'daisy', place: 'builtin' }],
  });
  openFriendSettings();
  assert.deepEqual(
    cards.map(c => c.checked),
    [false, false, true, false],
  );
  setData({
    pets: [{ id: 'daisy', assetId: 'daisy', size: 128, relation: 'friend' }],
    assets: [{ id: 'daisy', place: 'builtin' }],
  });
  openFriendSettings();
  assert.deepEqual(
    cards.map(c => c.checked),
    [true, false, false, false],
    'a relationship no card offers shows as a friend',
  );
});
