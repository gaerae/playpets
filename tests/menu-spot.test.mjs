import assert from 'node:assert/strict';
import test from 'node:test';
import { panelSpot } from '../src/core/menu.js';

const yard = { left: 0, top: 0, width: 1000, height: 700 };
const panel = { width: 280, height: 320 };

test('a panel opened from the right-click menu starts where the pointer was', () => {
  assert.deepEqual(panelSpot({ x: 200, y: 150 }, panel, yard), { left: 200, top: 150 });
});

test('a panel near an edge stays whole inside the yard', () => {
  assert.deepEqual(panelSpot({ x: 950, y: 680 }, panel, yard), { left: 712, top: 372 });
  assert.deepEqual(panelSpot({ x: 2, y: 3 }, panel, yard), { left: 8, top: 8 });
});

test('the spot is measured from the yard, wherever the yard sits in the window', () => {
  const inset = { left: 100, top: 40, width: 800, height: 600 };
  assert.deepEqual(panelSpot({ x: 300, y: 140 }, panel, inset), { left: 200, top: 100 });
});

test('a panel taller than the yard keeps its top in view', () => {
  assert.deepEqual(panelSpot({ x: 10, y: 500 }, { width: 280, height: 900 }, yard), { left: 10, top: 8 });
});
