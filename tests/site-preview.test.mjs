import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PREVIEW_STATES, previewSource, validatePreview } from '../scripts/site-preview-lib.mjs';

test('high-resolution website animation is optional per pet and per state', () => {
  const available = { daisy: ['idle'], clover: ['idle', 'wave'] };
  assert.equal(previewSource('daisy', 'idle', available), '/pets/previews/daisy/idle.png');
  assert.equal(previewSource('daisy', 'wave', available), null);
  assert.equal(previewSource('pip', 'idle', available), null);
  assert.equal(previewSource('clover', 'wave', undefined), null);
  assert.deepEqual(PREVIEW_STATES, ['idle', 'wave', 'jump']);
});
test('a runtime atlas cannot be accidentally published as a high-resolution strip', async () => {
  assert.throws(() => validatePreview(Buffer.from('invalid')), /PNG header/);
  const atlas = await readFile('assets/pets/daisy/spritesheet.png');
  assert.throws(() => validatePreview(atlas), /384/);
});

test('all three official companions provide high-resolution idle, wave and jump strips', async () => {
  for (const pet of ['daisy', 'clover', 'pip']) {
    for (const state of PREVIEW_STATES) {
      const bytes = await readFile(`assets/pets/${pet}/preview/${state}.png`);
      assert.doesNotThrow(() => validatePreview(bytes), `${pet}:${state}`);
    }
  }
});

test('preview packing shares canonical row corrections and authored jump heights', async () => {
  const { previewPacking } = await import('../scripts/site-preview-lib.mjs');
  const config = { rowScales: { 3: 0.95 }, jumpLifts: [0, 6, 22, 6, 0, 0, 14, 0] };
  assert.deepEqual(previewPacking('wave', config), { scale: 0.95, lifts: null });
  assert.deepEqual(previewPacking('jump', config), { scale: 1, lifts: config.jumpLifts });
  assert.deepEqual(previewPacking('idle'), { scale: 1, lifts: null });
  assert.throws(() => previewPacking('wave', { rowScales: { 3: 0 } }), /row scale/);
  assert.throws(() => previewPacking('jump', { jumpLifts: [0, 1] }), /jump lift/);
  assert.throws(() => previewPacking('unknown'), /preview state/);
});
