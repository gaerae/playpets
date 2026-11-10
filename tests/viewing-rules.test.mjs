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

// The full window and a compact one: the yard, its zoom and a friend's drawn width there.
const YARDS = [
  { width: 1180, height: 780, zoom: 1, size: 112 },
  { width: 460, height: 320, zoom: 0.57, size: 64 },
];
// How far apart neighbours keep: most of a friend's width, or a name tag's, whichever is wider.
const gapOf = (size, tag, zoom) => Math.max(0.85 * size, tag + 4 * zoom);
const apart = (seats, gap, label) => {
  for (let i = 0; i < seats.length; i++)
    for (let j = i + 1; j < seats.length; j++)
      assert.ok(Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y) >= gap - 1e-6, `${label} apart`);
};

for (const { width, height, zoom, size } of YARDS)
  for (const tag of [0, 150 * zoom])
    test(`seats stay whole inside the field and never overlap at ${width} px, tag ${tag}, even at its edges`, () => {
      const top = height * 0.62,
        bottom = height - 20,
        lo = EDGE + size / 2,
        hi = width - EDGE - size / 2,
        gap = gapOf(size, tag, zoom);
      const feet = [
        { x: width / 2, y: top + 20 * zoom },
        { x: 8, y: top + 20 * zoom },
        { x: width - 8, y: top + 20 * zoom },
        { x: width / 2, y: bottom },
        { x: 8, y: bottom },
        { x: width - 8, y: bottom },
      ];
      for (const foot of feet)
        for (const kind of ['tree', 'middle', 'mat'])
          for (let count = 1; count <= 6; count++) {
            const spot = {
              kind,
              ...foot,
              ...(kind === 'mat'
                ? { w: 147 * zoom, h: 110 * zoom }
                : { w: 160 * zoom, h: kind === 'tree' ? 170 * zoom : 0 }),
            };
            const seats = viewingSeats({ spot, count, width, top, bottom, zoom, size, tag });
            const label = `${kind} ${foot.x},${foot.y} x${count}`;
            assert.ok(seats.length >= 1 && seats.length <= count, `${label}: ${seats.length} seats`);
            if (foot.x === width / 2 && (tag === 0 || width > 1000))
              assert.equal(seats.length, count, `${label}: everyone fits in the middle of the yard`);
            for (const s of seats) {
              assert.ok(s.x >= lo - 1e-6 && s.x <= hi + 1e-6 && s.y >= top - 1e-6 && s.y <= bottom + 1e-6, label);
              assert.equal(s.side, spot.x < s.x ? 'left' : 'right', label);
              // The crown stays in sight: nobody stands in front of the trunk.
              if (kind === 'tree') assert.ok(Math.abs(s.x - spot.x) >= spot.w / 2 + gap / 2 - 1e-6, `${label} open`);
            }
            apart(seats, gap, label);
          }
    });

test('under a tree friends stand to both sides of the trunk in a shallow arc', () => {
  const spot = { kind: 'tree', x: 590, y: 520, w: 160, h: 170 };
  const seats = viewingSeats({ spot, count: 4, width: 1180, top: 483, bottom: 760, zoom: 1, size: 112 });
  assert.equal(seats.length, 4);
  assert.equal(seats.filter(s => s.x < spot.x).length, 2);
  assert.equal(seats.filter(s => s.x > spot.x).length, 2);
  for (const s of seats) assert.ok(s.y >= spot.y && s.y <= spot.y + 40, `shallow: ${s.y}`);
  for (const s of seats) assert.equal(s.side, s.x < spot.x ? 'right' : 'left', 'each faces the tree');
});

test('on a blanket friends sit on it and beside it in one row', () => {
  const spot = { kind: 'mat', x: 590, y: 600, w: 147, h: 110 };
  for (let count = 1; count <= 6; count++) {
    const seats = viewingSeats({ spot, count, width: 1180, top: 483, bottom: 760, zoom: 1, size: 112 });
    assert.equal(seats.length, count);
    assert.equal(new Set(seats.map(s => s.y)).size, 1, `x${count}: one row`);
    assert.ok(seats[0].y < spot.y && seats[0].y > spot.y - spot.h, `x${count}: on the blanket's depth`);
    const xs = seats.map(s => s.x).sort((a, b) => a - b);
    assert.ok(Math.abs((xs[0] + xs.at(-1)) / 2 - spot.x) < 1e-6, `x${count}: around its middle`);
    assert.ok(
      xs.some(x => Math.abs(x - spot.x) <= spot.w / 2),
      `x${count}: someone sits on it`,
    );
  }
});

test('when a row is full the rest stand in a row behind it rather than overlapping', () => {
  // A compact yard with wide name tags: a row holds only a few.
  const spot = { kind: 'middle', x: 230, y: 230, w: 114, h: 0 };
  const seats = viewingSeats({ spot, count: 6, width: 460, top: 198, bottom: 300, zoom: 0.57, size: 64, tag: 140 });
  const rows = new Set(seats.map(s => Math.round(s.y)));
  assert.ok(rows.size >= 2, `${rows.size} rows`);
  apart(seats, gapOf(64, 140, 0.57), 'two rows');
});
