// A room without a sky, lit by its own pictures, as the retired living room was: a picture for each
// time of day (`art`, authored light), a view through its windows for each season (`windowArt`)
// and rain or snow only in its panes. No shipped place is one any more, but a background of your own
// can have no sky and panes of its own (background-pack.js), and the rest is still read from a
// place's data (environment.js), so those rules keep their tests here.
import { useWorlds } from '../../src/yard/worlds.js';
import { worlds } from './content.mjs';

export const den = {
  id: 'den',
  label: 'world.workshop',
  about: 'world.workshop.about',
  chatter: 'world.workshop.lines',
  art: {
    morning: 'studio-cozy-morning',
    day: 'studio-cozy-day',
    evening: 'studio-cozy-evening',
    night: 'studio-cozy-night',
  },
  authoredLighting: true,
  windowPanes: [
    {
      x: 0.297,
      y: 0.102,
      width: 0.466,
      height: 0.352,
    },
    {
      x: 0.006,
      y: 0.116,
      width: 0.02,
      height: 0.07,
    },
    {
      x: 0.007,
      y: 0.211,
      width: 0.018,
      height: 0.076,
    },
    {
      x: 0.008,
      y: 0.307,
      width: 0.017,
      height: 0.055,
    },
    {
      x: 0.039,
      y: 0.119,
      width: 0.01,
      height: 0.074,
    },
    {
      x: 0.038,
      y: 0.213,
      width: 0.011,
      height: 0.077,
    },
    {
      x: 0.038,
      y: 0.307,
      width: 0.01,
      height: 0.061,
    },
    {
      x: 0.968,
      y: 0.125,
      width: 0.014,
      height: 0.077,
    },
    {
      x: 0.968,
      y: 0.23,
      width: 0.014,
      height: 0.05,
    },
    {
      x: 0.968,
      y: 0.307,
      width: 0.014,
      height: 0.053,
    },
  ],
  fit: 'cover-floor',
  geometry: {
    fieldTop: 0.76,
    lake: null,
  },
  capabilities: {
    sky: false,
    weather: true,
    wildlife: false,
    fishing: false,
    seasonalEffects: false,
    ambient: false,
  },
  windowArt: {
    spring: 'studio-view-spring',
    autumn: 'studio-view-autumn',
    winter: 'studio-view-winter',
  },
};
/** Adds the den to the places for the test `t`, and takes it away after. */
export function withDen(t) {
  useWorlds([...worlds, den]);
  t.after(() => useWorlds(worlds));
}
