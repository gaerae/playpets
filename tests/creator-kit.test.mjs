import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('creator kits use production sheets with stable downloadable files and valid reference cells', async () => {
  const { creatorKits, referenceSheets } = await import('../scripts/creator-kit.mjs');
  assert.deepEqual(
    creatorKits.map(k => k.id),
    ['daisy', 'clover', 'pip', 'miso'],
  );
  for (const kit of creatorKits) {
    assert.equal(kit.sheets.length, 3);
    for (const file of kit.sheets) assert.match(file, /^assets\/pets\/(clover|daisy|pip|miso)\//);
  }
  assert.deepEqual(Object.keys(referenceSheets), ['identity-reference', 'expression-reference', 'motion-reference']);
  for (const cells of Object.values(referenceSheets))
    for (const cell of cells) {
      assert.ok(cell.row >= 0 && cell.row < 11);
      assert.ok(cell.column >= 0 && cell.column < 8);
      assert.ok(cell.label);
    }
});

test('creation kits keep approved reference files and ready pet downloads in the shared studio', async () => {
  const studio = await readFile('website/.vitepress/theme/CreationStudio.vue', 'utf8');
  for (const file of [
    'identity-reference.png',
    'turnaround.png',
    'face-detail.png',
    'identity.json',
    'spritesheet.png',
    'importable-pet.zip',
  ])
    assert.ok(studio.includes(file));
  assert.match(studio, /v-for="entry in kitEntries"/);
  assert.match(studio, /starter==='custom'/);
  assert.doesNotMatch(studio, /type="file"|readStudioImage|inspectPng/);
});
