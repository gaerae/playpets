// Worlds describe their artwork, usable floor and outdoor capabilities as content data.
export const worlds = [];
export function useWorlds(definitions) {
  worlds.splice(0, worlds.length, ...definitions);
}
/** Saved choices that are no longer available return to the original woodland. */
export function worldFor(id) {
  return worlds.find(world => world.id === id) || worlds.find(world => world.id === 'woodland') || { id: 'woodland' };
}
/** Before content loads, the original outdoor yard retains its existing behavior. */
export function worldAllows(id, capability) {
  return worldFor(id).capabilities?.[capability] !== false;
}
