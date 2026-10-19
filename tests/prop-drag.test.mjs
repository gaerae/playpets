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

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes } = installDom(t, { anyId: true, ids: ['yard', 'garden-layer'] });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 560 });
  setData({ garden: { decor: [], plants: [], trees: [] }, pets: [] });
  renderDecor();
  const prop = { id: 'bench-drag', kind: 'bench', x: 0.4, y: 0.6 };
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
  assert.equal(requests[0][1], 0.4 + 30 / (800 - 28));
  assert.equal(requests[0][2], 0.6, 'the foot stays fixed when grabbed above it');
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
