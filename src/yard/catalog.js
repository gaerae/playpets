// What lives in the lake and flies over the yard, and when: the catalogue the album is filled
// from. Rules only, apart from the page, so they can be checked on their own. Each kind's name is
// in the string tables (catch.fish_<id>, catch.bug_<id>); `look` is how creatures.js draws it.
// Design: docs/design/2026-10-09-a-yard-that-grows.md.

const ALL = ['spring', 'summer', 'autumn', 'winter'];
const ANY = ['morning', 'day', 'evening', 'night'];
const LIGHT = ['morning', 'day', 'evening'];
const DARK = ['evening', 'night'];

// Fish: where in the year and the day they bite, how often (weight), and how long they grow (cm).
export const FISH = [
  {
    id: 'crucian',
    size: [10, 32],
    seasons: ALL,
    periods: ANY,
    weight: 30,
    look: { body: '#8f8a55', belly: '#d8d09a', fin: '#6d6943', shape: 'round' },
  },
  {
    id: 'carp',
    size: [30, 80],
    seasons: ALL,
    periods: ANY,
    weight: 14,
    look: { body: '#9c7a4a', belly: '#e2c99a', fin: '#b8643e', shape: 'normal', whiskers: true },
  },
  {
    id: 'killifish',
    size: [2, 4],
    seasons: ['spring', 'summer'],
    periods: LIGHT,
    weight: 22,
    look: { body: '#c8c3a6', belly: '#ece8d2', fin: '#b0aa8a', shape: 'normal' },
  },
  {
    id: 'minnow',
    size: [8, 15],
    seasons: ['spring', 'summer', 'autumn'],
    periods: LIGHT,
    weight: 22,
    look: { body: '#b4c2c8', belly: '#eef2f2', fin: '#9eb0b8', shape: 'slender', stripes: '#e48aa0' },
  },
  {
    id: 'goldfish',
    size: [5, 15],
    seasons: ALL,
    periods: ANY,
    weight: 3,
    look: { body: '#f08a3a', belly: '#f8c47c', fin: '#f4a560', shape: 'round', fancy: true },
  },
  {
    id: 'catfish',
    size: [30, 90],
    seasons: ['spring', 'summer', 'autumn'],
    periods: DARK,
    weight: 12,
    rain: 2,
    look: { body: '#5e5950', belly: '#bcb09a', fin: '#4c4840', shape: 'flat', whiskers: true },
  },
  {
    id: 'eel',
    size: [40, 100],
    seasons: ['summer', 'autumn'],
    periods: DARK,
    weight: 6,
    rain: 2,
    look: { body: '#4f5a45', belly: '#cbc99c', fin: '#45503c', shape: 'eel' },
  },
  {
    id: 'smelt',
    size: [8, 14],
    seasons: ['winter'],
    periods: ANY,
    weight: 30,
    look: { body: '#c6d2d8', belly: '#f2f5f6', fin: '#aebcc4', shape: 'slender' },
  },
  {
    id: 'sweetfish',
    size: [15, 25],
    seasons: ['summer'],
    periods: LIGHT,
    weight: 12,
    look: { body: '#9db0a0', belly: '#e8e4c8', fin: '#86998a', shape: 'slender', spot: '#f0d060' },
  },
  {
    id: 'trout',
    size: [20, 40],
    seasons: ['spring', 'autumn', 'winter'],
    periods: ANY,
    weight: 10,
    look: { body: '#7c8a70', belly: '#e9dcc6', fin: '#6a7660', shape: 'normal', spots: '#3e4636', band: '#e39a9a' },
  },
  {
    id: 'mandarin',
    size: [20, 50],
    seasons: ['summer', 'autumn'],
    periods: ANY,
    weight: 6,
    look: { body: '#b39a50', belly: '#e8d9a6', fin: '#8c7638', shape: 'normal', spots: '#4a3f24' },
  },
  {
    id: 'golden_carp',
    size: [40, 80],
    seasons: ALL,
    periods: ANY,
    weight: 1,
    look: { body: '#f2c14e', belly: '#fbe7a4', fin: '#e8a33a', shape: 'normal', whiskers: true },
  },
];

// Bugs: what flies over the yard, when, and how often among its own kind.
export const BUGS = [
  {
    id: 'cabbage_white',
    kind: 'butterfly',
    seasons: ['spring', 'summer', 'autumn'],
    periods: LIGHT,
    weight: 30,
    look: { wing: '#f6f4ea', edge: '#4a4a44', spots: '#4a4a44' },
  },
  {
    id: 'yellow_butterfly',
    kind: 'butterfly',
    seasons: ['spring', 'summer', 'autumn'],
    periods: LIGHT,
    weight: 24,
    look: { wing: '#f4d35e', edge: '#c49a2e' },
  },
  {
    id: 'blue_butterfly',
    kind: 'butterfly',
    seasons: ['spring', 'summer'],
    periods: LIGHT,
    weight: 16,
    look: { wing: '#8fb4e8', edge: '#5576ad', small: true },
  },
  {
    id: 'swallowtail',
    kind: 'butterfly',
    seasons: ['summer'],
    periods: LIGHT,
    weight: 10,
    look: { wing: '#f2d36b', edge: '#2d2d2d', stripes: '#2d2d2d', tails: true },
  },
  {
    id: 'black_swallowtail',
    kind: 'butterfly',
    seasons: ['summer'],
    periods: LIGHT,
    weight: 4,
    look: { wing: '#2f3a48', edge: '#1f262e', sheen: '#4f97a6', tails: true },
  },
  {
    id: 'peacock',
    kind: 'butterfly',
    seasons: ['autumn'],
    periods: LIGHT,
    weight: 6,
    look: { wing: '#c8553d', edge: '#4a2a22', eyes: '#3f6fb5' },
  },
  {
    id: 'dragonfly',
    kind: 'dragonfly',
    seasons: ['summer'],
    periods: LIGHT,
    weight: 20,
    look: { body: '#6f8fb5', wing: '#e8f0f4' },
  },
  {
    id: 'red_dragonfly',
    kind: 'dragonfly',
    seasons: ['summer', 'autumn'],
    periods: LIGHT,
    weight: 24,
    look: { body: '#d9442e', wing: '#f4ece6' },
  },
  {
    id: 'firefly',
    kind: 'firefly',
    seasons: ['spring', 'summer'],
    periods: DARK,
    weight: 1,
    look: { body: '#3a3a32', glow: '#ecf096' },
  },
];

// Flowers: what a seed grows into, by the season it was planted in (growth.js).
export const FLOWERS = [
  { id: 'tulip', season: 'spring' },
  { id: 'sunflower', season: 'summer' },
  { id: 'cosmos', season: 'autumn' },
  { id: 'camellia', season: 'winter' },
];
// Gifts: what friends bring, in the order the first ones come (src-tauri/src/pets/garden.rs).
// Each with the size of its drawing (the symbol's view box in index.html).
export const GIFTS = [
  { id: 'bench', view: [80, 50] },
  { id: 'lantern', view: [30, 72] },
  { id: 'birdhouse', view: [36, 74] },
  { id: 'pond', view: [100, 40] },
  { id: 'mailbox', view: [30, 58] },
  { id: 'picnic', view: [100, 34] },
];

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

/** The fish that bite in this season and time of day; rain brings up the ones of the deep. */
export function fishHere(season, period) {
  return FISH.filter(f => f.seasons.includes(season) && f.periods.includes(period));
}
/** A bite: which fish, and how long it is (cm, to a millimetre; big ones are rarer). */
export function bite(season, period, weather, rng) {
  const fish = weighted(fishHere(season, period), f => f.weight * (weather === 'rain' ? f.rain || 1 : 1), rng),
    [low, high] = fish.size,
    size = Math.round((low + (high - low) * rng() ** 1.6) * 10) / 10;
  return { fish, size };
}

/** The bugs of a kind that fly in this season and time of day. */
export function bugsHere(kind, season, period) {
  return BUGS.filter(b => b.kind === kind && b.seasons.includes(season) && b.periods.includes(period));
}
/** Which of a kind flies by now, or null when none does. */
export function flyingBug(kind, season, period, rng) {
  const here = bugsHere(kind, season, period);
  return here.length ? weighted(here, b => b.weight, rng) : null;
}

/** A kind of fish or bug by its name. */
export const kindOf = (book, id) => (book === 'fish' ? FISH : BUGS).find(x => x.id === id) || null;
