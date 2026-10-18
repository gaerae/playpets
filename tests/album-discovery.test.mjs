import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { data, setData } from '../src/core/state.js';
import { renderAlbum, setupAlbum } from '../src/panel/album.js';
import { TREASURES, TREES } from '../src/yard/catalog.js';
import { installDom } from './support/dom.mjs';

test('tree and keepsake books use saved counts, mature artwork and explicit keepsake rarity', t => {
  const before = data;
  t.after(() => setData(before));
  installDom(t, { anyId: true });
  document.querySelectorAll = () => document.getElementById('album-tabs').children;
  setupAlbum();
  const tabs = document.getElementById('album-tabs').children;
  const treeTab = tabs.find(tab => tab.dataset.book === 'tree');
  const treasureTab = tabs.find(tab => tab.dataset.book === 'treasure');
  assert.ok(treeTab, 'trees have their own book');
  assert.ok(treasureTab, 'keepsakes have their own book');
  document.getElementById('album-dialog').open = true;
  document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)?.[1];
    return tabs.find(tab => tab.dataset.book === id)?.children[1];
  };
  document.querySelectorAll = () => tabs;
  setData({ ...before, album: { trees: { cherry: { count: 2 } }, treasures: { striped_pebble: { count: 3 } } } });
  treeTab.onclick();
  let cards = document.getElementById('album-grid').children;
  assert.equal(cards.length, TREES.length);
  assert.match(cards[0].children[0].innerHTML, /cherry-mature/);
  assert.equal(treeTab.children[1].textContent, `1/${TREES.length}`);
  assert.equal(cards[0].children.at(-1).textContent.includes('2'), true);
  treasureTab.onclick();
  cards = document.getElementById('album-grid').children;
  assert.equal(cards.length, TREASURES.length);
  for (const [index, kind] of TREASURES.entries()) {
    const badge = cards[index].children.find(child => child.className === 'album-rare');
    assert.equal(!!badge, kind.rarity === 'uncommon', `${kind.id} does not confuse weight with rarity`);
  }
  renderAlbum();
  assert.equal(treasureTab.children[1].textContent, `1/${TREASURES.length}`);
});
