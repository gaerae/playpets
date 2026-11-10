// Each kind of firefly can be told apart in the yard at night, where only its light and size show.

import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { BUGS } from '../src/yard/catalog.js';
import { fireflyLit, fireflyPace } from '../src/yard/scenery.js';

const fireflies = BUGS.filter(bug => bug.kind === 'firefly');
const kind = id => fireflies.find(bug => bug.id === id);
// How many flashes a firefly makes over `ms`, and how far its light swings while it does.
function flashes(look, ms) {
  let phase = 0,
    count = 0,
    low = 1,
    high = 0,
    last = fireflyLit(look, phase);
  for (let t = 0; t < ms; t += 10) {
    phase += 10 * fireflyPace(look);
    const lit = fireflyLit(look, phase);
    if (last < 0.9 && lit >= 0.9) count++;
    [low, high, last] = [Math.min(low, lit), Math.max(high, lit), lit];
  }
  return { count, swing: high - low };
}

test('no two kinds of firefly glow the same way: each has its own rhythm or size', () => {
  assert.ok(fireflies.length >= 4);
  // The time between flashes, in ms; 0 for a steady light.
  const rhythm = bug => (bug.look.blink === 0 ? 0 : (Math.PI * 2) / fireflyPace(bug.look)),
    size = bug => bug.look.size ?? 1;
  for (const [i, a] of fireflies.entries())
    for (const b of fireflies.slice(i + 1)) {
      const [x, y] = [rhythm(a), rhythm(b)];
      const paced = x !== y && (x === 0 || y === 0 || Math.max(x, y) / Math.min(x, y) >= 1.4),
        sized = Math.max(size(a), size(b)) / Math.min(size(a), size(b)) >= 1.25;
      assert.ok(paced || sized, `${a.id} and ${b.id} look alike at night`);
      assert.notEqual(a.look.glow, b.look.glow, `${a.id} and ${b.id} share a light`);
    }
});

test('the Heike firefly flickers quickly, the late firefly holds a steady light', () => {
  const common = flashes(kind('firefly').look, 20000),
    heike = flashes(kind('heike_firefly').look, 20000),
    late = flashes(kind('late_firefly').look, 20000);
  assert.ok(common.count >= 5, 'the common firefly flashes about every two seconds');
  assert.ok(heike.count >= common.count * 2, 'the Heike firefly at least twice as often');
  assert.ok(common.swing > 0.8, 'a flash goes from dim to bright');
  assert.equal(late.count, 0, 'the late firefly never flashes');
  assert.ok(late.swing < 0.01, 'its light stays the same');
  assert.ok(kind('heike_firefly').look.size < 1, 'and the Heike firefly is the small one');
  assert.ok(kind('late_firefly').look.size > 1, 'the late firefly the big one');
});
