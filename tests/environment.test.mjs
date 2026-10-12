import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { environmentLake, environmentLook } from '../src/yard/environment.js';

test('every seasonal layer ships at matching dimensions with real alpha', async () => {
  for (const name of ['spring', 'green', 'autumn', 'winter']) {
    const png = await readFile(new URL(`../src/art/environments/${name}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 1536);
    assert.equal(png.readUInt32BE(20), 1024);
    assert.equal(png[25], 6);
  }
});

test('environment art follows the season and snow covers even an out-of-season yard', () => {
  assert.equal(environmentLook({ season: 'spring', weather: 'clear', period: 'day' }).art, 'spring');
  assert.equal(environmentLook({ season: 'summer', weather: 'rain', period: 'day' }).art, 'green');
  assert.equal(environmentLook({ season: 'autumn', weather: 'clear', period: 'day' }).art, 'autumn');
  assert.equal(environmentLook({ season: 'winter', weather: 'clear', period: 'day' }).art, 'winter');
  assert.equal(environmentLook({ season: 'spring', weather: 'snow', period: 'day' }).art, 'winter');
});

test('the image has distinct readable lighting for night and overcast weather', () => {
  const look = (period, weather = 'clear') => environmentLook({ season: 'summer', weather, period });
  assert.equal(look('day').filter, 'none');
  assert.notEqual(look('night').filter, look('day').filter);
  assert.notEqual(look('morning').tint, look('evening').tint);
  assert.notEqual(look('day', 'rain').filter, look('day').filter);
});

test('fishing targets stay inside the generated pond at wide and narrow sizes', () => {
  for (const [w, h] of [
    [1200, 700],
    [420, 500],
  ]) {
    const pond = environmentLake(w, h);
    assert.ok(pond.onWater(w * 0.56, h * 0.595));
    assert.ok(!pond.onWater(w * 0.56, h * 0.635), 'the near shoreline is not water');
    assert.ok(!pond.onWater(w * 0.54, h * 0.54), 'grass above the pond is not water');
    assert.ok(!pond.onWater(w * 0.54, h * 0.7), 'grass below the pond is not water');
    assert.ok(!pond.onWater(w * 0.2, h * 0.62));
    for (const fraction of [0.4, 0.5, 0.6]) {
      const x = w * fraction;
      assert.ok(pond.onWater(x, (pond.shoreAt(x) + pond.ridgeAt(x)) / 2));
    }
  }
});

test('wide and portrait environments preserve image proportions and keep the floor anchored', async () => {
  const { environmentFrame } = await import('../src/yard/environment.js');
  const { useWorlds, worldFor } = await import('../src/yard/worlds.js');
  useWorlds(JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url))));
  for (const world of ['woodland', 'studio']) {
    const floor = worldFor(world).geometry.fieldTop;
    for (const [w, h] of [
      [1200, 260],
      [520, 650],
      [320, 240],
      [500, 350],
      [1180, 780],
    ]) {
      const frame = environmentFrame(w, h, { world });
      assert.ok(Math.abs(frame.width / frame.height - 1.5) < 1e-10, `${world}: no stretching`);
      assert.ok(frame.x <= 0 && frame.y <= 0 && frame.x + frame.width >= w && frame.y + frame.height >= h);
      assert.ok(Math.abs(frame.y + frame.height * floor - h * floor) < 1e-8, `${world}: floor stays aligned`);
    }
  }
});

test('pond hit testing follows the same crop as the source image', async () => {
  const { environmentFrame } = await import('../src/yard/environment.js');
  for (const [w, h] of [
    [1200, 260],
    [520, 650],
    [320, 240],
  ]) {
    const frame = environmentFrame(w, h, { world: 'woodland' });
    const pond = environmentLake(w, h, { world: 'woodland' });
    const point = (x, y) => [frame.x + frame.width * x, frame.y + frame.height * y];
    assert.ok(pond.onWater(...point(0.56, 0.595)), 'visible central pond remains catchable');
    assert.ok(!pond.onWater(...point(0.56, 0.635)), 'transformed grass remains outside hit area');
    assert.ok(!pond.onWater(...point(0.2, 0.595)), 'side land remains outside hit area');
  }
});

test('automatic fishing endpoints remain on screen when portrait crops the pond sides', () => {
  const pond = environmentLake(520, 650, { world: 'woodland' });
  assert.ok(pond.ends[0] >= 0 && pond.ends[1] <= 520);
  assert.equal(pond.onWater(540, 385), false);
});

test('painting uses the same floor crop returned to fishing geometry', async () => {
  const { environmentFrame, paintEnvironment } = await import('../src/yard/environment.js');
  let drawn;
  const ctx = {
    save() {},
    restore() {},
    drawImage(...args) {
      drawn = args;
    },
  };
  const image = { width: 1536, height: 1024 };
  const scene = { world: 'woodland', season: 'summer', weather: 'clear', period: 'day' };
  const frame = environmentFrame(1200, 260, scene);
  paintEnvironment(ctx, image, 1200, 260, scene);
  assert.deepEqual(drawn, [image, frame.x, frame.y, frame.width, frame.height]);
});

test('legacy cover-bottom metadata retains its bottom edge anchor', async () => {
  const { environmentFrame } = await import('../src/yard/environment.js');
  const { useWorlds } = await import('../src/yard/worlds.js');
  const definitions = JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url)));
  try {
    useWorlds([...definitions, { id: 'legacy', fit: 'cover-bottom', geometry: { fieldTop: 0.55 } }]);
    const frame = environmentFrame(1200, 260, { world: 'legacy' });
    assert.equal(frame.y + frame.height, 260);
  } finally {
    useWorlds(definitions);
  }
});

test('woodland walking floor stays below the visible pond shoreline in a wide strip', async () => {
  const definitions = JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url)));
  const woodland = definitions.find(world => world.id === 'woodland');
  assert.ok(woodland.geometry.fieldTop >= 0.65, 'the source pond reaches about 65% of its image height');
});
