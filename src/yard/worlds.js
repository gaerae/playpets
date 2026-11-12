// Worlds describe their artwork, usable floor and outdoor capabilities as content data.
export const worlds = [];
export function useWorlds(definitions) {
  worlds.splice(0, worlds.length, ...definitions);
}
// A place that gave way to another: a choice saved there opens the one that replaced it.
const REPLACED = new Map([['studio', 'workshop']]);
/** The place that replaced `id`, or null. */
export const replacedBy = id => REPLACED.get(id) ?? null;
/** Saved choices that are no longer available return to the original woodland. */
export function worldFor(id) {
  const shown = REPLACED.get(id) ?? id;
  return (
    worlds.find(world => world.id === shown) || worlds.find(world => world.id === 'woodland') || { id: 'woodland' }
  );
}
/** Before content loads, the original outdoor yard retains its existing behavior. */
export function worldAllows(id, capability) {
  return worldFor(id).capabilities?.[capability] !== false;
}
/** Whether the place's floor is soil (digging, trails, flowers in the ground): as it says, else
 * wherever the sky shows. A workspace shows the sky through glass over a paved floor. */
export function worldHasSoil(id) {
  const capabilities = worldFor(id).capabilities;
  return capabilities?.soil ?? capabilities?.sky !== false;
}
