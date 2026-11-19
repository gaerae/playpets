// Gifts on the desktop answer a poke and the time of day (src/overlay/poke.js, used by
// decor-view.js and overlay.js; docs/design/2026-11-19-desktop-items-that-answer.md).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets = {};
const { giftLayers, poke, showLamp } = await import('../src/overlay/poke.js');
const { giftKind } = await import('../src/yard/catalog.js');
const { element } = await import('./support/dom.mjs');

const desktopGift = kind => {
  const v = { id: kind, kind, button: element('button'), part: element('span') };
  return v;
};

test('a lit gift brings its halo and pool, and a gift with a moving part is laid twice', () => {
  const lantern = giftLayers('lantern');
  assert.match(lantern, /class="fx-glow"/);
  assert.match(lantern, /class="fx-pool"/);
  const bench = giftLayers('bench');
  assert.doesNotMatch(bench, /fx-glow|class="part/);
  const pinwheel = giftLayers('pinwheel'),
    { part } = giftKind('pinwheel');
  assert.equal(part.motion, 'spin');
  // The still copy has the part cut out (evenodd), the moving one only the part, turning about its pivot.
  assert.match(pinwheel, /class="part-still" style="clip-path: ?polygon\(evenodd,/);
  assert.match(pinwheel, /class="part" data-motion="spin"/);
  assert.match(pinwheel, new RegExp(`transform-origin: ?${part.pivot[0] * 100}% ${part.pivot[1] * 100}%`));
  assert.equal(pinwheel.match(/<svg/g).length, 2 * (bench.match(/<svg/g)?.length || 1));
  assert.equal(giftKind('windchime').part.motion, 'sway');
  // Every point of a part lies on its box.
  for (const kind of ['pinwheel', 'windchime'])
    for (const [x, y] of [...giftKind(kind).part.points, giftKind(kind).part.pivot]) {
      assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${kind} ${x},${y}`);
    }
});

test('a poke spins the pinwheel and swings the wind chime, which rings; nothing moves with reduced motion', () => {
  const rings = [];
  const ring = () => rings.push(1);
  const pinwheel = desktopGift('pinwheel');
  poke(pinwheel, { period: 'day', reduced: false, ring });
  assert.ok(pinwheel.part.classList.contains('moving'));
  assert.equal(rings.length, 0, 'a pinwheel has no sound');
  // The motion ends by itself: the class goes when its animation does.
  pinwheel.part.dispatch('animationend');
  assert.equal(pinwheel.part.classList.contains('moving'), false);
  const chime = desktopGift('windchime');
  poke(chime, { period: 'day', reduced: false, ring });
  assert.ok(chime.part.classList.contains('moving'));
  assert.equal(rings.length, 1);
  const still = desktopGift('windchime');
  poke(still, { period: 'day', reduced: true, ring });
  assert.equal(still.part.classList.contains('moving'), false);
  assert.equal(rings.length, 2, 'it still rings');
  const bench = desktopGift('bench');
  poke(bench, { period: 'night', reduced: false, ring });
  assert.equal(bench.part.classList.contains('moving'), false, 'a bench has no part');
});

test('a poked lantern switches its light until the time of day changes', () => {
  const lantern = desktopGift('lantern'),
    lamp = () => ['lamp-on', 'lamp-off'].filter(c => lantern.button.classList.contains(c));
  showLamp(lantern, 'night');
  assert.deepEqual(lamp(), [], 'lit by the hour alone');
  poke(lantern, { period: 'night', reduced: false, ring() {} });
  assert.deepEqual(lamp(), ['lamp-off']);
  poke(lantern, { period: 'night', reduced: false, ring() {} });
  assert.deepEqual(lamp(), ['lamp-on']);
  showLamp(lantern, 'morning');
  assert.deepEqual(lamp(), [], 'morning goes back to the hour');
  poke(lantern, { period: 'day', reduced: false, ring() {} });
  assert.deepEqual(lamp(), ['lamp-on'], 'lit by day when poked');
  const campfire = desktopGift('campfire');
  poke(campfire, { period: 'night', reduced: false, ring() {} });
  assert.equal(campfire.button.classList.contains('lamp-off'), false, 'only a lamp switches');
});
