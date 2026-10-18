import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const requests = [];
let moveResult = { ok: true };
globalThis.playPets = Object.fromEntries(
  ['moveTree', 'removeTree'].map(method => [
    method,
    async (...args) => {
      requests.push({ method, args });
      return method === 'moveTree' ? moveResult : { ok: true };
    },
  ]),
);
const state = await import('../src/core/state.js');
const { setData } = state;
const { renderTrees, setupTrees } = await import('../src/yard/planted-trees.js');
const { fieldToYard, measureYard, yardZoom } = await import('../src/yard/field.js');
const { setupConfirm } = await import('../src/core/confirm.js');
const { scene } = await import('../src/yard/world.js');
const { treeKind } = await import('../src/yard/catalog.js');

function fixture(t) {
  const previous = state.data,
    world = scene.world,
    season = scene.season;
  t.after(() => {
    setData(previous);
    scene.world = world;
    scene.season = season;
  });
  const { nodes } = installDom(t, { anyId: true, ids: ['yard', 'garden-layer'] });
  setData({ ...previous, garden: { trees: [] } });
  renderTrees();
  scene.world = 'woodland';
  let width = 800,
    height = 560;
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  const tree = { id: 'tree-test', kind: 'cherry', world: 'woodland', stage: 2, planted: Date.now(), x: 0.25, y: 0.7 };
  setData({ ...previous, garden: { trees: [tree], decor: [], plants: [] } });
  requests.length = 0;
  moveResult = { ok: true };
  measureYard();
  setupTrees();
  renderTrees();
  const button = nodes.get('garden-layer').children.at(-1);
  return {
    tree,
    button,
    nodes,
    resize(w, h) {
      width = w;
      height = h;
      measureYard();
      renderTrees();
    },
  };
}

test('trees retain scene ownership and their foot anchor while scaling with the yard', t => {
  const { tree, button, nodes, resize } = fixture(t);
  const foot = fieldToYard(tree);
  assert.equal(button.style.width, `${160 * yardZoom()}px`);
  assert.equal(button.style.height, `${170 * yardZoom()}px`);
  assert.equal(button.style.transform, `translate(${foot.x - 80 * yardZoom()}px,${foot.y - 170 * yardZoom()}px)`);
  assert.equal(button.style.zIndex, String(1 + Math.round(tree.y * 100)));
  assert.match(button.innerHTML, /cherry-mature/);
  resize(300, 210);
  assert.equal(button.style.width, `${160 * yardZoom()}px`);
  scene.world = 'room';
  renderTrees();
  assert.equal(button.removed, true);
  assert.equal(state.data.garden.trees.length, 1, 'switching worlds never deletes a saved tree');
  scene.world = 'woodland';
  renderTrees();
  assert.notEqual(nodes.get('garden-layer').children.at(-1), button);
});

test('drag cancellation and invalid ground never save, while keyboard moves use self-excluded ground', async t => {
  const { tree, button } = fixture(t);
  const original = button.style.transform;
  await button.dispatch('pointerdown', { button: 0, clientX: 200, clientY: 400, pointerId: 1 });
  await button.dispatch('pointermove', { clientX: 230, clientY: 410, pointerId: 1 });
  await button.dispatch('pointercancel', { pointerId: 1 });
  assert.equal(button.style.transform, original);
  assert.equal(requests.length, 0);
  state.data.garden.plants.push({ id: 'blocked-root', x: tree.x, y: 0 });
  await button.dispatch('pointerdown', { button: 0, clientX: 200, clientY: 400, pointerId: 1 });
  await button.dispatch('pointermove', { clientX: 200, clientY: -10000, pointerId: 1 });
  await button.dispatch('pointerup', { pointerId: 1 });
  assert.equal(requests.length, 0, 'clamped coordinates outside valid soil are rejected');
  await button.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'moveTree');
  assert.equal(requests[0].args[0], tree.id);
  assert.equal(requests[0].args[1], 0.28);
  assert.ok(
    requests[0].args[3].obstacles.every(o => Math.abs(o.x - 0.25) > 0.00001 || Math.abs(o.y - 0.7) > 0.00001),
    'the tree does not collide with itself',
  );
  scene.world = 'room';
  await button.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(requests.length, 1, 'stale scene buttons cannot move another world tree');
});

test('removal requires confirmation and a stale world cannot remove the tree', async t => {
  const { button } = fixture(t);
  setupConfirm();
  const pending = button.dispatch('keydown', { key: 'Delete' });
  document.getElementById('confirm-cancel').onclick();
  await document.getElementById('confirm-dialog').dispatch('close');
  await pending;
  assert.equal(requests.length, 0);
  const stale = button.dispatch('keydown', { key: 'Delete' });
  scene.world = 'room';
  document.getElementById('confirm-ok').onclick();
  await stale;
  assert.equal(requests.length, 0);
  scene.world = 'woodland';
  const accepted = button.dispatch('keydown', { key: 'Delete' });
  document.getElementById('confirm-ok').onclick();
  await accepted;
  assert.equal(requests[0].method, 'removeTree');
  assert.deepEqual(requests[0].args, ['tree-test']);
});

test('accepted pointer moves keep their foot offset and failed saves restore the saved position', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { tree, button } = fixture(t);
  const original = button.style.transform;
  moveResult = { ok: false, error: 'The tree could not be moved.' };
  await button.dispatch('pointerdown', { button: 0, clientX: 170, clientY: 390, pointerId: 4 });
  await button.dispatch('pointermove', { clientX: 190, clientY: 390, pointerId: 4 });
  await button.dispatch('pointerup', { pointerId: 4 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].args[1], 0.25 + 20 / (800 - 28));
  assert.equal(requests[0].args[2], 0.7, 'grabbing above the root does not teleport it to the pointer');
  assert.equal(tree.x, 0.25);
  assert.equal(button.style.transform, original);
  assert.equal(button.disabled, false);
  assert.equal(document.getElementById('toast').textContent, 'The tree could not be moved.');
  moveResult = { ok: true };
  tree.x = 0.99;
  await button.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(requests.at(-1).args[1], 1, 'keyboard placement clamps the normalized foot, not the canopy');
});

test('growth keeps the root fixed and seasonal art applies only to mature trees', t => {
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  const { tree, button } = fixture(t);
  const kind = treeKind(tree.kind),
    previous = kind.seasonArt;
  t.after(() => {
    kind.seasonArt = previous;
  });
  kind.seasonArt = { autumn: 'trees/cherry-mature-autumn.svg' };
  tree.stage = 0;
  tree.planted = now;
  scene.season = 'autumn';
  renderTrees();
  const foot = fieldToYard(tree);
  assert.match(button.innerHTML, /cherry-seedling/);
  assert.equal(button.style.height, `${40 * yardZoom()}px`);
  now += 2 * 60 * 60 * 1000;
  renderTrees();
  assert.match(button.innerHTML, /cherry-young/);
  now += 10 * 60 * 60 * 1000;
  renderTrees();
  assert.match(button.innerHTML, /cherry-mature-autumn/);
  assert.equal(button.style.transform, `translate(${foot.x - 80 * yardZoom()}px,${foot.y - 170 * yardZoom()}px)`);
});
