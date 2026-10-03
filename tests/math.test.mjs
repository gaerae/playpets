import assert from 'node:assert/strict';
import test from 'node:test';
import { clamp, shuffle } from '../src/core/math.js';

test('clamp keeps a number inside its range', () => {
  assert.equal(clamp(2), 1);
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(5, 1, 3), 3);
  assert.equal(clamp(0.4), 0.4);
});

test('shuffle keeps every item once and follows the random numbers it is given', () => {
  const items = [1, 2, 3, 4, 5];
  const out = shuffle(items, () => 0);
  assert.deepEqual([...out].sort(), items);
  assert.deepEqual(items, [1, 2, 3, 4, 5], 'the input is left alone');
  assert.deepEqual(
    shuffle(items, () => 0.999),
    items,
    'always picking the last leaves the order',
  );
});
