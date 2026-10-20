// The catalogue's rules: what bites at the lake and what flies over the yard, and when. What there
// is comes from src/content/catalog.json (the fish and bugs with their seasons, hours, weights and
// looks, the flowers with their seasons, colours and drawings, the gifts with their drawings and
// effects, the garden's stages); a kind is added or changed there, not here. Each kind's name is in
// the string tables (catch.fish_<id>, catch.bug_<id>, garden.kind_<id>, decor.kind_<id>).
// How to add to the yard: docs/how-to/add-to-the-yard.md.

// The lists, filled in place from the catalogue once at start (content.js) or by a test, so the
// modules that read them keep one list each.
export const FISH = [];
export const BUGS = [];
export const FLOWERS = [];
export const GIFTS = [];
export const TREES = [];
export const TREASURES = [];
/** A plant's stages and when each begins, in ms from planting; `art` draws it (bloom: the flower's). */
export const STAGES = [];

const fill = (list, items = []) => list.splice(0, list.length, ...items);
/** Takes the catalogue (the parsed src/content/catalog.json). */
export function useCatalog(catalog) {
  fill(FISH, catalog.fish);
  fill(BUGS, catalog.bugs);
  fill(FLOWERS, catalog.flowers);
  fill(GIFTS, catalog.gifts);
  fill(TREES, catalog.trees);
  fill(TREASURES, catalog.treasures);
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
    ...catalog.gifts,
    ...(catalog.treasures || []),
    ...(catalog.discoveryTools || []),
    ...(catalog.trees || []).flatMap(tree => [
      ...tree.stages,
      ...Object.values(tree.seasonArt || {}).map(art => ({ art })),
    ]),
    ...catalog.fish,
    ...catalog.bugs,
  ]
    .map(k => k.art)
    .filter(Boolean);
}
/** A flower or a gift by its id. */
export const flowerKind = id => FLOWERS.find(f => f.id === id) || null;
export const giftKind = id => GIFTS.find(g => g.id === id) || null;
export const treeKind = id => TREES.find(tree => tree.id === id) || null;
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
  return null;
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
  if (group === 'firefly') return chances('firefly');
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

/** The bugs of a kind that fly in this season and time of day. */
function bugsHere(kind, season, period, event = null) {
  return eligibleKinds(BUGS, season, period, event).filter(b => b.kind === kind);
}
/** Which of a kind flies by now, or null when none does. */
export function flyingBug(kind, season, period, rng, event = null) {
  const here = bugsHere(kind, season, period, event);
  return here.length ? weighted(here, b => b.weight, rng) : null;
}

/** A kind of fish or bug by its name. */
export const kindOf = (book, id) => (book === 'fish' ? FISH : BUGS).find(x => x.id === id) || null;
