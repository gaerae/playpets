// One frame of yard life: friends walk to where they are headed, idle ones entertain themselves.
// What happens when a friend arrives belongs to whoever sent it (views.js sendTo).

import { poseClock } from '../core/animation.js';
import { clearCompanionAction, companionAction, gaitClip } from '../core/companion-actions.js';
import {
  advance,
  cellLeftMs,
  DRAWN_GAIT,
  facingOf,
  liftOf,
  restPhase,
  restToward,
  SIDE_ROWS,
  TURN_MS_CELL,
  walkCell,
} from '../core/gait.js';
import { t } from '../core/i18n.js';
import { between, clamp } from '../core/math.js';
import { LEAN, leanStep, RAMP_MS, rampPace, settled } from '../core/physics.js';
import { bodyOf, crown, drawSprite, gaitOf, reduced } from '../core/sprites.js';
import { aiming, call, data, game, toast, views } from '../core/state.js';
import { stateOf } from '../core/status.js';
import { spoken } from '../core/text.js';
import { decorTarget } from './decor.js';
import { keepDuty } from './duty.js';
import { bodiesApart, bodyInField, depthScaleAt, feetAt, footTarget, petHeight, sizeOf, yardToField } from './field.js';
import { GAME_PACE } from './games.js';
import { visitTarget } from './garden.js';
import { loungeTarget, sitOut } from './lounge.js';
import { paceOf, pastime, restOf } from './pastimes.js';
import { endLookFirst, sendTo } from './trips.js';
import { fitHit, followPointer, place, pose, settle } from './views.js';
import { groundFor } from './walk-here.js';
import { WANDER_DELAY, wanderTarget } from './wander.js';
import { crossesFurniture, wayAround } from './workspace.js';

// How far a friend walks in a millisecond, in its own body lengths: strolling, and going somewhere.
// In the yard's width instead, friends raced across a wide window (three bodies a second on a full
// screen); in body lengths they step the same in any window.
export const STROLL = 0.0008;
export const WALK = 0.002;
// Where a friend's feet are in the yard, in pixels, when it stands at a place (0 to 1 each way).
const feetInYard = (v, at) => {
  const feet = feetAt(v.pet, at);
  return [feet.x, feet.y];
};
// A stroll the ground allows (walk-here.js groundFor), between two places the friend may stand,
// and not over a workspace's furniture.
function dryStroll(v) {
  const allows = groundFor(v);
  return (from, to) => {
    const a = feetInYard(v, from),
      b = feetInYard(v, to);
    return allows(yardToField(...a), ...b) && !crossesFurniture({ x: a[0], y: a[1] }, { x: b[0], y: b[1] });
  };
}
// Where a friend heads now on its way to its target: the next point around a workspace's furniture
// (workspace.js wayAround), or the target. The way is measured once for each target, and a point is
// passed once the friend is there.
function aimOf(v) {
  if (v.around?.for !== v.target) {
    const feet = at => {
      const [x, y] = feetInYard(v, at);
      return { x, y };
    };
    // About half its body clear of the furniture.
    const points = wayAround(feet(v), feet(v.target), sizeOf(v.pet) * (v.depth ?? 1) * 0.3);
    v.around = { for: v.target, points: points.map(p => footTarget(v, p.x, p.y, 0)) };
  }
  const { points } = v.around;
  while (points.length && Math.hypot(points[0].x - v.x, points[0].y - v.y) < 0.012) points.shift();
  return points[0] ?? v.target;
}
// The ground a turning walk keeps to (dryStroll), measured once for each place it heads for.
function arcGround(v) {
  if (v.arcGround?.target !== v.target) v.arcGround = { target: v.target, allows: dryStroll(v) };
  return v.arcGround.allows;
}
// The sheet's rows a walk shows (core/animation.js), one way or the other.
const WALK_CYCLES = new Set(['right', 'left']);
// A walk cell ending this soon is shown now: the loop wakes once between two paced frames, for the
// walker due first, and every other walker this close takes its next cell then (app.js interval).
const EARLY_MS = 25;
// A friend with only a side walk strolls within this angle of across, where its walk looks right.
const ACROSS = (35 * Math.PI) / 180;
// A pet's own walk or run (companion-actions.js gaitClip) is drawn in order, a cycle a stride.
const clipGaits = new WeakMap();
function clipGait(clip) {
  if (!clipGaits.has(clip))
    clipGaits.set(clip, { ...DRAWN_GAIT, stride: clip.stride ?? DRAWN_GAIT.stride, ownBob: true });
  return clipGaits.get(clip);
}
// The legs' timing for the way a friend is drawn walking now: its own clip's, else its sheet row's.
const gaitFor = v => (v.walkClip ? clipGait(v.walkClip) : (gaitOf(v.asset, SIDE_ROWS[v.side]) ?? DRAWN_GAIT));
// The clip a way is drawn with, when the pet has one: toward and away from the viewer, and a game's
// run across.
function wayClip(v, way) {
  if (way === 'front' || way === 'back') return gaitClip(v.asset, `walk-${way}`);
  return v.speed >= GAME_PACE.run ? gaitClip(v.asset, `run-${way}`) : null;
}
// A pet that walks toward and away from the viewer too strolls any way; one with a side walk only,
// across.
const strollAcross = v => (gaitClip(v.asset, 'walk-front') && gaitClip(v.asset, 'walk-back') ? null : ACROSS);
// Which side a walking friend shows: the way it goes across the screen, kept while it walks nearly
// straight up or down (core/gait.js facingOf), so a path near the vertical does not flicker. Up or
// down it is drawn toward or away from the viewer when the pet has those walks (`v.way`,
// `v.walkClip`). A change of the way drawn while walking is a turn (`v.turnUntil`).
function sideOf(v, sx, sy, now) {
  v.facing = facingOf(sx, sy, v.facing);
  const side = v.facing === 'side' || !v.side ? (sx >= 0 ? 'right' : 'left') : v.side;
  const turned = v.facing === 'side' ? null : wayClip(v, v.facing);
  const way = turned ? v.facing : side;
  if (v.way && way !== v.way) v.turnUntil = now + TURN_MS_CELL;
  v.side = side;
  v.way = way;
  v.walkClip = turned ?? wayClip(v, side);
  return side;
}
// The heading `from` turned toward `to` (screen radians) by at most `most`.
function turnToward(from, to, most) {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const next = Math.abs(diff) <= most ? to : from + Math.sign(diff || 1) * most;
  return Math.atan2(Math.sin(next), Math.cos(next));
}
// How fast a walk's heading turns, in screen radians a millisecond: half a turn a second, so a new
// way is taken in an arc. Within a body length of the stop it heads straight there.
const TURN_RATE = Math.PI / 1000;
// The legs' place in the cycle (`v.phase`, core/gait.js) after `walked` body lengths: by the
// distance, from a passing cell when it sets off from a stand. In the last half-stride before a stop
// it eases to the next passing cell, reached as it arrives (`v.rest`), so it stops with its feet
// together; a walk that only passes through goes on.
function stepLegs(v, walked, span, remaining, was) {
  const gait = gaitFor(v);
  if (!was) {
    v.phase = 0;
    v.rest = null;
  }
  if (v.trip?.through || remaining >= gait.stride / 2) {
    v.rest = null;
    v.phase = advance(v.phase ?? 0, walked, span, gait.stride);
    return;
  }
  if (v.rest?.target !== v.target)
    v.rest = { ...restToward(v.phase ?? 0, remaining + walked, gait.stride), target: v.target };
  v.phase = restPhase(v.rest, remaining);
}
// The walk cell to draw now and its lift (cell pixels; none where the art bobs by itself), and when
// the next one is due (`v.cellEnds`, for the loop to wake then). A cell ending within EARLY_MS is
// drawn already.
function legsShown(v, now) {
  const gait = gaitFor(v),
    phase = v.phase ?? 0;
  let shown = phase,
    left = cellLeftMs(phase, v.vel, gait.stride);
  if (left <= EARLY_MS) {
    shown = (Math.floor(phase * 8) + 1) / 8;
    left += cellLeftMs(shown, v.vel, gait.stride);
  }
  v.cellEnds = now + left;
  const cell = walkCell(gait, shown);
  return { cell, lift: liftOf(gait, cell) };
}
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
    if (!walking) {
      v.vel = 0;
      v.side = v.facing = v.way = v.walkClip = null;
    }
    // Where the body leans this frame: set by a walk's change of pace, a pull or a look below.
    let tilt = 0;
    if (v.target && !v.drag && !v.frozen) {
      // With reduced motion it is set down where it goes, so there is no way to walk.
      const aim = reduced.matches ? v.target : aimOf(v),
        on = aim !== v.target;
      const dx = aim.x - v.x,
        dy = aim.y - v.y;
      const distance = Math.hypot(dx, dy);
      if ((distance < 0.012 && !on) || reduced.matches) {
        const trip = v.trip;
        v.x = v.target.x;
        v.y = v.target.y;
        v.target = null;
        v.trip = null;
        // The last step may fall short of the stop's passing cell by less than a cell's ground.
        if (v.rest && !trip?.through) v.phase = v.rest.to;
        v.rest = null;
        // Only places a friend chose or was given are saved; game positions and the walk home are not.
        if (trip?.save !== false)
          call('updatePet', id, { x: v.x, y: v.y }).catch(e => toast(spoken(e, t('error.generic')), { error: true }));
        // Arrivals such as fishing anchor their drawings to the friend's pixel position. A walk
        // glides from step to step (views.js place), the step that ends it too.
        place(v, { glide: walking });
        // A stop on the way (sendTo `through`) is walked through: no stop, and the next trip its
        // arrival sends it on goes on at the walk's pace.
        if (!trip?.through) settle(v);
        v.passing = !!trip?.through;
        try {
          trip?.arrive?.(v, now);
        } finally {
          v.passing = false;
        }
      } else if (now >= (v.leftAt ?? -Infinity)) {
        // The first step counts from when the friend set off (trips.js sendTo), after its look that
        // way, not from the frame before, which may be long ago in a calm yard.
        const span = Math.min(dt, now - (v.leftAt ?? -Infinity));
        endLookFirst(v);
        // A pace is in body lengths, a friend's own and a game's or a trail's (`v.speed`) alike, so
        // a walk looks as quick in any window and any way it goes. It speeds up from a stand and
        // slows into its stop (core/physics.js), unless it only passes through, and the body leans
        // with the change.
        // It walks on the screen, from its feet to where they go: a field share's row follows the
        // field's top at each x, so stepped in shares a walk across bent up where a path rises and
        // the friend shrank and grew there. A body length is the body as drawn at its depth
        // (field.js depthScaleAt), so farther back its steps are as much shorter as it is smaller.
        const [fx, fy] = feetInYard(v, v),
          [ax, ay] = feetInYard(v, aim),
          body = sizeOf(v.pet) * depthScaleAt(fx, fy),
          left = bodiesApart(v.pet, v, aim),
          pace = v.speed || (v.trip?.slow ? STROLL * (v.own ? paceOf(v) : 1) : WALK),
          was = v.vel ?? 0;
        // A point on the way round is walked past at its pace, as a stop passed through is.
        const past = v.trip?.through || on;
        v.vel = rampPace(was, pace, past ? Infinity : left, span);
        // It heads the way it goes on the screen, turning toward a new way in an arc; a game's run
        // and the last body length go straight.
        const want = Math.atan2(ay - fy, ax - fx);
        const walked = Math.min(left, span * v.vel),
          toward = heading =>
            footTarget(v, fx + Math.cos(heading) * walked * body, fy + Math.sin(heading) * walked * body, 0);
        v.heading =
          v.speed || !was || left <= 1 || v.heading == null ? want : turnToward(v.heading, want, TURN_RATE * span);
        let next = walked >= left ? aim : toward(v.heading);
        // An arc leaves the line its stroll was checked on, so each of its steps is checked (the
        // arc's chord), and the straight way on from where it lands: one onto water, a flower, a gift
        // or furniture heads straight there instead, on the way the step before checked.
        const allows = next !== aim && v.heading !== want && arcGround(v);
        if (allows && !(allows({ x: v.x, y: v.y }, next) && allows(next, aim))) {
          v.heading = want;
          next = toward(want);
        }
        const ahead = Math.cos(v.heading) >= 0 ? 1 : -1;
        if (span > 0) tilt = ahead * LEAN.accel * clamp(((v.vel - was) / span) * (RAMP_MS / pace), -1, 1);
        v.x = next.x;
        v.y = next.y;
        const side = sideOf(v, Math.cos(v.heading), Math.sin(v.heading), now);
        stepLegs(v, walked, span, past ? Infinity : left - walked, was);
        pose(v, side, 150);
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
      // A friend's own pastime (pastimes.js), else a seat, a flower, a decoration or a stroll; each
      // friend waits its own while before the next (Miso long, Pip short).
      if (
        !pastime(v, now, { quiet, clear: dryStroll }) &&
        !loungeTarget(v, now) &&
        !visitTarget(v) &&
        !decorTarget(v)
      ) {
        const target = wanderTarget({ x: v.x, y: v.y }, Math.random, dryStroll(v), bodyInField(v.pet, v.x, v.y), {
          across: strollAcross(v),
        });
        if (target) sendTo(v, target, { slow: true, own: true });
      }
      v.nextWander = now + between(Math.random, WANDER_DELAY) * (quiet ? 1.8 : 1) * restOf(v);
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
    // A walk draws the cell its legs are at, and tells the loop when the next is due (app.js), so a
    // cell does not show for a frame too long, a limp. Only a walk: standing and gestures keep to the
    // loop's pace, as the performance standard counts it. A companion's own action has no step; its
    // own walk or run is drawn as one, a cell of the clip for each cell of the legs.
    let shown = state,
      legs = null,
      drawn = action;
    v.cellEnds = Infinity;
    if (walk && !action && !reduced.matches) {
      if (now < (v.turnUntil ?? -Infinity)) {
        shown = 'idle';
        legs = { cell: 0, lift: 0 };
        v.cellEnds = v.turnUntil;
      } else {
        legs = legsShown(v, now);
        if (v.walkClip) drawn = { asset: v.asset, clip: v.walkClip, frame: v.walkClip.frames[legs.cell] };
      }
    }
    drawSprite(v.canvas, v.asset, shown, clock, look, drawn, now, legs);
    fitHit(v, bodyOf(v.canvas));
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
