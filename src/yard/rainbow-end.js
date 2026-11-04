// The rainbow's end: while the rainbow after rain shows (sky.js), one patch of ground a friend could
// dig glimmers, and a dig there tells the backend so (discovery.js), which never leaves it empty.
import { $ } from '../core/state.js';
import { groundAllows } from './discovery-rules.js';
import { fieldToYard } from './field.js';
import { groundProfile } from './ground.js';

// How near the glimmer a dig counts, on the field (0 to 1 across and down).
const REACH = 0.06;
let end = null;
let mark = null;

/** Picks the patch for a rainbow that lasts until `until` (ms) and shows it; null when the place has
 * no ground to dig. `ground` and `rng` are for tests. */
export function placeRainbowEnd(until, { ground = groundProfile(), rng = Math.random } = {}) {
  clearRainbowEnd();
  for (let tries = 0; tries < 20; tries++) {
    const point = { x: 0.15 + rng() * 0.7, y: 0.2 + rng() * 0.6 };
    if (!groundAllows(point, ground)) continue;
    end = { ...point, until };
    mark = document.createElement('span');
    mark.className = 'rainbow-end';
    mark.setAttribute('aria-hidden', 'true');
    $('yard').append(mark);
    placeMark();
    return end;
  }
  return null;
}

/** The glimmer follows its patch when the yard changes size. */
export function placeMark() {
  if (!end || !mark) return;
  const pixel = fieldToYard(end);
  mark.style.left = `${pixel.x}px`;
  mark.style.top = `${pixel.y}px`;
}

export function clearRainbowEnd() {
  end = null;
  mark?.remove();
  mark = null;
}

/** Whether a dig at this field point is at the rainbow's end while the rainbow lasts. */
export function atRainbowEnd(point, now = Date.now()) {
  return !!end && now < end.until && Math.hypot(point.x - end.x, point.y - end.y) <= REACH;
}
