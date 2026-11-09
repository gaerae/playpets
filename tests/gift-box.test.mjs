import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const calls = [];
let refuse = false;
globalThis.playPets = {
  setOut: async (...args) => {
    calls.push(args);
    return refuse ? { ok: false, error: 'fixture refusal' } : { ok: true, data: {} };
  },
  takeOut: async (...args) => {
    calls.push(['takeOut', ...args]);
    return refuse ? { ok: false, error: 'fixture refusal' } : { ok: true, data: {} };
  },
};
const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, setupAlbum } = await import('../src/panel/album.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
const gifts = (n, more = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `g${i}`, kind: 'bench', x: 0.5, y: 0.5, ...more }));

function album(ctx, garden) {
  const dom = installDom(ctx, {
    ids: ['album-tabs', 'album-grid', 'album-button', 'close-album', 'album-dialog', 'album-total'],
    anyId: true,
    props: { open: true },
  });
  dom.document.querySelectorAll = () => [];
  dom.document.querySelector = () => dom.nodes.get('album-total');
  const previous = state.data;
  state.setData({ pets: [], assets: [], bonds: {}, garden: { received: [], decor: [], boxed: [], ...garden } });
  ctx.after(() => state.setData(previous));
  calls.length = 0;
  refuse = false;
  setupAlbum();
  openAlbum('gift');
  return dom.nodes;
}

test('the gift box is hidden while empty and its gifts wait while the yard is full', ctx => {
  let nodes = album(ctx, {});
  assert.equal(nodes.get('album-box').hidden, true);
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gift_rule'));
  nodes = album(ctx, { decor: gifts(12), boxed: gifts(2, { memento: true }) });
  assert.equal(nodes.get('album-box').hidden, false);
  assert.equal(nodes.get('album-box-title').textContent, t('album.box_title', { count: 2, limit: 12 }));
  const items = nodes.get('album-box-items').children;
  assert.equal(items.length, 2);
  assert.ok(items.every(b => b.disabled && b.title === t('album.set_out_full')));
  assert.ok(items[0].classList.contains('memento'));
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gift_full'));
  nodes = album(ctx, { decor: gifts(12), boxed: gifts(12) });
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gifts_full'), 'says the box is full too');
});

test('a boxed gift is set out once, near the front of the yard', async ctx => {
  // The refusal's toast fades on a timer that would outlive the test.
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = album(ctx, { decor: gifts(3), boxed: gifts(1) });
  const [item] = nodes.get('album-box-items').children;
  assert.equal(item.disabled, false);
  assert.equal(item.title, t('album.set_out', { kind: t('decor.kind_bench') }));
  item.onclick();
  assert.equal(item.disabled, true, 'a second click before the album redraws does nothing');
  await flush();
  assert.equal(calls.length, 1);
  const [id, x, y] = calls[0];
  assert.equal(id, 'g0');
  assert.ok(x >= 0.3 && x <= 0.7);
  assert.equal(y, 0.8);
  refuse = true;
  item.onclick();
  await flush();
  assert.equal(item.disabled, false, 'a refused set-out can be tried again');
});

// What the album keeps can always come back out: a gift put away is set out again from its card.
test('a gift that came before comes back out of its card, once, unless it is out already', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const takeOut = nodes => {
    const cards = nodes.get('album-grid').children;
    return Object.fromEntries(
      cards.map((card, i) => [i, card.children.find(child => child.classList?.contains('album-take-out'))]),
    );
  };
  // The bench came and was put away; the lantern is in the yard; the pond waits in the box.
  let nodes = album(ctx, {
    received: ['bench', 'lantern', 'pond'],
    decor: [{ id: 'l', kind: 'lantern', x: 0.5, y: 0.5 }],
    boxed: [{ id: 'p', kind: 'pond', x: 0.5, y: 0.5 }],
  });
  const [bench, lantern, , pond, , , , , , flowerpot] = Object.values(takeOut(nodes));
  assert.ok(bench && !bench.disabled);
  assert.equal(bench.title, t('album.set_out', { kind: t('decor.kind_bench') }));
  assert.equal(lantern?.disabled, true, 'in the yard already');
  assert.equal(lantern.title, t('album.in_yard'));
  assert.equal(pond, undefined, 'the box sets that one out');
  assert.equal(flowerpot, undefined, 'one that never came');
  bench.onclick();
  assert.equal(bench.disabled, true);
  await flush();
  const [name, kind, x, y] = calls[0];
  assert.deepEqual([name, kind, y], ['takeOut', 'bench', 0.8]);
  assert.ok(x >= 0.3 && x <= 0.7);
  refuse = true;
  bench.onclick();
  await flush();
  assert.equal(bench.disabled, false, 'a refused one can be tried again');
  nodes = album(ctx, { received: ['bench'], decor: gifts(12, { kind: 'lantern' }) });
  const full = Object.values(takeOut(nodes))[0];
  assert.equal(full.disabled, true);
  assert.equal(full.title, t('album.set_out_full'));
});

// Set out in July, a Christmas gift would go into a spot no one sees: it waits, and says when it shows.
test('a December gift waits in the album until December', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(2026, 6, 1, 12).getTime() });
  const { GIFTS } = await import('../src/yard/catalog.js');
  const { scene } = await import('../src/yard/world.js');
  const was = scene.season;
  ctx.after(() => {
    scene.season = was;
  });
  scene.season = 'winter';
  // A card's Set out button; cards are in catalogue order.
  const cardOf = (nodes, kind) => {
    const card = nodes.get('album-grid').children[GIFTS.findIndex(g => g.id === kind)];
    return card.children.find(child => child.classList?.contains('album-take-out'));
  };
  const garden = { received: ['xmas_tree', 'santa'], boxed: [{ id: 's', kind: 'santa', x: 0.5, y: 0.5 }] };
  let nodes = album(ctx, garden);
  let tree = cardOf(nodes, 'xmas_tree'),
    [santa] = nodes.get('album-box-items').children;
  for (const button of [tree, santa]) {
    assert.equal(button.disabled, true);
    assert.equal(button.title, t('album.shown_december'));
  }
  ctx.mock.timers.setTime(new Date(2026, 11, 2, 12).getTime());
  nodes = album(ctx, garden);
  tree = cardOf(nodes, 'xmas_tree');
  [santa] = nodes.get('album-box-items').children;
  assert.equal(tree.disabled, false);
  assert.equal(tree.title, t('album.set_out', { kind: t('decor.kind_xmas_tree') }));
  assert.equal(santa.disabled, false);
  // Out in the yard but out of sight in July: the title says when it shows, not "In the yard".
  ctx.mock.timers.setTime(new Date(2026, 6, 1, 12).getTime());
  nodes = album(ctx, { received: ['xmas_tree'], decor: [{ id: 'x', kind: 'xmas_tree', x: 0.5, y: 0.5 }] });
  assert.equal(cardOf(nodes, 'xmas_tree').title, t('album.shown_december'));
});

// A snowman is built in the snow, never set out: its card offers nothing until one stands in the yard.
test('a built snowman has no Set out, in any season, and says In the yard while out', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(2026, 11, 15, 12).getTime() });
  const { GIFTS } = await import('../src/yard/catalog.js');
  const { scene } = await import('../src/yard/world.js');
  const was = scene.season;
  ctx.after(() => {
    scene.season = was;
  });
  const cardOf = (nodes, kind) => {
    const card = nodes.get('album-grid').children[GIFTS.findIndex(g => g.id === kind)];
    return card.children.find(child => child.classList?.contains('album-take-out'));
  };
  for (const season of ['summer', 'winter']) {
    scene.season = season;
    assert.equal(cardOf(album(ctx, { received: ['snowman'] }), 'snowman'), undefined, season);
  }
  const nodes = album(ctx, { received: ['snowman'], decor: [{ id: 's', kind: 'snowman', x: 0.5, y: 0.7 }] });
  const snowman = cardOf(nodes, 'snowman');
  assert.equal(snowman.disabled, true);
  assert.equal(snowman.title, t('album.in_yard'));
});
