// The album is an open book (docs/design/2026-11-24-the-yard-plays-like-a-game.md, G1): the right
// page holds the cards, and the left page shows the one chosen, large, with what it says. A card
// keeps its words for those who listen; the eye reads them on the left page.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, setupAlbum } = await import('../src/panel/album.js');
const { FLOWERS } = await import('../src/yard/catalog.js');

function album(ctx, found) {
  const dom = installDom(ctx, {
    ids: ['album-tabs', 'album-grid', 'album-button', 'close-album', 'album-dialog', 'album-total', 'album-detail'],
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
    album: { flowers: found },
    garden: { received: [], decor: [], boxed: [], plants: [], trees: [] },
  });
  ctx.after(() => state.setData(previous));
  setupAlbum();
  openAlbum('flower');
  return dom.nodes;
}
const text = node => node.textContent;
const part = (detail, name) => detail.children.find(child => child.classList?.contains(name));

test('the left page shows the first find large, with its name and record', ctx => {
  const kind = FLOWERS[2].id;
  const nodes = album(ctx, { [kind]: { count: 3, best: 0, first: 1 } });
  const detail = nodes.get('album-detail');
  assert.equal(detail.dataset.kind, kind, 'the first one found, not the first card');
  assert.equal(text(part(detail, 'album-detail-name')), t(`garden.kind_${kind}`));
  assert.equal(text(part(detail, 'album-detail-line')), t('catch.grown', { count: 3 }));
  assert.ok(part(detail, 'album-specimen'), 'its drawing, large');
  const cards = nodes.get('album-grid').children;
  assert.equal(cards[2].getAttribute('aria-current'), 'true', 'its card is marked as the one shown');
  assert.equal(cards[0].getAttribute('aria-current'), null);
});

// A small window has no left page, so each card said where to look only in a sentence; it has the
// same pictures as the left page, and the same sentence heard.
test('a card not found yet says where to look in pictures, its sentence heard', ctx => {
  const nodes = album(ctx, {});
  const where = part(nodes.get('album-grid').children[1], 'album-hint');
  assert.ok(where.classList.contains('album-clues'), 'the pictures');
  assert.equal(where.getAttribute('role'), 'img');
  assert.equal(
    where.getAttribute('aria-label'),
    t('catch.flower_hint', { season: t(`catch.season_${FLOWERS[1].season}`) }),
  );
});

test('a card pressed shows on the left page; one not found yet says where to look', ctx => {
  const nodes = album(ctx, {});
  const detail = nodes.get('album-detail');
  assert.equal(detail.dataset.kind, FLOWERS[0].id, 'nothing found: the first card');
  const grid = nodes.get('album-grid');
  grid.dispatch('click', { target: grid.children[1].children[0] });
  assert.equal(nodes.get('album-detail').dataset.kind, FLOWERS[1].id);
  assert.equal(text(part(detail, 'album-detail-name')), t('catch.unknown_flower'));
  // Where to look is drawn in pictures (album-clues.js) and said as its sentence.
  const where = part(detail, 'album-detail-line');
  assert.equal(where.getAttribute('role'), 'img');
  assert.equal(
    where.getAttribute('aria-label'),
    t('catch.flower_hint', { season: t(`catch.season_${FLOWERS[1].season}`) }),
  );
  assert.equal(grid.children[1].getAttribute('aria-current'), 'true');
  assert.equal(grid.children[0].getAttribute('aria-current'), null, 'one card is shown at a time');
  // A press on a card's own button is that button's, not a choice of card.
  const found = album(ctx, {
    [FLOWERS[0].id]: { count: 1, best: 0, first: 1 },
    [FLOWERS[1].id]: { count: 1, best: 0, first: 1 },
  });
  found.get('album-grid').dispatch('click', { target: found.get('album-grid').children[0] });
  const row = found.get('album-grid').children[1].children.find(c => c.classList?.contains('album-actions'));
  found.get('album-grid').dispatch('click', { target: row.children[0] });
  assert.equal(found.get('album-detail').dataset.kind, FLOWERS[0].id);
});

// Cards were plain boxes chosen only by a pointer, and each card's clues show only on the left page:
// a keyboard never saw another card's. Each card's picture is a button that shows it there, reached
// by Tab or by the arrows, and the focus stays on it when the book is drawn again.
test('a card is chosen from the keyboard: its picture is a button, and the arrows move between cards', ctx => {
  const nodes = album(ctx, { [FLOWERS[0].id]: { count: 1, best: 0, first: 1 } });
  const grid = nodes.get('album-grid'),
    pick = i => grid.children[i].children[0];
  assert.equal(pick(0).localName, 'button');
  assert.equal(pick(0).type, 'button');
  assert.ok(pick(0).classList.contains('album-pick'));
  assert.equal(pick(0).getAttribute('aria-label'), t(`garden.kind_${FLOWERS[0].id}`), 'named by its kind');
  assert.equal(pick(1).getAttribute('aria-label'), t('catch.unknown_flower'), 'or by the book’s "not yet"');
  assert.equal(pick(0).getAttribute('aria-controls'), 'album-detail');
  // Enter or Space on a focused button is its click, with no pointer behind it.
  pick(2).focus();
  grid.dispatch('click', { target: pick(2), detail: 0 });
  assert.equal(nodes.get('album-detail').dataset.kind, FLOWERS[2].id, 'the left page shows it');
  assert.equal(grid.children[2].getAttribute('aria-current'), 'true');
  assert.equal(globalThis.document.activeElement, pick(2), 'the redrawn card keeps the focus');
  // The arrows move along the cards (only the focus: Enter shows one), Home and End to the ends.
  const key = (target, k) => {
    let stopped = false;
    grid.dispatch('keydown', { target, key: k, preventDefault: () => (stopped = true) });
    return stopped;
  };
  assert.ok(key(pick(2), 'ArrowRight'), 'an arrow does not scroll the page as well');
  assert.equal(globalThis.document.activeElement, pick(3));
  key(pick(3), 'ArrowLeft');
  key(pick(2), 'ArrowLeft');
  assert.equal(globalThis.document.activeElement, pick(1));
  key(pick(1), 'End');
  assert.equal(globalThis.document.activeElement, pick(FLOWERS.length - 1));
  key(pick(FLOWERS.length - 1), 'Home');
  assert.equal(globalThis.document.activeElement, pick(0));
  assert.equal(nodes.get('album-detail').dataset.kind, FLOWERS[2].id, 'moving the focus chose nothing');
  // A card's own buttons keep their arrows to themselves.
  const row = grid.children[0].children.find(c => c.classList?.contains('album-actions'));
  assert.equal(key(row.children[0], 'ArrowRight'), false);
});
