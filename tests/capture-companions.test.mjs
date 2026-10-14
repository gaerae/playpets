import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('native companion captures invite ordinary baselines instead of requesting removed built-in styles', async () => {
  const capture = await readFile('scripts/shots.mjs', 'utf8');
  assert.ok(capture.includes("full('playpets-daisy')"));
  assert.ok(capture.includes("full('playpets-clover')"));
  assert.doesNotMatch(capture, /visualStyle\s*:\s*['"]realistic['"]/);
  assert.match(capture, /Missing capture companion/);
});

test('each capture pass removes retired realistic marketing exports', async () => {
  const capture = await readFile('scripts/shots.mjs', 'utf8');
  assert.match(capture, /for \(const retired of \['realistic-companions.webp', 'friend-appearance.webp'\]\)/);
  assert.match(capture, /await rm\(path.join\(outDir, retired\), \{ force: true \}\)/);
  assert.doesNotMatch(capture, /shot\('(?:realistic-companions|friend-appearance)'\)/);
});
