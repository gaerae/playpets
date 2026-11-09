import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, installStorage, keepGlobals } from './support/dom.mjs';

globalThis.requestAnimationFrame = () => {};
let installs = 0;
globalThis.playPets = {
  installUpdate: async () => {
    installs++;
    return { ok: true, data: { store: true } };
  },
};
const { setupUpdates, updateFound } = await import('../src/panel/update.js');
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');

test('a version waiting in Microsoft Store shows in the yard and sends the person to the Store', async context => {
  installStorage(context);
  keepGlobals(context, 'Option', 'setTimeout');
  globalThis.Option = class {};
  globalThis.setTimeout = () => 1;
  const { nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  setData({ pets: [], version: '1.5.0', updateChannel: 'store', project: {} });
  setupUpdates();
  updateFound({ channel: 'store', version: '1.6.0' });
  assert.equal(nodes.get('update-pill').hidden, false);
  assert.match(nodes.get('update-pill-label').textContent, /v1\.6\.0/);
  assert.equal(nodes.get('update-note').textContent, t('settings.update_available', { version: 'v1.6.0' }));
  assert.equal(nodes.get('update-auto').hidden, true, 'the Store keeps its own schedule');
  nodes.get('update-pill').onclick();
  assert.equal(nodes.get('update-dialog').hidden, false);
  assert.equal(nodes.get('update-body').textContent, t('update.store_body', { current: 'v1.5.0' }));
  assert.equal(nodes.get('update-install').textContent, t('settings.update_in_store'));
  await nodes.get('update-install').onclick();
  assert.equal(installs, 1);
  assert.ok(!localStorage.getItem('update-restart'), 'the Store, not this app, installs it');
  assert.equal(nodes.get('update-progress-wrap').hidden, true);
  assert.equal(nodes.get('update-install').disabled, false, 'the Store page can be opened again');
});
