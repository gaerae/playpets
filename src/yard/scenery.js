// Draws the living part of the yard on one canvas: rain, snow, petals and leaves, stars and small
// creatures, now and then a flock of birds. The rules (where drops spawn, how they fall) live in
// scene.js; this file only paints.
// Every repaint of the canvas costs a screen update, so it is repainted only when something on it
// moved. Stars are drawn once (their twinkle is the CSS layer's, scenery.css). Butterflies, fireflies
// and falling petals or leaves come in spells: they are about for a while, leave, and the canvas
// rests until the next spell.
import { between } from '../core/math.js';
import { createAmbientArt } from './ambient-art.js';
import { flyingBug } from './catalog.js';
import { environmentFrame } from './environment.js';
import { boostOf } from './events.js';
import { dropCount, fallerCount, spawnDrop, spawnFaller, stepDrops, stepFallers } from './scene.js';
import { createWeatherArt } from './weather-art.js';
import { weatherPanes } from './window-weather.js';
import { worldAllows, worldFor } from './worlds.js';

const TAU = Math.PI * 2;
const INK = {
  rain: { day: '168,192,214', night: '190,208,230' },
  snow: '255,255,255',
  star: '255,250,230',
  firefly: '236,240,150',
};
const PETALS = ['#f7c1d2', '#fbd7e3', '#f3a9c1'];
const LEAVES = ['#e6a03c', '#d65a3a', '#f0c25a', '#c4702f'];
// A flock crosses the sky now and then on a clear day: this long between flocks.
const FLOCK_GAP = [45000, 120000];
// A spell of small life lasts SPELL ms; the rest between spells is drawn from REST.
const SPELL = 24000,
  REST = [30000, 60000];
// Fireflies fade in and out over this long.
const FADE_MS = 1500;
export function createScenery(canvas, reduced, artOptions, ambientOptions) {
  const ctx = canvas.getContext('2d');
  // In a small yard everything drawn shrinks with it.
  let scale = 1,
    still = reduced.matches;
  let w = 1,
    h = 1,
    period = 'day',
    weather = 'clear',
    season = 'spring',
    // The seasonal event on (events.js), which can bring more small life and kinds of its own.
    event = null,
    world = 'woodland',
    panes = null,
    drops = [],
    fallers = [],
    flock = null,
    nextFlock = 0,
    splashes = [],
    stars = [],
    critters = [],
    refillAt = 0,
    streak = null,
    nextStreak = 0,
    // Whether a spell of small life is on, and when it ends (or the next begins).
    spell = true,
    spellTurn = 0,
    // Something changed that the canvas does not show yet.
    dirty = true;
  const art = createWeatherArt(() => {
    if (!reduced.matches && worldAllows(world, 'seasonalEffects') && fallers.length) dirty = true;
  }, artOptions);
  const ambient = createAmbientArt(() => {
    if (worldAllows(world, 'wildlife') || worldAllows(world, 'sky')) dirty = true;
  }, ambientOptions);
  const precipitation = () => worldAllows(world, 'weather') && weather !== 'clear' && (!panes || panes.length > 0);
  const enabled = () =>
    precipitation() || ['sky', 'wildlife', 'seasonalEffects'].some(capability => worldAllows(world, capability));
  const clear = () => weather === 'clear';
  // Fireflies on spring and summer nights, butterflies by day until autumn, when one is left, and
  // dragonflies with them in summer and autumn. Which kinds fly is the catalogue's (catalog.js).
  function lifeCount() {
    if (!worldAllows(world, 'wildlife')) return { glow: false, count: 0 };
    const warm = season === 'spring' || season === 'summer',
      glow = warm && clear() && (period === 'night' || period === 'evening'),
      flutter = season !== 'winter' && clear() && (period === 'day' || period === 'morning');
    const count = glow ? (period === 'night' ? 9 : 4) : flutter ? (warm ? 3 : 1) : 0;
    return { glow, count: Math.round(count * boostOf(event, glow ? 'fireflies' : 'butterflies')) };
  }
  // The small life of a spell. Arriving, butterflies come in from the sides, fireflies fade in and
  // petals or leaves start above the yard; at the start they are already about.
  function spawnLife(arriving) {
    refillAt = 0;
    arriving = arriving && !reduced.matches;
    const { glow, count } = lifeCount();
    critters = Array.from({ length: count }, () => {
      const side = Math.random() < 0.5,
        kind = glow
          ? 'firefly'
          : Math.random() < 0.35 && flyingBug('dragonfly', season, period, Math.random, event)
            ? 'dragonfly'
            : 'butterfly',
        bug = flyingBug(kind, season, period, Math.random, event);
      return {
        kind,
        species: bug?.id || null,
        look: bug?.look || { wing: '#f6f4ea', edge: '#4a4a44' },
        x: arriving && !glow ? (side ? -15 : w + 15) : Math.random() * w,
        y: h * (0.5 + Math.random() * 0.4),
        heading: arriving && !glow ? (side ? 0 : Math.PI) + (Math.random() - 0.5) : Math.random() * TAU,
        phase: Math.random() * TAU,
        light: arriving && glow ? 0 : 1,
      };
    });
    fallers =
      reduced.matches || !worldAllows(world, 'seasonalEffects')
        ? []
        : Array.from({ length: Math.round(fallerCount(season, period, weather, w) * boostOf(event, 'petals')) }, () => {
            const f = spawnFaller(w, h, Math.random);
            if (arriving) f.y = -10 - Math.random() * h * 0.3;
            return f;
          });
    art.use(season, precipitation() ? weather : 'clear', !reduced.matches && worldAllows(world, 'seasonalEffects'));
    ambient.use(worldAllows(world, 'wildlife'), worldAllows(world, 'sky'), critters);
  }
  function populate() {
    panes = weatherPanes(w, h, environmentFrame(w, h, { world }), worldFor(world).windowPanes);
    art.use(season, precipitation() ? weather : 'clear', !reduced.matches && worldAllows(world, 'seasonalEffects'));
    fallers = [];
    refillAt = 0;
    drops = Array.from({ length: precipitation() ? dropCount(weather, w, h) : 0 }, () =>
      spawnDrop(weather, w, h, Math.random),
    );
    flock = null;
    splashes = [];
    streak = null;
    stars =
      worldAllows(world, 'sky') && period === 'night' && clear()
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
  function set(nextPeriod, nextWeather, nextSeason = season, nextEvent = event, nextWorld = 'woodland') {
    if (
      nextPeriod === period &&
      nextWeather === weather &&
      nextSeason === season &&
      nextEvent === event &&
      nextWorld === world
    )
      return;
    world = nextWorld;
    period = nextPeriod;
    weather = nextWeather;
    season = nextSeason;
    event = nextEvent;
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
    c.phase += dt * (c.kind === 'firefly' ? 0.003 : c.kind === 'dragonfly' ? 0.05 : 0.02);
    c.heading += (Math.random() - 0.5) * dt * 0.004;
    if (c.kind === 'firefly') {
      c.light = Math.max(0, Math.min(1, c.light + (spell ? 1 : -1) * (dt / FADE_MS)));
      if (!spell && c.light === 0) return false;
    } else if (!spell) {
      // Leaving: it turns gently toward the nearer side.
      const away = c.x < w / 2 ? Math.PI : 0;
      c.heading += Math.sin(away - c.heading) * dt * 0.002;
    }
    const speed = c.kind === 'butterfly' ? 0.035 : c.kind === 'dragonfly' ? 0.06 : 0.014;
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
    if (!enabled()) return;
    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      if (ambient.star(ctx, s)) continue;
      ctx.fillStyle = `rgb(${INK.star})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    if (streak) {
      const t = (now - streak.since) / streak.life,
        x = streak.x + streak.dx * t,
        y = streak.y + streak.dy * t;
      ctx.globalAlpha = 0.9 * (1 - t);
      if (!ambient.streak(ctx, x, y, streak.dx, streak.dy)) {
        const tail = ctx.createLinearGradient(x, y, x - streak.dx * 0.22, y - streak.dy * 0.22);
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
    }
    // Indoors only the glass shows the weather: drops elsewhere are stepped but not drawn.
    const seen = panes
      ? d => panes.some(p => d.x > p.x - 24 && d.x < p.x + p.width + 24 && d.y > p.y - 32 && d.y < p.y + p.height + 32)
      : () => true;
    if (drops.length && panes) {
      ctx.save();
      ctx.beginPath();
      for (const pane of panes) ctx.rect(pane.x, pane.y, pane.width, pane.height);
      ctx.clip();
    }
    if (weather === 'rain') {
      // Bright city glass needs darker drops; outdoors keeps its softer sky rain.
      const ink = panes && period !== 'night' ? '70,97,123' : INK.rain[period === 'night' ? 'night' : 'day'];
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgb(${ink})`;
      for (const d of drops) {
        if (!seen(d)) continue;
        ctx.globalAlpha = panes ? 0.55 + d.depth * 0.35 : 0.22 + d.depth * 0.4;
        ctx.lineWidth = ((panes ? 0.9 : 0.6) + d.depth * 0.9) * scale;
        if (art.rain(ctx, d, scale, !!panes, period === 'night')) continue;
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
        if (art.ripple(ctx, s, scale, t, period === 'night')) continue;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r * 1.8, r * 0.6, 0, 0, TAU);
        ctx.stroke();
      }
    }
    if (weather === 'snow') {
      ctx.fillStyle = `rgb(${INK.snow})`;
      for (const d of drops) {
        if (!seen(d)) continue;
        ctx.globalAlpha = 0.55 + d.depth * 0.45;
        if (art.snow(ctx, d, scale)) continue;
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
    if (drops.length && panes) ctx.restore();
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
        if (ambient.bird(ctx, x, y, b.phase, flock.dir, scale, now)) continue;
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
      if (art.faller(ctx, f, season, scale, now)) continue;
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
        // Each kind glows in its own light (catalog.json look.glow), so a rare one can be found.
        if (ambient.glow(ctx, c, scale)) {
          ctx.globalAlpha = (0.55 + lit * 0.45) * c.light;
          if (ambient.bug(ctx, c, scale)) continue;
        }
        ctx.fillStyle = c.look.glow || `rgb(${INK.firefly})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6 * scale, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = (0.4 + lit * 0.6) * c.light;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 1.7 * scale, 0, TAU);
        ctx.fill();
      } else if (c.kind === 'dragonfly') {
        ctx.globalAlpha = 0.95;
        if (ambient.bug(ctx, c, scale)) continue;
        // Seen from above: two pairs of clear wings and a long body, pointing where it flies.
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.heading + Math.PI / 2);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = c.look.wing;
        const shimmer = 0.85 + 0.15 * Math.sin(c.phase);
        for (const [dx, dy] of [
          [-1, -1.5],
          [1, -1.5],
          [-1, 1],
          [1, 1],
        ]) {
          ctx.beginPath();
          ctx.ellipse(dx * 5 * scale, dy * scale, 5 * scale * shimmer, 1.5 * scale, 0, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = c.look.body;
        ctx.fillRect(-0.8 * scale, -3 * scale, 1.6 * scale, 10 * scale);
        ctx.beginPath();
        ctx.arc(0, -3.5 * scale, 1.6 * scale, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = 0.95;
        if (ambient.bug(ctx, c, scale)) continue;
        // A touch larger than life, so one is easy to click.
        const flap = 0.25 + 0.75 * Math.abs(Math.sin(c.phase)),
          k = scale * 1.4;
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = c.look.edge;
        ctx.lineWidth = 0.8 * k;
        ctx.fillStyle = c.look.wing;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(c.x + side * 3.2 * flap * k, c.y - k, 3.4 * flap * k, 4.4 * k, side * 0.5, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#5b4a3f';
        ctx.fillRect(c.x - 0.6 * k, c.y - 3.5 * k, 1.2 * k, 6 * k);
      }
    }
    ctx.globalAlpha = 1;
  }
  // One step: moves what is moving and repaints only if something did.
  function frame(now, dt) {
    if (!enabled()) return;
    if (still !== reduced.matches) {
      still = reduced.matches;
      if (still) {
        fallers = [];
        flock = null;
        streak = null;
        splashes = [];
        // Creatures arriving from outside or fading in remain available to catch.
        for (const c of critters) {
          c.x = Math.max(12, Math.min(w - 12, c.x));
          c.light = 1;
        }
        if (!critters.length && !refillAt && lifeCount().count > 0) refillAt = now + between(Math.random, REST);
        dirty = true;
      }
    }
    if (still) {
      // Reduced motion keeps collecting available, with one still refill after the usual rest.
      if (!critters.length && refillAt && now >= refillAt) {
        spawnLife(false);
        dirty = true;
      }
      if (dirty) paint(now);
      return;
    }
    let moved = dirty;
    if (drops.length) {
      for (const s of stepDrops(drops, weather, dt, w, h, Math.random))
        if (!panes && weather === 'rain' && splashes.length < 60) splashes.push({ ...s, since: now });
      splashes = splashes.filter(s => now - s.since < 280);
      moved = true;
    }
    // Spells of small life: on for SPELL, then the creatures leave and the petals that are falling
    // land, and the canvas rests for a while.
    if (!spellTurn) spellTurn = now + SPELL;
    if (now >= spellTurn) {
      spell = !spell;
      spellTurn = now + (spell ? SPELL : between(Math.random, REST));
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
    } else if (worldAllows(world, 'wildlife') && clear() && period !== 'night' && now >= nextFlock) {
      if (nextFlock) launchFlock(now);
      nextFlock = now + between(Math.random, FLOCK_GAP);
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
  const busy = () => enabled() && !reduced.matches && (drops.length > 0 || !!flock || !!streak);
  // The creature within `reach` of a point in the yard, nearest first, or null.
  function near(x, y, reach = 22) {
    if (!worldAllows(world, 'wildlife')) return null;
    let best = null,
      bestD = reach;
    for (const c of critters) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD && c.species && (c.kind !== 'firefly' || c.light > 0.3)) [best, bestD] = [c, d];
    }
    return best;
  }
  /** Catches the creature at a point: it leaves the canvas and its kind is returned, or null. */
  function catchAt(x, y) {
    const c = near(x, y);
    if (!c) return null;
    critters = critters.filter(other => other !== c);
    if (!critters.length) refillAt = performance.now() + between(Math.random, REST);
    dirty = true;
    return { kind: c.kind, species: c.species, x: c.x, y: c.y };
  }
  return { resize, set, frame, busy, near: (x, y) => !!near(x, y), catchAt };
}
