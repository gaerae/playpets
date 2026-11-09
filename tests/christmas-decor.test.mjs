// A Christmas gift put away goes back into the gift box while the box has room, as a memento does.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

const hidden = [];
globalThis.playPets = {
  moveDecor: async () => ({ ok: true, data: null }),
  hideDecor: async kinds => {
    hidden.push(kinds);
    return { ok: true, data: null };
  },
};
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { renderDecor } = await import('../src/yard/decor.js');
const { measureYard } = await import('../src/yard/field.js');
const { scene } = await import('../src/yard/world.js');

const miso = { id: 'miso', name: 'Miso' };
// December 5 at noon, local time: the same answer in both hemispheres.
const NOW = new Date(2026, 11, 5, 12).getTime();

for (const [boxed, key] of [
  [0, 'decor.memento_put_away'],
  [12, 'decor.put_away_done'],
]) {
  test(`a Christmas gift put away with ${boxed} in the box says ${key}`, async ctx => {
    ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
    const season = scene.season;
    scene.season = 'winter';
    ctx.after(() => {
      scene.season = season;
    });
    const { nodes } = installDom(ctx, { anyId: true, ids: ['yard', 'garden-layer', 'toast'] });
    nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
    setData({ garden: { decor: [], plants: [], trees: [] }, pets: [] });
    renderDecor();
    setData({
      garden: {
        plants: [],
        trees: [],
        // Its own id: one put away a moment ago waits out its Undo (props.js).
        decor: [{ id: `t${boxed}`, kind: 'xmas_tree', x: 0.3, y: 0.5 }],
        boxed: Array.from({ length: boxed }, (_, i) => ({ id: `b${i}`, kind: 'tent', x: 0.5, y: 0.5 })),
      },
      pets: [miso],
      assets: [],
    });
    measureYard();
    renderDecor();
    const button = nodes.get('garden-layer').children.at(-1);
    await button.dispatch('keydown', { key: 'Delete', preventDefault() {} });
    assert.equal(nodes.get('toast').children.at(-1).dataset.words, t(key, { kind: t('decor.kind_xmas_tree') }));
  });
}

// Christmas decorations show from December 1 to January 7, a snowman only while the yard shows
// winter; the rest always. A hidden one keeps its place in the garden.
const { decorShown, hiddenKinds } = await import('../src/yard/decor-shown.js');
const { decorTarget, refreshShownDecor } = await import('../src/yard/decor.js');
const state = await import('../src/core/state.js');

function yard(ctx, now, season, decor) {
  ctx.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  const was = scene.season;
  scene.season = season;
  ctx.after(() => {
    scene.season = was;
  });
  const { nodes } = installDom(ctx, { anyId: true, ids: ['yard', 'garden-layer', 'toast'] });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
  setData({ garden: { decor: [], plants: [], trees: [] }, pets: [] });
  renderDecor();
  setData({ garden: { plants: [], trees: [], boxed: [], decor }, pets: [miso], assets: [] });
  measureYard();
  renderDecor();
  // remove() leaves a node in place, marked (support/dom.mjs).
  return () => nodes.get('garden-layer').children.filter(b => !b.removed);
}

test('a kind shows by its window and its season, and the rest always', () => {
  const d = (y, m, day) => new Date(y, m - 1, day, 12);
  assert.equal(decorShown('xmas_tree', d(2026, 11, 30), 'winter'), false);
  assert.equal(decorShown('xmas_tree', d(2026, 12, 1), 'summer'), true, 'whatever the season');
  assert.equal(decorShown('santa', d(2027, 1, 7), 'spring'), true);
  assert.equal(decorShown('santa', d(2027, 1, 8), 'winter'), false);
  assert.equal(decorShown('snowman', d(2026, 7, 1), 'winter'), true);
  assert.equal(decorShown('snowman', d(2026, 12, 24), 'autumn'), false);
  assert.equal(decorShown('bench', d(2026, 7, 1), 'summer'), true);
  assert.equal(decorShown('no-such-kind', d(2026, 7, 1), 'summer'), true);
  assert.deepEqual(hiddenKinds(d(2026, 7, 1), 'summer'), ['snowman', 'xmas_tree', 'baby_reindeer', 'santa']);
  assert.deepEqual(hiddenKinds(d(2026, 12, 5), 'winter'), []);
});

test('the yard draws only what shows now, and friends visit only that', ctx => {
  // The hidden ones come first and on the other side, so a visit to them would show.
  const buttons = yard(ctx, new Date(2026, 6, 1, 12).getTime(), 'summer', [
    { id: 'x', kind: 'xmas_tree', x: 0.9, y: 0.5 },
    { id: 's', kind: 'snowman', x: 0.9, y: 0.5 },
    { id: 'b', kind: 'bench', x: 0.1, y: 0.5 },
  ]);
  assert.equal(buttons().length, 1);
  assert.equal(buttons()[0].title, t('decor.title', { kind: t('decor.kind_bench') }));
  ctx.mock.method(Math, 'random', () => 0);
  for (let i = 0; i < 20; i++) {
    const v = { pet: { id: 'miso', size: 96 }, px: 380, py: 300 };
    const target = decorTarget(v);
    assert.ok(target && target.x < 0.5, `visit ${i} goes to the bench`);
  }
});

test('the yard shows the tree from December 1 and hides it on January 8 without a restart', ctx => {
  const buttons = yard(ctx, new Date(2026, 10, 30, 23, 59).getTime(), 'winter', [
    { id: 'tree', kind: 'xmas_tree', x: 0.5, y: 0.5 },
  ]);
  assert.equal(buttons().length, 0);
  ctx.mock.timers.tick(2 * 60_000);
  refreshShownDecor();
  assert.equal(buttons().length, 1);
  const [tree] = buttons();
  // A redraw would name it again.
  tree.title = 'untouched';
  refreshShownDecor();
  assert.deepEqual(buttons(), [tree]);
  assert.equal(tree.title, 'untouched', 'nothing changed, nothing redrawn');
  ctx.mock.timers.setTime(new Date(2027, 0, 8, 0, 1).getTime());
  refreshShownDecor();
  assert.equal(buttons().length, 0);
  assert.deepEqual(
    state.data.garden.decor.map(d => d.id),
    ['tree'],
    'it keeps its place',
  );
});

test('the yard tells the desktop which kinds are hidden, once per change', ctx => {
  hidden.length = 0;
  yard(ctx, new Date(2026, 6, 1, 12).getTime(), 'summer', [{ id: 'tree', kind: 'xmas_tree', x: 0.5, y: 0.5 }]);
  renderDecor();
  assert.deepEqual(hidden.at(-1), ['snowman', 'xmas_tree', 'baby_reindeer', 'santa']);
  const sent = hidden.length;
  renderDecor();
  assert.equal(hidden.length, sent, 'the same list is not sent twice');
  ctx.mock.timers.setTime(new Date(2026, 11, 5, 12).getTime());
  scene.season = 'winter';
  refreshShownDecor();
  assert.deepEqual(hidden.at(-1), []);
  assert.equal(hidden.length, sent + 1);
});
