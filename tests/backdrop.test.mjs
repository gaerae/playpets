import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { paintLand } from '../src/yard/backdrop.js';
import { color, mix, seeded } from '../src/yard/brush.js';
import { paintSky } from '../src/yard/clouds.js';
import { lightFor, readPalette } from '../src/yard/palette.js';

test('colours are read as the stylesheet writes them, with their opacity', () => {
  assert.deepEqual(color('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(color('#4a9bd6'), [74, 155, 214, 1]);
  const clear = color('#a08c7426');
  assert.deepEqual(clear.slice(0, 3), [160, 140, 116]);
  assert.ok(Math.abs(clear[3] - 0x26 / 255) < 1e-9, 'an eight-digit colour keeps its opacity');
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

// A 2D context that accepts everything, counts what is filled and stroked, and keeps the order of
// the colours it was given.
function recorder() {
  const counts = { fill: 0, stroke: 0, fillRect: 0 },
    colours = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    { canvas: { width: 800, height: 400 } },
    {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => gradient;
        if (name in counts) return () => counts[name]++;
        return () => {};
      },
      set(target, name, value) {
        if (name === 'fillStyle' && typeof value === 'string') colours.push(value);
        target[name] = value;
        return true;
      },
    },
  );
  return { ctx, counts, colours };
}

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
        assert.ok(land.counts.fill > 150, `${season} ${weather} ${period}: the land is painted`);
        assert.ok(sky.counts.fillRect > 0);
        if (period !== 'day' || weather !== 'clear') continue;
        const again = recorder();
        paintLand(again.ctx, 800, 400, pal, { period, weather, season });
        assert.deepEqual(again.colours, land.colours, 'painted again, the same strokes in the same colours');
      }
});

test('every colour the painter reads is set in the stylesheet, and every scenery colour is read', async () => {
  const css = await readFile('src/styles/scenery.css', 'utf8'),
    painter = (
      await Promise.all(
        [
          ...['backdrop', 'clouds', 'lake', 'trees', 'palette'].map(f => `src/yard/${f}.js`),
          // The composition names colours too ("tone", gradient stops).
          'src/content/yard.json',
        ].map(f => readFile(f, 'utf8')),
      )
    ).join('\n'),
    art = (await readdir('src/art', { recursive: true })).filter(f => f.endsWith('.svg')).map(f => `src/art/${f}`),
    // The yard's own stylesheets (every one but scenery.css, which sets the colours).
    styles = (await readdir('src/styles'))
      .filter(f => f.endsWith('.css') && f !== 'scenery.css')
      .map(f => `src/styles/${f}`),
    others = (
      await Promise.all(['src/index.html', ...styles, 'src/yard/scene.js', ...art].map(f => readFile(f, 'utf8')))
    ).join('\n');
  const names = Object.keys(readPalette(() => ''));
  // Read by the painter: pal['name'] or pal.name (crown and maple fall back to leaf, cap to none).
  for (const name of names) {
    const read =
      painter.includes(`'${name}'`) || painter.includes(`"${name}"`) || new RegExp(`pal\\.${name}\\b`).test(painter);
    assert.ok(read, `the painter never uses ${name}`);
  }
  // Every custom property set on the yard in scenery.css is read: by the painter, or by var() in
  // the page's own shapes and styles.
  const set = new Set([...css.matchAll(/^\s*--([\w-]+):/gm)].map(m => m[1]));
  for (const prop of set) {
    const used = names.includes(prop) || css.includes(`var(--${prop}`) || others.includes(`var(--${prop}`);
    assert.ok(used, `--${prop} is set in scenery.css but nothing reads it`);
  }
});
