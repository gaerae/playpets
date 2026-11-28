import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  putAway: async (...args) => {
    calls.push(['putAway', ...args]);
    return { ok: true, data: null };
  },
};
// A card's first button: Set out (or Put back), in its row beside the desktop's; a snowman's lone one.
const firstButton = card => {
  const row = card.children.find(child => child.classList?.contains('album-actions'));
  return row ? row.children[0] : card.children.find(child => child.classList?.contains('album-take-out'));
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

// A gift waiting in the box is the same gift as any other: there is no box apart from the book, its
// own card sets it out, and a memento wears its giver's heart on the card, as in the yard.
test('the gift book has no box apart from it, and says when the yard is full of gifts', ctx => {
  assert.doesNotMatch(readFileSync('src/index.html', 'utf8'), /album-box/);
  let nodes = album(ctx, {});
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gift_rule'));
  nodes = album(ctx, { decor: gifts(12), boxed: gifts(2, { memento: true }) });
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gift_full'));
  // Finds set out from the album have their own room: they leave the gifts' free.
  nodes = album(ctx, { decor: gifts(12, { kind: 'fish_out', holds: ['carp'] }) });
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gift_rule'));
});

test('a gift waiting in the box comes out of its own card, a memento marked with its giver', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const { GIFTS } = await import('../src/yard/catalog.js');
  const cardOf = (nodes, kind) => nodes.get('album-grid').children[GIFTS.findIndex(g => g.id === kind)];
  // On the card beside its picture, not inside the picture's button, so a reader hears it.
  const heartOf = card => card.children.find(c => c.classList?.contains('album-heart'));
  const nodes = album(ctx, {
    received: ['bench', 'lantern', 'pond'],
    decor: [{ id: 'l', kind: 'lantern', x: 0.5, y: 0.5, memento: true, from: 'gone' }],
    boxed: [
      { id: 'b', kind: 'bench', x: 0.5, y: 0.5, memento: true, from: 'miso' },
      { id: 'p', kind: 'pond', x: 0.5, y: 0.5 },
    ],
  });
  // Its giver is still in the yard; the lantern's has left.
  state.data.pets = [{ id: 'miso', name: 'Miso' }];
  openAlbum('gift');
  const bench = cardOf(nodes, 'bench'),
    heart = heartOf(bench);
  assert.ok(heart, 'a memento in the box has its heart on the card');
  assert.equal(heart.title, t('album.memento', { name: 'Miso' }));
  assert.equal(heart.getAttribute('aria-label'), heart.title);
  assert.equal(heart.textContent, '', 'the heart is painted (dialog.css), not a letter of the font');
  assert.equal(heartOf(cardOf(nodes, 'lantern')).title, t('album.memento_plain'), 'one from a friend who left');
  assert.equal(heartOf(cardOf(nodes, 'pond')), undefined, 'an everyday gift waiting has none');
  // Waiting in the box is not out: its card sets it out, by the same call as any gift.
  const setOut = firstButton(bench);
  assert.equal(setOut.textContent, t('album.take_out'));
  assert.equal(setOut.getAttribute('aria-pressed'), 'false');
  setOut.onclick();
  await flush();
  assert.deepEqual(
    calls.map(c => c.slice(0, 2)),
    [['takeOut', 'bench']],
  );
  assert.equal(firstButton(cardOf(nodes, 'pond')).getAttribute('aria-disabled'), 'false');
});

// What the album keeps can always come back out: a gift put away is set out again from its card.
test('a gift that came before comes back out of its card, once, unless it is out already', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const takeOut = nodes => {
    const cards = nodes.get('album-grid').children;
    return Object.fromEntries(cards.map((card, i) => [i, firstButton(card)]));
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
  // In the yard already: a press puts it back.
  assert.equal(lantern.textContent, t('album.put_back'));
  assert.equal(lantern.title, t('album.put_back_one', { kind: t('decor.kind_lantern') }));
  lantern.onclick();
  await flush();
  assert.deepEqual(calls.pop(), ['putAway', 'l']);
  assert.equal(pond.title, t('album.set_out', { kind: t('decor.kind_pond') }), 'the box\u2019s too, from its card');
  assert.equal(flowerpot, undefined, 'one that never came');
  bench.onclick();
  assert.equal(bench.parentNode.dataset.pending, 'true');
  bench.onclick();
  await flush();
  assert.equal(calls.length, 1, 'a second press while held does nothing');
  const [name, kind, x, y] = calls[0];
  assert.deepEqual([name, kind, y], ['takeOut', 'bench', 0.8]);
  assert.ok(x >= 0.3 && x <= 0.7);
  refuse = true;
  bench.onclick();
  await flush();
  assert.equal(bench.getAttribute('aria-disabled'), 'false', 'a refused one can be tried again');
  nodes = album(ctx, { received: ['bench'], decor: gifts(12, { kind: 'lantern' }) });
  const full = Object.values(takeOut(nodes))[0];
  assert.equal(full.getAttribute('aria-disabled'), 'true');
  assert.equal(full.title, t('album.set_out_full'));
});

// Set out in July in a yard kept in autumn, a Christmas gift would go into a spot no one sees: it
// waits, and says when it shows: from mid-November. A winter yard shows it any day.
test('a Christmas gift waits in the album until its window or a winter yard', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(2026, 6, 1, 12).getTime() });
  const { GIFTS } = await import('../src/yard/catalog.js');
  const { scene } = await import('../src/yard/world.js');
  const was = scene.season;
  ctx.after(() => {
    scene.season = was;
  });
  scene.season = 'autumn';
  // A card's Set out button; cards are in catalogue order.
  const cardOf = (nodes, kind) => {
    const card = nodes.get('album-grid').children[GIFTS.findIndex(g => g.id === kind)];
    return firstButton(card);
  };
  const garden = { received: ['xmas_tree', 'santa'], boxed: [{ id: 's', kind: 'santa', x: 0.5, y: 0.5 }] };
  let nodes = album(ctx, garden);
  let tree = cardOf(nodes, 'xmas_tree'),
    santa = cardOf(nodes, 'santa');
  assert.equal(tree.getAttribute('aria-disabled'), 'true');
  assert.equal(santa.getAttribute('aria-disabled'), 'true');
  for (const button of [tree, santa]) assert.equal(button.title, t('album.shown_christmas'));
  ctx.mock.timers.setTime(new Date(2026, 10, 15, 12).getTime());
  nodes = album(ctx, garden);
  tree = cardOf(nodes, 'xmas_tree');
  santa = cardOf(nodes, 'santa');
  assert.equal(tree.getAttribute('aria-disabled'), 'false');
  assert.equal(tree.title, t('album.set_out', { kind: t('decor.kind_xmas_tree') }));
  assert.equal(santa.getAttribute('aria-disabled'), 'false');
  // Out in the yard but out of sight in July: it can still be put back.
  ctx.mock.timers.setTime(new Date(2026, 6, 1, 12).getTime());
  nodes = album(ctx, { received: ['xmas_tree'], decor: [{ id: 'x', kind: 'xmas_tree', x: 0.5, y: 0.5 }] });
  assert.equal(cardOf(nodes, 'xmas_tree').textContent, t('album.put_back'));
  assert.equal(cardOf(nodes, 'xmas_tree').getAttribute('aria-disabled'), 'false');
  // The desktop leaves it out too, so its screen waits and says when it shows.
  const screenOf = nodes =>
    cardOf(nodes, 'xmas_tree').parentNode.children.find(c => c.classList?.contains('album-to-desktop'));
  assert.equal(screenOf(nodes).getAttribute('aria-disabled'), 'true');
  assert.equal(screenOf(nodes).title, t('album.shown_christmas'));
  // One already on the desktop can still come off it.
  nodes = album(ctx, {
    received: ['xmas_tree'],
    decor: [{ id: 'x', kind: 'xmas_tree', x: 0.5, y: 0.5, onDesktop: true }],
  });
  assert.equal(screenOf(nodes).getAttribute('aria-disabled'), 'false');
  scene.season = 'winter';
  nodes = album(ctx, garden);
  assert.equal(cardOf(nodes, 'xmas_tree').getAttribute('aria-disabled'), 'false', 'a winter yard in July shows it');
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
