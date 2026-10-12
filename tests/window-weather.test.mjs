import assert from 'node:assert/strict';
import test from 'node:test';
import { environmentFrame } from '../src/yard/environment.js';
import { createScenery } from '../src/yard/scenery.js';
import { useWorlds } from '../src/yard/worlds.js';
import { worlds as definitions } from './support/content.mjs';
import { keepGlobals } from './support/dom.mjs';

const panes = [
  { x: 0.244, y: 0.043, width: 0.115, height: 0.366 },
  { x: 0.389, y: 0.043, width: 0.248, height: 0.366 },
  { x: 0.664, y: 0.043, width: 0.118, height: 0.366 },
];
function yard(t, width, height, reduce = false) {
  useWorlds(
    definitions.map(world =>
      world.id === 'studio'
        ? {
            ...world,
            windowPanes: panes,
            capabilities: { ...world.capabilities, weather: true },
          }
        : world,
    ),
  );
  t.after(() => useWorlds(definitions));
  keepGlobals(t, 'window');
  globalThis.window = { devicePixelRatio: 1 };
  const log = { clips: [], draws: [], strokes: [], splashes: 0, paints: 0 },
    reduced = { matches: reduce };
  let path = [],
    clipped = null;
  const ctx = new Proxy(
    {
      clearRect() {
        log.paints++;
      },
      beginPath() {
        path = [];
      },
      rect(...rect) {
        path.push(rect);
      },
      clip() {
        clipped = path.map(rect => [...rect]);
        log.clips.push(clipped);
      },
      restore() {
        clipped = null;
      },
      stroke() {
        log.draws.push(clipped);
        log.strokes.push({ ink: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth });
      },
      fill() {
        log.draws.push(clipped);
      },
      ellipse() {
        log.splashes++;
      },
    },
    { get: (target, key) => target[key] || (() => {}) },
  );
  const scenery = createScenery({ getContext: () => ctx, getBoundingClientRect: () => ({ width, height }) }, reduced);
  scenery.set('day', 'clear', 'winter', null, 'studio');
  scenery.resize();
  return { scenery, reduced, log };
}

test('studio rain and snow are clipped to the transformed window panes in every light and aspect', t => {
  for (const reduce of [false, true])
    for (const [width, height] of [
      [1180, 780],
      [840, 660],
      [500, 350],
      [320, 350],
    ]) {
      const { scenery, log } = yard(t, width, height, reduce);
      const frame = environmentFrame(width, height, { world: 'studio' });
      const expected = panes
        .map(pane => {
          const x = Math.max(0, frame.x + pane.x * frame.width),
            y = Math.max(0, frame.y + pane.y * frame.height),
            right = Math.min(width, frame.x + (pane.x + pane.width) * frame.width),
            bottom = Math.min(height, frame.y + (pane.y + pane.height) * frame.height);
          return [x, y, right - x, bottom - y];
        })
        .filter(rect => rect[2] > 0 && rect[3] > 0);
      assert.ok(expected.length);
      for (const period of ['morning', 'day', 'evening', 'night'])
        for (const weather of ['rain', 'snow']) {
          log.clips.length = log.draws.length = 0;
          scenery.set(period, weather, 'winter', 'lights', 'studio');
          scenery.frame(30000, 30000);
          assert.deepEqual(log.clips[0], expected);
          assert.ok(log.draws.length, `${period} ${weather} paints precipitation`);
          assert.ok(
            log.draws.every(clip => clip && JSON.stringify(clip) === JSON.stringify(expected)),
            'every painted particle stays in the panes',
          );
          assert.equal(log.splashes, 0, 'the indoor floor never receives rain splashes');
          assert.equal(scenery.busy(), !reduce);
        }
    }
});

test('window rain contrasts with bright city glass at full and mini sizes without changing outdoor ink', t => {
  for (const [width, height] of [
    [1180, 780],
    [500, 350],
  ]) {
    const { scenery, log } = yard(t, width, height, true);
    scenery.set('day', 'rain', 'winter', null, 'studio');
    assert.ok(log.strokes.length);
    assert.ok(
      log.strokes.every(stroke => stroke.ink === 'rgb(70,97,123)' && stroke.alpha >= 0.4 && stroke.width >= 0.45),
    );
    log.strokes.length = 0;
    scenery.set('night', 'rain', 'winter', null, 'studio');
    assert.ok(log.strokes.every(stroke => stroke.ink === 'rgb(190,208,230)' && stroke.alpha >= 0.4));
    log.strokes.length = 0;
    scenery.set('day', 'rain', 'winter', null, 'woodland');
    assert.ok(log.strokes.every(stroke => stroke.ink === 'rgb(168,192,214)'));
  }
});

test('Woodland precipitation keeps its full canvas and outdoor ground splashes', t => {
  const { scenery, log } = yard(t, 840, 660);
  scenery.set('day', 'rain', 'winter', null, 'woodland');
  log.clips.length = log.draws.length = 0;
  scenery.frame(30000, 30000);
  assert.equal(log.clips.length, 0);
  assert.ok(log.draws.length);
  assert.ok(log.draws.every(clip => clip === null));
  assert.ok(log.splashes > 0);
  assert.equal(scenery.busy(), true);
});

test('reduced studio weather paints once while clear and offscreen panes remain idle', t => {
  const { scenery, reduced, log } = yard(t, 840, 660, true);
  for (const weather of ['rain', 'snow']) {
    scenery.set('night', weather, 'winter', null, 'studio');
    const before = log.paints;
    scenery.frame(100, 40);
    scenery.frame(200, 40);
    assert.equal(log.paints, before);
    assert.equal(scenery.busy(), false);
  }
  scenery.set('day', 'clear', 'winter', null, 'studio');
  const before = log.paints;
  scenery.frame(30000, 30000);
  assert.equal(log.paints, before);
  assert.equal(scenery.busy(), false);
  useWorlds(
    definitions.map(world =>
      world.id === 'studio'
        ? {
            ...world,
            windowPanes: [{ x: 2, y: 2, width: 0.1, height: 0.1 }],
            capabilities: { ...world.capabilities, weather: true },
          }
        : world,
    ),
  );
  reduced.matches = false;
  log.draws.length = 0;
  scenery.set('night', 'rain', 'winter', null, 'studio');
  assert.equal(log.draws.length, 0, 'offscreen panes do not paint precipitation even on a scene change');
  const hidden = log.paints;
  scenery.frame(40000, 30000);
  assert.equal(log.paints, hidden);
  assert.equal(log.draws.length, 0);
  assert.equal(scenery.busy(), false);
});
