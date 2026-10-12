import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasPoses } from '../scripts/atlas-lib.mjs';

test('an incomplete atlas is refused rather than filled with blank frames', () => {
  const pixels = new Uint8Array(12 * 12 * 4);
  for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) pixels[(y * 12 + x) * 4 + 3] = 255;
  assert.throws(() => atlasPoses(pixels, 12, 12, 1, 2), /Expected 2 isolated poses/);
});

test('overlapping row ranges still retain two complete disconnected silhouettes', () => {
  const width = 12,
    height = 12,
    pixels = new Uint8Array(width * height * 4);
  for (const [x0, x1, y0, y1] of [
    [1, 4, 1, 7],
    [7, 10, 5, 11],
  ])
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) pixels[(y * width + x) * 4 + 3] = 255;
  const [poses] = atlasPoses(pixels, width, height, 1, 2);
  assert.deepEqual(
    poses.map(p => [p.left, p.right, p.top, p.bottom]),
    [
      [1, 3, 1, 6],
      [7, 9, 5, 10],
    ],
  );
  assert.equal(poses[0].pixels.length, 18);
  assert.equal(poses[1].pixels.length, 18);
});

test('two figures joined by a narrow alpha bridge become separate poses, not a tiny substitute', () => {
  const width = 12,
    height = 40,
    pixels = new Uint8Array(width * height * 4);
  for (const [x0, x1, y0, y1] of [
    [2, 10, 1, 10],
    [2, 10, 12, 21],
    [2, 10, 26, 35],
    [5, 6, 10, 12],
  ])
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) pixels[(y * width + x) * 4 + 3] = 255;
  const [poses] = atlasPoses(pixels, width, height, 1, 3);
  assert.equal(poses.length, 3);
  assert.ok(poses.every(p => p.bottom - p.top < 12));
  assert.ok(poses[0].bottom < poses[1].top);
});
