import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

let requests = [],
  pending;
globalThis.playPets = {
  moveDecor: (...args) => {
    requests.push(args);
    return new Promise(resolve => {
      pending = resolve;
    });
  },
};
const { setData } = await import('../src/core/state.js');
const { renderDecor } = await import('../src/yard/decor.js');
const { measureYard } = await import('../src/yard/field.js');

function fixture(t, at = { x: 0.4, y: 0.6 }) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes } = installDom(t, { anyId: true, ids: ['yard', 'garden-layer'] });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 560 });
  setData({ garden: { decor: [], plants: [], trees: [] }, pets: [] });
  renderDecor();
  const prop = { id: 'bench-drag', kind: 'bench', ...at };
  setData({ garden: { decor: [prop], plants: [], trees: [] }, pets: [] });
  measureYard();
  renderDecor();
  requests = [];
  return { prop, button: nodes.get('garden-layer').children.at(-1) };
}

test('furniture follows pointer deltas without jumping its foot to the grab point', async t => {
  const { prop, button } = fixture(t);
  const original = button.style.transform;
  await button.dispatch('pointerdown', { button: 0, clientX: 300, clientY: 360, pointerId: 7 });
  await button.dispatch('pointermove', { clientX: 330, clientY: 360, pointerId: 7 });
  assert.notEqual(button.style.transform, original);
  assert.equal(requests.length, 0, 'drag preview never waits on persistence');
  const saving = button.dispatch('pointerup', { pointerId: 7 });
  assert.equal(requests.length, 1);
  assert.ok(Math.abs(requests[0][1] - (0.4 + 30 / (800 - 28))) < 1e-9);
  assert.ok(Math.abs(requests[0][2] - 0.6) < 1e-9, 'the foot stays fixed when grabbed above it');
  pending({ ok: false, error: 'Move failed' });
  await saving;
  assert.equal(prop.x, 0.4);
  assert.equal(button.style.transform, original, 'failed persistence restores the saved location');
});

test('cancelled furniture drags restore their original position without saving', async t => {
  const { button } = fixture(t);
  const original = button.style.transform;
  await button.dispatch('pointerdown', { button: 0, clientX: 300, clientY: 360, pointerId: 7 });
  await button.dispatch('pointermove', { clientX: 350, clientY: 380, pointerId: 7 });
  await button.dispatch('pointercancel', { pointerId: 7 });
  assert.equal(button.style.transform, original);
  assert.equal(requests.length, 0);
});

const moved = () => requests.at(-1).slice(1);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a wide gift past the edge it cannot reach moves back at once, and is saved where it is drawn', async t => {
  const { button } = fixture(t, { x: 1, y: 0.6 });
  await button.dispatch('pointerdown', { button: 0, clientX: 700, clientY: 360, pointerId: 7 });
  await button.dispatch('pointermove', { clientX: 690, clientY: 360, pointerId: 7 });
  button.dispatch('pointerup', { pointerId: 7 });
  const [x] = moved();
  // Drawn with its right side four pixels inside the yard; ten pixels left of that.
  const w = Number.parseFloat(button.style.width);
  assert.ok(near(x, (800 - w / 2 - 4 - 10 - 14) / (800 - 28)), `${x}`);
  pending({ ok: true, data: {} });
});

for (const [width, height] of [
  [800, 560],
  [460, 320],
]) {
  test(`arrow keys move a gift by the same pixels in a ${width}x${height} window`, async t => {
    const { button } = fixture(t);
    globalThis.document.getElementById('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
    measureYard();
    await button.dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
    const [x, y] = moved();
    assert.ok(near(x, 0.4 + 16 / (width - 28)), `${x}`);
    assert.ok(near(y, 0.6));
    pending({ ok: true, data: {} });
  });
}
