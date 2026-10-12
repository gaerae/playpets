// Idle life in the yard: where a friend strolls on its own, and how long it waits first.

import assert from 'node:assert/strict';
import test from 'node:test';
import { between } from '../src/core/math.js';
import * as wander from '../src/yard/wander.js';

const rngOf = values => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('wander targets always stay inside the yard and actually move the pet', () => {
  for (const position of [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0.5, y: 0.5 },
  ])
    for (let i = 0; i < 200; i++) {
      const target = wander.wanderTarget(position, Math.random);
      assert.ok(
        target.x >= 0 && target.x <= 1 && target.y >= 0 && target.y <= 1,
        `inside yard from ${JSON.stringify(position)}`,
      );
      assert.ok(
        Math.hypot(target.x - position.x, target.y - position.y) > 0.05,
        'a wander is a visible stroll, not a shuffle',
      );
    }
});

test('idle delays fall inside the configured window and scatter is quicker than wander', () => {
  const [wanderMin, wanderMax] = wander.WANDER_DELAY,
    [scatterMin, scatterMax] = wander.SCATTER_DELAY;
  assert.ok(scatterMax <= wanderMin, 'pets leave the treat sooner than a fresh idle wander');
  assert.equal(
    between(() => 0, wander.WANDER_DELAY),
    wanderMin,
  );
  assert.equal(
    between(() => 1, wander.WANDER_DELAY),
    wanderMax,
  );
  for (let i = 0; i < 100; i++) {
    const d = between(Math.random, wander.SCATTER_DELAY);
    assert.ok(d >= scatterMin && d <= scatterMax);
  }
});

test('idle actions are mostly strolls with occasional small poses', () => {
  assert.deepEqual(wander.idleAction(rngOf([0.9])), { type: 'move' });
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.2])), { type: 'pose', pose: 'wave' });
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.8])), { type: 'pose', pose: 'jump' });
  let moves = 0;
  for (let i = 0; i < 1000; i++) if (wander.idleAction(Math.random).type === 'move') moves++;
  assert.ok(moves > 600, 'strolling dominates so pets feel alive, not twitchy');
});

test('quiet companions greet without spontaneous jumping', () => {
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.8]), true), { type: 'pose', pose: 'wave' });
  assert.deepEqual(wander.idleAction(rngOf([0.9]), true), { type: 'move' });
});
