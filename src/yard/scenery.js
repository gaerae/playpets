// Draws the living part of the yard on one canvas: rain, snow, stars and small creatures.
// The rules (where drops spawn, how they fall) live in scene.js; this file only paints.
import { dropCount, spawnDrop, stepDrops } from './scene.js';

const TAU = Math.PI * 2;
const INK = {
  rain: { day: '168,192,214', night: '190,208,230' },
  snow: '255,255,255',
  star: '255,250,230',
  firefly: '236,240,150',
};
const WINGS = ['#f2a65a', '#e8798f', '#8fb4e8', '#f4d35e'];
export function createScenery(canvas, reduced) {
  const ctx = canvas.getContext('2d');
  // In a small yard everything drawn shrinks with it.
  let scale = 1;
  let w = 1,
    h = 1,
    period = 'day',
    weather = 'clear',
    drops = [],
    splashes = [],
    stars = [],
    critters = [],
    streak = null,
    nextStreak = 0;
  const clear = () => weather === 'clear';
  function populate() {
    drops = Array.from({ length: dropCount(weather, w, h) }, () => spawnDrop(weather, w, h, Math.random));
    splashes = [];
    streak = null;
    stars =
      period === 'night' && clear()
        ? Array.from({ length: Math.round(Math.min(90, w / 9)) }, () => ({
            x: Math.random() * w,
            y: Math.random() * h * 0.5,
            r: 0.5 + Math.random() * 1.1,
            phase: Math.random() * TAU,
            speed: 0.6 + Math.random() * 1.6,
          }))
        : [];
    const glow = clear() && (period === 'night' || period === 'evening'),
      flutter = clear() && (period === 'day' || period === 'morning');
    critters = reduced.matches
      ? []
      : Array.from({ length: glow ? (period === 'night' ? 9 : 4) : flutter ? 3 : 0 }, (_, i) => ({
          kind: glow ? 'firefly' : 'butterfly',
          x: Math.random() * w,
          y: h * (0.5 + Math.random() * 0.4),
          heading: Math.random() * TAU,
          phase: Math.random() * TAU,
          color: WINGS[i % WINGS.length],
        }));
  }
  function resize() {
    const r = canvas.getBoundingClientRect(),
      ratio = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width || !r.height) return;
    w = r.width;
    h = r.height;
    scale = Math.max(0.5, Math.min(1, h / 560));
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    populate();
    paint(0);
  }
  function set(nextPeriod, nextWeather) {
    if (nextPeriod === period && nextWeather === weather) return;
    period = nextPeriod;
    weather = nextWeather;
    populate();
    paint(0);
  }
  function roam(c, dt) {
    c.phase += dt * (c.kind === 'butterfly' ? 0.02 : 0.003);
    c.heading += (Math.random() - 0.5) * dt * 0.004;
    const speed = c.kind === 'butterfly' ? 0.035 : 0.014;
    c.x += Math.cos(c.heading) * speed * dt;
    c.y += Math.sin(c.heading) * speed * dt * 0.6 + Math.sin(c.phase * 0.4) * 0.02 * dt;
    if (c.x < -20) c.x = w + 20;
    else if (c.x > w + 20) c.x = -20;
    // Creatures keep to the air just above the field.
    if (c.y < h * 0.42) {
      c.y = h * 0.42;
      c.heading = Math.abs(c.heading % TAU);
    } else if (c.y > h * 0.94) {
      c.y = h * 0.94;
      c.heading = -Math.abs(c.heading % TAU);
    }
  }
  // A clear sky in daylight has nothing to draw: the canvas is cleared once and then left alone.
  let wasEmpty = false;
  function paint(now) {
    const empty = !stars.length && !streak && !drops.length && !splashes.length && !critters.length;
    if (empty && wasEmpty) return;
    wasEmpty = empty;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      ctx.globalAlpha = reduced.matches ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + now * 0.001 * s.speed));
      ctx.fillStyle = `rgb(${INK.star})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    if (streak) {
      const t = (now - streak.since) / streak.life,
        x = streak.x + streak.dx * t,
        y = streak.y + streak.dy * t,
        tail = ctx.createLinearGradient(x, y, x - streak.dx * 0.22, y - streak.dy * 0.22);
      tail.addColorStop(0, `rgba(${INK.star},${0.9 * (1 - t)})`);
      tail.addColorStop(1, `rgba(${INK.star},0)`);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tail;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - streak.dx * 0.22, y - streak.dy * 0.22);
      ctx.stroke();
    }
    if (weather === 'rain') {
      const ink = INK.rain[period === 'night' ? 'night' : 'day'];
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgb(${ink})`;
      for (const d of drops) {
        ctx.globalAlpha = 0.22 + d.depth * 0.4;
        ctx.lineWidth = (0.6 + d.depth * 0.9) * scale;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - (d.vx / d.vy) * d.size * scale, d.y - d.size * scale);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (const s of splashes) {
        const t = (now - s.since) / 280,
          r = (2 + s.depth * 5) * t;
        ctx.globalAlpha = (1 - t) * (0.3 + s.depth * 0.4);
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r * 1.8, r * 0.6, 0, 0, TAU);
        ctx.stroke();
      }
    }
    if (weather === 'snow') {
      ctx.fillStyle = `rgb(${INK.snow})`;
      for (const d of drops) {
        ctx.globalAlpha = 0.55 + d.depth * 0.45;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * scale, 0, TAU);
        ctx.fill();
        if (d.depth > 0.7) {
          ctx.globalAlpha = 0.16;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * 2.2 * scale, 0, TAU);
          ctx.fill();
        }
      }
    }
    for (const c of critters) {
      if (c.kind === 'firefly') {
        const lit = 0.5 + 0.5 * Math.sin(c.phase);
        ctx.globalAlpha = 0.15 + lit * 0.3;
        ctx.fillStyle = `rgb(${INK.firefly})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6 * scale, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.4 + lit * 0.6;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 1.7 * scale, 0, TAU);
        ctx.fill();
      } else {
        const flap = 0.25 + 0.75 * Math.abs(Math.sin(c.phase));
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = c.color;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(
            c.x + side * 3.2 * flap * scale,
            c.y - scale,
            3.4 * flap * scale,
            4.4 * scale,
            side * 0.5,
            0,
            TAU,
          );
          ctx.fill();
        }
        ctx.fillStyle = '#5b4a3f';
        ctx.fillRect(c.x - 0.6 * scale, c.y - 3.5 * scale, 1.2 * scale, 6 * scale);
      }
    }
    ctx.globalAlpha = 1;
  }
  function frame(now, dt) {
    if (reduced.matches) return;
    if (drops.length) {
      for (const s of stepDrops(drops, weather, dt, w, h, Math.random))
        if (weather === 'rain' && splashes.length < 60) splashes.push({ ...s, since: now });
      splashes = splashes.filter(s => now - s.since < 280);
    }
    for (const c of critters) roam(c, dt);
    if (stars.length) {
      if (streak && now - streak.since >= streak.life) streak = null;
      if (!streak && now >= nextStreak) {
        if (nextStreak)
          streak = {
            x: w * (0.2 + Math.random() * 0.6),
            y: h * (0.05 + Math.random() * 0.2),
            dx: w * 0.28 * (Math.random() < 0.5 ? -1 : 1),
            dy: h * 0.16,
            since: now,
            life: 900,
          };
        nextStreak = now + 18000 + Math.random() * 30000;
      }
    }
    paint(now);
  }
  return { resize, set, frame };
}
