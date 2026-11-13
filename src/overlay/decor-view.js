// A gift, a flower or a planted tree out on the desktop, as overlay.js keeps it: drawn once it is
// known which it is, then brought in line with the garden only when the garden, the season or the
// minute changes. A friend walking streams places many times a second; none of this runs for those.

import { t } from '../core/i18n.js';
import { artSvg, loadArt } from '../yard/art.js';
import { drawGrowing, growing, growingArt } from './growing.js';
import { wear, wearArt } from './wear.js';

/** Draws the desktop thing `view` ({ id, kind, button }) once its drawings are in: as a flower or a
 * tree when `garden` lists it so, else as a gift. A flower placed on the screen before the garden
 * that names it has arrived is left for a later call, so it is never drawn as a gift. Then brought
 * in line with `garden` in `season` and the yard's `night` (dressDecor). Does nothing once drawn or
 * while loading. */
export async function drawDecor(view, garden, season, night = () => []) {
  if (view.drawn || view.loading) return;
  const thing = growing(garden(), view.id),
    art = thing ? growingArt(view.kind) : wearArt(view.kind);
  if (!art.length) return;
  view.loading = true;
  try {
    await loadArt(art);
  } finally {
    view.loading = false;
  }
  view.drawn = true;
  view.growing = !!thing;
  // A flower or a tree is named by its stage as it is drawn (growing.js).
  if (!thing) {
    // Under what it wears, which wear.js adds after it.
    view.button.insertAdjacentHTML('afterbegin', artSvg(art[0]));
    view.button.title = t(`decor.kind_${view.kind}`);
    view.button.setAttribute('aria-label', view.button.title);
  }
  dressDecor(view, garden(), season(), new Date(), night());
}

/** Brings a drawn desktop thing in line with `garden` at `now`: a flower or a tree as grown, in
 * `season`; a gift in what it wears, and in its night look when `night` (the kinds the yard shows
 * so) names it. Each draws again only when how it looks changed. */
export function dressDecor(view, garden, season, now = new Date(), night = []) {
  if (!view.drawn) return;
  if (!view.growing) return wear(view, garden, now, night);
  const thing = growing(garden, view.id);
  if (thing) drawGrowing(view, thing, season, now.getTime());
}

// A thing let go on the desktop comes down to the floor (overlay.rs set_down) in at most this long,
// and only when the backend's word comes this soon after the drop.
const FALL_MS = 360;
const DROP_WAIT_MS = 1500;
/** Puts the desktop thing `view` ({ wrap, at, dropped, drag, fall }) at (x, y) in its monitor's window. Let go
 * above the floor (`view.dropped`, the time its drag ended), it falls to where the backend set it
 * down rather than jumping there, unless motion is reduced (`still`). The place the drag left it,
 * sent again, keeps it waiting for that word. */
export function settleDecor(view, x, y, still, now = performance.now()) {
  const from = view.at,
    dropped = view.dropped;
  view.at = { x, y };
  view.wrap.style.transform = `translate(${x}px,${y}px)`;
  // Held (`view.drag`), it follows the pointer: a drop time left over is not this drag's.
  if (view.drag) view.dropped = 0;
  if (view.drag || !dropped || !from || y === from.y) return;
  view.dropped = 0;
  if (still || y < from.y || now - dropped > DROP_WAIT_MS || !view.wrap.animate) return;
  // Gathering speed as it comes down, and quicker for a short drop.
  view.fall = view.wrap.animate(
    [{ transform: `translate(${from.x}px,${from.y}px)` }, { transform: view.wrap.style.transform }],
    {
      duration: Math.min(FALL_MS, 120 + (y - from.y) / 3),
      easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
    },
  );
}
/** The desktop thing `view` is picked up: a fall under way stops at once (the pointer takes it from
 * the place it is set at), and the last drop, if the backend's word on it has not come, is let be. */
export function holdDecor(view) {
  view.fall?.cancel();
  view.fall = null;
  view.dropped = 0;
}
