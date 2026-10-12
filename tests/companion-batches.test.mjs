import assert from 'node:assert/strict';
import test from 'node:test';
import { batchFrame } from '../scripts/companion-batches-lib.mjs';

test('batch packing centers a downsampled pose inside a canonical cell', () => {
  const frame = batchFrame({ left: 20, right: 319, top: 10, bottom: 489 }, 0, 2, 0.34, 0);
  assert.equal(frame.dx + frame.dw / 2, 2 * 192 + 96);
  assert.equal(frame.dy + frame.dh, 200);
  assert.ok(frame.dw < 192 && frame.dh < 208);
});

test('jump packing retains airborne displacement instead of pinning every foot to ground', () => {
  const pose = { left: 20, right: 319, top: 10, bottom: 449 };
  const frame = batchFrame(pose, 4, 2, 0.34, 40);
  assert.equal(frame.dy + frame.dh, 4 * 208 + 200 - 40 * 0.34);
});

test('batch packing refuses clipping rather than silently changing individual pose scale', () => {
  assert.throws(() => batchFrame({ left: 0, right: 800, top: 0, bottom: 900 }, 0, 0, 1, 0), /cell/);
});

test('curated frame map changes only the requested source pose', async () => {
  const { frameOrder } = await import('../scripts/companion-batches-lib.mjs');
  const normal = frameOrder();
  const curated = frameOrder({ 8: { 4: 2 } });
  assert.deepEqual(normal[8], [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(curated[8], [0, 1, 2, 3, 2, 5, 6, 7]);
  assert.deepEqual(curated.slice(0, 8), normal.slice(0, 8));
  assert.deepEqual(curated.slice(9), normal.slice(9));
});

test('curated frame map refuses invalid rows, columns and source indices', async () => {
  const { frameOrder } = await import('../scripts/companion-batches-lib.mjs');
  for (const mapping of [
    null,
    [],
    { 11: { 0: 1 } },
    { 8: { 8: 0 } },
    { 8: { 4: -1 } },
    { 8: { 4: 8 } },
    { 8: { 4: '2' } },
    { 8: [] },
    { bad: {} },
  ]) {
    assert.throws(() => frameOrder(mapping), /frame map/i);
  }
});
