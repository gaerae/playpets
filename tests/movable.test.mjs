// A flower and a planted tree are moved the same way (props.js movable): dragged or moved with the
// arrow keys, their menu opened by a right click or the menu key, Delete takes them away, and a
// click right after a drop is not a press.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom } from './support/dom.mjs';

globalThis.playPets = {};
const { movable } = await import('../src/yard/props.js');
const { measureYard } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');

function fixture(t, more = {}) {
  const { nodes } = installDom(t, { anyId: true, ids: ['yard', 'garden-layer'] });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
  measureYard();
  const world = scene.world;
  t.after(() => (scene.world = world));
  const item = { id: 'p', x: 0.5, y: 0.5 };
  const seen = { shown: [], saved: [], menus: [], removed: 0, settled: 0, presses: 0 };
  const view = {
    id: 'p',
    button: element('button', { rect: { left: 300, top: 200, width: 50, height: 75 } }),
    drag: null,
  };
  movable(view, {
    current: () => item,
    show: at => seen.shown.push(at),
    save: at => seen.saved.push(at),
    menu: at => seen.menus.push(at),
    remove: () => seen.removed++,
    settle: () => seen.settled++,
    press: () => seen.presses++,
    ...more,
  });
  return { view, button: view.button, seen };
}
const drag = async (button, end) => {
  await button.dispatch('pointerdown', { button: 0, clientX: 300, clientY: 300, pointerId: 1 });
  await button.dispatch('pointermove', { clientX: 340, clientY: 300, pointerId: 1 });
  await button.dispatch(end, { pointerId: 1 });
};

test('a click right after a drop is not a press, but one after a cancelled drag is', async t => {
  const { button, seen } = fixture(t);
  await button.dispatch('click');
  assert.equal(seen.presses, 1);
  await drag(button, 'pointerup');
  assert.equal(seen.saved.length, 1, 'dropped, it is kept where it was let go');
  assert.ok(seen.saved[0].x > 0.5);
  await button.dispatch('click');
  assert.equal(seen.presses, 1, 'the click that ends a drag waters nothing');
  await button.dispatch('click');
  assert.equal(seen.presses, 2);
  await drag(button, 'pointercancel');
  assert.equal(seen.saved.length, 1, 'a cancelled drag keeps nothing');
  assert.equal(seen.settled, 2, 'and the field is drawn again after each');
  await button.dispatch('click');
  assert.equal(seen.presses, 3, 'no click follows a cancel, so the next one is a press');
});

test('the arrow keys move it, the menu key opens its menu below it, and Delete takes it away', async t => {
  const { button, seen } = fixture(t);
  await button.dispatch('keydown', { key: 'ArrowRight' });
  await button.dispatch('keydown', { key: 'ArrowUp' });
  assert.deepEqual(seen.saved, [
    { x: 0.53, y: 0.5 },
    { x: 0.5, y: 0.45 },
  ]);
  await button.dispatch('keydown', { key: 'F10', shiftKey: true });
  await button.dispatch('contextmenu', { clientX: 12, clientY: 34 });
  assert.deepEqual(seen.menus, [
    { x: 300, y: 275 },
    { x: 12, y: 34 },
  ]);
  await button.dispatch('keydown', { key: 'Delete' });
  assert.equal(seen.removed, 1);
});

test('a drag asks about each spot with the same drag, so the ground it checks against is built once', async t => {
  const asked = [];
  const allowed = (at, drag) => {
    asked.push(drag);
    drag.ground ??= { built: asked.length };
    return true;
  };
  const { button } = fixture(t, { allowed });
  await button.dispatch('pointerdown', { button: 0, clientX: 300, clientY: 300, pointerId: 1 });
  for (const x of [320, 340, 360]) await button.dispatch('pointermove', { clientX: x, clientY: 300, pointerId: 1 });
  await button.dispatch('pointerup', { pointerId: 1 });
  assert.equal(asked.length, 3);
  assert.ok(
    asked.every(drag => drag === asked[0]),
    'every move of one drag is asked with that drag',
  );
  assert.deepEqual(asked[0].ground, { built: 1 });
});
