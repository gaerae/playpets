import assert from 'node:assert/strict';
import test from 'node:test';
import { behind, freeSpot, groundAllows, projectFootprint, treeStage } from '../src/yard/discovery-rules.js';

const ground = {
  soil: true,
  bounds: { left: 0, top: 0, right: 1, bottom: 1 },
  water: [{ x: 0.5, y: 0.1, rx: 0.2, ry: 0.1 }],
  obstacles: [{ x: 0.7, y: 0.7, rx: 0.1, ry: 0.05 }],
};
test('ground rejects floors, water, roots, non-finite and outside targets before moving a friend', () => {
  assert.equal(groundAllows({ x: 0.3, y: 0.5 }, ground), true);
  for (const p of [
    { x: 0.5, y: 0.1 },
    { x: 0.7, y: 0.7 },
    { x: -0.1, y: 0.2 },
    { x: NaN, y: 0.2 },
    { x: 0.2, y: Infinity },
  ])
    assert.equal(groundAllows(p, ground), false);
  assert.equal(groundAllows({ x: 0.3, y: 0.5 }, { ...ground, soil: false }), false);
});
test('tree stages include closed-app time but never regress when the clock moves backwards', () => {
  const tree = { planted: 1000, stage: 0 };
  assert.equal(treeStage(tree, 1000), 0);
  assert.equal(treeStage(tree, 1000 + 7200000), 1);
  assert.equal(treeStage(tree, 1000 + 43200000), 2);
  assert.equal(treeStage({ ...tree, stage: 2 }, 0), 2);
});
test('footprints project into field coordinates without losing off-field water edges', () => {
  const box = { width: 1000, top: 600, bottom: 900 };
  const ellipse = projectFootprint({ x: 500, y: 580, rx: 100, ry: 40 }, box);
  assert.equal(ellipse.x, 0.5);
  assert.ok(ellipse.y < 0);
  assert.equal(ellipse.ry, 40 / 300);
  assert.equal(groundAllows({ x: 0.5, y: 0.01 }, { ...ground, water: [ellipse], obstacles: [] }), false);
});

const open = { soil: true, bounds: { left: 0, top: 0, right: 1, bottom: 1 }, water: [], obstacles: [] };
const draws =
  (...values) =>
  () =>
    values.shift() ?? 0.5;
test('a free spot is the first draw inside the ranges that the ground allows and the check accepts', () => {
  const pond = { ...open, water: [{ x: 0.5, y: 0.5, rx: 0.2, ry: 0.2 }] };
  const ranges = { x: [0.1, 0.9], y: [0.2, 0.8] };
  assert.deepEqual(freeSpot(draws(0, 1), open, ranges), { x: 0.1, y: 0.8 });
  assert.deepEqual(freeSpot(draws(0.5, 0.5, 0, 0), pond, ranges), { x: 0.1, y: 0.2 }, 'the pond draw is skipped');
  const left = p => p.x < 0.3;
  const spot = freeSpot(draws(0.9, 0.5, 0.1, 0.5), open, ranges, left);
  assert.ok(Math.abs(spot.x - 0.18) < 1e-9 && spot.y === 0.5, 'the check too');
  assert.equal(
    freeSpot(() => 0.5, pond, ranges),
    null,
    'twenty tries, then none',
  );
  assert.equal(
    freeSpot(() => 0.5, { ...open, soil: false }, ranges),
    null,
  );
});
test('a spot behind an obstacle is one whose body would hide it', () => {
  const bush = { ...open, obstacles: [{ x: 0.5, y: 0.6, rx: 0.1, ry: 0.1 }] };
  assert.equal(behind({ x: 0.5, y: 0.4 }, bush), true, 'above the foot, where the body stands');
  assert.equal(behind({ x: 0.5, y: 0.9 }, bush), false, 'in front of it');
  assert.equal(behind({ x: 0.1, y: 0.4 }, bush), false, 'beside it');
  assert.equal(behind({ x: 0.5, y: 0.4 }, open), false);
});
