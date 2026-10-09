// The garden's rules, apart from the page so they can be checked on their own: how a plant grows
// with time, what flowers in which season, how often a friend finds a seed, and when a gift comes.
// Design: docs/design/2026-10-09-a-yard-that-grows.md.

const MIN = 60 * 1000,
  HOUR = 60 * MIN;
// A plant's stages and when each begins, counted from planting.
export const STAGES = [
  { name: 'seed', at: 0 },
  { name: 'sprout', at: 10 * MIN },
  { name: 'leaves', at: 40 * MIN },
  { name: 'bud', at: 2 * HOUR },
  { name: 'bloom', at: 4 * HOUR },
];
/** The stage a plant planted at `planted` (ms) is in at `now`, and how long until the next one. */
export function stageOf(planted, now) {
  const age = Math.max(0, now - planted);
  let i = 0;
  while (i + 1 < STAGES.length && age >= STAGES[i + 1].at) i++;
  const next = STAGES[i + 1];
  return { name: STAGES[i].name, index: i, untilNext: next ? next.at - age : 0 };
}
/** How long until it flowers (0 once it has). */
export const untilBloom = (planted, now) => Math.max(0, STAGES.at(-1).at - Math.max(0, now - planted));
// What grows from a seed planted in each season.
export const FLOWER_OF = { spring: 'tulip', summer: 'sunflower', autumn: 'cosmos', winter: 'camellia' };
export const flowerFor = season => FLOWER_OF[season] || 'tulip';
// A friend finds a seed this long after the last find (ms of the app running). The very first one
// comes soon, so a new yard shows the garden early.
export const FIND_GAP = [8 * MIN, 20 * MIN];
export const FIRST_FIND = [60 * 1000, 120 * 1000];
export function nextFind(rng, first = false) {
  const [low, high] = first ? FIRST_FIND : FIND_GAP;
  return low + rng() * (high - low);
}
/** A duration said briefly: "1 h 20 min" style parts, for a plant's tooltip. */
export function hoursMinutes(ms) {
  const minutes = Math.ceil(ms / MIN);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
// A friend brings a gift once a day, after the yard has been seen a while that day: the very
// first one soon, so a new yard shows what gifts are, later ones after 20 to 40 minutes.
export const FIRST_GIFT = 5 * MIN;
export const GIFT_WAIT = [20 * MIN, 40 * MIN];
export function giftWait(rng, first = false) {
  return first ? FIRST_GIFT : GIFT_WAIT[0] + rng() * (GIFT_WAIT[1] - GIFT_WAIT[0]);
}
/** The day as the person's clock has it, as the backend keeps it: YYYY-MM-DD. */
export function localDay(date) {
  const two = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
