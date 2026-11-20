import assert from 'node:assert/strict';
import test from 'node:test';
import { clearPaper, skyDistance, softenSkyEdge } from '../scripts/sky-edge-lib.mjs';

// A 12 by 12 picture: clear sky in the top four rows, green land below with a one-pixel ring of the
// white it was painted on along the sky, and a white flower deep in the land.
const W = 12,
  H = 12,
  GREEN = [60, 140, 40, 255],
  PAPER = [252, 251, 247, 255],
  SKY = [0, 0, 0, 0];
function picture() {
  const pixels = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) pixels.set(y < 4 ? SKY : y === 4 ? PAPER : GREEN, (y * W + x) * 4);
  pixels.set(PAPER, (9 * W + 6) * 4);
  return pixels;
}
const at = (pixels, x, y) => [...pixels.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];

test('land is as far from the sky as the pixels between, and the sky is nowhere', () => {
  const d = skyDistance(picture(), W, H);
  assert.equal(d[3 * W + 5], 0);
  assert.equal(d[4 * W + 5], 1);
  assert.equal(d[6 * W + 5], 3);
});

test('the white a picture was painted on becomes sky where it touches the sky, not a white flower', () => {
  const pixels = picture();
  assert.equal(clearPaper(pixels, W, H), W);
  assert.equal(at(pixels, 5, 4)[3], 0, 'the ring along the sky');
  assert.deepEqual(at(pixels, 6, 9), PAPER, 'deep in the land, it is painted white');
});

test('land meets the sky in a soft edge of its own colour, and the land inside keeps every sample', () => {
  const pixels = picture();
  softenSkyEdge(pixels, W, H);
  const edge = at(pixels, 5, 4);
  assert.deepEqual(edge.slice(0, 3), GREEN.slice(0, 3), 'no pale ring');
  assert.ok(edge[3] > 0 && edge[3] < 255, `the edge is part clear: ${edge[3]}`);
  const next = at(pixels, 5, 5);
  assert.ok(next[3] > edge[3], 'alpha climbs away from the sky');
  assert.deepEqual(at(pixels, 5, 8), GREEN);
  assert.deepEqual(at(pixels, 6, 9), PAPER);
  assert.deepEqual(at(pixels, 5, 2), SKY);
});
