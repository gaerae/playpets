// The lake in the valley between the hills, mirroring the sky.
import { css, dot, fillShape, gauss, light, mix, shade, vertical } from './brush.js';
import { lakeShape } from './layout.js';
import { strand } from './trees.js';

/**
 * The lake in the valley, its near half hidden by the hill in front (`back`, the traced ridge;
 * the shape is layout.js lakeShape): it mirrors the sky, pale under the far shore and deeper
 * towards us, with the far bank's reflection along that shore, a soft glow of light in the middle,
 * a few glints, lily pads by the near bank, a thin light edge and reeds where it meets the hill.
 */
export function lake(ctx, w, h, pal, rng, lit, back) {
  const shape = lakeShape(w, h, back),
    { top, shoreAt, ridgeAt } = shape,
    [a, b] = shape.ends,
    shore = [];
  for (let k = 0; k <= 48; k++) {
    const x = a + ((b - a) * k) / 48;
    shore.push([x, Math.min(shoreAt(x), ridgeAt(x))]);
  }
  const low = Math.max(...shore.map(([x]) => ridgeAt(x))) + h * 0.02,
    // Below the ridge the hill is painted over it (the next layer), so the water reaches down past it.
    water = [...shore, [b, low], [a, low]],
    sky = mix(pal['sky-m'], pal['sky-a'], 0.65),
    // A place on the water, f across the part that shows and d down from the far shore to the near bank.
    at = (f, d) => {
      const x = a + (b - a) * f;
      return [x, shoreAt(x) + (ridgeAt(x) - shoreAt(x)) * d];
    };
  // The sky in the water: pale as the horizon under the far shore, deepening towards us.
  fillShape(
    ctx,
    water,
    vertical(ctx, top, low, [
      [0, mix(pal['sky-b'], pal['sky-m'], 0.35)],
      [1, sky],
    ]),
  );
  ctx.save();
  ctx.beginPath();
  for (const [i, [x, y]] of water.entries()) i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  ctx.closePath();
  ctx.clip();
  // The far bank and its bushes upside down under the far shore: a band with a soft, bumpy edge.
  const band = h * 0.007;
  ctx.fillStyle = css(mix(shade(pal.far, 0.18), pal['sky-m'], 0.3), 0.7);
  ctx.beginPath();
  ctx.moveTo(shore[0][0], shore[0][1] - 2);
  for (const [x, y] of shore) ctx.lineTo(x, y - 2);
  for (const [x, y] of [...shore].reverse()) ctx.lineTo(x, y + band);
  ctx.closePath();
  for (let k = 0; k < 9; k++) {
    const [x, y] = shore[Math.floor(4 + rng() * (shore.length - 8))],
      r = h * (0.005 + rng() * 0.006);
    ctx.moveTo(x + r * 1.5, y + band);
    ctx.ellipse(x, y + band, r * 1.5, r, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  // The sky's light lying on the water: a soft, long glow a little right of the middle.
  const [gx, gy] = at(0.58, 0.42),
    glowW = (b - a) * 0.24,
    glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowW);
  glow.addColorStop(0, css(light(pal['sky-b'], 0.5), 0.2 + lit.strength * 0.4));
  glow.addColorStop(1, css(light(pal['sky-b'], 0.5), 0));
  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(1, 0.18);
  ctx.translate(-gx, -gy);
  ctx.fillStyle = glow;
  ctx.fillRect(gx - glowW, gy - glowW, glowW * 2, glowW * 2);
  ctx.restore();
  // Glints: a few short strokes that taper at both ends, longer and brighter nearer us.
  ctx.lineCap = 'round';
  for (let k = 0; k < 11; k++) {
    const d = 0.25 + rng() * 0.65,
      [x, y] = at(0.12 + rng() * 0.76, d),
      len = w * (0.005 + rng() * 0.012) * (0.7 + d),
      bright = k % 4 !== 0;
    ctx.strokeStyle = bright ? css(light(pal['sky-b'], 0.6), 0.35 + lit.strength * 0.35) : css(shade(sky, 0.15), 0.3);
    for (const [part, width] of [
      [1, 0.0012],
      [0.55, 0.0022],
    ]) {
      ctx.lineWidth = Math.max(1, h * width * (0.8 + d));
      ctx.beginPath();
      ctx.moveTo(x - (len * part) / 2, y);
      ctx.lineTo(x + (len * part) / 2, y);
      ctx.stroke();
    }
  }
  // Lily pads by the near bank, where the water is widest, one in flower.
  for (let k = 0; k < 4; k++) {
    const [px, py] = at(0.62 + k * 0.07 + rng() * 0.03, 0.62 + rng() * 0.18),
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
  // Reeds where the water meets the hill at each end, with a cattail or two.
  const reed = shade(pal.blade, 0.2),
    reedLight = mix(pal.blade, pal['leaf-hi'], 0.4);
  for (const [rx, side] of [
    [a + (b - a) * 0.03, 1],
    [b - (b - a) * 0.03, -1],
  ]) {
    const ry = ridgeAt(rx);
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
      const cx = rx + side * (k ? 1 : -1) * h * 0.006,
        tip = ry - h * (0.04 + k * 0.008);
      strand(ctx, cx, ry, cx + h * 0.002, tip, Math.max(1, h * 0.0018), 0, reed);
      ctx.fillStyle = css(pal['trunk-lo']);
      ctx.beginPath();
      ctx.ellipse(cx + h * 0.002, tip + h * 0.006, h * 0.0028, h * 0.007, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
