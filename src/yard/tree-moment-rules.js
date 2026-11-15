// Tree moments, as pure rules: a grown tree whose kind names moments in the catalogue
// (catalog.json trees[].moments) has each in its own season, in fair hours, outdoors. A `drift`
// moment sends gusts of petals off the crown now and then; a `harvest` moment drops the tree's fruit
// at its foot (a chestnut's burr, a persimmon, a fig). The page runs them (tree-moments.js,
// fallen-fruit.js) and the scenery paints the petals (scenery.js); what is decided here takes the
// time, the random draws and the ground as arguments.
import { between } from '../core/math.js';
import { treeKind } from './catalog.js';
import { yardSeason } from './decor-shown.js';
import { behind, freeSpot, treeStage } from './discovery-rules.js';
import { underBody } from './shoot-rules.js';

/** What a moment may be, and the weather it keeps when it names none. */
export const MOMENT_KINDS = Object.freeze(['drift', 'harvest']);
const FAIR = ['morning', 'day', 'evening'];
const CLEAR = ['clear'];

/** The moments a kind of tree names, each in a season of its own (none for most kinds). */
export const momentsOf = kind => treeKind(kind)?.moments ?? [];
/** A kind of tree's harvest moment, or null: what it drops, and when. */
export const harvestOf = kind => momentsOf(kind).find(moment => moment.kind === 'harvest') ?? null;

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

/** The grown trees in this place with a moment on now, each with that moment, in garden order. */
export function momentTrees(trees, scene, now, limits) {
  return (trees || [])
    .filter(tree => tree.world === scene.world && treeStage(tree, now, limits) >= 2)
    .flatMap(tree =>
      momentsOf(tree.kind)
        .filter(moment => momentTime(scene, moment))
        .map(moment => ({ id: tree.id, kind: tree.kind, x: tree.x, y: tree.y, moment })),
    );
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

/** Whether any of `petals` looks different from one frame to the next at `now`: one still falling,
 * or one lying in its fade. Petals lying at full strength do not, and the canvas may rest. */
export const driftMoving = (petals, now) => petals.some(p => p.lay === null || now - p.lay > LIE_MS / 2);

// ---- harvest: fruit at the foot ----

/** At most this much fallen fruit under one tree, and in the yard. */
export const FRUIT_PER_TREE = 2;
export const FRUIT_OUT = 3;
/** Fallen fruit stays this long unless it is picked or its season or place goes first. */
export const FRUIT_STAYS_MS = 6 * 3_600_000;
/** The wait between two fruit dropping in the yard, and before the first once a harvest tree is in
 * its time. */
export const FRUIT_EVERY = [6 * 60_000, 15 * 60_000];
export const FRUIT_FIRST = [60_000, 4 * 60_000];
/** The least distance between two fallen fruit, in field units. */
export const FRUIT_APART = 0.04;
// Where fruit lands, in drawing pixels from the tree's foot: this far either side, and this far in
// front of it (never behind the trunk, which would hide it).
const FRUIT_SIDE = 64;
const FRUIT_FRONT = [5, 26];

/**
 * Whether fruit drops at this look at the yard, and under which tree. `kept` is the record
 * ({ next, picked, out }); `trees` the harvest trees whose moment is on. The first look with such a
 * tree only sets when the first fruit is due; then a due drop goes under a tree with room (fewer than
 * FRUIT_PER_TREE under it, fewer than FRUIT_OUT in the yard), and the next is set either way. A look
 * with none (night, rain, another season) forgets the wait, so the first wait comes again each time
 * the harvest does. Returns a new record and the tree (null for none).
 */
export function fruitDue(kept, trees, now, rng) {
  if (!trees.length) return { kept: kept.next ? { ...kept, next: 0 } : kept, tree: null };
  if (!kept.next) return { kept: { ...kept, next: now + between(rng, FRUIT_FIRST) }, tree: null };
  if (now < kept.next) return { kept, tree: null };
  const room =
      kept.out.length < FRUIT_OUT
        ? trees.filter(tree => kept.out.filter(f => f.tree === tree.id).length < FRUIT_PER_TREE)
        : [],
    next = { ...kept, next: now + between(rng, FRUIT_EVERY) };
  return { kept: next, tree: room.length ? room[Math.min(room.length - 1, Math.floor(rng() * room.length))] : null };
}

/** A spot at `tree`'s foot for fruit `width` drawing pixels wide: on free ground in front of the
 * trunk, where nothing in front hides it, at least FRUIT_APART from each of `near`; null when twenty
 * tries find none. */
export function fruitSpot(rng, ground, tree, near, width = 0) {
  const ux = ground.unit?.x ?? 0,
    uy = ground.unit?.y ?? 0;
  return freeSpot(
    rng,
    ground,
    {
      x: [tree.x - FRUIT_SIDE * ux, tree.x + FRUIT_SIDE * ux],
      y: [tree.y + FRUIT_FRONT[0] * uy, tree.y + FRUIT_FRONT[1] * uy],
    },
    p =>
      !behind(p, ground) &&
      !underBody(p, width, ground) &&
      near.every(n => Math.hypot(p.x - n.x, p.y - n.y) >= FRUIT_APART),
  );
}

/** The fallen fruit still lying at `now`. */
export const freshFruit = (out, now) =>
  out.filter(f => !!f && typeof f.at === 'number' && now - f.at >= 0 && now - f.at < FRUIT_STAYS_MS);

/** The fallen fruit that stays at a look at the yard: fresh, in this place, under its own tree still
 * grown there, with the yard showing the season of the tree's harvest. Only the season counts, not
 * the hour: fruit that dropped in the afternoon still lies there at night or in rain. */
export function fruitStays(out, { trees, scene, now, limits }) {
  const season = yardSeason(scene);
  return freshFruit(out, now).filter(f => {
    const tree = (trees || []).find(t => t.id === f.tree);
    return (
      f.world === scene.world &&
      !!tree &&
      tree.world === f.world &&
      treeStage(tree, now, limits) >= 2 &&
      harvestOf(tree.kind)?.season === season &&
      // a tree moved away takes its fruit with it
      Math.abs(f.x - tree.x) <= 0.25 &&
      f.y >= tree.y &&
      f.y - tree.y <= 0.2
    );
  });
}

const unit = n => Number.isFinite(n) && n >= 0 && n <= 1;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the webview's stored record back ({ picked, out }), keeping only what makes sense. The wait
 * for the next fruit is not kept: a start waits the first wait again. */
export function keptFruit(text, now) {
  let saved = null;
  try {
    saved = JSON.parse(text);
  } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { next: 0, picked: {}, out: [] };
  const ids = new Set();
  const good = freshFruit(Array.isArray(saved.out) ? saved.out : [], now).filter(f => {
    const ok =
      typeof f === 'object' &&
      typeof f.id === 'string' &&
      !!f.id &&
      typeof f.tree === 'string' &&
      !!f.tree &&
      typeof f.world === 'string' &&
      !!f.world &&
      unit(f.x) &&
      unit(f.y) &&
      !ids.has(f.id);
    if (ok) ids.add(f.id);
    return ok;
  });
  const picked =
    saved.picked && typeof saved.picked === 'object' && !Array.isArray(saved.picked)
      ? Object.fromEntries(
          Object.entries(saved.picked).filter(
            ([kind, day]) => !!harvestOf(kind) && typeof day === 'string' && DAY.test(day),
          ),
        )
      : {};
  return {
    next: 0,
    picked,
    out: good.slice(0, FRUIT_OUT).map(({ id, tree, world, x, y, at }) => ({ id, tree, world, x, y, at })),
  };
}

/** Where a friend `width` px wide stands to visit a tree whose crown is `crownWidth` px wide at
 * `crownX`, on `side` (-1 left, 1 right): beside the trunk, never in front of it, under the crown's
 * edge when the crown is wide. */
export const visitX = (crownX, crownWidth, width, side) => crownX + side * Math.max(width * 0.8, crownWidth * 0.4);

/** The list a friend picking up fruit fallen from a `kind` of tree says a line from: its harvest's
 * `first` on the first pick of that fruit on the local day `today`, else its `pick`; and the record
 * after it. */
export function pickLine(kept, kind, today) {
  const { lines } = harvestOf(kind);
  return kept.picked[kind] === today
    ? { key: lines.pick, kept }
    : { key: lines.first, kept: { ...kept, picked: { ...kept.picked, [kind]: today } } };
}
