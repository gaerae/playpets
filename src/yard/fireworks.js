// Fireworks for the sky layer (scenery.js flare). Each friend sends up a shell in its own colour
// from where it stands, then the finale fills the sky, and one heart closes the show. A shell
// climbs, bursts with a flash, and its stars fly out fast, slow in the air, droop and burn out one
// by one. sparkAt says where a spark is; scenery draws it, and its tail.

const PALETTE = ['#ffd27a', '#ff9db0', '#9fd8ff', '#c5f2a2', '#e0b8ff', '#ffb38a'];
const GOLD = '#ffcf6b';
// How long a shell climbs, in ms.
const RISE = 900;
// How fast a star slows in the air: the larger, the sooner it hangs.
const DRAG = 4;

/** A friend's colour (an average of its picture) as a firework's: its hue, bright and clear. */
export function brightColor(r, g, b) {
  const [R, G, B] = [r, g, b].map(v => v / 255),
    max = Math.max(R, G, B),
    min = Math.min(R, G, B),
    d = max - min;
  let hue = 0;
  if (d) hue = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  const sat = d < 0.04 ? 0.15 : 0.85,
    light = 0.72,
    c = (1 - Math.abs(2 * light - 1)) * sat,
    x = c * (1 - Math.abs((hue % 2) - 1)),
    m = light - c / 2,
    [r1, g1, b1] = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][Math.floor((hue + 6) % 6)];
  return `#${[r1, g1, b1]
    .map(v =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const out = (age, drag) => (1 - Math.exp(-drag * age)) / (1 - Math.exp(-drag));
// Where a spark is at a share of its life, 0 to 1.
function pointAt(s, age) {
  const k = out(age, s.drag ?? DRAG);
  return { x: s.cx + (s.tx - s.cx) * k, y: s.cy + (s.ty - s.cy) * k + s.fall * age * age };
}

/** Where a spark is at `now` and how bright, or null before it starts and after it is gone. */
export function sparkAt(s, now) {
  const age = (now - s.since) / s.life;
  if (age < 0 || age >= 1) return null;
  return { ...pointAt(s, age), alpha: age < 0.55 ? 1 : ((1 - age) / 0.45) ** 1.5 };
}

// The stars of each kind of shell, bursting at the burst's (x, y) at `at` with its radius `r`.
const KINDS = {
  peony: (b, h, rng) => ring(b, 56, b.r, h * 0.07, 1400, 700, rng),
  chrysanthemum: (b, h, rng) => ring(b, 64, b.r * 1.1, h * 0.06, 1900, 600, rng, { trail: 260 }),
  glitter: (b, h, rng) => ring(b, 60, b.r, h * 0.08, 1600, 600, rng, { glitter: true, color: '#fff3d6' }),
  willow: (b, h, rng) => ring(b, 70, b.r * 1.2, h * 0.2, 3000, 800, rng, { trail: 420, drag: 6, color: GOLD }),
  ring(b, h, rng) {
    const { r } = b;
    const tilt = rng() * Math.PI,
      squash = 0.35 + rng() * 0.3;
    return Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2,
        u = Math.cos(a) * r,
        v = Math.sin(a) * r * squash;
      return star(
        b,
        u * Math.cos(tilt) - v * Math.sin(tilt),
        u * Math.sin(tilt) + v * Math.cos(tilt),
        h * 0.05,
        1700,
        b.color,
      );
    });
  },
  crossette(b, h, rng) {
    const { r } = b;
    const stars = Array.from({ length: 10 }, (_, i) => {
      const a = ((i + rng() * 0.4) / 10) * Math.PI * 2;
      return star(b, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, h * 0.03, 700, b.color);
    });
    const pieces = stars.flatMap(s => {
      const end = pointAt(s, 1),
        turn = rng() * Math.PI;
      return [0, 1, 2, 3].map(i => {
        const a = turn + (i * Math.PI) / 2;
        return {
          cx: end.x,
          cy: end.y,
          tx: end.x + Math.cos(a) * r * 0.35,
          ty: end.y + Math.sin(a) * r * 0.35,
          fall: h * 0.05,
          since: s.since + s.life,
          life: 900 + rng() * 300,
          color: b.color,
        };
      });
    });
    return [...stars, ...pieces];
  },
  heart(b, h, rng) {
    const { r } = b;
    return Array.from({ length: 76 }, (_, i) => {
      const t = (i / 76) * Math.PI * 2,
        u = 16 * Math.sin(t) ** 3,
        v = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      // it hangs longer than any other shell, the last thing in the sky
      return star(b, (u / 17) * r, (v / 17) * r, h * 0.015, 3900 + rng() * 300, b.color, { trail: 200 });
    });
  },
};
function star(b, dx, dy, fall, life, color, more = {}) {
  return { cx: b.x, cy: b.y, tx: b.x + dx, ty: b.y + dy, fall, since: b.at, life, color, ...more };
}
function ring(b, count, r, fall, life, spread, rng, { color = b.color, ...more } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((i + rng() * 0.6) / count) * Math.PI * 2,
      k = r * (0.8 + rng() * 0.35);
    return star(b, Math.cos(a) * k, Math.sin(a) * k, fall, life + rng() * spread, color, more);
  });
}

/** A show of about fourteen seconds from `now`. `launchers` are the friends, `{x, y, color}` on the
 * canvas, in the order they stand; with none, the shells rise from behind the hills. Returns the
 * sparks and the bursts (`{at, x, y, by, color, kind, finale}`; `by` is the launcher, -1 for all). */
export function fireworks(w, h, now, launchers = [], rng = Math.random) {
  const from = launchers.length
    ? launchers.map((l, i) => ({ ...l, color: l.color || PALETTE[i % PALETTE.length] }))
    : [0.2, 0.4, 0.6, 0.8].map((x, i) => ({ x: w * x, y: h * 0.46, color: PALETTE[i] }));
  const bursts = [],
    clamp = x => Math.max(w * 0.1, Math.min(w * 0.9, x)),
    // the heart rises from among them all
    middle = { x: from.reduce((sum, l) => sum + l.x, 0) / from.length, y: h * 0.46, color: '#ff9db0' };
  const send = (by, launch, kind, finale = false) => {
    const f = by < 0 ? middle : from[by],
      r = Math.min(w, h) * (kind === 'heart' ? 0.12 : kind === 'willow' ? 0.11 : 0.07 + rng() * 0.04);
    bursts.push({
      at: launch + RISE,
      launch,
      from: f,
      x: by < 0 ? w / 2 : clamp(f.x + (rng() - 0.5) * w * 0.14),
      // never so high that the stars leave the top of the sky; the heart, the largest, just under it,
      // so its point clears the hills
      y: kind === 'heart' ? r * 0.75 + h * 0.015 : Math.max(r * 1.4, h * (0.07 + rng() * 0.12)),
      r,
      by,
      color: f.color,
      kind,
      finale,
    });
  };
  // Each friend's own shell, one after another (at least four, round again if there are fewer).
  const opening = ['peony', 'chrysanthemum', 'ring', 'crossette'];
  let t = now + 300;
  for (let i = 0; i < Math.max(4, from.length); i++, t += 700) send(i % from.length, t, opening[i % opening.length]);
  // The finale: everyone again and more, close together, with golden willows hanging over it.
  t += 600;
  const count = Math.max(10, from.length * 2);
  for (let i = 0; i < count; i++) {
    const kind = i % 4 === 3 ? 'willow' : ['peony', 'chrysanthemum', 'glitter', 'crossette'][Math.floor(rng() * 4)];
    send(i % from.length, t + rng() * 2000, kind, true);
  }
  // Last, from all of them: a heart.
  send(-1, t + 3400, 'heart');
  bursts.sort((a, b) => a.at - b.at);

  const sparks = bursts.flatMap(b => [
    {
      cx: b.from.x,
      cy: b.from.y,
      tx: b.x,
      ty: b.y,
      fall: 0,
      since: b.launch,
      life: RISE,
      color: '#ffe9c4',
      rise: true,
    },
    { cx: b.x, cy: b.y, tx: b.x, ty: b.y, fall: 0, since: b.at, life: 320, color: b.color, flash: true },
    ...KINDS[b.kind](b, h, rng),
  ]);
  return { sparks, bursts };
}
