import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { albumEntries } from './support/content.mjs';

globalThis.playPets ??= {};
const state = await import('../src/core/state.js');
const { t: translate } = await import('../src/core/i18n.js');
const { openAlbum, renderAlbum, setupAlbum } = await import('../src/panel/album.js');
const { discover, SECRETS } = await import('../src/yard/secrets.js');
const support = await import('./support/dom.mjs');
const { installDom } = support;

function album(t, secrets) {
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
  state.setData({ ...before, album: { secrets } });
  renderAlbum();
  return { tabs, secret: tabs.find(tab => tab.dataset.book === 'secret') };
}

// The secrets' book is always on the shelf, sealed: its tab and its one card say only that
// something is there, never what, so it is worth wondering about.
test("the secrets' book is always there, sealed with a ? until something in it is found, and never counts", t => {
  const { secret } = album(t, {});
  assert.equal(secret.hidden, false, 'its tab shows before anything is found');
  assert.equal(secret.children[1].textContent, '?', 'a ? rather than how many there are');
  assert.equal(
    document.getElementById('album-total').textContent,
    translate('catch.total', { caught: 0, total: albumEntries }),
  );
  secret.onclick();
  const cards = document.getElementById('album-grid').children;
  assert.equal(cards.length, 1, 'one sealed card, not a blank for each secret');
  assert.ok(cards[0].className.includes('sealed'));
  assert.equal(cards[0].dataset.kind, undefined, 'it names no secret');
  assert.equal(cards[0].textContent, '');
  assert.equal(document.getElementById('album-dig-status').textContent, translate('album.secret_none'));
  // Pressed, the seal rattles like a lock that will not open yet, and the book stays as it is.
  document.getElementById('album-grid').dispatch('click', { target: cards[0].children[0] });
  assert.ok(cards[0].children[0].classList.contains('rattle'));
  cards[0].children[0].dispatch('animationend');
  assert.equal(cards[0].children[0].classList.contains('rattle'), false);
  assert.equal(
    document.getElementById('album-detail').textContent,
    '',
    'its page is the seal, with no word to give one away',
  );
});

test('once found, the book shows only what was found, with no blanks and no total', t => {
  const { secret } = album(t, { dizzy: { count: 1, best: 0, first: 1 } });
  assert.equal(secret.hidden, false);
  assert.equal(secret.children[1].textContent, '1', 'how many found, not out of how many');
  secret.onclick();
  const cards = document.getElementById('album-grid').children;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].children[1].textContent, translate('secret.dizzy'));
  assert.equal(document.getElementById('album-dig-status').textContent, translate('album.secret_more'));
  assert.equal(document.getElementById('album-dig-status').hidden, false);
});

test('the album opens at the latest book with something new, whose tab carries a dot until then', t => {
  const { tabs, secret } = album(t, { wish: { count: 1, best: 0, first: 1 } });
  const fish = tabs.find(tab => tab.dataset.book === 'fish');
  tabs[0].onclick();
  support.installStorage(t);
  state.remember('album-new-books', 'fish,secret');
  renderAlbum();
  assert.equal(secret.classList.contains('has-new'), true);
  assert.equal(fish.classList.contains('has-new'), true);
  document.getElementById('album-dialog').showModal = () => {};
  openAlbum();
  assert.equal(secret.getAttribute('aria-selected'), 'true', 'the secret just found is where the album opens');
  assert.equal(secret.classList.contains('has-new'), false);
  assert.equal(fish.classList.contains('has-new'), true, 'the other keeps its dot');
  assert.equal(fish.getAttribute('aria-description'), translate('catch.new_short'));
  fish.onclick();
  assert.equal(fish.classList.contains('has-new'), false);
  openAlbum();
  assert.equal(fish.getAttribute('aria-selected'), 'true', 'with nothing new, it opens where it was');
});

test("the compact chooser lists the secrets' book before anything in it is found, last", t => {
  const books = () => document.getElementById('album-select').children.map(option => option.value);
  album(t, {});
  assert.equal(books().at(-1), 'secret');
  assert.ok(books().includes('flower'));
});

test('the page and the backend keep the same secrets', () => {
  const rust = readFileSync(new URL('../src-tauri/src/pets/album.rs', import.meta.url), 'utf8');
  const listed = rust
    .match(/pub const SECRETS: &\[&str\] = &\[(.*?)\];/)[1]
    .match(/"(.*?)"/g)
    .map(s => s.slice(1, -1));
  assert.deepEqual(
    SECRETS.map(s => s.id),
    listed,
  );
  for (const s of SECRETS) assert.match(s.svg, /^<svg[^>]*viewBox/);
});

test('a secret found says so the first time, after its moment has played out', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const before = state.data;
  t.after(() => state.setData(before));
  state.setData({ ...before, album: {} });
  let first = true;
  const found = [],
    shown = [];
  state.api.foundSecret = async id => {
    found.push(id);
    return { ok: true, data: { first, found: new Set(found).size } };
  };
  t.after(() => delete state.api.foundSecret);
  const show = (...card) => shown.push(card);
  await discover('wish', 2000, show);
  assert.deepEqual(found, ['wish'], 'kept at once');
  assert.equal(shown.length, 0, 'but told only when the moment has played out');
  t.mock.timers.tick(2000);
  const [svg, name, detail, isNew, book] = shown[0];
  assert.equal(svg, SECRETS.find(s => s.id === 'wish').svg);
  // what was done is the detail; that it was a secret is the news, which a narrow yard still shows
  assert.deepEqual(
    [name, detail, isNew, book],
    [translate('secret.wish'), translate('secret.wish_note'), translate('secret.found'), 'secret'],
  );
  // the next one is one more in a book already there, as the backend counts it: the page may not
  // have heard of the first yet
  await discover('dizzy', 0, show);
  t.mock.timers.tick(0);
  assert.equal(shown[1][3], translate('secret.found_more'));
  first = false;
  await discover('wish', 0, show);
  t.mock.timers.tick(0);
  assert.equal(shown.length, 2, 'found again, it is not news');
});
