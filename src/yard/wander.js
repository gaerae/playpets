// Idle-life planning for yard pets: when and where a pet strolls on its own.
import { clamp } from '../core/math.js';

export const WANDER_DELAY = [8000, 20000]; // quiet time before a pet entertains itself
export const SCATTER_DELAY = [2500, 6000]; // how long pets linger where a treat was placed
export function wanderTarget(position, rng) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = rng() * Math.PI * 2,
      distance = 0.14 + rng() * 0.22;
    const target = {
      x: clamp(position.x + Math.cos(angle) * distance),
      y: clamp(position.y + Math.sin(angle) * distance * 0.7),
    };
    if (Math.hypot(target.x - position.x, target.y - position.y) > 0.08) return target;
  }
  // Cornered pets head back toward the middle of the yard.
  return {
    x: clamp(position.x + (position.x < 0.5 ? 0.2 : -0.2)),
    y: clamp(position.y + (position.y < 0.5 ? 0.15 : -0.15)),
  };
}
export function idleAction(rng, quiet = false) {
  if (rng() >= 0.25) return { type: 'move' };
  return { type: 'pose', pose: quiet || rng() < 0.5 ? 'wave' : 'jump' };
}
