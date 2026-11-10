import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets ??= {};
const state = await import('../src/core/state.js');
const { t: translate } = await import('../src/core/i18n.js');
const { renderAlbum, setupAlbum } = await import('../src/panel/album.js');
const { artHref } = await import('../src/yard/art.js');
const { installDom } = await import('./support/dom.mjs');

test('the footprint book shows each print until it is followed, then the tail and the name', t => {
  const before = state.data;
  t.after(() => state.setData(before));
  installDom(t, { anyId: true });
  document.querySelectorAll = () => document.getElementById('album-tabs').children;
  setupAlbum();
  const tabs = document.getElementById('album-tabs').children;
  document.getElementById('album-dialog').open = true;
  document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)?.[1];
    return tabs.find(tab => tab.dataset.book === id)?.children[1];
  };
  state.setData({ ...before, album: { tracks: { fox: { count: 2, best: 0, first: 1 } } } });
  renderAlbum();
  const tab = tabs.find(tab => tab.dataset.book === 'track');
  tab.onclick();
  const grid = document.getElementById('album-grid');
  assert.equal(grid.dataset.book, 'track');
  const cards = grid.children;
  assert.equal(cards.length, 8);
  const byId = ['hare', 'fox', 'water_deer', 'raccoon_dog', 'squirrel', 'sparrow', 'magpie', 'cat'];
  const fox = cards[byId.indexOf('fox')],
    hare = cards[byId.indexOf('hare')];
  const [foxStage, foxName] = fox.children;
  assert.equal(foxName.textContent, translate('track.fox'));
  assert.match(foxStage.innerHTML, /tail-peek/);
  assert.ok(foxStage.innerHTML.includes(artHref('tracks/tail_fox.svg')));
  assert.equal(fox.children.at(-1).textContent, translate('album.followed', { count: 2 }));
  assert.ok(hare.classList.contains('unknown'));
  const [hareStage, hareName] = hare.children;
  assert.equal(hareName.textContent, translate('album.whose_prints'));
  assert.match(hareStage.innerHTML, /print-run/);
  assert.ok(hareStage.innerHTML.includes(artHref('prints/hare.svg')));
  assert.ok(!hareStage.innerHTML.includes('tail_hare'), 'whose it is stays the question');
  assert.equal(tab.children[1].textContent, '1/8');
});
