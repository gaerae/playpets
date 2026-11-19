// Fish, bugs and treasures come out of the album on their own: no container and no shadow, each drawn
// from its full painting; a fish floats a little and swims when poked (src/yard/display.js,
// src/panel/album-display.js; docs/design/2026-11-19-album-finds-out.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { catalog } from './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

const calls = [];
let refuse = false;
const answer =
  (name, data) =>
  async (...args) => {
    calls.push([name, ...args]);
    return refuse ? { ok: false, error: 'fixture refusal' } : { ok: true, data };
  };
globalThis.playPets = {
  display: answer('display', { id: 'd1' }),
  setOnDesktop: answer('setOnDesktop', null),
};
const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, setupAlbum } = await import('../src/panel/album.js');
const { BUGS, FISH, FLOWERS, TREASURES, artOf, giftKind } = await import('../src/yard/catalog.js');
const { displayEffects, displayFor, displayName, heldLayers } = await import('../src/yard/display.js');
const { giftLayers, poke } = await import('../src/overlay/poke.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
const entry = { count: 1, best: 0, first: 1 };
const decor = (n, more) =>
  Array.from({ length: n }, (_, i) => ({ id: `x${i}`, kind: 'bench', x: 0.5, y: 0.5, ...more }));

function album(ctx, book, { album: found = {}, garden = {} } = {}) {
  const dom = installDom(ctx, {
    ids: ['album-tabs', 'album-grid', 'album-button', 'close-album', 'album-dialog', 'album-total', 'yard'],
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
    album: found,
    garden: { received: [], decor: [], boxed: [], plants: [], trees: [], ...garden },
  });
  ctx.after(() => state.setData(previous));
  calls.length = 0;
  refuse = false;
  setupAlbum();
  openAlbum(book);
  return dom.nodes;
}
const buttonsOf = (nodes, index) => {
  const row = nodes.get('album-grid').children[index].children.find(c => c.classList?.contains('album-actions'));
  return row ? row.children : [];
};

test('a fish, a bug and a treasure each come out as a bare kind: no drawing, no shadow, one find', () => {
  for (const [book, kind] of [
    ['fish', 'fish_out'],
    ['bug', 'bug_out'],
    ['treasure', 'treasure_out'],
  ]) {
    const display = displayFor(book);
    assert.equal(display.id, kind);
    assert.equal(display.slots.length, 1, `${kind} holds one`);
    for (const [x, y, w, h] of display.slots)
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, kind);
    for (const key of ['art', 'shade', 'room', 'feet']) assert.equal(display[key], undefined, `${kind} has no ${key}`);
    assert.equal(giftKind(kind), display, 'set out as a gift is');
    assert.ok(!catalog.gifts.some(g => g.id === kind), `${kind} is not a gift friends bring`);
  }
  assert.equal(catalog.displays.length, 3);
  assert.equal(displayFor('flower'), null, 'a flower comes out of its own card');
  assert.equal(displayFor('gift'), null);
  assert.ok(!artOf(catalog).includes(undefined));
});

test('a find is drawn from its full painting and named for itself', () => {
  const fish = FISH[0].id,
    layers = heldLayers('fish_out', [fish]);
  assert.match(layers, new RegExp(`class="held" data-held="${fish}"`));
  assert.match(layers, new RegExp(`<use href="#art-fish-${fish}"/>`), 'the full painting');
  assert.doesNotMatch(layers, /art\/album\//, 'not the album card’s small preview');
  // The fish floats in the top of its box, with bubbles for when it swims.
  assert.match(layers, /style="left:0%;top:0%;width:100%;height:72%"/);
  assert.equal(layers.match(/<i><\/i>/g).length, 3);
  assert.doesNotMatch(heldLayers('treasure_out', [TREASURES[0].id]), /bubbles/);
  assert.equal(heldLayers('treasure_out', ['no_such']), '', 'an id its book does not have draws nothing');
  assert.equal(heldLayers('bench', [fish]), '', 'a gift holds nothing');
  assert.equal(displayName('fish_out', [fish]), t(`catch.fish_${fish}`));
  assert.equal(displayName('bug_out', [BUGS[0].id]), t(`catch.bug_${BUGS[0].id}`));
  assert.equal(displayName('treasure_out', [TREASURES[0].id]), t(`treasure.${TREASURES[0].id}`));
  assert.equal(displayName('bench'), t('decor.kind_bench'));
  // Nothing of a container is drawn on the desktop: only the find (and a firefly's glow).
  assert.equal(giftLayers('fish_out', [fish]), '');
  const css = readFileSync(new URL('../src/overlay/overlay.css', import.meta.url), 'utf8');
  assert.match(css, /\.decor \.held\.moving ~ \.bubbles i/);
});

test('a firefly out glows from evening; other bugs do not', () => {
  const firefly = BUGS.find(b => b.kind === 'firefly').id,
    butterfly = BUGS.find(b => b.kind === 'butterfly').id;
  assert.deepEqual(displayEffects('bug_out', [firefly]), ['glow']);
  assert.deepEqual(displayEffects('bug_out', [butterfly]), []);
  assert.deepEqual(displayEffects('fish_out', [FISH[0].id]), []);
  assert.match(giftLayers('bug_out', [firefly]), /class="fx-glow"/);
  assert.doesNotMatch(giftLayers('bug_out', [butterfly]), /fx-glow/);
});

for (const [book, list, name] of [
  ['fish', FISH, id => t(`catch.fish_${id}`)],
  ['bug', BUGS, id => t(`catch.bug_${id}`)],
  ['treasure', TREASURES, id => t(`treasure.${id}`)],
])
  test(`a found ${book} is set out in the yard, or out on the desktop too`, async ctx => {
    ctx.mock.timers.enable({ apis: ['setTimeout'] });
    const id = list[0].id,
      key = { fish: 'fish', bug: 'bugs', treasure: 'treasures' }[book],
      found = { [key]: { [id]: entry } };
    let nodes = album(ctx, book, { album: found });
    assert.equal(buttonsOf(nodes, 1).length, 0, 'one not found yet has none');
    const [yard, desktop] = buttonsOf(nodes, 0);
    assert.equal(buttonsOf(nodes, 0).length, 2);
    assert.equal(yard.textContent, t('album.take_out'));
    assert.equal(yard.title, t('album.set_out', { kind: name(id) }));
    assert.ok(desktop.classList.contains('album-to-desktop'));
    assert.equal(desktop.title, t('album.set_out_desktop', { kind: name(id) }));
    yard.onclick();
    assert.ok(yard.disabled && desktop.disabled, 'a second click before the album redraws does nothing');
    await flush();
    const [method, b, item, x, y] = calls[0];
    assert.deepEqual([method, b, item, y], ['display', book, id, 0.8]);
    assert.ok(x >= 0.3 && x <= 0.7);
    // Each press sets out one more.
    nodes = album(ctx, book, {
      album: found,
      garden: { decor: [{ id: 'd0', kind: `${book}_out`, x: 0.5, y: 0.8, holds: [id] }] },
    });
    buttonsOf(nodes, 0)[1].onclick();
    await flush();
    await flush();
    assert.deepEqual(
      calls.map(c => c.slice(0, 3)),
      [
        ['display', book, id],
        ['setOnDesktop', 'd1', true],
      ],
    );
    // Refused: it can be tried again.
    nodes = album(ctx, book, { album: found });
    refuse = true;
    const again = buttonsOf(nodes, 0);
    again[0].onclick();
    await flush();
    assert.ok(!again[0].disabled && !again[1].disabled);
    // A full yard says so.
    nodes = album(ctx, book, { album: found, garden: { decor: decor(12) } });
    for (const button of buttonsOf(nodes, 0)) {
      assert.equal(button.disabled, true);
      assert.equal(button.title, t('album.set_out_full'));
    }
  });

test('a grown flower card has Set out and the desktop, and no frame', ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const flower = FLOWERS[0].id,
    buttons = buttonsOf(album(ctx, 'flower', { album: { flowers: { [flower]: entry } } }), 0);
  assert.equal(buttons.length, 2);
  assert.ok(!buttons.some(b => /data-icon="frame"/.test(b.innerHTML || '')));
});

test('a poked fish swims a turn; nothing moves with reduced motion', () => {
  const view = { id: 'd1', kind: 'fish_out', button: element('button') },
    fish = element('span');
  fish.className = 'held';
  view.button.querySelector = selector => (selector === '.held' ? fish : null);
  poke(view, { period: 'day', reduced: false, ring() {} });
  assert.equal(fish.dataset.motion, 'swim');
  assert.ok(fish.classList.contains('moving'));
  fish.dispatch('animationend');
  assert.equal(fish.classList.contains('moving'), false);
  poke(view, { period: 'day', reduced: true, ring() {} });
  assert.equal(fish.classList.contains('moving'), false);
  // A treasure or a bug does not swim.
  const still = element('span');
  still.className = 'held';
  poke(
    { id: 'd2', kind: 'treasure_out', button: { ...element('button'), querySelector: () => still } },
    { period: 'day', reduced: false, ring() {} },
  );
  assert.equal(still.classList.contains('moving'), false);
});
