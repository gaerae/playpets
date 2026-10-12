import assert from 'node:assert/strict';
import test from 'node:test';
import { companions, setData, setSelected } from '../src/core/state.js';
import { renderChat } from '../src/panel/chat.js';
import { installDom } from './support/dom.mjs';

test('companion selection exposes its current state to assistive technology', t => {
  const { nodes } = installDom(t, {
    ids: [
      'provider-select',
      'send',
      'cancel',
      'message',
      'clear-chat',
      'chat-log',
      'chat-note',
      'companions',
      'companion-chips',
      'companion-summary',
    ],
    props: { value: '', scrollHeight: 0 },
  });
  globalThis.Option = class {};
  const friend = { id: 'a', assetId: 'cat', name: 'Daisy', providerId: 'local' };
  setData({
    pets: [friend, { ...friend, id: 'b', name: 'Clover' }],
    assets: [],
    providers: [],
    busy: [],
  });
  setSelected(friend.id);
  companions.clear();
  renderChat(friend);
  let chip = nodes.get('companion-chips').children[0];
  assert.equal(chip.getAttribute('aria-pressed'), 'false');
  chip.focus();
  chip.onclick();
  chip = nodes.get('companion-chips').children[0];
  assert.equal(chip.getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, chip, 'keyboard focus stays on the selected companion');
  chip.onclick();
  chip = nodes.get('companion-chips').children[0];
  assert.equal(chip.getAttribute('aria-pressed'), 'false');
  assert.equal(document.activeElement, chip, 'keyboard focus stays after deselection');
});
