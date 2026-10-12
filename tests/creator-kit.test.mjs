import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('creator kits use production sheets with stable downloadable files and valid reference cells', async () => {
  const { creatorKits, referenceSheets } = await import('../scripts/creator-kit.mjs');
  assert.deepEqual(
    creatorKits.map(k => k.id),
    ['aria-realistic', 'aria', 'noah-realistic', 'noah', 'clover', 'daisy', 'pip', 'tabby', 'smoky', 'mochi'],
  );
  for (const kit of creatorKits) {
    assert.equal(kit.sheets.length, ['tabby', 'smoky', 'mochi'].includes(kit.id) ? 1 : 3);
    for (const file of kit.sheets)
      assert.match(file, /^assets\/pets\/(aria|noah|clover|daisy|pip|tabby|smoky|mochi)\//);
  }
  assert.deepEqual(Object.keys(referenceSheets), ['identity-reference', 'expression-reference', 'motion-reference']);
  for (const cells of Object.values(referenceSheets))
    for (const cell of cells) {
      assert.ok(cell.row >= 0 && cell.row < 11);
      assert.ok(cell.column >= 0 && cell.column < 8);
      assert.ok(cell.label);
    }
});

test('each creator guide exposes the same character-specific studio and supported export contract', async () => {
  const config = await readFile('website/.vitepress/config.mts', 'utf8');
  const studio = await readFile('website/.vitepress/theme/CreatorKit.vue', 'utf8');
  for (const file of ['design-kit.zip', 'importable-pet.zip', 'turnaround.png', 'face-detail.png', 'baseline-pet.zip'])
    assert.ok(studio.includes(file));
  assert.match(studio, /kitPrompts\(spec.value\)/);
  assert.match(studio, /:download="`\$\{id\}-design-kit\.zip`"/);
  assert.match(studio, /:download="`\$\{id\}-importable-pet\.zip`"/);
  for (const [prefix, lang] of [
    ['', 'en'],
    ['ko/', 'ko'],
    ['zh-hans/', 'zh-hans'],
  ]) {
    const text = await readFile(`website/${prefix}guide/creator-kit.md`, 'utf8');
    assert.ok(text.includes(`<CreatorKit lang="${lang}" />`));
    assert.match(text, /1536.?2288/);
    assert.match(text, /192.?208/);
    assert.match(text, /pack-companion-batches\.mjs/);
    assert.ok(config.includes(`/${prefix}guide/creator-kit`));
    assert.match(text, /seasonalSpritesheets/);
    assert.match(text, /realisticSpritesheets/);
    for (const file of ['00-idle.png', '07-working.png', '10-look.png']) assert.ok(text.includes(file));
  }
});

test('creator studio chooses ordinary entries by preview and offers arbitrary reference extensions', async () => {
  const studio = await readFile('website/.vitepress/theme/CreatorKit.vue', 'utf8');
  assert.match(studio, /v-for="entry in kitEntries"/);
  assert.match(studio, /v-model="id" type="radio"/);
  assert.doesNotMatch(studio, /v-model="style"/);
  const extension = await readFile('website/.vitepress/theme/ExtensionPrompts.vue', 'utf8');
  assert.match(extension, /extensionPrompts/);
  assert.match(extension, /role="status"/);
  for (const prefix of ['', 'ko/', 'zh-hans/']) {
    const guide = await readFile(`website/${prefix}guide/creator-kit.md`, 'utf8');
    assert.match(guide, /<ExtensionPrompts/);
    assert.match(guide, /pet.json/);
  }
});
