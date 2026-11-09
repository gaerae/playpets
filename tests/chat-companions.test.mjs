import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('who joins in opens from its button as a dropdown, and Esc or a press elsewhere closes it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { setupChat } = await import('../src/panel/chat.js');
  installDom(t, { anyId: true, props: { value: '', scrollHeight: 0 } });
  globalThis.Option = class {};
  const get = id => document.getElementById(id);
  const toggle = get('companion-toggle'),
    chips = get('companion-chips');
  chips.hidden = true;
  get('companions').append(toggle, chips);
  setupChat();
  const press = target => document.dispatch('pointerdown', { target });
  await toggle.dispatch('click');
  assert.equal(chips.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  await press(chips);
  assert.equal(chips.hidden, false, 'a press on a chip keeps it open');
  await chips.dispatch('keydown', { key: 'Escape' });
  assert.equal(chips.hidden, true);
  assert.equal(document.activeElement, toggle, 'focus goes back to the button');
  await toggle.dispatch('click');
  await press(get('chat-log'));
  assert.equal(chips.hidden, true, 'a press elsewhere closes it');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('who joins in is a button and a panel, not a disclosure with its own dismissal', async () => {
  const html = await readFile('src/index.html', 'utf8');
  assert.match(html, /<button id="companion-toggle"[^>]*aria-expanded="false"/);
  assert.match(html, /<div id="companion-chips"[^>]*hidden/);
  assert.doesNotMatch(html, /<details id="companions"/);
});
