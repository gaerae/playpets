// What the yard sounds like for a scene: how loud each layer is (0 to 1) and how often birds call
// (calls a minute). Pure, so the rules can be tested; src/yard/sound.js plays them.
// Design: docs/design/2026-10-10-yard-sounds.md.

/** The layers' levels and the birds' rate for a time of day, a weather and a season. */
export function mixFor({ period, weather, season }) {
  const night = period === 'night',
    evening = period === 'evening',
    rain = weather === 'rain',
    snow = weather === 'snow',
    winter = season === 'winter',
    bare = winter || snow;
  // Birds sing most in the morning, less through the day, a little at dusk, never at night or in
  // rain or snow; winter has few.
  const song = { morning: 10, day: 5, evening: 2.5, night: 0 }[period] ?? 5;
  return {
    // A low breeze is always there; snow muffles it, and it settles at night.
    breeze: snow ? 0.45 : night ? 0.5 : 0.65,
    // Gusts through leaves, where there are leaves to move.
    leaves: bare ? 0 : rain ? 0.25 : night ? 0.3 : 0.6,
    // The lake laps at its shore.
    water: snow ? 0.25 : 0.45,
    rain: rain ? 1 : 0,
    birds: rain || snow ? 0 : song * (winter ? 0.3 : 1),
    // Crickets on summer and autumn nights, a few already at dusk.
    crickets: !rain && !snow && (season === 'summer' || season === 'autumn') ? (night ? 1 : evening ? 0.4 : 0) : 0,
  };
}

/** The tones of a cue, as steps of a major pentatonic scale above C6 (0 is C6, 5 is C7). */
export const CUES = {
  pat: [2],
  treat: [0, 2],
  water: [4, 3],
  catch: [3, 5],
  find: [4, 5, 7],
  gift: [0, 2, 3, 4],
  level: [0, 2, 3, 5, 7],
  first: [5, 7, 9],
};
const PENTATONIC = [0, 2, 4, 7, 9];
/** The frequency of a step of the pentatonic scale above C6. */
export function stepHz(step) {
  const octave = Math.floor(step / 5),
    semitones = PENTATONIC[((step % 5) + 5) % 5] + 12 * octave;
  return 1046.5 * 2 ** (semitones / 12);
}
