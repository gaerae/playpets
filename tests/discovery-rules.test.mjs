import assert from 'node:assert/strict';
import test from 'node:test';
import { groundAllows, projectFootprint, treeStage } from '../src/yard/discovery-rules.js';

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
