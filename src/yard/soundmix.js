// What the yard sounds like for a scene: how often each of its calls comes (times a minute; 0 is
// never), and whether they come in through a window. There is no sound that goes on by itself:
// between calls the yard is quiet. Pure, so the rules can be tested; src/yard/sound.js plays them.
// Design: docs/design/2026-10-10-yard-sounds.md.

import { worldAllows } from './worlds.js';

/** How often each call comes for a place, a time of day, a weather and a season. */
export function mixFor({ period, weather, season, world }) {
  const indoors = !worldAllows(world, 'ambient'),
    lake = worldAllows(world, 'fishing'),
    clear = weather !== 'rain' && weather !== 'snow',
    snow = weather === 'snow',
    night = period === 'night',
    evening = period === 'evening',
    daylight = period === 'morning' || period === 'day',
    // Through the window a call is heard less often, as if only the nearer ones come in.
    through = indoors ? 0.5 : 1;
  // Birds sing most in the morning, less through the day, a little at dusk, never at night or in
  // rain or snow; winter has few.
  const song = { morning: 10, day: 5, evening: 2.5, night: 0 }[period] ?? 5;
  return {
    indoors,
    birds: clear ? song * (season === 'winter' ? 0.3 : 1) * through : 0,
    // Cicadas now and then on summer days.
    cicadas: clear && season === 'summer' && daylight ? (period === 'day' ? 0.8 : 0.4) * through : 0,
    // A skein of geese going over on an autumn day.
    geese: clear && season === 'autumn' && (daylight || evening) ? 0.25 * through : 0,
    // Frogs by the lake on spring and summer nights, a few at dusk; rain does not stop them.
    frogs: lake && !snow && (season === 'spring' || season === 'summer') ? (night ? 2 : evening ? 0.8 : 0) : 0,
    // A cricket's few chirps on autumn evenings and nights, when the album finds them.
    crickets: clear && season === 'autumn' ? (night ? 2.5 : evening ? 1 : 0) * through : 0,
    // While it rains, a drop on a leaf now and then, or on the workshop's glass.
    drops: weather === 'rain' ? 12 : 0,
  };
}

/** The tones of a cue, as steps of a major pentatonic scale above C6 (0 is C6, 5 is C7). */
export const CUES = {
  pat: [2],
  treat: [0, 2],
  water: [4, 3],
  catch: [3, 5],
  gift: [0, 2, 3, 4],
  level: [0, 2, 3, 5, 7],
  first: [5, 7, 9],
  // A wind chime a friend visits (effects.js).
  chime: [3, 5, 4, 7],
};
const PENTATONIC = [0, 2, 4, 7, 9];
/** The frequency of a step of the pentatonic scale above C6. */
export function stepHz(step) {
  const octave = Math.floor(step / 5),
    semitones = PENTATONIC[((step % 5) + 5) % 5] + 12 * octave;
  return 1046.5 * 2 ** (semitones / 12);
}
