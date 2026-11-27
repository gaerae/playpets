// A book filled is the album's biggest moment, and it passed with only a mark on its tab
// (src/panel/album.js booksDone): the find that fills a book is followed by a card saying so, once.
// A book already full when this first looks is not announced late.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage } from './support/dom.mjs';

const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { booksDone } = await import('../src/panel/album.js');
const { setupCard } = await import('../src/yard/card.js');
const { SHOOTS, TREES } = await import('../src/yard/catalog.js');

const all = kinds => Object.fromEntries(kinds.map((k, i) => [k.id, { count: 1, first: 1000 + i }]));

function yard(ctx, album) {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  installDom(ctx, { anyId: true });
  installStorage(ctx);
  const parts = new Map();
  const node = Object.assign(document.getElementById('catch-card'), {
    hidden: true,
    querySelector: selector => parts.get(selector) ?? parts.set(selector, element()).get(selector),
  });
  setupCard();
  const before = state.data;
  ctx.after(() => state.setData(before));
  const set = next => state.setData({ ...before, pets: [], album: next, garden: { received: [] } });
  set(album);
  return { node, parts, set };
}

test('the find that fills a book is followed by a card saying so, once', ctx => {
  const { node, parts, set } = yard(ctx, { trees: all(TREES), shoots: {} });
  booksDone();
  assert.equal(node.hidden, true, 'a book full before is not announced late');
  set({ trees: all(TREES), shoots: all(SHOOTS) });
  booksDone();
  assert.equal(node.hidden, false);
  assert.equal(parts.get('strong').textContent, t('album.book_done', { book: t('album.shoots') }));
  assert.equal(parts.get('small').textContent, t('album.book_done_detail', { count: SHOOTS.length }));
  assert.ok(node.classList.contains('keep-detail'), 'how many it holds stays in view');
  node.hidden = true;
  booksDone();
  assert.equal(node.hidden, true, 'and only once');
});

test('the card is in every language, with the same placeholders', async () => {
  const { STRINGS } = await import('../src/core/strings.js');
  for (const [lang, table] of Object.entries(STRINGS)) {
    assert.match(table['album.book_done'], /\{book\}/, lang);
    assert.match(table['album.book_done_detail'], /\{count\}/, lang);
  }
});
