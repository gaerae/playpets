// When the desktop's frame loop (overlay.js animate) wakes next. It stays open all day, so it wakes
// when the cell a friend shows ends rather than ten times a second: a standing friend changes cells
// about five times a second, and the wakes in between drew nothing.

import { cellLeft, idleLeft, poseClock, TURN_MS } from '../core/animation.js';

/** A desktop friend nobody has been with lately plays its idle gesture in this share of the beats,
 * half the yard's: every cell it shows redraws its window, all day (core/animation.js calmRhythm). */
export const CALM_SHARE = 0.3;
/** After someone was with it (pointed at it, held it, patted it, or it got news), a friend stands as
 * lively as in the yard for this long. */
export const LIVELY_MS = 60_000;
/** A friend held, or looking at the pointer, is drawn this often: it follows the pointer. */
export const FOLLOW_MS = 100;
// A cell that ends a moment after a frame is drawn by the next one, a few ms on.
const SOONEST = 8;

/** How long the loop may wait after drawing `views` at `now` (ms), or Infinity to rest until woken:
 * until the first of their cells ends, a pose ends or a look at the pointer runs out. `views` are
 * overlay.js's, with the same pose, look and drag fields. With reduced motion a friend shows one
 * still cell, so nothing ends. */
export function nextDraw(views, now, { reduced = false, lookMs = 400 } = {}) {
  let wait = Infinity;
  for (const v of views) {
    if (!v.asset || reduced) continue;
    if (v.drag) {
      wait = Math.min(wait, FOLLOW_MS);
      continue;
    }
    const posing = now < v.until;
    const state = posing ? v.pose : v.status;
    if (posing) wait = Math.min(wait, v.until - now);
    // Turning toward the pointer, or holding its last look before it stands (sprites.js facing).
    if (v.sprite?._turning) wait = Math.min(wait, TURN_MS);
    if (state === 'idle' && v.look && now - v.lookedAt < lookMs) {
      wait = Math.min(wait, FOLLOW_MS, v.lookedAt + lookMs - now);
      continue;
    }
    // A gesture that played through holds its last cell until the pose ends. Standing goes by the
    // idle rhythm of the friend's canvas (animation.js idleCell).
    const elapsed = posing ? now - v.since : now;
    if (!posing && state === 'idle') wait = Math.min(wait, idleLeft(now, v.sprite?._seed ?? 0, v.sprite?._rhythm));
    else if (!posing || poseClock(state, elapsed) === elapsed) wait = Math.min(wait, cellLeft(state, elapsed));
  }
  return wait === Infinity ? wait : Math.max(SOONEST, Math.ceil(wait));
}
