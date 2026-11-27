// The night sky's light (src/yard/light-art.js): fireworks and shooting stars glow through one small
// canvas per colour, made once and let go when the sky is dark again.
import assert from 'node:assert/strict';
import test from 'node:test';

const made = [];
globalThis.document ??= {};
globalThis.document.createElement = () => {
  const gradient = { addColorStop() {} };
  const sprite = { width: 0, height: 0, getContext: () => ({ createRadialGradient: () => gradient, fillRect() {} }) };
  made.push(sprite);
  return sprite;
};
const { drawSparks, letGlowsGo } = await import('../src/yard/light-art.js');
const { fireworks } = await import('../src/yard/fireworks.js');

// A context that only counts what is drawn on it.
function recorder() {
  const drawn = { images: [], strokes: 0 };
  return {
    drawn,
    drawImage(image, x, y, w, h) {
      drawn.images.push({ image, x, y, w, h, alpha: this.globalAlpha });
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      drawn.strokes++;
    },
  };
}
const seeded =
  (seed = 1) =>
  () =>
    ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test('a show glows through one canvas per colour, and lets them go when it is over', () => {
  made.length = 0;
  const { sparks, bursts } = fireworks(1000, 600, 0, [{ x: 300, y: 420, color: '#ff9db0' }], seeded(3));
  const colours = new Set(sparks.map(s => s.color));
  let drawnGlows = 0;
  for (let now = 0; now < 15000; now += 66) {
    const c = recorder();
    drawSparks(c, sparks, now, false, 1);
    drawnGlows += c.drawn.images.length;
    for (const image of c.drawn.images) assert.ok(image.alpha > 0 && image.alpha <= 1);
  }
  assert.ok(drawnGlows > bursts.length * 10, 'heads, flashes and the glow they leave');
  assert.ok(made.length <= colours.size, `${made.length} canvases for ${colours.size} colours`);
  letGlowsGo();
  assert.ok(
    made.every(s => s.width === 0 && s.height === 0),
    'emptied',
  );
  const c = recorder();
  drawSparks(c, sparks, bursts[0].at + 10, false, 1);
  assert.ok(made.length > colours.size - 1, 'made again for the next show');
});

test("a burst's glow blooms quickly and fades slowly, and lies wider than its stars", () => {
  const { sparks, bursts } = fireworks(1000, 600, 0, [], seeded(5));
  const b = bursts[0],
    own = sparks.find(s => s.glow && s.cx === b.x);
  const at = now => {
    const c = recorder();
    drawSparks(c, [own], now, false, 1);
    return c.drawn.images[0];
  };
  const early = at(own.since + own.life * 0.05),
    peak = at(own.since + own.life * 0.12),
    late = at(own.since + own.life * 0.8);
  assert.ok(early.alpha < peak.alpha && late.alpha < peak.alpha * 0.25);
  assert.ok(peak.w >= b.r * 2);
});
