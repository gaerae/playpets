// One frame of yard life: friends walk to where they are headed, idle ones entertain themselves.
// What happens when a friend arrives belongs to whoever sent it (views.js sendTo).

import { cellLeft, poseClock } from '../core/animation.js';
import { clearCompanionAction, companionAction } from '../core/companion-actions.js';
import { t } from '../core/i18n.js';
import { between, clamp } from '../core/math.js';
import { LEAN, leanStep, RAMP_MS, rampPace, settled } from '../core/physics.js';
import { crown, drawSprite, reduced } from '../core/sprites.js';
import { aiming, call, data, game, toast, views } from '../core/state.js';
import { stateOf } from '../core/status.js';
import { spoken } from '../core/text.js';
import { decorTarget } from './decor.js';
import { keepDuty } from './duty.js';
import {
  bodiesApart,
  bodyInField,
  dockBox,
  EDGE,
  geometry,
  petHeight,
  sizeOf,
  underDock,
  yardToField,
} from './field.js';
import { visitTarget } from './garden.js';
import { groundProfile } from './ground.js';
import { loungeTarget, sitOut } from './lounge.js';
import { sendTo } from './trips.js';
import { followPointer, place, pose, reachOf, settle } from './views.js';
import { idleAction, strollClear, WANDER_DELAY, wanderTarget } from './wander.js';
import { blocked } from './workspace.js';

// How far a friend walks in a millisecond, in its own body lengths: strolling, and going somewhere.
// In the yard's width instead, friends raced across a wide window (three bodies a second on a full
// screen); in body lengths they step the same in any window.
export const STROLL = 0.0008;
export const WALK = 0.002;
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
// furniture, and not to a stop behind the dock, name tag and all. The dock and the friend's reach
// (reachOf) are measured once for all the tries.
function dryStroll(v) {
  const ground = groundProfile(),
    dock = dockBox(),
    reach = reachOf(v);
  return (from, to) => {
    const feet = feetInYard(v, to);
    return !underDock(...feet, reach, dock) && !blocked(...feet) && strollClear(feetAt(v, from), feetAt(v, to), ground);
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
// The sheet's rows a walk shows (core/animation.js), one way or the other.
const WALK_CYCLES = new Set(['right', 'left']);
// The body (the friend's button, about its feet; `--lean`, friends.css) tilts toward `target`
// degrees on a spring. Only a lean still moving keeps the loop at its busy pace (`v.leaning`,
// app.js pace): one held toward a pointer stays written, and an upright one is let go. Written only
// when it changes by a tenth of a degree.
function lean(v, target, dt) {
  if (reduced.matches || (!v.lean && Math.abs(target) < 0.05)) {
    v.leaning = false;
    if (v.lean) {
      v.lean = null;
      v.leanShown = 0;
      v.button.style.removeProperty('--lean');
    }
    return;
  }
  v.lean = leanStep(v.lean ?? { angle: 0, spin: 0 }, target, dt);
  v.leaning = !settled(v.lean, target);
  if (!target && !v.leaning) v.lean = null;
  const shown = v.lean ? Math.round(v.lean.angle * 10) / 10 : 0;
  if ((v.leanShown ?? 0) === shown) return;
  v.leanShown = shown;
  if (shown) v.button.style.setProperty('--lean', `${shown}deg`);
  else v.button.style.removeProperty('--lean');
}
// How fast a carried friend is pulled across, in its body lengths a second: from where it was a
// frame ago (`v.heldAt`).
function pull(v, dt) {
  const from = v.heldAt;
  v.heldAt = { x: v.x, y: v.y };
  if (!from || dt <= 0 || from.x === v.x) return 0;
  return (Math.sign(v.x - from.x) * bodiesApart(v.pet, from, { x: v.x, y: from.y }) * 1000) / dt;
}
export function moveFriends(now, dt) {
  for (const [id, v] of views) {
    if (game) clearCompanionAction(v);
    sitOut(v, now);
    keepDuty(v);
    const walking = !!v.target && !v.drag && !v.frozen && !reduced.matches;
    // Held, frozen in a game or with nowhere to go, it stands: its next step sets off from a stand.
    if (!walking) v.vel = 0;
    // Where the body leans this frame: set by a walk's change of pace, a pull or a look below.
    let tilt = 0;
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
        // A stop on the way (sendTo `through`) is walked through: no stop, and the next trip its
        // arrival sends it on goes on at the walk's pace.
        if (!trip?.through) {
          stepping(v, false, false);
          settle(v);
        }
        v.passing = !!trip?.through;
        try {
          trip?.arrive?.(v, now);
        } finally {
          v.passing = false;
        }
      } else {
        // The first step counts from when the friend set off (trips.js sendTo), not from the frame
        // before, which may be long ago in a calm yard.
        const span = Math.min(dt, Math.max(0, now - (v.leftAt ?? -Infinity)));
        // A pace is in body lengths, a friend's own and a game's or a trail's (`v.speed`) alike, so
        // a walk looks as quick in any window and any way it goes. It speeds up from a stand and
        // slows into its stop (core/physics.js), unless it only passes through, and the body leans
        // with the change.
        const left = bodiesApart(v.pet, v, v.target),
          pace = v.speed || (v.trip?.slow ? STROLL : WALK),
          was = v.vel ?? 0;
        v.vel = rampPace(was, pace, v.trip?.through ? Infinity : left, span);
        const step = Math.min(1, (span * v.vel) / left);
        if (span > 0) tilt = (dx >= 0 ? 1 : -1) * LEAN.accel * clamp(((v.vel - was) / span) * (RAMP_MS / pace), -1, 1);
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
        const target = wanderTarget({ x: v.x, y: v.y }, Math.random, dryStroll(v), bodyInField(v.pet, v.x));
        if (target) sendTo(v, target, { slow: true, own: true });
      }
      v.nextWander = now + between(Math.random, WANDER_DELAY) * (quiet ? 1.8 : 1);
    }
    // Read as the dot and the overlay read it: an agent's done or error fades after a while.
    const status = stateOf(data, id);
    const state = now < v.until ? v.pose : status;
    // A gesture runs from when it began. Standing animations share one clock, and so do the steps of
    // a walk: friends that stand, or walk, change cells together, and the yard is redrawn and woken
    // less often.
    const elapsed = now - v.since,
      posing = now < v.until,
      walk = posing && WALK_CYCLES.has(state);
    const clock = posing && !walk ? (Number.isFinite(v.until) ? poseClock(state, elapsed) : elapsed) : now;
    followPointer(v);
    const look = state === 'idle' ? v.look : null,
      action = companionAction(v, now);
    // When a step of the walk drawn ends, for the loop to wake then (app.js): a 120 ms step would
    // otherwise show for 100 or 150 ms, a limp. Only a walk: standing and gestures keep to the loop's
    // pace, as the performance standard counts it. A companion's own action has no step.
    v.cellEnds = walk && !action && !reduced.matches ? now + cellLeft(state, clock) : Infinity;
    drawSprite(v.canvas, v.asset, state, clock, look, action, now);
    crown(v.label, v.asset, petHeight(v.pet));
    // A carried friend hangs from where it is held, so its feet trail the pull and its top leads;
    // one looking at the pointer leans a little toward it.
    if (v.drag) {
      const pulled = pull(v, dt);
      if (v.drag.moved) tilt = clamp(pulled * LEAN.perBody, -LEAN.carry, LEAN.carry);
    } else {
      v.heldAt = null;
      if (look) tilt = Math.sign(look.x) * LEAN.look;
    }
    lean(v, tilt, dt);
    // A jump lands with the squash of a stop, once.
    if (v.pose === 'jump' && now >= v.until && v.landed !== v.since) {
      v.landed = v.since;
      settle(v);
    }
  }
}
