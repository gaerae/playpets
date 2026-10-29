// The garden's rules, apart from the page so they can be checked on their own: how a plant grows
// with time, what flowers in which season, and when an everyday gift comes.
// Design: docs/design/2026-10-09-a-yard-that-grows.md.

import { between } from '../core/math.js';
import { FLOWERS, STAGES, weighted } from './catalog.js';

const MIN = 60 * 1000;

// A plant's stages come from the catalogue (catalog.js STAGES).
export { STAGES };
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
/** What a seed planted in this season grows into: one of the season's flowers, each as likely as its
 * weight (catalog.json "weight", 1 if left out). */
export function flowerFor(season, rng = Math.random) {
  const here = FLOWERS.filter(f => f.season === season);
  return here.length ? weighted(here, f => f.weight ?? 1, rng).id : FLOWERS[0].id;
}
/** A duration said briefly: "1 h 20 min" style parts, for a plant's tooltip. */
export function hoursMinutes(ms) {
  const minutes = Math.ceil(ms / MIN);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
// An everyday gift comes every other day (limits giftEveryDays), from a friend the person did
// something with that day: time alone brings nothing. Once one may come, the first gift waits 5
// minutes and later ones 10 to 20; the backend keeps the deadline (garden giftWait), so closing
// the app keeps its progress.
export const FIRST_GIFT = 5 * MIN;
export const GIFT_WAIT = [10 * MIN, 20 * MIN];
export function giftWait(rng, first = false) {
  return first ? FIRST_GIFT : between(rng, GIFT_WAIT);
}
/** Days from one YYYY-MM-DD to another (negative when `to` is earlier); NaN for a malformed one. */
export function daysBetween(from, to) {
  const day = s => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8)) : NaN);
  return Math.round((day(to) - day(from)) / 86_400_000);
}
/** Whether an everyday gift may come `today`, the last having come on `last` ('' for never). */
export const giftDue = (last, today, every) => !last || daysBetween(last, today) >= every;
/** The day as the person's clock has it, as the backend keeps it: YYYY-MM-DD. */
export function localDay(date) {
  const two = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
