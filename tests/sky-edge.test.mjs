import assert from 'node:assert/strict';
import test from 'node:test';
import { clearPaper, skyDistance, softenSkyEdge, softened } from '../scripts/sky-edge-lib.mjs';

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

test('a picture whose edge is already soft is told from a hard cut, so the script does not wear it down', () => {
  const pixels = picture();
  assert.equal(softened(pixels, W, H), false, 'a hard cut');
  softenSkyEdge(pixels, W, H);
  assert.equal(softened(pixels, W, H), true, 'once softened');
});

// A winter or spring picture keeps its white (snow, blossom: the paper's own white), so the sky that
// showed between leaves stayed paper white: drawn over the app's sky, white holes in a crown. A hole
// is told from snow by what is round it: leaves, darker than the shading round a cap of snow.
test('white the sky shows through between leaves becomes sky, and snow on them stays', async () => {
  const { clearHoles } = await import('../scripts/sky-edge-lib.mjs');
  const w = 16,
    h = 16,
    LEAF = [70, 110, 95, 255],
    SHADE = [222, 214, 232, 255],
    pixels = new Uint8Array(w * h * 4);
  const put = (x, y, colour) => pixels.set(colour, (y * w + x) * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, y < 3 ? SKY : LEAF);
  // A hole between leaves, and a cap of snow in its shading.
  for (let x = 3; x <= 5; x++) for (let y = 5; y <= 6; y++) put(x, y, PAPER);
  for (let x = 9; x <= 13; x++) {
    put(x, 4, SHADE);
    put(x, 6, SHADE);
  }
  put(9, 5, SHADE);
  put(13, 5, SHADE);
  for (let x = 10; x <= 12; x++) put(x, 5, PAPER);
  const line = () => [...pixels.subarray((3 * w + 8) * 4, 4 * w * 4)];
  const top = line();
  const cleared = clearHoles(pixels, w, h);
  assert.equal(cleared.length, 6, 'the hole');
  assert.equal(pixels[(5 * w + 4) * 4 + 3], 0, 'the sky shows through it');
  assert.deepEqual([...pixels.subarray((5 * w + 11) * 4, (5 * w + 11) * 4 + 4)], PAPER, 'the snow stays');
  // Only the leaves round the hole are softened: the picture's own edge, soft already, is not worn down.
  softenSkyEdge(pixels, w, h, cleared);
  const rim = [...pixels.subarray((5 * w + 2) * 4, (5 * w + 2) * 4 + 4)];
  assert.deepEqual(rim.slice(0, 3), LEAF.slice(0, 3), 'no pale ring round the hole');
  assert.ok(rim[3] > 0 && rim[3] < 255, `the hole's edge is part clear: ${rim[3]}`);
  assert.deepEqual(line(), top, 'away from the hole, the line against the sky is as it was');
});
