import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage, keepGlobals } from './support/dom.mjs';

globalThis.requestAnimationFrame = () => {};
let installs = 0;
let cancels = 0;
let finishInstall;
globalThis.playPets = {
  installUpdate: () => {
    installs++;
    return new Promise(resolve => {
      finishInstall = data => resolve({ ok: true, data });
    });
  },
  cancelUpdate: async () => {
    cancels++;
    return { ok: true, data: null };
  },
};
const { setupUpdates, updateFound, updateStatus } = await import('../src/panel/update.js');
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');

function storeCopy(context) {
  installStorage(context);
  keepGlobals(context, 'Option', 'setTimeout');
  globalThis.Option = class {};
  globalThis.setTimeout = () => 1;
  const { nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  setData({ pets: [], version: '1.5.0', updateChannel: 'store', project: {} });
  setupUpdates();
  updateFound({ channel: 'store', version: '1.6.0' });
  return nodes;
}

test('a version waiting in Microsoft Store shows in the yard, and the Store installs it with its progress in the app', async context => {
  const nodes = storeCopy(context);
  assert.equal(nodes.get('update-pill').hidden, false);
  assert.match(nodes.get('update-pill-label').textContent, /v1\.6\.0/);
  assert.equal(nodes.get('update-note').textContent, t('settings.update_available', { version: 'v1.6.0' }));
  assert.equal(nodes.get('update-auto').hidden, true, 'the Store keeps its own schedule');
  nodes.get('update-pill').onclick();
  assert.equal(nodes.get('update-dialog').hidden, false);
  assert.equal(nodes.get('update-body').textContent, t('update.store_body', { current: 'v1.5.0' }));
  assert.equal(nodes.get('update-install').textContent, t('settings.update_in_store'));

  const before = installs;
  const installing = nodes.get('update-install').onclick();
  assert.equal(installs, before + 1);
  assert.ok(!localStorage.getItem('update-restart'), 'the Store reopens it, and the version after boot says so');
  assert.equal(nodes.get('update-progress-wrap').hidden, false, 'the Store download shows here as the app’s own does');
  assert.equal(nodes.get('update-install').disabled, true);
  assert.equal(nodes.get('update-cancel').hidden, false, 'a Store download can be called off too');
  updateStatus({ phase: 'downloading', percent: 40 });
  assert.equal(nodes.get('update-progress-label').textContent, t('update.progress', { percent: 40 }));
  assert.match(nodes.get('update-pill-label').textContent, /40%/);
  updateStatus({ phase: 'installing' });
  assert.equal(nodes.get('update-cancel').hidden, true, 'installing cannot be called off');
  assert.equal(nodes.get('update-progress-label').textContent, t('update.installing'));

  // Windows closes the app to install it; were it still open after, it asks to be opened again.
  finishInstall({ installed: true });
  await installing;
  assert.equal(document.getElementById('toast').textContent, t('update.store_reopen'));
  assert.equal(nodes.get('update-pill').hidden, true, 'nothing waits any more');
});

test('a Store download called off, or one the Store can only do on its page, leaves the update ready again', async context => {
  const nodes = storeCopy(context);
  nodes.get('update-pill').onclick();
  let installing = nodes.get('update-install').onclick();
  await nodes.get('update-cancel').onclick();
  assert.ok(cancels >= 1);
  finishInstall({ cancelled: true });
  await installing;
  assert.equal(nodes.get('update-progress-wrap').hidden, true);
  assert.equal(nodes.get('update-install').disabled, false);
  assert.equal(nodes.get('update-pill').hidden, false, 'the version still waits');

  installing = nodes.get('update-install').onclick();
  finishInstall({ store: 'page' });
  await installing;
  assert.equal(nodes.get('update-progress-wrap').hidden, true, 'the Store page took over');
  assert.equal(nodes.get('update-install').disabled, false, 'the Store can be asked again');
  assert.equal(nodes.get('update-error').hidden, true);
});
