// Sprite sheet timing: frames must stay inside the cells a Codex pet sheet defines.

import assert from 'node:assert/strict';
import test from 'node:test';
import { frameAt, headroom, lookAt, lookFrame, renewsClock } from '../src/core/animation.js';

test('a friend looks toward the pointer, and nowhere while it is on its middle', () => {
  const rect = { x: 100, y: 100, width: 200, height: 200 };
  assert.deepEqual(lookAt(rect, 290, 110), { x: 90, y: -90 });
  assert.equal(lookAt(rect, 205, 195), null);
});

test('the empty rows above a sprite are measured from its first opaque pixel', () => {
  const w = 4,
    h = 10,
    rgba = new Uint8ClampedArray(w * h * 4);
  assert.equal(headroom(rgba, w, h), 0, 'an empty cell claims no headroom, so the bubble stays put');
  rgba[(6 * w + 2) * 4 + 3] = 255;
  assert.equal(headroom(rgba, w, h), 0.6);
  rgba[(3 * w + 0) * 4 + 3] = 10;
  assert.equal(headroom(rgba, w, h), 0.6, 'a faint shadow pixel is not the head');
  rgba[(3 * w + 0) * 4 + 3] = 200;
  assert.equal(headroom(rgba, w, h), 0.3);
});

test('animation never reads unused standard cells and v2 looks use 16 directions', () => {
  for (let t = 0; t < 20000; t += 13) assert.ok(frameAt('idle', t).column < 6);
  assert.deepEqual(frameAt('idle', 0), { row: 0, column: 0 });
  assert.deepEqual(lookFrame(1, 0), { row: 9, column: 4 });
  assert.deepEqual(lookFrame(0, 1), { row: 10, column: 0 });
});

test('a walk keeps stepping: renewing the same pose does not restart its frames', () => {
  assert.equal(renewsClock('right', 'right', 1000, 900), false, 'same pose, still running');
  assert.equal(renewsClock('right', 'left', 1000, 900), true, 'turning around starts the other walk');
  assert.equal(renewsClock('right', 'right', 1000, 1200), true, 'a pose that ran out starts over');
  assert.notDeepEqual(frameAt('right', 0), frameAt('right', 400), 'the walk row has more than one cell to show');
});
