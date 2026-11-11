import assert from 'node:assert/strict';
import test from 'node:test';
import { dugSpots } from '../src/yard/discovery-rules.js';
import { atRainbowEnd, clearRainbowEnd, placeRainbowEnd } from '../src/yard/rainbow-end.js';
import { installDom } from './support/dom.mjs';

const open = { soil: true, bounds: { left: 0, top: 0, right: 1, bottom: 1 }, water: [], obstacles: [] };
const draws =
  (...values) =>
  () =>
    values.shift() ?? 0.5;

test('the rainbow ends on ground a friend could dig, and a dig counts only near it while it lasts', t => {
  installDom(t, { anyId: true });
  t.after(clearRainbowEnd);
  const end = placeRainbowEnd(1000, { ground: open, rng: draws(0.5, 0.5) });
  assert.ok(end);
  assert.equal(document.getElementById('yard').children.at(-1).className, 'rainbow-end');
  assert.ok(atRainbowEnd(end, 999));
  assert.ok(atRainbowEnd({ x: end.x + 0.03, y: end.y }, 999));
  assert.ok(!atRainbowEnd({ x: end.x + 0.2, y: end.y }, 999), 'elsewhere in the yard');
  assert.ok(!atRainbowEnd(end, 1000), 'after the rainbow has gone');
  clearRainbowEnd();
  assert.ok(!atRainbowEnd(end, 0), 'once cleared');
});

test('the rainbow ends in the middle of a tile not dug today, and a dig counts anywhere on that tile', t => {
  installDom(t, { anyId: true });
  t.after(clearRainbowEnd);
  // The first draw falls on the tile dug this morning, the second on one dug two days ago.
  const dug = [
    { world: 'meadow', tileX: 4, tileY: 4, at: 0 },
    { world: 'meadow', tileX: 2, tileY: 2, at: 1000 - 2 * 86_400_000 },
  ];
  const day = 86_400_000;
  const end = placeRainbowEnd(day + 1000, {
    ground: open,
    rng: draws(0.55, 0.55, 0.3, 0.15),
    dug: dugSpots(dug, 'meadow', 1000),
  });
  assert.deepEqual(end, { x: 2.5 / 8, y: 2.5 / 8, until: day + 1000 });
  assert.ok(atRainbowEnd({ x: 2.05 / 8, y: 2.95 / 8 }, 1000), 'a corner of its tile');
  assert.ok(!atRainbowEnd({ x: 3.05 / 8, y: 2.5 / 8 }, 1000), 'the next tile');
  assert.deepEqual(dugSpots(dug, 'meadow', day + 1), [], 'the backend forgets a dig after a day');
  assert.deepEqual(dugSpots(dug, 'lake', 0), [], 'another place');
});

test('the rainbow never ends in water or under a tree, and not at all without soil', t => {
  installDom(t, { anyId: true });
  t.after(clearRainbowEnd);
  const pond = { ...open, water: [{ x: 0.5, y: 0.5, rx: 0.2, ry: 0.2 }] };
  const end = placeRainbowEnd(1000, { ground: pond, rng: draws(0.5, 0.5, 0.1, 0.1) });
  assert.ok(end && Math.hypot(end.x - 0.5, end.y - 0.5) > 0.2);
  assert.equal(placeRainbowEnd(1000, { ground: { ...open, soil: false } }), null);
  assert.ok(!atRainbowEnd({ x: 0.5, y: 0.5 }, 0));
});
