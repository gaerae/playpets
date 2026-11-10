// The Spring shoots book in the album (src/panel/album.js): eight cards, the ones gathered named,
// the rest silhouettes that say the season, counted with the other books.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { t as translate } from '../src/core/i18n.js';
import { data, setData } from '../src/core/state.js';
import { renderAlbum, setupAlbum } from '../src/panel/album.js';
import { SHOOTS } from '../src/yard/catalog.js';
import { albumEntries } from './support/content.mjs';
import { installDom } from './support/dom.mjs';

test('the Spring shoots book shows each shoot, its name and the season', t => {
  const before = data;
  t.after(() => setData(before));
  installDom(t, { anyId: true });
  document.querySelectorAll = () => document.getElementById('album-tabs').children;
  setupAlbum();
  const tabs = document.getElementById('album-tabs').children;
  const tab = tabs.find(item => item.dataset.book === 'shoot');
  assert.ok(tab, 'the shoots have their own book');
  assert.equal(tab.children[0].textContent, translate('album.shoots'));
  document.getElementById('album-dialog').open = true;
  document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)?.[1];
    return tabs.find(item => item.dataset.book === id)?.children[1];
  };
  setData({ ...before, album: { shoots: { morel: { count: 2, best: 0, first: 1 } } } });
  tab.onclick();
  const cards = document.getElementById('album-grid').children;
  assert.equal(cards.length, 8);
  assert.equal(SHOOTS.length, 8);
  const hint = translate('shoot.hint', { season: translate('catch.season_spring') });
  for (const [index, card] of cards.entries()) {
    const found = SHOOTS[index].id === 'morel';
    assert.equal(card.className.includes('unknown'), !found, SHOOTS[index].id);
    assert.equal(card.children[2].textContent, hint);
  }
  const morel = cards[7];
  assert.equal(SHOOTS[7].id, 'morel');
  assert.equal(morel.children[1].textContent, translate('shoot.morel'));
  assert.equal(morel.children.at(-1).textContent, translate('shoot.count', { count: 2 }));
  assert.equal(tab.children[1].textContent, '1/8');
  assert.equal(
    document.getElementById('album-total').textContent,
    translate('catch.total', { caught: 1, total: albumEntries }),
  );
  renderAlbum();
});
