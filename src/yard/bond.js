// Friendship: each friend grows closer to the person through time together in the yard and what
// they do together. The backend keeps the points and decides what each thing is worth and how much
// a day can bring (src-tauri/src/pets/bond.rs); this tells it what happened, shows how close each
// friend is (hearts on the name tag, a bar in the Friend panel), celebrates a new level, and holds
// what the levels open: a welcome back (2), fishing alone (3, catch.js), more seeds (4, garden.js),
// a flower on the tag and words of its own (5, sky.js).
// Design: docs/design/2026-10-09-a-yard-that-grows.md.

import { list, t } from '../core/i18n.js';
import { pick } from '../core/math.js';
import { $, call, data, name, selected, views } from '../core/state.js';
import { showCard } from './card.js';
import { heartSvg } from './creatures.js';
import { localDay } from './growth.js';
import { cue } from './sound.js';
import { bubble, effect, pose } from './views.js';

const TIME_EVERY = 10 * 60 * 1000;
const levels = () => data.limits?.bondLevels || [0, 60, 200, 500, 1000];
/** A friend's points. */
export const pointsOf = id => data.bonds?.[id]?.points || 0;
/** A friend's level, 1 to 5. */
export const levelOf = id => levels().filter(at => pointsOf(id) >= at).length;

function celebrate(id, level) {
  const v = views.get(id);
  if (!v) return;
  pose(v, 'jump', 1300);
  cue('level');
  for (let k = 0; k < 3; k++) setTimeout(() => views.has(id) && effect(v, '♥'), k * 220);
  bubble(v, pick(list('bond.up_line')), 3200);
  showCard(
    heartSvg(level),
    t('bond.up_card', { name: name(v.pet) }),
    `${t(`bond.level_${level}`)} · ${t(`bond.unlock_${level}`)}`,
    false,
  );
}
/** Something done together with a friend: `reason` is time, pat, treat, chat, water, catch or gift. */
export function befriend(id, reason) {
  if (!id) return;
  call('befriend', id, reason, localDay(new Date()))
    .then(r => {
      if (r?.up) celebrate(id, r.level);
    })
    .catch(() => {});
}

// Time together: every ten minutes the yard is seen, each friend in it.
let nextTime = 0;
/** Called by the frame loop while the yard is seen. */
export function bondTick(now) {
  if (!nextTime) nextTime = now + TIME_EVERY;
  if (now < nextTime) return;
  nextTime = now + TIME_EVERY;
  for (const id of views.keys()) befriend(id, 'time');
}

// A welcome back (level 2 and up): after the app starts, and when the yard is seen again after a
// while away.
const AWAY = 20 * 60 * 1000;
let hiddenAt = 0;
function welcome() {
  const close = [...views.values()].filter(v => levelOf(v.pet.id) >= 2).slice(0, 3);
  for (const [i, v] of close.entries()) {
    setTimeout(
      () => {
        if (!views.has(v.pet.id)) return;
        pose(v, 'wave', 1500);
        bubble(v, pick(list('bond.welcome')), 3200);
      },
      600 + i * 700,
    );
  }
}
/** The yard was hidden or shown again (app.js passes on the window's and the page's signals). */
export function seen(visible) {
  if (!visible) {
    hiddenAt ||= Date.now();
    return;
  }
  if (hiddenAt && Date.now() - hiddenAt >= AWAY) welcome();
  hiddenAt = 0;
}

/** Hearts on each friend's name tag, and the Friend panel's friendship row, as the bonds are now. */
export function renderBonds() {
  for (const [id, v] of views) {
    const level = levelOf(id);
    if (v.bondLevel === level) continue;
    v.bondLevel = level;
    v.tagBond.textContent = level > 1 ? '♥'.repeat(level - 1) : '';
    v.tagBond.title = t('bond.hearts', { level: t(`bond.level_${level}`) });
    v.button.classList.toggle('dear', level >= 5);
  }
  const id = selected,
    row = $('bond-row');
  if (!id || !data.pets.some(p => p.id === id)) {
    row.hidden = true;
    return;
  }
  row.hidden = false;
  const steps = levels(),
    level = levelOf(id),
    points = pointsOf(id),
    from = steps[level - 1],
    to = steps[level];
  $('bond-name').textContent = t(`bond.level_${level}`);
  $('bond-fill').style.width = `${to ? Math.round(((points - from) / (to - from)) * 100) : 100}%`;
  $('bond-next').textContent = to
    ? t('bond.next', { level: t(`bond.level_${level + 1}`), left: to - points, unlock: t(`bond.unlock_${level + 1}`) })
    : t('bond.max');
}
/** Starts the welcome after the app opens. Called once, by app.js, once the friends are drawn. */
export function setupBond() {
  setTimeout(welcome, 1500);
  document.addEventListener('visibilitychange', () => seen(!document.hidden));
}
