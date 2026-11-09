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
    anyId: true,
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
      'update-error',
      'update-dialog',
    ],
    props: { hidden: true, disabled: false, scrollIntoView() {} },
  });
  for (const node of nodes.values()) node.dataset.title = 'settings.title';
  setData({ pets: [], version: '0.1.0' });
  await checkForUpdates();
  assert.match(nodes.get('update-error').textContent, /update server/);
  assert.equal(nodes.get('update-button').disabled, false);
  assert.equal(nodes.get('update-button').textContent, t('settings.update_check'));
  assert.equal(nodes.get('update-note').textContent, t('settings.update_current', { version: 'v0.1.0' }));
});

test('Store installations with nothing new say the Store installs updates and keep the check', async context => {
  const { nodes } = installDom(context, {
    anyId: true,
    ids: ['update-button', 'update-note', 'update-notes', 'update-pill', 'update-compact', 'update-auto'],
  });
  setData({ pets: [], version: '0.2.0', updateChannel: 'store' });
  const { renderUpdate } = await import('../src/panel/settings.js');
  renderUpdate();
  assert.equal(nodes.get('update-note').textContent, t('settings.update_store'));
  assert.equal(nodes.get('update-button').hidden, false, 'a person can ask the Store now');
  assert.equal(nodes.get('update-pill').hidden, true);
  assert.equal(nodes.get('update-auto').hidden, true, 'the Store keeps its own schedule');
  setData({ pets: [], version: '0.2.0', updateChannel: 'github' });
  renderUpdate();
  assert.equal(nodes.get('update-button').hidden, false);
  assert.equal(nodes.get('update-auto').hidden, false);
});

test('the Store tray update action asks the Store and keeps its note when nothing is new', async context => {
  const { nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  for (const node of nodes.values()) node.dataset.title = 'settings.title';
  setData({ pets: [], version: '0.2.0', updateChannel: 'store' });
  let asked = 0;
  const previous = globalThis.playPets.checkUpdate;
  context.after(() => {
    globalThis.playPets.checkUpdate = previous;
  });
  globalThis.playPets.checkUpdate = async () => {
    asked++;
    return { ok: true, data: { channel: 'store' } };
  };
  await checkForUpdates();
  assert.equal(asked, 1);
  assert.equal(nodes.get('update-note').textContent, t('settings.update_store'));
  assert.equal(nodes.get('update-pill').hidden, true);
});

test('concurrent manual checks share the pending request', async context => {
  const { nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  // Runs before any test that leaves a discovery behind, so the check is really made.
  setData({ pets: [], version: '1.0.0', updateChannel: 'github' });
  let requests = 0;
  let finish;
  const previous = globalThis.playPets.checkUpdate;
  context.after(() => {
    globalThis.playPets.checkUpdate = previous;
  });
  globalThis.playPets.checkUpdate = () => {
    requests++;
    return new Promise(resolve => {
      finish = resolve;
    });
  };
  const pending = checkForUpdates();
  await checkForUpdates();
  assert.equal(requests, 1);
  finish({ ok: true, data: null });
  await pending;
  assert.equal(nodes.get('update-button').disabled, false);
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

test('the tray update action goes directly to Updates rather than app information', async context => {
  const { document, nodes } = installDom(context, { anyId: true, props: { hidden: true } });
  for (const id of [
    'settings-updates-task',
    'settings-about-task',
    'settings-updates',
    'settings-about',
    'settings-home',
    'settings-content',
  ])
    document.getElementById(id);
  const choice = nodes.get('settings-updates-task');
  choice.dataset.section = 'updates-title';
  const aboutChoice = nodes.get('settings-about-task');
  aboutChoice.dataset.section = 'about-title';
  const updates = nodes.get('settings-updates');
  updates.dataset.settingsSection = 'updates-title';
  const about = nodes.get('settings-about');
  about.dataset.settingsSection = 'about-title';
  document.querySelectorAll = selector =>
    selector.includes('settings-index')
      ? [choice, aboutChoice]
      : selector.includes('data-settings-section')
        ? [updates, about]
        : [];
  // A small window, where Settings shows one section at a time without its list.
  document.body.classList.add('compact');
  setData({ pets: [], version: '1.1.0', updateChannel: 'store' });
  await checkForUpdates();
  assert.equal(updates.hidden, false);
  assert.equal(about.hidden, true);
  assert.equal(nodes.get('settings-home').hidden, true);
});

test('a new version marks the single Settings entry in the menu', async context => {
  installDom(context, { anyId: true });
  const settings = document.getElementById('menu-settings');
  const { updateFound, renderUpdate } = await import('../src/panel/settings.js');
  setData({ pets: [], version: '1.0.0', updateChannel: 'github' });
  updateFound({ version: '1.1.0', notes: '' });
  assert.equal(settings.classList.contains('has-update'), true);
  setData({ pets: [], version: '1.0.0', updateChannel: 'store' });
  updateFound({ channel: 'store', version: '1.2.0' });
  renderUpdate();
  assert.equal(settings.classList.contains('has-update'), true, 'a version waiting in the Store marks it too');
});
