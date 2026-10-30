import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { pngSize } from '../scripts/png-lossless-lib.mjs';
import { LANDING_PETS, localePath, releasePagesFor, SITE_LANGS } from '../scripts/site-content.mjs';

test('website publishing and releases use the same four locale paths', () => {
  assert.deepEqual(SITE_LANGS, ['en', 'ko', 'ja', 'zh-hans']);
  assert.equal(localePath('en', '/guide/'), '/guide/');
  assert.equal(localePath('ja', '/guide/'), '/ja/guide/');
  assert.deepEqual(
    releasePagesFor('0.1.0'),
    SITE_LANGS.map(lang => `website${lang === 'en' ? '' : `/${lang}`}/releases/0.1.0.md`),
  );
  assert.throws(() => localePath('unknown', '/guide/'));
});

test('all four illustrated built-in pets have distinct landing sources with valid v2 dimensions', async () => {
  assert.equal(LANDING_PETS.length, 4);
  assert.equal(new Set(LANDING_PETS.map(p => p.id)).size, 4);
  assert.deepEqual(
    LANDING_PETS.map(p => p.displayName),
    ['Daisy', 'Clover', 'Pip', 'Miso'],
  );
  for (const pet of LANDING_PETS) {
    await access(pet.source);
    assert.deepEqual(pngSize(await readFile(pet.source)), { width: 1536, height: 2288 }, pet.id);
  }
  assert.ok(LANDING_PETS.every(pet => !pet.source.includes('/realistic/')));
});

// VitePress decomposes a heading's id (NFKD), so a link that spells a Hangul or voiced-kana
// heading as typed never reaches it; such a heading takes an explicit {#id} instead.
test('a link to a section uses an id the site keeps as written', async () => {
  const typed = [];
  for (const page of globSync('website/**/*.md', { exclude: ['website/dev/**', '**/node_modules/**'] })) {
    for (const [, id] of (await readFile(page, 'utf8')).matchAll(/\]\([^)\s]*#([^)\s]+)\)/g))
      if (id !== id.normalize('NFKD')) typed.push(`${page}#${id}`);
  }
  // The theme links guide sections too (words.ts, the landing copy).
  for (const file of globSync('website/.vitepress/theme/*.{ts,vue,mjs}')) {
    for (const [, id] of (await readFile(file, 'utf8')).matchAll(/\/guide\/[\w-]*#([^'"`\s)]+)/g))
      if (id !== id.normalize('NFKD')) typed.push(`${file}#${id}`);
  }
  assert.deepEqual(typed, []);
});
