// How a friend's legs keep time with the ground in the yard (yard/motion.js, core/gait.js): the
// cell follows the distance walked, a walk stops on a passing cell, a new target keeps the stride,
// and a change of side shows a moment's turn.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './support/content.mjs';
import { TURN_MS_CELL, walkCell } from '../src/core/gait.js';
import { reduced } from '../src/core/sprites.js';
import { data, setData, views } from '../src/core/state.js';
import { footOf, geometry, measureYard, sizeOf, yardToField } from '../src/yard/field.js';
import { groundProfile } from '../src/yard/ground.js';
import { moveFriends, STROLL, WALK } from '../src/yard/motion.js';
import { LOOK_FIRST_MS, sendTo } from '../src/yard/trips.js';
import { strollClear } from '../src/yard/wander.js';
import { element, installDom, keepGlobals } from './support/dom.mjs';
import { flatField } from './support/flat-field.mjs';

class Sheet {
  complete = true;
  naturalWidth = 1536;
  set src(value) {
    this.url = value;
  }
}
// The sheet's pixels cannot be read here (the fake canvas has no context), so a walk keeps the
// drawn order: passing cells 2 and 6 (sprites.js DRAWN_ORDER).
const ORDER = { contact: 0, passing: 2 };
const PASSING = new Set([2, 6]);

let ids = 0;
function walker(x, target) {
  const drawn = [];
  return {
    drawn,
    pet: { id: `walker-${++ids}`, size: 128 },
    asset: { id: `walker-${ids}`, spriteUrl: `walker-${ids}` },
    x,
    y: 0.5,
    target,
    nextWander: Infinity,
    button: element(),
    label: element(),
    canvas: {
      animate() {},
      getContext: () => ({
        clearRect() {},
        drawImage(_image, sx, sy, _sw, _sh, _dx, dy) {
          drawn.push({ row: sy / 208, column: sx / 192, lift: 0 - dy });
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
  setData({ statuses: {}, garden: { plants: [], trees: [], decor: [] } });
  measureYard();
  const previous = reduced.matches;
  reduced.matches = false;
  views.clear();
  t.after(() => {
    views.clear();
    reduced.matches = previous;
  });
}
const walks = v => v.drawn.filter(d => d.row === 1 || d.row === 2);

test('the legs follow the distance walked, not the time it took', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const [a, b] = [walker(0.1, { x: 0.9, y: 0.5 }), walker(0.1, { x: 0.9, y: 0.5 })];
  // A in four frames of 50 ms, B in eight of 25 ms: the same ground, 0.16 bodies, a fifth of a cycle.
  for (const [v, frames, dt] of [
    [a, 4, 50],
    [b, 8, 25],
  ]) {
    Object.assign(v, { trip: { save: false, slow: true, through: true }, vel: STROLL, phase: 0, leftAt: 0 });
    views.clear();
    views.set(v.pet.id, v);
    for (let i = 1; i <= frames; i++) {
      clock = 1000 + i * dt;
      moveFriends(clock, dt);
    }
  }
  assert.ok(Math.abs(a.phase - 0.2) < 1e-9, `a at ${a.phase}`);
  assert.ok(Math.abs(b.phase - a.phase) < 1e-9, `b at ${b.phase}`);
  assert.equal(walks(a).at(-1).column, walkCell(ORDER, 0.2));
  assert.equal(walks(b).at(-1).column, walks(a).at(-1).column);
});

test('a walk sets off on a passing cell and stops on one, never stepping back', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const v = walker(0.3, null);
  views.set(v.pet.id, v);
  sendTo(v, { x: 0.42, y: 0.5 }, { save: false });
  for (let i = 1; v.target && i < 400; i++) {
    clock = 1000 + i * 50;
    moveFriends(clock, 50);
  }
  assert.equal(v.target, null, 'it arrived');
  const cells = walks(v).map(d => d.column);
  assert.ok(PASSING.has(cells[0]), `it sets off from ${cells[0]}`);
  assert.ok(PASSING.has(cells.at(-1)), `it stops on ${cells.at(-1)}: ${cells}`);
  for (let i = 1; i < cells.length; i++) {
    const step = (cells[i] - cells[i - 1] + 8) % 8;
    assert.ok(step <= 4, `${cells[i - 1]} → ${cells[i]} goes forward`);
  }
});

test('a friend sent on while it walks keeps its stride', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const v = walker(0.2, null);
  views.set(v.pet.id, v);
  sendTo(v, { x: 0.9, y: 0.5 }, { save: false });
  for (let i = 1; i <= 10; i++) {
    clock = 1000 + i * 50;
    moveFriends(clock, 50);
  }
  const phase = v.phase;
  assert.ok(phase > 0.1, `it has walked a while (${phase})`);
  sendTo(v, { x: 0.95, y: 0.6 }, { save: false });
  clock += 50;
  moveFriends(clock, 50);
  assert.ok(v.phase > phase, `it goes on from ${phase}, not from a stand (${v.phase})`);
});

test('turning round shows a standing cell for a moment', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const v = walker(0.5, null);
  views.set(v.pet.id, v);
  sendTo(v, { x: 0.9, y: 0.5 }, { save: false });
  for (let i = 1; i <= 10; i++) {
    clock = 1000 + i * 50;
    moveFriends(clock, 50);
  }
  assert.equal(v.drawn.at(-1).row, 1, 'walking right');
  sendTo(v, { x: 0.1, y: 0.5 }, { save: false });
  const from = v.drawn.length;
  for (let i = 0; v.drawn.at(-1).row !== 2 && i < 100; i++) {
    clock += 30;
    moveFriends(clock, 30);
  }
  const rows = v.drawn.slice(from).map(d => d.row);
  assert.equal(rows.at(-1), 2, 'it ends up walking left');
  const turn = rows.indexOf(0);
  assert.ok(turn > 0 && rows.slice(0, turn).every(r => r === 1), `right, then a turn: ${rows}`);
  assert.deepEqual(v.drawn[from + turn], { row: 0, column: 0, lift: 0 });
  assert.ok(
    rows.slice(turn).every(r => r !== 1),
    'and never back',
  );
  assert.ok(TURN_MS_CELL >= 60 && TURN_MS_CELL <= 120);
});

test('a walk asks the loop to wake for its next cell, by the distance left in this one', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const v = walker(0.1, { x: 0.9, y: 0.5 });
  Object.assign(v, { trip: { save: false, slow: true, through: true }, vel: STROLL, phase: 0, leftAt: 0 });
  views.set(v.pet.id, v);
  clock = 1050;
  moveFriends(clock, 50);
  // 0.04 bodies walked of a 0.1-body cell (a stride of 0.8): 75 ms left at a stroll.
  assert.ok(Math.abs(v.cellEnds - 1125) < 1e-6, `${v.cellEnds}`);
  clock = 1110;
  moveFriends(clock, 60);
  // 0.088 bodies in: the cell ends 15 ms on, within the loop's reach, so the next one shows now.
  assert.equal(walks(v).at(-1).column, walkCell(ORDER, 1 / 8));
  assert.ok(v.cellEnds > clock + 100, `and the loop wakes for the one after (${v.cellEnds - clock})`);
});

test('with reduced motion a friend is set down where it goes, with no walk drawn', t => {
  yard(t);
  reduced.matches = true;
  const v = walker(0.2, { x: 0.8, y: 0.5 });
  v.trip = { save: false };
  views.set(v.pet.id, v);
  moveFriends(1000, 50);
  assert.equal(v.target, null);
  assert.equal(walks(v).length, 0);
  assert.equal(v.cellEnds, Infinity);
});

test('the bob comes from the steps, not from a style that keeps its own time', async () => {
  const css = (await readFile('src/styles/friends.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /@keyframes stroll/);
  assert.doesNotMatch(css, /\.walking/);
});

test('a friend looks where it is going before it sets off from a stand', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const v = walker(0.3, null);
  views.set(v.pet.id, v);
  sendTo(v, { x: 0.7, y: 0.5 }, { save: false });
  assert.ok(v.look?.x > 0, 'it looks to its right');
  clock = 1000 + LOOK_FIRST_MS - 10;
  moveFriends(clock, 50);
  assert.equal(v.x, 0.3, 'it has not stepped yet');
  assert.equal(walks(v).length, 0);
  clock = 1000 + LOOK_FIRST_MS + 40;
  moveFriends(clock, 50);
  assert.ok(v.x > 0.3, 'then it walks');
});

test('a game or a walk already under way does not stop to look', t => {
  yard(t);
  const clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const runner = walker(0.3, null);
  views.set(runner.pet.id, runner);
  sendTo(runner, { x: 0.7, y: 0.5 }, { save: false, speed: WALK });
  assert.equal(runner.leftAt, 1000);
  assert.equal(runner.look ?? null, null);
  const walking = walker(0.3, { x: 0.9, y: 0.5 });
  walking.leftAt = 0;
  sendTo(walking, { x: 0.1, y: 0.5 }, { save: false });
  assert.equal(walking.leftAt, 0, 'it goes on from where it was');
});

test('a friend sent the other way turns in an arc, not on the spot, and still arrives', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const v = walker(0.4, null);
  views.set(v.pet.id, v);
  sendTo(v, { x: 0.95, y: 0.5 }, { save: false });
  for (let i = 1; i <= 20; i++) {
    clock = 1000 + LOOK_FIRST_MS + i * 50;
    moveFriends(clock, 50);
  }
  const { w, h } = geometry(v.pet, v.x);
  assert.ok(Math.abs(v.heading) < 1e-9, 'heading right');
  sendTo(v, { x: 0.1, y: 0.5 }, { save: false });
  const before = { x: v.x, y: v.y };
  clock += 50;
  moveFriends(clock, 50);
  assert.ok(Math.abs(v.heading) <= Math.PI * 0.05 + 1e-9, `it turned by ${v.heading} in 50 ms`);
  assert.ok(v.x > before.x, 'still carried forward a little');
  assert.notEqual(v.y, before.y, 'off the straight line, into the arc');
  for (let i = 0; v.target && i < 400; i++) {
    clock += 50;
    moveFriends(clock, 50);
  }
  assert.equal(v.target, null, 'it gets there');
  assert.ok(Math.abs((v.x - 0.1) * w) < 1 && Math.abs((v.y - 0.5) * h) < 1);
  assert.ok(sizeOf(v.pet) > 0);
});

// The arc's chord is checked at each step (docs/design/2026-11-26-natural-walking.md, the path): a
// step of a turn never lands on a flower, a gift or furniture, nor in the water; there the friend
// heads straight for its stop instead.
test('a step of a turn never lands where the ground keeps a friend off', t => {
  yard(t);
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  // Walks right, is sent back left: where its feet land on the field, and whether it was turning.
  const uTurn = () => {
    const v = walker(0.4, null);
    views.set(v.pet.id, v);
    sendTo(v, { x: 0.95, y: 0.5 }, { save: false });
    clock += LOOK_FIRST_MS;
    for (let i = 0; i < 60; i++) moveFriends((clock += 16), 16);
    const target = { x: 0.1, y: 0.5 };
    sendTo(v, target, { save: false });
    const steps = [];
    for (let i = 0; v.target && i < 2000; i++) {
      const { w, h } = geometry(v.pet, v.x),
        want = Math.atan2((target.y - v.y) * h, (target.x - v.x) * w);
      moveFriends((clock += 16), 16);
      const at = footOf(v);
      steps.push({ ...yardToField(at.x, at.y), turning: v.target && Math.abs(v.heading - want) > 1e-6 });
    }
    views.delete(v.pet.id);
    return { v, steps };
  };
  const free = uTurn(),
    line = free.steps[0].y,
    turns = free.steps.filter(s => s.turning);
  // A flower where the arc swings out below the line it would walk straight.
  const out = turns.reduce((a, b) => (b.y > a.y ? b : a));
  assert.ok(out.y - line > 0.05, 'with nothing in the way it arcs');
  data.garden.plants = [{ id: 'daisy', kind: 'daisy', x: out.x, y: out.y }];
  const ground = groundProfile();
  assert.ok(!strollClear(out, out, ground), 'the flower is there');
  const kept = uTurn();
  assert.equal(kept.v.target, null, 'it still gets there');
  for (const step of kept.steps.filter(s => s.turning))
    assert.ok(strollClear(step, step, ground), `a turn's step on the flower: ${JSON.stringify(step)}`);
});
