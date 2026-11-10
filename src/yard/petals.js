// Petals on heads: during the blossom festival a falling petal now and then lands on a friend that
// stands still, and stays there until the friend moves or blossom time is over; now and then the
// friend notices it.
//
// - The petal sits in the friend's label, the layer above the field, at the top of its head
//   (--head, core/sprites.js crown); friends.css draws it.
// - Whatever moves a friend lets go of it through trips.js release, which brushes the petal off
//   (brushPetal), and the notice it might have given with it.
// - Petals come more often while friends view the blossom (viewing.js), and land on the friends
//   standing there too.

import { list } from '../core/i18n.js';
import { between, pick } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { data, call, views } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { footOf, sizeOf } from './field.js';
import { localDay } from './growth.js';
import { brushPetal, isFree } from './trips.js';
import { viewingTime } from './viewing-rules.js';
import { viewing } from './viewing.js';
import { bubble } from './views.js';
import { scene } from './world.js';

// How often a petal lands on someone: now and then, and more often while friends view the blossom.
const EVERY = [25_000, 60_000];
const GATHERED_EVERY = [8_000, 15_000];
// Where on the head it lands, as a share of the friend's width either side of the middle, and how far
// it may turn (degrees).
const SPREAD = 0.12;
const TURN = 25;
// Now and then the friend notices it a few seconds later, and says so for this long.
const NOTICE_CHANCE = 0.35;
const NOTICE_AFTER = [3000, 6000];
const NOTICE_MS = 3000;

// Whether the waits are a gathering's, and when the next petal lands (setupPetals).
let gathered = false;
// Whether a petal may still rest on a head, so the frame loop looks for them only then.
let worn = false;
const wait = () => between(Math.random, gathered ? GATHERED_EVERY : EVERY);
let falling = cadence(wait);

/** Wiring: the wait for the first petal. Called once, by app.js. */
export function setupPetals() {
  gathered = false;
  falling = cadence(wait);
}

/** A petal lands on `v`'s head and stays until the friend moves; false when one is already there. */
export function landPetal(v) {
  if (v.petal) return false;
  const petal = document.createElement('i');
  petal.className = 'head-petal';
  petal.setAttribute('aria-hidden', 'true');
  const offset = (Math.random() * 2 - 1) * SPREAD * sizeOf(v.pet);
  petal.style.setProperty('--petal-x', `${Math.round(offset)}px`);
  petal.style.setProperty('--petal-turn', `${Math.round((Math.random() * 2 - 1) * TURN)}deg`);
  if (!reduced.matches) petal.classList.add('landing');
  v.label.append(petal);
  v.petal = petal;
  worn = true;
  if (Math.random() < NOTICE_CHANCE)
    v.petalTimer = setTimeout(
      () => {
        v.petalTimer = null;
        // Only while it still wears this one, and never over its own words.
        if (v.petal === petal && v.bubble.hidden) bubble(v, pick(list('viewing.petal_notice')), NOTICE_MS);
      },
      between(Math.random, NOTICE_AFTER),
    );
  return true;
}

/** Called by the frame loop beside the other yard life: in blossom time a petal now and then lands
 * on a friend standing still, or standing to view the blossom. When blossom time is over (night,
 * rain, the festival's end) every petal comes off, so a friend that never moves (reduced motion)
 * does not wear one into the night or the summer. */
export function petalTick(now) {
  // A gathering starting or ending draws the next wait anew, so petals come thicker as soon as
  // friends gather rather than after the slower wait already drawn.
  if (viewing() !== gathered) {
    gathered = !gathered;
    falling.after(now, wait());
  }
  if (worn && !viewingTime(scene)) {
    for (const v of views.values()) brushPetal(v);
    worn = false;
  }
  if (!falling.due(now) || !viewingTime(scene)) return;
  const standing = [...views.values()].filter(v => (isFree(v) || v.viewing) && !v.drag && !v.petal);
  if (standing.length) landPetal(pick(standing));
}

const WISH_MS = 3500;
/** A petal was caught at `point`: the first one each local day brings the wish of the friend whose
 * feet are nearest that it will come true (garden.wished), later ones only glint. A friend in the hand or already
 * speaking is left alone, and the day is spent only when a line is shown. */
export function wishAt(point) {
  const today = localDay(new Date());
  if (!data.garden || data.garden.wished === today) return;
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    const foot = footOf(v),
      d = Math.hypot(foot.x - point.x, foot.y - point.y);
    if (!v.drag && v.bubble.hidden && d < bestD) [best, bestD] = [v, d];
  }
  if (!best) return;
  data.garden.wished = today;
  call('markWished', today).catch(() => {});
  bubble(best, pick(list('viewing.wish')), WISH_MS);
}
