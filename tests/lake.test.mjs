// The lake's shape (src/yard/layout.js lakeShape), which the painter and fishing share: the water
// shows between where the far shore rises above the hill in front, and only there counts as water.

import assert from 'node:assert/strict';
import test from 'node:test';
import { composition, lakeShape, trace } from '../src/yard/layout.js';
import { yard } from './support/content.mjs';

const shapeAt = (w, h) => lakeShape(w, h, trace(composition.curves[composition.lake.under], w, h));

test('the water shows between the ends, above the hill in front, at any yard size', () => {
  for (const [w, h] of [
    [1130, 690],
    [455, 510],
    [420, 300],
    [2400, 1300],
  ]) {
    const l = shapeAt(w, h),
      [a, b] = l.ends;
    assert.ok(l.x0 < a && a < b && b < l.x1, `${w}×${h}: the ends lie inside the lake's span`);
    for (let k = 1; k < 20; k++) {
      const x = a + ((b - a) * k) / 20;
      assert.ok(l.shoreAt(x) < l.ridgeAt(x), `${w}×${h}: the far shore is above the hill at ${x}`);
      assert.ok(l.onWater(x, (l.shoreAt(x) + l.ridgeAt(x)) / 2), 'between the two is water');
      assert.ok(!l.onWater(x, l.shoreAt(x) - 2), 'above the far shore is not');
      assert.ok(!l.onWater(x, l.ridgeAt(x) + 2), 'below the hill in front is not');
    }
    assert.equal(l.shoreAt(l.x0 - 1), Infinity, 'outside the span there is no shore');
    assert.equal(l.shoreAt(l.x1 + 1), Infinity);
    assert.ok(!l.onWater(l.x1 + 5, l.top + 5));
  }
});

test('a lake drawn lower than the hill in front shows no water anywhere', () => {
  const saved = { ...composition.lake };
  try {
    Object.assign(composition.lake, { top: 0.9 });
    const l = shapeAt(1000, 700);
    assert.deepEqual(l.ends, [l.x0, l.x1], 'the ends fall back to the span');
    for (let x = l.x0; x <= l.x1; x += 10) assert.ok(!l.onWater(x, l.ridgeAt(x) - 1));
  } finally {
    Object.assign(composition.lake, saved);
  }
  assert.equal(composition.lake.top, yard.lake.top);
});
