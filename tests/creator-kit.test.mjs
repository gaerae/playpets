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
  ])
    assert.ok(studio.includes(file));
  // The ready friend is the same download as the landing gallery's, not a kit of its own.
  assert.match(studio, /\/pets\/playpets-\$\{starter\}\.zip/);
  assert.match(studio, /v-for="entry in kitEntries"/);
  assert.match(studio, /starter==='custom'/);
  assert.doesNotMatch(studio, /type="file"|readStudioImage|inspectPng/);
});

test('each starter friend downloads as playpets-<name>.zip, one folder a Codex pets folder or a ZIP import takes as it is', async () => {
  const { creatorKits, petDownloads } = await import('../scripts/creator-kit.mjs');
  const { LANDING_PETS } = await import('../scripts/site-content.mjs');
  const downloads = await petDownloads();
  assert.deepEqual(
    downloads.map(d => d.file),
    LANDING_PETS.map(pet => `playpets-${pet.id}.zip`),
  );
  // The kit step of the same build checks these sheets, so the download does not check them again.
  const checked = creatorKits.flatMap(kit => kit.sheets);
  for (const [index, { file, entries }] of downloads.entries()) {
    const folder = file.replace(/\.zip$/, ''),
      manifest = JSON.parse(entries.find(entry => entry.name === `${folder}/pet.json`).bytes);
    assert.equal(manifest.id, folder);
    assert.equal(manifest.source.license, 'MIT');
    const sheets = [manifest.spritesheetPath, ...Object.values(manifest.seasonalSpritesheets)];
    assert.equal(sheets.length, 3, file);
    for (const sheet of sheets) assert.ok(checked.includes(`assets/pets/${LANDING_PETS[index].id}/${sheet}`), sheet);
    assert.deepEqual(
      entries.map(entry => entry.name).sort(),
      ['pet.json', ...sheets].map(name => `${folder}/${name}`).sort(),
    );
  }
});
