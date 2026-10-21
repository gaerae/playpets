// The line above the yard (src/yard/hint.js): what it says, in order, and the agents' work.

import assert from 'node:assert/strict';
import test from 'node:test';
import { busyLine, hintKey } from '../src/yard/hint.js';

test('a game speaks first, then the tool in hand, then what there is still to learn', () => {
  const base = { game: null, aiming: false, friends: 2, patted: false, fished: false };
  assert.deepEqual(hintKey({ ...base, game: { hint: 'Find Mochi' }, aiming: 'seed' }), { text: 'Find Mochi' });
  for (const tool of ['seed', 'dig', 'tree'])
    assert.equal(hintKey({ ...base, aiming: tool }), null, `the ${tool} strip says what to do, not the line below`);
  assert.deepEqual(hintKey({ ...base, aiming: 'treat' }), { key: 'hint.treat' });
  assert.deepEqual(hintKey(base), { key: 'hint.pat' });
  assert.deepEqual(hintKey({ ...base, patted: true }), { key: 'hint.fish' });
  assert.equal(hintKey({ ...base, patted: true, fished: true }), null, 'nothing left to learn');
  assert.equal(hintKey({ ...base, friends: 0 }), null, 'no friend, nothing to press');
});

test('one busy friend is named with its state; none says nothing', () => {
  const friends = [
      { id: 'a', n: 'Tabby' },
      { id: 'b', n: 'Mochi' },
    ],
    states = { a: 'idle', b: 'working' };
  assert.equal(
    busyLine(
      friends,
      p => states[p.id],
      p => p.n,
      s => s.toUpperCase(),
    ),
    'Mochi, WORKING',
  );
  assert.equal(
    busyLine(
      friends,
      () => 'idle',
      p => p.n,
      s => s,
    ),
    '',
  );
  assert.ok(
    busyLine(
      friends,
      () => 'working',
      p => p.n,
      s => s,
    ).length > 0,
    'several are counted',
  );
});

test('discovery placement owns one instruction surface instead of duplicating the yard hint', () => {
  for (const aiming of ['dig', 'tree']) assert.equal(hintKey({ aiming, friends: 1, patted: true, fished: true }), null);
});

test('an empty hint removes its whole visual capsule and returns when there is an instruction', async context => {
  const { installDom } = await import('./support/dom.mjs');
  const state = await import('../src/core/state.js');
  const { hint } = await import('../src/yard/hint.js');
  const before = state.data;
  context.after(() => state.setData(before));
  installDom(context, { anyId: true });
  state.setData({ ...before, pets: [], statuses: {} });
  hint();
  assert.equal(document.getElementById('yard-hint').hidden, true);
  state.setData({ ...before, pets: [{ id: 'friend', name: 'Clover' }], statuses: {} });
  hint();
  assert.equal(document.getElementById('yard-hint').hidden, false);
});
