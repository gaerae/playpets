// The lake in the valley between the hills, mirroring the sky.
import { bumpy, css, dot, fillShape, gauss, light, mix, shade, vertical } from './brush.js';
import { heightAt, LAKE } from './layout.js';
import { strand } from './trees.js';

/**
 * The lake in the valley, half hidden by the near hill: it mirrors the sky, lighter towards the
 * far shore, with the far hill's reflection along that shore, a thin light edge and a few
 * glints of light on the water.
 */
export function lake(ctx, w, h, pal, rng, lit, back) {
  // The far shore: a low arch from the ridge at one end to the ridge at the other.
  const x0 = LAKE.from * w,
    x1 = LAKE.to * w,
    top = LAKE.top * h,
    shore = [];
  for (let k = 0; k <= 24; k++) {
    const f = k / 24,
      x = x0 + (x1 - x0) * f,
      ends = heightAt(back, x0) * (1 - f) + heightAt(back, x1) * f,
      arch = Math.sin(Math.PI * f) ** 0.6;
    shore.push([x, ends + (top - ends) * arch]);
  }
  const ridge = back.filter(([x]) => x > x0 && x < x1).reverse(),
    water = [...shore, ...ridge.map(([x, y]) => [x, y + 2])],
    sky = mix(pal['sky-m'], pal['sky-a'], 0.65);
  // The sky in the water: pale as the horizon under the far shore, deepening towards us.
  fillShape(
    ctx,
    water,
    vertical(ctx, top, h * 0.64, [
      [0, mix(pal['sky-b'], pal['sky-m'], 0.35)],
      [1, sky],
    ]),
  );
  ctx.save();
  ctx.beginPath();
  for (const [i, [x, y]] of water.entries()) i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  ctx.closePath();
  ctx.clip();
  // The far hill and its trees upside down below the far shore: a band with a bumpy lower edge.
  ctx.fillStyle = css(mix(shade(pal.far, 0.3), pal['sky-m'], 0.25), 0.85);
  ctx.beginPath();
  ctx.moveTo(shore[0][0], shore[0][1] - 2);
  for (const [x, y] of shore) ctx.lineTo(x, y - 2);
  for (const [x, y] of [...shore].reverse()) ctx.lineTo(x, y + h * 0.008);
  ctx.closePath();
  for (let k = 0; k < 14; k++) {
    const [x, y] = shore[Math.floor(1 + rng() * (shore.length - 2))],
      r = h * (0.006 + rng() * 0.007);
    ctx.moveTo(x + r * 1.4, y + h * 0.008);
    ctx.ellipse(x, y + h * 0.008, r * 1.4, r, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  // A cloud's reflection, long and pale.
  bumpy(
    ctx,
    x0 + (x1 - x0) * 0.58,
    top + h * 0.034,
    (x1 - x0) * 0.15,
    h * 0.007,
    light(pal['sky-b'], 0.4),
    rng,
    h * 0.005,
    0.5,
  );
  // Ripples: short strokes, light and a shade darker, longer nearer us.
  ctx.lineCap = 'round';
  for (let k = 0; k < 18; k++) {
    const y = top + h * (0.014 + rng() * 0.05),
      near = (y - top) / (h * 0.05),
      x = x0 + (x1 - x0) * (0.1 + rng() * 0.8),
      len = w * (0.006 + rng() * 0.016) * (0.8 + near);
    ctx.strokeStyle = k % 3 ? css(light(pal['sky-b'], 0.6), 0.45 + lit.strength * 0.4) : css(shade(sky, 0.15), 0.35);
    ctx.lineWidth = Math.max(1, h * (0.0018 + near * 0.001));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  // Lily pads near the left end, one in flower.
  for (let k = 0; k < 4; k++) {
    const px = x0 + (x1 - x0) * (0.1 + k * 0.05 + rng() * 0.02),
      py = top + h * (0.03 + rng() * 0.02),
      r = h * (0.006 + rng() * 0.003);
    ctx.fillStyle = css(shade(pal.leaf, 0.1));
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.6, r * 0.7, 0, 0.35, Math.PI * 2 - 0.05);
    ctx.lineTo(px, py);
    ctx.fill();
    if (k === 1) dot(ctx, px + r * 0.3, py - r * 0.5, r * 0.55, [244, 182, 200, 1]);
  }
  ctx.restore();
  // A thin light edge where the water meets the far shore.
  ctx.strokeStyle = css(light(pal['far-hi'], 0.35), 0.6);
  ctx.lineWidth = Math.max(1, h * 0.0018);
  ctx.beginPath();
  for (const [i, [x, y]] of shore.entries()) i ? ctx.lineTo(x, y - 1) : ctx.moveTo(x, y - 1);
  ctx.stroke();
  // Reeds at both ends of the lake, with a cattail or two.
  const reed = shade(pal.blade, 0.2),
    reedLight = mix(pal.blade, pal['leaf-hi'], 0.4);
  for (const f of [0.05, 0.93]) {
    const [rx, ry] = shore[Math.round(f * (shore.length - 1))];
    for (let k = 0; k < 7; k++) {
      const bx = rx + gauss(rng) * h * 0.012,
        len = h * (0.022 + rng() * 0.02),
        lean = gauss(rng) * h * 0.008;
      strand(
        ctx,
        bx,
        ry + h * 0.004,
        bx + lean,
        ry - len,
        Math.max(1.2, h * 0.0035),
        lean * 0.3,
        k % 3 ? reed : reedLight,
      );
    }
    for (let k = 0; k < 2; k++) {
      const cx = rx + (k ? 1 : -1) * h * 0.006,
        tip = ry - h * (0.04 + k * 0.008);
      strand(ctx, cx, ry, cx + h * 0.002, tip, Math.max(1, h * 0.0018), 0, reed);
      ctx.fillStyle = css(pal['trunk-lo']);
      ctx.beginPath();
      ctx.ellipse(cx + h * 0.002, tip + h * 0.006, h * 0.0028, h * 0.007, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
