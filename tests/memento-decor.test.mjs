// A friend's memento in the yard: marked and named as its own, and put back in the gift box when
// put away while the box has room.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { installDom } from './support/dom.mjs';

globalThis.playPets = { moveDecor: async () => ({ ok: true, data: null }) };
const { setData } = await import('../src/core/state.js');
const { t } = await import('../src/core/i18n.js');
const { renderDecor } = await import('../src/yard/decor.js');
const { measureYard } = await import('../src/yard/field.js');

const miso = { id: 'miso', name: 'Miso' };
function yard(ctx, garden) {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const { nodes } = installDom(ctx, { anyId: true, ids: ['yard', 'garden-layer', 'toast'] });
  nodes.get('yard').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 560 });
  setData({ garden: { decor: [], plants: [], trees: [] }, pets: [] });
  renderDecor();
  setData({ garden: { plants: [], trees: [], boxed: [], ...garden }, pets: [miso], assets: [] });
  measureYard();
  renderDecor();
  const buttons = nodes.get('garden-layer').children;
  return { nodes, buttons: buttons.slice(-garden.decor.length) };
}

test("a memento is marked and named as its friend's, and an old one of a friend gone as a gift", ctx => {
  const { buttons } = yard(ctx, {
    decor: [
      { id: 'm', kind: 'bench', x: 0.3, y: 0.5, from: 'miso', memento: true },
      { id: 'g', kind: 'tent', x: 0.6, y: 0.5, from: 'miso' },
      { id: 'gone', kind: 'swing', x: 0.8, y: 0.5, from: 'left', memento: true },
    ],
  });
  const [memento, gift, gone] = buttons;
  assert.ok(memento.classList.contains('memento'));
  assert.equal(memento.title, t('decor.memento_title', { name: 'Miso', kind: t('decor.kind_bench') }));
  assert.equal(memento.getAttribute('aria-label'), memento.title);
  assert.ok(!gift.classList.contains('memento'));
  assert.equal(gift.title, t('decor.title', { kind: t('decor.kind_tent') }));
  assert.ok(gone.classList.contains('memento'), 'still a memento');
  assert.equal(gone.title, t('decor.title', { kind: t('decor.kind_swing') }), 'named by its kind alone');
});

for (const [boxed, key] of [
  [0, 'decor.memento_put_away'],
  [12, 'decor.put_away_done'],
]) {
  test(`a memento put away with ${boxed} in the box says ${key}`, async ctx => {
    const { nodes, buttons } = yard(ctx, {
      // Its own id: one put away a moment ago waits out its Undo (props.js).
      decor: [{ id: `m${boxed}`, kind: 'bench', x: 0.3, y: 0.5, from: 'miso', memento: true }],
      boxed: Array.from({ length: boxed }, (_, i) => ({ id: `b${i}`, kind: 'tent', x: 0.5, y: 0.5 })),
    });
    await buttons[0].dispatch('keydown', { key: 'Delete', preventDefault() {} });
    assert.equal(nodes.get('toast').children.at(-1).dataset.words, t(key, { kind: t('decor.kind_bench') }));
  });
}
