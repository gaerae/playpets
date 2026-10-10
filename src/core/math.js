// Numbers without the page: the rules modules (games, wander) and the page both use these.

/** `x` kept within [a, b]. */
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/** A number between `lo` and `hi` at random, such as a wait in a range (`rng` gives numbers in [0, 1)). */
export const between = (rng, [lo, hi]) => lo + rng() * (hi - lo);

/** One of `list` at random (`rng` gives numbers in [0, 1)). */
export const pick = (list, rng = Math.random) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** A copy of `list` in random order (Fisher–Yates; `rng` gives numbers in [0, 1)). */
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
