import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './support/dom.mjs';

const calls = [];
globalThis.playPets = {
  setSound: async (...args) => {
    calls.push(args);
    return { ok: true, data: null };
  },
};
const { setupSound, renderSound } = await import('../src/yard/sound.js');
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');

test('Atmosphere owns sound with one toggle and volume, preserving focused slider edits', async context => {
  const { nodes, document, element } = installDom(context, {
    ids: ['sound-button', 'sound-volume'],
  });
  document.hidden = true;
  const icon = element('span', { dataset: { icon: 'sound' } });
  nodes.get('sound-button').append(icon);
  setData({ sound: { on: true, volume: 40 } });
  setupSound();
  renderSound();
  assert.equal(document.getElementById('sound-on'), null, 'there is no Settings copy');
  assert.equal(nodes.get('sound-button').getAttribute('aria-pressed'), 'true');
  assert.equal(nodes.get('sound-volume').value, '40');
  assert.equal(nodes.get('sound-volume').disabled, false);
  await nodes.get('sound-button').dispatch('click');
  assert.deepEqual(calls, [[false, null]]);

  setData({ sound: { on: false, volume: 25 } });
  renderSound();
  assert.equal(nodes.get('sound-button').title, t('sound.turn_on'));
  assert.equal(icon.dataset.icon, 'sound-off');
  assert.equal(nodes.get('sound-volume').disabled, true);
  assert.equal(nodes.get('sound-volume').value, '25');

  setData({ sound: { on: true, volume: 25 } });
  nodes.get('sound-volume').value = '65';
  nodes.get('sound-volume').focus();
  renderSound();
  assert.equal(nodes.get('sound-volume').value, '65', 'state refresh preserves the drag in progress');
  await nodes.get('sound-volume').dispatch('change');
  assert.deepEqual(calls.at(-1), [null, 65]);
});
