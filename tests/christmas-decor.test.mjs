// A Christmas gift put away goes back into the gift box while the box has room, as a memento does.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

globalThis.playPets = { moveDecor: async () => ({ ok: true, data: null }) };
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
