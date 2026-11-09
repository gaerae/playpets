// The faint blue shade a rolling snowball leaves on the snow, fading back over a few seconds.
//
// - One canvas below the friends, not an element per stamp: a roll leaves up to TRAIL_MAX of them.
// - It is hidden until the first stamp, painted only from the game's own frame while a stamp lives,
//   and hidden again once the last has faded, so an idle yard never touches it.
// - Every stamp is drawn from one soft gradient sprite, scaled and faded with globalAlpha, so a
//   frame makes no gradients. The blur is CSS on the element (WebKit has no ctx.filter).
// - With reduced motion nothing is left behind.
import { reduced } from '../core/sprites.js';
import { $ } from '../core/state.js';

export const FADE_MS = 4000;
export const TRAIL_ALPHA = 0.55;
// Shared with the footprints, so a trail and a footprint are the same cool shadow of the snow.
export const TRAIL_RGB = '150,176,214';
export const TRAIL_MAX = 120;
const SQUASH = 0.38;
const SPACING = 0.35;
const SETTLE_MS = 600;
// The sprite is drawn once at this width and scaled down, so growing balls never rebuild it.
const SPRITE_W = 64;

let canvas = null,
  ctx = null,
  sprite = null,
  stamps = [],
  last = null,
  sized = false,
  painted = false,
  timer = 0,
  w = 0,
  h = 0;

const rgba = alpha => `rgba(${TRAIL_RGB},${Number(alpha.toFixed(3))})`;

export function setupSnowTrail() {
  canvas = $('trail-layer');
  ctx = null;
  sprite = null;
  sized = painted = false;
  clear();
}

function buildSprite() {
  const el = document.createElement('canvas');
  el.width = SPRITE_W;
  el.height = Math.ceil(SPRITE_W * SQUASH);
  const c = el.getContext('2d'),
    r = SPRITE_W / 2;
  c.translate(r, el.height / 2);
  c.scale(1, SQUASH);
  const gradient = c.createRadialGradient(0, 0, 0, 0, 0, r);
  gradient.addColorStop(0, rgba(TRAIL_ALPHA));
  gradient.addColorStop(1, rgba(0));
  c.fillStyle = gradient;
  c.fillRect(-r, -r, SPRITE_W, SPRITE_W);
  return el;
}

function size() {
  const box = canvas.getBoundingClientRect(),
    ratio = Math.min(2, window.devicePixelRatio || 1);
  if (!box.width || !box.height) return false;
  w = box.width;
  h = box.height;
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  ctx ??= canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  sized = true;
  return true;
}

function clear() {
  clearTimeout(timer);
  timer = 0;
  stamps = [];
  last = null;
  if (painted && ctx) ctx.clearRect(0, 0, w, h);
  painted = false;
  if (canvas) {
    canvas.classList.remove('fading');
    canvas.hidden = true;
  }
}

/** A stamp at a ball's foot, in yard px; `width` is the ball's width, `now` the game's clock. */
export function trailStamp(x, y, width, now) {
  if (!canvas || reduced.matches) return;
  if (last && Math.hypot(x - last.x, y - last.y) < width * SPACING) return;
  if (timer) {
    clearTimeout(timer);
    timer = 0;
    canvas.classList.remove('fading');
  }
  // A hidden canvas has no box to measure.
  canvas.hidden = false;
  if (!sized && !size()) {
    canvas.hidden = true;
    return;
  }
  last = { x, y, width, at: now };
  stamps.push(last);
  if (stamps.length > TRAIL_MAX) stamps.shift();
}

/** Paints the stamps that still live. False when there is nothing left to paint. */
export function trailFrame(now) {
  if (!stamps.length && !painted) return false;
  stamps = stamps.filter(s => now - s.at < FADE_MS);
  if (!stamps.length) {
    clear();
    return false;
  }
  sprite ??= buildSprite();
  ctx.clearRect(0, 0, w, h);
  for (const s of stamps) {
    const rx = s.width / 2;
    ctx.globalAlpha = 1 - (now - s.at) / FADE_MS;
    ctx.drawImage(sprite, s.x - rx, s.y - rx * SQUASH, s.width, s.width * SQUASH);
  }
  ctx.globalAlpha = 1;
  painted = true;
  return true;
}

/** When a game ends: the rest fades out by CSS, then the stamps and the canvas are cleared. */
export function fadeTrail() {
  if (!canvas || (!stamps.length && !painted) || timer) return;
  canvas.classList.add('fading');
  timer = setTimeout(clear, SETTLE_MS);
}

/** The yard changed size: the trail goes, and the next stamp measures again. */
export function resizeTrail() {
  sized = false;
  clear();
}
