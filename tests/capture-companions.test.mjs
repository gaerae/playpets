import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('native companion captures invite ordinary baselines instead of requesting removed built-in styles', async () => {
  const capture = await readFile('scripts/shots.mjs', 'utf8');
  assert.ok(capture.includes("full('playpets-aria-full')"));
  assert.ok(capture.includes("full('playpets-noah-full')"));
  assert.doesNotMatch(capture, /visualStyle\s*:\s*['"]realistic['"]/);
  assert.match(capture, /Missing capture companion/);
});
