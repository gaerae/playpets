import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { LEAN, rampPace } from '../src/core/physics.js';
import { reduced } from '../src/core/sprites.js';
import { setData, views } from '../src/core/state.js';
import { depthScaleAt, EDGE, footTarget, geometry, measureYard, petHeight, sizeOf } from '../src/yard/field.js';
import { moveFriends, STROLL, WALK } from '../src/yard/motion.js';
import { LOOK_FIRST_MS, release, sendTo } from '../src/yard/trips.js';
import { GLIDE_MS, place } from '../src/yard/views.js';
import { scene } from '../src/yard/world.js';
import { worldFor } from '../src/yard/worlds.js';
import { element, installDom } from './support/dom.mjs';
import { flatField } from './support/flat-field.mjs';

test('trip arrivals use the destination pixels, including reduced-motion jumps', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  flatField(t);
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  try {
    for (const jump of [false, true]) {
      reduced.matches = jump;
      let arrived;
      const friend = {
        pet: { id: 'friend', size: 112 },
        x: jump ? 0.1 : 0.695,
        y: 0.5,
        px: 10,
        py: 20,
        target: { x: 0.7, y: 0.5 },
        trip: {
          save: false,
          arrive: v => {
            arrived = { x: v.px, y: v.py, translate: v.button.style.translate };
          },
        },
        button: element(),
        label: element(),
      };
      views.clear();
      views.set('friend', friend);
      moveFriends(100, 50);
      const box = geometry(friend.pet);
      assert.deepEqual(arrived, {
        x: 14 + 0.7 * box.w,
        y: box.top + 0.5 * box.h,
        translate: `${friend.px}px ${friend.py}px`,
      });
      assert.equal(friend.target, null);
    }
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// The bob of a walk is drawn with its steps (walk-steps.test.mjs); what is left on the button is the
// settle at the stop.
test('a friend settles where it arrives, once, by scale alone', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.2,
      y: 0.5,
      target: { x: 0.8, y: 0.5 },
      trip: { save: false, slow: true },
      button: element(),
      label: element(),
      canvas: { animate: frames => settled.push(frames) },
    };
    const settled = [];
    views.clear();
    views.set('friend', friend);
    moveFriends(100, 50);
    assert.ok(!friend.button.classList.contains('walking'), 'no style keeps a walk of its own time');
    friend.x = 0.795;
    moveFriends(200, 50);
    assert.equal(friend.target, null);
    // It settles by scale alone, so a spin or a tilt on the canvas (transform) goes on through it.
    assert.equal(settled.length, 1, 'it settles as it stops');
    for (const frame of settled[0]) assert.deepEqual(Object.keys(frame), ['scale']);
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// Every try at a stroll asks whether it ends behind the dock; the dock is measured once for them all,
// not once a try, as this runs in the frame loop.
test('a friend choosing a stroll measures the dock once', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  let measured = 0;
  globalThis.document.querySelector = selector => {
    if (selector !== '.yard-dock') return null;
    return {
      getBoundingClientRect: () => {
        measured++;
        // Over the whole yard, so no try is allowed and every one of them asks.
        return { left: 0, top: 0, width: 800, height: 560, right: 800, bottom: 560 };
      },
    };
  };
  const previousReduced = reduced.matches,
    random = Math.random;
  reduced.matches = false;
  Math.random = () => 0.5;
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.5,
      y: 0.5,
      nextWander: 0,
      button: element(),
      label: element(),
    };
    views.clear();
    views.set('friend', friend);
    moveFriends(100, 16);
    assert.equal(friend.target ?? null, null, 'nowhere was clear, so it stays');
    assert.equal(measured, 1);
  } finally {
    views.clear();
    reduced.matches = previousReduced;
    Math.random = random;
  }
});

// A step of the frame loop is a jump of a few pixels; while a friend walks the compositor carries it
// from one to the next (core/ticker.js moveTo), the step that ends the walk too. A held friend
// follows the pointer, so nothing glides behind a drag.
test('a walking friend glides from step to step, the last one too, and never while held', t => {
  const { document } = installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  document.timeline = { currentTime: 0 };
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  const glides = [];
  const node = () =>
    element('div', {
      animate(frames, options) {
        const glide = { frames, options, cancelled: false, cancel: () => (glide.cancelled = true) };
        glides.push(glide);
        return glide;
      },
    });
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.2,
      y: 0.5,
      button: node(),
      label: node(),
      canvas: { animate() {} },
    };
    views.clear();
    views.set('friend', friend);
    place(friend);
    assert.equal(glides.length, 0, 'it is set down where it stands');
    friend.target = { x: 0.8, y: 0.5 };
    friend.trip = { save: false };
    moveFriends(100, 50);
    assert.equal(glides.length, 2, 'walking, its body and its label glide');
    for (const { options } of glides) assert.deepEqual(options, { duration: GLIDE_MS, easing: 'linear' });
    friend.x = 0.795;
    moveFriends(150, 50);
    assert.equal(friend.target, null, 'it arrived');
    assert.equal(glides.length, 4, 'the step that brought it there glides too');
    moveFriends(200, 50);
    assert.equal(glides.length, 4, 'standing, nothing moves');
    friend.target = { x: 0.2, y: 0.5 };
    friend.trip = { save: false };
    moveFriends(1000, 50);
    assert.equal(glides.length, 6);
    friend.drag = {};
    moveFriends(1010, 10);
    friend.x = 0.5;
    place(friend);
    assert.equal(glides.length, 6, 'held, it follows the pointer with no glide');
    assert.ok(
      glides.slice(4).every(glide => glide.cancelled),
      'a glide under way ends where it was going',
    );
    friend.drag = null;
    reduced.matches = true;
    friend.target = { x: 0.2, y: 0.5 };
    moveFriends(1100, 50);
    assert.equal(glides.length, 6, 'with reduced motion a friend is set down where it goes');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// Only the loop's own steps glide. A place from anything else between two of them (the window
// resized, a key nudging the friend, a game setting it at its start) puts the friend there at once.
test('a friend placed between walk steps by anything else is set there at once', t => {
  const { document } = installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  document.timeline = { currentTime: 0 };
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  const glides = [];
  const node = () =>
    element('div', {
      animate(frames, options) {
        const glide = { frames, options, cancelled: false, cancel: () => (glide.cancelled = true) };
        glides.push(glide);
        return glide;
      },
    });
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.2,
      y: 0.5,
      button: node(),
      label: node(),
      canvas: { animate() {} },
      target: { x: 0.8, y: 0.5 },
      trip: { save: false },
    };
    views.clear();
    views.set('friend', friend);
    place(friend);
    moveFriends(100, 50);
    assert.equal(glides.length, 2, 'the walk step glides');
    friend.x = 0.6;
    place(friend);
    assert.equal(glides.length, 2, 'a place of its own does not');
    assert.ok(
      glides.every(glide => glide.cancelled),
      'and the step under way ends where it was going',
    );
    assert.equal(friend.button.style.translate, `${friend.px}px ${friend.py}px`);
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// The loop measures a step from the frame before, which can be long ago in a calm yard: the first
// step of a walk counts only from when the friend set off, so it does not leap ahead.
test('the first step of a walk counts from when the friend set off', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  flatField(t);
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.2,
      y: 0.5,
      button: element(),
      label: element(),
      canvas: { animate() {} },
    };
    views.clear();
    views.set('friend', friend);
    measureYard();
    // Its pace is in body lengths as drawn at its depth, across the field (the yard less a body
    // and its edges), and ramps up from a stand (core/physics.js).
    const feet = feetOf(friend),
      body = (sizeOf(friend.pet) * depthScaleAt(feet.x, feet.y)) / geometry(friend.pet).w,
      far = 0.6 / body;
    // It looks that way first (trips.js LOOK_FIRST_MS), then sets off.
    sendTo(friend, { x: 0.8, y: 0.5 }, { save: false });
    const off = 1000 + LOOK_FIRST_MS;
    clock = off - 10;
    moveFriends(clock, 50);
    assert.equal(friend.x, 0.2, 'looking, it has not stepped');
    clock = off + 10;
    moveFriends(clock, 120);
    const first = friend.x - 0.2,
      setOff = rampPace(0, WALK, far, 10);
    assert.ok(Math.abs(first - 10 * setOff * body) < 1e-9, `it walked for 10 ms, not 120 (${first})`);
    clock = off + 60;
    moveFriends(clock, 50);
    const next = rampPace(setOff, WALK, far - first / body, 50);
    assert.ok(Math.abs(friend.x - 0.2 - first - 50 * next * body) < 1e-9, 'then a whole frame each, quicker');
    assert.ok(next > setOff);
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// A trail is walked print by print (trails.js): a stop on the way is passed through at the walk's
// pace, not braked into and set off from again.
test('a walk through a stop on its way keeps its pace there', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.1,
      y: 0.5,
      nextWander: Infinity,
      button: element(),
      label: element(),
      canvas: { animate() {} },
    };
    views.clear();
    views.set('friend', friend);
    measureYard();
    let passed = null;
    sendTo(
      friend,
      { x: 0.5, y: 0.5 },
      {
        save: false,
        through: true,
        arrive: () => {
          passed = friend.vel;
          sendTo(friend, { x: 0.9, y: 0.5 }, { save: false });
        },
      },
    );
    const paces = [];
    for (clock = 1050; passed === null && clock < 20000; clock += 50) {
      moveFriends(clock, 50);
      paces.push(friend.vel);
    }
    assert.ok(passed !== null, 'it reached the stop');
    assert.equal(Math.min(...paces.slice(paces.indexOf(WALK))), WALK, 'no braking into the stop');
    moveFriends(clock, 50);
    assert.equal(friend.vel, WALK, 'and it walks on at its pace');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// A walk cut short (a game, an agent's duty or the person taking the friend) leaves it standing: the
// next walk sets off from a stand again, not at the pace the last one had reached.
test('a walk cut short and started again ramps up from a stand', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.1,
      y: 0.5,
      nextWander: Infinity,
      button: element(),
      label: element(),
      canvas: { animate() {} },
    };
    views.clear();
    views.set('friend', friend);
    measureYard();
    sendTo(friend, { x: 0.9, y: 0.5 }, { save: false });
    for (clock = 1050 + LOOK_FIRST_MS; clock <= 1600 + LOOK_FIRST_MS; clock += 50) moveFriends(clock, 50);
    assert.equal(friend.vel, WALK, 'at its pace');
    // Let go and sent off again at once, with no frame between.
    release(friend);
    sendTo(friend, { x: 0.1, y: 0.5 }, { save: false });
    const from = friend.x;
    clock += 50;
    moveFriends(clock, 50);
    const body = sizeOf(friend.pet) / geometry(friend.pet).w;
    assert.ok(friend.vel < WALK / 2, `it sets off slowly (${friend.vel})`);
    assert.ok(Math.abs(from - friend.x) < 50 * (WALK / 2) * body, 'and steps a short way');
    // Picked up on the way, it stands while held, and sets off again from a stand when put down.
    for (clock += 50; friend.vel < WALK; clock += 50) moveFriends(clock, 50);
    friend.drag = { moved: false };
    moveFriends(clock, 50);
    friend.drag = null;
    clock += 50;
    moveFriends(clock, 50);
    assert.ok(friend.vel < WALK / 2, `put down, it sets off slowly (${friend.vel})`);
    // Turning toward a new place on the way keeps its pace.
    for (clock += 50; friend.vel < WALK; clock += 50) moveFriends(clock, 50);
    sendTo(friend, { x: 0.5, y: 0.6 }, { save: false });
    clock += 50;
    moveFriends(clock, 50);
    assert.equal(friend.vel, WALK, 'a new place on the way keeps the pace');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// A pace in the yard's width made friends race across a wide window: on a full screen a stroll
// covered three body lengths a second. In body lengths, a friend steps the same in any window.
// Where a friend's feet are in the yard, from its place on the field (views.js place).
const feetOf = v => {
  const { w, h, top } = geometry(v.pet, v.x);
  return { x: EDGE + v.x * w + sizeOf(v.pet) / 2, y: top + v.y * h + petHeight(v.pet) };
};

test('a friend keeps its pace in body lengths as drawn, whatever the window’s size and the way it goes, in a game too', t => {
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  // How far the friend moved on the screen (views.js place: x across the field's width, y down its
  // height), in its body lengths, a second, over one frame once it is up to pace (a quarter of a
  // second in, core/physics.js RAMP_MS) and before it slows to arrive, in the smallest window too.
  const walked = (width, height, trip, from, to) => {
    installDom(t, { anyId: true, props: { rect: { width, height } } });
    setData({ statuses: {} });
    measureYard();
    const friend = {
      pet: { id: 'friend', size: 112 },
      ...from,
      button: element(),
      label: element(),
      canvas: { animate() {} },
    };
    views.clear();
    views.set('friend', friend);
    clock = 1000;
    sendTo(friend, to, { save: false, ...trip });
    for (clock = 1050 + LOOK_FIRST_MS; clock <= 1250 + LOOK_FIRST_MS; clock += 50) moveFriends(clock, 50);
    const at = feetOf(friend);
    clock = 1300 + LOOK_FIRST_MS;
    moveFriends(clock, 50);
    assert.ok(friend.target, 'still on its way');
    const now = feetOf(friend);
    // Farther back it is drawn smaller (field.js depthScaleAt), and its steps are as short.
    return { px: Math.hypot(now.x - at.x, now.y - at.y) * 20, body: sizeOf(friend.pet) * depthScaleAt(at.x, at.y) };
  };
  const across = [
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ],
    down = [
      { x: 0.5, y: 0.05 },
      { x: 0.5, y: 0.95 },
    ];
  try {
    // A game gives its own pace (play.js GAME_PACE), in body lengths as well.
    const trips = [
      ['a stroll', { slow: true }, STROLL],
      ['an errand', {}, WALK],
      ['a game', { speed: 0.003 }, 0.003],
    ];
    for (const [kind, trip, pace] of trips) {
      for (const [way, [from, to]] of Object.entries({ across, down })) {
        const wide = walked(1728, 1080, trip, from, to),
          middle = walked(1180, 850, trip, from, to),
          small = walked(320, 280, trip, from, to);
        for (const [name, walk] of Object.entries({ wide, middle, small }))
          assert.ok(
            Math.abs(walk.px / walk.body - pace * 1000) < 0.02,
            `${name}, ${way}: ${kind} covers ${pace * 1000} body lengths a second (${walk.px / walk.body})`,
          );
        assert.ok(small.px < middle.px, 'a smaller friend covers fewer pixels');
      }
      // The same walk far back covers fewer pixels than near the front: it is drawn smaller there.
      const far = walked(1180, 850, trip, { x: 0.1, y: 0.05 }, { x: 0.9, y: 0.05 }),
        near = walked(1180, 850, trip, { x: 0.1, y: 0.95 }, { x: 0.9, y: 0.95 });
      assert.ok(far.body < near.body && far.px < near.px * 0.95, `${kind}: far back is slower on the screen`);
    }
    assert.ok(STROLL * 1000 <= 1, 'a stroll is no more than a body length a second');
    assert.ok(WALK > STROLL, 'an errand is quicker than a stroll');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// The loop wakes when a walking friend's cell ends (app.js), so each 120 ms step of a walk shows for
// its own time and not 100 or 150 ms, a limp. Walks share one clock, as standing does, so several
// friends walking change cells together: one wake for all. A friend that stands or makes a gesture
// keeps to the loop's pace.
test('a walking friend tells the loop when its next cell is due, and one standing does not', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const friend = id => ({
    pet: { id, size: 112 },
    x: 0.5,
    y: 0.5,
    nextWander: Infinity,
    pose: 'idle',
    since: 0,
    until: 0,
    button: element(),
    label: element(),
    canvas: { animate() {} },
  });
  try {
    const [a, b, still] = ['a', 'b', 'still'].map(friend);
    views.clear();
    for (const v of [a, b, still]) views.set(v.pet.id, v);
    // Standing, the loop's pace is enough.
    moveFriends(1000, 50);
    for (const v of [a, b, still]) assert.equal(v.cellEnds, Infinity);
    // Two set off 37 ms apart: each wakes the loop for its own next cell, by the ground it has walked.
    sendTo(a, { x: 0.9, y: 0.5 }, { save: false });
    clock = 1037;
    sendTo(b, { x: 0.1, y: 0.5 }, { save: false });
    clock = 1300;
    moveFriends(1300, 120);
    for (const v of [a, b]) assert.ok(v.cellEnds > 1300 && Number.isFinite(v.cellEnds), `${v.cellEnds}`);
    assert.notEqual(a.cellEnds, b.cellEnds, 'their steps fall where their own legs are');
    assert.equal(still.cellEnds, Infinity, 'the one standing keeps to the pace');
    // A gesture keeps to the loop's pace too.
    Object.assign(still, { pose: 'jump', since: 2000, until: 4000 });
    clock = 2100;
    moveFriends(2100, 50);
    assert.equal(still.cellEnds, Infinity);
    reduced.matches = true;
    moveFriends(2150, 50);
    for (const v of [a, b, still]) assert.equal(v.cellEnds, Infinity, 'with reduced motion a friend shows one cell');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// A walk leans into its start and back as it slows, on a spring (core/physics.js), by the friend's
// button about its feet: the canvas keeps its own transform, translate and rotate for a press, a
// tilt and the step's bob. Upright again, nothing is left written, and the loop may rest.
test('a walking friend leans into its start, back into its stop, and stands upright after', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  const settles = [];
  const friend = {
    pet: { id: 'friend', size: 112 },
    x: 0.2,
    y: 0.5,
    nextWander: Infinity,
    button: element(),
    label: element(),
    canvas: { animate: frames => settles.push(frames) },
  };
  const lean = () => Number.parseFloat(friend.button.style['--lean'] ?? '0');
  try {
    views.clear();
    views.set('friend', friend);
    measureYard();
    sendTo(friend, { x: 0.8, y: 0.5 }, { save: false });
    const leans = [];
    for (clock = 1050; friend.target && clock < 20_000; clock += 50) {
      moveFriends(clock, 50);
      leans.push(lean());
    }
    assert.ok(Math.max(...leans) > 1, `it leans forward, to the right, setting off (${Math.max(...leans)})`);
    assert.ok(Math.max(...leans) <= LEAN.accel + 0.05, 'by a few degrees at most');
    assert.ok(Math.min(...leans) < -0.5, `and back as it slows (${Math.min(...leans)})`);
    assert.equal(settles.length, 1, 'it squashes as it stops');
    for (; clock < 22_000 && friend.lean; clock += 50) moveFriends(clock, 50);
    assert.equal(friend.lean, null, 'the lean has settled');
    assert.equal(friend.button.style['--lean'], undefined, 'upright, with nothing left written');
    // The other way, it leans the other way.
    sendTo(friend, { x: 0.2, y: 0.5 }, { save: false });
    clock += LOOK_FIRST_MS + 50;
    moveFriends(clock, 50);
    clock += 50;
    moveFriends(clock, 50);
    assert.ok(lean() < 0, 'leftward, it leans left');
    reduced.matches = true;
    clock += 50;
    moveFriends(clock, 50);
    assert.equal(friend.button.style['--lean'], undefined, 'with reduced motion it never leans');
    assert.equal(friend.lean, null);
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

test('a carried friend swings with the pull, and leans toward a pointer it looks at', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  t.mock.method(performance, 'now', () => 1000);
  const friend = {
    pet: { id: 'friend', size: 112 },
    x: 0.3,
    y: 0.5,
    nextWander: Infinity,
    pose: 'idle',
    since: 0,
    until: 0,
    drag: { moved: true },
    button: element(),
    label: element(),
    canvas: { animate() {} },
  };
  const lean = () => Number.parseFloat(friend.button.style['--lean'] ?? '0');
  try {
    views.clear();
    views.set('friend', friend);
    measureYard();
    moveFriends(1000, 50);
    for (let at = 1050; at <= 1300; at += 50) {
      friend.x += 0.02;
      moveFriends(at, 50);
    }
    assert.ok(lean() > 1, `pulled right, it hangs from where it is held: its feet trail, its top leads (${lean()})`);
    assert.ok(lean() <= LEAN.carry + 0.05);
    friend.drag = null;
    for (let at = 1350; at < 3000; at += 50) moveFriends(at, 50);
    assert.equal(friend.button.style['--lean'], undefined, 'let go, it stands upright');
    // Looking at the pointer to its left, it leans a little that way.
    friend.look = { x: -80, y: 0 };
    for (let at = 3000; at < 3600; at += 50) moveFriends(at, 50);
    assert.ok(lean() < -1 && lean() >= -LEAN.look - 0.05, `it leans toward the pointer (${lean()})`);
    // Held still at that lean, it no longer moves: the yard may slow down again (app.js pace).
    for (let at = 3600; at < 4400; at += 50) moveFriends(at, 50);
    assert.ok(friend.lean, 'it keeps leaning while it looks');
    assert.equal(friend.leaning, false, 'a settled lean is not movement');
    friend.look = null;
    moveFriends(4400, 50);
    assert.equal(friend.leaning, true, 'straightening up is');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

test('a jump lands with a squash', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  const settles = [];
  const friend = {
    pet: { id: 'friend', size: 112 },
    x: 0.5,
    y: 0.5,
    nextWander: Infinity,
    pose: 'jump',
    since: 1000,
    until: 2000,
    button: element(),
    label: element(),
    canvas: { animate: frames => settles.push(frames) },
  };
  try {
    views.clear();
    views.set('friend', friend);
    moveFriends(1500, 50);
    assert.equal(settles.length, 0, 'not while it is in the air');
    moveFriends(2050, 50);
    assert.equal(settles.length, 1, 'once it lands');
    moveFriends(2100, 50);
    assert.equal(settles.length, 1, 'and only once');
    Object.assign(friend, { pose: 'wave', since: 2100, until: 2600 });
    moveFriends(2700, 50);
    assert.equal(settles.length, 1, 'a wave does not land');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// A stroll across the field goes straight on the screen where the field's top rises and falls (a
// path up to a door, geometry.edge): the friend neither climbs toward the path nor shrinks and grows
// as it passes it. Stepped in field shares, whose rows follow the top at each x, it bent up there.
test('a friend walking across stays on its line and at its size past a path that rises', t => {
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
  installDom(t, { anyId: true, props: { rect: { width: 1536, height: 1024 } } });
  const before = scene.world,
    kept = worldFor('woodland').geometry;
  scene.world = 'woodland';
  worldFor('woodland').geometry = {
    ...kept,
    fieldTop: 0.66,
    edge: [
      [0.15, 0.66],
      [0.2, 0.58],
      [0.3, 0.58],
      [0.35, 0.66],
    ],
  };
  t.after(() => {
    worldFor('woodland').geometry = kept;
    scene.world = before;
    reduced.matches = previousReduced;
    views.clear();
  });
  setData({ statuses: {} });
  measureYard();
  const friend = { pet: { id: 'friend', size: 112 }, button: element(), label: element(), canvas: { animate() {} } };
  const line = 0.8 * 1024;
  Object.assign(friend, footTarget(friend, 0.05 * 1536, line, 0));
  const to = footTarget(friend, 0.55 * 1536, line, 0);
  views.clear();
  views.set('friend', friend);
  sendTo(friend, to, { save: false, slow: true });
  const ys = [],
    depths = [];
  for (clock = 1050 + LOOK_FIRST_MS; friend.target && clock < 60_000; clock += 50) {
    moveFriends(clock, 50);
    const feet = feetOf(friend);
    ys.push(feet.y);
    depths.push(depthScaleAt(feet.x, feet.y));
  }
  assert.ok(!friend.target, 'it arrived');
  const off = Math.max(...ys.map(y => Math.abs(y - line)));
  assert.ok(off < 1, `its feet stay on their line (${off.toFixed(1)} px off)`);
  assert.ok(Math.max(...depths) - Math.min(...depths) < 0.005, 'its size stays the same');
});
