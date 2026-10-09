// Draws the living part of the yard on one canvas: rain, snow, petals and leaves, stars and small
// creatures, now and then a flock of birds. The rules (where drops spawn, how they fall) live in
// scene.js; this file only paints.
// Every repaint of the canvas costs a screen update, so it is repainted only when something on it
// moved. Stars are drawn once (their twinkle is the CSS layer's, yard.css). Butterflies, fireflies
// and falling petals or leaves come in spells: they are about for a while, leave, and the canvas
// rests until the next spell.
import { dropCount, fallerCount, spawnDrop, spawnFaller, stepDrops, stepFallers } from './scene.js';

const TAU = Math.PI * 2;
const INK = {
  rain: { day: '168,192,214', night: '190,208,230' },
  snow: '255,255,255',
  star: '255,250,230',
  firefly: '236,240,150',
};
const WINGS = ['#f2a65a', '#e8798f', '#8fb4e8', '#f4d35e'];
const PETALS = ['#f7c1d2', '#fbd7e3', '#f3a9c1'];
const LEAVES = ['#e6a03c', '#d65a3a', '#f0c25a', '#c4702f'];
// A flock crosses the sky now and then on a clear day: this long between flocks.
const FLOCK_GAP = [45000, 120000];
// A spell of small life lasts SPELL ms; the rest between spells is drawn from REST.
const SPELL = 24000,
  REST = [30000, 60000];
// Fireflies fade in and out over this long.
const FADE_MS = 1500;
export function createScenery(canvas, reduced) {
  const ctx = canvas.getContext('2d');
  // In a small yard everything drawn shrinks with it.
  let scale = 1;
  let w = 1,
    h = 1,
    period = 'day',
    weather = 'clear',
    season = 'spring',
    drops = [],
    fallers = [],
    flock = null,
    nextFlock = 0,
    splashes = [],
    stars = [],
    critters = [],
    streak = null,
    nextStreak = 0,
    // Whether a spell of small life is on, and when it ends (or the next begins).
    spell = true,
    spellTurn = 0,
    // Something changed that the canvas does not show yet.
    dirty = true;
  const clear = () => weather === 'clear';
  // Fireflies on spring and summer nights, butterflies by day until autumn, when one is left.
  function lifeCount() {
    const warm = season === 'spring' || season === 'summer',
      glow = warm && clear() && (period === 'night' || period === 'evening'),
      flutter = season !== 'winter' && clear() && (period === 'day' || period === 'morning');
    return { glow, count: glow ? (period === 'night' ? 9 : 4) : flutter ? (warm ? 3 : 1) : 0 };
  }
  // The small life of a spell. Arriving, butterflies come in from the sides, fireflies fade in and
  // petals or leaves start above the yard; at the start they are already about.
  function spawnLife(arriving) {
    if (reduced.matches) {
      critters = [];
      fallers = [];
      return;
    }
    const { glow, count } = lifeCount();
    critters = Array.from({ length: count }, (_, i) => {
      const side = Math.random() < 0.5;
      return {
        kind: glow ? 'firefly' : 'butterfly',
        x: arriving && !glow ? (side ? -15 : w + 15) : Math.random() * w,
        y: h * (0.5 + Math.random() * 0.4),
        heading: arriving && !glow ? (side ? 0 : Math.PI) + (Math.random() - 0.5) : Math.random() * TAU,
        phase: Math.random() * TAU,
        color: WINGS[i % WINGS.length],
        light: arriving && glow ? 0 : 1,
      };
    });
    fallers = Array.from({ length: fallerCount(season, period, weather, w) }, () => {
      const f = spawnFaller(w, h, Math.random);
      if (arriving) f.y = -10 - Math.random() * h * 0.3;
      return f;
    });
  }
  function populate() {
    drops = Array.from({ length: dropCount(weather, w, h) }, () => spawnDrop(weather, w, h, Math.random));
    flock = null;
    splashes = [];
    streak = null;
    stars =
      period === 'night' && clear()
        ? Array.from({ length: Math.round(Math.min(90, w / 9)) }, () => ({
            x: Math.random() * w,
            y: Math.random() * h * 0.5,
            r: 0.5 + Math.random() * 1.1,
            alpha: 0.4 + Math.random() * 0.55,
          }))
        : [];
    spell = true;
    spellTurn = 0;
    spawnLife(false);
    dirty = true;
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
    paint(performance.now());
  }
  function set(nextPeriod, nextWeather, nextSeason = season) {
    if (nextPeriod === period && nextWeather === weather && nextSeason === season) return;
    period = nextPeriod;
    weather = nextWeather;
    season = nextSeason;
    populate();
    paint(performance.now());
  }
  // A small V of three to five birds, from one side to the other, high in the sky.
  function launchFlock(now) {
    const dir = Math.random() < 0.5 ? 1 : -1,
      size = 3 + Math.floor(Math.random() * 3);
    flock = {
      x: dir > 0 ? -60 : w + 60,
      y: h * (0.1 + Math.random() * 0.18),
      dir,
      speed: 0.045 + Math.random() * 0.02,
      since: now,
      birds: Array.from({ length: size }, (_, i) => ({
        dx: -dir * Math.ceil(i / 2) * 16,
        dy: Math.ceil(i / 2) * 7 * (i % 2 ? -0.4 : 1),
        phase: Math.random() * TAU,
      })),
    };
  }
  // Moves a creature; returns false once it has left (a butterfly off the side, a firefly faded).
  function roam(c, dt) {
    c.phase += dt * (c.kind === 'butterfly' ? 0.02 : 0.003);
    c.heading += (Math.random() - 0.5) * dt * 0.004;
    if (c.kind === 'firefly') {
      c.light = Math.max(0, Math.min(1, c.light + (spell ? 1 : -1) * (dt / FADE_MS)));
      if (!spell && c.light === 0) return false;
    } else if (!spell) {
      // Leaving: it turns gently toward the nearer side.
      const away = c.x < w / 2 ? Math.PI : 0;
      c.heading += Math.sin(away - c.heading) * dt * 0.002;
    }
    const speed = c.kind === 'butterfly' ? 0.035 : 0.014;
    c.x += Math.cos(c.heading) * speed * dt;
    c.y += Math.sin(c.heading) * speed * dt * 0.6 + Math.sin(c.phase * 0.4) * 0.02 * dt;
    if (c.x < -20 || c.x > w + 20) {
      if (!spell) return false;
      c.x = c.x < -20 ? w + 20 : -20;
    }
    // Creatures keep to the air just above the field.
    if (c.y < h * 0.42) {
      c.y = h * 0.42;
      c.heading = Math.abs(c.heading % TAU);
    } else if (c.y > h * 0.94) {
      c.y = h * 0.94;
      c.heading = -Math.abs(c.heading % TAU);
    }
    return true;
  }
  function paint(now) {
    dirty = false;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
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
    if (flock) {
      ctx.globalAlpha = period === 'evening' ? 0.6 : 0.5;
      ctx.strokeStyle = '#34464f';
      ctx.lineWidth = 1.4 * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const b of flock.birds) {
        const x = flock.x + b.dx * scale,
          y = flock.y + b.dy * scale,
          span = 5.5 * scale,
          lift = Math.sin(b.phase + now * 0.009) * 2.6 * scale;
        ctx.beginPath();
        ctx.moveTo(x - span, y - lift);
        ctx.quadraticCurveTo(x - span * 0.4, y - 1.5 * scale, x, y);
        ctx.quadraticCurveTo(x + span * 0.4, y - 1.5 * scale, x + span, y - lift);
        ctx.stroke();
      }
    }
    for (const f of fallers) {
      const palette = season === 'spring' ? PETALS : LEAVES;
      ctx.globalAlpha = 0.6 + f.depth * 0.35;
      ctx.fillStyle = palette[Math.floor(f.tint * palette.length) % palette.length];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.phase * 0.8 + f.spin * now);
      ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.cos(f.phase)));
      ctx.beginPath();
      if (season === 'spring') ctx.ellipse(0, 0, f.size * scale, f.size * 0.6 * scale, 0, 0, TAU);
      else {
        const r = f.size * 1.2 * scale;
        ctx.moveTo(-r, 0);
        ctx.quadraticCurveTo(0, -r * 0.8, r, 0);
        ctx.quadraticCurveTo(0, r * 0.8, -r, 0);
      }
      ctx.fill();
      ctx.restore();
    }
    for (const c of critters) {
      if (c.kind === 'firefly') {
        const lit = (0.5 + 0.5 * Math.sin(c.phase)) * c.light;
        ctx.globalAlpha = (0.15 + lit * 0.3) * c.light;
        ctx.fillStyle = `rgb(${INK.firefly})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6 * scale, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = (0.4 + lit * 0.6) * c.light;
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
  // One step: moves what is moving and repaints only if something did.
  function frame(now, dt) {
    if (reduced.matches) return;
    let moved = dirty;
    if (drops.length) {
      for (const s of stepDrops(drops, weather, dt, w, h, Math.random))
        if (weather === 'rain' && splashes.length < 60) splashes.push({ ...s, since: now });
      splashes = splashes.filter(s => now - s.since < 280);
      moved = true;
    }
    // Spells of small life: on for SPELL, then the creatures leave and the petals that are falling
    // land, and the canvas rests for a while.
    if (!spellTurn) spellTurn = now + SPELL;
    if (now >= spellTurn) {
      spell = !spell;
      spellTurn = now + (spell ? SPELL : REST[0] + Math.random() * (REST[1] - REST[0]));
      if (spell) spawnLife(true);
    }
    if (critters.length) {
      critters = critters.filter(c => roam(c, dt));
      moved = true;
    }
    if (fallers.length) {
      fallers = stepFallers(fallers, dt, w, h, Math.random, spell);
      moved = true;
    }
    if (flock) {
      flock.x += flock.dir * flock.speed * dt;
      if (flock.x < -120 || flock.x > w + 120) flock = null;
      moved = true;
    } else if (clear() && period !== 'night' && now >= nextFlock) {
      if (nextFlock) launchFlock(now);
      nextFlock = now + FLOCK_GAP[0] + Math.random() * (FLOCK_GAP[1] - FLOCK_GAP[0]);
    }
    if (stars.length) {
      if (streak && now - streak.since >= streak.life) {
        streak = null;
        moved = true;
      }
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
      if (streak) moved = true;
    }
    if (moved) paint(now);
  }
  // Whether the canvas will change on the next frame (app.js runs the yard faster while it does).
  const busy = () => drops.length > 0 || !!flock || !!streak;
  return { resize, set, frame, busy };
}
