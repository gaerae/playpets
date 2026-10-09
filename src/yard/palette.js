// The painted yard's colours and light: the stylesheet's colours as the painter uses them, the
// sun's side and strength by the time of day and the weather, and foliage in its four values.
import { color, dull, light, mix, shade } from './brush.js';

/**
 * The light: where the sun stands (`side` -1 on the left, 1 on the right) and how strongly it
 * lights things (0 to 1), by the time of day and the weather.
 */
export function lightFor(period, weather) {
  const side = { morning: -1, day: -0.45, evening: 1, night: 0.3 }[period] ?? -0.45,
    strength = { morning: 0.85, day: 1, evening: 0.85, night: 0.35 }[period] ?? 1;
  return { side, strength: weather === 'clear' ? strength : strength * 0.4 };
}

/** The stylesheet's colours as the painter uses them, with the fallbacks the stylesheet has. */
export function readPalette(get) {
  const names = [
    'sky-a',
    'sky-m',
    'sky-b',
    'mount-a',
    'mount-b',
    'far',
    'far-hi',
    'back',
    'back-hi',
    'front',
    'front-hi',
    'cloud',
    'cloud-shade',
    'leaf',
    'leaf-hi',
    'leaf-lo',
    'pine',
    'pine-lo',
    'trunk',
    'trunk-lo',
    'blade',
    'rock',
    'rock-hi',
    'flower-a',
    'flower-b',
    'flower-c',
    'cap',
    'crown',
    'crown-hi',
    'crown-lo',
    'maple',
    'maple-hi',
    'maple-lo',
  ];
  const raw = Object.fromEntries(names.map(n => [n, get(n)]));
  // A round tree's crown is the bushes' green unless the season gives it its own (scenery.css).
  for (const tone of ['', '-hi', '-lo']) {
    raw[`crown${tone}`] ||= raw[`leaf${tone}`];
    raw[`maple${tone}`] ||= raw[`leaf${tone}`];
  }
  raw.cap ||= 'transparent';
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === 'transparent' ? [0, 0, 0, 0] : color(v)]));
}

/** On a rainy day the land is greyer and a little darker. */
export function weathered(pal, weather) {
  if (weather !== 'rain') return pal;
  const out = { ...pal };
  for (const k of Object.keys(out))
    if (!k.startsWith('sky') && !k.startsWith('cloud')) out[k] = shade(dull(out[k], 0.28), 0.08);
  return out;
}

/** Foliage in four values from the palette's three: deep shade, shade, body, light. */
export function tones([hi, mid, lo], lit) {
  return {
    deep: shade(lo, 0.38),
    dark: mix(lo, mid, 0.15),
    body: mid,
    // Sunlit green leaves go warm and yellow-green, not pale; blossom and autumn colours lighten.
    glow: mix(
      mid,
      hi[1] > hi[0] && hi[1] > hi[2] ? mix(hi, [226, 234, 118, hi[3]], 0.3) : light(hi, 0.25),
      0.3 + lit.strength * 0.7,
    ),
  };
}
