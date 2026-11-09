// Faint footprint trails across the winter yard, each ending at a snowy bush (the rules are
// trail-rules.js's; the album's book is Task 7's follow).
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
import { t } from '../core/i18n.js';
import { $, data, recall, remember } from '../core/state.js';
import { artHref, artSize, artSvg } from './art.js';
import { TRACKS, trackKind, trailArt } from './catalog.js';
import { yardSeason } from './decor-shown.js';
import { depthAt, fieldToYard, yardZoom } from './field.js';
import { groundProfile } from './ground.js';
import { localDay } from './growth.js';
import { autoWeather } from './scene.js';
import { chosenWeather } from './sky.js';
import { tailPeek } from './trail-art.js';
import { coveredAt, laidAt, seedOf, stamps, trailAnimal, trailOpacity, trailPath, trailsOn } from './trail-rules.js';
import { scene } from './world.js';

const NS = 'http://www.w3.org/2000/svg';
const DAY_MS = 86400000;
// How long a covered trail takes to fade before it leaves (garden.css .trail transition).
const FADE_MS = 3000;
// Prints shrink with the yard only this far: smaller, they are specks in the snow's grain.
const PRINT_ZOOM_MIN = 0.7;

const defaultWeather = ms => (chosenWeather() === 'auto' ? autoWeather(ms, 'winter') : chosenWeather());
let deps = { profile: groundProfile, weather: defaultWeather, toYard: fieldToYard, zoom: yardZoom };
// The trails on the yard by number: their nodes, the opacity last written and whether snow covered them.
const drawn = new Map();
// The day's paths for the place and size in `pathsFor`, by trail number (null: no room for one).
let paths = new Map(),
  pathsFor = '';

/** `profile`, `weather`, `toYard` and `zoom` replace the yard's own (tests). */
export function setupTrails({
  profile = groundProfile,
  weather = defaultWeather,
  toYard = fieldToYard,
  zoom = yardZoom,
} = {}) {
  deps = { profile, weather, toYard, zoom };
  clear();
  paths = new Map();
  pathsFor = '';
}

/** Lays the trails out again on the yard's new size or land (app.js, once the yard is measured
 * again or its land redrawn): the paths are worked out afresh for the ground that shows. */
export function resizeTrails() {
  clear();
  pathsFor = '';
  trailsCheck();
}

function forget(n) {
  const trail = drawn.get(n);
  if (!trail) return;
  clearTimeout(trail.timer);
  for (const node of trail.nodes) node.remove();
  drawn.delete(n);
}
function clear() {
  for (const n of drawn.keys()) forget(n);
}

// The day's record: when the yard was first seen and the trails followed. Bad or old data starts
// the day from now.
function today(now) {
  const day = localDay(now);
  let saved = null;
  try {
    saved = JSON.parse(recall('trails'));
  } catch {}
  if (saved?.day === day && Number.isFinite(saved.seen) && Array.isArray(saved.followed)) return saved;
  saved = { day, seen: now.getTime(), followed: [] };
  remember('trails', JSON.stringify(saved));
  return saved;
}

// Today's digs in this place, as the trails' ends keep off them.
function taken(now) {
  return (data.garden?.digs || [])
    .filter(d => d.world === scene.world && now.getTime() - d.at < DAY_MS)
    .map(d => ({ x: (d.tileX + 0.5) / 8, y: (d.tileY + 0.5) / 8 }));
}

// The ground keeps only the feet of what stands on it, so a print may pass behind a gift as a
// friend's path would; but a bush behind one would hide the tail, so an end there is given up (its
// tile taken) and the trail laid again, a few times at most.
const BODY = 3;
const behind = (p, profile) =>
  (profile.obstacles || []).some(
    o => ((p.x - o.x) / (o.rx * 1.2)) ** 2 + ((p.y - (o.y - o.ry * BODY)) / (o.ry * BODY)) ** 2 <= 1,
  );

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

function draw(n, track, path, followed) {
  const { toYard, zoom } = deps,
    // The yard's width: the field's right edge and the side room fieldToYard keeps at its left.
    width = toYard({ x: 1, y: 0 }).x + toYard({ x: 0, y: 0 }).x,
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
  end.style.setProperty('--u', `${zoom()}px`);
  // Bare twigs show what is behind them, so the tail always peeks from the evergreen bush; the
  // twigs stand beside it, behind, on the side the tail is not.
  const exit = path.exit === 'left' ? 'mirror' : '';
  end.innerHTML =
    (path.bush === 'twigs' ? artSvg(trailArt('twigs'), `class="trail-twigs ${exit}"`) : '') +
    tailPeek(track, 'bush', exit);
  const nodes = [svg, end];
  if (!followed && marks.length) {
    const hit = el('polyline', { points: points.map(p => `${round(p.x)},${round(p.y)}`).join(' ') });
    hit.classList.add('trail-hit');
    svg.append(hit);
    const middle = marks[Math.floor(marks.length / 2)],
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
  return { nodes, svg, end, opacity: null, covered: false, timer: 0 };
}

/** Brings the yard's trails in line with the day, the season, the place and the weather. */
export function trailsCheck(now = new Date()) {
  const profile = yardSeason(scene) === 'winter' ? deps.profile() : null;
  if (!profile?.soil || !TRACKS.length) {
    clear();
    return;
  }
  const saved = today(now),
    { toYard, zoom, weather } = deps,
    corner = toYard({ x: 1, y: 1 }),
    place = `${saved.day}|${scene.world}|${corner.x}x${corner.y}|${zoom()}`;
  if (place !== pathsFor) {
    clear();
    paths = new Map();
    pathsFor = place;
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
      for (const node of trail.nodes) node.classList.add('covered');
      trail.timer = setTimeout(() => forget(n), FADE_MS);
      shown.add(n);
      continue;
    }
    const path = pathOf(n, saved.day, profile, now),
      track = trackKind(trailAnimal(saved.day, n, ids));
    if (!path || !track) continue;
    trail ??= drawn.set(n, draw(n, track, path, saved.followed.includes(n))).get(n);
    const opacity = trailOpacity(laid, ms);
    if (opacity !== trail.opacity) {
      trail.svg.style.setProperty('--trail-opacity', String(opacity));
      trail.opacity = opacity;
    }
    shown.add(n);
  }
  for (const n of drawn.keys()) if (!shown.has(n)) forget(n);
}
