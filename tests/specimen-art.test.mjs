import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { catalog } from './support/content.mjs';

const art = path => new URL(`../src/art/${path}`, import.meta.url);

test('specimen viewports isolate a valid part of a local RGBA atlas', () => {
  const records = JSON.parse(readFileSync(art('collection.json'), 'utf8'));
  assert.equal(records.length, 47);
  for (const record of records) {
    const png = readFileSync(art(record.atlas));
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
    'snowman',
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
