import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage, keepGlobals } from './support/dom.mjs';

globalThis.requestAnimationFrame = () => {};
let installs = 0;
let finishInstall;
globalThis.playPets = {
  installUpdate: () => {
    installs++;
    return new Promise(resolve => {
      finishInstall = resolve;
    });
  },
};
const { announceInstalledUpdate, setupSettings, updateFound, updateStatus } = await import('../src/panel/settings.js');
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');

test('an available update opens a guided download, shows each stage, and can retry after failure', async context => {
  installStorage(context);
  keepGlobals(context, 'Option', 'setTimeout');
  globalThis.Option = class {};
  globalThis.setTimeout = () => 1;
  const { nodes } = installDom(context, { anyId: true });
  setData({ pets: [], version: '0.1.0', project: {} });
  setupSettings();
  updateFound({ version: '0.2.0', notes: 'A calmer yard' });
  assert.equal(nodes.get('update-button').textContent, t('settings.update_view'));

  await nodes.get('update-button').onclick();
  assert.equal(installs, 0, 'the settings row lets a person read the update before installing');
  assert.equal(nodes.get('update-dialog').open, true);

  const installing = nodes.get('update-install').onclick();
  assert.equal(installs, 1);
  assert.equal(JSON.parse(localStorage.getItem('update-restart')).version, '0.2.0');
  assert.equal(nodes.get('update-later').disabled, true);
  assert.equal(nodes.get('update-progress-label').textContent, t('update.downloading'));
  assert.equal(nodes.get('update-progress').getAttribute('value'), null, 'unknown size keeps an indeterminate bar');
  updateStatus({ phase: 'downloading', received: 5, total: 20, percent: 25 });
  assert.equal(nodes.get('update-progress').value, 25);
  assert.match(nodes.get('update-progress-label').textContent, /25/);
  updateStatus({ phase: 'verifying' });
  assert.equal(nodes.get('update-progress').hidden, true);
  assert.equal(nodes.get('update-progress-label').textContent, t('update.verifying'));
  updateStatus({ phase: 'installing' });
  assert.equal(nodes.get('update-progress-label').textContent, t('update.installing'));

  finishInstall({ ok: false, error: 'The update could not be installed.' });
  await installing;
  assert.equal(localStorage.getItem('update-restart'), '', 'a failed installation leaves no success notice');
  assert.equal(nodes.get('update-dialog').open, true, 'a failed install keeps the dialog available');
  assert.equal(nodes.get('update-install').disabled, false, 'the person can retry');
  assert.equal(nodes.get('update-later').disabled, false);
  assert.equal(nodes.get('update-error').hidden, false);
  updateStatus({ phase: 'installing' });
  assert.equal(nodes.get('update-error').hidden, false, 'late backend events do not hide the failure');

  const retry = nodes.get('update-install').onclick();
  assert.equal(installs, 2);
  assert.equal(nodes.get('update-error').hidden, true, 'retry clears the old error');
  finishInstall({ ok: false, error: 'The update could not be installed.' });
  await retry;
});

test('restart shows the completed update once at the usual notice position', context => {
  const storage = installStorage(context);
  keepGlobals(context, 'setTimeout');
  let expire;
  globalThis.setTimeout = callback => {
    expire = callback;
    return 1;
  };
  installDom(context, { anyId: true });
  storage.setItem('update-restart', JSON.stringify({ version: '0.2.0', from: '0.1.0' }));
  setData({ pets: [], version: '0.2.0' });
  announceInstalledUpdate();
  assert.equal(document.getElementById('toast').hidden, false);
  assert.equal(document.getElementById('toast').textContent, t('toast.update_installed', { version: 'v0.2.0' }));
  assert.equal(storage.getItem('update-restart'), '');
  document.getElementById('toast').textContent = 'already shown';
  announceInstalledUpdate();
  assert.equal(document.getElementById('toast').textContent, 'already shown');
  expire();
  assert.equal(document.getElementById('toast').hidden, true, 'the confirmation leaves on the normal toast timer');
});

test('restart on the old version does not claim that installation succeeded', context => {
  const storage = installStorage(context);
  installDom(context, { anyId: true });
  storage.setItem('update-restart', JSON.stringify({ version: '0.2.0', from: '0.1.0' }));
  setData({ pets: [], version: '0.1.0' });
  document.getElementById('toast').hidden = true;
  announceInstalledUpdate();
  assert.equal(document.getElementById('toast').hidden, true);
  assert.equal(storage.getItem('update-restart'), '');
});
