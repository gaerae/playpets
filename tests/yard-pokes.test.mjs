// A gift or a find out answers a press the same in the yard as on the desktop (src/yard/poke.js,
// used by the yard's decor.js and the desktop's overlay.js): a lamp switches, a moving part turns,
// a find moves its own way with its book's bits, and only a gift with no answer of its own bobs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { catalog } from './support/content.mjs';
import { element, installDom } from './support/dom.mjs';
import { flatField } from './support/flat-field.mjs';

globalThis.playPets = { moveDecor: async () => ({ ok: true, data: null }) };
const { setData } = await import('../src/core/state.js');
const { renderDecor } = await import('../src/yard/decor.js');
const { measureYard } = await import('../src/yard/field.js');
const { heldLayers, pokeOf } = await import('../src/yard/find-out.js');
const { giftLayers, quietLook } = await import('../src/yard/poke.js');
const { scene } = await import('../src/yard/world.js');

function yardWith(t, kind, holds) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  flatField(t);
  const { nodes } = installDom(t, { anyId: true, ids: ['yard', 'garden-layer'] });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
  setData({ garden: { decor: [], plants: [], trees: [] }, pets: [] });
  renderDecor();
  const d = { id: `${kind}-1`, kind, x: 0.4, y: 0.6, ...(holds ? { holds } : {}) };
  setData({ garden: { decor: [d], plants: [], trees: [] }, pets: [] });
  measureYard();
  renderDecor();
  return nodes.get('garden-layer').children.at(-1);
}
async function press(button) {
  await button.dispatch('pointerdown', { button: 0, clientX: 300, clientY: 360, pointerId: 3 });
  await button.dispatch('pointerup', { pointerId: 3 });
}

test('a yard gift is drawn as the desktop draws it, its moving part laid twice', t => {
  const pinwheel = yardWith(t, 'pinwheel');
  assert.match(pinwheel.innerHTML, /class="part" data-motion="spin"/);
  assert.ok(pinwheel.innerHTML.startsWith(giftLayers('pinwheel')));
});

test('a lantern pressed in the yard switches, as on the desktop, and does not bob', async t => {
  const period = scene.period;
  scene.period = 'day';
  t.after(() => {
    scene.period = period;
  });
  const lantern = yardWith(t, 'lantern');
  await press(lantern);
  assert.ok(lantern.classList.contains('lamp-on'), 'lit by day until the hour changes');
  assert.equal(lantern.dataset.answer, undefined);
  await press(lantern);
  assert.ok(lantern.classList.contains('lamp-off'));
});

test('a find out pressed in the yard moves its own way, not a bob', async t => {
  const fish = yardWith(t, 'fish_out', ['goldfish']),
    held = element('span');
  fish.querySelector = selector => (selector === '.held' ? held : null);
  await press(fish);
  assert.equal(held.dataset.motion, 'swim');
  assert.ok(held.classList.contains('moving'));
  assert.equal(fish.dataset.answer, undefined);
});

test('only a gift with no answer of its own bobs', () => {
  assert.equal(quietLook('bench').motion, 'bob');
  for (const kind of ['pinwheel', 'windchime', 'lantern', 'fish_out', 'bug_out', 'treasure_out', 'track_out'])
    assert.equal(quietLook(kind), null, kind);
});

// Each book lets out its own bits as its find moves: a fish its bubbles, a bug a few glints, a
// treasure its sparkles (a locket too), and an animal a heart or two.
test('every find of every book has its own bits beside it', () => {
  const BITS = { fish: 'bubbles', bugs: 'glints', treasures: 'sparkle', tracks: 'hearts' },
    OUT = { fish: 'fish_out', bugs: 'bug_out', treasures: 'treasure_out', tracks: 'track_out' };
  for (const [book, bits] of Object.entries(BITS))
    for (const kind of catalog[book]) {
      const layers = heldLayers(OUT[book], [kind.id]);
      if (!layers) continue;
      assert.equal(layers.match(new RegExp(`class="${bits}"`, 'g'))?.length, 1, `${book}: ${kind.id}`);
    }
  assert.match(heldLayers('treasure_out', ['heart_locket']), /class="sparkle"/);
});

// Both pages load the same stylesheets for this, so the yard and the desktop cannot drift apart.
test('the motions and bits are drawn by a stylesheet both pages load', () => {
  const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'),
    answer = read('styles/answer.css'),
    overlay = read('overlay/overlay.css');
  for (const page of ['index.html', 'overlay.html']) assert.match(read(page), /styles\/answer\.css/, page);
  const motions = new Set();
  for (const [book, list] of [
    ['fish', catalog.fish],
    ['bug', catalog.bugs],
    ['treasure', catalog.treasures],
    ['track', catalog.tracks],
  ])
    for (const k of list) motions.add(pokeOf(book, k.id)?.motion);
  for (const m of motions) assert.match(answer, new RegExp(`\\.held\\.moving\\[data-motion="${m}"\\]`), m);
  for (const m of ['spin', 'sway']) assert.match(answer, new RegExp(`\\.part\\.moving\\[data-motion="${m}"\\]`), m);
  for (const bits of ['bubbles', 'glints', 'sparkle', 'hearts']) assert.match(answer, new RegExp(`\\.${bits} i`), bits);
  assert.match(answer, /\.lamp-on/);
  assert.doesNotMatch(overlay, /\.held\.moving|\.part\.moving|@keyframes (held|part|bubble|sparkle)-|lamp-(on|off)/);
});
