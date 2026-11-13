// A window moved to a screen of another density (a Retina laptop and an external monitor) keeps its
// size, so no resize tells the yard; its canvases would stay at the old screen's pixels, blurred on
// the new one. A media query on the resolution does tell it.

import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { element, installDom, installStorage, keepGlobals } from './support/dom.mjs';

globalThis.playPets = { setScene: async () => ({ ok: true, data: null }) };

// matchMedia as a page has it: one query a call; `screen(ratio)` moves the window to another screen.
function screens(t) {
  keepGlobals(t, 'matchMedia', 'window');
  globalThis.window = { devicePixelRatio: 1 };
  const queries = [];
  globalThis.matchMedia = query => {
    const media = { query, matches: false, listeners: [] };
    media.addEventListener = (type, listener, options) => media.listeners.push({ type, listener, options });
    queries.push(media);
    return media;
  };
  const screen = ratio => {
    const was = queries.filter(q => q.query === `(resolution: ${window.devicePixelRatio}dppx)`);
    window.devicePixelRatio = ratio;
    for (const media of was) for (const { listener } of media.listeners.splice(0)) listener();
  };
  return { queries, screen };
}

test('a change of density is heard once, and then at the new density', async t => {
  const { queries, screen } = screens(t);
  const { onDensityChange } = await import('../src/core/dom.js');
  let heard = 0;
  onDensityChange(() => heard++);
  assert.deepEqual(
    queries.map(q => q.query),
    ['(resolution: 1dppx)'],
  );
  assert.equal(queries[0].listeners[0].options?.once, true, 'the query of the old density is left behind');
  screen(2);
  assert.equal(heard, 1);
  assert.equal(queries.at(-1).query, '(resolution: 2dppx)', 'and the new one listened to');
  screen(1.5);
  assert.equal(heard, 2);
});

test('the yard paints its sky, its weather and the snow trail again at the new density', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { screen } = screens(t);
  const anything = () => new Proxy(() => anything(), { get: (_, key) => (key === 'then' ? undefined : anything()) });
  // The yard's painted layers (.paint-sky, .paint-land), where the backdrop's canvases hang.
  const layer = element('div');
  const { nodes } = installDom(t, {
    anyId: true,
    props: {
      getContext: () => anything(),
      rect: { width: 800, height: 500 },
      clientWidth: 800,
      clientHeight: 500,
      querySelector: () => layer,
    },
  });
  const lookup = document.getElementById;
  document.getElementById = id => (id === 'season' ? null : lookup(id));
  installStorage(t);
  keepGlobals(t, 'ResizeObserver', 'Image', 'getComputedStyle', 'requestAnimationFrame');
  globalThis.requestAnimationFrame = () => 0;
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.Image = class {
    set src(_) {}
    decode() {
      return Promise.reject(new Error('no pictures here'));
    }
  };
  const painted = [];
  const create = document.createElement;
  document.createElement = tag => {
    const node = tag === 'canvas' ? element('canvas', { getContext: () => anything() }) : create(tag);
    if (tag === 'canvas') painted.push(node);
    return node;
  };
  const { setupSky } = await import('../src/yard/sky.js');
  const { setupSnowTrail, trailStamp } = await import('../src/yard/snow-trail.js');
  const world = await import('../src/yard/world.js');
  setupSky({});
  setupSnowTrail();
  // The yard sizes its weather once its own size is known (app.js, setupViews resized).
  world.scenery.resize();
  await new Promise(resolve => setImmediate(resolve));
  const weather = nodes.get('weather-layer'),
    trail = nodes.get('trail-layer');
  trailStamp(10, 10, 20, 0);
  assert.equal(weather.width, 800);
  assert.equal(trail.width, 800);
  const before = painted.length;
  screen(2);
  assert.equal(weather.width, 1600, 'the weather and the stars are sized for the new screen');
  assert.ok(painted.length > before, 'the backdrop is painted again');
  trailStamp(12, 10, 20, 50);
  assert.equal(trail.width, 1600, 'the snow trail measures again');
});
