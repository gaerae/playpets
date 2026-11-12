// Christmas night: on a snowy evening or night in a winter yard, with the little Christmas tree
// out, the tree lights up and grows into the grand tree (about 2.6 s: a gold veil climbs from the
// roots and reveals it while the small one fades, the star swells once, a warm light pools on the
// snow, and nearby friends look up). It stays while the snow falls and goes back with a short
// crossfade when it stops. No date is asked for: December brings the winter yard and its gifts on
// its own, and on any other day a person who picks a snowy winter night calls it up
// (docs/decisions/2026-11-12-scenes-before-dates.md). It grows each time the night comes together
// in sight; the first look after a restart or a reload the same night, and reduced motion, are the
// crossfade. A night begins on its evening: before 05:00 it is still the evening before's.
//
// DOM and CSS only: the grand tree is a layer inside the small tree's own button (grand-tree.js,
// made the first time it turns grand), the change is keyframes on that layer (worn.css), and one
// timer ends it, so the frame loop (app.js animate) does no more work for it. It is checked when
// the gifts are drawn, at the scene's minute repaint, and when the window is seen again. The
// desktop's tree follows: the backend is told whether the tree stands grand, seen or not.
//
// With the baby reindeer and Santa out on a night (the moon stands only from 20:00), a while after
// the tree stands grand they look up, the moon brightens through the snow, a sleigh crosses it
// right to left, and gold drifts down from the star; once each time the tree grows, then calm.
// With reduced motion it is a still sleigh over the moon for a moment. Its few timers end it, as
// the change's does.
//
// The night it last played, and the night the sleigh last flew, are kept in webview storage, as
// the event card's year is (festival.js): the app starts at login and reloads after an update, and
// a page variable alone would play them again then. Losing them only means seeing them once more.

import { between, percent } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, call, data, forget, recall, remember, views } from '../core/state.js';
import { artSvg } from './art.js';
import { decorShown, yardSeason } from './decor-shown.js';
import { renderDecor, shownDecor } from './decor.js';
import { petHeight, sizeOf } from './field.js';
import { grandLayers, RISE_MS, treeSizes as sizes } from './grand-tree.js';
import { localDay } from './growth.js';
import { isFree } from './trips.js';
import { gaze, pose } from './views.js';
import { scene } from './world.js';

// How long a nearby friend looks up (the change itself takes RISE_MS).
const GAZE_MS = 2400;
// A friend whose foot is within this many grand-tree widths of the tree's is nearby.
const NEAR_WIDTHS = 2;
// Webview storage: the night (nightOf) the change last played.
const NIGHT_KEY = 'xmas-night';
// A night runs until five in the morning (periodFor: night is 20:00 to 05:00).
const NIGHT_ENDS = 5;
// One bulb glints for GLINT_MS, then the next one a random wait after this one began.
const GLINT_MS = 800,
  GLINT_GAP = [10_000, 16_000];
// The sleigh: a wait after it can fly, so it comes as a surprise; the guests look up in turn; it
// flies (scenery.css .xmas-sleigh.flying), then the motes fall (garden.css .xmas-mote) and the moon
// dims again. A still sleigh stands for STILL_MS with reduced motion.
const SLEIGH_AFTER = [20_000, 60_000],
  GUEST_STEP = 400,
  LOOK_UP_MS = 900,
  FLY_AT = 1200,
  FLY_MS = 4200,
  MOTES = [24, 36],
  STILL_MS = 3000;
// Webview storage: the night (nightOf) the sleigh last flew.
const SLEIGH_KEY = 'xmas-sleigh';
// Each mote starts this share of the grand tree off its star, and waits and falls in these ranges;
// they all stay until the latest and slowest one has fallen.
const MOTE_JITTER = 0.04,
  MOTE_DELAY = [0, 1200],
  MOTE_FALL = [2400, 3600],
  MOTES_MS = MOTE_DELAY[1] + MOTE_FALL[1];

let seen = () => true;
// The tree's button while it stands grand, and the timer that ends its change. `calmSeen`: this page
// saw the tree out and small since it last grew, so the night coming together now is new to it.
let grand = null,
  riseTimer = null,
  calmSeen = false;
// Whether the backend was last told the tree stands grand (null: not told yet, or the telling failed).
let toldGrand = null;
// The glint chain: its timers, and the bulb that glinted last; each button's sparkle node.
let glintTimer = null,
  glintOff = null,
  lastBulb = -1;
const sparkles = new WeakMap();
// The sleigh: the wait before it, the timers of its crossing, and what the crossing has changed
// (the guests looking up, the motes, the moon and the sleigh), so stopping undoes exactly that.
let sleighWait = null,
  sleighTimers = [],
  crossing = false,
  appeared = false,
  lookers = [],
  motes = [];

/** Whether `scene` (world.js) and the yard's `decor` make Christmas night at `date`: a place with
 * seasons showing winter, evening or night, snow, and the tree out. */
export function christmasNight(scene, decor, date) {
  const season = yardSeason(scene);
  return (
    season === 'winter' &&
    (scene.period === 'evening' || scene.period === 'night') &&
    scene.weather === 'snow' &&
    decor.some(d => d.kind === 'xmas_tree') &&
    decorShown('xmas_tree', date, season)
  );
}
/** Whether the sleigh can fly: Christmas night, with the moon up, and every one of `guests` (gift
 * kinds) in the yard's `decor` and shown at `date`. */
export function sleighReady(scene, decor, date, guests) {
  return (
    christmasNight(scene, decor, date) &&
    scene.period === 'night' &&
    guests.every(kind => decor.some(d => d.kind === kind) && decorShown(kind, date, yardSeason(scene)))
  );
}
/** The local day whose evening `date` belongs to: before 05:00, the day before. */
export function nightOf(date) {
  if (date.getHours() >= NIGHT_ENDS) return localDay(date);
  return localDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12));
}

const span = className => {
  const node = document.createElement('span');
  node.className = className;
  return node;
};
// The grand tree's layers in the tree's button (grand-tree.js), taking no presses but through the
// tree-shaped handle ornaments.js adds; its glint node is kept for the glints.
function layers(button) {
  const layer = grandLayers(button);
  if (!sparkles.has(button)) sparkles.set(button, layer.querySelector('.xmas-glint'));
}
// The backend hears whether the tree stands grand, so the desktop's tree does too; told once per
// change, and again at the next check when a telling failed.
function tellDesktop(on) {
  if (toldGrand === on) return;
  toldGrand = on;
  call('decorNight', on ? ['xmas_tree'] : []).catch(() => {
    if (toldGrand === on) toldGrand = null;
  });
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

function stopGlints() {
  clearTimeout(glintTimer);
  clearTimeout(glintOff);
  glintTimer = glintOff = null;
  if (grand) sparkles.get(grand)?.classList.remove('glinting');
}
// One glint on a bulb other than the last, and the timer for the next one; a single timer at a time.
function glintLater() {
  const gap = between(Math.random, GLINT_GAP);
  glintTimer = setTimeout(() => {
    const node = grand && sparkles.get(grand);
    if (!node || reduced.matches || document.hidden || !seen()) return stopGlints();
    const { bulbs } = sizes().night,
      n = bulbs.length;
    lastBulb = (lastBulb + 1 + Math.floor(Math.random() * (n - 1))) % n;
    node.style.left = percent(bulbs[lastBulb][0]);
    node.style.top = percent(bulbs[lastBulb][1]);
    node.classList.add('glinting');
    glintOff = setTimeout(() => node.classList.remove('glinting'), GLINT_MS);
    glintLater();
  }, gap);
}
function startGlints() {
  if (glintTimer || reduced.matches) return;
  lastBulb = -1;
  glintLater();
}

// The sleigh ends at once, waiting or flying: every timer, and everything it changed.
function stopSleigh() {
  clearTimeout(sleighWait);
  sleighWait = null;
  for (const timer of sleighTimers) clearTimeout(timer);
  sleighTimers = [];
  if (!crossing) return;
  crossing = false;
  // Stopped before the sleigh showed itself: nobody saw it, so the night is not used up.
  if (!appeared) forget(SLEIGH_KEY);
  for (const button of lookers) button.classList.remove('look-up');
  for (const mote of motes) mote.remove();
  lookers = [];
  motes = [];
  $('yard')?.classList.remove('xmas-moon');
  const sleigh = $('xmas-sleigh');
  if (sleigh) {
    sleigh.classList.remove('flying', 'still');
    sleigh.hidden = true;
  }
}
const later = (ms, step) => sleighTimers.push(setTimeout(step, ms));
// The guests' buttons when the sleigh can fly now, else null. A guest waiting out its Undo after
// being put away is still in the garden but not in the yard.
function sleighGuests(now) {
  const { guests } = sizes().night;
  if (!grand || !sleighReady(scene, data.garden?.decor || [], now, guests)) return null;
  const buttons = guests.map(kind => shownDecor(kind)?.button);
  return buttons.every(Boolean) ? buttons : null;
}
function lookUpAt(button) {
  button.classList.add('look-up');
  lookers.push(button);
  later(LOOK_UP_MS, () => button.classList.remove('look-up'));
}
// Gold drifts down from the star, each mote on one of three paths with its own wait and pace.
function dropMotes() {
  const layer = grand?.querySelector('.xmas-night');
  if (!layer) return;
  const [x, y] = sizes().night.star,
    jitter = () => (Math.random() * 2 - 1) * MOTE_JITTER,
    count = Math.round(between(Math.random, MOTES));
  for (let i = 0; i < count; i++) {
    const mote = span(`xmas-mote m${i % 3}`);
    mote.style.left = percent(x + jitter());
    mote.style.top = percent(y + jitter());
    mote.style.animationDelay = `${Math.round(between(Math.random, MOTE_DELAY))}ms`;
    mote.style.animationDuration = `${Math.round(between(Math.random, MOTE_FALL))}ms`;
    motes.push(mote);
  }
  layer.append(...motes);
}
function crossMoon(guests) {
  const sleigh = $('xmas-sleigh');
  if (!sleigh) return;
  crossing = true;
  appeared = false;
  $('yard')?.classList.add('xmas-moon');
  if (!sleigh.innerHTML) sleigh.innerHTML = artSvg(sizes().night.sleigh);
  const show = name => {
    sleigh.classList.add(name);
    sleigh.hidden = false;
    appeared = true;
  };
  if (reduced.matches) {
    show('still');
    later(STILL_MS, stopSleigh);
    return;
  }
  guests.forEach((button, i) => (i ? later(i * GUEST_STEP, () => lookUpAt(button)) : lookUpAt(button)));
  later(FLY_AT, () => show('flying'));
  later(FLY_AT + FLY_MS, () => {
    sleigh.classList.remove('flying');
    sleigh.hidden = true;
    dropMotes();
  });
  later(FLY_AT + FLY_MS + MOTES_MS, stopSleigh);
}
// Waits for the sleigh when it can fly tonight and has not; ends it the moment it cannot.
function sleighCheck(now) {
  if (!sleighGuests(now)) return stopSleigh();
  if (grand.classList.contains('xmas-rise') || sleighWait || crossing || recall(SLEIGH_KEY) === nightOf(now)) return;
  sleighWait = setTimeout(
    () => {
      sleighWait = null;
      const at = new Date(),
        guests = sleighGuests(at);
      if (!guests || document.hidden || !seen()) return;
      remember(SLEIGH_KEY, nightOf(at));
      crossMoon(guests);
    },
    between(Math.random, SLEIGH_AFTER),
  );
}

// The tree goes back to small at once (its classes' transitions make it a crossfade).
function calm() {
  stopSleigh();
  stopGlints();
  clearTimeout(riseTimer);
  riseTimer = null;
  grand?.classList.remove('xmas-grand', 'xmas-rise');
  grand = null;
}

/** Brings the tree in line with Christmas night: safe to call at any time, as often as needed. */
export function christmasNightCheck() {
  const now = new Date(),
    night = christmasNight(scene, data.garden?.decor || [], now);
  // The desktop is not hidden with the window.
  tellDesktop(night);
  if (document.hidden || !seen()) {
    stopSleigh();
    return stopGlints();
  }
  const found = shownDecor('xmas_tree'),
    on = !!found && night;
  // Put away, or replaced: the old button lets go, and is named small again for Undo.
  if (grand && grand !== found?.button) {
    calm();
    renderDecor();
  }
  if (found && !on) calmSeen = true;
  if (on && !grand) {
    const button = found.button,
      tonight = nightOf(now),
      // New to this page: a new night, or one called up again after it was seen small.
      fresh = recall(NIGHT_KEY) !== tonight || calmSeen,
      rise = fresh && !reduced.matches;
    layers(button);
    remember(NIGHT_KEY, tonight);
    // Each time the tree grows, the sleigh may cross the moon once more.
    if (fresh) forget(SLEIGH_KEY);
    calmSeen = false;
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
  // Standing grand and settled (not mid-change) with no chain yet: begin the glints.
  if (grand && !grand.classList.contains('xmas-rise')) startGlints();
  sleighCheck(now);
}

/** Christmas night follows the window: `seen` says whether the app shows it (app.js). */
export function setupChristmasNight({ seen: shows = () => true } = {}) {
  seen = shows;
  calmSeen = false;
  toldGrand = null;
  document.addEventListener('visibilitychange', christmasNightCheck);
}
