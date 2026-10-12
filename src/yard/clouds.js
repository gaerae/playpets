// The sky and its clouds: the light from the top down to the haze, heaped clouds white on top and
// blue-lavender in their shade, and the overcast of a rainy or snowy day.
import { bumpy, gauss, mix, seeded, shade, vertical } from './brush.js';
import { lightFor } from './palette.js';

/**
 * One cloud: puffs heaped into a dome on a flat base. The whole of it in blue shade first, then a
 * paler band, then the sunlit white over the upper part, so the lower part stays in shade.
 */
export function paintCloud(ctx, cx, bottom, width, height, pal, rng, lit) {
  const body = pal.cloud,
    under = mix(mix(pal['cloud-shade'], pal['sky-a'], 0.35), shade(pal['cloud-shade'], 0.2), 0.4),
    half = mix(body, pal['cloud-shade'], 0.55),
    puffs = [];
  const n = 7 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const across = (i / (n - 1) - 0.5) * 2 + gauss(rng) * 0.1,
      dome = (1 - Math.abs(across)) ** 1.15,
      r = height * (0.2 + dome * 0.24) * (0.85 + rng() * 0.3);
    puffs.push({ x: cx + across * width * 0.4, y: bottom - r * 0.5 - dome * height * 0.42, r });
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - width, bottom - height * 2, width * 2, height * 2);
  ctx.clip();
  for (const p of puffs) bumpy(ctx, p.x, p.y, p.r, p.r * 0.9, under, rng, p.r * 0.18);
  for (const p of puffs)
    bumpy(ctx, p.x + lit.side * p.r * 0.1, p.y - p.r * 0.25, p.r * 0.84, p.r * 0.7, half, rng, p.r * 0.17);
  for (const p of puffs)
    bumpy(ctx, p.x + lit.side * p.r * 0.2, p.y - p.r * 0.42, p.r * 0.66, p.r * 0.54, body, rng, p.r * 0.16);
  ctx.restore();
}

/** The sky: its light from the top down to the haze, and the clouds that stand still in it. */
export function paintSky(ctx, w, h, palette, { period, weather, season }, images = new Map()) {
  const pal = palette,
    lit = lightFor(period, weather),
    rng = seeded(23);
  ctx.fillStyle = vertical(ctx, 0, h, [
    [0, pal['sky-a']],
    [0.34, pal['sky-m']],
    [0.6, pal['sky-b']],
    [1, pal['sky-b']],
  ]);
  ctx.fillRect(0, 0, w, h);
  if (weather === 'clear' ? images.has('cumulus') && images.has('small') : images.has('overcast')) {
    ctx.save();
    ctx.globalAlpha = period === 'night' ? 0.2 : period === 'evening' ? 0.65 : 0.9;
    if (weather === 'clear' && period !== 'night') {
      ctx.drawImage(images.get('cumulus'), w * 0.07, h * 0.13, w * 0.27, (w * 0.27 * 295) / 512);
      ctx.drawImage(images.get('small'), w * 0.58, h * 0.2, w * 0.19, (w * 0.19 * 226) / 475);
    } else if (weather !== 'clear') {
      for (const x of [-0.12, 0.25, 0.62]) ctx.drawImage(images.get('overcast'), w * x, -h * 0.08, w * 0.5, h * 0.43);
    }
    ctx.restore();
    return;
  }
  if (weather === 'clear' && period !== 'night') {
    // A heap of cloud towering behind the mountains, taller in summer, and a smaller one.
    const tall = season === 'summer' ? 1.4 : 1;
    paintCloud(ctx, w * 0.2, h * 0.47, w * 0.26, h * 0.22 * tall, pal, rng, lit);
    paintCloud(ctx, w * 0.62, h * 0.46, w * 0.16, h * 0.12 * tall, pal, rng, lit);
  } else if (weather !== 'clear') {
    // Overcast: layers of cloud, each with a bumpy underside, darker ones lower.
    for (let i = 0; i < 6; i++) {
      const y = h * (0.04 + i * 0.07),
        c = mix(pal.cloud, pal['cloud-shade'], i / 5);
      for (let x = -40; x < w + 40; x += h * 0.12) {
        const r = h * (0.07 + rng() * 0.05);
        bumpy(ctx, x, y + gauss(rng) * h * 0.015, r * 1.4, r * 0.7, c, rng, r * 0.25, weather === 'rain' ? 0.95 : 0.85);
      }
    }
  }
}
