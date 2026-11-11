// The rainbow's end: while the rainbow after rain shows (sky.js), one patch of ground a friend could
// dig glimmers, and a dig there tells the backend so (discovery.js), which never leaves it empty.
// The patch is a whole dig tile, as the backend remembers digs by tile: one not dug today, so the dig
// there is a fresh one rather than a repeat of an earlier find, and once dug it stops glimmering.
import { $, data } from '../core/state.js';
import { dugSpots, freeSpot, groundAllows, tileMiddle, tileOf } from './discovery-rules.js';
import { fieldToYard } from './field.js';
import { groundProfile } from './ground.js';
import { scene } from './world.js';

let end = null;
let mark = null;

/** Picks the patch for a rainbow that lasts until `until` (ms) and shows it; null when the place has
 * no undug ground. `ground`, `rng` and `dug` (the middles of tiles dug today) are for tests. */
export function placeRainbowEnd(
  until,
  { ground = groundProfile(), rng = Math.random, dug = dugSpots(data.garden?.digs, scene.world, Date.now()) } = {},
) {
  clearRainbowEnd();
  const taken = new Set(dug.map(tileOf)),
    free = point => !taken.has(tileOf(point)) && groundAllows(tileMiddle(point), ground),
    point = freeSpot(rng, ground, { x: [0.15, 0.85], y: [0.2, 0.8] }, free);
  if (!point) return null;
  end = { ...tileMiddle(point), until };
  mark = document.createElement('span');
  mark.className = 'rainbow-end';
  mark.setAttribute('aria-hidden', 'true');
  $('yard').append(mark);
  placeMark();
  return end;
}

/** The glimmer follows its patch when the yard changes size. */
export function placeMark() {
  if (!end || !mark) return;
  const pixel = fieldToYard(end);
  mark.style.left = `${pixel.x}px`;
  mark.style.top = `${pixel.y}px`;
}

/** Puts the glimmer out: the rainbow has gone, or its patch has been dug. */
export function clearRainbowEnd() {
  end = null;
  mark?.remove();
  mark = null;
}

/** The rainbow's end as a field point while the rainbow lasts, else null (shoots keep off it). */
export const rainbowEnd = (now = Date.now()) => (end && now < end.until ? { x: end.x, y: end.y } : null);

/** Whether a dig at this field point is on the rainbow's tile while the rainbow lasts. */
export function atRainbowEnd(point, now = Date.now()) {
  return !!end && now < end.until && tileOf(point) === tileOf(end);
}
