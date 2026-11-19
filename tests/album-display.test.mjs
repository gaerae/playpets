// Finds from the album go on display: a fish in a fishbowl, a bug in a jar, treasures in a specimen
// case and a pressed flower in a frame (src/yard/display.js, src/panel/album-display.js;
// docs/design/2026-11-19-album-on-display.md).
import assert from 'node:assert/strict';
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
  undisplay: answer('undisplay', null),
  setOnDesktop: answer('setOnDesktop', null),
};
const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, setupAlbum } = await import('../src/panel/album.js');
const { BUGS, FISH, FLOWERS, TREASURES } = await import('../src/yard/catalog.js');
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

test('each album book with a display has one, and the catalogue places its finds inside it', () => {
  for (const [book, kind, room] of [
    ['fish', 'fishbowl', 1],
    ['bug', 'bug_jar', 1],
    ['treasure', 'specimen_case', 5],
    ['flower', 'pressed_frame', 1],
  ]) {
    const display = displayFor(book);
    assert.equal(display.id, kind);
    assert.equal(display.room ?? 1, room);
    assert.equal(display.slots.length, room, `${kind}: a slot for each it holds`);
    for (const [x, y, w, h] of display.slots)
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, kind);
    assert.ok(!catalog.gifts.some(g => g.id === kind), `${kind} is not a gift friends bring`);
  }
  assert.equal(displayFor('gift'), null);
});

test('a display draws each find in its slot and is named by what it holds', () => {
  const fish = FISH[0].id,
    layers = heldLayers('fishbowl', [fish]);
  assert.match(layers, new RegExp(`class="held" data-held="${fish}" style="left:17%;top:36%;width:62%;height:32%"`));
  assert.match(layers, /<image href="art\/album\//, 'the album’s own small drawing');
  const five = TREASURES.slice(0, 5).map(k => k.id),
    caseLayers = heldLayers('specimen_case', [...five, 'no_such']);
  assert.equal(caseLayers.match(/class="held"/g).length, 5);
  assert.equal(heldLayers('specimen_case', ['no_such']), '', 'an id its book does not have draws nothing');
  assert.equal(heldLayers('bench', [fish]), '', 'a gift holds nothing');
  assert.equal(
    displayName('fishbowl', [fish]),
    t('decor.holding', { kind: t('decor.kind_fishbowl'), items: t(`catch.fish_${fish}`) }),
  );
  assert.equal(displayName('bench'), t('decor.kind_bench'));
});

test('a jar glows from evening only while it holds a firefly', () => {
  const firefly = BUGS.find(b => b.kind === 'firefly').id,
    butterfly = BUGS.find(b => b.kind === 'butterfly').id;
  assert.deepEqual(displayEffects('bug_jar', [firefly]), ['glow']);
  assert.deepEqual(displayEffects('bug_jar', [butterfly]), []);
  assert.deepEqual(displayEffects('fishbowl', [FISH[0].id]), []);
  assert.match(giftLayers('bug_jar', [firefly]), /class="fx-glow"/);
  assert.doesNotMatch(giftLayers('bug_jar', [butterfly]), /fx-glow/);
});

test('a found fish goes into a bowl in the yard, or out on the desktop too', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const fish = FISH[0].id,
    name = t(`catch.fish_${fish}`);
  let nodes = album(ctx, 'fish', { album: { fish: { [fish]: entry } } });
  assert.equal(buttonsOf(nodes, 1).length, 0, 'one not caught yet has none');
  const [yard, desktop] = buttonsOf(nodes, 0);
  assert.equal(yard.textContent, t('album.display_fish'));
  assert.equal(yard.title, t('album.display_fish_title', { item: name }));
  assert.ok(desktop.classList.contains('album-to-desktop'));
  assert.equal(desktop.title, t('album.display_desktop_title', { item: name }));
  yard.onclick();
  assert.ok(yard.disabled && desktop.disabled, 'a second click before the album redraws does nothing');
  await flush();
  const [method, book, item, x, y] = calls[0];
  assert.deepEqual([method, book, item, y], ['display', 'fish', fish, 0.8]);
  assert.ok(x >= 0.3 && x <= 0.7);
  nodes = album(ctx, 'fish', { album: { fish: { [fish]: entry } } });
  buttonsOf(nodes, 0)[1].onclick();
  await flush();
  await flush();
  assert.deepEqual(
    calls.map(c => c.slice(0, 3)),
    [
      ['display', 'fish', fish],
      ['setOnDesktop', 'd1', true],
    ],
  );
  // Refused: it can be tried again.
  nodes = album(ctx, 'fish', { album: { fish: { [fish]: entry } } });
  refuse = true;
  const again = buttonsOf(nodes, 0);
  again[0].onclick();
  await flush();
  assert.ok(!again[0].disabled && !again[1].disabled);
  // A full yard says so.
  nodes = album(ctx, 'fish', { album: { fish: { [fish]: entry } }, garden: { decor: decor(12) } });
  for (const button of buttonsOf(nodes, 0)) {
    assert.equal(button.disabled, true);
    assert.equal(button.title, t('album.set_out_full'));
  }
});

test('a treasure goes into the case with room, and comes out of it again', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const [a, b] = TREASURES.map(k => k.id),
    found = { treasures: { [a]: entry, [b]: entry } };
  // A case with room takes it even with the yard full.
  const nodes = album(ctx, 'treasure', {
    album: found,
    garden: { decor: [...decor(11), { id: 'c1', kind: 'specimen_case', x: 0.5, y: 0.8, holds: [a] }] },
  });
  const [out] = buttonsOf(nodes, 0);
  assert.equal(buttonsOf(nodes, 0).length, 1, 'one in a case has only Out of the case');
  assert.equal(out.textContent, t('album.undisplay_treasure'));
  assert.equal(out.title, t('album.undisplay_treasure_title', { item: t(`treasure.${a}`) }));
  const [into] = buttonsOf(nodes, 1);
  assert.equal(into.textContent, t('album.display_treasure'));
  assert.equal(into.disabled, false, 'the case has room');
  out.onclick();
  await flush();
  assert.deepEqual(calls[0], ['undisplay', 'c1', a]);
  into.onclick();
  await flush();
  assert.deepEqual(calls[1].slice(0, 3), ['display', 'treasure', b]);
});

test('a grown flower card can press it in a frame beside Set out and the desktop', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const flower = FLOWERS[0].id,
    nodes = album(ctx, 'flower', { album: { flowers: { [flower]: entry } } }),
    buttons = buttonsOf(nodes, 0);
  assert.equal(buttons.length, 3);
  const frame = buttons[2];
  assert.equal(frame.title, t('album.display_flower_title', { item: t(`garden.kind_${flower}`) }));
  assert.match(frame.innerHTML, /data-icon="frame"/, 'a small frame icon');
  frame.onclick();
  await flush();
  assert.deepEqual(calls[0].slice(0, 3), ['display', 'flower', flower]);
});

test('a poked fishbowl swims its fish once; nothing moves with reduced motion', () => {
  const view = { id: 'd1', kind: 'fishbowl', button: element('button') },
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
});
