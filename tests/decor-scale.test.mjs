import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { data, setData } from '../src/core/state.js';
import { renderDecor } from '../src/yard/decor.js';
import { measureYard, sizeOf } from '../src/yard/field.js';
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
      const friend = sizeOf({ size: 112 });
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
