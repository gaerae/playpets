// A short flurry over the desktop grass (overlay.css .flurry): when someone was just with a friend
// standing on it, a few petals, leaves or flakes of the season drift down around that friend and
// settle, and then nothing moves again. It is a moment, not weather: it comes rarely, only in the
// three seasons that have something to fall, and never with reduced motion. Each bit is moved by
// the compositor (a CSS animation of transform and opacity), so no frame loop wakes for it.

import { between, clamp } from '../core/math.js';

/** The least time between two flurries. */
export const FLURRY_GAP_MS = 4 * 60_000;
/** What falls in each season; summer has nothing. */
const FALLS = { spring: 'petal', autumn: 'leaf', winter: 'snow' };
/** How many bits fall, how far either side of the friend, and for how long (ms). */
const BITS = 7;
const SPREAD = 150;
const FALL_MS = [3600, 5200];
const LATEST_START = 1400;
/** How many looks each falling thing has in its drawing (desktop-fall-*.webp). */
const LOOKS = 4;
/** How many ways down there are (overlay.css flurry-fall-0…3): fixed, so the compositor runs them. */
const PATHS = 4;

/**
 * A flurry in `host` (the grass). `season(name)` says the season the yard shows; `fall(x, width)`
 * lets one fall around `x` across a strip `width` wide, and says whether it did.
 */
export function setupFlurry({
  host,
  reduced,
  now = () => performance.now(),
  random = Math.random,
  gap = FLURRY_GAP_MS,
}) {
  let season = null;
  let last = -Infinity;
  let layer = null;
  let timer = 0;
  function clear() {
    clearTimeout(timer);
    layer?.remove();
    layer = null;
  }
  return {
    season(next) {
      season = next;
      if (!FALLS[next]) clear();
    },
    fall(x, width) {
      const kind = FALLS[season];
      if (!kind || reduced.matches || host.hidden || now() - last < gap) return false;
      last = now();
      clear();
      layer = document.createElement('div');
      layer.className = `flurry flurry-${kind}`;
      let longest = 0;
      for (let i = 0; i < BITS; i++) {
        const bit = document.createElement('span');
        bit.className = 'flurry-bit';
        const delay = random() * LATEST_START,
          ms = between(random, FALL_MS);
        longest = Math.max(longest, delay + ms);
        const at = clamp(x + (random() * 2 - 1) * SPREAD, 6, width - 6);
        bit.style.setProperty('--x', `${Math.round(at)}px`);
        bit.style.setProperty('--scale', (0.75 + random() * 0.5).toFixed(2));
        bit.style.setProperty('--delay', `${Math.round(delay)}ms`);
        bit.style.setProperty('--ms', `${Math.round(ms)}ms`);
        bit.dataset.look = String(Math.floor(random() * LOOKS));
        bit.dataset.path = String(Math.floor(random() * PATHS));
        layer.append(bit);
      }
      host.append(layer);
      timer = setTimeout(clear, longest + 120);
      return true;
    },
  };
}
