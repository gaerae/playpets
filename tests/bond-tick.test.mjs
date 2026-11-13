// Time together (src/yard/bond.js bondTick): every friend in the yard is counted with one call to
// the backend, which saves and tells every page once, not once per friend.

import assert from 'node:assert/strict';
import test from 'node:test';

const calls = [];
globalThis.playPets = {
  befriend: async (...args) => {
    calls.push(['befriend', ...args]);
    return { ok: true, data: { points: 1, level: 1, up: false } };
  },
  befriendMany: async (...args) => {
    calls.push(['befriendMany', ...args]);
    return { ok: true, data: {} };
  },
};
const { views } = await import('../src/core/state.js');
const { bondTick } = await import('../src/yard/bond.js');

const TEN_MINUTES = 10 * 60 * 1000;

test('time together counts every friend in the yard with one call', () => {
  views.clear();
  for (const id of ['a', 'b', 'c']) views.set(id, { pet: { id } });
  calls.length = 0;
  bondTick(1);
  assert.deepEqual(calls, [], 'the first look only starts the clock');
  bondTick(1 + TEN_MINUTES);
  assert.equal(calls.length, 1);
  const [name, ids, reason, day] = calls[0];
  assert.equal(name, 'befriendMany');
  assert.deepEqual(ids, ['a', 'b', 'c']);
  assert.equal(reason, 'time');
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
});

test('an empty yard asks nothing', () => {
  views.clear();
  calls.length = 0;
  bondTick(1 + 3 * TEN_MINUTES);
  assert.deepEqual(calls, []);
});
