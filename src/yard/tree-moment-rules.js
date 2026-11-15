// Tree moments, as pure rules: a grown tree whose kind names moments in the catalogue
// (catalog.json trees[].moments) has each in its own season, in fair hours, outdoors. A `visit`
// moment draws a friend to the tree to look up at it; a `harvest` moment drops the tree's fruit at
// its foot (a chestnut's burr, a persimmon, a fig). The page runs them (tree-moments.js,
// fallen-fruit.js); what is decided here takes the time, the random draws and the ground as
// arguments.
import { between, distance, pick } from '../core/math.js';
import { treeKind } from './catalog.js';
import { yardSeason } from './decor-shown.js';
import { behind, freeSpot, treeStage } from './discovery-rules.js';
import { underBody, unit } from './shoot-rules.js';

/** What a moment may be, and the weather it keeps when it names none. */
export const MOMENT_KINDS = Object.freeze(['visit', 'harvest']);
const FAIR = ['morning', 'day', 'evening'];
const CLEAR = ['clear'];

/** The moments a kind of tree names, each in a season of its own (none for most kinds). */
export const momentsOf = kind => treeKind(kind)?.moments ?? [];
/** A kind of tree's harvest moment, or null: what it drops, and when. */
export const harvestOf = kind => momentsOf(kind).find(moment => moment.kind === 'harvest') ?? null;

// Whether `moment` is on in `scene` with the yard showing `season` (yardSeason, worked out once by
// the caller).
const momentOn = (scene, season, moment) =>
  !!moment &&
  season === moment.season &&
  FAIR.includes(scene.period) &&
  (moment.weather ?? CLEAR).includes(scene.weather);

/** Whether `moment` is on in `scene` (world.js): the yard shows its season (decor-shown.js
 * yardSeason, so never in a place without seasons), morning to evening, in its weather (clear unless
 * it names more). */
export const momentTime = (scene, moment) => momentOn(scene, yardSeason(scene), moment);

/** The grown trees in this place with a moment on now, each with that moment, in garden order. */
export function momentTrees(trees, scene, now, limits) {
  const season = yardSeason(scene);
  return (trees || []).flatMap(tree => {
    // Most kinds name no moment: those are passed over before their growth is worked out.
    const moments = tree.world === scene.world ? momentsOf(tree.kind) : [];
    if (!moments.length || treeStage(tree, now, limits) < 2) return [];
    return moments
      .filter(moment => momentOn(scene, season, moment))
      .map(moment => ({ id: tree.id, kind: tree.kind, x: tree.x, y: tree.y, moment }));
  });
}

/** A grown tree's crown, as shares of the tree as planted-trees.js treeBox draws it: no kind says
 * its own, and these fit the trees' art well enough. Its leaves end `low` of its height above its foot
 * and it is `wide` of its width; a friend visiting it stands `edge` of the crown's width from the
 * middle, under its edge, and at least `clear` of its own width, clear of the trunk. */
export const CROWN = Object.freeze({ low: 0.25, wide: 0.8, edge: 0.4, clear: 0.8 });

// ---- harvest: fruit at the foot ----

/** At most this much fallen fruit under one tree, and in one place. */
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
 * FRUIT_PER_TREE under it, fewer than FRUIT_OUT in `world`, the place shown), and the next is set
 * either way. A look with none (night, rain, another season) forgets the wait, so the first wait comes
 * again each time the harvest does. Returns a new record and the tree (null for none).
 */
export function fruitDue(kept, trees, now, rng, world) {
  if (!trees.length) return { kept: kept.next ? { ...kept, next: 0 } : kept, tree: null };
  if (!kept.next) return { kept: { ...kept, next: now + between(rng, FRUIT_FIRST) }, tree: null };
  if (now < kept.next) return { kept, tree: null };
  const here = fruitHere(kept.out, world),
    room =
      here.length < FRUIT_OUT ? trees.filter(tree => here.filter(f => f.tree === tree.id).length < FRUIT_PER_TREE) : [],
    next = { ...kept, next: now + between(rng, FRUIT_EVERY) };
  return { kept: next, tree: room.length ? pick(room, rng) : null };
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
    p => !behind(p, ground) && !underBody(p, width, ground) && near.every(n => distance(p, n) >= FRUIT_APART),
  );
}

/** How far fruit lying with its bottom at `y` falls, in yard pixels: from the lower edge of the crown
 * of a tree `height` px tall standing at `footY`, in whole pixels, never upward. */
export const fruitFall = (y, footY, height) => Math.max(0, Math.round(y - (footY - height * CROWN.low)));

/** The fallen fruit of one place, the one drawn while it is shown. */
export const fruitHere = (out, world) => out.filter(f => f.world === world);

/** The fallen fruit still lying at `now`. */
export const freshFruit = (out, now) =>
  out.filter(f => !!f && typeof f.at === 'number' && now - f.at >= 0 && now - f.at < FRUIT_STAYS_MS);

// A tree whose field x or y differs from where it stood by more than this has been moved; anything
// less is float noise.
const STOOD = 1e-6;
/** Whether `tree` still stands at `at` (field x and y), where it stood when its fruit dropped or a
 * visit to it began: any move is one, since fruit and a visiting friend are only a little from its
 * trunk. */
export const treeStands = (tree, at) => Math.abs(at.x - tree.x) <= STOOD && Math.abs(at.y - tree.y) <= STOOD;

/** The fallen fruit that stays, in every place: fresh, under its own tree still grown in the fruit's
 * place and standing where it stood when the fruit dropped, while `season` (the yard's, scene.season)
 * is the tree's harvest season. Only the season counts, not the hour, the weather or the place shown:
 * fruit that dropped in the afternoon still lies there at night, in rain, and while the person is in
 * another place, and is there on coming back. */
export function fruitStays(out, { trees, season, now, limits }) {
  return freshFruit(out, now).filter(f => {
    const tree = (trees || []).find(t => t.id === f.tree);
    return (
      !!tree &&
      tree.world === f.world &&
      treeStage(tree, now, limits) >= 2 &&
      harvestOf(tree.kind)?.season === season &&
      // Fruit lies a few hundredths from its trunk, so even a short move takes it along.
      treeStands(tree, { x: f.treeX, y: f.treeY })
    );
  });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// The record with nothing in it: no wait, no picks, no fruit.
const EMPTY = () => ({ next: 0, picked: {}, out: [] });
// A string with something in it.
const named = value => typeof value === 'string' && !!value;
// A stored fruit's own fields, or null when one is missing or out of range.
const clean = f =>
  !!f &&
  typeof f === 'object' &&
  named(f.id) &&
  named(f.tree) &&
  named(f.world) &&
  [f.x, f.y, f.treeX, f.treeY].every(unit)
    ? { id: f.id, tree: f.tree, world: f.world, x: f.x, y: f.y, treeX: f.treeX, treeY: f.treeY, at: f.at }
    : null;

/** Reads the webview's stored record back ({ picked, out }), keeping only what makes sense, and no
 * more than FRUIT_OUT fruit in each place. The wait for the next fruit is not kept: a start waits the
 * first wait again. */
export function keptFruit(text, now) {
  let saved = null;
  try {
    saved = JSON.parse(text);
  } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return EMPTY();
  const out = [],
    places = new Map();
  for (const stored of freshFruit(Array.isArray(saved.out) ? saved.out : [], now)) {
    const f = clean(stored),
      count = places.get(f?.world) ?? 0;
    if (!f || count >= FRUIT_OUT || out.some(o => o.id === f.id)) continue;
    out.push(f);
    places.set(f.world, count + 1);
  }
  const picked =
    saved.picked && typeof saved.picked === 'object' && !Array.isArray(saved.picked)
      ? Object.fromEntries(
          Object.entries(saved.picked).filter(
            ([kind, day]) => !!harvestOf(kind) && typeof day === 'string' && DAY.test(day),
          ),
        )
      : {};
  return { ...EMPTY(), picked, out };
}

/** Where a friend `width` px wide stands to visit a tree whose crown is `crownWidth` px wide at
 * `crownX`, on `side` (-1 left, 1 right): beside the trunk, never in front of it, under the crown's
 * edge when the crown is wide. */
export const visitX = (crownX, crownWidth, width, side) =>
  crownX + side * Math.max(width * CROWN.clear, crownWidth * CROWN.edge);

/** The list a friend picking up fruit fallen from a `kind` of tree says a line from: its harvest's
 * `first` on the first pick of that fruit on the local day `today`, else its `pick`; and the record
 * after it. */
export function pickLine(kept, kind, today) {
  const { lines } = harvestOf(kind);
  return kept.picked[kind] === today
    ? { key: lines.pick, kept }
    : { key: lines.first, kept: { ...kept, picked: { ...kept.picked, [kind]: today } } };
}
