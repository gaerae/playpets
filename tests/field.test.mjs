import assert from 'node:assert/strict';
import test from 'node:test';
import { field, fieldTop, measureYard } from '../src/yard/field.js';
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
