import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCatRow } from '../scripts/cat-row-normalize-lib.mjs';

function fixture() {
  const rgba = new Uint8ClampedArray(40 * 20 * 4);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) {
      const left = col * 10 + (col === 0 ? 7 : 3);
      for (let y = row * 10 + 2; y < row * 10 + 8; y++)
        for (let x = left; x < left + 4; x++) {
          rgba.set([row * 4 + col + 1, 42, 83, y % 2 ? 180 : 255], (y * 40 + x) * 4);
        }
    }
  return rgba;
}

test('source normalization recenters complete cross-cell figures without resampling their pixels or vertical jump offsets', () => {
  const original = fixture();
  const result = normalizeCatRow(original, 40, 20, 1);
  assert.equal(result.poses.length, 8);
  for (const pose of result.poses) {
    assert.equal(pose.dy, 0);
    for (const at of pose.pixels) {
      const next = at + pose.dx;
      assert.deepEqual([...result.rgba.slice(next * 4, next * 4 + 4)], [...original.slice(at * 4, at * 4 + 4)]);
    }
  }
  assert.equal(result.poses[0].dx, -4);
});

test('source normalization rejects true image-edge cuts and merged or oversized figures', () => {
  const edge = fixture();
  edge.set([1, 2, 3, 255], 2 * 40 * 4);
  assert.throws(() => normalizeCatRow(edge, 40, 20, 1), /eight|edge/);
  const merged = fixture();
  for (let x = 7; x <= 16; x++) merged.set([1, 2, 3, 255], (3 * 40 + x) * 4);
  assert.throws(() => normalizeCatRow(merged, 40, 20, 1), /eight|oversized/);
  assert.throws(() => normalizeCatRow(fixture(), 40, 20, 4), /oversized/);
});

test('normalization retains the two-pixel antialiasing fringe and ignores disconnected faint backdrop specks', () => {
  const original = fixture();
  original.set([14, 31, 52, 12], (2 * 40 + 6) * 4);
  original.set([77, 88, 99, 3], (19 * 40 + 39) * 4);
  const result = normalizeCatRow(original, 40, 20, 1);
  const first = result.poses[0];
  assert.ok(first.pixels.includes(2 * 40 + 6));
  const dest = (2 * 40 + 6 + first.dx) * 4;
  assert.deepEqual([...result.rgba.slice(dest, dest + 4)], [14, 31, 52, 12]);
  assert.equal(result.rgba[(19 * 40 + 39) * 4 + 3], 0);
});
