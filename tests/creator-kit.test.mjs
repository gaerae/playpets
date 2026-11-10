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
  const { STUDIO_REFERENCES } = await import('../scripts/creator-specs.mjs');
  assert.deepEqual(STUDIO_REFERENCES, [
    ['identity-reference.png', 'identity-reference.png'],
    ['turnaround.png', 'turnaround.png'],
    ['face-detail.png', 'face-detail.png'],
    ['identity.json', 'identity.json'],
    ['spritesheet.png', 'original-atlas.png'],
  ]);
  // The ready friend is the same download as the landing gallery's, not a kit of its own.
  assert.match(studio, /petDownload\(starter\)/);
  assert.match(studio, /v-for="entry in kitEntries"/);
  assert.match(studio, /starter==='custom'/);
  assert.doesNotMatch(studio, /type="file"|readStudioImage|inspectPng/);
});

test('each starter friend downloads as playpets-<name>.zip, one folder a Codex pets folder or a ZIP import takes as it is', async () => {
  const { petDownloads } = await import('../scripts/creator-kit.mjs');
  const { LANDING_PETS, petDownload } = await import('../scripts/site-content.mjs');
  const downloads = await petDownloads();
  assert.deepEqual(
    downloads.map(d => `/pets/${d.file}`),
    LANDING_PETS.map(pet => petDownload(pet.id)),
  );
  assert.equal(petDownload('daisy'), '/pets/playpets-daisy.zip');
  for (const [index, { file, entries }] of downloads.entries()) {
    const folder = file.replace(/\.zip$/, ''),
      manifest = JSON.parse(entries.find(entry => entry.name === `${folder}/pet.json`).bytes);
    assert.equal(manifest.id, folder);
    assert.equal(manifest.source.license, 'MIT');
    const sheets = [manifest.spritesheetPath, ...Object.values(manifest.seasonalSpritesheets)];
    assert.equal(sheets.length, 3, file);
    // The lossless WebP the app ships, which `pnpm run assets:webp --check` matches pixel for
    // pixel with the PNG sources.
    const shipped = `src-tauri/pets/${LANDING_PETS[index].id}`;
    assert.deepEqual(manifest, JSON.parse(await readFile(`${shipped}/pet.json`, 'utf8')));
    for (const sheet of sheets) {
      assert.match(sheet, /\.webp$/);
      assert.deepEqual(
        entries.find(entry => entry.name === `${folder}/${sheet}`).bytes,
        await readFile(`${shipped}/${sheet}`),
      );
    }
    assert.deepEqual(
      entries.map(entry => entry.name).sort(),
      ['pet.json', ...sheets].map(name => `${folder}/${name}`).sort(),
    );
  }
});

test('the site publishes only the kit files the studio packs, and the seasonal atlases when a strip is missing', async () => {
  const { mkdtemp, readdir, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { creatorKits, copyCreatorKit } = await import('../scripts/creator-kit.mjs');
  const { STUDIO_REFERENCES } = await import('../scripts/creator-specs.mjs');
  const studio = await readFile('website/.vitepress/theme/CreationStudio.vue', 'utf8');
  assert.match(studio, /STUDIO_REFERENCES\.map/);
  const folder = await mkdtemp(path.join(tmpdir(), 'playpets-kit-'));
  try {
    await copyCreatorKit(folder);
    for (const kit of creatorKits)
      assert.deepEqual(
        (await readdir(`${folder}/${kit.id}`)).sort(),
        STUDIO_REFERENCES.map(([source]) => source).sort(),
        kit.id,
      );
    await copyCreatorKit(folder, { seasonalAtlases: true });
    for (const kit of creatorKits)
      assert.deepEqual(
        (await readdir(`${folder}/${kit.id}`)).sort(),
        [...STUDIO_REFERENCES.map(([source]) => source), 'summer.png', 'winter.png'].sort(),
        kit.id,
      );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
