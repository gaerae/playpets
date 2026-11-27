// How a desktop friend's legs keep time with the positions the backend streams (overlay.rs
// layout): the cell follows the ground covered (core/gait.js), the walk eases to a passing cell as
// its stop nears (`toGo`, the pixels left) or settles there when the pointer cuts it short, and a
// change of side shows a standing cell. Out here friends walk sideways only.
import {
  advance,
  CELL_FLOOR_MS,
  DRAWN_GAIT,
  liftOf,
  nextRest,
  restPhase,
  restToward,
  SIDE_ROWS as ROWS,
  TURN_MS_CELL,
  walkCell,
} from '../core/gait.js';
import { gaitOf } from '../core/sprites.js';

// How long a walk's pose lasts after its last position: the friend stops when they stop.
const WALK_HOLD_MS = 220;
// A walk with no position for longer than a tick or so has stopped short (overlay.rs TICK, 40 ms).
const STALE_MS = 60;
const CELL = 1 / 8;

const gaitFor = (v, side) => gaitOf(v.asset, ROWS[side]) ?? DRAWN_GAIT;
const walking = (v, now) => now < v.until && v.pose in ROWS;

/** Takes a position the backend sent for friend `v` at `now`: the way it faces, the legs' phase. */
export function stepDesktop(v, position, now) {
  // The backend sends every friend on a screen whenever one moves: only a changed position is news.
  const prev = v.prev;
  v.prev = { x: position.x, y: position.y };
  if (!prev || prev.x !== position.x || prev.y !== position.y) v.heard = now;
  const last = v.last;
  if (!last || v.drag) {
    v.last = { x: position.x, y: position.y, at: now };
    return;
  }
  if (position.toGo === undefined && v.rest) {
    // It got there: the stop's passing cell, whatever the last step fell short of.
    v.last = { x: position.x, y: position.y, at: now };
    v.phase = v.rest.to;
    v.rest = null;
    v.until = now + WALK_HOLD_MS;
    return;
  }
  const dx = position.x - last.x,
    moved = Math.hypot(dx, position.y - last.y);
  // Steps under half a pixel (a Small friend near its stop) add up from the last one that counted.
  if (moved <= 0.5) {
    if (v.heard === now && walking(v, now)) v.until = now + WALK_HOLD_MS;
    return;
  }
  v.last = { x: position.x, y: position.y, at: now };
  const was = walking(v, now) ? v.pose : null;
  const side = Math.abs(dx) > 0.5 || !was ? (dx >= 0 ? 'right' : 'left') : was;
  if (!was) {
    v.phase = 0;
    v.rest = null;
  } else if (side !== was) v.turnUntil = now + TURN_MS_CELL;
  v.pose = side;
  v.until = now + WALK_HOLD_MS;
  const gait = gaitFor(v, side),
    size = v.pet.size,
    walked = moved / size;
  const left = (position.toGo ?? Infinity) / size;
  if (left >= gait.stride / 2) {
    v.rest = null;
    v.phase = advance(v.phase ?? 0, walked, now - last.at, gait.stride);
    return;
  }
  v.rest ??= restToward(v.phase ?? 0, left + walked, gait.stride);
  v.phase = restPhase(v.rest, left);
}

// Where a walk whose positions stopped coming short of a stop settles: the nearest passing cell,
// ahead if it is two cells away or less, else the one behind.
function settleTo(phase) {
  const ahead = nextRest(phase);
  return ahead - phase <= 2 * CELL + 1e-9 ? ahead : Math.floor(phase * 2) / 2;
}
// The phase shown at `now`: the walk's own, or, once its positions stopped coming, eased toward
// where it settles at the cadence floor.
function shownPhase(v, now) {
  const phase = v.phase ?? 0;
  const since = now - (v.heard ?? v.last?.at);
  if (v.rest || !v.last || since <= STALE_MS) return phase;
  const target = settleTo(phase),
    step = ((since - STALE_MS) / CELL_FLOOR_MS) * CELL;
  return target >= phase ? Math.min(target, phase + step) : Math.max(target, phase - step);
}

/** What to draw for a walking friend at `now` (overlay.js animate): the state and the walk's cell
 * and lift for drawSprite, a standing cell while it turns. */
export function legsOf(v, state, now) {
  if (now < (v.turnUntil ?? -Infinity)) return { state: 'idle', legs: { cell: 0, lift: 0 } };
  const gait = gaitFor(v, state),
    cell = walkCell(gait, shownPhase(v, now));
  return { state, legs: { cell, lift: liftOf(gait, cell) } };
}

/** How long the loop may wait before a walking friend's next cell (overlay/pace.js), or Infinity:
 * positions bring a walk's cells, so only a turn, or a settle once they stop short, needs a frame. */
export function legsWait(v, now) {
  if (now < (v.turnUntil ?? -Infinity)) return v.turnUntil - now;
  if (!v.last || v.rest || !walking(v, now)) return Infinity;
  const gait = gaitFor(v, v.pose),
    phase = v.phase ?? 0;
  if (walkCell(gait, shownPhase(v, now)) === walkCell(gait, settleTo(phase))) return Infinity;
  const since = now - (v.heard ?? v.last.at);
  return since <= STALE_MS ? STALE_MS - since + 1 : CELL_FLOOR_MS;
}

/** What a walking friend's legs show at `now`, for overlay.js to draw it again when it changes; ''
 * while it is not walking or is held. */
export function legsKey(v, now) {
  if (v.drag || !walking(v, now)) return '';
  const { state, legs } = legsOf(v, v.pose, now);
  return `${state}:${legs.cell}:${legs.lift}`;
}

/** Whether `v` walks by its positions at `now`: in a walk's pose, not held. */
export const legsWalk = (v, now) => !v.drag && !!v.last && walking(v, now);
