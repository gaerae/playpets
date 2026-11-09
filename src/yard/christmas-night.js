// Christmas night: on a snowy December evening or night, with the yard showing winter and the
// lights event on, the little Christmas tree lights up and grows into the grand tree, once a night
// (about 2.6 s: a gold veil climbs from the roots and reveals it while the small one fades, the
// star swells once, a warm light pools on the snow, and nearby friends look up). It stays while
// the snow falls and goes back with a short crossfade when it stops; a later turn the same night,
// and reduced motion, are that crossfade too. A night begins on its evening: before 05:00 it is
// still the evening before's.
//
// DOM and CSS only: the grand tree is a layer inside the small tree's own button (made the first
// time it turns grand), the change is keyframes on that layer (garden.css), and one timer ends it,
// so the frame loop (app.js animate) does no more work for it. It is checked when the gifts are
// drawn, at the scene's minute repaint, and when the window is seen again.
//
// The night it last played is kept in webview storage, as the event card's year is (festival.js):
// the app starts at login and reloads after an update, and a page variable alone would play the
// change again then. Losing it only means seeing the change once more.

import { reduced } from '../core/sprites.js';
import { data, recall, remember, views } from '../core/state.js';
import { artSize, artSvg } from './art.js';
import { giftKind } from './catalog.js';
import { decorShown } from './decor-shown.js';
import { renderDecor, shownDecor } from './decor.js';
import { petHeight, sizeOf } from './field.js';
import { localDay } from './growth.js';
import { isFree } from './trips.js';
import { gaze, pose } from './views.js';
import { scene } from './world.js';

// How long the change takes (garden.css .xmas-rise), and how long a nearby friend looks up.
const RISE_MS = 2600,
  GAZE_MS = 2400;
// A friend whose foot is within this many grand-tree widths of the tree's is nearby.
const NEAR_WIDTHS = 2;
// Webview storage: the night (nightOf) the change last played.
const NIGHT_KEY = 'xmas-night';
// A night runs until five in the morning (periodFor: night is 20:00 to 05:00).
const NIGHT_ENDS = 5;

let seen = () => true;
// The tree's button while it stands grand, and the timer that ends its change.
let grand = null,
  riseTimer = null;

/** Whether `scene` (world.js) and the yard's `decor` make Christmas night at `date`. */
export function christmasNight(scene, decor, date) {
  return (
    scene.event === 'lights' &&
    scene.season === 'winter' &&
    (scene.period === 'evening' || scene.period === 'night') &&
    scene.weather === 'snow' &&
    decor.some(d => d.kind === 'xmas_tree') &&
    decorShown('xmas_tree', date, scene.season)
  );
}
/** The local day whose evening `date` belongs to: before 05:00, the day before. */
export function nightOf(date) {
  if (date.getHours() >= NIGHT_ENDS) return localDay(date);
  return localDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12));
}

// The small tree's drawing's size and the grand one's, in their own units.
function sizes() {
  const gift = giftKind('xmas_tree');
  return { small: gift.size || artSize(gift.art), big: artSize(gift.night.art), night: gift.night };
}
const span = className => {
  const node = document.createElement('span');
  node.className = className;
  return node;
};
const percent = share => `${+(share * 100).toFixed(1)}%`;
// The grand tree's layers, made once inside the tree's button: sized from the two drawings and
// standing on the same foot, taking no presses (the small tree's box stays the handle).
function layers(button) {
  if (button.querySelector('.xmas-night')) return;
  const { small, big, night } = sizes();
  const layer = span('xmas-night'),
    reveal = span('xmas-reveal'),
    art = span('xmas-art'),
    star = span('xmas-star');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.width = percent(big[0] / small[0]);
  layer.style.height = percent(big[1] / small[1]);
  art.innerHTML = artSvg(night.art);
  reveal.append(art);
  star.style.left = percent(night.star[0]);
  star.style.top = percent(night.star[1]);
  layer.append(span('xmas-pool'), reveal, span('xmas-veil'), star);
  button.append(layer);
}

// Free friends near the tree look up at its star; a sheet with no look rows waves instead.
function lookUp(at) {
  const { small, big, night } = sizes(),
    w = (at.w * big[0]) / small[0],
    h = (at.h * big[1]) / small[1],
    star = { x: at.x - w / 2 + night.star[0] * w, y: at.y - h + night.star[1] * h };
  for (const v of views.values()) {
    const width = sizeOf(v.pet),
      height = petHeight(v.pet),
      x = v.px + width / 2;
    if (!isFree(v) || Math.hypot(x - at.x, v.py + height - at.y) > w * NEAR_WIDTHS) continue;
    if (v.asset?.version === 2) gaze(v, { x: star.x - x, y: star.y - (v.py + height / 2) }, GAZE_MS);
    else pose(v, 'wave', 1200);
  }
}

// The tree goes back to small at once (its classes' transitions make it a crossfade).
function calm() {
  clearTimeout(riseTimer);
  riseTimer = null;
  grand?.classList.remove('xmas-grand', 'xmas-rise');
  grand = null;
}

/** Brings the tree in line with Christmas night: safe to call at any time, as often as needed. */
export function christmasNightCheck() {
  if (document.hidden || !seen()) return;
  const now = new Date(),
    found = shownDecor('xmas_tree'),
    on = !!found && christmasNight(scene, data.garden?.decor || [], now);
  // Put away, or replaced: the old button lets go, and is named small again for Undo.
  if (grand && grand !== found?.button) {
    calm();
    renderDecor();
  }
  if (on && !grand) {
    const button = found.button,
      night = nightOf(now),
      rise = recall(NIGHT_KEY) !== night && !reduced.matches;
    layers(button);
    remember(NIGHT_KEY, night);
    grand = button;
    button.classList.add('xmas-grand');
    if (rise) {
      button.classList.add('xmas-rise');
      lookUp(found.at);
      riseTimer = setTimeout(() => {
        riseTimer = null;
        button.classList.remove('xmas-rise');
        christmasNightCheck();
      }, RISE_MS);
    }
    // Named grand now; the check this drawing runs finds nothing left to change.
    renderDecor();
  } else if (!on && grand) {
    calm();
    renderDecor();
  }
}

/** Christmas night follows the window: `seen` says whether the app shows it (app.js). */
export function setupChristmasNight({ seen: shows = () => true } = {}) {
  seen = shows;
  document.addEventListener('visibilitychange', christmasNightCheck);
}
