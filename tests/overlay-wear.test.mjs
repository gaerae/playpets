// A gift out on the desktop looks as it does in the yard: a snowman wears what it was dressed in and
// the Christmas tree what hangs on it (src/overlay/wear.js, drawn by overlay.js).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets = {};
const { wear, wearArt } = await import('../src/overlay/wear.js');
const { dressLayers } = await import('../src/yard/dress-layers.js');
const { giftKind } = await import('../src/yard/catalog.js');
const { drawYard } = await import('./support/yard.mjs');
const { element } = await import('./support/dom.mjs');

const ART = [
  'decor/sculpted/snowman.svg',
  'decor/snow_hat.svg',
  'decor/snow_scarf.svg',
  'decor/snow_nose.svg',
  'decor/xmas_tree.svg',
];
const kids = node => node.children.filter(c => typeof c === 'object' && !c.removed);
const layer = (button, name) => kids(button).find(c => c.classList.contains(name));
const desktopGift = (id, kind) => ({ id, kind, button: element('button') });

test('a gift out on the desktop loads its own drawing and what it can wear', () => {
  const snowman = giftKind('snowman');
  assert.deepEqual(wearArt('snowman'), [snowman.art, ...snowman.dress.map(part => part.art)]);
  assert.deepEqual(wearArt('bench'), [giftKind('bench').art]);
  assert.deepEqual(wearArt('nothing'), []);
});

test('a snowman out on the desktop wears what it wears in the yard, and changes with it', async t => {
  await drawYard(t, { now: new Date(2026, 11, 15, 12).getTime(), art: ART });
  const v = desktopGift('s', 'snowman');
  const garden = dress => ({ decor: [{ id: 's', kind: 'snowman', x: 0.5, y: 0.7, dress }] });
  wear(v, garden(['scarf', 'hat']));
  assert.equal(layer(v.button, 'dress-layers').innerHTML, dressLayers('snowman', ['scarf', 'hat']));
  assert.match(layer(v.button, 'dress-layers').innerHTML, /data-part="hat"/);
  wear(v, garden(['nose']));
  assert.equal(layer(v.button, 'dress-layers').innerHTML, dressLayers('snowman', ['nose']));
  assert.equal(kids(v.button).filter(c => c.classList.contains('dress-layers')).length, 1, 'one layer');
  wear(v, garden([]));
  assert.equal(layer(v.button, 'dress-layers').innerHTML, '');
});

test('the Christmas tree out on the desktop wears this December’s ornaments; a bench wears nothing', async t => {
  const december = new Date(2026, 11, 20, 12);
  await drawYard(t, { now: december.getTime(), art: ART });
  const tree = desktopGift('t', 'xmas_tree');
  const garden = {
    decor: [{ id: 't', kind: 'xmas_tree', x: 0.5, y: 0.6 }],
    ornaments: [
      { book: 'flower', id: 'camellia', hook: 0 },
      { book: 'treasure', id: 'pinecone', hook: 11 },
    ],
    ornamentYear: 2026,
  };
  wear(tree, garden, december);
  const baubles = kids(layer(tree.button, 'ornaments'));
  assert.deepEqual(
    baubles.map(b => b.className),
    ['bauble flower', 'bauble treasure'],
  );
  wear(tree, garden, new Date(2027, 11, 2));
  assert.equal(kids(layer(tree.button, 'ornaments')).length, 0, 'next December starts bare');
  const bench = desktopGift('b', 'bench');
  wear(bench, { decor: [{ id: 'b', kind: 'bench', x: 0.2, y: 0.7 }] });
  assert.deepEqual(kids(bench.button), []);
});
