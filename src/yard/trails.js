// Faint footprint trails across the winter yard, each ending at a snowy bush (the rules are
// trail-rules.js's), and a friend following one there (followTrail).
//
// - Static marks: a trail is drawn once, as one SVG of <use> prints below everything on the field,
//   and changed only when its opacity steps, new snow covers it, or the yard changes size. Nothing
//   runs in the frame loop, so an idle winter yard still draws nothing.
// - Checked with the scene, once a minute (app.js seasonChanged): the day's trails come, soften,
//   and go under new snow or with the next day.
// - The day's first sight of the yard is kept in the webview's storage, not in state.json: a trail
//   is a look of one day, and losing it only lays the day's trail again from now.
// - A day's paths are worked out once per place and size and kept here, so a dig or a gift placed
//   later does not move a trail already on the snow.
// - A follow is recorded when the tail shows, not when the friend sets off: taking the friend away
//   before that leaves the trail to follow again. The dig at the end is discovery.js's, handed in
//   through setupTrails so this module never imports it (discovery.js asks atTrailEnd).
import { list, t } from '../core/i18n.js';
import { clamp, pick } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, call, data, game, recall, remember, selected, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { artHref, artSize, artSvg } from './art.js';
import { showCard } from './card.js';
import { TRACKS, trackKind, trailArt } from './catalog.js';
import { yardSeason } from './decor-shown.js';
import { behind, dugSpots, tileOf } from './discovery-rules.js';
import { depthAt, fieldToYard, footTarget, petHeight, sizeOf, yardZoom } from './field.js';
import { groundProfile } from './ground.js';
import { localDay } from './growth.js';
import { STROLL } from './motion.js';
import { autoWeather } from './scene.js';
import { chosenWeather } from './sky.js';
import { tailPeek } from './trail-art.js';
import {
  coveredAt,
  endZoom,
  laidAt,
  seedOf,
  stamps,
  trailAnimal,
  trailOpacity,
  trailPath,
  trailsOn,
} from './trail-rules.js';
import { isFree, release, sendTo } from './trips.js';
import { bubble } from './views.js';
import { holdAtWork, stopWork } from './work.js';
import { scene } from './world.js';

const NS = 'http://www.w3.org/2000/svg';
// How long a covered trail takes to fade before it leaves (garden.css .trail transition).
const FADE_MS = 3000;
// Prints shrink with the yard only this far: smaller, they are specks in the snow's grain.
const PRINT_ZOOM_MIN = 0.7;
// A follow: the sniffing walk takes 6 to 8 s at a friend's stroll; the tail shows for a second,
// whisks away, and the dig starts a moment later. The first dig within a minute of that, near the
// end, finds the trail's.
const WALK_MS = [6000, 8000],
  PEEK_MS = 1000,
  WHISK_MS = 400,
  PUFF_MS = 600,
  END_MS = 60000,
  END_NEAR = 0.06;
// How far from the bush's middle the friend stops, in the bush's units (endZoom), past the tail's tip
// (garden.css .tail-peek), so neither the friend nor its bubble covers the tail.
const STAND = 26;

const defaultWeather = ms => (chosenWeather() === 'auto' ? autoWeather(ms, 'winter') : chosenWeather());
let deps = {
  profile: groundProfile,
  weather: defaultWeather,
  toYard: fieldToYard,
  zoom: yardZoom,
  dig: () => {},
  rested: () => true,
  card: showCard,
  visible: () => true,
};
// The trails on the yard by number: their nodes, the opacity last written, whether snow covered
// them, whether they were followed, and the follow under way.
const drawn = new Map();
// The day's paths for the place and size in `pathsFor`, by trail number (null: no room for one).
let paths = new Map(),
  pathsFor = '';
// Trail ends a friend has just reached: { point, animal, until }.
let ends = [];
// A change of day or place came while a friend followed a trail: the trails are laid out again once
// the follow is over, so the walk, the peek and the dig keep the drawing they began with. A change
// of size only redraws the followed trail on its own path at once (redraw).
let relay = false;
// What a trail end shows at a follow's end; the next follow starts without them.
const TAIL = ['peek', 'peek-still', 'whisk', 'dive', 'fade'];
// What a redrawn trail keeps of the nodes it replaces.
const STATES = ['following', 'covered', ...TAIL];
// The garden layers and documents whose events are already heard (setupTrails may be called again).
const wired = new WeakSet();

/** `profile`, `weather`, `toYard` and `zoom` replace the yard's own (tests); `dig(v, point)` sends a
 * friend to dig at a trail's end and `rested(v)` says whether it may dig yet (app.js hands in
 * discovery.js's); `card` shows the first follow of an animal; `visible()` says whether the yard
 * can be seen (app.js: the window shown and the page not hidden). */
export function setupTrails({
  profile = groundProfile,
  weather = defaultWeather,
  toYard = fieldToYard,
  zoom = yardZoom,
  dig = () => {},
  rested = () => true,
  card = showCard,
  visible = () => true,
} = {}) {
  deps = { profile, weather, toYard, zoom, dig, rested, card, visible };
  clear();
  paths = new Map();
  pathsFor = '';
  relay = false;
  if (!wired.has(document)) {
    wired.add(document);
    document.addEventListener('visibilitychange', trailsSeen);
  }
  const layer = $('garden-layer');
  if (!layer || wired.has(layer)) return;
  wired.add(layer);
  // A press on the prints, or Enter on the follow button. With a tool in hand, in a game, or over
  // a creature to catch, the press is the yard's (garden.css also lets it through).
  layer.addEventListener('click', event => {
    const target = event.target.closest?.('.trail-hit, .trail-follow');
    if (!target || game || aiming || $('yard')?.classList.contains('can-catch')) return;
    event.stopPropagation();
    followTrail(Number(target.closest('[data-trail]').dataset.trail));
  });
}

/** Lays the trails out again on the yard's new size or land (app.js, once the yard is measured
 * again or its land redrawn). The place and size are the trails' key (trailsCheck): a resize that
 * leaves them as they were, as each step of the side panel opening can, draws nothing again. */
export function resizeTrails() {
  trailsCheck();
}

/** The window was hidden or shown (app.js, and the page's own visibilitychange). Shown, the yard is
 * checked at once, so a day's first sight lays its trail; hidden, a friend still on its way along the
 * prints gives up, since nobody would see the tail, and one that has seen it finishes. */
export function trailsSeen() {
  if (deps.visible()) return trailsCheck();
  for (const trail of drawn.values()) if (trail.follow && !trail.follow.seen) stopFollow(trail);
}

// A follow is over (finished or called off): a change of place or size it held back is laid out now,
// after the code that ended it has run.
function settle() {
  if (!relay) return;
  relay = false;
  queueMicrotask(() => trailsCheck());
}

function forget(n) {
  const trail = drawn.get(n);
  if (!trail) return;
  clearTimeout(trail.timer);
  stopFollow(trail);
  for (const node of trail.nodes) node.remove();
  drawn.delete(n);
}
// No trails on the yard, and no end a dig could still name.
function clear() {
  for (const n of drawn.keys()) forget(n);
  ends = [];
}

// The day's record: when the yard was first seen and the trails followed; null before that (bad or
// old data counts as none).
function recorded(now) {
  let saved = null;
  try {
    saved = JSON.parse(recall('trails'));
  } catch {}
  return saved?.day === localDay(now) && Number.isFinite(saved.seen) && Array.isArray(saved.followed) ? saved : null;
}
// The day's record, started from now when there is none.
function today(now) {
  let saved = recorded(now);
  if (!saved) {
    saved = { day: localDay(now), seen: now.getTime(), followed: [] };
    remember('trails', JSON.stringify(saved));
  }
  return saved;
}

// Today's digs in this place, as the trails' ends keep off them.
const taken = now => dugSpots(data.garden?.digs, scene.world, now.getTime());

function pathOf(n, day, profile, now) {
  if (!paths.has(n)) {
    const other = n === 1 ? (pathOf(0, day, profile, now)?.end ?? null) : null;
    const skip = taken(now);
    let path = null;
    for (let i = 0; i < 4 && !path; i++) {
      path = trailPath(seedOf(day, n), profile, { taken: skip, other });
      if (!path) break;
      if (behind(path.end, profile)) {
        skip.push(path.end);
        path = null;
      }
    }
    paths.set(n, path);
  }
  return paths.get(n);
}

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}
const px = n => `${Math.round(n * 10) / 10}px`;
const round = n => Math.round(n * 100) / 100;
// The yard's width: the field's right edge and the side room fieldToYard keeps at its left.
const yardWidth = () => deps.toYard({ x: 1, y: 0 }).x + deps.toYard({ x: 0, y: 0 }).x;

function draw(n, track, path, followed) {
  const { toYard, zoom } = deps,
    width = yardWidth(),
    points = path.points.map(toYard),
    [w, h] = artSize(track.print),
    marks = stamps(points, track.gait, Math.max(zoom(), PRINT_ZOOM_MIN)).filter(s => s.x >= 0 && s.x <= width);
  const svg = el('svg', { 'aria-hidden': 'true' });
  svg.classList.add('trail');
  svg.dataset.trail = String(n);
  svg.dataset.animal = track.id;
  svg.style.zIndex = '0';
  for (const s of marks) {
    const print = el('use', {
      href: artHref(track.print),
      x: -w / 2,
      y: -h / 2,
      width: w,
      height: h,
      transform: `translate(${round(s.x)} ${round(s.y)}) rotate(${round(s.angle)}) scale(${round(s.size / w)})`,
    });
    print.classList.add('print');
    svg.append(print);
  }
  const end = document.createElement('span');
  end.className = 'trail-end';
  end.dataset.trail = String(n);
  const at = toYard(path.end);
  Object.assign(end.style, { left: px(at.x), top: px(at.y), zIndex: String(depthAt(at.y)) });
  end.style.setProperty('--u', `${endZoom(zoom())}px`);
  // Bare twigs show what is behind them, so the tail always peeks from the evergreen bush; the
  // twigs stand beside it, behind, on the side the tail is not.
  const exit = path.exit === 'left' ? 'mirror' : '';
  end.innerHTML =
    (path.bush === 'twigs' ? artSvg(trailArt('twigs'), `class="trail-twigs ${exit}"`) : '') +
    tailPeek(track, 'bush', exit);
  const nodes = [svg, end];
  let hit = null,
    button = null;
  if (!followed && marks.length) {
    hit = el('polyline', { points: points.map(p => `${round(p.x)},${round(p.y)}`).join(' ') });
    hit.classList.add('trail-hit');
    svg.append(hit);
    const middle = marks[Math.floor(marks.length / 2)];
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'trail-follow';
    button.dataset.trail = String(n);
    button.setAttribute('aria-label', t('trail.follow'));
    Object.assign(button.style, { left: px(middle.x), top: px(middle.y) });
    nodes.push(button);
  }
  if (followed) for (const node of [svg, end]) node.classList.add('followed');
  $('garden-layer').append(...nodes);
  return { nodes, svg, end, hit, button, track, path, followed, follow: null, opacity: null, covered: false, timer: 0 };
}

// A trail under way drawn again on the yard's new size: the same path and state in new nodes, and
// its friend headed for the same print where it now lies.
function redraw(n, trail) {
  const fresh = draw(n, trail.track, trail.path, trail.followed);
  for (const [from, to] of [
    [trail.svg, fresh.svg],
    [trail.end, fresh.end],
  ])
    for (const name of STATES) if (from.classList.contains(name)) to.classList.add(name);
  if (trail.opacity !== null) fresh.svg.style.setProperty('--trail-opacity', String(trail.opacity));
  const focused = trail.button && document.activeElement === trail.button;
  for (const node of trail.nodes) node.remove();
  Object.assign(trail, { nodes: fresh.nodes, svg: fresh.svg, end: fresh.end, hit: fresh.hit, button: fresh.button });
  if (focused) trail.button?.focus();
  trail.follow?.retarget();
}

/** Brings the yard's trails in line with the day, the season, the place and the weather. */
export function trailsCheck(now = new Date()) {
  const profile = yardSeason(scene) === 'winter' ? deps.profile() : null;
  // The day's sure trail is laid when the yard is first seen that day: the checks that come while
  // nobody can see it (the minute's repaint runs hidden too) wait for that.
  if (!profile?.soil || !TRACKS.length || (!recorded(now) && !deps.visible())) {
    clear();
    return;
  }
  const saved = today(now),
    { toYard, zoom, weather } = deps,
    origin = toYard({ x: 0, y: 0 }),
    corner = toYard({ x: 1, y: 1 }),
    where = `${saved.day}|${scene.world}|`,
    place = `${where}${origin.x},${origin.y}|${corner.x}x${corner.y}|${zoom()}`;
  if (place !== pathsFor) {
    const busy = [...drawn].filter(([, trail]) => trail.follow);
    if (busy.length && !pathsFor.startsWith(where)) {
      relay = true;
      return;
    }
    // A new size: a trail being followed keeps its path, drawn again where it now lies; the others
    // are laid out afresh.
    for (const n of drawn.keys()) if (!busy.some(([m]) => m === n)) forget(n);
    if (!pathsFor.startsWith(where)) ends = [];
    paths = new Map(busy.map(([n, trail]) => [n, trail.path]));
    pathsFor = place;
    for (const [n, trail] of busy) redraw(n, trail);
  }
  const ms = now.getTime(),
    ids = TRACKS.map(k => k.id),
    shown = new Set();
  for (const n of trailsOn(now, weather)) {
    const laid = laidAt(n, now, saved.seen);
    if (ms < laid) continue;
    let trail = drawn.get(n);
    if (trail?.covered) {
      shown.add(n);
      continue;
    }
    if (coveredAt(laid, ms, weather) !== null) {
      if (!trail) continue;
      // New snow: the trail fades under it, then leaves.
      trail.covered = true;
      // A friend still on its way gives up; once the tail has shown, the follow finishes.
      if (!trail.follow?.seen) stopFollow(trail);
      for (const node of trail.nodes) node.classList.add('covered');
      trail.timer = setTimeout(() => forget(n), FADE_MS);
      shown.add(n);
      continue;
    }
    const path = pathOf(n, saved.day, profile, now),
      track = trackKind(trailAnimal(saved.day, n, ids));
    if (!path || !track) continue;
    if (!trail) {
      trail = draw(n, track, path, saved.followed.includes(n));
      drawn.set(n, trail);
    }
    const opacity = trailOpacity(laid, ms);
    if (opacity !== trail.opacity) {
      trail.svg.style.setProperty('--trail-opacity', String(opacity));
      trail.opacity = opacity;
    }
    shown.add(n);
  }
  for (const n of drawn.keys()) if (!shown.has(n)) forget(n);
}

// The friend for a trail: the selected one when it is free and rested, else the nearest such
// friend to where the trail starts (yard pixels).
function followerFor(start) {
  const ready = v => isFree(v) && deps.rested(v);
  const first = views.get(selected);
  if (first && ready(first)) return first;
  let best = null,
    bestD = Infinity;
  for (const v of views.values()) {
    if (!ready(v)) continue;
    const d = Math.hypot(v.px + sizeOf(v.pet) / 2 - start.x, v.py + petHeight(v.pet) - start.y);
    if (d < bestD) [best, bestD] = [v, d];
  }
  return best;
}

function marking(trail, on) {
  for (const node of [trail.svg, trail.end]) node.classList.toggle('following', on);
}

// Calls a follow off: before the tail shows nothing was recorded, so the trail can be followed
// again; after, only what is still to come (the whisk, the dig) is dropped.
function stopFollow(trail) {
  const follow = trail.follow;
  if (!follow) return;
  trail.follow = null;
  for (const timer of follow.timers) clearTimeout(timer);
  marking(trail, false);
  follow.v.button?.classList.remove('sniffing', 'sniff-left');
  if (follow.v.trip?.cancel === follow.cancel || follow.v.doing?.end === follow.end) release(follow.v);
  settle();
}

/** Sends a free friend sniffing along trail `n` to its bush, where the animal's tail peeks out and
 * whisks away, then the friend digs there (the dig's context names the trail's animal). */
export function followTrail(n) {
  const trail = drawn.get(n);
  if (!trail || trail.covered || trail.followed || trail.follow || game || aiming) return;
  const { path } = trail,
    still = reduced.matches,
    width = yardWidth(),
    pixels = path.points.map(deps.toYard),
    from = Math.max(
      0,
      pixels.findIndex(p => p.x >= 0 && p.x <= width),
    );
  const v = followerFor(pixels[from]);
  if (!v) return toast(t('catch.busy'));
  // The friend stops beside the bush on the side the tail shows (the side the trail came from),
  // and the prints it would pass on the way back from there are left out.
  const side = path.exit === 'left' ? 1 : -1,
    standAt = () => {
      const end = deps.toYard(path.end);
      return { x: end.x + side * (STAND * endZoom(deps.zoom()) + sizeOf(v.pet) / 2), y: end.y };
    },
    stand = standAt(),
    way = still ? [] : pixels.slice(from, -1).map((p, i) => ({ ...p, i: from + i }));
  while (way.length > 1 && side * (way.at(-1).x - stand.x) < 0) way.pop();
  // The prints walked, by their place on the path, so a new size can find them again (retarget).
  const along = way.map(p => p.i),
    stopsNow = () => {
      const drawnAt = path.points.map(deps.toYard);
      return [...along.map(i => drawnAt[i]), standAt()].map(p => footTarget(v, p.x, p.y));
    };
  let stops = stopsNow();
  let length = 0;
  for (let i = 1; i < stops.length; i++) length += Math.hypot(stops[i].x - stops[i - 1].x, stops[i].y - stops[i - 1].y);
  const speed = length / clamp(length / STROLL, ...WALK_MS);
  const follow = { v, seen: false, lost: false, timers: [], cancel: null, end: null, retarget: null };
  follow.cancel = () => {
    if (trail.follow === follow && !follow.seen) stopFollow(trail);
  };
  // The trail drawn again on a new size: the friend heads for the same print where it now lies.
  follow.retarget = () => {
    stops = stopsNow();
    if (!follow.seen && v.trip?.cancel === follow.cancel) v.target = stops[leg];
  };
  follow.end = () => {
    follow.lost = true;
    stopWork(v);
  };
  let leg = 0;
  trail.follow = follow;
  marking(trail, true);
  bubble(v, pick(list('trail.sniff')));
  if (!still) v.button?.classList.add('sniffing');
  const go = () => {
    const target = stops[leg];
    if (!still) v.button?.classList.toggle('sniff-left', target.x < v.x);
    sendTo(v, target, { arrive, cancel: follow.cancel, save: false, speed: leg ? speed : 0 });
  };
  const arrive = () => {
    if (trail.follow !== follow) return;
    if (++leg < stops.length) return go();
    peek(n, trail, follow, still);
  };
  go();
}

// The end of the walk: the tail peeks out and the follow is recorded; a second later the tail
// whisks away (a bird ducks into the bush), and the friend digs where it was. The record is kept
// here only once the backend has it: a follow it could not save leaves the trail to follow again,
// and the dig still goes on (its find is the dig's own).
function peek(n, trail, follow, still) {
  const { v } = follow,
    { track, path } = trail,
    name = t(`track.${track.id}`);
  // Hidden on the way (a timer or a frame slipped through): nobody would see the tail.
  if (!deps.visible()) return stopFollow(trail);
  follow.seen = true;
  v.button?.classList.remove('sniffing', 'sniff-left');
  holdAtWork(v, follow.end);
  // A follow whose record failed left its whisk on the bush, which would hide this peek. The end
  // is read from the trail each time: a new size draws it again (redraw).
  trail.end.classList.remove(...TAIL);
  trail.end.classList.add(still ? 'peek-still' : 'peek');
  bubble(v, t('trail.seen', { animal: name }));
  call('followTracks', track.id)
    .then(result => {
      // A trail laid out again meanwhile (a new size) is drawn afresh from the day's record.
      const now = drawn.get(n) ?? trail;
      now.followed = true;
      for (const node of [now.svg, now.end]) node.classList.add('followed');
      // Nothing is left to press: the button would only say no.
      if (now.button && document.activeElement === now.button) $('yard')?.focus();
      for (const node of [now.hit, now.button]) node?.remove();
      const saved = today(new Date());
      if (!saved.followed.includes(n)) {
        saved.followed.push(n);
        remember('trails', JSON.stringify(saved));
      }
      if (result?.first) deps.card(tailPeek(track), name, '', true, 'track');
    })
    .catch(e => toast(spoken(e, t('error.generic')), { error: true }));
  const later = (ms, fn) => follow.timers.push(setTimeout(fn, ms));
  later(PEEK_MS, () => {
    const { end } = trail;
    end.classList.add(still ? 'fade' : track.bird ? 'dive' : 'whisk');
    if (!still && !track.bird) {
      const puff = document.createElement('span');
      puff.className = `puff${path.exit === 'left' ? ' mirror' : ''}`;
      puff.innerHTML = artSvg(trailArt('puff'));
      end.append(puff);
      later(PUFF_MS, () => puff.remove());
    }
    later(WHISK_MS, () => {
      marking(trail, false);
      const now = Date.now();
      ends = ends.filter(e => now < e.until);
      ends.push({ point: path.end, animal: track.id, until: now + END_MS });
      // The follow is over: the dig is discovery.js's, and taking the friend now ends only that.
      trail.follow = null;
      if (!follow.lost) deps.dig(v, path.end);
      settle();
    });
  });
}

/** Whether `point` (field coordinates) is on the dig tile where a trail on the yard ends and its
 * follow's dig is still to come: a friend digging a spot of its own choosing keeps off it
 * (discovery.js autoDig), so the follow never ends at a hole already dug. */
export function reservedForTrail(point, now = Date.now()) {
  const tile = tileOf(point);
  for (const trail of drawn.values())
    if (!trail.followed && !trail.covered && tileOf(trail.path.end) === tile) return true;
  return ends.some(e => now < e.until && tileOf(e.point) === tile);
}

/** The animal whose trail ends near `point` (field coordinates), while a friend that just followed
 * it may dig there; otherwise null. A dig asks once, as it begins (discovery.js), and takes the end:
 * a second dig there finds what any ground holds. */
export function atTrailEnd(point, now = Date.now()) {
  const i = ends.findIndex(e => now < e.until && Math.hypot(point.x - e.point.x, point.y - e.point.y) <= END_NEAR);
  if (i < 0) return null;
  return ends.splice(i, 1)[0].animal;
}
