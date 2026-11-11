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
    };
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
