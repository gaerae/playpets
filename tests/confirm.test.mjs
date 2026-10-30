// One question at a time: a second one (a pet link arriving while the person decides) waits for
// the first to be answered, instead of answering it for them.
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

const { confirmAction, setupConfirm } = await import('../src/core/confirm.js');

test('a question asked while another is open waits its turn', async t => {
  const { nodes } = installDom(t, {
    ids: ['confirm-dialog', 'confirm-title', 'confirm-body', 'confirm-ok', 'confirm-cancel'],
  });
  const dialog = nodes.get('confirm-dialog');
  // WebKit refuses to open a dialog that is already open.
  dialog.showModal = () => {
    if (dialog.open) throw new Error('InvalidStateError');
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatch('close');
  };
  setupConfirm();
  const first = confirmAction({ title: 'Remove Mossy?', body: '', action: 'Remove' });
  const second = confirmAction({ title: 'Import this pet?', body: '', action: 'Import' });
  await Promise.resolve();
  assert.equal(nodes.get('confirm-title').textContent, 'Remove Mossy?', 'the first stays on screen');
  nodes.get('confirm-ok').onclick();
  assert.equal(await first, true, 'answered by the person, not by the second question');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get('confirm-title').textContent, 'Import this pet?');
  assert.equal(dialog.open, true);
  nodes.get('confirm-cancel').onclick();
  assert.equal(await second, false);
});

test('the close event of an answered question does not answer the next one', async t => {
  const { nodes } = installDom(t, {
    ids: ['confirm-dialog', 'confirm-title', 'confirm-body', 'confirm-ok', 'confirm-cancel'],
  });
  const dialog = nodes.get('confirm-dialog');
  setupConfirm();
  const first = confirmAction({ title: 'Remove Mossy?', body: '', action: 'Remove' });
  // A browser closes at once but sends the close event a moment later.
  nodes.get('confirm-ok').onclick();
  assert.equal(await first, true);
  let second = 'unanswered';
  confirmAction({ title: 'Import this pet?', body: '', action: 'Import' }).then(value => {
    second = value;
  });
  await dialog.dispatch('close');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(second, 'unanswered');
  assert.equal(nodes.get('confirm-title').textContent, 'Import this pet?');
  nodes.get('confirm-ok').onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(second, true);
});

test('a question asked while a cancelled one is still closing comes after its answer', async t => {
  const { nodes } = installDom(t, {
    ids: ['confirm-dialog', 'confirm-title', 'confirm-body', 'confirm-ok', 'confirm-cancel'],
  });
  const dialog = nodes.get('confirm-dialog');
  setupConfirm();
  const first = confirmAction({ title: 'Remove Mossy?', body: '', action: 'Remove' });
  nodes.get('confirm-cancel').onclick();
  const second = confirmAction({ title: 'Import this pet?', body: '', action: 'Import' });
  await dialog.dispatch('close');
  assert.equal(await first, false, 'the cancelled question is answered No');
  assert.equal(nodes.get('confirm-title').textContent, 'Import this pet?');
  assert.equal(dialog.open, true);
  nodes.get('confirm-ok').onclick();
  await dialog.dispatch('close');
  assert.equal(await second, true);
});
