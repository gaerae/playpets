import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage } from './support/dom.mjs';

globalThis.playPets = {
  checkUpdate: async () => ({ ok: false, error: 'The update server could not be reached.' }),
};
globalThis.requestAnimationFrame = () => {};
installStorage();
const { checkForUpdates } = await import('../src/panel/settings.js');
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');

test('a failed tray update check restores the settings row and retry button', async context => {
  const { nodes } = installDom(context, {
    ids: [
      'panel-invite',
      'panel-pet',
      'panel-settings',
      'layout',
      'side-panel',
      'panel-title',
      'about-title',
      'update-button',
      'update-note',
      'update-notes',
      'update-pill',
      'update-compact',
    ],
    props: { hidden: true, disabled: false, scrollIntoView() {} },
  });
  for (const node of nodes.values()) node.dataset.title = 'settings.title';
  setData({ pets: [], version: '0.1.0' });
  await assert.rejects(checkForUpdates(), /update server/);
  assert.equal(nodes.get('update-button').disabled, false);
  assert.equal(nodes.get('update-button').textContent, t('settings.update_check'));
  assert.equal(nodes.get('update-note').textContent, t('settings.update_current', { version: 'v0.1.0' }));
});

test('Store installations explain Store-managed updates and hide the installer action', async context => {
  const { nodes } = installDom(context, {
    ids: ['update-button', 'update-note', 'update-notes', 'update-pill', 'update-compact'],
  });
  setData({ pets: [], version: '0.2.0', updateChannel: 'store' });
  const { renderUpdate } = await import('../src/panel/settings.js');
  renderUpdate();
  assert.equal(nodes.get('update-note').textContent, t('settings.update_store'));
  assert.equal(nodes.get('update-button').hidden, true);
  assert.equal(nodes.get('update-pill').hidden, true);
  setData({ pets: [], version: '0.2.0', updateChannel: 'github' });
  renderUpdate();
  assert.equal(nodes.get('update-button').hidden, false);
});

test('the Store tray update action opens its explanation without calling the updater', async context => {
  const { nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  for (const node of nodes.values()) node.dataset.title = 'settings.title';
  setData({ pets: [], version: '0.2.0', updateChannel: 'store' });
  // The installed backend fake rejects every check; reaching it would fail this test.
  await checkForUpdates();
  assert.equal(nodes.get('update-note').textContent, t('settings.update_store'));
});

test('a slow update check keeps its result quiet after Settings closes', async context => {
  const { nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  setData({ pets: [], version: '1.0.0', updateChannel: 'github' });
  let finish;
  const previous = globalThis.playPets.checkUpdate;
  context.after(() => {
    globalThis.playPets.checkUpdate = previous;
  });
  globalThis.playPets.checkUpdate = () =>
    new Promise(resolve => {
      finish = resolve;
    });
  const pending = checkForUpdates();
  const { openPanel } = await import('../src/panel/tabs.js');
  openPanel(null);
  finish({ ok: true, data: { version: '1.1.0', notes: 'A new version' } });
  await pending;
  assert.equal(nodes.get('update-dialog').hidden, true);
  assert.equal(nodes.get('update-pill').hidden, false, 'the result remains available without stealing focus');
});
