// Effects a gift can have, by name: the catalogue lists a gift's effects (catalog.json "effects"),
// the decoration carries them as data-effects, and each effect is here: a layer drawn with the gift,
// something that happens when a friend visits it, and its rules in the stylesheet (garden.css,
// "effects"). A new gift uses an effect by naming it; an effect changes here and in its rules, and
// every gift that names it follows.
//   glow: lit from evening on, a halo round its light and a warm pool on the ground at its foot,
//   and not dimmed at night.
//   halo: the glow's halo alone, with no pool on the ground: a firefly out of the album, which has
//   no shadow either (find-out.js).
//   chime: rings when a friend visits it.
// Without any effect, a drawing still follows the scene through the colours it paints with
// (--lamp lights up in the evening, --bird is 0 at night and in rain or snow, --sky-* mirror the sky).
// The halo is round the light: the top of the middle, or the point the catalogue gives ("light", as
// shares of the drawing: a lamp hung to one side of its post).
const halo = light =>
  light
    ? `<span class="fx-glow" style="left: ${light[0] * 100}%; top: ${light[1] * 100}%" aria-hidden="true"></span>`
    : '<span class="fx-glow" aria-hidden="true"></span>';
const EFFECTS = {
  glow: { layer: light => `${halo(light)}<span class="fx-pool" aria-hidden="true"></span>` },
  halo: { layer: halo },
  chime: { visited: yard => yard.cue('chime') },
};

/** The effects there are. */
export const EFFECT_NAMES = Object.keys(EFFECTS);
/** The extra layers for these effects, as markup placed before the drawing; `light` is where a lit
 * one's light is (catalog.json "light"), if not at the top of the middle. */
export const effectLayers = (effects = [], light) => effects.map(name => EFFECTS[name]?.layer?.(light) || '').join('');
/** A friend visited a gift with these effects; `yard` is what an effect may use (`cue` a sound). */
export function effectsVisited(effects = [], yard) {
  for (const name of effects) EFFECTS[name]?.visited?.(yard);
}
