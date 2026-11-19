// The small physics of a friend's body, as pure rules: a walk that speeds up and slows into its
// stop, a lean that follows a spring, and a fall under gravity. Distances are in the friend's body
// lengths and times in ms, as its pace is (yard/motion.js), so they look the same in any window and
// at any depth (docs/design/2026-11-19-lively-friends.md).

/** How long a walk takes to reach its pace from a stand, and to slow from it to a stop. */
export const RAMP_MS = 240;
// The slowest a walk goes as it arrives, as a share of its pace: slower would creep up on the spot.
const SLOWEST = 0.15;
/** The pace (body lengths a ms) a walk goes at for its next `dt` ms: from `speed` toward `pace`, as
 * fast as the ramp lets it, and slow enough to stop in the `left` body lengths it has to go. */
export function rampPace(speed, pace, left, dt) {
  const a = pace / RAMP_MS;
  const up = Math.min(pace, Math.max(0, speed || 0) + a * Math.max(0, dt));
  return Math.max(pace * SLOWEST, Math.min(up, Math.sqrt(2 * a * Math.max(0, left))));
}

/** How far the body tilts, in degrees: into a walk as it speeds up (and back as it slows), toward a
 * pointer it looks at, and against the pull while it is carried, `perBody` a body length a second. */
export const LEAN = Object.freeze({ accel: 3, look: 1.5, carry: 8, perBody: 1.5 });
// A critically damped spring (stiffness a second squared): it settles in about 0.4 s and never
// swings past its target.
const STIFF = 180,
  DAMP = 2 * Math.sqrt(STIFF),
  // Steps of at most this long, so a 100 ms frame leans as fifty-ms ones do.
  SUBSTEP = 10;
/** The lean (`angle` in degrees, `spin` in degrees a second) after `dt` ms toward `target`. */
export function leanStep({ angle, spin }, target, dt) {
  for (let left = Math.max(0, dt); left > 0; left -= SUBSTEP) {
    const s = Math.min(SUBSTEP, left) / 1000;
    spin += (STIFF * (target - angle) - DAMP * spin) * s;
    angle += spin * s;
  }
  return { angle, spin };
}
/** Whether a lean has come to rest at `target`. */
export const settled = ({ angle, spin }, target = 0) => Math.abs(angle - target) < 0.05 && Math.abs(spin) < 0.5;

/** Gravity, in body lengths a second squared: a friend let go a tenth of its height up lands in
 * about 150 ms. */
export const GRAVITY = 9;
/** How long a fall of `height` body lengths takes, in ms. */
export function fallMs(height) {
  return height > 0 ? Math.sqrt((2 * height) / GRAVITY) * 1000 : 0;
}
