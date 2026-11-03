// Small things the yard answers to, drawn on the sky layer and on a friend; they change nothing kept.

import { typing } from '../core/keys.js';
import { pick } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, views } from '../core/state.js';
import { brightColor, fireworks } from './fireworks.js';
import { boom } from './sound.js';
import { effect, pose } from './views.js';
import { scenery } from './world.js';

/** How far a drag has to turn, in radians. */
export const SPUN = 5.5 * Math.PI;
const KEYS = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

/** `tap(now)` is true for the `count`-th tap within `within` ms, then counting starts again. */
export function createTaps(count, within) {
  let times = [];
  return {
    tap(now) {
      times = [...times.filter(t => now - t < within), now];
      if (times.length < count) return false;
      times = [];
      return true;
    },
  };
}

/** `press(code)` is true when the last keys pressed are `codes`. */
export function createSequence(codes) {
  let last = [];
  return {
    press(code) {
      last = [...last, code].slice(-codes.length);
      if (last.length < codes.length || last.some((c, i) => c !== codes[i])) return false;
      last = [];
      return true;
    },
  };
}

/** How far a path turns, signed: steps under `step` px are jitter, and a sharp reversal is a shake. */
export function createTurns(step = 4) {
  let at = null,
    heading = null,
    total = 0;
  return {
    add(x, y) {
      if (at && Math.hypot(x - at.x, y - at.y) < step) return;
      if (at) {
        const next = Math.atan2(y - at.y, x - at.x);
        if (heading !== null) {
          const delta = Math.atan2(Math.sin(next - heading), Math.cos(next - heading));
          if (Math.abs(delta) < 0.75 * Math.PI) total += delta;
        }
        heading = next;
      }
      at = { x, y };
    },
    total: () => total,
  };
}

/** Each friend waits until `until` (the frame clock) before strolling off again, so it stays where it
 * stands to watch. */
export function stayToWatch(friends, until) {
  for (const v of friends) v.nextWander = Math.max(v.nextWander ?? 0, until);
}

// A friend's colour: its picture's average, leaning to its brightest parts.
function colorOf(canvas) {
  try {
    const small = document.createElement('canvas');
    small.width = small.height = 12;
    const g = small.getContext('2d');
    g.drawImage(canvas, 0, 0, 12, 12);
    const d = g.getImageData(0, 0, 12, 12).data;
    let r = 0,
      gr = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const k = 0.05 + (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) ** 2;
      r += d[i] * k;
      gr += d[i + 1] * k;
      b += d[i + 2] * k;
      n += k;
    }
    return n ? brightColor(r / n, gr / n, b / n) : null;
  } catch {
    return null;
  }
}

// The friends send up their fireworks: each its own shell, then all of them, and a heart at the end.
function celebrate(yard) {
  const box = yard.getBoundingClientRect(),
    friends = [...views.values()]
      .map(v => ({ v, r: v.button?.getBoundingClientRect?.() }))
      .filter(({ v, r }) => !v.away && r?.width)
      .map(({ v, r }) => ({ v, x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height * 0.3 }))
      .sort((a, b) => a.x - b.x);
  const launchers = friends.map(({ v, x, y }) => ({ x, y, color: colorOf(v.canvas) }));
  scenery.flare((w, h, now) => {
    const show = fireworks(w, h, now, launchers);
    stayToWatch(
      friends.map(({ v }) => v),
      Math.max(...show.sparks.map(s => s.since + s.life)),
    );
    for (const b of show.bursts) {
      const wait = b.at - now,
        big = b.kind === 'heart' || b.kind === 'willow';
      // The sound comes a little after the light, as it does from far off.
      boom(wait + 250, (b.x / w) * 2 - 1, big ? 1 : 0.7);
      const who = b.by < 0 ? friends : friends.slice(b.by, b.by + 1);
      setTimeout(() => {
        if (yard.classList.contains('playing')) return;
        for (const { v } of who) {
          if (views.get(v.pet.id) !== v) continue;
          pose(v, 'jump', 900);
          if (b.by < 0) effect(v, '♥');
        }
      }, wait);
    }
    return show.sparks;
  });
}

// A friend sees the wish go by and makes one, as it falls.
function wished(yard) {
  const v = pick([...views.values()].filter(v => !v.away));
  if (!v) return;
  setTimeout(() => {
    if (yard.classList.contains('playing') || views.get(v.pet.id) !== v) return;
    pose(v, 'jump', 1100);
    effect(v, '✦');
  }, 900);
}

/** Called once, by app.js. Listens alongside the yard's own handlers and never stops an event. */
export function setupTouches() {
  const yard = $('yard'),
    free = () => !reduced.matches && !yard.classList.contains('playing') && !yard.classList.contains('aiming');
  const taps = createTaps(7, 4000),
    keys = createSequence(KEYS);
  let spin = null;
  yard.addEventListener(
    'pointerdown',
    e => {
      spin = null;
      if (!free()) return;
      const friend = e.target.closest?.('.yard-pet');
      if (friend) {
        spin = { id: e.pointerId, friend, turns: createTurns() };
        spin.turns.add(e.clientX, e.clientY);
        return;
      }
      const body = yard.querySelector('.sky-body')?.getBoundingClientRect();
      if (!body || !yard.classList.contains('period-night')) return;
      const near = Math.hypot(e.clientX - body.left - body.width / 2, e.clientY - body.top - body.height / 2);
      if (near > body.width * 0.75 || !taps.tap(e.timeStamp)) return;
      const box = yard.getBoundingClientRect();
      if (scenery.shoot({ x: body.left - box.left + body.width / 2, y: body.top - box.top + body.height / 2 }))
        wished(yard);
    },
    { capture: true, passive: true },
  );
  yard.addEventListener(
    'pointermove',
    e => {
      if (spin?.id === e.pointerId) spin.turns.add(e.clientX, e.clientY);
    },
    { capture: true, passive: true },
  );
  const done = e => {
    if (spin?.id !== e.pointerId) return;
    const { friend, turns } = spin;
    spin = null;
    // a friend still dizzy finishes the turn it is in
    if (e.type !== 'pointerup' || Math.abs(turns.total()) < SPUN || !free() || friend.classList.contains('dizzy'))
      return;
    friend.classList.add('dizzy');
    setTimeout(() => friend.classList.remove('dizzy'), 2200);
  };
  yard.addEventListener('pointerup', done, { capture: true, passive: true });
  yard.addEventListener('pointercancel', done, { capture: true, passive: true });
  document.addEventListener('keydown', e => {
    if (e.repeat || typing(e) || !keys.press(e.code) || !free()) return;
    celebrate(yard);
  });
}
