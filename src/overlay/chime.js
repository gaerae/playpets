// The wind chime's ring on the desktop, and a find's own sound when poked (a music box's tune, a
// cicada's song): the yard's cues (soundscape.js), at the yard's volume,
// when the sound is on. The desktop has no sound of its own, so the audio wakes for a ring and
// rests a moment after it, costing nothing in between.

import { createSoundscape } from '../yard/soundscape.js';

const REST_MS = 2500;
let ctx = null,
  scape = null,
  resting = 0;

/** Rings `cue` (the chime unless named) by the sound setting `sound` (the backend's: on, volume 0
 * to 100). */
export function ring(sound, cue = 'chime') {
  if (sound?.on === false || typeof AudioContext === 'undefined') return;
  if (!ctx) {
    ctx = new AudioContext();
    scape = createSoundscape(ctx, ctx.destination);
    scape.setMix({});
  }
  clearTimeout(resting);
  // A poke is a touch, so the webview lets the audio start.
  ctx.resume().catch(() => {});
  scape.setVolume(sound?.volume ?? 40, ctx.currentTime, 0.02);
  scape.cue(cue);
  resting = setTimeout(() => {
    scape.setVolume(0, ctx.currentTime, 0.12);
    setTimeout(() => ctx.suspend().catch(() => {}), 600);
  }, REST_MS);
}
