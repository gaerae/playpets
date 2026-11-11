// Idle-life planning for yard pets: when and where a pet strolls on its own.
import { clamp } from '../core/math.js';

export const WANDER_DELAY = [8000, 20000]; // quiet time before a pet entertains itself
export const SCATTER_DELAY = [2500, 6000]; // how long pets linger where a treat was placed
// How many points along a stroll are looked at for water: enough that a lake's narrowest end
// (ground.js keeps it whole, as one ellipse) cannot slip between two of them.
const STEPS = 12;
const within = (p, e) => ((p.x - e.x) / e.rx) ** 2 + ((p.y - e.y) / e.ry) ** 2 <= 1;
/** Whether a stroll between two feet (field units, as ground.js measures the water and what stands
 * on the field) keeps out of the water and ends clear of trees, flowers and gifts. A friend set
 * down in the water (dragged there, or there before this rule) may walk out of it. */
export function strollClear(from, to, ground) {
  if (!ground) return true;
  const water = ground.water || [];
  if ((ground.obstacles || []).some(e => within(to, e)) || water.some(e => within(to, e))) return false;
  if (water.some(e => within(from, e))) return true;
  for (let i = 1; i < STEPS; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / STEPS, y: from.y + ((to.y - from.y) * i) / STEPS };
    if (water.some(e => within(p, e))) return false;
  }
  return true;
}
/** Where a friend at `position` strolls next: a visible stroll that `clear(from, to)` allows, or
 * null when none of the tries is (the friend then stays and does something else). */
export function wanderTarget(position, rng, clear = () => true) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = rng() * Math.PI * 2,
      distance = 0.14 + rng() * 0.22;
    const target = {
      x: clamp(position.x + Math.cos(angle) * distance),
      y: clamp(position.y + Math.sin(angle) * distance * 0.7),
    };
    if (Math.hypot(target.x - position.x, target.y - position.y) > 0.08 && clear(position, target)) return target;
  }
  // Cornered pets head back toward the middle of the yard.
  const middle = {
    x: clamp(position.x + (position.x < 0.5 ? 0.2 : -0.2)),
    y: clamp(position.y + (position.y < 0.5 ? 0.15 : -0.15)),
  };
  return clear(position, middle) ? middle : null;
}
export function idleAction(rng, quiet = false) {
  if (rng() >= 0.25) return { type: 'move' };
  return { type: 'pose', pose: quiet || rng() < 0.5 ? 'wave' : 'jump' };
}
