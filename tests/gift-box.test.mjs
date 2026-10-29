import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const calls = [];
let refuse = false;
globalThis.playPets = {
  setOut: async (...args) => {
    calls.push(args);
    return refuse ? { ok: false, error: 'fixture refusal' } : { ok: true, data: {} };
  },
};
const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, setupAlbum } = await import('../src/panel/album.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
const gifts = (n, more = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `g${i}`, kind: 'bench', x: 0.5, y: 0.5, ...more }));

function album(ctx, garden) {
  const dom = installDom(ctx, {
    ids: ['album-tabs', 'album-grid', 'album-button', 'close-album', 'album-dialog', 'album-total'],
    anyId: true,
    props: { open: true },
  });
  dom.document.querySelectorAll = () => [];
  dom.document.querySelector = () => dom.nodes.get('album-total');
  const previous = state.data;
  state.setData({ pets: [], assets: [], bonds: {}, garden: { received: [], decor: [], boxed: [], ...garden } });
  ctx.after(() => state.setData(previous));
  calls.length = 0;
  refuse = false;
  setupAlbum();
  openAlbum('gift');
  return dom.nodes;
}

test('the gift box is hidden while empty and its gifts wait while the yard is full', ctx => {
  let nodes = album(ctx, {});
  assert.equal(nodes.get('album-box').hidden, true);
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gift_rule'));
  nodes = album(ctx, { decor: gifts(12), boxed: gifts(2, { memento: true }) });
  assert.equal(nodes.get('album-box').hidden, false);
  assert.equal(nodes.get('album-box-title').textContent, t('album.box_title', { count: 2, limit: 12 }));
  const items = nodes.get('album-box-items').children;
  assert.equal(items.length, 2);
  assert.ok(items.every(b => b.disabled && b.title === t('album.set_out_full')));
  assert.ok(items[0].classList.contains('memento'));
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gift_full'));
  nodes = album(ctx, { decor: gifts(12), boxed: gifts(12) });
  assert.equal(nodes.get('album-dig-status').textContent, t('album.gifts_full'), 'says the box is full too');
});

test('a boxed gift is set out once, near the front of the yard', async ctx => {
  // The refusal's toast fades on a timer that would outlive the test.
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const nodes = album(ctx, { decor: gifts(3), boxed: gifts(1) });
  const [item] = nodes.get('album-box-items').children;
  assert.equal(item.disabled, false);
  assert.equal(item.title, t('album.set_out', { kind: t('decor.kind_bench') }));
  item.onclick();
  assert.equal(item.disabled, true, 'a second click before the album redraws does nothing');
  await flush();
  assert.equal(calls.length, 1);
  const [id, x, y] = calls[0];
  assert.equal(id, 'g0');
  assert.ok(x >= 0.3 && x <= 0.7);
  assert.equal(y, 0.8);
  refuse = true;
  item.onclick();
  await flush();
  assert.equal(item.disabled, false, 'a refused set-out can be tried again');
});
