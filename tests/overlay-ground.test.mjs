// The grass along the desktop's floor (overlay/ground.js): it shows only on its own screen, an end
// dragged stays on the screen and never closer to the other than the backend allows, and the backend
// hears the drag while it goes and where it ends.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

const VIEW = {
  displayId: '0',
  left: 0,
  right: 1440,
  areaLeft: 0,
  areaRight: 1440,
  min: 420,
  height: 56,
  gripWidth: 48,
};

async function lawn(t, displayId = '0', reduced = { matches: true }) {
  const { document } = installDom(t);
  const grips = ['left', 'right'].map(end => element('div', { dataset: { end } }));
  for (const grip of grips) {
    grip.setPointerCapture = () => {};
    grip.hasPointerCapture = () => true;
    grip.releasePointerCapture = () => {};
  }
  let made;
  const create = document.createElement;
  document.createElement = tag => {
    made = create.call(document, tag);
    made.querySelectorAll = selector => (selector === '.ground-grip' ? grips : []);
    return made;
  };
  const told = [];
  const menus = [];
  const api = { setGrass: (...args) => told.push(args), grassMenu: () => menus.push('grass') };
  const { setupGround } = await import('../src/overlay/ground.js');
  const ground = setupGround({ api, displayId, reduced });
  return { ground, node: made, grips, told, menus };
}

test('the grass shows on its own screen only, and goes with no view', async t => {
  const here = await lawn(t);
  here.ground.show(VIEW);
  assert.equal(here.node.hidden, false);
  assert.equal(here.node.style.width, '1440px');
  assert.ok(here.node.classList.contains('ground-edge-left'), 'across the whole floor, no fade at the edge');
  here.ground.show(null);
  assert.equal(here.node.hidden, true);
  const there = await lawn(t, '1');
  there.ground.show(VIEW);
  assert.equal(there.node.hidden, true, 'another screen draws no grass');
});

test('the strip is sized as the backend takes the pointer, and a layout with it in place writes nothing', async t => {
  const { ground, node } = await lawn(t);
  ground.show({ ...VIEW, height: 60, gripWidth: 40 });
  assert.equal(node.style['--ground-height'], '60px');
  assert.equal(node.style['--grip-width'], '40px');
  node.style.left = 'untouched';
  node.style['--grip-width'] = 'untouched';
  ground.show({ ...VIEW, height: 60, gripWidth: 40 });
  assert.equal(node.style.left, 'untouched', 'the same place is not written again');
  assert.equal(node.style['--grip-width'], 'untouched', 'nor the same sizes');
  ground.show({ ...VIEW, left: 200, height: 60, gripWidth: 40 });
  assert.equal(node.style.left, '200px');
  assert.ok(!node.classList.contains('ground-edge-left'), 'moved off the edge, it fades there');
  // Without a view's sizes the page falls back to the backend's own (grass.rs HEIGHT, twice GRIP).
  const css = readFileSync(new URL('../src/overlay/overlay.css', import.meta.url), 'utf8');
  const rust = readFileSync(new URL('../src-tauri/src/desktop/grass.rs', import.meta.url), 'utf8');
  const constant = name => Number(rust.match(new RegExp(`const ${name}: f64 = ([\\d.]+);`))[1]);
  assert.match(css, new RegExp(`height: var\\(--ground-height, ${constant('HEIGHT')}px\\)`));
  assert.match(css, new RegExp(`auto var\\(--ground-height, ${constant('HEIGHT')}px\\)`));
  assert.match(css, new RegExp(`width: var\\(--grip-width, ${2 * constant('GRIP')}px\\)`));
});

test('a dragged end stays on the screen and the least width away, and the backend hears it end', async t => {
  const { ground, node, grips, told } = await lawn(t);
  ground.show({ ...VIEW, areaLeft: 100, areaRight: 1540, left: 100, right: 1540 });
  const [left, right] = grips;
  left.onpointerdown({ button: 0, pointerId: 1, timeStamp: 0 });
  assert.deepEqual(told.at(-1), [100, 1540, true]);
  left.onpointermove({ clientX: 1300, timeStamp: 1000 });
  assert.deepEqual(told.at(-1), [1120, 1540, true], 'no nearer the other end than min');
  assert.equal(node.style.left, '1020px', 'placed from the window, which starts at the area');
  // The layout pushed mid-drag does not pull the grass back from under the pointer.
  ground.show({ ...VIEW, areaLeft: 100, areaRight: 1540, left: 100, right: 1540 });
  assert.equal(node.style.left, '1020px');
  left.onpointerup({ pointerId: 1 });
  assert.deepEqual(told.at(-1), [1120, 1540, false]);
  right.onpointerdown({ button: 0, pointerId: 2, timeStamp: 2000 });
  right.onpointermove({ clientX: 5000, timeStamp: 2600 });
  right.onpointercancel({ pointerId: 2 });
  assert.deepEqual(told.at(-1), [1120, 1540, false], 'kept on the screen');
  right.ondblclick();
  assert.deepEqual(told.at(-1), [100, 1540, false], 'a double click spreads it across the floor');
});

test('the grass wears the season the yard shows: snow in winter, the plain lawn otherwise', async t => {
  const { ground, node } = await lawn(t);
  ground.show(VIEW);
  ground.season('winter');
  assert.equal(node.dataset.season, 'winter');
  ground.season('spring');
  assert.equal(node.dataset.season, 'spring');
  const css = readFileSync(new URL('../src/overlay/overlay.css', import.meta.url), 'utf8');
  const drawn = (selector, art) => {
    const rule = css.match(new RegExp(`${selector.replace(/[[\]"().:]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `${selector} has a rule`);
    assert.match(rule[1], new RegExp(`url\\(\\.\\./art/ambient/${art}\\.webp\\)`), selector);
    assert.ok(existsSync(new URL(`../src/art/ambient/${art}.webp`, import.meta.url)), `${art}.webp is there`);
  };
  // A scatter of the season's small things read as specks at the strip's size, so only winter, whose
  // snow carries it, draws anything of its own; the falling bits (flurry.js) show the other seasons.
  drawn('.ground-turf', 'desktop-grass');
  drawn('.ground[data-season="winter"] .ground-turf', 'desktop-grass-winter');
  assert.doesNotMatch(css, /desktop-scatter/);
  assert.doesNotMatch(css, /\.ground\[data-season="(spring|summer|autumn)"\] \.ground-turf/);
  drawn('.ground[data-season="winter"] .ground-grip::after', 'desktop-pebble-winter');
});

test('a flurry falls only around a friend standing over the grass, in its own place on the strip', async t => {
  const { ground, node } = await lawn(t, '0', { matches: false });
  ground.show({ ...VIEW, left: 100, right: 900 });
  ground.season('autumn');
  assert.equal(ground.fall(50), false, 'past the grass');
  assert.equal(ground.fall(1200), false);
  assert.equal(ground.fall(500), true);
  const layer = node.children.find(c => c.className?.includes('flurry'));
  for (const bit of layer.children) {
    const x = parseFloat(bit.style['--x']);
    assert.ok(x >= 0 && x <= 800, `across the strip, from its left (${x})`);
  }
  ground.show(null);
  assert.equal(ground.fall(500), false, 'no grass, no flurry');
});

test('the bare grass thins under the pointer, but not while an end is pulled', async t => {
  const { ground, node, grips } = await lawn(t);
  ground.show(VIEW);
  ground.see(true);
  assert.ok(node.classList.contains('ground-see'));
  ground.see(false);
  grips[0].onpointerdown({ button: 0, pointerId: 1, timeStamp: 0 });
  ground.see(true);
  assert.ok(!node.classList.contains('ground-see'));
});

// Right on the desktop, the grass can be put away or spread across the floor again: a right click on
// either pebble asks for its menu (menu.rs grass_choices), with the page's own menu kept shut.
test('a right click on an end asks for the grass menu', async t => {
  const { ground, grips, menus } = await lawn(t);
  ground.show(VIEW);
  let kept = false;
  grips[1].oncontextmenu({ preventDefault: () => (kept = true) });
  assert.deepEqual(menus, ['grass']);
  assert.ok(kept, 'the page shows no menu of its own');
});

// Nobody says an end can be pulled: when the grass comes, a painted hand pulls the right pebble in
// and back a couple of times, then goes. It comes the first few times only, and never again once the
// person has pulled an end; with no storage to remember that, it never comes.
test('a hand shows how to pull an end the first few times, until the person has pulled one', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = installStorage(t);
  const { ground, node, grips } = await lawn(t, '0', { matches: false });
  const hand = () => grips[1].children.find(c => c.className === 'ground-hand' && !c.removed);
  for (let i = 0; i < 3; i++) {
    ground.show(VIEW);
    assert.ok(hand(), `shown, time ${i + 1}`);
    assert.ok(node.classList.contains('ground-demo'));
    t.mock.timers.tick(6000);
    assert.equal(hand(), undefined, 'and gone after its moment');
    assert.ok(!node.classList.contains('ground-demo'));
    ground.show(null);
  }
  ground.show(VIEW);
  assert.equal(hand(), undefined, 'not a fourth time');
  storage.removeItem('grass-demos');
  ground.show(null);
  ground.show(VIEW);
  assert.ok(hand());
  grips[0].onpointerdown({ button: 0, pointerId: 1, timeStamp: 0 });
  assert.equal(hand(), undefined, 'a pull takes it away');
  grips[0].onpointerup({ pointerId: 1 });
  storage.removeItem('grass-demos');
  ground.show(null);
  ground.show(VIEW);
  assert.equal(hand(), undefined, 'never again once an end was pulled');
});

test('with no storage to remember it by, the hand does not come', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { ground, grips } = await lawn(t, '0', { matches: false });
  keepGlobals(t, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('denied');
    },
  });
  ground.show(VIEW);
  assert.equal(
    grips[1].children.find(c => c.className === 'ground-hand'),
    undefined,
  );
});
