import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { webpName } from '../scripts/art-webp-lib.mjs';
import { STRINGS } from '../src/core/strings.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url));
const catalog = JSON.parse(read('src/content/catalog.json'));
const sources = JSON.parse(read('assets/discovery/ART-SOURCES.json'));

test('discovery offers twenty-four distinct tree species with growth and deciduous seasonal art', () => {
  assert.deepEqual(
    catalog.trees.map(tree => tree.id),
    [
      'cherry',
      'maple',
      'pine',
      'oak',
      'birch',
      'willow',
      'ginkgo',
      'persimmon',
      'bamboo',
      'magnolia',
      'crape_myrtle',
      'metasequoia',
      'wisteria',
      'fringe_tree',
      'fig',
      'golden_rain_tree',
      'chestnut',
      'red_plum',
      'yuzu',
      'juniper',
      'lilac',
      'silk_tree',
      'osmanthus',
      'holly',
    ],
  );
  for (const id of ['oak', 'birch', 'willow', 'ginkgo', 'persimmon', 'magnolia', 'crape_myrtle', 'metasequoia']) {
    const tree = catalog.trees.find(item => item.id === id);
    assert.deepEqual(
      tree.stages.map(stage => stage.name),
      ['seedling', 'young', 'mature'],
    );
    for (const season of ['spring', 'autumn', 'winter']) assert.ok(tree.seasonArt[season], `${id} ${season}`);
    assert.equal(new Set([tree.stages[2].art, ...Object.values(tree.seasonArt)]).size, 4);
  }
  // A deciduous tree's mature drawing is one season's look; the other three seasons each have their own
  for (const [id, own] of [
    ['wisteria', 'spring'],
    ['fringe_tree', 'spring'],
    ['fig', 'summer'],
    ['golden_rain_tree', 'summer'],
    ['chestnut', 'autumn'],
    ['red_plum', 'winter'],
    ['lilac', 'spring'],
    ['silk_tree', 'summer'],
    ['osmanthus', 'autumn'],
    ['holly', 'winter'],
  ]) {
    const tree = catalog.trees.find(item => item.id === id);
    assert.deepEqual(
      Object.keys(tree.seasonArt).sort(),
      ['spring', 'summer', 'autumn', 'winter'].filter(season => season !== own).sort(),
      id,
    );
    assert.equal(new Set([tree.stages[2].art, ...Object.values(tree.seasonArt)]).size, 4, id);
  }
  // Evergreens keep their leaves: the yuzu only blossoms and ripens, the juniper never changes
  assert.deepEqual(Object.keys(catalog.trees.find(item => item.id === 'yuzu').seasonArt).sort(), [
    'autumn',
    'spring',
    'summer',
  ]);
  assert.deepEqual(catalog.trees.find(item => item.id === 'juniper').seasonArt ?? {}, {});
});

test('whimsical keepsakes have translated names and year-round weighted discovery records', () => {
  for (const [id, rarity] of [
    ['bottle_cap', 'common'],
    ['toy_robot', 'common'],
    ['tiny_crown', 'uncommon'],
    ['star_fragment', 'uncommon'],
    ...['glass_marble', 'wooden_whale', 'felt_mushroom', 'acorn_teacup', 'sleeping_fox'].map(id => [id, 'common']),
    ...['old_coin', 'blue_feather', 'pinecone', 'old_key', 'paper_boat', 'spinning_top'].map(id => [id, 'common']),
    ['freshwater_pearl', 'uncommon'],
    ['four_leaf_clover', 'uncommon'],
    ...['heart_locket', 'pearl_hair_clip', 'shell_mirror'].map(id => [id, 'common']),
    ['perfume_bottle', 'uncommon'],
  ]) {
    const treasure = catalog.treasures.find(item => item.id === id);
    assert.equal(treasure?.rarity, rarity, id);
    assert.equal(treasure.weight, 1);
    assert.deepEqual(treasure.seasons, ['spring', 'summer', 'autumn', 'winter']);
    for (const strings of Object.values(STRINGS)) assert.ok(strings[`treasure.${id}`]);
  }
  for (const id of [
    'oak',
    'birch',
    'willow',
    'ginkgo',
    'persimmon',
    'bamboo',
    'magnolia',
    'crape_myrtle',
    'metasequoia',
    'wisteria',
    'fringe_tree',
    'fig',
    'golden_rain_tree',
    'chestnut',
    'red_plum',
    'yuzu',
    'juniper',
    'lilac',
    'silk_tree',
    'osmanthus',
    'holly',
  ])
    for (const strings of Object.values(STRINGS)) assert.ok(strings[`tree.${id}`]);
});

test('every discovery catalog asset resolves to a reviewed atlas viewport', () => {
  const paths = [
    ...catalog.trees.flatMap(tree => [...tree.stages.map(stage => stage.art), ...Object.values(tree.seasonArt || {})]),
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
    assert.ok(svg.includes(`href="art/${webpName(source.atlas)}"`), art);
    assert.ok(svg.includes('clip-path='), art);
    assert.equal(read(`assets/art/${source.atlas}`).readUInt32BE(16), source.size[0]);
    assert.equal(read(`assets/art/${source.atlas}`)[25], 6, `${art}: RGBA source`);
  }
});
