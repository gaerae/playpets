// How a gift on the desktop answers: its lit look by the hour, and a poke (a press let go where it
// started). A gift's moving part is cut from its own painting by a polygon in the catalogue
// (catalog.json "part": points and pivot as shares of its box, and "spin" or "sway"): the drawing
// is laid twice, once without the part and once with only the part, which turns. Each motion is
// one animation that ends by itself (overlay.css). A lamp ("poke": "switch") goes off or on until
// the hour next changes, and a find out answers in its own way (find-out.js pokeOf): a fish swims
// across and back, a butterfly flaps, a treasure sparkles, and a few make a sound. A gift that hangs
// draws its cord too, for when it hangs from a screen's top. Design:
// docs/design/2026-11-19-desktop-items-that-answer.md, docs/design/2026-11-19-album-finds-out.md,
// docs/design/2026-11-19-desktop-edges.md, docs/design/2026-11-20-finds-come-alive.md.

import { artSvg } from '../yard/art.js';
import { giftKind } from '../yard/catalog.js';
import { effectLayers } from '../yard/effects.js';
import { findOutEffects, findOutKind, pokeOf } from '../yard/find-out.js';

const share = ([x, y]) => `${x * 100}% ${y * 100}%`;
/** A gift's drawing as the desktop lays it: its effects' layers (a lit gift's halo and pool, a
 * firefly's, by what a find out `holds`) under its drawing, and a moving part as a second copy
 * of the drawing over the rest. */
export function giftLayers(kind, holds = []) {
  const gift = giftKind(kind);
  if (!gift) return '';
  const under = effectLayers([...(gift.effects || []), ...findOutEffects(kind, holds)]);
  // A find out has no drawing of its own: only its effects (a firefly's glow) under the find.
  if (!gift.art) return under;
  const drawing = artSvg(gift.art);
  const part = gift.part;
  if (!part?.points?.length) return under + drawing;
  const points = part.points.map(share).join(','),
    // The box, then the part as a hole in it: the joins there and back cancel out.
    rest = `0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${points},${share(part.points[0])}`;
  // A gift that hangs has a cord from its box's top to the pivot, shown once it hangs from a
  // screen's top without its stand (overlay.css .hung).
  const [px, py] = part.pivot,
    cord = gift.hangs ? `<span class="cord" style="left: ${px * 100}%; height: ${py * 100}%"></span>` : '';
  return (
    `${under}<span class="part-still" style="clip-path: polygon(evenodd,${rest})">${drawing}</span>` +
    cord +
    `<span class="part" data-motion="${part.motion}" style="clip-path: polygon(${points});transform-origin: ${share(part.pivot)}">${drawing}</span>`
  );
}

const litBy = period => period === 'evening' || period === 'night';
/** A lamp in line with the hour `period`: lit from evening on, unless a poke in this same part of
 * the day switched it (`view.lamp`), which the next part of the day forgets. */
export function showLamp(view, period) {
  if (view.lamp && view.lamp.period !== period) view.lamp = null;
  const switched = !!view.lamp;
  view.button.classList.toggle('lamp-on', switched && view.lamp.on);
  view.button.classList.toggle('lamp-off', switched && !view.lamp.on);
}

function stopMoving(event) {
  event.currentTarget.classList.remove('moving');
}

/** The gift `view` was poked at the hour `period`: a lamp switches, a moving part turns once and a
 * find out (what `view.holds`) moves its own way (not with `reduced` motion), and a chime or a
 * find's own cue rings through `ring(cue)`, with reduced motion too. */
export function poke(view, { period, reduced, ring }) {
  const gift = giftKind(view.kind);
  if (!gift) return;
  if (gift.poke === 'switch') {
    const lit = view.lamp?.period === period ? view.lamp.on : litBy(period);
    view.lamp = { period, on: !lit };
    showLamp(view, period);
  }
  const out = findOutKind(view.kind),
    answer = out && pokeOf(out.holds, view.holds?.[0]);
  // A find out is its own moving part.
  const part = answer
    ? view.button.querySelector('.held')
    : gift.part && (view.part ??= view.button.querySelector('.part'));
  if (part && !reduced) {
    if (answer) part.dataset.motion = answer.motion;
    // From the start again when poked while it still moves.
    part.classList.remove('moving');
    void part.offsetWidth;
    part.classList.add('moving');
    // Starting over ends the motion without an `animationend`, so the last poke's listener is still
    // there: one shared listener, put back once, keeps quick pokes from piling them up.
    part.removeEventListener('animationend', stopMoving);
    part.addEventListener('animationend', stopMoving, { once: true });
  }
  if (answer?.cue) ring(answer.cue);
  else if (gift.effects?.includes('chime')) ring('chime');
}
