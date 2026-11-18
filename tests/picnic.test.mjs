import assert from 'node:assert/strict';
import test from 'node:test';
import { picnicLayout } from '../src/yard/care.js';

test('a shared picnic fits the field at its edges in full and mini yards', () => {
  for (const [width, height, zoom] of [
    [1180, 780, 1],
    [460, 320, 0.57],
  ]) {
    for (const [x, y] of [
      [0, 0],
      [width, height],
    ]) {
      const p = picnicLayout({ x, y, width, height, top: height * 0.62, zoom, count: 3 });
      assert.ok(p.x - p.width / 2 >= 0);
      assert.ok(p.x + p.width / 2 <= width);
      assert.ok(p.y - p.height / 2 >= height * 0.62);
      assert.ok(p.y + p.height / 2 <= height - 20);
      assert.equal(p.seats.length, 3);
      assert.equal(new Set(p.seats.map(s => `${s.x},${s.y}`)).size, 3);
      assert.ok(
        p.seats.every(s => s.y <= p.y + p.height * 0.1),
        'friends gather behind and beside the food',
      );
    }
  }
});

test('one friend sits beside the shared food, and an empty yard has no seats', () => {
  const base = { x: 300, y: 300, width: 600, height: 400, top: 240, zoom: 0.7 };
  const one = picnicLayout({ ...base, count: 1 });
  assert.ok(Math.abs(one.seats[0].x - one.x) >= one.width / 2);
  assert.deepEqual(picnicLayout({ ...base, count: 0 }).seats, []);
});

// A new window size lays the meal again where it was, as a share of the yard, and the friends still
// on their way head for their seats around it, as they see it now (care.js resizePicnic).
test('a picnic set out before the window changes size is laid again with its seats', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { installDom } = await import('./support/dom.mjs');
  const { element } = installDom(t, { anyId: true, props: { rect: { width: 1000, height: 700 } } });
  const state = await import('../src/core/state.js');
  const field = await import('../src/yard/field.js');
  const { resizePicnic, setupCare } = await import('../src/yard/care.js');
  state.views.clear();
  t.after(() => state.views.clear());
  const pets = ['a', 'b'].map(id => ({ id, name: id, size: 112, x: 0.2, y: 0.5 }));
  state.setData({ pets, statuses: {}, busy: [], garden: { plants: [], decor: [], trees: [] } });
  for (const pet of pets)
    state.views.set(pet.id, { pet, x: pet.x, y: pet.y, button: element(), label: element(), canvas: { animate() {} } });
  field.measureYard();
  setupCare();
  state.setAiming('treat');
  await document.getElementById('yard').dispatch('click', { clientX: 500, clientY: 560 });
  const cloth = document.getElementById('treat');
  assert.equal(cloth.hidden, false);
  document.getElementById('yard').getBoundingClientRect = () => ({ width: 1600, height: 1000, left: 0, top: 0 });
  field.measureYard();
  resizePicnic();
  const now = picnicLayout({
    x: 800,
    y: 800,
    width: 1600,
    height: 1000,
    top: 1000 * field.fieldTop(),
    zoom: field.yardZoom(),
    count: 2,
  });
  assert.equal(cloth.style.left, `${now.x - now.width / 2}px`, 'the cloth is where the meal now lies');
  assert.equal(cloth.style.width, `${now.width}px`);
  [...state.views.values()].forEach((v, i) => {
    const seat = field.footTarget(v, now.seats[i].x, now.seats[i].y, 0);
    assert.ok(Math.hypot(v.target.x - seat.x, v.target.y - seat.y) < 1e-9, `${v.pet.id} heads for its seat`);
  });
});
