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
