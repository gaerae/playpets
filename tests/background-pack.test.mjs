import assert from 'node:assert/strict';
import test from 'node:test';
import { backgroundWorld, validateBackgroundPack } from '../src/yard/background-pack.js';

const header = Buffer.alloc(33);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
header.writeUInt32BE(13, 8);
header.write('IHDR', 12);
header.writeUInt32BE(1536, 16);
header.writeUInt32BE(1024, 20);
header[24] = 8;
header[25] = 6;
const png = `data:image/png;base64,${header.toString('base64')}`;
const pack = () => ({
  format: 'playpets-background',
  version: 1,
  name: 'Garden',
  images: { base: png },
  floor: 0.66,
  sky: true,
  weather: true,
  ambient: false,
  water: { from: 0.34, to: 0.79, center: 0.595, radius: 0.03 },
});
test('background packages keep only known data and enable only declared activities', () => {
  const p = validateBackgroundPack({ ...pack(), script: 'ignored' });
  assert.equal(p.script, undefined);
  const world = backgroundWorld(p, 'custom-test');
  assert.equal(world.capabilities.fishing, true);
  assert.equal(world.capabilities.seasonalEffects, false);
  assert.equal(world.eventLights, false);
});
test('untrusted images and invalid coordinates are rejected', () => {
  for (const images of [{ base: 'https://example.com/a.png' }, { base: 'data:image/svg+xml;base64,PHN2Zz4=' }, {}])
    assert.throws(() => validateBackgroundPack({ ...pack(), images }));
  for (const floor of [NaN, Infinity, -1, 0.95, '0.6'])
    assert.throws(() => validateBackgroundPack({ ...pack(), floor }));
  for (const water of [
    { from: 0.8, to: 0.2, center: 0.5, radius: 0.02 },
    { from: 0.3, to: 0.7, center: 0.65, radius: 0.1 },
  ])
    assert.throws(() => validateBackgroundPack({ ...pack(), water }));
  assert.throws(() => validateBackgroundPack({ ...pack(), version: 2 }));
});
test('indoor packs can omit sky and water and confine weather to windows', () => {
  const p = validateBackgroundPack({
    ...pack(),
    sky: false,
    water: null,
    windows: [{ x: 0.2, y: 0.1, width: 0.3, height: 0.3 }],
  });
  const w = backgroundWorld(p, 'custom-room');
  assert.equal(w.capabilities.sky, false);
  assert.equal(w.capabilities.fishing, false);
  assert.equal(w.windowPanes.length, 1);
  assert.throws(() =>
    validateBackgroundPack({ ...pack(), sky: false, windows: [{ x: 0.9, y: 0, width: 0.2, height: 0.3 }] }),
  );
});
test('all four seasonal layers are required before seasonal particles are enabled', () => {
  const p = pack();
  p.images.spring = png;
  assert.equal(backgroundWorld(validateBackgroundPack(p), 'custom').capabilities.seasonalEffects, false);
  for (const s of ['summer', 'autumn', 'winter']) p.images[s] = png;
  assert.equal(backgroundWorld(validateBackgroundPack(p), 'custom').capabilities.seasonalEffects, true);
});

test('custom seasonal selection and lighting use only validated package sources', async () => {
  const { useWorlds } = await import('../src/yard/worlds.js');
  const { environmentLook } = await import('../src/yard/environment.js');
  const p = pack();
  p.images.winter = png;
  useWorlds([backgroundWorld(validateBackgroundPack(p), 'custom-test')]);
  assert.equal(
    environmentLook({ world: 'custom-test', season: 'summer', weather: 'clear', period: 'day' }).art,
    'custom-test:base',
  );
  assert.equal(
    environmentLook({ world: 'custom-test', season: 'summer', weather: 'snow', period: 'night' }).art,
    'custom-test:winter',
  );
  assert.notEqual(
    environmentLook({ world: 'custom-test', season: 'summer', weather: 'clear', period: 'night' }).tint,
    null,
  );
});

test('each package preserves independent fishing water and standing coordinates', () => {
  const p = validateBackgroundPack({
    ...pack(),
    water: { from: 0.1, to: 0.3, center: 0.58, radius: 0.02 },
    fishingSpot: { x: 0.22, y: 0.74 },
  });
  const world = backgroundWorld(p, 'custom-left');
  assert.deepEqual(world.geometry.fishingSpot, { x: 0.22, y: 0.74 });
  assert.equal(world.geometry.lake.from, 0.1);
  assert.throws(() => validateBackgroundPack({ ...pack(), fishingSpot: { x: 0.4, y: 0.2 } }));
});

test('fishing stances follow the image transform and cropped stances fall back to the shore', async () => {
  const { useWorlds } = await import('../src/yard/worlds.js');
  const { environmentFrame, environmentFishingSpot } = await import('../src/yard/environment.js');
  const p = validateBackgroundPack({ ...pack(), fishingSpot: { x: 0.52, y: 0.74 } });
  useWorlds([backgroundWorld(p, 'custom-center')]);
  const scene = { world: 'custom-center' };
  for (const [w, h] of [
    [1200, 700],
    [420, 500],
  ]) {
    const frame = environmentFrame(w, h, scene);
    assert.deepEqual(environmentFishingSpot(w, h, scene), {
      x: frame.x + frame.width * 0.52,
      y: frame.y + frame.height * 0.74,
    });
  }
  useWorlds([backgroundWorld({ ...p, fishingSpot: { x: 0.02, y: 0.74 } }, 'custom-edge')]);
  assert.equal(environmentFishingSpot(420, 500, { world: 'custom-edge' }), null);
  useWorlds([backgroundWorld({ ...p, water: null, fishingSpot: null }, 'custom-room')]);
  assert.equal(environmentFishingSpot(1200, 700, { world: 'custom-room' }), null);
});

test('a background name cannot become empty after control characters are removed', () => {
  assert.throws(() => validateBackgroundPack({ ...pack(), name: String.fromCharCode(0, 1, 127) }));
});

test('imported backgrounds distinguish all four times of day', async () => {
  const { useWorlds } = await import('../src/yard/worlds.js');
  const { environmentLook } = await import('../src/yard/environment.js');
  useWorlds([backgroundWorld(validateBackgroundPack(pack()), 'custom-time')]);
  const looks = ['morning', 'day', 'evening', 'night'].map(period =>
    JSON.stringify(environmentLook({ world: 'custom-time', season: 'summer', weather: 'clear', period })),
  );
  assert.equal(new Set(looks).size, 4);
});

test('layout validation works before artwork exists and identifies the invalid region', async () => {
  const { validateBackgroundGeometry } = await import('../src/yard/background-pack.js');
  assert.equal(typeof validateBackgroundGeometry, 'function');
  assert.throws(
    () => validateBackgroundGeometry({ floor: 0.7, windows: [{ x: 0.26, y: 0.1, width: 0.8, height: 0.3 }] }),
    /windows/,
  );
  assert.throws(
    () => validateBackgroundGeometry({ floor: 0.7, water: { from: 0.8, to: 0.2, center: 0.5, radius: 0.03 } }),
    /water/,
  );
  assert.equal(validateBackgroundGeometry({ floor: 0.7 }).floor, 0.7);
});
