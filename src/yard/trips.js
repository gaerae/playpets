// Where friends are headed and what they are busy with: a trip (`v.target`, `v.trip`) and a task
// where a friend stands (`v.doing`). Each belongs to whoever started it, which hears when it ends.
import { between } from '../core/math.js';
import { views } from '../core/state.js';
import { footOf } from './field.js';
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
 * game gives its own `speed`. `own` marks a trip the friend set off on by itself, which its agent's
 * state may cut short (duty.js); what it then does where it arrives is its own too. */
export function sendTo(v, target, { arrive, cancel, save = true, slow = false, speed = 0, own = false } = {}) {
  // When it sets off (motion.js measures its first step from it); one already walking goes on.
  if (!v.target) v.leftAt = performance.now();
  release(v);
  v.target = target;
  v.trip = { arrive, cancel, save, slow };
  v.speed = speed;
  v.own = own;
}
/** Lets go of whatever a friend was on its way to or doing, telling their owners. Whatever moves it
 * goes through here, so a petal resting on its head (petals.js) falls off too. */
export function release(v) {
  brushPetal(v);
  const { trip, doing } = v;
  v.target = null;
  v.trip = null;
  v.doing = null;
  trip?.cancel?.(v);
  doing?.end?.(v);
}
// Not held, not on its way, not in a game, not busy where it stands.
const unoccupied = v => !v.drag && !v.target && !v.away && !v.doing;
/** Free for what friends start on their own: unoccupied, and not seeing to a coding agent that is
 * working, waiting or failed (duty.js). */
export const isFree = v => unoccupied(v) && !v.duty;
/** Only strolling (a wander, sent with `slow` and nothing to do at its end). The blossom gathering
 * counts such a friend in with the free ones (viewing.js), and sendTo lets go of the stroll; the
 * other pickers still pass it over. */
export const strolling = v => !v.drag && !v.away && !v.doing && !!v.trip?.slow && !v.trip.arrive && !v.trip.cancel;
// Only sitting somewhere in a workspace on its own (lounge.js), or on its way there: busy for what
// friends start on their own, but the person's errand may take it.
const lounging = v => !v.drag && !v.away && !!v.spot?.idle;
// Standing with friends viewing the blossom (viewing.js marks it `gathered`): busy for what friends
// start on their own, but what the person starts may take it, and the gathering lets it go.
const yields = v => !v.drag && !!v.gathered;
// The friend nearest a point in the yard, by its feet, among those `ok` allows.
function nearest(px, py, ok) {
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    if (!ok(v)) continue;
    const foot = footOf(v),
      d = Math.hypot(foot.x - px, foot.y - py);
    if (d < bestD) [best, bestD] = [v, d];
  }
  return best;
}
/** The free friend nearest a point in the yard. */
export const nearestFree = (px, py) => nearest(px, py, isFree);
/** Who goes for what the person starts near a point (fishing, a dig, a seed, watering, a visit):
 * `chosen` when it is free, else the nearest free friend; then one only sitting in a workspace;
 * then one seeing to its agent; when none is, `chosen` or the nearest friend viewing the blossom,
 * which leaves the gathering for it. `fits` is the picker's own test. */
export function forPerson(px, py, chosen = null, fits = () => true) {
  for (const ok of [isFree, lounging, unoccupied, yields]) {
    const fit = v => ok(v) && fits(v);
    if (chosen && fit(chosen)) return chosen;
    const v = nearest(px, py, fit);
    if (v) return v;
  }
  return null;
}
/** Busies a friend where it stands (fishing): `end(v)` runs when anything takes it (release). It is
 * the friend's own doing (`own`) when the trip that brought it there was, unless said otherwise. */
export function setDoing(v, doing, own = v.own) {
  release(v);
  v.doing = doing;
  v.own = own;
}
/** Takes the petal off a friend's head (petals.js), and with it the notice the friend might have
 * given of it. */
export function brushPetal(v) {
  clearTimeout(v.petalTimer);
  v.petalTimer = null;
  v.petal?.remove();
  v.petal = null;
}
