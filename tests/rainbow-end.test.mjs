import assert from 'node:assert/strict';
import test from 'node:test';
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

test('the rainbow never ends in water or under a tree, and not at all without soil', t => {
  installDom(t, { anyId: true });
  t.after(clearRainbowEnd);
  const pond = { ...open, water: [{ x: 0.5, y: 0.5, rx: 0.2, ry: 0.2 }] };
  const end = placeRainbowEnd(1000, { ground: pond, rng: draws(0.5, 0.5, 0.1, 0.1) });
  assert.ok(end && Math.hypot(end.x - 0.5, end.y - 0.5) > 0.2);
  assert.equal(placeRainbowEnd(1000, { ground: { ...open, soil: false } }), null);
  assert.ok(!atRainbowEnd({ x: 0.5, y: 0.5 }, 0));
});
