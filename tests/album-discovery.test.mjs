import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { t as translate } from '../src/core/i18n.js';
import { data, setData } from '../src/core/state.js';
import { renderAlbum, setupAlbum } from '../src/panel/album.js';
import { BUGS, FISH, GIFTS, TREASURES, TREES } from '../src/yard/catalog.js';
import { eventDates, eventScene } from '../src/yard/events.js';
import { scene } from '../src/yard/world.js';
import { installDom } from './support/dom.mjs';

// A card's hint is its pictures, which say their sentence as their label, or the sentence itself.
const heard = hint => hint.getAttribute('aria-label') || hint.textContent;

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
  // The record says how many; the buttons below it take one out again (album-take-out.test.mjs).
  assert.equal(cards[0].children.find(c => c.classList?.contains('album-record')).textContent.includes('2'), true);
  // Each card carries its place in the book; each tab, how full its book is, marked once complete.
  assert.deepEqual(
    cards.map(card => card.children[0].children.at(-1).textContent),
    TREES.map((_, index) => String(index + 1).padStart(2, '0')),
  );
  assert.equal(treeTab.style['--album-found'], String(1 / TREES.length));
  assert.equal(treeTab.classList.contains('complete'), false);
  setData({ ...data, album: { ...data.album, trees: Object.fromEntries(TREES.map(k => [k.id, { count: 1 }])) } });
  renderAlbum();
  assert.equal(treeTab.style['--album-found'], '1');
  assert.equal(treeTab.classList.contains('complete'), true);
  assert.equal(document.getElementById('album-grid').dataset.book, 'tree');
  setData({ ...data, album: { ...data.album, trees: { cherry: { count: 2 } } } });
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
  scene.world = 'workshop';
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
    assert.equal(!!badge, kind.rarity === 'rare' || !!kind.event, `${kind.id} uses encounter rarity`);
    assert.equal(
      cards[index].classList.contains('rare'),
      !!badge,
      `${kind.id} takes the rare card's edge with its badge`,
    );
    assert.ok(heard(cards[index].children[2]).includes(translate('catch.bug_clear')));
  }
  // Chosen, a rare kind shows Rare in its large picture's corner, opposite its number, as its card does.
  const rareBug = BUGS.findIndex(kind => kind.rarity === 'rare' || !!kind.event);
  document.getElementById('album-grid').dispatch('click', { target: cards[rareBug].children[0] });
  const stage = document.getElementById('album-detail').children[0];
  assert.deepEqual(
    stage.children.slice(-2).map(child => child.className),
    ['album-no', 'album-rare'],
  );
  // What comes only on certain dates is rare in every book, and its hint says when.
  for (const [book, kinds] of [
    ['fish', FISH],
    ['gift', GIFTS],
  ]) {
    tabs.find(tab => tab.dataset.book === book).onclick();
    cards = document.getElementById('album-grid').children;
    for (const [index, kind] of kinds.entries()) {
      const badge = cards[index].children.find(child => child.className === 'album-rare');
      assert.equal(!!badge, kind.rarity === 'rare' || !!kind.event, `${book} ${kind.id}`);
      if (!kind.event) continue;
      const hint = heard(cards[index].children[2]);
      assert.ok(hint.includes(eventDates(kind.event)), kind.id);
      // A catch comes whenever its event is on, so the scene that calls it up by hand is named;
      // a gift keeps to the dates (events.js giftEvent), so it is not.
      assert.equal(hint.includes(eventScene(kind.event)), book === 'fish', `${book} ${kind.id} names its scene`);
    }
  }
});

// A hint names what finding a kind takes, not only where it is likelier: a dig for seeds, saplings
// and keepsakes, how long a flower or a tree takes, a winter yard and once a day for a snowman, the
// yard's own season for a dated gift, new prints and new snow for a trail, how long a shoot stays.
test('each book says what finding a kind takes', t => {
  const before = data;
  t.after(() => setData(before));
  installDom(t, { anyId: true });
  document.querySelectorAll = () => document.getElementById('album-tabs').children;
  setupAlbum();
  const tabs = document.getElementById('album-tabs').children;
  document.getElementById('album-dialog').open = true;
  document.querySelector = selector => {
    const id = selector.match(/data-count="(.*?)"/)?.[1];
    return tabs.find(tab => tab.dataset.book === id)?.children[1];
  };
  document.querySelectorAll = () => tabs;
  setData({ ...before, album: {} });
  const hints = book => {
    tabs.find(tab => tab.dataset.book === book).onclick();
    return document.getElementById('album-grid').children.map(card => heard(card.children[2]));
  };
  for (const hint of hints('flower')) assert.match(hint, /Dig.*4 hours/, hint);
  for (const hint of hints('tree')) assert.match(hint, /digging.*12 hours.*Each of these helps: \S/, hint);
  for (const hint of hints('treasure')) assert.match(hint, /digging.*Each of these helps: \S/, hint);
  for (const hint of hints('track')) assert.match(hint, /winter yard.*every day.*snow covers/, hint);
  for (const hint of hints('shoot')) assert.match(hint, /about 6 hours/, hint);
  const gifts = hints('gift');
  for (const [index, kind] of GIFTS.entries()) {
    const hint = gifts[index];
    if (kind.built) assert.match(hint, /winter yard, once a day/, hint);
    // blossom, fireflies and the harvest moon also need the yard to show their season; the
    // winter lights and the new year come on their dates wherever the yard is (events.js giftEvent)
    else if (['blossom', 'fireflies', 'harvest'].includes(kind.event))
      assert.match(hint, /while the yard shows (Spring|Summer|Autumn)/, hint);
    else if (kind.event) assert.doesNotMatch(hint, /while the yard shows/, hint);
  }
});
