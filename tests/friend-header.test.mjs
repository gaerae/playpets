// The Friend tab's header (src/panel/friend.js): what it says about the friend, in the yard's words.

import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, keepGlobals } from './support/dom.mjs';

globalThis.playPets = { getChat: async () => ({ ok: true, data: [] }) };
const { setData, setSelected } = await import('../src/core/state.js');
const { t: words } = await import('../src/core/i18n.js');
const { renderPanel } = await import('../src/panel/friend.js');

function page(t, agentPets = {}) {
  const { document } = installDom(t, { anyId: true, props: { value: '', scrollHeight: 0 } });
  keepGlobals(t, 'Option');
  globalThis.Option = class {};
  setData({
    pets: [{ id: 'daisy', assetId: 'cat', name: 'Daisy' }],
    assets: [],
    providers: [],
    busy: [],
    bonds: {},
    agentPets,
    agents: [{ kind: 'claude', label: 'Claude Code' }],
  });
  setSelected('daisy');
  renderPanel();
  return id => document.getElementById(id);
}

// The ID is for an agent's hooks: a friend no agent reports to has no use for it.
test("the friend's ID shows only while a coding agent reports to it", t => {
  assert.equal(page(t)('instance-id').hidden, true);
  assert.equal(page(t, { claude: 'daisy' })('instance-id').hidden, false);
});

// "12 points to At ease" read like a score: the line names the next level and what it brings.
test('the closeness line names the next level and what it brings, without points', t => {
  const line = page(t)('bond-next').textContent;
  assert.equal(line, words('bond.next', { level: words('bond.level_2'), unlock: words('bond.unlock_2') }));
  assert.doesNotMatch(line, /\d/);
});
