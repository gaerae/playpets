import './support/content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { EDGE } from '../src/yard/field.js';
import {
  CALL_EVERY_MS,
  mayCall,
  mayGather,
  viewingSeats,
  viewingSpot,
  viewingTime,
} from '../src/yard/viewing-rules.js';

const fair = { event: 'blossom', season: 'spring', period: 'day', weather: 'clear', world: 'woodland' };

test('blossom time is a fair spring day of the festival in a place with seasons', () => {
  assert.equal(viewingTime(fair), true);
  assert.equal(viewingTime({ ...fair, period: 'morning' }), true);
  assert.equal(viewingTime({ ...fair, period: 'evening' }), true);
  for (const change of [
    { period: 'night' },
    { weather: 'rain' },
    { weather: 'snow' },
    { season: 'summer' },
    { event: 'harvest' },
    { event: null },
    { world: 'studio' },
  ])
    assert.equal(viewingTime({ ...fair, ...change }), false, JSON.stringify(change));
});

test('friends start one once a day, with two free friends and nothing else going on', () => {
  assert.equal(mayGather({ today: '2027-04-05', viewed: '', free: 2, busy: false }), true);
  assert.equal(mayGather({ today: '2027-04-05', viewed: '2027-04-05', free: 3, busy: false }), false);
  assert.equal(mayGather({ today: '2027-04-06', viewed: '2027-04-05', free: 2, busy: false }), true);
  assert.equal(mayGather({ today: '2027-04-05', viewed: '', free: 1, busy: false }), false);
  assert.equal(mayGather({ today: '2027-04-05', viewed: '', free: 4, busy: true }), false);
  assert.equal(CALL_EVERY_MS, 3_600_000);
  assert.equal(mayCall(1000, null), true);
  assert.equal(mayCall(3_601_000, 1000), true);
  assert.equal(mayCall(3_600_999, 1000), false);
});

test('the spot is a grown cherry tree here, else a blanket, else the middle', () => {
  const limits = { treeYoungMs: 10, treeMatureMs: 20 };
  const base = { world: 'woodland', now: 100, limits };
  const trees = [
    { id: 'y', kind: 'cherry', world: 'woodland', x: 0.2, y: 0.2, planted: 95, stage: 0 },
    { id: 'o', kind: 'cherry', world: 'lakeside', x: 0.5, y: 0.2, planted: 0, stage: 2 },
    { id: 'm', kind: 'maple', world: 'woodland', x: 0.5, y: 0.2, planted: 0, stage: 2 },
  ];
  const decor = [{ id: 'p', kind: 'picnic', x: 0.4, y: 0.5 }];
  assert.deepEqual(viewingSpot({ ...base, trees, decor }), { kind: 'mat', id: 'p', x: 0.4, y: 0.5 });
  const more = [
    ...trees,
    { id: 'c', kind: 'cherry', world: 'woodland', x: 0.8, y: 0.3, planted: 0, stage: 0 },
    { id: 'd', kind: 'cherry', world: 'woodland', x: 0.55, y: 0.25, planted: 0, stage: 2 },
  ];
  assert.deepEqual(viewingSpot({ ...base, trees: more, decor }), { kind: 'tree', id: 'd', x: 0.55, y: 0.25 });
  assert.deepEqual(viewingSpot({ ...base, trees: [], decor: [{ id: 'b', kind: 'bench', x: 0.5, y: 0.5 }] }), {
    kind: 'middle',
    id: null,
    x: 0.5,
    y: 0.12,
  });
  const mats = [
    { id: 'a', kind: 'picnic', x: 0.3, y: 0.4 },
    { id: 'b', kind: 'picnic', x: 0.6, y: 0.4 },
  ];
  assert.equal(viewingSpot({ ...base, trees: [], decor: mats }).id, 'a');
});

for (const [width, height, zoom] of [
  [1180, 780, 1],
  [460, 320, 0.57],
]) {
  test(`seats stay inside the field and apart at ${width} px and at its edges`, () => {
    const top = height * 0.62,
      bottom = height - 20,
      lo = EDGE + 20 * zoom,
      hi = width - EDGE - 20 * zoom;
    const feet = [
      { x: width / 2, y: top + 20 * zoom },
      { x: 8, y: top + 20 * zoom },
      { x: width - 8, y: top + 20 * zoom },
      { x: width / 2, y: bottom },
      { x: 8, y: bottom },
      { x: width - 8, y: bottom },
    ];
    for (const foot of feet)
      for (const kind of ['tree', 'middle'])
        for (let count = 1; count <= 6; count++) {
          const spot = { kind, ...foot, w: 160 * zoom, h: 170 * zoom };
          const seats = viewingSeats({ spot, count, width, top, bottom, zoom });
          const label = `${kind} ${foot.x},${foot.y} x${count}`;
          assert.equal(seats.length, count, label);
          for (const s of seats) {
            assert.ok(s.x >= lo - 1e-6 && s.x <= hi + 1e-6 && s.y >= top - 1e-6 && s.y <= bottom + 1e-6, label);
            assert.equal(s.side, spot.x < s.x ? 'left' : 'right', label);
            if (foot.y < bottom - 60 * zoom) assert.ok(s.y >= spot.y - 1e-6, `${label} in front`);
          }
          for (let i = 0; i < seats.length; i++)
            for (let j = i + 1; j < seats.length; j++)
              assert.ok(
                Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y) >= 20 * zoom - 1e-6,
                `${label} apart`,
              );
        }
  });
}

test('on a blanket friends sit on it first and the rest beside it', () => {
  const spot = { kind: 'mat', x: 590, y: 600, w: 140, h: 105 };
  const seats = viewingSeats({ spot, count: 6, width: 1180, top: 483, bottom: 760, zoom: 1 });
  assert.equal(seats.length, 6);
  const on = s => s.x >= 520 && s.x <= 660 && s.y >= 495 && s.y <= 600;
  assert.ok(seats.slice(0, 4).every(on));
  assert.ok(seats.slice(4).every(s => !on(s)));
  assert.ok(seats[4].x < 520 && seats[5].x > 660);
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++) assert.ok(Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y) >= 20);
});
