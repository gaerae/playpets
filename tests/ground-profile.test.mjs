import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { data, setData } from '../src/core/state.js';
import { groundAllows, projectFootprint } from '../src/yard/discovery-rules.js';
import { environmentLake } from '../src/yard/environment.js';
import { field, measureYard } from '../src/yard/field.js';
import { buildGroundProfile, groundProfile } from '../src/yard/ground.js';
import { scene } from '../src/yard/world.js';
import { worldFor } from '../src/yard/worlds.js';
import { installDom } from './support/dom.mjs';

const bounds = { width: 1000, height: 700, top: 350, bottom: 650 };
const base = options =>
  buildGroundProfile({
    world: { id: 'meadow', capabilities: { sky: true } },
    bounds,
    garden: {},
    scale: 1,
    giftDimensions: () => ({ w: 100, h: 100 }),
    ...options,
  });

test('soil respects explicit capabilities and conservatively excludes indoor floors', () => {
  assert.equal(base().soil, true);
  assert.equal(base({ world: { capabilities: { sky: false } } }).soil, false);
  assert.equal(base({ world: { capabilities: { sky: true, soil: false } } }).soil, false);
  assert.equal(base({ world: { capabilities: { sky: false, soil: true } } }).soil, true);
  assert.equal(base({ bounds: { ...bounds, bottom: bounds.top } }).soil, false);
});

test('lake projection keeps cropped off-field centres and matches the visible water ellipse', () => {
  for (const [width, height] of [
    [1000, 700],
    [420, 700],
    [1400, 360],
  ]) {
    const current = { world: 'woodland' };
    const lake = environmentLake(width, height, current);
    const centerX = (lake.x0 + lake.x1) / 2;
    const centerY = (lake.shoreAt(centerX) + lake.ridgeAt(centerX)) / 2;
    const currentBounds = { width, height, top: centerY, bottom: height - 40 };
    const profile = base({ bounds: currentBounds, lake });
    assert.equal(profile.water.length, 1);
    const expected = projectFootprint(
      { x: centerX, y: centerY, rx: (lake.x1 - lake.x0) / 2, ry: lake.ridgeAt(centerX) - centerY },
      currentBounds,
    );
    assert.deepEqual(profile.water[0], expected);
    assert.equal(groundAllows({ x: expected.x, y: expected.y + expected.ry * 0.5 }, profile), false);
  }
  const lake = { x0: 300, x1: 700, shoreAt: () => 330, ridgeAt: () => 360 };
  const profile = base({ lake });
  assert.ok(profile.water[0].y < 0, 'water can cross the field edge from an off-field centre');
  assert.equal(groundAllows({ x: 0.5, y: 0 }, profile), false);
  assert.equal(base({ lake: { x0: 300, x1: 700, shoreAt: () => 100, ridgeAt: () => 200 } }).water.length, 0);
});

test('decor roots follow edge-clamped rendered placement and flat props occupy their floor area', () => {
  const profile = base({
    garden: {
      decor: [
        { kind: 'bench', x: 0, y: 0.5 },
        { kind: 'picnic', x: 0.8, y: 0.8 },
      ],
    },
  });
  const expectedX = (54 - 14) / (bounds.width - 28);
  assert.equal(profile.obstacles[0].x, expectedX);
  assert.equal(profile.obstacles[0].y, 0.5);
  assert.equal(groundAllows(profile.obstacles[0], profile), false);
  assert.ok(profile.obstacles[1].y < 0.8, 'blanket footprint extends back from its front foot');
});

test('decor roots stand on the deeper gift field, so a gift at its foot keeps the ground below the friends free', () => {
  // The gift field reaches 30px further down than the friends' field (300px tall).
  const profile = base({ decorBottom: bounds.bottom + 30, garden: { decor: [{ kind: 'bench', x: 0.5, y: 0.5 }] } });
  assert.equal(profile.obstacles[0].y, (0.5 * 330) / 300);
  const low = base({ decorBottom: bounds.bottom + 300, garden: { decor: [{ kind: 'bench', x: 0.5, y: 1 }] } });
  assert.equal(low.obstacles.length, 0, "a gift below the friends' field takes no root from them");
});

test('flower and tree roots exclude only current-world trees and skip the tree being moved', () => {
  const garden = {
    plants: [{ x: 0.2, y: 0.7, kind: 'tulip' }],
    trees: [
      { id: 'here', world: 'meadow', kind: 'cherry', x: 0.5, y: 0.5 },
      { id: 'moving', world: 'meadow', kind: 'pine', x: 0.7, y: 0.5 },
      { id: 'away', world: 'studio', kind: 'maple', x: 0.9, y: 0.5 },
    ],
  };
  const profile = base({ garden, skipTreeId: 'moving' });
  assert.equal(profile.obstacles.length, 2);
  assert.equal(groundAllows({ x: 0.5, y: 0.5 }, profile), false);
  assert.equal(groundAllows({ x: 0.2, y: 0.7 }, profile), false);
  assert.equal(groundAllows({ x: 0.7, y: 0.5 }, profile), true);
  assert.equal(groundAllows({ x: 0.9, y: 0.5 }, profile), true);
});

test('snapshots contain at most 64 valid intersecting ellipses', () => {
  const plants = Array.from({ length: 100 }, () => ({ x: 0.5, y: 0.5 }));
  plants.unshift({ x: NaN, y: 0.5 }, { x: 100, y: 100 });
  const profile = base({ garden: { plants } });
  assert.equal(profile.obstacles.length, 64);
  for (const e of [...profile.water, ...profile.obstacles]) {
    assert.ok([e.x, e.y, e.rx, e.ry].every(Number.isFinite));
    assert.ok(e.x >= -4 && e.x <= 4 && e.y >= -4 && e.y <= 4 && e.rx > 0 && e.rx <= 4 && e.ry > 0 && e.ry <= 4);
  }
});

test('live snapshot reads the measured field, current world and saved garden', t => {
  const before = data,
    oldScene = { ...scene };
  t.after(() => {
    setData(before);
    Object.assign(scene, oldScene);
  });
  const { nodes } = installDom(t, { ids: ['yard'] });
  nodes.get('yard').getBoundingClientRect = () => ({ width: 1000, height: 700 });
  measureYard();
  scene.world = 'studio';
  assert.equal(groundProfile().soil, false);
  scene.world = 'woodland';
  setData({ ...before, garden: { plants: [{ x: 0.2, y: 0.8 }] } });
  const live = groundProfile();
  assert.equal(live.soil, true);
  assert.deepEqual(live.bounds, { left: 0, top: 0, right: 1, bottom: 1 });
  assert.equal(groundAllows({ x: 0.2, y: 0.8 }, live), false);
  assert.ok(worldFor(scene.world));
  assert.ok(field().height > 0);
});
