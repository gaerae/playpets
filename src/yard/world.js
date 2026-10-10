// The yard's world as it is now: the scene (the time of day, the weather and the season) and the
// weather canvas. sky.js sets them; whatever needs to know them reads them here.

/** The scene now. */
export const scene = { period: 'day', weather: 'clear', season: 'spring' };
/** The weather canvas, once sky.js has made it. */
export let scenery = null;
export function setScenery(canvas) {
  scenery = canvas;
}
