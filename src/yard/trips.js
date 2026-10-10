// Where friends are headed and what they are busy with: a trip (`v.target`, `v.trip`) and a task
// where a friend stands (`v.doing`). Each belongs to whoever started it, which hears when it ends.
import { between } from '../core/math.js';
import { views } from '../core/state.js';
import { petHeight, sizeOf } from './field.js';
import { WANDER_DELAY } from './wander.js';

/** A friend that just did something waits a while before it wanders again. */
export const rest = v => {
  v.nextWander = performance.now() + between(Math.random, WANDER_DELAY);
};
// A friend's trip: where it is headed (`v.target`, its place 0 to 1 each way) and `v.trip`, what
// happens there: { arrive(v, now), cancel(v), save, slow }. While it does something where it stands
// (fishing), `v.doing` is { end(v) }. Whatever takes a friend (a press, a game, another trip, the
// friend leaving) lets go of both first, so the owner of a trip or a task always hears it ended.
/** Sends a friend to `target`: `arrive(v, now)` runs when it gets there and `cancel(v)` if something
 * else takes it first; the place it ends at is kept unless `save` is false; `slow` strolls, and a
 * game gives its own `speed`. */
export function sendTo(v, target, { arrive, cancel, save = true, slow = false, speed = 0 } = {}) {
  release(v);
  v.target = target;
  v.trip = { arrive, cancel, save, slow };
  v.speed = speed;
}
/** Lets go of whatever a friend was on its way to or doing, telling their owners. */
export function release(v) {
  const { trip, doing } = v;
  v.target = null;
  v.trip = null;
  v.doing = null;
  trip?.cancel?.(v);
  doing?.end?.(v);
}
/** Free to be sent somewhere: not held, not on its way, not in a game, not busy where it stands. */
export const isFree = v => !v.drag && !v.target && !v.away && !v.doing;
/** The free friend nearest a point in the yard. */
export function nearestFree(px, py) {
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    if (!isFree(v)) continue;
    const d = Math.hypot(v.px + sizeOf(v.pet) / 2 - px, v.py + petHeight(v.pet) - py);
    if (d < bestD) [best, bestD] = [v, d];
  }
  return best;
}
/** Busies a friend where it stands (fishing): `end(v)` runs when anything takes it (release). */
export function setDoing(v, doing) {
  release(v);
  v.doing = doing;
}
