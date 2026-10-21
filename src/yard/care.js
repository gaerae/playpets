// Looking after friends: treats they walk over to, and the pats, waves and jumps they answer.

import { t } from '../core/i18n.js';
import { between, clamp } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, call, data, guard, selected, setAiming, toast, views } from '../core/state.js';
import { befriend } from './bond.js';
import { fieldTop, footTarget, petHeight, sizeOf, yardZoom } from './field.js';
import { hint } from './hint.js';
import { greetingFor } from './scene.js';
import { cue } from './sound.js';
import { rest, sendTo } from './trips.js';
import { bubble, effect, pose } from './views.js';
import { SCATTER_DELAY } from './wander.js';
import { scene } from './world.js';

let treatTimer,
  treatEaters = 0;
// Called when a friend reaches the treat.
function ate(v, now) {
  befriend(v.pet.id, 'treat');
  cue('treat');
  pose(v, 'jump', 1100);
  effect(v, '✦');
  bubble(v, t('care.yum'));
  v.nextWander = now + between(Math.random, SCATTER_DELAY);
  if (++treatEaters >= views.size) {
    clearTimeout(treatTimer);
    treatTimer = setTimeout(() => ($('treat').hidden = true), 6000);
  }
}
// A pat, a wave or a jump asked for by the person or by a coding agent.
export function react(event) {
  // A wave to everyone at once (a coding agent can ask for one): each friend answers in its own
  // words, a beat apart.
  const together = event.action === 'wave' && !event.petId,
    said = new Set();
  let turn = 0;
  for (const [id, v] of views) {
    if (event.petId && event.petId !== id) continue;
    pose(v, event.action === 'wave' ? 'wave' : 'jump', 1400);
    effect(v, event.action === 'treat' ? '✦' : '♥');
    rest(v);
    if (together) {
      let line = greetingFor(scene.period, Math.random);
      for (let tries = 0; said.has(line) && tries < 6; tries++) line = greetingFor(scene.period, Math.random);
      said.add(line);
      setTimeout(
        () => {
          if (views.has(id)) bubble(v, line, 3200);
        },
        reduced.matches ? 0 : turn++ * 260,
      );
    }
  }
}
// The chatter button is for friends with an AI: two or more, and it says so when there are fewer.
export function syncChatter() {
  const able = data.pets.filter(p => p.providerId).length;
  // Not disabled: a disabled button cannot be focused or pressed, so the reason would only be a
  // tooltip. Pressed with fewer than two, it says what is missing.
  $('chatter').setAttribute('aria-disabled', String(able < 2));
  $('chatter').title = able < 2 ? t('care.chatter_need_two') : t('care.chatter_title');
}
/** The friends with an AI have a short talk about the moment (the button, and the timer). */
export const startChatter = () => call('chatter', scene.period, scene.weather);

// Placing something: the next click in the yard puts down a treat ('treat') or a seed ('seed'),
// false puts the choice away. Games and the small window turn it off.
// Whoever shows the tool in hand (the discovery strip) hears every change, set up once by app.js.
const aimingWatchers = [];
export function onAimingChange(fn) {
  aimingWatchers.push(fn);
}
export function setAimingMode(kind) {
  setAiming(kind || false);
  for (const [id, what] of [
    ['feed', 'treat'],
    ['plant-tool', 'seed'],
  ]) {
    $(id).classList.toggle('active', kind === what);
    $(id).setAttribute('aria-pressed', String(kind === what));
  }
  $('yard').classList.toggle('aiming', !!kind);
  hint();
  for (const fn of aimingWatchers) fn(kind || false);
}
// Wires the treat and chatter buttons, and the yard's click for placing a treat. Called once, by app.js.
export function setupCare() {
  $('chatter').onclick = guard(async () => {
    if (data.pets.filter(p => p.providerId).length < 2) return toast(t('care.chatter_need_two'));
    await startChatter();
  });
  // Treats are placed, not thrown: every pet walks over and eats when it arrives. With the mouse the
  // next click in the yard places it; from the keyboard a second press of the button puts it by the
  // selected friend (or in the middle of the field), and Esc puts it away.
  $('feed').onclick = e => {
    if (aiming === 'treat' && e.detail === 0) return dropNearby();
    setAimingMode(aiming === 'treat' ? false : 'treat');
  };
  $('yard').addEventListener('click', e => {
    if (aiming !== 'treat') return;
    const r = $('yard').getBoundingClientRect();
    dropTreat(e.clientX - r.left, e.clientY - r.top);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && aiming) setAimingMode(false);
  });
}
function dropNearby() {
  const r = $('yard').getBoundingClientRect(),
    v = views.get(selected);
  if (v) dropTreat(v.px + sizeOf(v.pet) + 30, v.py + petHeight(v.pet));
  else dropTreat(r.width / 2, r.height * 0.78);
}
/** Keep a shared meal on the ground, with friends behind or beside it rather than over its food. */
export function picnicLayout({ x, y, width, height, top, zoom, count }) {
  const w = Math.min(180 * zoom, width - 24);
  const h = Math.min(120 * zoom, Math.max(24, height - top - 24));
  const side = Math.min(width / 2, w * 0.75 + 60 * zoom);
  const cx = clamp(x, side, width - side);
  const cy = clamp(y, top + h / 2, height - 24 - h / 2);
  return {
    x: cx,
    y: cy,
    width: w,
    height: h,
    seats: Array.from({ length: count }, (_, i) => {
      const angle = count === 1 ? Math.PI : Math.PI + (i / (count - 1)) * Math.PI;
      return { x: cx + Math.cos(angle) * w * 0.75, y: cy + Math.sin(angle) * h * 0.45 };
    }),
  };
}
function dropTreat(x, y) {
  const r = $('yard').getBoundingClientRect();
  const picnic = picnicLayout({
    x,
    y,
    width: r.width,
    height: r.height,
    top: r.height * fieldTop(),
    zoom: yardZoom(),
    count: views.size,
  });
  $('treat').hidden = false;
  $('treat').style.left = `${picnic.x - picnic.width / 2}px`;
  $('treat').style.top = `${picnic.y - picnic.height / 2}px`;
  $('treat').style.width = `${picnic.width}px`;
  $('treat').style.height = `${picnic.height}px`;
  clearTimeout(treatTimer);
  treatTimer = setTimeout(() => ($('treat').hidden = true), 15000);
  treatEaters = 0;
  let i = 0;
  for (const v of views.values()) {
    const seat = picnic.seats[i++];
    sendTo(v, footTarget(v, seat.x, seat.y, 0), { arrive: ate });
  }
  setAimingMode(false);
}
