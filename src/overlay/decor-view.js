// A gift, a flower or a planted tree out on the desktop, as overlay.js keeps it: drawn once it is
// known which it is, then brought in line with the garden only when the garden, the season or the
// minute changes. A friend walking streams places many times a second; none of this runs for those.

import { loadArt } from '../yard/art.js';
import { decorName, heldArt } from '../yard/find-out.js';
import { giftLayers, quietLook } from '../yard/poke.js';
import { answerOf } from '../yard/press-answer.js';
import { drawGrowing, growing, growingArt } from './growing.js';
import { wear, wearArt } from './wear.js';

const holdsOf = (garden, id) => garden?.decor?.find(d => d.id === id)?.holds || [];

/** Draws the desktop thing `view` ({ id, kind, button }) once its drawings are in: as a flower or a
 * tree when `garden` lists it so, else as a gift. A flower placed on the screen before the garden
 * that names it has arrived is left for a later call, so it is never drawn as a gift. Then brought
 * in line with `garden` in `season` and the yard's `night` (dressDecor). Does nothing once drawn or
 * while loading. */
export async function drawDecor(view, garden, season, night = () => []) {
  if (view.drawn || view.loading) return;
  const known = garden(),
    thing = growing(known, view.id),
    holds = holdsOf(known, view.id),
    // A find out has no drawing of its own: it waits for the garden to say which find it holds.
    art = thing ? growingArt(view.kind) : [...wearArt(view.kind), ...heldArt(view.kind, holds)];
  if (!art.length) return;
  // What a find out holds, for a poke to answer by (yard/poke.js).
  view.holds = holds;
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
    // Under what it wears, which wear.js adds after it; a lit gift's light and a moving part with it
    // (yard/poke.js).
    view.button.insertAdjacentHTML('afterbegin', giftLayers(view.kind, holds));
    view.button.title = decorName(view.kind, holds);
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

/** How the desktop thing `view` (its id and kind) answers a press as the yard does (press-answer.js):
 * a flower or a tree in `garden` by `season`, and a gift with no answer of its own (yard/poke.js
 * quietLook). Null for a gift that moves, lights or is a find out when poked. */
export function pressLook(view, garden, season) {
  const thing = growing(garden, view.id);
  if (thing) return answerOf({ what: thing.what, kind: thing.item.kind, season });
  return quietLook(view.kind);
}
