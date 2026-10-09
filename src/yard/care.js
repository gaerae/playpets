// Looking after friends: treats they walk over to, and greetings they answer.

import { t } from '../core/i18n.js';
import { clamp } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, call, data, guard, selected, setAiming, toast, views } from '../core/state.js';
import { greetingFor } from './scene.js';
import { scene } from './sky.js';
import { bubble, effect, FIELD_TOP, geometry, hint, petHeight, pose, rest, sizeOf } from './views.js';
import { delay, SCATTER_DELAY } from './wander.js';

let treatTimer,
  treatEaters = 0;
// Called when a friend reaches the treat.
export function ate(v, now) {
  pose(v, 'jump', 1100);
  effect(v, '✦');
  bubble(v, t('care.yum'));
  v.nextWander = now + delay(Math.random, SCATTER_DELAY);
  if (++treatEaters >= views.size) {
    clearTimeout(treatTimer);
    treatTimer = setTimeout(() => ($('treat').hidden = true), 900);
  }
}
// A pat, a wave or a jump asked for by the person or by a coding agent.
export function react(event) {
  // Greeting everyone at once: each friend answers in its own words, a beat apart.
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
}
// Wires the treat, greeting and chatter buttons, and the yard's click for placing a treat. Called once, by app.js.
export function setupCare() {
  $('greet').onclick = guard(() => call('play', 'wave', null));
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
function dropTreat(x, y) {
  const r = $('yard').getBoundingClientRect(),
    bx = clamp(x, 25, r.width - 25),
    by = clamp(y, r.height * FIELD_TOP, r.height - 28);
  $('treat').hidden = false;
  $('treat').style.left = `${bx - 11}px`;
  $('treat').style.top = `${by - 11}px`;
  clearTimeout(treatTimer);
  treatTimer = setTimeout(() => ($('treat').hidden = true), 15000);
  treatEaters = 0;
  let i = 0;
  for (const v of views.values()) {
    const { w, h, top } = geometry(v.pet);
    const angle = (i++ / views.size) * Math.PI * 2;
    v.target = {
      x: clamp((bx - 14 - sizeOf(v.pet) / 2 + Math.cos(angle) * 34) / w),
      y: clamp((by - top - petHeight(v.pet) + Math.sin(angle) * 20) / h),
    };
    v.targetKind = 'treat';
  }
  setAimingMode(false);
}
