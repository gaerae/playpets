import assert from 'node:assert/strict';
import test from 'node:test';
import './support/content.mjs';
import { reduced } from '../src/core/sprites.js';
import { setData, views } from '../src/core/state.js';
import { geometry } from '../src/yard/field.js';
import { moveFriends } from '../src/yard/motion.js';
import { element, installDom } from './support/dom.mjs';

test('trip arrivals use the destination pixels, including reduced-motion jumps', t => {
  installDom(t, { anyId: true, props: { rect: { width: 800, height: 560 } } });
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
