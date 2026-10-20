import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CUES } from '../src/yard/soundmix.js';

test('garden styles and current module guide no longer describe spontaneous seed pickups', async () => {
  const css = await readFile('src/styles/garden.css', 'utf8');
  assert.doesNotMatch(css, /found-seed|seed-glow|seeds friends find/);
  const guide = await readFile('docs/standards/page-modules.md', 'utf8');
  assert.doesNotMatch(guide, /found seeds/);
});

test('removing pickup visuals preserves the planted seed growth stage', async () => {
  const art = await readFile('src/art/plants/seed.svg', 'utf8');
  assert.match(art, /art\/plants\/growth\.png/);
  const catalogue = await readFile('src/content/catalog.json', 'utf8');
  assert.match(catalogue, /plants\/seed\.svg/);
});

test('yard input guards no longer reserve interactions for removed pickup nodes', async () => {
  for (const path of ['src/yard/catch.js', 'src/core/controls.js']) {
    assert.doesNotMatch(await readFile(path, 'utf8'), /\.found-seed/, path);
  }
});

test('pickup-only sound and locale keys are removed without removing the digging reward', async () => {
  assert.ok(!('find' in CUES));
  for (const language of ['en', 'ko', 'ja', 'zh-hans']) {
    const { strings } = await import(`../src/core/strings/${language}.js`);
    assert.ok(!('garden.pick_up' in strings));
    assert.ok(!('garden.found' in strings));
    assert.ok(strings['discovery.seed']);
  }
});
