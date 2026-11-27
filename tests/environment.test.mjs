import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
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

test('fishing targets stay inside the woodland pond at wide and narrow sizes', async () => {
  const { environmentFrame } = await import('../src/yard/environment.js');
  for (const [w, h] of [
    [1200, 700],
    [420, 500],
  ]) {
    // worlds.json woodland geometry.lake: from 0.405 to 0.775 across, 0.56 to 0.65 down at its middle.
    const frame = environmentFrame(w, h, { world: 'woodland' });
    const pond = environmentLake(w, h, { world: 'woodland' });
    const point = (x, y) => [frame.x + frame.width * x, frame.y + frame.height * y];
    assert.ok(pond.onWater(...point(0.59, 0.605)));
    assert.ok(!pond.onWater(...point(0.59, 0.66)), 'the near shoreline is not water');
    assert.ok(!pond.onWater(...point(0.59, 0.55)), 'the far bank above the pond is not water');
    assert.ok(!pond.onWater(...point(0.59, 0.72)), 'grass below the pond is not water');
    assert.ok(!pond.onWater(...point(0.2, 0.62)));
    for (const fraction of [0.5, 0.59, 0.68]) {
      const [x] = point(fraction, 0);
      assert.ok(pond.onWater(x, (pond.shoreAt(x) + pond.ridgeAt(x)) / 2));
    }
  }
});

// A picture with no safe rect of its own (an imported background, the attic fixture) covers the
// window and keeps its floor line where the window's is.
test('a background without a safe rect covers the window and keeps the floor anchored', async () => {
  const { environmentFrame } = await import('../src/yard/environment.js');
  const { useWorlds, worldFor } = await import('../src/yard/worlds.js');
  const { attic } = await import('./support/attic.mjs');
  useWorlds([...JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url))), attic]);
  const floor = worldFor(attic.id).geometry.fieldTop;
  for (const [w, h] of [
    [1200, 260],
    [520, 650],
    [320, 240],
    [500, 350],
    [1180, 780],
  ]) {
    const frame = environmentFrame(w, h, { world: attic.id });
    assert.ok(Math.abs(frame.width / frame.height - 1.5) < 1e-10, 'no stretching');
    assert.ok(frame.x <= 0 && frame.y <= 0 && frame.x + frame.width >= w && frame.y + frame.height >= h);
    assert.ok(Math.abs(frame.y + frame.height * floor - h * floor) < 1e-8, 'floor stays aligned');
  }
});

// Each shipped place names the part of its picture that is always seen (geometry.safe, [x0, y0,
// x1, y1]). From 4:3 to 16:9 the picture covers the window and the safe rect is all in view; a
// wider window shows the safe rect whole with the picture's own edge at the sides; a narrower one
// outdoors fits the safe rect's width, standing on the window's bottom with the sky above; a room
// keeps covering its height; a strip along the screen crops as it always did.
const SHIPPED = ['woodland', 'courtyard', 'lakeside', 'workshop'];
const EPS = 1e-6;
async function shippedFrames() {
  const { environmentFrame, paintEnvironment } = await import('../src/yard/environment.js');
  const { useWorlds, worldFor } = await import('../src/yard/worlds.js');
  useWorlds(JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url))));
  return { environmentFrame, paintEnvironment, worldFor };
}
const shows = (f, safe, w, h) =>
  f.x + safe[0] * f.width >= -EPS &&
  f.x + safe[2] * f.width <= w + EPS &&
  f.y + safe[1] * f.height >= -EPS &&
  f.y + safe[3] * f.height <= h + EPS;
const covers = (f, w, h) => f.x <= EPS && f.y <= EPS && f.x + f.width >= w - EPS && f.y + f.height >= h - EPS;

test('from 4:3 to 16:9 every place covers the window and shows its safe rect', async () => {
  const { environmentFrame, worldFor } = await shippedFrames();
  for (const world of SHIPPED) {
    const safe = worldFor(world).geometry.safe;
    assert.ok(safe, `${world} has a safe rect`);
    assert.ok(safe[2] - safe[0] <= 0.888 && safe[3] - safe[1] <= 0.843, `${world}: fits 4:3 and 16:9`);
    for (const [w, h] of [
      [800, 600],
      [1024, 768],
      [1180, 850],
      [1180, 780],
      [1280, 800],
      [1366, 768],
      [1440, 900],
      [1600, 1000],
      [1920, 1080],
      [2560, 1440],
    ]) {
      const f = environmentFrame(w, h, { world });
      assert.ok(Math.abs(f.width / f.height - 1.5) < 1e-10, `${world} ${w}x${h}: no stretching`);
      assert.ok(covers(f, w, h), `${world} ${w}x${h}: no band or gap`);
      assert.ok(shows(f, safe, w, h), `${world} ${w}x${h}: the safe rect is in view`);
    }
  }
});

test('a window wider than 16:9 shows the whole safe rect, with the picture’s edge at the sides', async () => {
  const { environmentFrame, worldFor } = await shippedFrames();
  for (const world of SHIPPED) {
    const safe = worldFor(world).geometry.safe;
    for (const [w, h] of [
      [2560, 1080],
      [3440, 1440],
      [2000, 900],
    ]) {
      const f = environmentFrame(w, h, { world });
      assert.ok(shows(f, safe, w, h), `${world} ${w}x${h}: the safe rect is in view`);
      assert.ok(f.x > 0 && Math.abs(f.x * 2 + f.width - w) < EPS, `${world} ${w}x${h}: even sides`);
      assert.ok(f.y <= EPS && f.y + f.height >= h - EPS, `${world} ${w}x${h}: covers the height`);
    }
  }
  // A strip along the screen keeps cropping.
  for (const world of SHIPPED) assert.ok(covers(environmentFrame(2400, 300, { world }), 2400, 300), world);
});

test('a window narrower than 4:3 keeps the safe width outdoors, and covers the height in a room', async () => {
  const { environmentFrame, worldFor } = await shippedFrames();
  for (const world of SHIPPED) {
    const safe = worldFor(world).geometry.safe,
      room = worldFor(world).fit === 'cover-bottom';
    for (const [w, h] of [
      [820, 1000],
      [520, 650],
      [700, 600],
    ]) {
      const f = environmentFrame(w, h, { world });
      assert.ok(Math.abs(f.width / f.height - 1.5) < 1e-10, `${world} ${w}x${h}: no stretching`);
      assert.ok(f.x <= EPS && f.x + f.width >= w - EPS, `${world} ${w}x${h}: covers the width`);
      assert.ok(Math.abs(f.y + f.height - h) < EPS || f.y + f.height > h, `${world} ${w}x${h}: no floor gap`);
      if (room) assert.ok(covers(f, w, h), `${world} ${w}x${h}: a room covers its height`);
      else {
        assert.ok(f.x + safe[0] * f.width >= -EPS && f.x + safe[2] * f.width <= w + EPS, `${world}: safe width`);
        assert.ok(f.y + f.height <= h + EPS, `${world} ${w}x${h}: stands on the window's bottom`);
      }
    }
  }
});

test('a top left above an outdoor picture fades its edge into the sky', async () => {
  const { environmentFrame, paintEnvironment } = await shippedFrames();
  const ops = [];
  const ctx = {
    save() {},
    restore() {},
    drawImage() {},
    fillRect(...args) {
      ops.push([ctx.globalCompositeOperation, ...args]);
    },
    createLinearGradient: (...args) => ({ args, addColorStop() {} }),
  };
  const image = { width: 1536, height: 1024 };
  const scene = { world: 'woodland', season: 'summer', weather: 'clear', period: 'day' };
  const f = environmentFrame(820, 1000, scene);
  assert.ok(f.y > 0, 'a narrow window leaves sky above the picture');
  paintEnvironment(ctx, image, 820, 1000, scene);
  assert.ok(
    ops.some(([op, , y]) => op === 'destination-out' && Math.abs(y - f.y) < EPS),
    'the picture’s top edge is faded out',
  );
  ops.length = 0;
  paintEnvironment(ctx, image, 1180, 850, scene);
  assert.ok(!ops.some(([op]) => op === 'destination-out'), 'a covered window fades nothing');
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
    assert.ok(pond.onWater(...point(0.59, 0.605)), 'visible central pond remains catchable');
    assert.ok(!pond.onWater(...point(0.59, 0.665)), 'transformed grass remains outside hit area');
    assert.ok(!pond.onWater(...point(0.2, 0.605)), 'side land remains outside hit area');
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

test('woodland walking floor starts below the near shore of the pond', async () => {
  const definitions = JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url)));
  const { fieldTop, lake } = definitions.find(world => world.id === 'woodland').geometry;
  assert.ok(fieldTop >= lake.center + lake.radius, 'the pond reaches about 65% of the picture height');
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
        createLinearGradient: () => ({ addColorStop() {} }),
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

test('the mirrored sides are painted from the picture’s own edges', async () => {
  const { environmentFrame, paintEnvironment } = await import('../src/yard/environment.js');
  const { useWorlds } = await import('../src/yard/worlds.js');
  useWorlds(JSON.parse(await readFile(new URL('../src/content/worlds.json', import.meta.url))));
  const drawn = [],
    filled = [];
  const ctx = {
    save() {},
    restore() {},
    translate() {},
    scale() {},
    drawImage(...args) {
      drawn.push(args);
    },
    fillRect(...args) {
      filled.push(args);
    },
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const image = { width: 1536, height: 1024 };
  const scene = { world: 'workshop', season: 'summer', weather: 'clear', period: 'day' };
  const f = environmentFrame(2560, 1080, scene);
  paintEnvironment(ctx, image, 2560, 1080, scene);
  assert.deepEqual(drawn[0], [image, f.x, f.y, f.width, f.height]);
  const sides = drawn.slice(1);
  assert.equal(sides.length, 2);
  // Each side is drawn from the picture's edge and reaches past the seam and the window's edge,
  // so its blur has pixels to sample there instead of fading into a light line.
  const strip = (f.x / f.width) * image.width;
  assert.ok(
    sides.some(args => args[1] === 0 && args[3] > strip && args[7] > f.x),
    'the left edge',
  );
  assert.ok(
    sides.some(args => Math.abs(args[1] + args[3] - image.width) < 1e-6 && args[3] > strip && args[7] > f.x),
    'the right edge',
  );
  assert.ok(filled.length >= 2, 'each side is shaded');
  // Where the picture covers the window there is nothing to fill.
  drawn.length = 0;
  paintEnvironment(ctx, image, 1920, 1080, scene);
  assert.equal(drawn.length, 1);
});
