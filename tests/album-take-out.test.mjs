// A flower or a tree the album has comes out of its card again, grown and free, into the yard or
// into the yard and out on the desktop (docs/design/2026-11-19-album-take-out.md).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const calls = [];
let refuse = false;
const answer =
  (name, data) =>
  async (...args) => {
    calls.push([name, ...args]);
    return refuse ? { ok: false, error: 'fixture refusal' } : { ok: true, data };
  };
globalThis.playPets = {
  takeOutFlower: answer('takeOutFlower', { id: 'p1' }),
  takeOutTree: answer('takeOutTree', { id: 't1' }),
  setOnDesktop: answer('setOnDesktop', null),
  pullPlant: answer('pullPlant', null),
  removeTree: answer('removeTree', null),
};
const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, setupAlbum } = await import('../src/panel/album.js');
const { FLOWERS, TREES } = await import('../src/yard/catalog.js');
const { groundAllows } = await import('../src/yard/discovery-rules.js');
const { scene } = await import('../src/yard/world.js');
const { measureYard } = await import('../src/yard/field.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
const many = (n, more) => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, x: 0.5, y: 0.5, planted: 1, ...more }));

function album(ctx, book, { album: found = {}, garden = {} } = {}) {
  const dom = installDom(ctx, {
    ids: ['album-tabs', 'album-grid', 'album-button', 'close-album', 'album-dialog', 'album-total', 'yard'],
    anyId: true,
    props: { open: true },
  });
  dom.document.querySelectorAll = () => [];
  dom.document.querySelector = () => dom.nodes.get('album-total');
  const previous = state.data;
  state.setData({
    pets: [],
    assets: [],
    bonds: {},
    album: found,
    garden: { received: [], decor: [], boxed: [], plants: [], trees: [], ...garden },
  });
  ctx.after(() => state.setData(previous));
  calls.length = 0;
  refuse = false;
  setupAlbum();
  openAlbum(book);
  return dom.nodes;
}
// A card's two buttons, Set out and the desktop's; none on a card not found yet.
const buttonsOf = (nodes, index) => {
  const row = nodes.get('album-grid').children[index].children.find(c => c.classList?.contains('album-actions'));
  return row ? row.children : [];
};

test('a flower the album has comes out in bloom, into the yard or onto the desktop too', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const kind = FLOWERS[0].id,
    name = t(`garden.kind_${kind}`);
  let nodes = album(ctx, 'flower', { album: { flowers: { [kind]: { count: 1, best: 0, first: 1 } } } });
  assert.equal(buttonsOf(nodes, 1).length, 0, 'one not found yet has none');
  const [yard, desktop] = buttonsOf(nodes, 0);
  assert.equal(yard.textContent, t('album.take_out'));
  assert.equal(yard.title, t('album.set_out', { kind: name }));
  assert.ok(desktop.classList.contains('album-to-desktop'), 'a small screen beside Set out');
  assert.equal(desktop.getAttribute('aria-label'), desktop.title);
  assert.equal(desktop.title, t('album.set_out_desktop', { kind: name }));
  yard.onclick();
  assert.equal(yard.parentNode.dataset.pending, 'true', 'held until the album redraws');
  yard.onclick();
  await flush();
  assert.equal(calls.length, 1);
  const [method, out, x, y] = calls[0];
  assert.deepEqual([method, out, y], ['takeOutFlower', kind, 0.8]);
  assert.ok(x >= 0.3 && x <= 0.7);
  assert.equal(calls[0][4], false, 'into the yard only');
  // On the desktop too: the same call, which also puts it out, so it is saved once.
  nodes = album(ctx, 'flower', { album: { flowers: { [kind]: { count: 1, best: 0, first: 1 } } } });
  buttonsOf(nodes, 0)[1].onclick();
  await flush();
  await flush();
  assert.deepEqual(
    calls.map(c => [c[0], c[1], c.at(-1)]),
    [['takeOutFlower', kind, true]],
  );
  // Refused: both can be tried again.
  nodes = album(ctx, 'flower', { album: { flowers: { [kind]: { count: 1, best: 0, first: 1 } } } });
  refuse = true;
  const again = buttonsOf(nodes, 0);
  again[0].onclick();
  await flush();
  assert.equal(again[0].parentNode.dataset.pending, undefined, 'let go after a refusal');
  // A full field says so, on both (the frame beside them is the yard's gifts', album-finds-out.test.mjs).
  nodes = album(ctx, 'flower', {
    album: { flowers: { [kind]: { count: 1, best: 0, first: 1 } } },
    garden: { plants: many(24, { kind }) },
  });
  for (const button of [...buttonsOf(nodes, 0)].slice(0, 2)) {
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.title, t('album.flowers_full', { limit: 24 }));
  }
});

test('a tree the album has comes out mature on free soil of the current place, within the yard’s trees', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const was = scene.world;
  ctx.after(() => {
    scene.world = was;
  });
  const kind = TREES[0].id,
    name = t(`tree.${kind}`),
    found = { trees: { [kind]: { count: 1, best: 0, first: 1 } } };
  let nodes = album(ctx, 'tree', { album: found });
  // The yard has a size, so its soil is measured.
  nodes.get('yard').getBoundingClientRect = () => ({ width: 1000, height: 700 });
  measureYard();
  const [yard, desktop] = buttonsOf(nodes, 0);
  assert.equal(yard.title, t('album.set_out', { kind: name }));
  assert.equal(desktop.title, t('album.set_out_desktop', { kind: name }));
  desktop.onclick();
  await flush();
  await flush();
  assert.deepEqual(
    calls.map(c => c[0]),
    ['takeOutTree'],
  );
  const [, world, out, x, y, ground, desktopToo] = calls[0];
  assert.deepEqual([world, out, desktopToo], [scene.world, kind, true]);
  assert.ok(groundAllows({ x, y }, ground, { planting: true }), 'a spot the ground allows for planting');
  // Six trees fill the yard, wherever they were planted.
  nodes = album(ctx, 'tree', { album: found, garden: { trees: many(6, { kind, world: 'elsewhere', stage: 2 }) } });
  for (const button of buttonsOf(nodes, 0)) {
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.title, t('album.trees_full', { limit: 6 }));
  }
  // A paved place has no soil for one.
  scene.world = 'workshop';
  nodes = album(ctx, 'tree', { album: found });
  for (const button of buttonsOf(nodes, 0)) {
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.title, t('album.tree_soil'));
  }
});

// What a card set out comes back through it: a flower pulled, a tree removed, the last one first; a
// seedling or a young tree still growing is not the card's (album-in-and-out.md).
test('a grown flower or tree comes back through its card, within what the album found', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const flower = FLOWERS[0].id,
    tree = TREES[0].id,
    twice = { count: 2, best: 0, first: 1 };
  let nodes = album(ctx, 'flower', {
    album: { flowers: { [flower]: twice } },
    garden: {
      plants: [...many(1, { kind: flower, bloomed: true }), { id: 'young', kind: flower, x: 0.2, y: 0.8, planted: 9 }],
    },
  });
  const [, count] = buttonsOf(nodes, 0);
  let [fewer, , more] = buttonsOf(nodes, 0);
  assert.equal(count.textContent, '1/2', 'the seedling is not counted');
  more.onclick();
  await flush();
  assert.deepEqual(
    calls.map(c => c[0]),
    ['takeOutFlower'],
  );
  nodes = album(ctx, 'flower', {
    album: { flowers: { [flower]: twice } },
    garden: { plants: many(2, { kind: flower, bloomed: true }) },
  });
  [fewer, , more] = buttonsOf(nodes, 0);
  assert.equal(more.getAttribute('aria-disabled'), 'true');
  fewer.onclick();
  await flush();
  assert.deepEqual(calls, [['pullPlant', 'x1']]);
  // A tree found once and grown in the yard: Put back removes it; a sapling stays.
  nodes = album(ctx, 'tree', {
    album: { trees: { [tree]: { count: 1, best: 0, first: 1 } } },
    garden: {
      trees: [...many(1, { kind: tree, stage: 2, matured: true }), { id: 's', kind: tree, x: 0.4, y: 0.6, stage: 0 }],
    },
  });
  const [back] = buttonsOf(nodes, 0);
  assert.equal(back.textContent, t('album.put_back'));
  back.onclick();
  await flush();
  assert.deepEqual(calls, [['removeTree', 'x0']]);
});
