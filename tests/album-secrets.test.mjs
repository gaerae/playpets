import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets ??= {};
const state = await import('../src/core/state.js');
const { t: translate } = await import('../src/core/i18n.js');
const { renderAlbum, setupAlbum } = await import('../src/panel/album.js');
const { BUGS, FISH, FLOWERS, GIFTS, TREASURES, TREES } = await import('../src/yard/catalog.js');
const { discover, SECRETS } = await import('../src/yard/secrets.js');
const { installDom } = await import('./support/dom.mjs');

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

test('the hidden book is nowhere until something in it is found, and never counts toward the album', t => {
  const { secret } = album(t, {});
  assert.equal(secret.hidden, true);
  const kinds = [FLOWERS, FISH, BUGS, GIFTS, TREES, TREASURES].reduce((sum, list) => sum + list.length, 0);
  assert.equal(
    document.getElementById('album-total').textContent,
    translate('catch.total', { caught: 0, total: kinds }),
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
    return { ok: true, data: { first } };
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
  // the next one is one more in a book already there
  state.setData({ ...state.data, album: { secrets: { wish: { count: 1 } } } });
  await discover('dizzy', 0, show);
  t.mock.timers.tick(0);
  assert.equal(shown[1][3], translate('secret.found_more'));
  first = false;
  await discover('wish', 0, show);
  t.mock.timers.tick(0);
  assert.equal(shown.length, 2, 'found again, it is not news');
});
