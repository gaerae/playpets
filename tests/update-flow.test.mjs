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

test('an available update opens Settings for a guided download, shows each stage, and can retry after failure', async context => {
  installStorage(context);
  keepGlobals(context, 'Option', 'setTimeout');
  globalThis.Option = class {};
  globalThis.setTimeout = () => 1;
  const { nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  setData({ pets: [], version: '0.1.0', project: {} });
  setupSettings();
  updateFound({ version: '0.2.0', notes: 'A calmer yard' });
  assert.equal(nodes.get('update-button').textContent, t('settings.update_view'));
  const { openPanel } = await import('../src/panel/tabs.js');
  const updatesTask = document.getElementById('settings-updates-task');
  updatesTask.dataset.section = 'updates-title';
  const updatesBody = document.getElementById('settings-updates');
  updatesBody.dataset.settingsSection = 'updates-title';
  document.querySelectorAll = selector =>
    selector.includes('settings-index')
      ? [updatesTask]
      : selector.includes('data-settings-section')
        ? [updatesBody]
        : [];
  openPanel('settings', 'updates-title');
  nodes.get('update-dialog').hidden = true;

  await nodes.get('settings-updates-task').dispatch('click');
  assert.equal(
    nodes.get('update-dialog').hidden,
    false,
    'the Updates task directly opens available progress and install controls',
  );

  await nodes.get('update-button').onclick();
  assert.equal(installs, 0, 'the settings row lets a person read the update before installing');
  assert.equal(nodes.get('panel-settings').hidden, false, 'update actions live in Settings');
  assert.equal(nodes.get('update-dialog').hidden, false);
  assert.notEqual(nodes.get('update-dialog').open, true, 'update details do not create a modal window');

  const installing = nodes.get('update-install').onclick();
  assert.equal(installs, 1);
  assert.equal(JSON.parse(localStorage.getItem('update-restart')).version, '0.2.0');
  assert.equal(nodes.get('update-later').disabled, false, 'download can be collapsed');
  assert.equal(nodes.get('update-progress-label').textContent, t('update.downloading'));
  updateFound({ version: '0.3.0', notes: 'A newer discovery during download' });
  assert.equal(nodes.get('update-title').textContent, t('update.title', { version: 'v0.2.0' }));
  assert.equal(nodes.get('update-progress').getAttribute('value'), null, 'unknown size keeps an indeterminate bar');
  updateStatus({ phase: 'downloading', received: 5, total: 20, percent: 25 });
  assert.equal(nodes.get('update-progress').value, 25);
  assert.match(nodes.get('update-progress-label').textContent, /25/);
  nodes.get('update-later').onclick();
  assert.equal(nodes.get('update-dialog').hidden, true);
  assert.equal(nodes.get('panel-settings').hidden, false, 'Later folds the details and keeps Settings open');
  assert.equal(nodes.get('update-compact').hidden, false, 'small windows retain a progress entry point');
  updateStatus({ phase: 'verifying' });
  assert.equal(nodes.get('update-dialog').hidden, true, 'progress never reopens collapsed details');
  assert.equal(nodes.get('update-progress').hidden, true);
  assert.equal(nodes.get('update-progress-label').textContent, t('update.verifying'));
  updateStatus({ phase: 'installing' });
  assert.equal(nodes.get('update-progress-label').textContent, t('update.installing'));

  finishInstall({ ok: false, error: 'The update could not be installed.' });
  await installing;
  assert.equal(localStorage.getItem('update-restart'), '', 'a failed installation leaves no success notice');
  assert.equal(nodes.get('update-dialog').hidden, true, 'failure does not reopen collapsed details');
  nodes.get('update-pill').onclick();
  assert.equal(nodes.get('panel-settings').hidden, false, 'the yard entry navigates to Settings');
  assert.equal(nodes.get('update-dialog').hidden, false, 'the error remains available in Settings');
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

test('repeated background discoveries stay silent and preserve focus', context => {
  installStorage(context);
  const { nodes, document } = installDom(context, { anyId: true, props: { hidden: true } });
  setData({ pets: [], version: '1.0.0' });
  const focus = document.activeElement;
  updateFound({ version: '1.1.0' });
  updateFound({ version: '1.1.0' });
  assert.equal(nodes.get('toast')?.hidden ?? true, true, 'background checks do not toast');
  assert.equal(nodes.get('panel-settings')?.hidden ?? true, true);
  assert.equal(document.activeElement, focus);
});

test('the small-window update entry keeps its readable name without a full text banner', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /id="update-compact-label" class="sr-only"/);
  const css = await readFile('src/styles/dialog.css', 'utf8');
  assert.match(css, /body\.compact \.update-compact\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  assert.match(css, /\.update-compact::after\s*\{/);
});

test('a failed check without a release keeps its check action visible beside the error', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile('src/styles/settings.css', 'utf8');
  assert.match(
    css,
    /#settings-updates:has\(#update-dialog:not\(\[hidden\]\) #update-install:not\(\[hidden\]\)\) :is\(\.update-summary, \.update-auto\)/,
  );
});
