// A yard hidden for a while lets go of what it can paint again, and paints it before it shows
// (docs/standards/performance.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './support/content.mjs';
import { REST_MS, setupRest } from '../src/yard/rest.js';
import { createScenery } from '../src/yard/scenery.js';

// A page whose `hidden` the test sets, and hears `visibilitychange` as a browser sends it.
function page() {
  const listeners = [];
  const doc = {
    hidden: false,
    addEventListener: (type, listener) => type === 'visibilitychange' && listeners.push(listener),
    show(hidden) {
      doc.hidden = hidden;
      for (const listener of listeners) listener();
    },
  };
  return doc;
}

test('a yard hidden for a while rests once, and wakes in the same moment it is seen again', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = page(),
    calls = [];
  const rest = setupRest({ rest: () => calls.push('rest'), wake: () => calls.push('wake'), doc });
  doc.show(true);
  t.mock.timers.tick(REST_MS - 1);
  assert.deepEqual(calls, [], 'a moment away keeps everything');
  t.mock.timers.tick(1);
  assert.deepEqual(calls, ['rest']);
  assert.equal(rest.resting(), true);
  t.mock.timers.tick(REST_MS * 10);
  assert.deepEqual(calls, ['rest'], 'nothing more happens while it is hidden');
  doc.show(false);
  assert.deepEqual(calls, ['rest', 'wake'], 'woken before the page draws again');
  // Back and away again before the delay: nothing is let go.
  doc.show(true);
  t.mock.timers.tick(REST_MS / 2);
  doc.show(false);
  t.mock.timers.tick(REST_MS * 2);
  assert.deepEqual(calls, ['rest', 'wake']);
  // A second hidden event keeps the first one's time.
  doc.show(true);
  t.mock.timers.tick(REST_MS / 2);
  doc.show(true);
  t.mock.timers.tick(REST_MS / 2);
  assert.deepEqual(calls, ['rest', 'wake', 'rest']);
});

test('a page the browser never reports hidden keeps everything', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = page(),
    calls = [];
  const rest = setupRest({ rest: () => calls.push('rest'), wake: () => calls.push('wake'), doc });
  // The backend says the window was hidden, but the page can still be drawn: nothing is let go,
  // so nothing could show unpainted when it comes back.
  rest.check();
  t.mock.timers.tick(REST_MS * 3);
  assert.deepEqual(calls, []);
});

function scenery(t) {
  t.mock.method(Math, 'random', () => 0.5);
  t.mock.method(performance, 'now', () => 0);
  globalThis.window = { devicePixelRatio: 2 };
  const paints = { clears: 0, stars: 0 };
  const context = new Proxy(
    {
      clearRect() {
        paints.clears++;
      },
      arc() {
        paints.stars++;
      },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    { get: (object, key) => object[key] ?? (() => {}) },
  );
  const surface = () => ({ getContext: () => context, getBoundingClientRect: () => ({ width: 1000, height: 600 }) });
  const weather = surface(),
    stars = surface();
  const scene = createScenery(weather, { matches: true }, undefined, undefined, stars);
  scene.resize();
  return { scene, weather, stars, paints };
}

test('the weather and the stars let go of their canvases at rest and paint them again on waking', t => {
  const { scene, weather, stars, paints } = scenery(t);
  scene.set('night', 'clear', 'summer');
  assert.deepEqual([weather.width, weather.height, stars.width, stars.height], [2000, 1200, 2000, 1200]);
  const starsDrawn = paints.stars;
  scene.rest();
  assert.deepEqual([weather.width, weather.height, stars.width, stars.height], [0, 0, 0, 0]);
  // While at rest nothing makes them large again: not a new scene, not a resize.
  scene.set('night', 'rain', 'summer');
  scene.set('night', 'clear', 'summer');
  scene.resize();
  assert.deepEqual([weather.width, stars.width], [0, 0]);
  paints.clears = 0;
  paints.stars = 0;
  scene.wake();
  assert.deepEqual([weather.width, weather.height, stars.width, stars.height], [2000, 1200, 2000, 1200]);
  assert.ok(paints.clears >= 2, 'both are painted again at once');
  assert.ok(paints.stars > 0 && paints.stars <= starsDrawn, 'the same night sky');
  scene.wake();
  assert.equal(weather.width, 2000, 'waking twice is waking once');
});

test('the backdrop lets go of its paintings at rest, paints nothing then, and paints once on waking', async t => {
  const { createEasel } = await import('../src/yard/easel.js');
  const globals = ['Image', 'ResizeObserver', 'window', 'document', 'getComputedStyle', 'requestAnimationFrame'].map(
    key => [key, Object.getOwnPropertyDescriptor(globalThis, key)],
  );
  t.after(() => {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  globalThis.Image = class {
    decode() {
      return Promise.resolve();
    }
  };
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#aabbcc' });
  const ctx = new Proxy(
    { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) },
    { get: (object, key) => object[key] ?? (() => {}) },
  );
  let made = 0;
  globalThis.document = {
    createElement: () => {
      made++;
      return { getContext: () => ctx, classList: { add() {} }, remove() {}, setAttribute() {}, style: {} };
    },
  };
  // Each slot keeps what is hung on it, as the page does.
  const slot = () => {
    const hung = [];
    return {
      hung,
      querySelectorAll: () => [...hung],
      append(canvas) {
        hung.push(canvas);
        canvas.remove = () => hung.splice(hung.indexOf(canvas), 1);
      },
    };
  };
  const sky = slot(),
    land = slot(),
    cloud = { clientWidth: 300, clientHeight: 150, width: 600, height: 300, getContext: () => ctx };
  const yard = {
    clientWidth: 800,
    clientHeight: 560,
    dataset: {},
    querySelector: selector => (selector === '.paint-sky' ? sky : selector === '.paint-land' ? land : slot()),
    querySelectorAll: selector => (selector.includes('cloud') ? [cloud] : []),
  };
  const easel = createEasel(yard, { matches: true });
  const scene = { world: 'woodland', period: 'day', weather: 'clear', season: 'summer' };
  easel.set(scene);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sky.hung.length, 1);
  assert.equal(land.hung.length, 1);
  assert.ok(land.hung[0].width > 0);
  easel.rest();
  assert.deepEqual([sky.hung[0].width, land.hung[0].width, land.hung[0].height, cloud.width], [0, 0, 0, 0]);
  made = 0;
  easel.set({ ...scene, period: 'evening' });
  easel.repaint();
  assert.equal(made, 0, 'nothing is painted while the yard rests');
  easel.wake();
  assert.equal(made, 2, 'the sky and the land, once');
  assert.deepEqual([sky.hung.length, land.hung.length], [1, 1], 'what was let go is taken down');
  assert.ok(land.hung[0].width > 0 && cloud.width > 0);
  easel.wake();
  assert.equal(made, 2, 'waking twice paints once');
});

test('a resting yard is taken out of rendering, and the app wires the rest', () => {
  const css = readFileSync('src/styles/base.css', 'utf8');
  assert.match(css, /:root\[data-resting\] #yard\s*\{\s*content-visibility: hidden;/);
  const app = readFileSync('src/app.js', 'utf8');
  assert.match(app, /setupRest\(/);
});
