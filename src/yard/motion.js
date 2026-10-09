// One frame of yard life: friends walk to where they are headed, idle ones entertain themselves.

import { t } from '../core/i18n.js';
import { crown, drawSprite, reduced } from '../core/sprites.js';
import { aiming, call, data, game, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { ate } from './care.js';
import { fishArrived } from './catch.js';
import { decorTarget, decorVisited } from './decor.js';
import { visited, visitTarget, watered } from './garden.js';
import { arrived } from './play.js';
import { petHeight, place, pose } from './views.js';
import { delay, idleAction, WANDER_DELAY, wanderTarget } from './wander.js';
export function moveFriends(now, dt) {
  for (const [id, v] of views) {
    if (v.target && !v.drag && !v.frozen) {
      const dx = v.target.x - v.x,
        dy = v.target.y - v.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.012 || reduced.matches) {
        const kind = v.targetKind;
        v.x = v.target.x;
        v.y = v.target.y;
        v.target = null;
        v.targetKind = null;
        if (kind === 'treat') ate(v, now);
        else if (kind === 'water') watered(v);
        else if (kind === 'fish') fishArrived(v);
        // Only places a friend chose or was given are saved; game positions and the walk home are not.
        if (kind === 'home') v.away = false;
        else if (kind === 'game') arrived(v);
        else {
          if (kind === 'visit') visited(v);
          else if (kind === 'decor') decorVisited(v);
          call('updatePet', id, { x: v.x, y: v.y }).catch(e => toast(spoken(e, t('error.generic'))));
        }
      } else {
        const step = Math.min(
          1,
          (dt * (v.speed || (['wander', 'visit', 'decor'].includes(v.targetKind) ? 0.00022 : 0.0005))) / distance,
        );
        v.x += dx * step;
        v.y += dy * step;
        pose(v, dx >= 0 ? 'right' : 'left', 150);
      }
      place(v);
    } else if (!v.drag && !aiming && !game && !v.away && !reduced.matches && now >= v.nextWander) {
      const action = idleAction(Math.random);
      if (action.type === 'pose') pose(v, action.pose, 1200);
      else if (!visitTarget(v) && !decorTarget(v)) {
        v.target = wanderTarget({ x: v.x, y: v.y }, Math.random);
        v.targetKind = 'wander';
      }
      v.nextWander = now + delay(Math.random, WANDER_DELAY);
    }
    const status = data.statuses[id]?.state || 'idle';
    const state = now < v.until ? v.pose : status;
    // A pose runs from when it began; standing animations share one clock, so friends that only
    // stand change cells together and the yard is redrawn less often.
    const clock = now < v.until ? now - v.since : now;
    drawSprite(v.canvas, v.asset, state, clock, state === 'idle' ? v.look : null);
    crown(v.button, v.asset, petHeight(v.pet));
  }
}
