// A friend at work on the ground (digging, planting a tree or a seed): sent so the tip of a held
// tool meets the spot, held still while it works, and let go of again. Fishing keeps its own pose
// and tackle (catch.js).
//
// A dig looks the same whatever it is for (a treasure, a tree, a spring shoot): the walk, the
// stroke, the soil turned at the spot and the friend's pleased look after. Each task keeps what it
// asks the backend and when, and calls these for the rest.

import {
  actionGroundOffset,
  beginCompanionAction,
  clearCompanionAction,
  playCompanionAction,
  prepareCompanionAction,
} from '../core/companion-actions.js';
import { $ } from '../core/state.js';
import { artSvg } from './art.js';
import { fieldToYard, footOf, footTarget, petHeight, sizeOf, yardZoom } from './field.js';
import { release, rest, sendTo, setDoing } from './trips.js';
import { pose } from './views.js';
import { scene } from './world.js';

// How long a stroke takes for a friend with no clip of its own.
const STROKE_MS = 1950;

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

/** Sends a friend to dig (`stroke` 'dig') or plant a tree ('plant') at a point of the field, its
 * clips made ready on the way. */
export function sendToDig(v, point, stroke, options) {
  const clip = prepareCompanionAction(v.asset, stroke),
    pixel = fieldToYard(point);
  prepareCompanionAction(v.asset, 'discover');
  // A friend with no clip of its own (an imported pet) stands beside the spot, on the side it comes
  // from, so the shovel and the turned soil are not hidden behind it; a clip puts its own tool there.
  if (!clip) pixel.x += (footOf(v).x < pixel.x ? -1 : 1) * sizeOf(v.pet) * 0.3;
  sendToWork(v, pixel, clip, options);
}
/** The stroke where the friend now stands: held there until anything takes it, which calls `end`,
 * its clip played, and the soil turned at the point, with a shovel for a friend that holds no tool
 * of its own (an imported pet). Returns the clip (null for none), how long the stroke takes, and
 * `stop()`, which takes the soil away again; the task's end calls it. */
export function startDig(v, point, stroke, end) {
  holdAtWork(v, end);
  const authored = playCompanionAction(v, stroke),
    duration = authored?.duration ?? STROKE_MS,
    pixel = fieldToYard(point),
    effect = document.createElement('span');
  effect.className = `dig-effect${authored ? ' authored' : ''}`;
  effect.setAttribute('aria-hidden', 'true');
  effect.dataset.soil = scene.season === 'winter' ? 'winter' : 'base';
  effect.classList.toggle('planting', stroke === 'plant');
  effect.style.zIndex = String(
    Math.max(0, Math.min(1 + Math.round(point.y * 100), v.z ?? 1 + Math.round(v.y * 100)) - 1),
  );
  effect.innerHTML = `<span class="dig-soil"></span><span class="dig-dirt"></span>${authored?.clip.heldTool ? '' : artSvg('discovery/shovel.svg')}`;
  effect.style.left = `${pixel.x}px`;
  effect.style.top = `${pixel.y}px`;
  effect.style.setProperty('--dig-scale', String(yardZoom()));
  effect.style.setProperty('--dig-duration', `${duration}ms`);
  if (authored) {
    effect.style.setProperty('--dig-contact', `${authored.clip.contactAt ?? duration * 0.3}ms`);
    effect.style.setProperty('--dig-toss', `${authored.clip.tossAt ?? duration * 0.65}ms`);
  }
  $('garden-layer').append(effect);
  let stopped = false;
  const soil = setTimeout(() => {
    if (!stopped) effect.classList.add('contact');
  }, authored?.clip.contactAt ?? 300);
  return {
    authored,
    duration,
    stop() {
      stopped = true;
      clearTimeout(soil);
      effect.remove();
    },
  };
}
/** The stroke is done: the friend is let go, rests a while, and looks pleased when it `found` something. */
export function doneDigging(v, found = true) {
  release(v);
  rest(v);
  if (found) beginCompanionAction(v, 'discover');
}
