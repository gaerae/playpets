import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { zipStore } from '../scripts/creator-bundle-lib.mjs';
import {
  inspectPng,
  inspectSpritePixels,
  petPackageEntries,
  studioZip,
} from '../website/.vitepress/theme/studio-files.mjs';

test('browser ZIPs match the deterministic native kit archive and reject unsafe paths', () => {
  const entries = [
    { name: 'pet.json', bytes: new TextEncoder().encode('{}') },
    { name: 'spritesheet.png', bytes: new Uint8Array([1, 2, 3]) },
  ];
  assert.deepEqual(Buffer.from(studioZip(entries)), zipStore(entries));
  for (const name of ['../escape', '/absolute', 'a/../b', 'a\\b'])
    assert.throws(() => studioZip([{ name, bytes: new Uint8Array() }]));
  assert.throws(() => studioZip([entries[0], entries[0]]));
});

test('browser PNG inspection verifies the real bytes, dimensions, checksums and complete file', async () => {
  const bytes = new Uint8Array(await readFile('assets/pets/clover/spritesheet.png'));
  assert.deepEqual(inspectPng(bytes, 'pet'), { width: 1536, height: 2288 });
  assert.throws(() => inspectPng(bytes, 'background'), /dimensions/);
  const corrupt = bytes.slice();
  corrupt[50] ^= 1;
  assert.throws(() => inspectPng(corrupt, 'pet'), /png/);
  assert.throws(() => inspectPng(bytes.slice(0, -12), 'pet'), /png/);
  assert.throws(() => inspectPng(new Uint8Array(40), 'pet'), /png/);
});

test('all consumed animation cells need artwork and transparent margins are reported separately', () => {
  const pixels = new Uint8ClampedArray(1536 * 2288 * 4);
  const result = inspectSpritePixels(pixels);
  assert.equal(result.empty.length, 73);
  for (let row = 0; row < 11; row++)
    for (let col = 0; col < 8; col++) pixels[((row * 208 + 100) * 1536 + col * 192 + 100) * 4 + 3] = 255;
  const complete = inspectSpritePixels(pixels);
  assert.equal(complete.empty.length, 0);
  assert.equal(complete.edges.length, 0);
  pixels[3] = 255;
  assert.ok(inspectSpritePixels(pixels).edges.includes('0:0'));
});

test('pet exports include only validated supplied sheets and never invent optional references', async () => {
  const base = new Uint8Array(await readFile('assets/pets/clover/spritesheet.png'));
  const entries = petPackageEntries(
    { id: 'paper-fox', name: 'Paper fox', description: 'A paper friend', kind: 'animal' },
    { base, winter: base },
  );
  const manifest = JSON.parse(new TextDecoder().decode(entries.find(e => e.name === 'pet.json').bytes));
  assert.deepEqual(manifest.seasonalSpritesheets, { winter: 'winter.png' });
  assert.equal(manifest.spriteVersionNumber, 2);
  assert.deepEqual(entries.map(e => e.name).sort(), ['pet.json', 'spritesheet.png', 'winter.png']);
  assert.throws(() => petPackageEntries({ id: '../escape', name: 'Fox', kind: 'animal' }, { base }), /identity/);
  assert.throws(() => petPackageEntries({ id: 'fox', name: ' ', kind: 'animal' }, { base }), /identity/);
  assert.throws(() => petPackageEntries({ id: 'fox', name: 'Fox', kind: 'animal' }, {}), /base/);
});

test('background preview crops follow the runtime floor anchor at full, mini and portrait sizes', async () => {
  const { backgroundPreviewFrame } = await import('../website/.vitepress/theme/studio-files.mjs');
  const { environmentFrame } = await import('../src/yard/environment.js');
  const { useWorlds } = await import('../src/yard/worlds.js');
  for (const floor of [0.5, 0.67, 0.8]) {
    useWorlds([{ id: 'preview-test', fit: 'cover-floor', geometry: { fieldTop: floor } }]);
    for (const [w, h] of [
      [1536, 1024],
      [1200, 750],
      [400, 300],
      [300, 400],
    ])
      assert.deepEqual(backgroundPreviewFrame(w, h, floor), environmentFrame(w, h, { world: 'preview-test' }));
  }
});

test('background guide and prompt preserve every imported window instead of silently dropping panes', async () => {
  const { backgroundSheet, backgroundPrompt } = await import('../scripts/background-specs.mjs');
  const windows = [
    { x: 0.1, y: 0.1, width: 0.2, height: 0.3 },
    { x: 0.5, y: 0.2, width: 0.3, height: 0.2 },
  ];
  const prompt = backgroundPrompt({ indoor: true, windows, pane: null });
  for (const pane of windows)
    assert.ok(prompt.includes(`x=${pane.x}, y=${pane.y}, width=${pane.width}, height=${pane.height}`));
  const svg = backgroundSheet({ indoor: true, windows, pane: null });
  assert.equal((svg.match(/fill="#bad9e9"/g) || []).length, 2);
});

test('motion prompts use a chosen supported state and explicit pose sequence without unresolved tokens', async () => {
  const { creatorTaskPrompt } = await import('../website/.vitepress/theme/creator-task.mjs');
  const { kitPrompts, kitSpec } = await import('../scripts/creator-specs.mjs');
  const prompts = Object.values(kitPrompts(kitSpec('clover')));
  for (const state of [
    'idle',
    'right',
    'left',
    'wave',
    'jump',
    'error',
    'waiting',
    'working',
    'done',
    'look09',
    'look10',
  ]) {
    const text = creatorTaskPrompt(prompts[3], { state });
    assert.doesNotMatch(text, /\[STATE\]|\[EIGHT POSES\]/);
    assert.ok(text.includes(state));
  }
  assert.match(creatorTaskPrompt(prompts[2], { season: 'winter' }), /SEASON: winter/);
  assert.doesNotMatch(creatorTaskPrompt(prompts[2], { season: 'winter' }), /\[SEASON:/);
});

test('studio copy has the same actionable labels and image error messages in every language', async () => {
  const { studioCopy } = await import('../website/.vitepress/theme/studio-copy.js');
  const keys = Object.keys(studioCopy.en).sort(),
    errors = Object.keys(studioCopy.en.errors).sort();
  for (const lang of ['ko', 'ja', 'zh-hans']) {
    assert.deepEqual(Object.keys(studioCopy[lang]).sort(), keys, lang);
    assert.deepEqual(Object.keys(studioCopy[lang].errors).sort(), errors, lang);
    assert.equal(studioCopy[lang].actions.length, 10);
    assert.equal(studioCopy[lang].seasons.length, 4);
    assert.equal(studioCopy[lang].bgCrops.length, 4);
  }
  for (const lang of ['en', 'ko', 'ja', 'zh-hans']) {
    const prefix = lang === 'en' ? '' : `${lang}/`;
    assert.match(
      await readFile(`website/${prefix}guide/creator-kit.md`, 'utf8'),
      new RegExp(`<PetPackager lang="${lang}" />`),
    );
    assert.match(
      await readFile(`website/${prefix}guide/background-kit.md`, 'utf8'),
      new RegExp(`<StudioNav lang="${lang}" current="background" />`),
    );
  }
});

test('background export budget counts embedded images and UTF-8 metadata without copying image strings', async () => {
  const { backgroundPackageSize } = await import('../website/.vitepress/theme/studio-files.mjs');
  const pack = {
    name: '庭と花',
    images: { base: 'data:image/png;base64,AAAA', winter: 'data:image/png;base64,BBBB' },
    floor: 0.67,
  };
  assert.equal(backgroundPackageSize(pack), Buffer.byteLength(JSON.stringify(pack)));
});

test('export never silently loses description text at the native importer boundary', async () => {
  const base = new Uint8Array(await readFile('assets/pets/clover/spritesheet.png'));
  assert.throws(
    () => petPackageEntries({ id: 'fox', name: 'Fox', kind: 'animal', description: 'x'.repeat(301) }, { base }),
    /identity/,
  );
});

test('filling motion instructions never changes quoted creator metadata', async () => {
  const { creatorTaskPrompt } = await import('../website/.vitepress/theme/creator-task.mjs');
  const { extensionPrompts } = await import('../scripts/creator-specs.mjs');
  const inputs = { name: '[STATE]', reference: '[EIGHT POSES].png', action: 'wave' };
  const prompt = creatorTaskPrompt(extensionPrompts(inputs)['04-state-row'], { state: 'wave' });
  const metadata = JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(metadata.name, inputs.name);
  assert.equal(metadata.reference, inputs.reference);
});
