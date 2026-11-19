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

// A stroll is a few of the friend's own steps whatever the window, as its pace is (motion.js): a
// share of the yard made a full screen's strolls three times as long, and the yard drew all the while.
test('a stroll is a few body lengths in any window', () => {
  for (const [width, height, size] of [
    [1728, 1080, 112],
    [1180, 850, 112],
    [560, 400, 56],
  ]) {
    const body = { x: size / width, y: size / height };
    for (let i = 0; i < 300; i++) {
      const from = { x: 0.5, y: 0.6 },
        to = wander.wanderTarget(from, Math.random, () => true, body);
      const bodies = Math.hypot((to.x - from.x) * width, (to.y - from.y) * height) / size;
      assert.ok(bodies >= 1 && bodies <= 3, `${width}x${height}: ${bodies.toFixed(2)} body lengths`);
    }
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
  assert.deepEqual(wander.idleAction(rngOf([0.1, 0.6])), { type: 'pose', pose: 'wave' }, 'a jump is the rarer pose');
  assert.deepEqual(wander.idleAction(rngOf([0.2])), { type: 'move' });
  let moves = 0,
    jumps = 0;
  for (let i = 0; i < 4000; i++) {
    const action = wander.idleAction(Math.random);
    if (action.type === 'move') moves++;
    if (action.pose === 'jump') jumps++;
  }
  assert.ok(moves > 3400, 'strolling dominates so pets feel alive, not twitchy');
  assert.ok(jumps < 220, 'a jump on its own is rare');
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
