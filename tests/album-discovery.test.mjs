import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { t as translate } from '../src/core/i18n.js';
import { data, setData } from '../src/core/state.js';
import { renderAlbum, setupAlbum } from '../src/panel/album.js';
import { BUGS, TREASURES, TREES } from '../src/yard/catalog.js';
import { scene } from '../src/yard/world.js';
import { installDom } from './support/dom.mjs';

test('tree and keepsake books use saved counts, mature artwork and explicit keepsake rarity', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000000 });
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
  assert.ok(cards.every(card => card.children.every(child => child.className !== 'album-chance')));
  for (const [index, kind] of TREASURES.entries()) {
    const badge = cards[index].children.find(child => child.className === 'album-rare');
    assert.equal(!!badge, kind.rarity === 'uncommon', `${kind.id} does not confuse weight with rarity`);
    assert.ok(cards[index].children.every(child => !child.textContent.includes('%')));
    assert.ok(cards[index].children[2].textContent.includes(translate(`world.${kind.affinity.places[0]}`)));
  }
  const rareIndex = TREASURES.findIndex(kind => kind.rarity === 'uncommon');
  setData({ ...data, garden: { digs: [{ outcome: 'keepsake', kind: TREASURES[rareIndex].id, at: Date.now() }] } });
  renderAlbum();
  let rareCard = document.getElementById('album-grid').children[rareIndex];
  assert.ok(rareCard.children.every(child => !child.textContent.includes('%')));
  const waitingStatus = document.getElementById('album-dig-status').textContent;
  assert.ok(waitingStatus.length > 0);
  t.mock.timers.tick(86400001);
  rareCard = document.getElementById('album-grid').children[rareIndex];
  assert.ok(rareCard.children.every(child => !child.textContent.includes('%')));
  assert.ok(document.getElementById('album-dig-status').textContent.includes(translate('album.rare_rule')));
  assert.notEqual(document.getElementById('album-dig-status').textContent, waitingStatus);
  renderAlbum();
  assert.equal(treasureTab.children[1].textContent, `1/${TREASURES.length}`);
  const previousWorld = scene.world;
  scene.world = 'studio';
  renderAlbum();
  assert.equal(document.getElementById('album-dig-status').textContent, translate('discovery.indoors'));
  assert.ok(
    document
      .getElementById('album-grid')
      .children.every(card => card.children.every(child => !child.textContent.includes('%'))),
  );
  scene.world = previousWorld;
  tabs.find(tab => tab.dataset.book === 'bug').onclick();
  cards = document.getElementById('album-grid').children;
  for (const [index, kind] of BUGS.entries()) {
    const badge = cards[index].children.find(child => child.className === 'album-rare');
    assert.equal(!!badge, kind.rarity === 'rare', `${kind.id} uses encounter rarity`);
    assert.ok(cards[index].children[2].textContent.includes(translate('catch.bug_clear')));
  }
});
