// The garden's rules, apart from the page so they can be checked on their own: how a plant grows
// with time, what flowers in which season, and when a gift comes.
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
// The yard receives one gift per local day. The first wait is short; later waits take
// 20 to 40 minutes. decor.js preserves the deadline even while the app is closed.
export const FIRST_GIFT = 5 * MIN;
export const GIFT_WAIT = [20 * MIN, 40 * MIN];
export function giftWait(rng, first = false) {
  return first ? FIRST_GIFT : between(rng, GIFT_WAIT);
}
/** The day as the person's clock has it, as the backend keeps it: YYYY-MM-DD. */
export function localDay(date) {
  const two = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
