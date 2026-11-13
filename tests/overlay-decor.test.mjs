// A thing out on the desktop is drawn once it is known what it is, and changes with the garden, not
// with every place a walking friend streams (src/overlay/decor-view.js, used by overlay.js).
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';

globalThis.playPets = {};
const { drawDecor, dressDecor } = await import('../src/overlay/decor-view.js');
const { growingArt } = await import('../src/overlay/growing.js');
const { giftKind, STAGES } = await import('../src/yard/catalog.js');
const { drawYard } = await import('./support/yard.mjs');
const { element } = await import('./support/dom.mjs');

const NOW = new Date(2026, 5, 10, 12).getTime();
const ART = [...new Set([...growingArt('tulip'), giftKind('bench').art])];
function desktopThing(id, kind) {
  const button = element('button');
  // As a browser does: the gift's drawing goes in first (overlay.js keeps what it wears after it).
  button.insertAdjacentHTML = (_, html) => (button.drawing = html);
  return { id, kind, button, drawn: false, growing: false, look: null, worn: null };
}

test('a flower placed on the desktop before the garden names it is drawn as a flower once it does', async t => {
  await drawYard(t, { now: NOW, art: ART });
  const v = desktopThing('p', 'tulip');
  let garden = { plants: [], decor: [] };
  await drawDecor(
    v,
    () => garden,
    () => 'summer',
  );
  assert.equal(v.drawn, false, 'not drawn as a gift while the garden does not say what it is');
  assert.equal(v.button.drawing, undefined);
  garden = { plants: [{ id: 'p', kind: 'tulip', x: 0.5, y: 0.5, planted: NOW }], decor: [] };
  await drawDecor(
    v,
    () => garden,
    () => 'summer',
  );
  assert.equal(v.drawn, true);
  assert.equal(v.growing, true);
  assert.match(v.button.innerHTML, /#art-plants-seed/);
  assert.equal(v.button.dataset.stage, 'seed');
  assert.notEqual(v.button.title, 'decor.kind_tulip');
});

test('a gift is drawn once, named, and a flower changes only when its look does', async t => {
  await drawYard(t, { now: NOW, art: ART });
  const bench = desktopThing('b', 'bench');
  const garden = {
    plants: [{ id: 'p', kind: 'tulip', x: 0.5, y: 0.5, planted: NOW }],
    decor: [{ id: 'b', kind: 'bench', x: 0.2, y: 0.7 }],
  };
  const calls = [];
  const once = () => {
    calls.push(1);
    return garden;
  };
  await drawDecor(bench, once, () => 'summer');
  await drawDecor(bench, once, () => 'summer');
  assert.equal(calls.length, 2, 'the second call does nothing once drawn');
  assert.match(bench.button.drawing, /bench/);
  assert.equal(bench.button.getAttribute('aria-label'), bench.button.title);

  const flower = desktopThing('p', 'tulip');
  await drawDecor(
    flower,
    () => garden,
    () => 'summer',
  );
  const drawn = flower.button.innerHTML;
  flower.button.innerHTML = 'kept';
  dressDecor(flower, garden, 'summer', new Date(NOW + 60 * 1000));
  assert.equal(flower.button.innerHTML, 'kept', 'the same look is not drawn again');
  dressDecor(flower, garden, 'summer', new Date(NOW + STAGES[1].at));
  assert.notEqual(flower.button.innerHTML, 'kept', 'a new stage is');
  assert.notEqual(flower.button.innerHTML, drawn);
  assert.equal(flower.button.dataset.stage, 'sprout');
});

test('the desktop tree stands grand while the yard says so, and grows when it turns grand out here', async t => {
  const { wearArt } = await import('../src/overlay/wear.js');
  const { reduced } = await import('../src/core/sprites.js');
  await drawYard(t, { now: NOW, art: wearArt('xmas_tree') });
  assert.ok(wearArt('xmas_tree').includes(giftKind('xmas_tree').night.art), 'the grand drawing is loaded too');
  const tree = desktopThing('x', 'xmas_tree');
  const garden = { plants: [], decor: [{ id: 'x', kind: 'xmas_tree', x: 0.5, y: 0.5 }] };
  const has = name => tree.button.classList.contains(name);
  const layers = () => tree.button.children.filter(c => typeof c === 'object' && c.classList.contains('xmas-night'));
  await drawDecor(
    tree,
    () => garden,
    () => 'winter',
    () => ['xmas_tree'],
  );
  assert.ok(has('xmas-grand'), 'out on a Christmas night, it is grand at once');
  assert.ok(!has('xmas-rise'));
  dressDecor(tree, garden, 'winter', new Date(NOW), []);
  assert.ok(!has('xmas-grand'));
  dressDecor(tree, garden, 'winter', new Date(NOW), ['xmas_tree']);
  assert.ok(has('xmas-grand'));
  assert.ok(has('xmas-rise'), 'turning grand while out, it grows');
  t.mock.timers.tick(2600);
  assert.ok(!has('xmas-rise'));
  assert.equal(layers().length, 1, 'the grand layer is made once');
  dressDecor(tree, garden, 'winter', new Date(NOW), []);
  reduced.matches = true;
  t.after(() => (reduced.matches = false));
  dressDecor(tree, garden, 'winter', new Date(NOW), ['xmas_tree']);
  assert.ok(has('xmas-grand'));
  assert.ok(!has('xmas-rise'), 'with reduced motion it is a crossfade');
});

test('a thing let go on the desktop falls to where the backend sets it down, and only then', async () => {
  const { settleDecor } = await import('../src/overlay/decor-view.js');
  const falls = [];
  const v = {
    wrap: { style: {}, animate: (frames, options) => falls.push({ frames, options }) },
    dropped: 0,
  };
  const at = (x, y) => `translate(${x}px,${y}px)`;
  // Placed and carried: it goes where it is told, at once.
  settleDecor(v, 100, 600, false, 1000);
  settleDecor(v, 400, 200, false, 1100);
  assert.equal(v.wrap.style.transform, at(400, 200));
  assert.equal(falls.length, 0);
  // Let go: the place the drag left it, sent again, keeps it waiting; the backend's floor brings it down.
  v.dropped = 2000;
  settleDecor(v, 400, 200, false, 2010);
  assert.equal(falls.length, 0);
  settleDecor(v, 400, 630, false, 2050);
  assert.equal(v.wrap.style.transform, at(400, 630));
  assert.equal(falls.length, 1);
  assert.deepEqual(
    falls[0].frames.map(f => f.transform),
    [at(400, 200), at(400, 630)],
  );
  assert.ok(falls[0].options.duration > 0 && falls[0].options.duration <= 400);
  assert.equal(v.dropped, 0, 'one fall per drop');
  // Moved later (a tree that grew keeps its foot), it does not fall.
  settleDecor(v, 380, 600, false, 2100);
  assert.equal(falls.length, 1);
  // With reduced motion, or long after the drop, it is simply there.
  settleDecor(v, 380, 200, false, 3000);
  v.dropped = 3010;
  settleDecor(v, 380, 600, true, 3020);
  settleDecor(v, 380, 200, false, 4000);
  v.dropped = 4010;
  settleDecor(v, 380, 600, false, 9000);
  assert.equal(falls.length, 1);
  assert.equal(v.wrap.style.transform, at(380, 600));
});

// A thing picked up again while it falls, or before the backend's word on the last drop came, is
// carried from where it shows: the fall stops at once, and nothing plays over the new drag.
test('a desktop thing picked up again stops falling, and nothing falls while it is held', async () => {
  const { holdDecor, settleDecor } = await import('../src/overlay/decor-view.js');
  const falls = [];
  const v = {
    wrap: {
      style: {},
      animate: () => {
        const fall = { cancelled: false, cancel: () => (fall.cancelled = true) };
        falls.push(fall);
        return fall;
      },
    },
    dropped: 0,
  };
  settleDecor(v, 400, 200, false, 1000);
  v.dropped = 2000;
  settleDecor(v, 400, 630, false, 2050);
  assert.equal(falls.length, 1);
  // Pressed again mid-fall.
  v.drag = true;
  holdDecor(v);
  assert.equal(falls[0].cancelled, true, 'the fall stops where it shows');
  // Let go again, and pressed before the backend's word on that drop came: carried, not dropped.
  v.drag = null;
  v.dropped = 3000;
  v.drag = true;
  holdDecor(v);
  settleDecor(v, 420, 300, false, 3050);
  assert.equal(falls.length, 1);
  // Even with a drop time left over, nothing falls while it is held.
  v.dropped = 3100;
  settleDecor(v, 420, 630, false, 3150);
  assert.equal(falls.length, 1);
  assert.equal(v.wrap.style.transform, 'translate(420px,630px)');
});
