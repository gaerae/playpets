// Effects a gift can have, by name: the catalogue lists a gift's effects (catalog.json "effects"),
// the decoration carries them as data-effects, and each effect is here: a layer drawn with the gift,
// something that happens when a friend visits it, and its rules in the stylesheet (yard.css,
// "effects"). A new gift uses an effect by naming it; an effect changes here and in its rules, and
// every gift that names it follows.
//   glow: lit from evening on, a warm pool of light around it, and not dimmed at night.
//   chime: rings when a friend visits it.
// Without any effect, a drawing still follows the scene through the colours it paints with
// (--lamp lights up in the evening, --bird is 0 at night and in rain or snow, --sky-* mirror the sky).
const EFFECTS = {
  glow: { layer: '<span class="fx-glow" aria-hidden="true"></span>' },
  chime: { visited: yard => yard.cue('chime') },
};

/** The effects there are. */
export const EFFECT_NAMES = Object.keys(EFFECTS);
/** The extra layers for these effects, as markup placed before the drawing. */
export const effectLayers = (effects = []) => effects.map(name => EFFECTS[name]?.layer || '').join('');
/** A friend visited a gift with these effects; `yard` is what an effect may use (`cue` a sound). */
export function effectsVisited(effects = [], yard) {
  for (const name of effects) EFFECTS[name]?.visited?.(yard);
}
