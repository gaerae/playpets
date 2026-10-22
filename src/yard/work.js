// A friend at work on the ground (digging, planting a tree or a seed): sent so the tip of a held
// tool meets the spot, held still while it works, and let go of again. Fishing keeps its own pose
// and tackle (catch.js).

import { actionGroundOffset, clearCompanionAction } from '../core/companion-actions.js';
import { footTarget, petHeight, sizeOf } from './field.js';
import { sendTo, setDoing } from './trips.js';
import { pose } from './views.js';

/** Sends a friend to a point in the yard; an authored clip moves its feet so the held tool lands there. */
export function sendToWork(v, pixel, clip, options) {
  const offset = actionGroundOffset(clip, sizeOf(v.pet), petHeight(v.pet));
  sendTo(v, footTarget(v, pixel.x - offset.x, pixel.y - offset.y), options);
}
/** Keeps a friend still where it works until anything takes it, which calls `end`. */
export function holdAtWork(v, end) {
  setDoing(v, { end });
  pose(v, 'idle', Infinity);
}
/** Ends the work's pose and its authored action, so the friend may wander again. */
export function stopWork(v) {
  clearCompanionAction(v);
  if (v.pose === 'idle' && v.until === Infinity) v.until = 0;
}
