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

// The lake and what stands on the field, in field units, as ground.js measures them.
const pond = { water: [{ x: 0.5, y: 0.5, rx: 0.2, ry: 0.2 }], obstacles: [{ x: 0.9, y: 0.9, rx: 0.06, ry: 0.06 }] };

test('a stroll stays out of the water and ends clear of what stands on the field', () => {
  assert.ok(wander.strollClear({ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, pond), 'dry ground is fine');
  assert.ok(!wander.strollClear({ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, pond), 'never into the lake');
  assert.ok(!wander.strollClear({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, pond), 'never across it');
  assert.ok(!wander.strollClear({ x: 0.8, y: 0.8 }, { x: 0.9, y: 0.9 }, pond), 'never onto a tree or a flower');
  assert.ok(
    wander.strollClear({ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.1 }, pond),
    'a friend set down in the water walks out',
  );
  assert.ok(
    wander.strollClear({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, null),
    'a place without ground notes has no water',
  );
});

test('a friend picks a stroll the ground allows, and stays put when there is none', () => {
  const dry = (from, to) => wander.strollClear(from, to, pond);
  for (let i = 0; i < 300; i++) {
    const from = { x: 0.1, y: 0.15 },
      target = wander.wanderTarget(from, Math.random, dry);
    if (target) assert.ok(dry(from, target), `the stroll to ${JSON.stringify(target)} is dry`);
  }
  assert.equal(
    wander.wanderTarget({ x: 0.5, y: 0.5 }, Math.random, () => false),
    null,
  );
});
