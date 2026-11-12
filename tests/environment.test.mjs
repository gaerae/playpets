import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { environmentLake, environmentLook } from '../src/yard/environment.js';

test('every seasonal layer ships at matching dimensions with real alpha', async () => {
  for (const name of ['spring', 'green', 'autumn', 'winter']) {
    const png = await readFile(new URL(`../assets/art/environments/${name}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 1536);
    assert.equal(png.readUInt32BE(20), 1024);
    assert.equal(png[25], 6);
  }
});

test('environment art follows the selected season independently of precipitation', () => {
  assert.equal(environmentLook({ season: 'spring', weather: 'clear', period: 'day' }).art, 'spring');
  assert.equal(environmentLook({ season: 'summer', weather: 'rain', period: 'day' }).art, 'green');
  assert.equal(environmentLook({ season: 'autumn', weather: 'clear', period: 'day' }).art, 'autumn');
  assert.equal(environmentLook({ season: 'winter', weather: 'clear', period: 'day' }).art, 'winter');
  for (const [season, art] of Object.entries({
    spring: 'spring',
    summer: 'green',
    autumn: 'autumn',
    winter: 'winter',
  })) {
    for (const weather of ['clear', 'rain', 'snow'])
      assert.equal(environmentLook({ season, weather, period: 'day' }).art, art);
  }
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
    for (const fraction of [0.5, 0.55, 0.6]) {
      const x = w * fraction;
      assert.ok(pond.onWater(x, (pond.shoreAt(x) + pond.ridgeAt(x)) / 2));
    }
  }
});

test('wide and portrait environments preserve image proportions and keep the floor anchored', async () => {
  const { environmentFrame } = await import('../src/yard/environment.js');
  const { useWorlds, worldFor } = await import('../src/yard/worlds.js');
  const { attic } = await import('./support/attic.mjs');
  useWorlds([...JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url))), attic]);
  for (const world of ['woodland', attic.id]) {
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

test('festival lights follow each tree through wide and mini crops and never light indoor rooms', async () => {
  const { environmentFrame, environmentLightStrands, paintEnvironment } = await import('../src/yard/environment.js');
  const { worldFor } = await import('../src/yard/worlds.js');
  for (const world of ['woodland', 'courtyard', 'lakeside']) {
    for (const [w, h] of [
      [1536, 1024],
      [500, 350],
      [320, 500],
    ]) {
      const scene = { world, season: 'winter', weather: 'clear', period: 'night', event: 'lights' };
      const frame = environmentFrame(w, h, scene);
      const strands = environmentLightStrands(w, h, scene);
      assert.equal(strands.length, 3);
      const anchor = worldFor(world).lightAnchors[0];
      assert.equal(strands[0][0].x, frame.x + frame.width * anchor.from);
      assert.equal(strands[0][0].y, frame.y + frame.height * anchor.y);
      let bulbs = 0;
      const ctx = {
        save() {},
        restore() {},
        drawImage() {},
        fillRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fill() {},
        arc(x, y) {
          assert.ok(x >= 0 && x <= w && y >= 0 && y <= h);
          bulbs++;
        },
      };
      paintEnvironment(ctx, { width: 1536, height: 1024 }, w, h, scene);
      assert.equal(bulbs, strands.flat().filter(p => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h).length);
    }
  }
  assert.deepEqual(environmentLightStrands(500, 350, { world: 'workshop' }), []);
});

test('snow preserves imported seasonal imagery', async () => {
  const { worlds } = await import('../src/yard/worlds.js');
  const place = {
    id: 'weather-season-fixture',
    imageSources: { base: 'base', spring: 'spring', winter: 'winter' },
  };
  worlds.push(place);
  try {
    assert.equal(
      environmentLook({ world: place.id, season: 'spring', weather: 'snow', period: 'day' }).art,
      `${place.id}:spring`,
    );
    assert.equal(
      environmentLook({ world: place.id, season: 'winter', weather: 'clear', period: 'day' }).art,
      `${place.id}:winter`,
    );
  } finally {
    worlds.splice(worlds.indexOf(place), 1);
  }
});
