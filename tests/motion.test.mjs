import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { reduced } from '../src/core/sprites.js';
import { setData, views } from '../src/core/state.js';
import { geometry } from '../src/yard/field.js';
import { moveFriends, WALK } from '../src/yard/motion.js';
import { sendTo } from '../src/yard/trips.js';
import { GLIDE_MS, place } from '../src/yard/views.js';
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

test('a friend bobs while it walks, more slowly on a stroll, and stops bobbing where it arrives', t => {
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
    assert.ok(friend.button.classList.contains('walking'));
    assert.ok(friend.button.classList.contains('strolling'));
    friend.trip = { save: false };
    moveFriends(150, 50);
    assert.ok(friend.button.classList.contains('walking'));
    assert.ok(!friend.button.classList.contains('strolling'), 'an errand is a quicker step');
    friend.x = 0.795;
    moveFriends(200, 50);
    assert.equal(friend.target, null);
    assert.ok(!friend.button.classList.contains('walking'), 'standing still, it stops bobbing');
    // It settles by scale alone, so a spin or a tilt on the canvas (transform) goes on through it.
    assert.equal(settled.length, 1, 'it settles as it stops');
    for (const frame of settled[0]) assert.deepEqual(Object.keys(frame), ['scale']);
    reduced.matches = true;
    friend.target = { x: 0.2, y: 0.5 };
    friend.trip = { save: false };
    friend.x = 0.6;
    moveFriends(250, 50);
    assert.ok(!friend.button.classList.contains('walking'), 'with reduced motion a friend never bobs');
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

// The loop measures a step from the frame before, which can be long ago in a calm yard: the first
// step of a walk counts only from when the friend set off, so it does not leap ahead.
test('the first step of a walk counts from when the friend set off', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  let clock = 1000;
  t.mock.method(performance, 'now', () => clock);
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
    sendTo(friend, { x: 0.8, y: 0.5 }, { save: false });
    clock = 1010;
    moveFriends(1010, 120);
    const first = friend.x - 0.2;
    assert.ok(Math.abs(first - 10 * WALK) < 1e-9, `it walked for 10 ms, not 120 (${first})`);
    clock = 1060;
    moveFriends(1060, 50);
    assert.ok(Math.abs(friend.x - 0.2 - first - 50 * WALK) < 1e-9, 'then a whole frame each');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});

// The loop wakes when the cell a friend shows ends (app.js), so each cell shows for its own time.
test('a friend tells the loop when the sprite cell it shows ends', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
  setData({ statuses: {} });
  const previousReduced = reduced.matches;
  reduced.matches = false;
  try {
    const friend = {
      pet: { id: 'friend', size: 112 },
      x: 0.5,
      y: 0.5,
      nextWander: Infinity,
      pose: 'idle',
      since: 0,
      until: 0,
      button: element(),
      label: element(),
      canvas: { animate() {} },
    };
    views.clear();
    views.set('friend', friend);
    // Standing, on the clock all standing friends share: 1000 ms into its 1100 ms loop it shows the
    // last cell, which ends at 1100.
    moveFriends(1000, 50);
    assert.equal(friend.cellEnds, 1100);
    // A jump runs from when it began, and holds its last cell once it is over.
    Object.assign(friend, { pose: 'jump', since: 2000, until: 4000 });
    moveFriends(2100, 50);
    assert.equal(friend.cellEnds, 2140);
    moveFriends(3000, 50);
    assert.equal(friend.cellEnds, Infinity, 'a finished gesture has no next cell');
    reduced.matches = true;
    Object.assign(friend, { pose: 'idle', until: 0 });
    moveFriends(5000, 50);
    assert.equal(friend.cellEnds, Infinity, 'with reduced motion a friend shows one cell');
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});
