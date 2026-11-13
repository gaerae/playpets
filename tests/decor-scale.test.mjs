import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { data, setData } from '../src/core/state.js';
import { giftKind } from '../src/yard/catalog.js';
import { renderDecor } from '../src/yard/decor.js';
import { depthScale, fieldToYard, footTarget, measureYard, sizeOf } from '../src/yard/field.js';
import { installDom, keepGlobals } from './support/dom.mjs';

test('furniture fits friends and keeps the same proportions at every display density', t => {
  keepGlobals(t, 'window');
  const before = data;
  t.after(() => setData(before));
  const { nodes } = installDom(t, { ids: ['yard', 'garden-layer'] });
  let width = 1180,
    height = 780;
  nodes.get('yard').getBoundingClientRect = () => ({ width, height });
  setData({
    ...before,
    garden: {
      decor: ['bench', 'swing', 'tent', 'picnic'].map((kind, i) => ({ id: `scale-${i}`, kind, x: 0.5, y: 0.5 })),
    },
  });
  for (const density of [1, 1.25, 1.5, 2]) {
    globalThis.window = { devicePixelRatio: density };
    for (const bounds of [
      [1180, 780],
      [460, 320],
      [300, 210],
    ]) {
      [width, height] = bounds;
      measureYard();
      renderDecor();
      const props = nodes.get('garden-layer').children;
      // A friend standing where they stand, drawn as much smaller as they are for the depth.
      const at = fieldToYard({ x: 0.5, y: 0.5 }),
        friend = sizeOf({ size: 112 }) * depthScale(footTarget({ pet: { size: 112 } }, at.x, at.y, 0).y);
      assert.ok(parseFloat(props[0].style.width) >= friend * 1.3, 'a bench has room for a friend');
      assert.ok(parseFloat(props[1].style.height) >= friend, 'a swing frame is taller than a friend');
      assert.ok(parseFloat(props[2].style.height) >= friend, 'a tent is shelter-sized');
      assert.ok(parseFloat(props[3].style.width) >= friend * 1.2, 'a shared picnic is wider than a friend');
      for (const edge of [0, 1]) {
        for (const prop of data.garden.decor) prop.x = edge;
        renderDecor();
        for (const prop of props) {
          const left = Number(prop.style.transform.match(/translate\(([-\d.]+)px/)[1]);
          assert.ok(left >= 0, 'furniture stays inside the left edge');
          assert.ok(left + parseFloat(prop.style.width) <= width, 'furniture stays inside the right edge');
        }
      }
    }
  }
});

// A gift drawn without ground of its own stands on a contact shade (catalog "shade"), drawn under
// the drawing (first in its button), so it does not hover over the grass or the snow. Furniture on
// spread feet has a small dark shade under each foot inside a wide soft one.
test('a gift whose drawing has no ground stands on a shade, under its drawing', t => {
  const before = data;
  t.after(() => setData(before));
  const { nodes } = installDom(t, { ids: ['yard', 'garden-layer'] });
  nodes.get('yard').getBoundingClientRect = () => ({ width: 1180, height: 780 });
  setData({
    ...before,
    garden: {
      decor: ['lantern', 'pond', 'kite', 'bench'].map((kind, i) => ({
        id: `shade-${i}`,
        kind,
        x: 0.2 + i * 0.2,
        y: 0.5,
      })),
    },
  });
  measureYard();
  renderDecor();
  const [lantern, pond, kite, bench] = nodes.get('garden-layer').children;
  const [shade] = lantern.children;
  assert.equal(shade?.className, 'decor-shade', 'a lantern stands on a shade');
  const [w, h, y] = giftKind('lantern').shade;
  assert.deepEqual(
    [shade.style['--shade-w'], shade.style['--shade-h'], shade.style['--shade-y']],
    [w, h, y].map(String),
  );
  assert.equal(shade.style['--shade-x'], undefined, 'a lantern stands in the middle of its box');
  assert.ok(!pond.children.some(c => c.className.startsWith('decor-shade')), 'a pond is ground already');
  // The kite's stand is at the left of its drawing, and its shade with it.
  assert.equal(kite.children[0].style['--shade-x'], String(giftKind('kite').shade[3]));
  // A bench: the wide shade, then one small one under each of its feet, all under the drawing.
  const [wide, ...feet] = bench.children;
  assert.equal(wide.className, 'decor-shade wide');
  assert.deepEqual(
    feet.map(f => [f.className, f.style['--foot-x'], f.style['--foot-y'], f.style['--foot-w']]),
    giftKind('bench').feet.map(([x, y, w]) => ['decor-foot', String(x), String(y), String(w)]),
  );
});

// A lit gift's light falls on the ground too: a warm pool at its foot, under the drawing, beside
// the halo around the light itself.
test('a lit gift pools its light on the ground at its foot', async () => {
  const { effectLayers } = await import('../src/yard/effects.js');
  const layers = effectLayers(['glow']);
  assert.match(layers, /class="fx-glow"/);
  assert.match(layers, /class="fx-pool"/);
  assert.equal(effectLayers([]), '');
});
