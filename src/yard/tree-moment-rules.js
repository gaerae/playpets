// Tree moments, as pure rules: a grown tree whose kind names a moment in the catalogue
// (catalog.json trees[].moment) has it in its own season, in fair hours, outdoors. A `drift` moment
// sends gusts of petals off the crown now and then; a `harvest` moment drops burrs at the foot. The
// page runs them (tree-moments.js, burrs.js) and the scenery paints the petals (scenery.js); what is
// decided here takes the time, the random draws and the ground as arguments.
import { between } from '../core/math.js';
import { treeKind } from './catalog.js';
import { yardSeason } from './decor-shown.js';
import { behind, freeSpot, treeStage } from './discovery-rules.js';
import { underBody } from './shoot-rules.js';

/** What a moment may be, and the weather it keeps when it names none. */
export const MOMENT_KINDS = Object.freeze(['drift', 'harvest']);
const FAIR = ['morning', 'day', 'evening'];
const CLEAR = ['clear'];

/** The moment a kind of tree names, or null. */
export const momentOf = kind => treeKind(kind)?.moment ?? null;

/** Whether `moment` is on in `scene` (world.js): the yard shows its season (decor-shown.js
 * yardSeason, so never in a place without seasons), morning to evening, in its weather (clear unless
 * it names more). */
export function momentTime(scene, moment) {
  return (
    !!moment &&
    yardSeason(scene) === moment.season &&
    FAIR.includes(scene.period) &&
    (moment.weather ?? CLEAR).includes(scene.weather)
  );
}

/** The grown trees in this place whose moment is on now, each with its moment, in garden order. */
export function momentTrees(trees, scene, now, limits) {
  return (trees || [])
    .filter(tree => tree.world === scene.world && treeStage(tree, now, limits) >= 2)
    .map(tree => ({ id: tree.id, kind: tree.kind, x: tree.x, y: tree.y, moment: momentOf(tree.kind) }))
    .filter(tree => momentTime(scene, tree.moment));
}

// ---- drift: petal snow ----

/** How long a gust sends petals off a crown, in ms (from, to). */
export const GUST_MS = [8_000, 12_000];
/** The wait between one tree's gusts, from the end of one to the start of the next. */
export const GUST_EVERY = [40_000, 90_000];
/** The wait for a tree's first gust once its moment is on: soon enough to be seen. */
export const GUST_FIRST = [6_000, 25_000];
/** The most trees gusting at once. */
export const GUSTS_AT_ONCE = 2;
/** How long a petal rests on the ground before it is gone; it fades over the second half. */
export const LIE_MS = 6_000;
// A petal falls this many yard pixels a millisecond at a pace of 1 (catalog moment.pace), a little
// slower than the spring petals that cross the whole sky (scene.js spawnFaller).
const FALL = 0.02;
// Petals a gust sends off when the moment names no number.
const PETALS = 10;

/**
 * One look at the gusts. `plan` maps a tree id to { next, until }: when its next gust is due and,
 * while one blows, when it ends. `ids` are the drift trees whose moment is on; a tree no longer
 * among them leaves the plan, a new one waits GUST_FIRST. A tree whose gust ended waits GUST_EVERY;
 * a due tree starts one unless GUSTS_AT_ONCE already blow, and then waits for room. Returns the new
 * plan and the ids that start a gust now.
 */
export function stepGusts(plan, ids, now, rng) {
  const next = {},
    started = [];
  let blowing = ids.filter(id => plan[id]?.until > now).length;
  for (const id of ids) {
    let p = plan[id] ?? { next: now + between(rng, GUST_FIRST), until: 0 };
    if (p.until && p.until <= now) p = { next: p.until + between(rng, GUST_EVERY), until: 0 };
    if (!p.until && now >= p.next && blowing < GUSTS_AT_ONCE) {
      p = { next: p.next, until: now + between(rng, GUST_MS) };
      started.push(id);
      blowing++;
    }
    next[id] = p;
  }
  return { plan: next, started };
}

/** How many petals a gust of `moment` sends off. */
export const gustPetals = moment => moment.petals ?? PETALS;

/**
 * A petal of a gust, in yard pixels. `gust` is the crown ({ x, top, bottom, width }, its middle, top,
 * lowest leaves and width), the tree's `foot`, the moment's `colors`, `pace` and `petal` size, and
 * its `wind` (pixels a millisecond, sideways). The petal starts in the crown, upwind of the spot it
 * comes to rest on, so the breeze carries it there: on a ring at the foot, in front of the trunk and
 * a little round its sides, never behind it, where it would lie over the trunk.
 */
export function driftPetal(gust, rng) {
  const angle = (-0.12 + rng() * 1.24) * Math.PI,
    reach = 0.4 + 0.6 * rng(),
    rx = gust.width * 0.46,
    ry = rx * 0.2,
    tx = gust.x + Math.cos(angle) * rx * reach,
    ty = gust.foot + Math.max(0, Math.sin(angle)) * ry * reach + 1,
    y = gust.top + (gust.bottom - gust.top) * (0.2 + 0.8 * rng()),
    vy = FALL * (gust.pace ?? 1) * (0.85 + 0.3 * rng()),
    wind = gust.wind ?? 0,
    [length, breadth] = gust.petal ?? [3, 1.8],
    grow = 0.8 + 0.4 * rng();
  return {
    x: tx - wind * Math.max(0, (ty - y) / vy),
    y,
    ty,
    vy,
    wind,
    phase: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 0.003,
    tilt: (rng() - 0.5) * 1.2,
    color: gust.colors[Math.min(gust.colors.length - 1, Math.floor(rng() * gust.colors.length))],
    length: length * grow,
    breadth: breadth * grow,
    lay: null,
  };
}

/** Moves the petals on by `dt` ms at `now`: one reaching its spot lies there (`lay`, when) and is
 * gone LIE_MS later. Returns the ones still to draw. */
export function stepDrift(petals, dt, now) {
  const kept = [];
  for (const p of petals) {
    if (p.lay !== null) {
      if (now - p.lay < LIE_MS) kept.push(p);
      continue;
    }
    p.phase += dt * 0.0016;
    p.y += p.vy * dt;
    p.x += (p.wind + Math.sin(p.phase) * 0.012) * dt;
    if (p.y >= p.ty) {
      p.y = p.ty;
      p.lay = now;
    }
    kept.push(p);
  }
  return kept;
}

/** How much of a lying petal shows, `age` ms after it came to rest: all of it, then fading out. */
export const lyingAlpha = age => Math.max(0, Math.min(1, (LIE_MS - age) / (LIE_MS / 2)));

// ---- harvest: burrs at the foot ----

/** At most this many burrs under one tree, and in the yard. */
export const BURRS_PER_TREE = 2;
export const BURRS_OUT = 3;
/** A burr stays this long unless it is picked or its season or place goes first. */
export const BURR_STAYS_MS = 6 * 3_600_000;
/** The wait between two burrs dropping in the yard, and before the first once a harvest tree is in
 * its time. */
export const BURR_EVERY = [6 * 60_000, 15 * 60_000];
export const BURR_FIRST = [60_000, 4 * 60_000];
/** The least distance between two burrs, in field units. */
export const BURR_APART = 0.04;
// Where a burr lands, in drawing pixels from the tree's foot: this far either side, and this far in
// front of it (never behind the trunk, which would hide it).
const BURR_SIDE = 64;
const BURR_FRONT = [5, 26];

/**
 * Whether a burr drops at this look at the yard, and under which tree. `kept` is the record
 * ({ next, picked, out }); `trees` the harvest trees whose moment is on. The first look with such a
 * tree only sets when the first burr is due; then a due drop goes under a tree with room (fewer than
 * BURRS_PER_TREE under it, fewer than BURRS_OUT in the yard), and the next is set either way. Returns
 * a new record and the tree (null for none).
 */
export function burrDue(kept, trees, now, rng) {
  if (!trees.length) return { kept, tree: null };
  if (!kept.next) return { kept: { ...kept, next: now + between(rng, BURR_FIRST) }, tree: null };
  if (now < kept.next) return { kept, tree: null };
  const room =
      kept.out.length < BURRS_OUT
        ? trees.filter(tree => kept.out.filter(b => b.tree === tree.id).length < BURRS_PER_TREE)
        : [],
    next = { ...kept, next: now + between(rng, BURR_EVERY) };
  return { kept: next, tree: room.length ? room[Math.min(room.length - 1, Math.floor(rng() * room.length))] : null };
}

/** A spot at `tree`'s foot for a burr `width` drawing pixels wide: on free ground in front of the
 * trunk, where nothing in front hides it, at least BURR_APART from each of `near`; null when twenty
 * tries find none. */
export function burrSpot(rng, ground, tree, near, width = 0) {
  const ux = ground.unit?.x ?? 0,
    uy = ground.unit?.y ?? 0;
  return freeSpot(
    rng,
    ground,
    {
      x: [tree.x - BURR_SIDE * ux, tree.x + BURR_SIDE * ux],
      y: [tree.y + BURR_FRONT[0] * uy, tree.y + BURR_FRONT[1] * uy],
    },
    p =>
      !behind(p, ground) &&
      !underBody(p, width, ground) &&
      near.every(n => Math.hypot(p.x - n.x, p.y - n.y) >= BURR_APART),
  );
}

/** The burrs still lying at `now`. */
export const freshBurrs = (out, now) =>
  out.filter(b => !!b && typeof b.at === 'number' && now - b.at >= 0 && now - b.at < BURR_STAYS_MS);

/** The burrs that stay at a look at the yard: fresh, in this place, under their own tree still grown
 * there, with the yard showing the tree's moment's season. Only the season counts, not the hour: a
 * burr that dropped in the afternoon still lies there at night or in rain. */
export function burrsStay(out, { trees, scene, now, limits }) {
  const season = yardSeason(scene);
  return freshBurrs(out, now).filter(b => {
    const tree = (trees || []).find(t => t.id === b.tree);
    return (
      b.world === scene.world &&
      !!tree &&
      tree.world === b.world &&
      treeStage(tree, now, limits) >= 2 &&
      momentOf(tree.kind)?.kind === 'harvest' &&
      momentOf(tree.kind).season === season &&
      // a tree moved away takes its burrs with it
      Math.abs(b.x - tree.x) <= 0.25 &&
      b.y >= tree.y &&
      b.y - tree.y <= 0.2
    );
  });
}

const unit = n => Number.isFinite(n) && n >= 0 && n <= 1;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the webview's stored record back, keeping only what makes sense. */
export function keptBurrs(text, now) {
  let saved = null;
  try {
    saved = JSON.parse(text);
  } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { next: 0, picked: '', out: [] };
  const ids = new Set();
  const good = freshBurrs(Array.isArray(saved.out) ? saved.out : [], now).filter(b => {
    const ok =
      typeof b === 'object' &&
      typeof b.id === 'string' &&
      !!b.id &&
      typeof b.tree === 'string' &&
      !!b.tree &&
      typeof b.world === 'string' &&
      !!b.world &&
      unit(b.x) &&
      unit(b.y) &&
      !ids.has(b.id);
    if (ok) ids.add(b.id);
    return ok;
  });
  return {
    next: Number.isFinite(saved.next) && saved.next > 0 ? saved.next : 0,
    picked: typeof saved.picked === 'string' && DAY.test(saved.picked) ? saved.picked : '',
    out: good.slice(0, BURRS_OUT).map(({ id, tree, world, x, y, at }) => ({ id, tree, world, x, y, at })),
  };
}

/** The list a friend picking up a burr says a line from: the moment's `first` on the first pick of
 * the local day `today`, else its `pick`; and the record after it. */
export function pickLine(kept, moment, today) {
  return kept.picked === today
    ? { key: moment.lines.pick, kept }
    : { key: moment.lines.first, kept: { ...kept, picked: today } };
}
