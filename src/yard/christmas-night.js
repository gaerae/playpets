// Christmas night: on a snowy evening or night in a winter yard, with the little Christmas tree
// out, the tree lights up and grows into the grand tree (about 2.6 s: a gold veil climbs from the
// roots and reveals it while the small one fades, the star swells once, a warm light pools on the
// snow, a warm light blooms over the snow and the friends near it, and they look up). It stays
// while the snow falls, in a warm halo over a pool of light that both breathe slowly, its bulbs
// twinkling a few at a time and gold flecks drifting round it, and goes back with a short crossfade
// when it stops. No date is asked for: the winter lights bring the winter yard and its gifts
// on their own, and on any other day a person who picks a snowy winter night calls it up
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
// right to left trailing a ribbon of gold that lets dust fall along its way, and gold drifts down
// from the star; once each time the tree grows, then calm.
// With reduced motion it is a still sleigh over the moon for a moment. Its few timers end it, as
// the change's does.
//
// The night it last played, and the night the sleigh last flew, are kept in webview storage, as
// the event card's year is (festival.js): the app starts at login and reloads after an update, and
// a page variable alone would play them again then. Losing them only means seeing them once more.

import { span } from '../core/dom.js';
import { between, percent } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, call, data, forget, recall, remember, views } from '../core/state.js';
import { artSvg } from './art.js';
import { decorShown, yardSeason } from './decor-shown.js';
import { renderDecor, shownDecor } from './decor.js';
import { petHeight, sizeOf } from './field.js';
import { GLINTS, grandLayers, RISE_MS, treeSizes as sizes } from './grand-tree.js';
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
// Now and then a run of bulbs glints, one after another RUN_STEP apart, each for GLINT_MS, while the
// star breathes with them; the next run comes a random wait after this one began.
const GLINT_MS = 800,
  RUN_STEP = 350,
  RUN_MS = (GLINTS - 1) * RUN_STEP + GLINT_MS,
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
// The glint chain: the wait for the next run, the timers of the run that glints, and the bulb the
// last run began on; each button's layer and its glint nodes.
let glintTimer = null,
  runTimers = [],
  lastBulb = -1;
const sparkles = new WeakMap();
// The sleigh: the wait before it, the timers of its crossing, and what the crossing has changed
// (the guests looking up, the motes, the moon and the sleigh), so stopping undoes exactly that.
let sleighWait = null,
  sleighTimers = [],
  crossing = false,
  appeared = false,
  lookers = [],
  motes = [],
  dust = null;
// The warm light that blooms round the tree while it grows (garden.css .xmas-bloom).
let bloom = null;
// The lit tree's own light in the yard (garden.css): its bulbs in three warm groups that twinkle in
// turn, each bulb a soft glow this share of the drawing's width across, and gold flecks round it.
const LIGHTS = ['#ffd27a', '#ffb08f', '#fff0c8'],
  BULB_R = 0.06,
  FLECKS = 5;
// The sleigh's flight (scenery.css xmas-sleigh-fly) as [share of its time, x, y], in shares of the
// sleigh's own size, and where the dust leaves it (its back, as it flies right to left); DUST motes
// fall along the way, each where the sleigh was when it let go.
const FLIGHT = [
    [0, 1.7, -0.3],
    [0.5, -0.5, -0.62],
    [1, -2.7, -0.78],
  ],
  DUST_FROM = [0.82, 0.55],
  DUST = 18;

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

// The grand tree's layers in the tree's button (grand-tree.js), taking no presses but through the
// tree-shaped handle ornaments.js adds; its glint nodes are kept for the glints.
function layers(button) {
  const layer = grandLayers(button);
  if (sparkles.has(button)) return;
  sparkles.set(button, { layer, glints: [...layer.children].filter(c => c.classList?.contains('xmas-glint')) });
  yardLight(layer);
}
// What only the yard's lit tree has (the desktop's stays still): a halo behind it, its bulbs
// glowing in three warm groups, and the flecks; garden.css breathes and twinkles them.
function yardLight(layer) {
  const { big, night } = sizes(),
    across = BULB_R * 100,
    down = (BULB_R * 100 * big[0]) / big[1],
    lights = span('xmas-lights'),
    flecks = span('xmas-flecks');
  layer.insertBefore(span('xmas-halo'), layer.firstChild ?? layer.children[0]);
  LIGHTS.forEach((color, k) => {
    const group = span(`g${k}`);
    group.style.backgroundImage = night.bulbs
      .filter((_, i) => i % LIGHTS.length === k)
      .map(
        ([x, y]) =>
          `radial-gradient(ellipse ${across}% ${down.toFixed(2)}% at ${percent(x)} ${percent(y)}, ${color} 0, ${color}cc 22%, ${color}40 55%, ${color}00 100%)`,
      )
      .join(', ');
    lights.append(group);
  });
  for (let i = 0; i < FLECKS; i++) flecks.append(span(`f${i}`));
  layer.append(lights, flecks);
}

// While the tree grows, a warm light blooms round it, over the snow and the friends near it.
function bloomAt(at) {
  const { small, big } = sizes(),
    h = (at.h * big[1]) / small[1];
  endBloom();
  bloom = span('xmas-bloom');
  bloom.setAttribute('aria-hidden', 'true');
  bloom.style.left = `${Math.round(at.x)}px`;
  bloom.style.top = `${Math.round(at.y - h * 0.4)}px`;
  bloom.style.width = `${Math.round(h * 2.6)}px`;
  $('yard')?.append(bloom);
}
function endBloom() {
  bloom?.remove();
  bloom = null;
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

function endRun() {
  for (const timer of runTimers) clearTimeout(timer);
  runTimers = [];
  const lit = grand && sparkles.get(grand);
  if (!lit) return;
  for (const node of lit.glints) node.classList.remove('glinting');
  lit.layer.classList.remove('shimmer');
}
function stopGlints() {
  clearTimeout(glintTimer);
  glintTimer = null;
  endRun();
}
// The bulbs of a run: the first other than the last run's first, each next one a few bulbs on, so a
// run walks over the tree instead of lighting one spot.
function runBulbs(n) {
  lastBulb = (lastBulb + 1 + Math.floor(Math.random() * (n - 1))) % n;
  const picked = [lastBulb];
  while (picked.length < GLINTS) picked.push((picked.at(-1) + 2 + Math.floor(Math.random() * 3)) % n);
  return picked;
}
// One run of glints, and the timer for the next one; a single wait at a time.
function glintLater() {
  const gap = between(Math.random, GLINT_GAP);
  glintTimer = setTimeout(() => {
    const lit = grand && sparkles.get(grand);
    if (!lit?.glints.length || reduced.matches || document.hidden || !seen()) return stopGlints();
    endRun();
    const { bulbs } = sizes().night;
    lit.layer.classList.add('shimmer');
    runBulbs(bulbs.length).forEach((bulb, i) => {
      const node = lit.glints[i % lit.glints.length],
        on = () => {
          node.style.left = percent(bulbs[bulb][0]);
          node.style.top = percent(bulbs[bulb][1]);
          node.classList.add('glinting');
        };
      if (i) runTimers.push(setTimeout(on, i * RUN_STEP));
      else on();
      runTimers.push(setTimeout(() => node.classList.remove('glinting'), i * RUN_STEP + GLINT_MS));
    });
    runTimers.push(setTimeout(() => lit.layer.classList.remove('shimmer'), RUN_MS));
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
  dust?.remove();
  lookers = [];
  motes = [];
  dust = null;
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
// Gold drifts down from the star, each mote on one of three swaying paths, in one of three sizes,
// with its own wait and pace.
function dropMotes() {
  const layer = grand?.querySelector('.xmas-night');
  if (!layer) return;
  const [x, y] = sizes().night.star,
    jitter = () => (Math.random() * 2 - 1) * MOTE_JITTER,
    count = Math.round(between(Math.random, MOTES));
  for (let i = 0; i < count; i++) {
    const mote = span(`xmas-mote m${i % 3} s${(i + Math.floor(i / 3)) % 3}`);
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
  // The sleigh, and the gold dust it trails (scenery.css .xmas-trail).
  if (!sleigh.innerHTML) sleigh.innerHTML = `${artSvg(sizes().night.sleigh)}<i class="xmas-trail"></i>`;
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
  later(FLY_AT, () => {
    show('flying');
    dropDust();
  });
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

// Where the sleigh is at a share `t` of its flight, in shares of its size (FLIGHT).
function flownTo(t) {
  const at = FLIGHT.findIndex(([share]) => share >= t),
    [s0, x0, y0] = FLIGHT[Math.max(0, at - 1)],
    [s1, x1, y1] = FLIGHT[at],
    k = s1 > s0 ? (t - s0) / (s1 - s0) : 0;
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
}
// Gold dust falls from the sleigh along its way, each mote waiting until the sleigh passes, then
// lingering a moment and falling (scenery.css .xmas-dust). It sits with the sleigh, over the moon.
function dropDust() {
  dust = span('xmas-dust');
  dust.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < DUST; i++) {
    const t = 0.06 + (0.86 * i) / (DUST - 1),
      [x, y] = flownTo(t),
      mote = span(`d${i % 3}`);
    mote.style.left = percent(x + DUST_FROM[0]);
    mote.style.top = percent(y + DUST_FROM[1]);
    mote.style.animationDelay = `${Math.round(t * FLY_MS)}ms`;
    dust.append(mote);
  }
  $('yard')?.append(dust);
}

// The tree goes back to small at once (its classes' transitions make it a crossfade).
function calm() {
  stopSleigh();
  stopGlints();
  clearTimeout(riseTimer);
  riseTimer = null;
  endBloom();
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
      bloomAt(found.at);
      riseTimer = setTimeout(() => {
        riseTimer = null;
        endBloom();
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
