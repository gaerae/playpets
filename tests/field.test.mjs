import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decorFloor,
  DEPTH_FAR,
  depthAt,
  dockBox,
  drawnBox,
  field,
  fieldTop,
  fieldToYard,
  footOf,
  footTarget,
  geometry,
  measureYard,
  petHeight,
  underDock,
  yardToDecor,
} from '../src/yard/field.js';
import { composition } from '../src/yard/layout.js';
import { clearOfDock, place } from '../src/yard/views.js';
import { scene } from '../src/yard/world.js';
import { worldFor } from '../src/yard/worlds.js';
import { attic, withAttic } from './support/attic.mjs';
import { yard as painted } from './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

function yardIn(t, environment, world = 'woodland') {
  const { nodes } = installDom(t, { ids: ['yard'] });
  const yard = nodes.get('yard');
  yard.getBoundingClientRect = () => ({ width: 1000, height: 700 });
  if (environment) yard.dataset.environment = environment;
  const before = scene.world;
  scene.world = world;
  t.after(() => {
    scene.world = before;
  });
  measureYard();
  return yard;
}

// The painted fallback (a picture that failed to load) draws yard.json's land and lake, so friends
// stand on its ridge, not on the line of the picture that is not there.
test('the field begins where the land shown begins: the picture, or the painted fallback', t => {
  assert.notEqual(worldFor('woodland').geometry.fieldTop, painted.fieldTop, 'the two layouts differ');
  const yard = yardIn(t, 'illustrated');
  assert.equal(fieldTop(), worldFor('woodland').geometry.fieldTop);
  yard.dataset.environment = 'painted';
  assert.equal(fieldTop(), painted.fieldTop);
  assert.equal(fieldTop(), composition.fieldTop);
  assert.equal(field().top, 700 * painted.fieldTop);
  yard.dataset.environment = 'illustrated';
  assert.equal(field().top, 700 * worldFor('woodland').geometry.fieldTop);
});

test('before the land is first drawn the field follows the place', t => {
  yardIn(t, undefined);
  assert.equal(fieldTop(), worldFor('woodland').geometry.fieldTop);
});

// A room without a sky has no painted land to line up with (its fallback is a plain floor).
test('a room keeps its own floor line when its picture is missing', t => {
  withAttic(t);
  yardIn(t, 'painted', attic.id);
  assert.equal(fieldTop(), worldFor(attic.id).geometry.fieldTop);
});

// Gifts have no name tag under them, so they reach down to just above the dock (or nearly to the
// foot of a small window, where the dock is hidden), while friends keep room for their names.
test('a friend walks down to its name tag, past where plants keep to; a stroll does not end under the dock', t => {
  yardIn(t);
  const pet = { size: 96 },
    { h, top } = geometry(pet);
  // Its feet reach the foot of the yard but for the tag that hangs below them.
  assert.equal(top + h + petHeight(pet), 700 - 28);
  assert.equal(field().bottom, 700 - 76, 'plants and gifts keep their places');
  dockAt();
  assert.equal(underDock(800, 660, 48), true);
  assert.equal(underDock(570, 660, 48), true, 'half a body beside it is still behind it');
  assert.equal(underDock(500, 660, 48), false);
  assert.equal(underDock(800, 630, 48), false, 'feet above it leave the friend in view');
  // Measured once and asked many times, as a stroll's tries are: the box itself reads no layout.
  const box = dockBox();
  globalThis.document.querySelector = () => assert.fail('the dock is not measured again');
  assert.equal(underDock(800, 660, 48, box), true);
  assert.equal(underDock(500, 660, 48, box), false);
  globalThis.document.querySelector = () => ({ getBoundingClientRect: () => ({ width: 0 }) });
  assert.equal(dockBox(), null);
  assert.equal(underDock(800, 660, 48), false, 'a hidden dock hides nothing');
});
// The dock floats over the foot at the right (shell.css .yard-dock), in this test's document.
function dockAt() {
  globalThis.document.querySelector = selector =>
    selector === '.yard-dock'
      ? { getBoundingClientRect: () => ({ left: 600, right: 988, top: 646, bottom: 688, width: 388, height: 42 }) }
      : null;
}
const friendAt = (x, y) => ({ pet: { size: 96 }, x, y, button: element(), label: element() });
// A friend saved at the front edge before friends walked past the field's foot comes back lower,
// and one can be dropped there: either would stand hidden behind the dock.
test('a friend kept or dropped behind the dock is lifted to stand just above it', t => {
  yardIn(t);
  dockAt();
  const v = friendAt(0.8, 1);
  place(v);
  const before = footOf(v);
  assert.equal(underDock(before.x, before.y, 48), true, 'a place saved at the front edge is behind it now');
  clearOfDock(v);
  const after = footOf(v);
  assert.equal(after.x, before.x, 'it is lifted, not moved aside');
  assert.ok(Math.abs(after.y - 646) < 1e-6, "its feet stand on the dock's top edge");
  assert.equal(underDock(after.x, after.y, 48), false);
  const beside = friendAt(0.1, 1);
  place(beside);
  clearOfDock(beside);
  assert.equal(beside.y, 1, 'beside the dock it stays where it is');
});
// A friend farther back is drawn smaller about its feet. What goes with it follows the drawing, not
// its unshrunk box: the tag under its feet, its line and the agent's dot on its head (--depth), and
// the rod in its paws (drawnBox), or they float above a friend at the back.
test('what sits on a friend far back follows its shrunk drawing', t => {
  yardIn(t);
  for (const [y, depth] of [
    [0, DEPTH_FAR],
    [1, 1],
  ]) {
    const v = friendAt(0.5, y);
    place(v);
    const width = 96,
      height = petHeight(v.pet),
      foot = footOf(v);
    assert.equal(v.depth, depth);
    assert.equal(v.label.style['--depth'], String(depth), 'the head offset shrinks with it');
    assert.equal(
      v.label.style.transform,
      `translate(${v.px}px,${v.py + height * (1 - depth)}px)`,
      'the label starts where the shrunk drawing does, so the tag stays under its feet',
    );
    const box = drawnBox(v);
    assert.ok(Math.abs(box.y + box.height - foot.y) < 1e-9, 'the drawing still stands on its feet');
    assert.ok(Math.abs(box.x + box.width / 2 - foot.x) < 1e-9, 'about its middle');
    assert.ok(Math.abs(box.width - width * depth) < 1e-9 && Math.abs(box.height - height * depth) < 1e-9);
  }
});
// Plants and gifts are ordered by where their foot is on the field (depthAt); friends walk on
// further down, so they are ordered by their feet the same way, or one standing just in front of a
// flower would be drawn behind it.
test('a friend is drawn in front of a plant it stands in front of, and behind one it stands behind', t => {
  yardIn(t);
  const plantFoot = fieldToYard({ x: 0.5, y: 0.9 }).y,
    plantZ = depthAt(plantFoot);
  for (const [gap, inFront] of [
    [9, true],
    [-9, false],
  ]) {
    const v = friendAt(0.5, 0);
    v.y = footTarget(v, 500, plantFoot + gap, 0).y;
    place(v);
    assert.equal(v.z, depthAt(footOf(v).y), 'by its feet, as plants and gifts');
    assert.equal(v.z > plantZ, inFront, `${gap}px from the plant's foot`);
  }
});
test("gifts stand below the friends' field, drawn in front of every friend above them", t => {
  withAttic(t);
  yardIn(t, 'illustrated', attic.id);
  const f = field(),
    floor = decorFloor();
  assert.equal(f.bottom, 700 - 76);
  // Just above the dock: 58px from the foot, as a place past 1 on the friends' field.
  assert.equal(floor, (700 - 58 - f.top) / (f.bottom - f.top));
  assert.equal(fieldToYard({ x: 0, y: floor }).y, 700 - 58);
  assert.deepEqual(yardToDecor(14, 700), { x: 0, y: floor }, 'no lower than the floor');
  assert.deepEqual(yardToDecor(14, f.top - 9), { x: 0, y: 0 });
  // The order friends use: 1 at the top of their field, 101 at its foot, more below it.
  assert.equal(depthAt(f.top), 1);
  assert.equal(depthAt(f.bottom), 101);
  assert.ok(depthAt(700 - 58) > 101);
  globalThis.document.body.classList.add('compact');
  assert.ok(decorFloor() > floor, 'a small window hides the dock');
});
