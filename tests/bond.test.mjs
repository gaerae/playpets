// Closeness as the page shows it (src/yard/bond.js): the level, the share of the way to the next,
// what is left, and the lines a friend says in the voice of who it is to the person.

import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMITS } from '../src/core/limits.js';
import { bondProgress, lineFor } from '../src/yard/bond.js';

const steps = LIMITS.bondLevels;

test('a level begins at its points, the bar fills towards the next, and the last is full', () => {
  assert.deepEqual(bondProgress(0, steps), { level: 1, share: 0, left: 60 });
  assert.deepEqual(bondProgress(30, steps), { level: 1, share: 0.5, left: 30 });
  assert.deepEqual(bondProgress(60, steps), { level: 2, share: 0, left: 140 });
  assert.equal(bondProgress(999, steps).level, 4);
  assert.deepEqual(bondProgress(1000, steps), { level: 5, share: 1, left: 0 });
  assert.deepEqual(bondProgress(5000, steps), { level: 5, share: 1, left: 0 });
});

test('a friend with a relationship speaks in its own voice; a friend in the plain one', () => {
  const plain = lineFor({ relation: '' }, 'bond.welcome'),
    partner = lineFor({ relation: 'partner' }, 'bond.welcome');
  assert.ok(typeof plain === 'string' && plain.length > 0);
  assert.ok(typeof partner === 'string' && partner.length > 0);
  assert.ok(
    lineFor({ relation: 'nobody-knows' }, 'bond.dear').length > 0,
    'an unknown one falls back to the plain lines',
  );
});
