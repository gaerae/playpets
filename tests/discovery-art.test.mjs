import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { STRINGS } from '../src/core/strings.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url));
const catalog = JSON.parse(read('src/content/catalog.json'));
const sources = JSON.parse(read('assets/discovery/ART-SOURCES.json'));

test('discovery offers six distinct tree species with growth and deciduous seasonal art', () => {
  assert.deepEqual(
    catalog.trees.map(tree => tree.id),
    ['cherry', 'maple', 'pine', 'oak', 'birch', 'willow'],
  );
  for (const id of ['oak', 'birch', 'willow']) {
    const tree = catalog.trees.find(item => item.id === id);
    assert.deepEqual(
      tree.stages.map(stage => stage.name),
      ['seedling', 'young', 'mature'],
    );
    for (const season of ['spring', 'autumn', 'winter']) assert.ok(tree.seasonArt[season], `${id} ${season}`);
    assert.equal(new Set([tree.stages[2].art, ...Object.values(tree.seasonArt)]).size, 4);
  }
});

test('whimsical keepsakes have translated names and year-round weighted discovery records', () => {
  for (const [id, rarity] of [
    ['bottle_cap', 'common'],
    ['toy_robot', 'common'],
    ['tiny_crown', 'uncommon'],
    ['star_fragment', 'uncommon'],
    ...['glass_marble', 'wooden_whale', 'felt_mushroom', 'acorn_teacup', 'sleeping_fox'].map(id => [id, 'common']),
  ]) {
    const treasure = catalog.treasures.find(item => item.id === id);
    assert.equal(treasure?.rarity, rarity, id);
    assert.equal(treasure.weight, 1);
    assert.deepEqual(treasure.seasons, ['spring', 'summer', 'autumn', 'winter']);
    for (const strings of Object.values(STRINGS)) assert.ok(strings[`treasure.${id}`]);
  }
  for (const id of ['oak', 'birch', 'willow'])
    for (const strings of Object.values(STRINGS)) assert.ok(strings[`tree.${id}`]);
});

test('every discovery catalog asset resolves to a reviewed atlas viewport', () => {
  const paths = [
    ...catalog.trees.flatMap(tree => [...tree.stages.map(stage => stage.art), ...Object.values(tree.seasonArt)]),
    ...catalog.treasures.map(item => item.art),
  ];
  for (const art of paths) {
    const extension = JSON.parse(read('src/art/collection.json')).find(item => item.art === art);
    if (extension) {
      const svg = read(`src/art/${art}`).toString();
      assert.ok(svg.includes(`href="art/${extension.atlas}"`), art);
      assert.ok(svg.includes('clip-path='), art);
      continue;
    }
    const asset = sources.assets.find(item => item.art === art);
    assert.ok(asset, art);
    const source = sources.sources.find(item => item.id === asset.source);
    assert.ok(source, art);
    const svg = read(`src/art/${art}`).toString();
    assert.ok(svg.includes(`href="art/${source.atlas}"`), art);
    assert.ok(svg.includes('clip-path='), art);
    assert.equal(read(`src/art/${source.atlas}`).readUInt32BE(16), source.size[0]);
    assert.equal(read(`src/art/${source.atlas}`)[25], 6, `${art}: RGBA source`);
  }
});
