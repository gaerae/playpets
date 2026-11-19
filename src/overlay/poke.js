// How a gift on the desktop answers: its lit look by the hour, and a poke (a press let go where it
// started). A gift's moving part is cut from its own painting by a polygon in the catalogue
// (catalog.json "part": points and pivot as shares of its box, and "spin" or "sway"): the drawing
// is laid twice, once without the part and once with only the part, which turns. Each motion is
// one animation that ends by itself (overlay.css). A lamp ("poke": "switch") goes off or on until
// the hour next changes, and a fishbowl's fish swims across and back (display.js). A gift that hangs
// draws its cord too, for when it hangs from a screen's top. Design:
// docs/design/2026-11-19-desktop-items-that-answer.md, docs/design/2026-11-19-album-on-display.md,
// docs/design/2026-11-19-desktop-edges.md.

import { artSvg } from '../yard/art.js';
import { giftKind } from '../yard/catalog.js';
import { displayEffects, displayKind } from '../yard/display.js';
import { effectLayers } from '../yard/effects.js';

const share = ([x, y]) => `${x * 100}% ${y * 100}%`;
/** A gift's drawing as the desktop lays it: its effects' layers (a lit gift's halo and pool, a
 * firefly jar's, by what a display `holds`) under its drawing, and a moving part as a second copy
 * of the drawing over the rest. */
export function giftLayers(kind, holds = []) {
  const gift = giftKind(kind);
  if (!gift?.art) return '';
  const drawing = artSvg(gift.art),
    under = effectLayers([...(gift.effects || []), ...displayEffects(kind, holds)]);
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

/** The gift `view` was poked at the hour `period`: a lamp switches, a moving part turns once
 * (not with `reduced` motion), and a chime rings through `ring`. */
export function poke(view, { period, reduced, ring }) {
  const gift = giftKind(view.kind);
  if (!gift) return;
  if (gift.poke === 'switch') {
    const lit = view.lamp?.period === period ? view.lamp.on : litBy(period);
    view.lamp = { period, on: !lit };
    showLamp(view, period);
  }
  // A fishbowl's fish is its moving part.
  const part =
    (gift.part && (view.part ??= view.button.querySelector('.part'))) ||
    (displayKind(view.kind)?.holds === 'fish' && view.button.querySelector('.held'));
  if (part && !reduced) {
    if (!gift.part) part.dataset.motion = 'swim';
    // From the start again when poked while it still moves.
    part.classList.remove('moving');
    void part.offsetWidth;
    part.classList.add('moving');
    part.addEventListener('animationend', () => part.classList.remove('moving'), { once: true });
  }
  if (gift.effects?.includes('chime')) ring();
}
