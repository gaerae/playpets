// One frame of yard life: friends walk to where they are headed, idle ones entertain themselves.
// What happens when a friend arrives belongs to whoever sent it (views.js sendTo).

import { cellLeft, poseClock } from '../core/animation.js';
import { clearCompanionAction, companionAction } from '../core/companion-actions.js';
import { t } from '../core/i18n.js';
import { between } from '../core/math.js';
import { crown, drawSprite, reduced } from '../core/sprites.js';
import { aiming, call, data, game, toast, views } from '../core/state.js';
import { stateOf } from '../core/status.js';
import { spoken } from '../core/text.js';
import { decorTarget } from './decor.js';
import { keepDuty } from './duty.js';
import { dockBox, EDGE, geometry, petHeight, sizeOf, underDock, yardToField } from './field.js';
import { visitTarget } from './garden.js';
import { groundProfile } from './ground.js';
import { loungeTarget, sitOut } from './lounge.js';
import { sendTo } from './trips.js';
import { place, pose } from './views.js';
import { idleAction, strollClear, WANDER_DELAY, wanderTarget } from './wander.js';
import { blocked } from './workspace.js';

// How far a friend walks in a millisecond, in field units: strolling, and going somewhere.
export const STROLL = 0.00022;
export const WALK = 0.0005;
// Where a friend's feet are when it stands at a place (0 to 1 each way), as the ground measures
// the water and what stands on the field.
function feetAt(v, at) {
  return yardToField(...feetInYard(v, at));
}
const feetInYard = (v, at) => {
  const { w, h, top } = geometry(v.pet, at.x);
  return [EDGE + at.x * w + sizeOf(v.pet) / 2, top + at.y * h + petHeight(v.pet)];
};
// A stroll the ground allows: around the lake, not onto a tree, a flower, a gift or a workspace's
// furniture, and not to a stop behind the dock. The dock is measured once for all the tries.
function dryStroll(v) {
  const ground = groundProfile(),
    dock = dockBox();
  return (from, to) => {
    const feet = feetInYard(v, to);
    return (
      !underDock(...feet, sizeOf(v.pet) / 2, dock) &&
      !blocked(...feet) &&
      strollClear(feetAt(v, from), feetAt(v, to), ground)
    );
  };
}
// A walking friend bobs at each step (friends.css .walking), more slowly on a stroll. Written only
// when it changes; with reduced motion a friend does not walk, it is set down where it goes.
function stepping(v, walking, strolling) {
  if (v.walking === walking && v.strolling === strolling) return;
  v.walking = walking;
  v.strolling = strolling;
  v.button.classList.toggle('walking', walking);
  v.button.classList.toggle('strolling', walking && strolling);
}
// The body settles as a friend stops: a short squash on the compositor, by scale alone, so what
// the canvas's transform shows (a press, a tilt, a spin) goes on through it.
const SETTLE = [{ scale: '1.05 0.95' }, { scale: '1' }];
export function moveFriends(now, dt) {
  for (const [id, v] of views) {
    if (game) clearCompanionAction(v);
    sitOut(v, now);
    keepDuty(v);
    const walking = !!v.target && !v.drag && !v.frozen && !reduced.matches;
    stepping(v, walking, !!v.trip?.slow && !v.speed);
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
          call('updatePet', id, { x: v.x, y: v.y }).catch(e => toast(spoken(e, t('error.generic')), { error: true }));
        // Arrivals such as fishing anchor their drawings to the friend's pixel position. A walk
        // glides from step to step (views.js place), the step that ends it too.
        place(v, { glide: walking });
        stepping(v, false, false);
        if (!reduced.matches) v.canvas?.animate?.(SETTLE, { duration: 260, easing: 'ease-out' });
        trip?.arrive?.(v, now);
      } else {
        // The first step counts from when the friend set off (trips.js sendTo), not from the frame
        // before, which may be long ago in a calm yard.
        const span = Math.min(dt, Math.max(0, now - (v.leftAt ?? -Infinity)));
        const step = Math.min(1, (span * (v.speed || (v.trip?.slow ? STROLL : WALK))) / distance);
        v.x += dx * step;
        v.y += dy * step;
        pose(v, dx >= 0 ? 'right' : 'left', 150);
        place(v, { glide: walking });
      }
    } else if (
      !v.drag &&
      !v.doing &&
      !v.duty &&
      !aiming &&
      !game &&
      !v.away &&
      !reduced.matches &&
      now >= v.nextWander
    ) {
      const quiet = document.body.classList.contains('compact');
      const action = idleAction(Math.random, quiet);
      if (action.type === 'pose') pose(v, action.pose, 1200);
      else if (!loungeTarget(v, now) && !visitTarget(v) && !decorTarget(v)) {
        const target = wanderTarget({ x: v.x, y: v.y }, Math.random, dryStroll(v));
        if (target) sendTo(v, target, { slow: true, own: true });
      }
      v.nextWander = now + between(Math.random, WANDER_DELAY) * (quiet ? 1.8 : 1);
    }
    // Read as the dot and the overlay read it: an agent's done or error fades after a while.
    const status = stateOf(data, id);
    const state = now < v.until ? v.pose : status;
    // A pose runs from when it began; standing animations share one clock, so friends that only
    // stand change cells together and the yard is redrawn less often.
    const elapsed = now - v.since,
      posing = now < v.until;
    const clock = posing ? (Number.isFinite(v.until) ? poseClock(state, elapsed) : elapsed) : now;
    const look = state === 'idle' ? v.look : null,
      action = companionAction(v, now);
    // When the cell drawn ends, for the loop to wake then (app.js). A gesture held on its last cell,
    // a look, a companion's own action and reduced motion's one cell have no next.
    const held = (posing && clock < elapsed) || !!action || (!!look && v.asset?.version === 2) || reduced.matches;
    v.cellEnds = held ? Infinity : now + cellLeft(state, clock);
    drawSprite(v.canvas, v.asset, state, clock, look, action);
    crown(v.label, v.asset, petHeight(v.pet));
  }
}
