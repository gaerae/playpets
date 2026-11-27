// What can be found right now (src/panel/album.js): a card not found yet whose kind the yard could
// give this minute carries a paper tag, Now, by the very rules the yard goes by (catalog.js fishHere
// and bugChances, growth.js seasonFlowers), and a book opens at the first of them.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, renderAlbum, setupAlbum } = await import('../src/panel/album.js');
const { BUGS, bugChances, FISH, fishHere } = await import('../src/yard/catalog.js');
const { seasonFlowers } = await import('../src/yard/growth.js');
const { scene } = await import('../src/yard/world.js');

function album(ctx, { found = {}, at = {} } = {}) {
  const dom = installDom(ctx, { anyId: true });
  const before = state.data,
    was = { ...scene };
  ctx.after(() => {
    state.setData(before);
    Object.assign(scene, was);
  });
  Object.assign(scene, { world: 'woodland', season: 'summer', period: 'day', weather: 'clear', event: null }, at);
  dom.document.querySelectorAll = () => dom.document.getElementById('album-tabs').children;
  dom.document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)?.[1];
    return dom.document.getElementById('album-tabs').children.find(tab => tab.dataset.book === id)?.children[1];
  };
  state.setData({
    ...before,
    pets: [],
    album: found,
    garden: { received: [], decor: [], boxed: [], plants: [], trees: [] },
  });
  setupAlbum();
  return dom;
}
const cards = () => document.getElementById('album-grid').children;
const tagged = () =>
  cards()
    .filter(card => card.children.some(part => part.classList?.contains('album-now')))
    .map(card => card.dataset.kind);
const ids = kinds => kinds.map(k => k.id);

test('a fish not caught yet that bites now carries Now; one caught, or out of season, does not', ctx => {
  const biting = ids(fishHere('summer', 'day')),
    caught = biting[0];
  album(ctx, { found: { fish: { [caught]: { count: 1, best: 10, first: 1 } } } });
  openAlbum('fish');
  assert.ok(biting.length > 1 && biting.length < FISH.length, 'some bite, not all');
  assert.deepEqual(
    tagged(),
    biting.filter(id => id !== caught),
    'the ones that bite now, in book order, less the one caught',
  );
  const tag = cards()
    .find(card => card.dataset.kind === biting[1])
    .children.find(part => part.classList?.contains('album-now'));
  assert.equal(tag.textContent, t('album.now'));
  scene.period = 'night';
  renderAlbum();
  assert.deepEqual(
    tagged(),
    ids(fishHere('summer', 'night')).filter(id => id !== caught),
    'at night, the night fish',
  );
});

test('a fish of an event bites only while it is on; a place with no water has no fish now', ctx => {
  album(ctx, { at: { season: 'autumn', period: 'evening' } });
  openAlbum('fish');
  assert.ok(!tagged().includes('moon_carp'), 'no harvest, no moon carp');
  scene.event = 'harvest';
  renderAlbum();
  assert.ok(tagged().includes('moon_carp'), 'at the harvest it bites');
  scene.world = 'workshop';
  renderAlbum();
  assert.deepEqual(tagged(), [], 'the workshop has no lake');
});

test('a bug is about now only in clear weather, by the yard’s own population', ctx => {
  album(ctx);
  openAlbum('bug');
  const about = ids(bugChances('summer', 'day', 'clear'));
  assert.ok(about.length > 0 && about.length < BUGS.length);
  assert.deepEqual(
    tagged(),
    ids(BUGS).filter(id => about.includes(id)),
  );
  scene.weather = 'rain';
  renderAlbum();
  assert.deepEqual(tagged(), [], 'nothing flies in the rain');
});

test('a flower is one a seed planted now may grow into', ctx => {
  album(ctx, { at: { season: 'spring' } });
  openAlbum('flower');
  assert.deepEqual(tagged(), ids(seasonFlowers('spring')));
});

// The book opens where the next find is: its first card available now is scrolled to the top of the
// page; the keyboard stays on the book's tab, as before.
test('a book opens scrolled to its first kind available now, the focus on its tab', ctx => {
  const caught = Object.fromEntries(ids(FISH.slice(0, 2)).map(id => [id, { count: 1, best: 10, first: 1 }]));
  const dom = album(ctx, { found: { fish: caught }, at: { period: 'night' } });
  const grid = dom.document.getElementById('album-grid');
  const make = dom.document.createElement.bind(dom.document);
  // Each card one row of 120px below the last, the page's top at 100.
  dom.document.createElement = tag => {
    const node = make(tag);
    node.getBoundingClientRect = () => {
      const row = grid.children.indexOf(node);
      return { top: 100 + 120 * row - grid.scrollTop, bottom: 220 + 120 * row - grid.scrollTop };
    };
    return node;
  };
  grid.getBoundingClientRect = () => ({ top: 100, bottom: 500 });
  grid.scrollTop = 0;
  openAlbum('fish');
  const first = ids(FISH).findIndex(id => !caught[id] && ids(fishHere('summer', 'night')).includes(id));
  assert.ok(first > 0);
  assert.equal(grid.scrollTop, 120 * first - 8, 'the first one available now, a little below the top');
  assert.equal(dom.document.activeElement.dataset.book, 'fish', 'the keyboard is on the book’s tab');
  scene.world = 'workshop';
  dom.document
    .getElementById('album-tabs')
    .children.find(tab => tab.dataset.book === 'fish')
    .onclick();
  assert.equal(grid.scrollTop, 0, 'nothing available now: the top of the book');
});
