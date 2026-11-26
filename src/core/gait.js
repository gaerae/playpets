// How a friend's legs keep time with the ground. A walk row's eight cells are one full cycle (two
// steps); the cell shown follows the distance walked, so feet stay planted at any speed. Where the
// cycle starts and how far it carries are measured from the art itself (docs/design/2026-11-26-
// natural-walking.md), because every pet sheet draws its walk in its own order.

import { animationSpec, SOLID_ALPHA as ALPHA } from './animation.js';

/** The shortest a walk cell is shown, so a fast friend's legs blur no faster than this. */
export const CELL_FLOOR_MS = 70;
/** How far the body rises over a step, as a share of the figure's height. */
export const BOB = 0.015;

/** How long a friend turning round while it walks shows a standing cell. */
export const TURN_MS_CELL = 90;
/** The sheet rows a side walk is drawn on, by the side shown. */
export const SIDE_ROWS = Object.freeze({ right: animationSpec('right').row, left: animationSpec('left').row });
/** The gait of a row whose pixels cannot be read (or are not in yet): its drawn order, with no lift
 * added to art nobody measured. */
export const DRAWN_GAIT = Object.freeze({ contact: 0, passing: 2, stride: 0.8, ownBob: true });

const CELLS = 8;
const CELL_HEIGHT = 208;
const FEET = 0.12;
const SAME = 0.1;
const STRIDE = [0.5, 1.2];

const solidAt = (rgba, width) => (x, y) => rgba[(y * width + x) * 4 + 3] > ALPHA;

// The first and last pixel rows of cell `i` with any of the figure, or -1s when it is blank.
function rowsOf(solid, i, cell, height) {
  let top = -1,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = i * cell; x < (i + 1) * cell; x++) {
      if (!solid(x, y)) continue;
      if (top < 0) top = y;
      bottom = y;
      break;
    }
  }
  return [top, bottom];
}

/** Each cell's feet spread: the width covered near the ground, as a share of the cell. */
export function feetSpread(rgba, cells, cell, height) {
  const solid = solidAt(rgba, cells * cell),
    spreads = [];
  for (let i = 0; i < cells; i++) {
    const [top, bottom] = rowsOf(solid, i, cell, height);
    if (top < 0) {
      spreads.push(0);
      continue;
    }
    const from = bottom - Math.max(1, Math.round((bottom - top + 1) * FEET)) + 1;
    let min = Infinity,
      max = -Infinity;
    for (let y = from; y <= bottom; y++) {
      for (let x = i * cell; x < (i + 1) * cell; x++) {
        if (!solid(x, y)) continue;
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    }
    spreads.push((max - min + 1) / cell);
  }
  return spreads;
}

/** Each cell's top edge: the first pixel row with any of the figure (the height when blank). */
export function cellTops(rgba, cells, cell, height) {
  const solid = solidAt(rgba, cells * cell);
  return Array.from({ length: cells }, (_, i) => {
    const [top] = rowsOf(solid, i, cell, height);
    return top < 0 ? height : top;
  });
}

/** Where a row's cycle has its feet widest (contact) and closest (passing), and its stride. */
export function rowGait(spreads) {
  const pairs = [0, 1, 2, 3].map(i => (spreads[i] + spreads[i + 4]) / 2);
  const widest = Math.max(...pairs),
    closest = Math.min(...pairs);
  const stride = Math.min(STRIDE[1], Math.max(STRIDE[0], 2 * widest));
  // Feet that hardly change say nothing about the order, so the drawn order stands.
  if (widest - closest <= SAME * widest) return { contact: 0, passing: 2, stride };
  return { contact: pairs.indexOf(widest), passing: pairs.indexOf(closest), stride };
}

/** The phase (in cycles) after walking `distance` body lengths over `dt` ms. */
export function advance(phase, distance, dt, stride) {
  const step = Math.min(distance / stride, dt / (CELLS * CELL_FLOOR_MS));
  return (phase + step) % 1;
}

/** The cell to draw at a phase; phase zero is a passing cell, where a friend stands. */
export function walkCell(gait, phase) {
  return ((Math.floor(phase * CELLS + gait.passing) % CELLS) + CELLS) % CELLS;
}

/** The nearest phase ahead that shows a passing cell (each half cycle starts with one). */
export function nextRest(phase) {
  const half = phase * 2;
  return half - Math.floor(half) < 2 / CELLS ? phase : Math.ceil(half) / 2;
}

/** A stop's easing: from `phase`, with `whole` body lengths still to walk, to the passing cell its
 * last step reaches. */
export function restToward(phase, whole, stride) {
  return { from: phase, to: nextRest(phase + whole / stride), whole };
}

/** The phase of an easing stop with `left` body lengths to go: the legs land on its passing cell
 * as the friend arrives. */
export function restPhase({ from, to, whole }, left) {
  return from + (to - from) * (whole > 0 ? 1 - left / whole : 1);
}

/** Milliseconds until the next cell at `vel` body lengths a ms. */
export function cellLeftMs(phase, vel, stride) {
  if (!(vel > 0)) return Infinity;
  const at = phase * CELLS,
    left = Math.floor(at) + 1 - at;
  return Math.max(((left / CELLS) * stride) / vel, left * CELL_FLOOR_MS);
}

/** Whether a row's figure already rises and falls by itself (its cells' top edges). */
export function ownBob(tops, height) {
  return Math.max(...tops) - Math.min(...tops) >= BOB * height;
}

/** How high the body sits in a cell, 0 to 1: down after contact, up before the next. */
export function bobShare(gait, cell) {
  return [0.5, 0, 0.5, 1][(((cell - gait.contact) % 4) + 4) % 4];
}

/** How far a cell is lifted (cell pixels) for the bob; none where the art bobs by itself. */
export function liftOf(gait, cell) {
  return gait.ownBob ? 0 : Math.round(BOB * CELL_HEIGHT * bobShare(gait, cell));
}

const SIDE = 40;
const MARGIN = 10;

/** Which way a friend shows itself walking `dx`, `dy` screen pixels; `was` keeps it steady. */
export function facingOf(dx, dy, was) {
  if (dx === 0 && dy === 0) return was ?? 'side';
  const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  const limit = was === 'side' ? SIDE + MARGIN : was ? SIDE - MARGIN : SIDE;
  if (angle <= limit) return 'side';
  return dy > 0 ? 'front' : 'back';
}
