// Numbers without the page: the rules modules (games, wander) and the page both use these.

/** `x` kept within [a, b]. */
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/** A copy of `list` in random order (Fisher–Yates; `rng` gives numbers in [0, 1)). */
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
