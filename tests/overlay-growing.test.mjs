// A flower or a planted tree out on the desktop is drawn as the yard draws it: the flower at the
// stage the clock says, the tree at the stage the backend grew it to (the box desktop/items.rs
// gives it), a grown tree in the yard's season (src/overlay/growing.js).

import './support/content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';

const { growing, growingArt, growingLook, visitKey } = await import('../src/overlay/growing.js');
const { STAGES } = await import('../src/yard/catalog.js');

const MIN = 60 * 1000;
const garden = {
  plants: [{ id: 'p', kind: 'sunflower', x: 0.5, y: 0.5, planted: 0 }],
  trees: [{ id: 't', kind: 'cherry', world: 'meadow', x: 0.5, y: 0.5, planted: 0, stage: 0 }],
  decor: [{ id: 'g', kind: 'bench', x: 0.5, y: 0.5 }],
};
// Every drawing here is 40 × 60, the size the backend's box is made for.
const size = () => [40, 60];

test('a desktop thing is told apart by the garden list it is in', () => {
  assert.equal(growing(garden, 'p').what, 'plant');
  assert.equal(growing(garden, 't').what, 'tree');
  assert.equal(growing(garden, 'g'), null, 'a gift is drawn as before');
  assert.equal(growing(undefined, 'p'), null);
});

test('a flower grows on the desktop as in the yard and stands tall once it buds', () => {
  const plant = growing(garden, 'p');
  const seed = growingLook(plant, 'summer', 0, size);
  assert.equal(seed.stage, 'seed');
  assert.equal(seed.art, STAGES[0].art);
  assert.deepEqual([seed.width, seed.height], [50, 75]);
  const bloom = growingLook(plant, 'summer', STAGES.at(-1).at + MIN, size);
  assert.equal(bloom.stage, 'bloom');
  assert.match(bloom.art, /flowers\//);
  // The backend's box for a sunflower is 70 × 105 (items.rs): the bloom fills it.
  assert.deepEqual([bloom.width, bloom.height], [70, 105]);
});

test("a planted tree is drawn at its saved stage's size, and grown in the yard's season", () => {
  const tree = growing(garden, 't');
  const young = growingLook(tree, 'autumn', Date.now());
  assert.deepEqual([young.stage, young.width, young.height], [0, 35, 40]);
  tree.item.stage = 2;
  assert.match(growingLook(tree, 'autumn').art, /cherry-mature-autumn/);
  assert.match(growingLook(tree, 'spring').art, /cherry-mature\.svg/);
  assert.deepEqual([growingLook(tree, 'spring').width, growingLook(tree, 'spring').height], [160, 170]);
  tree.item.stage = 0;
});

test('the drawings a desktop flower or tree needs are loaded before it is drawn', () => {
  assert.ok(growingArt('sunflower').includes(STAGES[0].art));
  assert.ok(growingArt('cherry').some(art => art.includes('cherry-mature-winter')));
  assert.deepEqual(growingArt('bench'), []);
});

test('a friend visiting a flower or a tree on the desktop says what it says in the yard', () => {
  assert.equal(visitKey('sunflower'), 'garden.visit');
  assert.equal(visitKey('cherry'), 'tree.visit');
  assert.equal(visitKey('bench'), 'decor.visit_bench');
});
