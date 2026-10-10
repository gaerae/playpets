// One frame of yard life: friends walk to where they are headed, idle ones entertain themselves.
// What happens when a friend arrives belongs to whoever sent it (views.js sendTo).

import { t } from '../core/i18n.js';
import { between } from '../core/math.js';
import { crown, drawSprite, reduced } from '../core/sprites.js';
import { aiming, call, data, game, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { decorTarget } from './decor.js';
import { petHeight } from './field.js';
import { visitTarget } from './garden.js';
import { sendTo } from './trips.js';
import { place, pose } from './views.js';
import { idleAction, WANDER_DELAY, wanderTarget } from './wander.js';

// How far a friend walks in a millisecond, in field units: strolling, and going somewhere.
const STROLL = 0.00022,
  WALK = 0.0005;
export function moveFriends(now, dt) {
  for (const [id, v] of views) {
    if (v.target && !v.drag && !v.frozen) {
      const dx = v.target.x - v.x,
        dy = v.target.y - v.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.012 || reduced.matches) {
        const trip = v.trip;
        v.x = v.target.x;
        v.y = v.target.y;
        v.target = null;
        v.trip = null;
        // Only places a friend chose or was given are saved; game positions and the walk home are not.
        if (trip?.save !== false)
          call('updatePet', id, { x: v.x, y: v.y }).catch(e => toast(spoken(e, t('error.generic'))));
        trip?.arrive?.(v, now);
      } else {
        const step = Math.min(1, (dt * (v.speed || (v.trip?.slow ? STROLL : WALK))) / distance);
        v.x += dx * step;
        v.y += dy * step;
        pose(v, dx >= 0 ? 'right' : 'left', 150);
      }
      place(v);
    } else if (!v.drag && !v.doing && !aiming && !game && !v.away && !reduced.matches && now >= v.nextWander) {
      const action = idleAction(Math.random);
      if (action.type === 'pose') pose(v, action.pose, 1200);
      else if (!visitTarget(v) && !decorTarget(v))
        sendTo(v, wanderTarget({ x: v.x, y: v.y }, Math.random), { slow: true });
      v.nextWander = now + between(Math.random, WANDER_DELAY);
    }
    const status = data.statuses[id]?.state || 'idle';
    const state = now < v.until ? v.pose : status;
    // A pose runs from when it began; standing animations share one clock, so friends that only
    // stand change cells together and the yard is redrawn less often.
    const clock = now < v.until ? now - v.since : now;
    drawSprite(v.canvas, v.asset, state, clock, state === 'idle' ? v.look : null);
    crown(v.label, v.asset, petHeight(v.pet));
  }
}
