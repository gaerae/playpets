import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pngFor } from '../scripts/art-webp-lib.mjs';
import { decodePng } from '../scripts/png-lossless-lib.mjs';
import { catalog } from './support/content.mjs';

const art = path => new URL(`../src/art/${path}`, import.meta.url);

test('specimen viewports isolate a valid part of a local RGBA atlas', () => {
  const records = JSON.parse(readFileSync(art('collection.json'), 'utf8'));
  const indexed = new Set(records.map(record => record.art));
  for (const kind of [...catalog.fish, ...catalog.bugs]) assert.ok(indexed.has(kind.art), kind.id);
  for (const record of records) {
    const png = readFileSync(pngFor(record.atlas));
    const width = png.readUInt32BE(16),
      height = png.readUInt32BE(20);
    assert.deepEqual(record.atlasSize, [width, height]);
    assert.equal(png[25], 6, `${record.id}: alpha is retained`);
    const [x, y, w, h] = record.crop;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, record.id);
    const svg = readFileSync(art(record.art), 'utf8');
    assert.match(svg, /<clipPath /, `${record.id}: letterboxing cannot expose neighboring artwork`);
    assert.ok(svg.includes(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`));
    assert.ok(svg.includes(`clip-path="url(#specimen-${record.kind}-${record.id})"`));
  }
});

test('every fish and bug has its own specimen art while keeping its procedural fallback', () => {
  const paths = new Set();
  for (const kind of [...catalog.fish, ...catalog.bugs]) {
    assert.ok(kind.art, `${kind.id} has specimen art`);
    assert.ok(kind.look, `${kind.id} keeps its original fallback`);
    assert.ok(!paths.has(kind.art), `${kind.id} has an individual specimen`);
    paths.add(kind.art);
    assert.match(readFileSync(art(kind.art), 'utf8'), /<image /);
  }
});

test('the remaining gift specimens preserve original dimensions and vector source drawings', () => {
  const ids = [
    'lantern',
    'birdhouse',
    'pinwheel',
    'swing',
    'flowerpot',
    'stump',
    'signpost',
    'windchime',
    'cherry_sapling',
    'watermelon',
    'pumpkin',
  ];
  for (const id of ids) {
    const gift = catalog.gifts.find(g => g.id === id);
    assert.equal(gift.art, `decor/sculpted/${id}.svg`);
    // The retired vector drawing is kept as provenance outside the shipped art.
    const original = readFileSync(`assets/sources/decor/${id}.svg`, 'utf8');
    const current = readFileSync(art(gift.art), 'utf8');
    assert.equal(current.match(/viewBox="([^"]+)"/)[1], original.match(/viewBox="([^"]+)"/)[1]);
    assert.match(current, /<image /);
    assert.doesNotMatch(original, /collection.png/);
  }
});

// The built snowman is the plain three-ball one the person dresses, no longer the gift atlas's
// two-ball drawing, so it keeps its wrapper path but not the old view box.
test('the built snowman draws the plain snowman from its own atlas', () => {
  const records = JSON.parse(readFileSync(art('collection.json'), 'utf8'));
  const gift = catalog.gifts.find(g => g.id === 'snowman');
  const record = records.find(r => r.id === 'snowman');
  assert.equal(gift.art, 'decor/sculpted/snowman.svg');
  assert.equal(record.art, gift.art);
  assert.equal(record.atlas, 'collection-extension/snowman-set.webp');
  assert.deepEqual(record.size, gift.size);
  assert.equal(gift.size[1], 70);
  const svg = readFileSync(art(gift.art), 'utf8');
  assert.ok(svg.includes('href="art/collection-extension/snowman-set.webp"'));
  assert.ok(
    svg.includes(
      `<rect x="${record.crop[0]}" y="${record.crop[1]}" width="${record.crop[2]}" height="${record.crop[3]}"/>`,
    ),
  );
  assert.ok(svg.includes('clip-path="url(#specimen-gifts-snowman)"'));
});

// A treasure dug up is shown whole: no part of its drawing runs on past the crop's edges (the wooden
// whale's tail was cut off at the right). The winter tails are cut on purpose; they peek from a bush.
test('a dug-up find is cropped around its whole drawing', () => {
  const records = JSON.parse(readFileSync(art('collection.json'), 'utf8'));
  const finds = records.filter(record => record.atlas === 'collection-extension/finds.webp');
  assert.deepEqual(finds.map(record => record.id).sort(), ['glass_marble', 'wooden_whale']);
  const { width, height, channels, pixels } = decodePng(readFileSync(pngFor(finds[0].atlas)));
  const opaque = (x, y) => x >= 0 && y >= 0 && x < width && y < height && pixels[(y * width + x) * channels + 3] > 8;
  for (const { id, crop } of finds) {
    const [x, y, w, h] = crop;
    const edges = {
      left: Array.from({ length: h }, (_, i) => opaque(x - 1, y + i)),
      right: Array.from({ length: h }, (_, i) => opaque(x + w, y + i)),
      top: Array.from({ length: w }, (_, i) => opaque(x + i, y - 1)),
      bottom: Array.from({ length: w }, (_, i) => opaque(x + i, y + h)),
    };
    for (const [edge, line] of Object.entries(edges))
      assert.ok(!line.some(Boolean), `${id}: drawn past the ${edge} edge`);
  }
});
