import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

globalThis.playPets = Object.fromEntries(
  ['setAutoChatter', 'toggleDesktopWander', 'assignAgent'].map(method => [
    method,
    async () => ({ ok: false, error: 'The setting could not be saved.' }),
  ]),
);
// What the system says about starting at login, which can change behind the app's back.
let startsAtLogin = true;
globalThis.playPets.readAutostart = async () => ({ ok: true, data: startsAtLogin });
const { setupSettings } = await import('../src/panel/settings.js');
const { setData } = await import('../src/core/state.js');

function page(t) {
  const { document, element, window } = installDom(t, {
    anyId: true,
    props: { disabled: false, value: '', checked: false },
  });
  const agent = element('select');
  agent.dataset.agent = 'codex';
  globalThis.Option = class {};
  document.querySelectorAll = selector => (selector === 'select[data-agent]' ? [agent] : []);
  setData({
    pets: [{ id: 'first' }, { id: 'second' }],
    agentPets: { codex: 'first' },
    autoChatter: false,
    desktopWander: false,
    desktop: true,
  });
  setupSettings();
  return { get: id => document.getElementById(id), agent, window };
}

test('rejected chatter and desktop movement switches reflect current settings again', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { get } = page(context);
  for (const id of ['auto-chatter', 'desktop-wander']) {
    get(id).checked = true;
    const pending = get(id).onchange();
    assert.equal(get(id).disabled, true);
    await pending;
    assert.equal(get(id).checked, false, id);
    assert.equal(get(id).disabled, false);
  }
  assert.equal(get('toast').textContent, 'The setting could not be saved.');
});

test('a rejected coding-agent assignment shows the current friend again', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { get, agent } = page(context);
  agent.value = 'second';
  const pending = agent.onchange();
  assert.equal(agent.disabled, true);
  await pending;
  assert.equal(agent.value, 'first');
  assert.equal(agent.disabled, false);
  assert.equal(get('toast').textContent, 'The setting could not be saved.');
});

test('coming back to the window shows start at login as the system has it now', async context => {
  const { get, window } = page(context);
  get('autostart').checked = true;
  // Turned off in the system's own settings while the app ran.
  startsAtLogin = false;
  context.after(() => {
    startsAtLogin = true;
  });
  await window.dispatch('focus');
  assert.equal(get('autostart').checked, false);
});
