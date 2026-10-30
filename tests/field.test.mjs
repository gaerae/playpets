import assert from 'node:assert/strict';
import test from 'node:test';
import { decorFloor, depthAt, field, fieldTop, fieldToYard, measureYard, yardToDecor } from '../src/yard/field.js';
import { composition } from '../src/yard/layout.js';
import { scene } from '../src/yard/world.js';
import { worldFor } from '../src/yard/worlds.js';
import { yard as painted } from './support/content.mjs';
import { installDom } from './support/dom.mjs';

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
  yardIn(t, 'painted', 'studio');
  assert.equal(fieldTop(), worldFor('studio').geometry.fieldTop);
});

// Gifts have no name tag under them, so they reach down to just above the dock (or nearly to the
// foot of a small window, where the dock is hidden), while friends keep room for their names.
test("gifts stand below the friends' field, drawn in front of every friend above them", t => {
  yardIn(t, 'illustrated', 'studio');
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
