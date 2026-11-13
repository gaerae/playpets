// The field's top follows the land: a place's line (geometry.fieldTop), and higher where its picture
// shows walkable ground reaching back, a path to a door, a gate or a dock (geometry.edge).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { environmentFrame, environmentLake } from '../src/yard/environment.js';
import {
  depthAt,
  EDGE,
  field,
  fieldToYard,
  geometry,
  measureYard,
  petHeight,
  sizeOf,
  topAt,
  yardToField,
} from '../src/yard/field.js';
import { scene } from '../src/yard/world.js';
import { worldFor } from '../src/yard/worlds.js';
import { installDom } from './support/dom.mjs';

// A yard the picture's own size: one picture pixel is one yard pixel.
function yard(t, edge) {
  const { nodes } = installDom(t, { ids: ['yard'] });
  nodes.get('yard').getBoundingClientRect = () => ({ width: 1536, height: 1024 });
  const before = { world: scene.world },
    geometryBefore = worldFor('woodland').geometry;
  scene.world = 'woodland';
  worldFor('woodland').geometry = { ...geometryBefore, fieldTop: 0.66, edge };
  t.after(() => {
    worldFor('woodland').geometry = geometryBefore;
    Object.assign(scene, before);
  });
  measureYard();
}
const LINE = 0.66 * 1024;
// A path to a door: the land rises to 0.58 of the picture's height between 0.2 and 0.3 across.
const DOOR = [
  [0.15, 0.66],
  [0.2, 0.58],
  [0.3, 0.58],
  [0.35, 0.66],
];

test('without an edge the field begins at its line all the way across', t => {
  yard(t, undefined);
  for (const px of [0, 300, 768, 1536]) assert.equal(topAt(px), LINE);
});

test('where the land reaches back, the field begins higher, and nowhere else', t => {
  yard(t, DOOR);
  assert.equal(topAt(0.25 * 1536), 0.58 * 1024, 'at the door path');
  assert.equal(topAt(0.6 * 1536), LINE, 'beside the pond, the line');
  assert.ok(topAt(0.175 * 1536) < LINE && topAt(0.175 * 1536) > 0.58 * 1024, 'the edge slopes up to the path');
  assert.equal(topAt(0), LINE, 'past its ends the edge is the line');
  // A place at the field's top is on the path there, and on the line elsewhere.
  const x = (0.25 * 1536 - EDGE) / (1536 - EDGE * 2);
  assert.equal(Math.round(fieldToYard({ x, y: 0 }).y), Math.round(0.58 * 1024));
  assert.equal(Math.round(fieldToYard({ x: 0.6, y: 0 }).y), Math.round(LINE));
  // The way back: a point up the path is on the field, a point as high beside it is held to its top.
  const up = yardToField(0.25 * 1536, 0.6 * 1024);
  assert.ok(up.y > 0 && up.y < 0.1, `up the path is on the field (${up.y})`);
  assert.equal(yardToField(0.6 * 1536, 0.6 * 1024).y, 0);
  for (const p of [
    { x: 0.2, y: 0.3 },
    { x, y: 0.05 },
  ]) {
    const back = yardToField(...Object.values(fieldToYard(p)));
    assert.ok(Math.abs(back.x - p.x) < 1e-9 && Math.abs(back.y - p.y) < 1e-9, 'there and back');
  }
});

test('a friend at the top of the field stands on the path where it reaches back', t => {
  yard(t, DOOR);
  const pet = { size: 96 },
    feetX = 0.25 * 1536,
    x = (feetX - EDGE - sizeOf(pet) / 2) / geometry(pet).w;
  assert.equal(Math.round(geometry(pet, x).top + petHeight(pet)), Math.round(0.58 * 1024));
  assert.equal(Math.round(geometry(pet, 0.7).top + petHeight(pet)), Math.round(LINE), 'and on the line beside it');
});

test('each place edge runs left to right inside its picture, never below its line', async () => {
  const worlds = JSON.parse(await readFile('src/content/worlds.json', 'utf8'));
  for (const place of worlds.worlds ?? worlds) {
    const { edge, fieldTop } = place.geometry ?? {};
    if (!edge) continue;
    assert.ok(edge.length >= 2, `${place.id} edge has its ends`);
    let last = -1;
    for (const [x, y] of edge) {
      assert.ok(x > last && x >= 0 && x <= 1, `${place.id} edge goes left to right`);
      assert.ok(y > 0 && y <= fieldTop, `${place.id} edge stays at or above its line`);
      last = x;
    }
  }
});

test('the field never begins over the water, even where the edge reaches back behind it', t => {
  // Ground drawn behind the pond: the edge rises to 0.5 across the whole pond.
  yard(t, [
    [0.3, 0.66],
    [0.35, 0.5],
    [0.85, 0.5],
    [0.9, 0.66],
  ]);
  const lake = environmentLake(1536, 1024, scene);
  assert.ok(lake, 'the hill garden has its pond');
  for (let px = Math.ceil(lake.x0) + 1; px < lake.x1; px += 7)
    assert.ok(
      topAt(px) >= Math.min(LINE, lake.ridgeAt(px) + 20) - 1e-6,
      `at ${px} the field begins a step in front of the pond, or at its line`,
    );
  assert.equal(topAt(0.84 * 1536), 0.5 * 1024, 'beside the pond the edge still reaches back');
});

test('in every place and window, nothing on the field stands in the water', t => {
  const { nodes } = installDom(t, { ids: ['yard'] });
  const before = scene.world;
  t.after(() => {
    scene.world = before;
  });
  for (const id of ['woodland', 'lakeside', 'courtyard'])
    for (const [width, height] of [
      [1536, 1024],
      [1200, 700],
      [900, 800],
      [300, 210],
    ]) {
      nodes.get('yard').getBoundingClientRect = () => ({ width, height });
      scene.world = id;
      measureYard();
      const lake = environmentLake(width, height, scene);
      if (!lake) continue;
      for (let x = 0; x <= 1; x += 0.01)
        for (let y = 0; y <= 1; y += 0.05) {
          const at = fieldToYard({ x, y });
          assert.ok(!lake.onWater(at.x, at.y), `${id} ${width}x${height}: (${x.toFixed(2)}, ${y}) is on dry ground`);
        }
    }
});

test("draw order runs from the highest ground to the yard's foot, whatever the edge", t => {
  yard(t, DOOR);
  const f = field();
  assert.equal(depthAt(0.58 * 1024), 1, 'the top of the path is furthest back');
  assert.equal(depthAt(f.bottom), 101, 'the foot of the field is in front of it all');
  assert.ok(depthAt(LINE) > 1 && depthAt(LINE) < 101);
});

// The highest the lawn reaches in each outdoor picture, as fractions of the picture, read off all
// four seasons' pictures: [from x, to x, top y]. Above it are hedges, bushes and the big tree, so
// nothing set at the top of the field may stand higher there.
const LAWN = {
  woodland: [
    [0, 1, 0.525],
    // The flower bush at the left border.
    [0, 0.06, 0.655],
    // The hedge and white-flowered bushes behind the big tree.
    [0.85, 0.88, 0.54],
    [0.88, 0.9, 0.545],
    [0.9, 0.92, 0.55],
    [0.92, 0.94, 0.555],
  ],
  lakeside: [[0, 1, 0.555]],
  courtyard: [[0, 1, 0.63]],
};
const lawnTop = (place, x) => Math.max(...LAWN[place].filter(([from, to]) => x >= from && x <= to).map(([, , y]) => y));
const across = (from, to, step = 0.002) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

test("each outdoor place's edge runs along its lawn, never up into the bushes behind it", async () => {
  const worlds = JSON.parse(await readFile('src/content/worlds.json', 'utf8'));
  for (const id of Object.keys(LAWN)) {
    const { edge } = (worlds.worlds ?? worlds).find(place => place.id === id).geometry;
    for (const x of across(0, 1)) {
      const i = edge.findIndex(([at], n) => n > 0 && x <= at);
      if (i < 1 || x < edge[0][0]) continue;
      const [[x0, y0], [x1, y1]] = [edge[i - 1], edge[i]],
        y = y0 + ((x - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0);
      assert.ok(y >= lawnTop(id, x) - 1e-9, `${id} edge at ${x.toFixed(3)} is on the lawn (${y.toFixed(3)})`);
    }
  }
});

test('a tree set at the top of the field stands on the lawn anywhere across every outdoor place', t => {
  const { nodes } = installDom(t, { ids: ['yard'] });
  const before = scene.world;
  t.after(() => {
    scene.world = before;
  });
  for (const id of Object.keys(LAWN))
    for (const [width, height] of [
      [1180, 850],
      [1600, 1000],
      [420, 300],
      [1536, 1024],
    ]) {
      nodes.get('yard').getBoundingClientRect = () => ({ width, height });
      scene.world = id;
      measureYard();
      const frame = environmentFrame(width, height, scene);
      for (const x of across(0, 1, 0.01)) {
        const foot = fieldToYard({ x, y: 0 }),
          picX = (foot.x - frame.x) / frame.width,
          picY = (foot.y - frame.y) / frame.height;
        assert.ok(
          picY >= lawnTop(id, picX) - 1e-3,
          `${id} ${width}x${height}: a tree at (${x.toFixed(2)}, 0) stands at ${picY.toFixed(3)} of the picture`,
        );
      }
    }
});
