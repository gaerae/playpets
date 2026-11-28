// The catalogue's rules: what bites at the lake and what flies over the yard, and when. What there
// is comes from src/content/catalog.json (the fish and bugs with their seasons, hours, weights and
// looks, the flowers with their seasons, colours and drawings, the gifts with their drawings and
// effects, the garden's stages); a kind is added or changed there, not here. Each kind's name is in
// the string tables, under its book's key (NAME_KEYS).
// How to add to the yard: docs/how-to/add-to-the-yard.md.

// The lists, filled in place from the catalogue once at start (content.js) or by a test, so the
// modules that read them keep one list each.
export const FISH = [];
export const BUGS = [];
export const FLOWERS = [];
export const GIFTS = [];
/** What holds a find from the album (find-out.js): set out as a gift is, never brought. */
export const FINDS_OUT = [];
export const TREES = [];
export const TREASURES = [];
/** The winter animals that leave prints, each with its print, tail, gait and the finds it leans to. */
export const TRACKS = [];
/** The spring shoots a friend can dig up, each with its drawing and size. */
export const SHOOTS = [];
let trailArts = [];
/** The catalogue's lists that are the album's books, in the album's order, each with the string key
 * that names its kinds before the id; the album, the desktop and the site name a kind by it. A new
 * book is one more row here and one in the album (src/panel/album.js BOOKS). */
export const NAME_KEYS = Object.freeze({
  flowers: 'garden.kind_',
  fish: 'catch.fish_',
  bugs: 'catch.bug_',
  gifts: 'decor.kind_',
  trees: 'tree.',
  treasures: 'treasure.',
  tracks: 'track.',
  shoots: 'shoot.',
});
/** Each album book's kinds by its catalogue list ('fish', 'treasures'), the lists above. */
export const LISTS = Object.freeze({
  flowers: FLOWERS,
  fish: FISH,
  bugs: BUGS,
  gifts: GIFTS,
  trees: TREES,
  treasures: TREASURES,
  tracks: TRACKS,
  shoots: SHOOTS,
});
/** The album's books, in its order; the site counts them too. */
export const ALBUM_BOOKS = Object.freeze(Object.keys(NAME_KEYS));
/** The string key that names kind `id` of the album book `list` ('flowers', 'fish', 'treasures'). */
export const nameKey = (list, id) => `${NAME_KEYS[list]}${id}`;
/** A plant's stages and when each begins, in ms from planting; `art` draws it (bloom: the flower's). */
export const STAGES = [];

const fill = (list, items = []) => list.splice(0, list.length, ...items);
/** Takes the catalogue (the parsed src/content/catalog.json). */
export function useCatalog(catalog) {
  fill(FISH, catalog.fish);
  fill(BUGS, catalog.bugs);
  fill(FLOWERS, catalog.flowers);
  fill(GIFTS, catalog.gifts);
  fill(FINDS_OUT, catalog.findsOut);
  fill(TREES, catalog.trees);
  fill(TREASURES, catalog.treasures);
  fill(TRACKS, catalog.tracks);
  fill(SHOOTS, catalog.shoots);
  trailArts = catalog.trailArt || [];
  treeSizes = catalog.treeSizes || [];
  fill(
    STAGES,
    catalog.garden.stages.map(s => ({ ...s, at: s.minutes * 60 * 1000 })),
  );
}
/** Every drawing the catalogue (and the events) name, for content.js to load. */
export function artOf(catalog, events = { events: [] }) {
  return [
    ...events.events,
    ...catalog.garden.stages,
    ...catalog.flowers,
    // A flower's planted patch, for the kinds that bloom as one.
    ...catalog.flowers.flatMap(f => (f.patch ? [f.patch] : [])),
    ...catalog.gifts,
    ...(catalog.findsOut || []),
    // A gift's Christmas night is a second look (the grand tree) and the sleigh that comes only with it.
    ...catalog.gifts.flatMap(g => (g.night ? [{ art: g.night.art }, { art: g.night.sleigh }] : [])),
    // A built snowman's ball while it is rolled, and the things the person puts on it.
    ...catalog.gifts.flatMap(g => [...(g.ball ? [{ art: g.ball }] : []), ...(g.dress || [])]),
    ...(catalog.treasures || []),
    ...(catalog.shoots || []),
    ...(catalog.tracks || []).flatMap(k => [{ art: k.print }, { art: k.tail }, { art: k.whole }]),
    ...(catalog.trailArt || []),
    ...(catalog.discoveryTools || []),
    ...(catalog.trees || []).flatMap(tree => [
      ...tree.stages,
      ...Object.values(tree.seasonArt || {}).map(art => ({ art })),
      // What a grown tree's moments leave at its foot (its fallen fruit; tree-moment-rules.js).
      ...(tree.moments || []).filter(moment => moment.art).map(moment => ({ art: moment.art })),
    ]),
    ...catalog.fish,
    ...catalog.bugs,
  ]
    .map(k => k.art)
    .filter(Boolean);
}
/** A tree's drawing once grown: the one its album card shows. */
export const grownArt = tree => tree.stages.find(stage => stage.name === 'mature')?.art;
/** Every drawing an album card shows from a painted sheet: each ships a small preview
 * (scripts/art-webp.mjs), which the card draws instead of the sheet. */
export function albumArt(catalog) {
  return [
    ...(catalog.flowers || []),
    ...(catalog.fish || []),
    ...(catalog.bugs || []),
    ...(catalog.gifts || []),
    ...(catalog.trees || []).map(tree => ({ art: grownArt(tree) })),
    ...(catalog.treasures || []),
    ...(catalog.shoots || []),
    // An animal followed often enough is drawn whole on its card (yard/trail-art.js wholeAnimal).
    ...(catalog.tracks || []).map(k => ({ art: k.whole })),
  ]
    .map(kind => kind.art)
    .filter(Boolean);
}
/** A flower or a gift by its id. */
export const flowerKind = id => FLOWERS.find(f => f.id === id) || null;
/** A gift or a display (what the yard sets out) by its id. */
export const giftKind = id => GIFTS.find(g => g.id === id) || FINDS_OUT.find(g => g.id === id) || null;
/** The gifts an event brings, in catalogue order (the kinds marked with it; a built kind is not brought). */
export const eventGifts = id => GIFTS.filter(g => g.event === id && !g.built).map(g => g.id);
export const treeKind = id => TREES.find(tree => tree.id === id) || null;
// A tree's drawn size at each stage when its drawing names none (catalog.json "treeSizes", which
// the backend reads too for a tree out on the desktop).
let treeSizes = [];
// A grown tree stands as tall as its kind (catalog.json "stature": a metasequoia over a cherry, a
// lilac under it); a seedling is a seedling whatever it becomes, and a young tree is halfway there.
const STATURE_BY_STAGE = [0, 0.5, 1];
/** A tree's drawn size at `stage`, before the yard's zoom: its drawing's own, else the stage's, at
 * its kind's stature. */
export function treeSize(kind, stage) {
  const tree = treeKind(kind),
    box = tree?.stages[stage]?.size || treeSizes[stage];
  if (!box) return box;
  const k = 1 + ((tree?.stature ?? 1) - 1) * (STATURE_BY_STAGE[stage] ?? 1);
  return [box[0] * k, box[1] * k];
}
/** A tree's drawing at `stage`: grown, its season's when it has one. */
export const treeArt = (kind, stage, season) =>
  (stage === 2 && treeKind(kind)?.seasonArt?.[season]) || treeKind(kind)?.stages[stage]?.art;
export const trackKind = id => TRACKS.find(k => k.id === id) || null;
export const shootKind = id => SHOOTS.find(s => s.id === id) || null;
/** The drawing of a trail's bush, twigs or snow puff. */
export const trailArt = id => trailArts.find(a => a.id === id)?.art;
export const treasureKind = id => TREASURES.find(item => item.id === id) || null;

/** One of the list, each as likely as its weight (`rng` gives numbers in [0, 1)). */
export function weighted(list, weight, rng) {
  const total = list.reduce((sum, x) => sum + weight(x), 0);
  let roll = rng() * total;
  for (const x of list) {
    roll -= weight(x);
    if (roll < 0) return x;
  }
  return list.at(-1);
}

// A kind marked with an event (catalog.json "event", events.js) comes only while it is on.
const now = (kind, event) => !kind.event || kind.event === event;
/** Species eligible for the selected season, time and event. */
export function eligibleKinds(kinds, season, period, event = null) {
  return kinds.filter(kind => now(kind, event) && kind.seasons.includes(season) && kind.periods.includes(period));
}
export const fishWeight = (fish, weather) => fish.weight * (weather === 'rain' ? fish.rain || 1 : 1);
/** Conditional odds within one eligible pool, not the chance of encountering a creature per hour. */
export function relativeChances(pool, weight) {
  const total = pool.reduce((sum, kind) => sum + weight(kind), 0);
  return total ? pool.map(kind => ({ ...kind, chance: weight(kind) / total })) : [];
}
/** The scenery's current population; day populations mix flying and ground bugs. */
export function wildlifeGroup(season, period, weather) {
  if (weather !== 'clear' || season === 'winter') return null;
  if (period === 'day' || period === 'morning') return 'day';
  if (season === 'spring' || season === 'summer') return 'firefly';
  return 'cricket';
}
/** Probabilities per spawned individual, including the daytime family split. */
export function bugChances(season, period, weather, event = null, kinds = BUGS) {
  const group = wildlifeGroup(season, period, weather);
  if (!group) return [];
  const eligible = eligibleKinds(kinds, season, period, event);
  const chances = kind =>
    relativeChances(
      eligible.filter(bug => bug.kind === kind),
      bug => bug.weight,
    );
  if (group !== 'day') return chances(group);
  const families = [
    ['butterfly', 0.55],
    ['dragonfly', 0.25],
    ['beetle', 0.1],
    ['cricket', 0.1],
  ].map(([kind, share]) => ({ pool: chances(kind), share }));
  const total = families.reduce((sum, family) => sum + (family.pool.length ? family.share : 0), 0);
  return families.flatMap(({ pool, share }) => pool.map(bug => ({ ...bug, chance: bug.chance * (share / total) })));
}
/** The fish that bite in this season and time of day (and event). */
export function fishHere(season, period, event = null) {
  return eligibleKinds(FISH, season, period, event);
}
/** A bite: which fish, and how long it is (cm, to a millimetre; big ones are rarer). */
export function bite(season, period, weather, rng, event = null) {
  const fish = weighted(fishHere(season, period, event), f => fishWeight(f, weather), rng),
    [low, high] = fish.size,
    size = Math.round((low + (high - low) * rng() ** 1.6) * 10) / 10;
  return { fish, size };
}

/** A kind of fish or bug by its name, or null for one the catalogue dropped, as an old save may hold. */
export const kindOf = (book, id) => (book === 'fish' ? FISH : BUGS).find(x => x.id === id) || null;
