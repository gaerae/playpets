// A pet's own walks toward and away from the viewer and its runs (`walk-front`, `walk-back`,
// `run-right`, `run-left` in its actions, docs/standards/pet-files.md): eight cells a cycle, drawn by
// the same legs as the sheet's side walk (core/gait.js), and the side walk whenever one is missing or
// its atlas has not decoded yet.
import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { gaitClip, setCompanionSeason, useCompanionActions } from '../src/core/companion-actions.js';
import { TURN_MS_CELL, walkCell } from '../src/core/gait.js';
import { reduced } from '../src/core/sprites.js';
import { setData, views } from '../src/core/state.js';
import { measureYard } from '../src/yard/field.js';
import { GAME_PACE } from '../src/yard/games.js';
import { moveFriends } from '../src/yard/motion.js';
import { sendTo } from '../src/yard/trips.js';
import { element, installDom, keepGlobals } from './support/dom.mjs';
import { flatField } from './support/flat-field.mjs';

// Every atlas decodes at once unless its address says it is still on the way.
class Sheet {
  set src(value) {
    this.url = value;
    this.complete = !value.includes('slow');
    this.naturalWidth = this.complete ? 1536 : 0;
  }
}
// Clip atlases sit on row 3 of their own image, so a clip's cell reads apart from the sheet's rows.
const ROW = 3;
const clip = (url, count = 8, extra = {}) => ({
  url,
  frames: Array.from({ length: count }, (_, i) => ({
    rect: [i * 192, ROW * 208, 192, 208],
    foot: [96, 200],
    duration: 100,
  })),
  loop: true,
  ...extra,
});
const ORDER = { contact: 0, passing: 2 };

let ids = 0;
function walker(x, y, actions) {
  const id = `clip-walker-${++ids}`;
  const drawn = [];
  if (actions !== undefined) useCompanionActions(id, actions && { version: 1, outfits: { base: actions } });
  return {
    drawn,
    pet: { id, size: 128 },
    asset: { id, spriteUrl: id, hasActions: actions !== undefined },
    x,
    y,
    target: null,
    nextWander: Infinity,
    button: element(),
    label: element(),
    canvas: {
      style: {},
      animate() {},
      getContext: () => ({
        clearRect() {},
        drawImage(image, sx, sy) {
          drawn.push({ url: image.url, row: sy / 208, column: sx / 192 });
        },
      }),
    },
  };
}
function yard(t) {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  keepGlobals(t, 'Image');
  globalThis.Image = Sheet;
  flatField(t);
  setData({ statuses: {} });
  measureYard();
  setCompanionSeason('');
  const previous = reduced.matches;
  reduced.matches = false;
  views.clear();
  t.after(() => {
    views.clear();
    reduced.matches = previous;
  });
}
function walk(t, v, target, { frames = 30, speed } = {}) {
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  views.clear();
  views.set(v.pet.id, v);
  sendTo(v, target, { save: false, speed });
  for (let i = 1; v.target && i <= frames; i++) {
    clock = 1000 + i * 50;
    moveFriends(clock, 50);
  }
  return clock;
}

test('a walk or run clip is one cycle of eight cells, else there is none', t => {
  yard(t);
  const eight = clip('front.png');
  const v = walker(0.5, 0.5, { 'walk-front': eight, 'walk-back': clip('back.png', 6) });
  assert.equal(gaitClip(v.asset, 'walk-front'), eight);
  assert.equal(gaitClip(v.asset, 'walk-back'), null, 'six cells are not a cycle');
  assert.equal(gaitClip(v.asset, 'run-right'), null, 'a clip it lacks');
  assert.equal(gaitClip(walker(0.5, 0.5).asset, 'walk-front'), null, 'a pet without actions');
});

test('a clip whose atlas has not decoded is not drawn yet', t => {
  yard(t);
  const v = walker(0.5, 0.5, { 'walk-front': clip('slow-front.png') });
  assert.equal(gaitClip(v.asset, 'walk-front'), null);
});

test('a friend walking toward the viewer draws its front walk cell by cell with its legs', t => {
  yard(t);
  const v = walker(0.5, 0.2, { 'walk-front': clip('front.png'), 'walk-back': clip('back.png') });
  walk(t, v, { x: 0.5, y: 0.9 }, { frames: 20 });
  const front = v.drawn.filter(d => d.url === 'front.png');
  assert.ok(front.length > 3, `it walks on its front clip (${JSON.stringify(v.drawn.slice(-3))})`);
  assert.ok(front.every(d => d.row === ROW));
  assert.equal(front.at(-1).column, walkCell(ORDER, v.phase));
  assert.equal(v.way, 'front');
});

test('a friend walking away from the viewer draws its back walk', t => {
  yard(t);
  const v = walker(0.5, 0.9, { 'walk-front': clip('front.png'), 'walk-back': clip('back.png') });
  walk(t, v, { x: 0.5, y: 0.2 }, { frames: 20 });
  assert.ok(v.drawn.some(d => d.url === 'back.png'));
  assert.equal(v.way, 'back');
});

test('without a front walk, a friend going down the yard keeps its side walk', t => {
  yard(t);
  const v = walker(0.5, 0.2, { 'walk-back': clip('back.png') });
  walk(t, v, { x: 0.52, y: 0.9 }, { frames: 20 });
  const last = v.drawn.at(-1);
  assert.ok(last.row === 1 || last.row === 2, `the sheet's side walk (${JSON.stringify(last)})`);
  assert.ok(!v.drawn.some(d => d.url?.endsWith('.png')));
});

test('a front walk still decoding leaves the side walk on screen', t => {
  yard(t);
  const v = walker(0.5, 0.2, { 'walk-front': clip('slow-front.png') });
  walk(t, v, { x: 0.52, y: 0.9 }, { frames: 20 });
  const last = v.drawn.at(-1);
  assert.ok(last.row === 1 || last.row === 2);
});

test("a game's run draws the run clip, its legs by the clip's own stride", t => {
  yard(t);
  const long = walker(0.1, 0.5, { 'run-right': clip('run-right.png', 8, { stride: 1.2 }) });
  walk(t, long, { x: 0.9, y: 0.5 }, { frames: 6, speed: GAME_PACE.run });
  const runs = long.drawn.filter(d => d.url === 'run-right.png');
  assert.ok(runs.length >= 3, `it runs on its clip (${JSON.stringify(long.drawn.slice(-2))})`);
  // Two frames from a stand, slower than the cadence floor: a longer stride, fewer cells.
  const [a, b] = [1.2, undefined].map(stride => {
    const v = walker(0.1, 0.5, { 'run-right': clip('run-right.png', 8, stride ? { stride } : {}) });
    walk(t, v, { x: 0.9, y: 0.5 }, { frames: 2, speed: GAME_PACE.run });
    return v.phase;
  });
  assert.ok(a > 0 && Math.abs(a / b - 0.8 / 1.2) < 0.01, `${a} against ${b}`);
});

test('an ordinary walk keeps the side walk even with a run clip', t => {
  yard(t);
  const v = walker(0.1, 0.5, { 'run-right': clip('run-right.png') });
  walk(t, v, { x: 0.9, y: 0.5 }, { frames: 12 });
  assert.ok(!v.drawn.some(d => d.url === 'run-right.png'));
});

test('a change from the side walk to the front walk is a turn', t => {
  yard(t);
  const v = walker(0.2, 0.2, { 'walk-front': clip('front.png'), 'walk-back': clip('back.png') });
  const clock = walk(t, v, { x: 0.9, y: 0.22 }, { frames: 12 });
  assert.equal(v.way, 'right');
  sendTo(v, { x: v.x, y: 0.95 }, { save: false });
  // The heading turns in an arc (half a turn a second): it passes 50° from across within 250 ms.
  let now = clock;
  for (let i = 1; v.way !== 'front' && i <= 20; i++) moveFriends((now += 50), 50);
  assert.equal(v.way, 'front');
  assert.ok(v.turnUntil > now - 50 && v.turnUntil <= now + TURN_MS_CELL);
  assert.equal(v.drawn.at(-1).row, 0, 'a standing cell while it turns');
});

test('a friend that can walk toward and away strolls any way, one with a side walk only across', t => {
  yard(t);
  // A roll for its pastime (none), then the stroll's way, a quarter round, and its length: down the
  // yard for a free stroll, straight across for a side-only one.
  let rolls = 0;
  t.mock.method(Math, 'random', () => [0.99, 0.25, 0.15][rolls++] ?? 0.5);
  const free = walker(0.5, 0.1, { 'walk-front': clip('front.png'), 'walk-back': clip('back.png') });
  const side = walker(0.5, 0.1, { 'walk-front': clip('front.png') });
  for (const v of [free, side]) {
    v.nextWander = 0;
    rolls = 0;
    views.clear();
    views.set(v.pet.id, v);
    moveFriends(1000, 50);
  }
  assert.ok(free.target, 'it set off');
  assert.ok(Math.abs(free.target.x - 0.5) < 0.01 && free.target.y > 0.5, JSON.stringify(free.target));
  assert.ok(side.target, 'it set off');
  assert.ok(Math.abs(side.target.y - 0.1) < 0.01 && side.target.x > 0.55, JSON.stringify(side.target));
});
