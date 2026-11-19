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
  assert.ok(yard.disabled && desktop.disabled, 'a second click before the album redraws does nothing');
  await flush();
  assert.equal(calls.length, 1);
  const [method, out, x, y] = calls[0];
  assert.deepEqual([method, out, y], ['takeOutFlower', kind, 0.8]);
  assert.ok(x >= 0.3 && x <= 0.7);
  // On the desktop: taken out, then sent out by the id it came back with.
  nodes = album(ctx, 'flower', { album: { flowers: { [kind]: { count: 1, best: 0, first: 1 } } } });
  buttonsOf(nodes, 0)[1].onclick();
  await flush();
  await flush();
  assert.deepEqual(
    calls.map(c => c[0]),
    ['takeOutFlower', 'setOnDesktop'],
  );
  assert.deepEqual(calls[1].slice(1), ['p1', true]);
  // Refused: both can be tried again.
  nodes = album(ctx, 'flower', { album: { flowers: { [kind]: { count: 1, best: 0, first: 1 } } } });
  refuse = true;
  const again = buttonsOf(nodes, 0);
  again[0].onclick();
  await flush();
  assert.ok(!again[0].disabled && !again[1].disabled);
  // A full field says so, on both.
  nodes = album(ctx, 'flower', {
    album: { flowers: { [kind]: { count: 1, best: 0, first: 1 } } },
    garden: { plants: many(24, { kind }) },
  });
  for (const button of buttonsOf(nodes, 0)) {
    assert.equal(button.disabled, true);
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
    ['takeOutTree', 'setOnDesktop'],
  );
  const [, world, out, x, y, ground] = calls[0];
  assert.deepEqual([world, out], [scene.world, kind]);
  assert.ok(groundAllows({ x, y }, ground, { planting: true }), 'a spot the ground allows for planting');
  assert.deepEqual(calls[1].slice(1), ['t1', true]);
  // Six trees fill the yard, wherever they were planted.
  nodes = album(ctx, 'tree', { album: found, garden: { trees: many(6, { kind, world: 'elsewhere', stage: 2 }) } });
  for (const button of buttonsOf(nodes, 0)) {
    assert.equal(button.disabled, true);
    assert.equal(button.title, t('album.trees_full', { limit: 6 }));
  }
  // A paved place has no soil for one.
  scene.world = 'workshop';
  nodes = album(ctx, 'tree', { album: found });
  for (const button of buttonsOf(nodes, 0)) {
    assert.equal(button.disabled, true);
    assert.equal(button.title, t('album.tree_soil'));
  }
});
