// The faint blue trail behind a rolling snowball: soft stamps painted from one gradient sprite
// while any lives, fading over four seconds, left untouched otherwise (src/yard/snow-trail.js).
import assert from 'node:assert/strict';
import test from 'node:test';
import { reduced } from '../src/core/sprites.js';
import { element, installDom, keepGlobals } from './support/dom.mjs';

const { FADE_MS, TRAIL_ALPHA, TRAIL_MAX, TRAIL_RGB, fadeTrail, resizeTrail, setupSnowTrail, trailFrame, trailStamp } =
  await import('../src/yard/snow-trail.js');

// A context that records what the page asks of it; `calls` is the yard canvas's own list.
function fakeContext(calls, gradients) {
  const record =
    name =>
    (...args) =>
      calls.push([name, ...args]);
  const ctx = { _alpha: 1 };
  for (const name of ['clearRect', 'drawImage', 'setTransform', 'translate', 'scale', 'fillRect', 'save', 'restore'])
    ctx[name] = record(name);
  ctx.createRadialGradient = () => {
    const gradient = { stops: [], addColorStop: (at, color) => gradient.stops.push([at, color]) };
    gradients.push(gradient);
    return gradient;
  };
  Object.defineProperty(ctx, 'globalAlpha', {
    get: () => ctx._alpha,
    set(value) {
      ctx._alpha = value;
      calls.push(['globalAlpha', value]);
    },
  });
  return ctx;
}

function setup(t) {
  const calls = [],
    gradients = [],
    sprites = [];
  const { document, nodes } = installDom(t);
  keepGlobals(t, 'window');
  globalThis.window = { devicePixelRatio: 3 };
  const canvas = element('canvas', {
    hidden: true,
    rect: { width: 800, height: 500 },
    getContext: () => ctx,
  });
  const ctx = fakeContext(calls, gradients);
  nodes.set('trail-layer', canvas);
  document.createElement = tag => {
    const sprite = element(tag, { getContext: () => fakeContext([], gradients) });
    sprites.push(sprite);
    return sprite;
  };
  reduced.matches = false;
  t.after(() => {
    reduced.matches = false;
  });
  setupSnowTrail();
  return { canvas, calls, gradients, sprites };
}
const count = (calls, name) => calls.filter(c => c[0] === name).length;

test('a rolled path leaves soft stamps that fade out over four seconds', t => {
  const { canvas, calls, gradients } = setup(t);
  assert.equal(canvas.hidden, true);
  trailStamp(100, 300, 40, 0);
  assert.equal(canvas.hidden, false);
  trailStamp(105, 300, 40, 10);
  trailStamp(126, 300, 40, 20);
  // The yard's size times the density, at most twice.
  assert.deepEqual([canvas.width, canvas.height], [1600, 1000]);
  calls.length = 0;
  assert.equal(trailFrame(1000), true);
  assert.equal(count(calls, 'drawImage'), 2);
  assert.equal(calls.find(c => c[0] === 'globalAlpha')[1], 0.75);
  assert.deepEqual(gradients[0].stops[0], [0, `rgba(${TRAIL_RGB},${TRAIL_ALPHA})`]);
  assert.equal(gradients[0].stops[0][1], 'rgba(150,176,214,0.55)');
  assert.equal(gradients[0].stops.at(-1)[1], `rgba(${TRAIL_RGB},0)`);
  calls.length = 0;
  assert.equal(trailFrame(FADE_MS + 21), false);
  assert.equal(count(calls, 'clearRect'), 1);
  assert.equal(count(calls, 'drawImage'), 0);
  assert.equal(canvas.hidden, true);
  calls.length = 0;
  assert.equal(trailFrame(5000), false);
  assert.deepEqual(calls, []);
});

test('nothing is painted while nothing rolled', t => {
  const { calls } = setup(t);
  assert.equal(trailFrame(0), false);
  assert.deepEqual(calls, []);
});

test('with reduced motion no trail is left', t => {
  const { canvas, calls } = setup(t);
  reduced.matches = true;
  trailStamp(100, 300, 40, 0);
  assert.equal(trailFrame(10), false);
  assert.deepEqual(calls, []);
  assert.equal(canvas.hidden, true);
});

test('a long roll keeps at most 120 stamps', t => {
  const { calls } = setup(t);
  assert.equal(TRAIL_MAX, 120);
  for (let i = 0; i < 300; i++) trailStamp(20 * i, 300, 40, i);
  calls.length = 0;
  assert.equal(trailFrame(400), true);
  assert.equal(count(calls, 'drawImage'), 120);
});

test('one gradient sprite serves every frame', t => {
  const { gradients, sprites } = setup(t);
  trailStamp(100, 300, 20, 0);
  trailStamp(160, 300, 40, 10);
  for (let now = 50; now < 500; now += 50) trailFrame(now);
  assert.equal(gradients.length, 1);
  assert.equal(sprites.length, 1);
});

test('when a game ends the trail fades out and is cleared', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { canvas, calls } = setup(t);
  trailStamp(100, 300, 40, 0);
  trailFrame(10);
  fadeTrail();
  assert.equal(canvas.classList.contains('fading'), true);
  calls.length = 0;
  t.mock.timers.tick(600);
  assert.equal(canvas.classList.contains('fading'), false);
  assert.equal(canvas.hidden, true);
  assert.equal(count(calls, 'clearRect'), 1);
  assert.equal(trailFrame(20), false);
});

test('a resize clears the trail and the next stamp sizes the canvas again', t => {
  const { canvas, calls } = setup(t);
  trailStamp(100, 300, 40, 0);
  trailFrame(10);
  resizeTrail();
  assert.equal(canvas.hidden, true);
  assert.equal(trailFrame(20), false);
  canvas.getBoundingClientRect = () => ({ width: 400, height: 300 });
  trailStamp(100, 300, 40, 30);
  assert.deepEqual([canvas.width, canvas.height], [800, 600]);
  assert.equal(canvas.hidden, false);
  calls.length = 0;
  assert.equal(trailFrame(40), true);
});

test('a stamp while the trail fades starts a new roll and the old trail is dropped', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { canvas, calls } = setup(t);
  trailStamp(100, 300, 40, 0);
  trailFrame(10);
  fadeTrail();
  trailStamp(700, 300, 40, 50);
  t.mock.timers.tick(600);
  assert.equal(canvas.hidden, false);
  assert.equal(canvas.classList.contains('fading'), false);
  calls.length = 0;
  assert.equal(trailFrame(100), true);
  assert.equal(count(calls, 'drawImage'), 1);
});

test('ending the game twice clears once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls } = setup(t);
  trailStamp(100, 300, 40, 0);
  trailFrame(10);
  fadeTrail();
  fadeTrail();
  calls.length = 0;
  t.mock.timers.tick(600);
  assert.equal(count(calls, 'clearRect'), 1);
});
