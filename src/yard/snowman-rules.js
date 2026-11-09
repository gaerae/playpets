// The snowman game's rules as plain functions, so the numbers can be tested without a screen.
// Sizes are shares of the full base ball (1 = the base); distances and speeds are in field widths
// (the playing field's width = 1). The glue that draws and moves things lives in snowman.js.
//
// Speeds: friends alone take about 80 s for the three balls (the base grows 0.18 to 1 over about
// 1.6 widths at about 0.035/s, then about 23 s and about 11 s). A press is 1/16 of the base. A drag
// can be up to five times as fast as the friends, so a big ball still lags the pointer.

import { localDay } from './growth.js';

export const SNOWMAN = 'snowman';
/** The three balls' sizes, base first. */
export const BALLS = Object.freeze([1, 0.7, 0.46]);
/** A new ball, as a share of the full base ball. */
export const START = 0.18;
/** Size gained by one press. */
export const PUSH = 0.05;
/** Size gained per field width rolled. */
export const GROW = 0.5;
/** How far a ball rests into the one below, as a share of its size. */
export const OVERLAP = 0.18;
export const LIFT_MS = 900;
export const SPARKLES = 5;
export const DRAG_FASTER = 5;

const SPOTS = Object.freeze([
  Object.freeze({ x: 0.72, y: 0.72 }),
  Object.freeze({ x: 0.28, y: 0.72 }),
  Object.freeze({ x: 0.5, y: 0.72 }),
]);

/** Field widths per second the friends push a ball of this size. */
export const rollSpeed = size => 0.075 / (1 + 2 * size);

export const grow = (size, distance, target) => Math.min(target, size + distance * GROW);

export const push = (size, target) => Math.min(target, size + PUSH);

/** Moves toward `to` by what a ball of this weight allows in `dt` ms, never past it. */
export function dragStep(from, to, size, dt) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const max = (rollSpeed(size) * DRAG_FASTER * dt) / 1000;
  if (dist <= max) return { x: to.x, y: to.y };
  return { x: from.x + (dx / dist) * max, y: from.y + (dy / dist) * max };
}

/** Each ball's bottom above the base's, in base widths. */
export const stackBottoms = sizes =>
  sizes.map((_, i) => sizes.slice(0, i).reduce((sum, s) => sum + s * (1 - OVERLAP), 0));

/** A straight line from `from` to `to`, with y arced up by `height` at the middle. */
export function liftPoint(from, to, t, height) {
  const k = Math.min(1, Math.max(0, t));
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k - 4 * height * k * (1 - k),
  };
}

// Rounded to 4 decimals so float noise (0.72 - 0.16) never shows up in comparisons.
const round4 = n => Math.round(n * 1e4) / 1e4;

/** The half of the field away from the stack, where friends roll the balls. */
export const rollRange = spotX => (spotX >= 0.5 ? [0.08, round4(spotX - 0.16)] : [round4(spotX + 0.16), 0.92]);

/** Of the stack spots, the one farthest from the nearest taken place; ties keep the first. */
export function stackSpot(taken) {
  if (!taken.length) return { ...SPOTS[0] };
  let best = SPOTS[0];
  let bestGap = -1;
  for (const spot of SPOTS) {
    const gap = Math.min(...taken.map(t => Math.hypot(t.x - spot.x, t.y - spot.y)));
    if (gap > bestGap) {
      best = spot;
      bestGap = gap;
    }
  }
  return { ...best };
}

/** Why building is not offered now, or null when it is. `season` is the yard's own (null in the living room). */
export function snowmanOffer({ date, season, garden, decorMax }) {
  if (season !== 'winter') return 'not_winter';
  // A day at or before the last snowman's is spent, as the backend refuses it (a clock set back).
  if (garden?.snowmanDay && garden.snowmanDay >= localDay(date)) return 'built_today';
  const decor = garden?.decor ?? [];
  if (!decor.some(d => d.kind === SNOWMAN) && decor.length >= decorMax) return 'full';
  return null;
}
