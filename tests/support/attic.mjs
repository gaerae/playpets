// A background of your own with no sky (background-pack.js): one picture, a floor of its own and
// window panes where rain or snow shows. No shipped place is a room without a sky, so the rules for
// one are tested on this.
import { backgroundWorld } from '../../src/yard/background-pack.js';
import { useWorlds } from '../../src/yard/worlds.js';
import { worlds } from './content.mjs';

export const attic = backgroundWorld(
  {
    name: 'Attic',
    images: { base: 'attic.webp' },
    floor: 0.76,
    water: null,
    sky: false,
    weather: true,
    ambient: false,
    windows: [
      { x: 0.297, y: 0.102, width: 0.466, height: 0.352 },
      { x: 0.968, y: 0.125, width: 0.014, height: 0.077 },
    ],
  },
  'custom-attic',
);
/** Adds the attic to the places for the test `t`, and takes it away after. */
export function withAttic(t) {
  useWorlds([...worlds, attic]);
  t.after(() => useWorlds(worlds));
}
