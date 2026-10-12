// The yard's world as it is now: the scene (the time of day, the weather and the season) and the
// weather canvas. sky.js sets them; whatever needs to know them reads them here.

/** The scene now: the time of day, the weather, the season and the seasonal event (or null). */
export const scene = { world: 'woodland', period: 'day', weather: 'clear', season: 'spring', event: null };
/** The weather canvas, once sky.js has made it. */
export let scenery = null;
export function setScenery(canvas) {
  scenery = canvas;
}
