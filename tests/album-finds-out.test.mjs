// Fish, bugs and treasures come out of the album on their own: no container and no shadow, each drawn
// from its full painting; a fish floats a little and swims when poked (src/yard/find-out.js,
// src/panel/album-actions.js; docs/design/2026-11-19-album-finds-out.md).
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
  takeOutFind: answer('takeOutFind', { id: 'd1' }),
  setOnDesktop: answer('setOnDesktop', null),
  albumOnDesktop: answer('albumOnDesktop', null),
  putAway: answer('putAway', null),
};
const state = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { openAlbum, renderAlbum, setupAlbum } = await import('../src/panel/album.js');
const { ALBUM_BOOKS, BUGS, FISH, FLOWERS, TREASURES, artOf, giftKind } = await import('../src/yard/catalog.js');
const { findOutEffects, findOutFor, decorName, heldLayers } = await import('../src/yard/find-out.js');
const { giftLayers, poke } = await import('../src/yard/poke.js');
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

test('a fish, a bug, a treasure and a footprint animal each come out as a bare kind: no drawing, no shadow, one find', () => {
  for (const [book, kind] of [
    ['fish', 'fish_out'],
    ['bug', 'bug_out'],
    ['treasure', 'treasure_out'],
    ['track', 'track_out'],
  ]) {
    const out = findOutFor(book);
    assert.equal(out.id, kind);
    assert.equal(out.slots.length, 1, `${kind} holds one`);
    for (const [x, y, w, h] of out.slots)
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, kind);
    for (const key of ['art', 'shade', 'room', 'feet']) assert.equal(out[key], undefined, `${kind} has no ${key}`);
    assert.equal(giftKind(kind), out, 'set out as a gift is');
    assert.ok(!catalog.gifts.some(g => g.id === kind), `${kind} is not a gift friends bring`);
  }
  assert.equal(catalog.findsOut.length, 4);
  // Each names the album book its kinds are in, so its finds are looked up and named from the data.
  for (const out of catalog.findsOut) assert.ok(ALBUM_BOOKS.includes(out.list), `${out.id}: ${out.list}`);
  assert.equal(findOutFor('flower'), null, 'a flower comes out of its own card');
  assert.equal(findOutFor('gift'), null);
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
  assert.equal(decorName('fish_out', [fish]), t(`catch.fish_${fish}`));
  assert.equal(decorName('bug_out', [BUGS[0].id]), t(`catch.bug_${BUGS[0].id}`));
  assert.equal(decorName('treasure_out', [TREASURES[0].id]), t(`treasure.${TREASURES[0].id}`));
  assert.equal(decorName('bench'), t('decor.kind_bench'));
  // Nothing of a container is drawn on the desktop: only the find (and a firefly's glow).
  assert.equal(giftLayers('fish_out', [fish]), '');
  const css = readFileSync(new URL('../src/styles/answer.css', import.meta.url), 'utf8');
  assert.match(css, /\.decor \.held\.moving ~ \.bubbles i/);
  // A fish is turned a little, in the yard and on the desktop alike: keyed off the find, not the
  // button's kind, which only the yard marks.
  assert.match(layers, /data-book="fish"/);
  const yardCss = readFileSync(new URL('../src/styles/worn.css', import.meta.url), 'utf8');
  assert.match(yardCss, /\.decor \.held\[data-book="fish"\] svg \{\s*rotate:/);
});

test('a firefly out glows from evening, with no light on the ground; other bugs do not', () => {
  const firefly = BUGS.find(b => b.kind === 'firefly').id,
    butterfly = BUGS.find(b => b.kind === 'butterfly').id;
  assert.deepEqual(findOutEffects('bug_out', [firefly]), ['halo']);
  assert.deepEqual(findOutEffects('bug_out', [butterfly]), []);
  assert.deepEqual(findOutEffects('fish_out', [FISH[0].id]), []);
  assert.match(giftLayers('bug_out', [firefly]), /class="fx-glow"/);
  // A pool of light on the ground reads as a shadow under it: none (album-finds-out.md).
  assert.doesNotMatch(giftLayers('bug_out', [firefly]), /fx-pool/);
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
    assert.equal(yard.parentNode.dataset.pending, 'true', 'held until the album redraws');
    yard.onclick();
    await flush();
    const [method, b, item, x, y, desktopToo] = calls[0];
    assert.deepEqual([method, b, item, y, desktopToo], ['takeOutFind', book, id, 0.8, false]);
    assert.ok(x >= 0.3 && x <= 0.7);
    // On the desktop too by the same call, saved once.
    nodes = album(ctx, book, { album: found });
    buttonsOf(nodes, 0)[1].onclick();
    await flush();
    await flush();
    assert.deepEqual(
      calls.map(c => [...c.slice(0, 3), c.at(-1)]),
      [['takeOutFind', book, id, true]],
    );
    // Refused: it can be tried again.
    nodes = album(ctx, book, { album: found });
    refuse = true;
    const again = buttonsOf(nodes, 0);
    again[0].onclick();
    await flush();
    assert.equal(again[0].parentNode.dataset.pending, undefined, 'let go after a refusal');
    // Gifts have their own room: twelve of them leave a find's free.
    nodes = album(ctx, book, { album: found, garden: { decor: decor(12) } });
    assert.equal(buttonsOf(nodes, 0)[0].getAttribute('aria-disabled'), 'false');
    // Twelve finds out of any book fill the finds' room, and it says so.
    nodes = album(ctx, book, { album: found, garden: { decor: decor(12, { kind: 'fish_out', holds: ['carp'] }) } });
    for (const button of buttonsOf(nodes, 0)) {
      assert.equal(button.getAttribute('aria-disabled'), 'true');
      assert.equal(button.title, t('album.finds_full', { limit: 12 }));
    }
  });

// A card brings back what it set out: Put back when one can be out, else fewer and more within the
// album's count; the screen moves the whole kind on or off the desktop (album-in-and-out.md).
test('a find out comes back through its card, and goes on and off the desktop as a kind', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const id = FISH[0].id,
    name = t(`catch.fish_${id}`),
    out = (n, more = {}) =>
      Array.from({ length: n }, (_, i) => ({ id: `f${i}`, kind: 'fish_out', x: 0.5, y: 0.8, holds: [id], ...more }));
  // Caught once, out once: Put back takes it in.
  let nodes = album(ctx, 'fish', { album: { fish: { [id]: entry } }, garden: { decor: out(1) } });
  const [back] = buttonsOf(nodes, 0);
  let [, screen] = buttonsOf(nodes, 0);
  assert.equal(buttonsOf(nodes, 0).length, 2);
  assert.equal(back.textContent, t('album.put_back'));
  assert.equal(back.title, t('album.put_back_one', { kind: name }));
  assert.equal(screen.getAttribute('aria-pressed'), 'false');
  assert.equal(screen.title, t('album.desktop_on', { kind: name }));
  back.onclick();
  await flush();
  assert.deepEqual(calls, [['putAway', 'f0']]);
  // On the desktop: the screen is pressed, and a press takes the kind off it (it stays in the yard).
  nodes = album(ctx, 'fish', { album: { fish: { [id]: entry } }, garden: { decor: out(1, { onDesktop: true }) } });
  [, screen] = buttonsOf(nodes, 0);
  assert.equal(screen.getAttribute('aria-pressed'), 'true');
  assert.equal(screen.title, t('album.desktop_off', { kind: name }));
  screen.onclick();
  await flush();
  assert.deepEqual(calls, [['albumOnDesktop', 'fish', id, false]]);
  // Caught three times, two out: fewer, how many of how many, more.
  const three = { fish: { [id]: { ...entry, count: 3 } } };
  nodes = album(ctx, 'fish', { album: three, garden: { decor: out(2) } });
  let [fewer, count, more] = buttonsOf(nodes, 0);
  assert.equal(buttonsOf(nodes, 0).length, 4);
  assert.equal(count.textContent, '2/3');
  assert.equal(count.title, t('album.out_count', { count: 2, limit: 3 }));
  assert.equal(more.title, t('album.set_out_more', { kind: name }));
  assert.equal(more.getAttribute('aria-disabled'), 'false');
  fewer.onclick();
  await flush();
  assert.deepEqual(calls, [['putAway', 'f1']], 'the last one out comes back');
  nodes = album(ctx, 'fish', { album: three, garden: { decor: out(2, { onDesktop: true }) } });
  buttonsOf(nodes, 0)[2].onclick();
  await flush();
  assert.deepEqual(
    calls.map(c => [c[0], c.at(-1)]),
    [['takeOutFind', true]],
    'one more joins the kind on the desktop',
  );
  // All three out: no more, and it says why.
  nodes = album(ctx, 'fish', { album: three, garden: { decor: out(3) } });
  [fewer, count, more] = buttonsOf(nodes, 0);
  assert.equal(count.textContent, '3/3');
  assert.equal(more.getAttribute('aria-disabled'), 'true');
  assert.equal(more.title, t('album.all_out', { count: 3 }));
  assert.equal(fewer.getAttribute('aria-disabled'), 'false');
  // None out yet, the row already has its shape: nothing to bring back, one to set out.
  nodes = album(ctx, 'fish', { album: three });
  [fewer, count, more] = buttonsOf(nodes, 0);
  assert.equal(count.textContent, '0/3');
  assert.equal(fewer.getAttribute('aria-disabled'), 'true');
  assert.equal(more.title, t('album.set_out', { kind: name }));
  // Found once, the one button turns from Set out to Put back and reads as pressed while out.
  nodes = album(ctx, 'fish', { album: { fish: { [id]: entry } } });
  assert.equal(buttonsOf(nodes, 0)[0].getAttribute('aria-pressed'), 'false');
  // Never past what the yard holds, whatever the count.
  nodes = album(ctx, 'fish', { album: { fish: { [id]: { ...entry, count: 40 } } }, garden: { decor: out(2) } });
  assert.equal(buttonsOf(nodes, 0)[1].textContent, '2/12');
  // Another fish, or a gift, out is not this card's.
  nodes = album(ctx, 'fish', {
    album: { fish: { [id]: entry } },
    garden: { decor: [...out(1, { holds: ['no_such'] }), ...decor(1)] },
  });
  assert.equal(buttonsOf(nodes, 0)[0].textContent, t('album.take_out'));
});

test('a grown flower card has Set out and the desktop, and no frame', ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const flower = FLOWERS[0].id,
    buttons = buttonsOf(album(ctx, 'flower', { album: { flowers: { [flower]: entry } } }), 0);
  assert.equal(buttons.length, 2);
  assert.ok(!buttons.some(b => /data-icon="frame"/.test(b.innerHTML || '')));
});

test('a poked fish swims a turn; nothing moves with reduced motion', () => {
  const view = { id: 'd1', kind: 'fish_out', holds: ['crucian'], button: element('button') },
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
  // A treasure sparkles instead (finds-come-alive.test.mjs); one whose find is not known yet stays.
  const still = element('span');
  still.className = 'held';
  poke(
    { id: 'd2', kind: 'treasure_out', button: { ...element('button'), querySelector: () => still } },
    { period: 'day', reduced: false, ring() {} },
  );
  assert.equal(still.classList.contains('moving'), false);
});

// A press redraws the book; the focus goes back to the control it was on, even one that cannot be
// pressed now (album-in-and-out.md).
test('the focus stays on the card’s row as the album redraws', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const { renderAlbum } = await import('../src/panel/album.js');
  const id = FISH[0].id,
    three = { fish: { [id]: { ...entry, count: 3 } } },
    out = n => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, kind: 'fish_out', x: 0.5, y: 0.8, holds: [id] }));
  const nodes = album(ctx, 'fish', { album: three, garden: { decor: out(2) } });
  buttonsOf(nodes, 0)[2].focus();
  state.setData({ ...state.data, garden: { ...state.data.garden, decor: out(3) } });
  renderAlbum();
  const row = buttonsOf(nodes, 0);
  assert.equal(row[1].textContent, '3/3');
  assert.equal(
    globalThis.document.activeElement,
    row[2],
    'all out, + keeps the focus, so a quick press does not land on −',
  );
  assert.equal(row[2].getAttribute('aria-disabled'), 'true');
  row[2].onclick();
  assert.equal(row[2].parentNode.dataset.pending, undefined, 'and does nothing');
  row[3].focus();
  renderAlbum();
  assert.equal(globalThis.document.activeElement, buttonsOf(nodes, 0)[3], 'the screen, again');
});

test('the album draws again only the cards that changed, and a card kept acts on what is out now', async ctx => {
  const [a, b] = FISH.map(f => f.id),
    copy = (id, holds) => ({ id, kind: 'fish_out', x: 0.5, y: 0.8, holds: [holds] });
  const nodes = album(ctx, 'fish', {
      album: { fish: { [a]: entry, [b]: entry } },
      garden: { decor: [copy('f0', a)] },
    }),
    grid = nodes.get('album-grid'),
    first = [...grid.children];
  renderAlbum();
  first.forEach((card, i) => assert.equal(grid.children[i], card, `card ${i} kept`));
  // The same fish is out under another id: the card looks the same and is kept, and its Put back
  // takes in the one out now.
  state.data.garden.decor = [copy('g0', a)];
  renderAlbum();
  assert.equal(grid.children[0], first[0]);
  buttonsOf(nodes, 0)[0].onclick();
  await flush();
  assert.deepEqual(calls, [['putAway', 'g0']]);
  // A pressed card waits for the redraw, which draws it again: a press that changed nothing frees it.
  renderAlbum();
  const pressed = grid.children[0];
  assert.notEqual(pressed, first[0]);
  assert.equal(pressed.children.find(c => c.classList?.contains('album-actions')).dataset.pending, undefined);
  // The second fish comes out: only its card is drawn again.
  state.data.garden.decor = [copy('g0', a), copy('h0', b)];
  renderAlbum();
  assert.equal(grid.children[0], pressed, 'the first card, unchanged, is kept');
  assert.notEqual(grid.children[1], first[1], 'the second card is new');
  assert.equal(buttonsOf(nodes, 1)[0].textContent, t('album.put_back'));
  assert.equal(grid.children.length, first.length);
});
