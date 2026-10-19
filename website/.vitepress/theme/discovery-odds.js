import { bugChances } from '../../../src/yard/catalog.js';

export { discoveryFindChances } from '../../../src/yard/discovery-rewards.js';

/** Per spawned individual, including the runtime's butterfly/dragonfly split. */
export function discoveryBugChances(catalog, season, period, weather, event = null) {
  return bugChances(season, period, weather, event, catalog.bugs);
}
