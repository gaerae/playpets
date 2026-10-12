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
            arrived = { x: v.px, y: v.py, transform: v.button.style.transform };
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
        transform: friend.button.style.transform,
      });
      assert.equal(friend.target, null);
    }
  } finally {
    views.clear();
    reduced.matches = previousReduced;
  }
});
