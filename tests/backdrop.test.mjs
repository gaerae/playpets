import assert from 'node:assert/strict';
import test from 'node:test';
import { lightFor, paintLand, paintSky, readPalette } from '../src/yard/backdrop.js';
import { color, deform, ellipse, mix, seeded } from '../src/yard/brush.js';

test('colours are read as the stylesheet writes them, with their opacity', () => {
  assert.deepEqual(color('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(color('#4a9bd6'), [74, 155, 214, 1]);
  const clear = color('#a08c7426');
  assert.deepEqual(clear.slice(0, 3), [160, 140, 116]);
  assert.ok(Math.abs(clear[3] - 0x26 / 255) < 1e-9, "a winter crown's colour is nearly clear");
  assert.deepEqual(color('rgba(1, 2, 3, 0.5)'), [1, 2, 3, 0.5]);
  assert.deepEqual(color(''), [0, 0, 0, 0], 'nothing set paints nothing');
  assert.deepEqual(mix([0, 0, 0, 1], [100, 200, 50, 1], 0.5), [50, 100, 25, 1]);
});

test('the same seed paints the same strokes', () => {
  const a = seeded(7),
    b = seeded(7);
  assert.deepEqual(
    Array.from({ length: 5 }, () => a()),
    Array.from({ length: 5 }, () => b()),
  );
  const shape = deform(ellipse(0, 0, 10, 10, 8), seeded(3), 3, 0.3);
  assert.equal(shape.length, 8 * 2 ** 3, 'every edge is broken in two at each step');
  assert.deepEqual(shape, deform(ellipse(0, 0, 10, 10, 8), seeded(3), 3, 0.3));
});

test("a round tree's crown is the bushes' green unless the season gives it its own", () => {
  const sheet = { leaf: '#6fb265', 'leaf-hi': '#9fd07f', 'leaf-lo': '#4f9556', crown: '', maple: '#d65a3a' };
  const pal = readPalette(name => sheet[name] || '');
  assert.deepEqual(pal.crown, color('#6fb265'));
  assert.deepEqual(pal['crown-hi'], color('#9fd07f'));
  assert.deepEqual(pal.maple, color('#d65a3a'));
  assert.deepEqual(pal.cap, [0, 0, 0, 0], 'no snow, no snow caps');
});

test('the sun lights from the left in the morning and the right in the evening, weakly in rain', () => {
  assert.ok(lightFor('morning', 'clear').side < 0 && lightFor('evening', 'clear').side > 0);
  assert.ok(lightFor('day', 'rain').strength < lightFor('day', 'clear').strength);
});

// A 2D context that accepts everything and counts what is filled and stroked.
function recorder() {
  const counts = { fill: 0, stroke: 0, fillRect: 0 };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    { canvas: { width: 800, height: 400 } },
    {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => gradient;
        if (name === 'createPattern') return () => ({});
        if (name === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (name === 'getContext') return () => ctx;
        if (name in counts) return () => counts[name]++;
        return () => {};
      },
      set(target, name, value) {
        target[name] = value;
        return true;
      },
    },
  );
  return { ctx, counts };
}
globalThis.OffscreenCanvas ??= class {
  getContext() {
    return recorder().ctx;
  }
};

const sheet = {
  'sky-a': '#74b6e6',
  'sky-m': '#b0daf2',
  'sky-b': '#eef6ef',
  'mount-a': '#a9c7d2',
  'mount-b': '#c5dae2',
  far: '#b1d48f',
  'far-hi': '#cbe5a9',
  back: '#95c86b',
  'back-hi': '#b5db88',
  front: '#80b85c',
  'front-hi': '#a0cf78',
  rim: '#ffffff55',
  path: '#ecdcae',
  cloud: '#ffffff',
  'cloud-shade': '#dfeaf3',
  leaf: '#6fb265',
  'leaf-hi': '#9fd07f',
  'leaf-lo': '#4f9556',
  pine: '#4f9467',
  'pine-lo': '#3c7a57',
  trunk: '#9a6f4c',
  'trunk-lo': '#7c563a',
  blade: '#5fa25a',
  rock: '#b3b8b4',
  'rock-hi': '#d3d7d2',
  'flower-a': '#f48fa6',
  'flower-b': '#fdfdf6',
  'flower-c': '#f6c445',
  shadow: '#1d3a2222',
  cap: 'transparent',
};

test('every time of day, weather and season paints, and comes out the same each time', () => {
  const pal = readPalette(name => sheet[name] || '');
  for (const season of ['spring', 'summer', 'autumn', 'winter'])
    for (const weather of ['clear', 'rain', 'snow'])
      for (const period of ['morning', 'day', 'evening', 'night']) {
        const land = recorder(),
          sky = recorder();
        paintLand(land.ctx, 800, 400, pal, { period, weather, season });
        paintSky(sky.ctx, 800, 400, pal, { period, weather, season });
        assert.ok(land.counts.fill > 500, `${season} ${weather} ${period}: the land is painted`);
        assert.ok(sky.counts.fillRect > 0);
        if (period !== 'day' || weather !== 'clear') continue;
        const again = recorder();
        paintLand(again.ctx, 800, 400, pal, { period, weather, season });
        assert.deepEqual(again.counts, land.counts, 'painted again, the same strokes');
      }
});
