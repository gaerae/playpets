// The backend draws rewards; these pure rules explain the same conditional odds in the album and guide.
import { LIMITS } from '../core/limits.js';
import { relativeChances } from './catalog.js';

export function rewardWeight(item, context = {}) {
  let weight = item.weight ?? 1;
  for (const [axis, value] of [
    ['seasons', context.season],
    ['weather', context.weather],
    ['places', context.place],
  ]) {
    if (item.affinity?.[axis]?.includes(value)) weight *= 2;
  }
  return weight;
}

/** Per fresh completed dig, before a full inventory refuses the selected item. */
export function discoveryFindChances(catalog, odds, context = {}) {
  const rareReady = context.rareReady !== false;
  const weighted = (items, percent) =>
    relativeChances(items, item => rewardWeight(item, context)).map(item => ({
      ...item,
      chance: (item.chance * percent) / 100,
    }));
  return [
    ...weighted(catalog.trees, odds.sapling),
    ...weighted(
      catalog.treasures.filter(item => item.rarity === 'common'),
      odds.common + (rareReady ? 0 : odds.uncommon),
    ),
    ...weighted(
      catalog.treasures.filter(item => item.rarity === 'uncommon'),
      rareReady ? odds.uncommon : 0,
    ),
  ];
}

/** Saved rewards, not the currently selected scene, own the rolling rare window. */
export function rareReadyAt(digs = [], treasures = [], now = Date.now()) {
  const rare = new Set(treasures.filter(item => item.rarity === 'uncommon').map(item => item.id));
  let ready = 0;
  for (const dig of digs) {
    if (dig.outcome !== 'keepsake' || !rare.has(dig.kind) || !Number.isFinite(dig.at)) continue;
    const end = Math.min(dig.at, now) + LIMITS.digTtlMs;
    if (end > now) ready = Math.max(ready, end);
  }
  return ready;
}
