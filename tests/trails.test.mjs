// Faint footprint trails cross the winter yard and fade (src/yard/trails.js): drawn once as static
// marks, checked with the scene, remembered for the day in webview storage.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { installDom, installStorage } from './support/dom.mjs';

const { recall } = await import('../src/core/state.js');
const { TRACKS } = await import('../src/yard/catalog.js');
const { scene } = await import('../src/yard/world.js');
const { BLOCK_MS, trailAnimal } = await import('../src/yard/trail-rules.js');
const { TRAIL_RGB } = await import('../src/yard/snow-trail.js');
const { resizeTrails, setupTrails, trailsCheck } = await import('../src/yard/trails.js');

const ids = TRACKS.map(k => k.id);
const at = (d, h, min = 0) => new Date(2026, 11, d, h, min).getTime();
const blockOf = ms => Math.floor(ms / BLOCK_MS) * BLOCK_MS;
// Task 5's open profile: the whole field, a lake in the middle.
const OPEN = {
  soil: true,
  bounds: { left: 0, right: 1, top: 0, bottom: 1 },
  water: [{ x: 0.5, y: 0.5, rx: 0.15, ry: 0.1 }],
  obstacles: [],
};

function yard(t, { now = at(14, 9), profile = () => OPEN } = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  const dom = installDom(t, { ids: ['yard', 'garden-layer'] });
  installStorage(t);
  scene.season = 'winter';
  scene.world = 'woodland';
  let weatherAt = () => 'clear';
  setupTrails({
    profile,
    weather: ms => weatherAt(ms),
    toYard: p => ({ x: p.x * 600, y: p.y * 400 }),
    zoom: () => 1,
  });
  t.after(() => {
    scene.season = 'spring';
    scene.world = 'woodland';
  });
  const layer = dom.nodes.get('garden-layer');
  const live = selector => layer.querySelectorAll(selector).filter(n => !n.removed);
  return {
    ...dom,
    layer,
    live,
    trails: () => live('.trail'),
    weather: fn => {
      weatherAt = fn;
    },
    saved: () => JSON.parse(recall('trails')),
    goTo: ms => t.mock.timers.setTime(ms),
  };
}

test("a winter yard shows the day's trail and remembers when it was first seen", t => {
  const y = yard(t);
  trailsCheck();
  const [trail, ...more] = y.trails();
  assert.equal(more.length, 0);
  assert.equal(trail.dataset.trail, '0');
  assert.equal(trail.dataset.animal, trailAnimal('2026-12-14', 0, ids));
  assert.ok(trail.querySelectorAll('.print').length >= 10);
  assert.equal(y.live('.trail-end').length, 1);
  assert.deepEqual(y.saved(), { day: '2026-12-14', seen: at(14, 9), followed: [] });
  const children = y.layer.children.filter(n => !n.removed).length;
  trailsCheck();
  assert.equal(y.layer.children.filter(n => !n.removed).length, children);
  assert.equal(y.trails()[0], trail, 'the same node, not drawn again');
});

test('a snowy night adds a second trail from five in the morning', t => {
  const y = yard(t, { now: at(14, 4, 30) });
  const from = blockOf(at(14, 2));
  y.weather(ms => (ms >= from && ms < from + 3 * BLOCK_MS ? 'snow' : 'clear'));
  trailsCheck();
  assert.equal(y.trails().length, 1);
  y.goTo(at(14, 5));
  trailsCheck();
  const trails = y.trails();
  assert.equal(trails.length, 2);
  assert.notEqual(trails[0].dataset.animal, trails[1].dataset.animal);
  const ends = y.live('.trail-end').map(e => ({ x: parseFloat(e.style.left) / 600, y: parseFloat(e.style.top) / 400 }));
  assert.equal(ends.length, 2);
  assert.ok(Math.hypot(ends[0].x - ends[1].x, ends[0].y - ends[1].y) >= 0.15);
});

test('new snow covers a trail and it fades away', t => {
  const y = yard(t);
  const from = blockOf(at(14, 10, 20));
  y.weather(ms => (ms >= from && ms < from + 3 * BLOCK_MS ? 'snow' : 'clear'));
  trailsCheck();
  y.goTo(at(14, 11));
  trailsCheck();
  const [trail] = y.trails();
  assert.ok(trail.classList.contains('covered'));
  assert.ok(y.live('.trail-end')[0].classList.contains('covered'));
  t.mock.timers.tick(3000);
  assert.equal(y.trails().length, 0);
  assert.equal(y.live('.trail-end').length, 0);
  trailsCheck();
  assert.equal(y.trails().length, 0, 'a covered trail is not drawn again');
});

test('trails go when the yard stops showing winter and come back the same that day', t => {
  let profile = OPEN;
  const y = yard(t, { profile: () => profile });
  trailsCheck();
  const [first] = y.trails();
  const animal = first.dataset.animal,
    transform = first.querySelector('.print').getAttribute('transform'),
    { seen } = y.saved();
  scene.season = 'summer';
  y.goTo(at(14, 10));
  trailsCheck();
  assert.equal(y.trails().length, 0);
  assert.equal(y.live('.trail-end').length, 0);
  scene.season = 'winter';
  trailsCheck();
  const [again] = y.trails();
  assert.equal(again.dataset.animal, animal);
  assert.equal(again.querySelector('.print').getAttribute('transform'), transform);
  assert.equal(y.saved().seen, seen);
  scene.world = 'studio';
  trailsCheck();
  assert.equal(y.trails().length, 0, 'none in the cozy living room');
  scene.world = 'woodland';
  profile = { ...OPEN, soil: false };
  trailsCheck();
  assert.equal(y.trails().length, 0, 'none without ground');
});

test('a trail with no path draws nothing and does not throw', t => {
  // Water everywhere: no path can be found, but the yard has soil.
  const y = yard(t, { profile: () => ({ ...OPEN, water: [{ x: 0.5, y: 0.5, rx: 2, ry: 2 }] }) });
  assert.doesNotThrow(() => trailsCheck());
  assert.equal(y.trails().length, 0);
  assert.equal(y.live('.trail-end').length, 0);
});

test('the next day starts new trails', t => {
  const y = yard(t);
  trailsCheck();
  y.goTo(at(15, 0, 1));
  trailsCheck();
  assert.deepEqual(y.saved(), { day: '2026-12-15', seen: at(15, 0, 1), followed: [] });
  assert.equal(y.trails().length, 1);
  assert.equal(y.trails()[0].dataset.animal, trailAnimal('2026-12-15', 0, ids));
});

test('bad storage starts the day afresh', t => {
  const y = yard(t);
  localStorage.setItem('trails', '{not json');
  trailsCheck();
  assert.deepEqual(y.saved(), { day: '2026-12-14', seen: at(14, 9), followed: [] });
});

test('opacity is written only when it changes', t => {
  const y = yard(t);
  let writes = 0;
  const make = y.document.createElementNS;
  y.document.createElementNS = (ns, tag) => {
    const node = make(ns, tag),
      set = node.style.setProperty;
    node.style.setProperty = (name, value) => {
      if (name === '--trail-opacity') writes++;
      set.call(node.style, name, value);
    };
    return node;
  };
  for (let i = 0; i < 5; i++) {
    y.goTo(at(14, 9, i));
    trailsCheck();
  }
  assert.equal(writes, 1);
});

test("the prints are the snowman trail's shade by day, deeper at night", async () => {
  const css = await readFile('src/styles/garden.css', 'utf8');
  const day = css.match(/\.trail,\s*\.trail-end\s*\{[^}]*--snow-print:\s*([^;]+);/)?.[1].trim();
  assert.equal(day, `rgb(${TRAIL_RGB.split(',').join(' ')})`);
  const night = css.match(
    /\.period-night \.trail,\s*\.period-night \.trail-end\s*\{[^}]*--snow-print:\s*([^;]+);/,
  )?.[1];
  assert.ok(night && night.trim() !== day, 'night has its own, deeper shade');
});

test('a new size lays the trail out again, the same friend', t => {
  const y = yard(t);
  trailsCheck();
  const [before] = y.trails();
  resizeTrails();
  const [after] = y.trails();
  assert.notEqual(after, before);
  assert.ok(before.removed);
  assert.equal(after.dataset.animal, before.dataset.animal);
  assert.equal(y.live('.trail-end').length, 1);
});

test('no trail ends behind something standing on the snow', t => {
  const y = yard(t);
  trailsCheck();
  const end = y.live('.trail-end')[0],
    at = { x: parseFloat(end.style.left) / 600, y: parseFloat(end.style.top) / 400 };
  // A snowman's foot just in front of where the bush stood: its body would hide the bush.
  const foot = { x: at.x, y: at.y + 0.04, rx: 0.05, ry: 0.02 };
  setupTrails({
    profile: () => ({ ...OPEN, obstacles: [foot] }),
    weather: () => 'clear',
    toYard: p => ({ x: p.x * 600, y: p.y * 400 }),
    zoom: () => 1,
  });
  trailsCheck();
  const moved = y.live('.trail-end').at(-1),
    now = { x: parseFloat(moved.style.left) / 600, y: parseFloat(moved.style.top) / 400 };
  assert.ok(Math.abs(now.x - foot.x) > foot.rx || now.y > foot.y || now.y < foot.y - 6 * foot.ry);
});
