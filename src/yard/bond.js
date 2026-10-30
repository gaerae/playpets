// Friendship: each friend grows closer to the person through time together in the yard and what
// they do together. The backend keeps the points and decides what each thing is worth and how much
// a day can bring (src-tauri/src/pets/bond.rs); this tells it what happened, shows how close each
// friend is (hearts on the name tag, a bar in the Friend panel), celebrates a new level, and holds
// what the levels open: a welcome back (2), fishing alone (3, catch.js), a memento (4, decor.js),
// a flower on the tag and words of its own (5, remarks.js).
// Design: docs/design/2026-10-09-a-yard-that-grows.md.

import { joinList, list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { pick } from '../core/math.js';
import { call, data, name, views } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { showCard } from './card.js';
import { heartSvg } from './creatures.js';
import { localDay } from './growth.js';
import { cue } from './sound.js';
import { bubble, effect, pose } from './views.js';

// Time together is said every 10 minutes; the backend counts it at most every 9 (bond.rs
// TIME_EVERY_MS), so a tick that comes a little early still counts (tests/limits.test.mjs).
const TIME_EVERY = 10 * 60 * 1000;
const levels = () => limit(data, 'bondLevels');
/** A friend's points. */
const pointsOf = id => data.bonds?.[id]?.points || 0;
/** How close `points` are on the levels' `steps` (where each level begins): the level, 1 to 5, the
 * share of the way to the next (1 at the last) and the points left to it (0 at the last). */
export function bondProgress(points, steps) {
  const level = steps.filter(at => points >= at).length,
    from = steps[level - 1],
    to = steps[level];
  return { level, share: to ? (points - from) / (to - from) : 1, left: to ? to - points : 0 };
}
/** A friend's closeness as it is now (bondProgress). */
export const progressOf = id => bondProgress(pointsOf(id), levels());
/** A friend's level, 1 to 5. */
export const levelOf = id => progressOf(id).level;
/** A friend's line for a moment (`key`: bond.welcome, bond.up_line, bond.dear), in the voice of who
 * it is to the person: a partner, a senior or a younger sibling has lines of its own (key_relation),
 * a friend the plain ones. */
export function lineFor(pet, key) {
  const own = pet.relation ? list(`${key}_${pet.relation}`) : [];
  return pick(own.length ? own : list(key));
}

function celebrate(id, level) {
  const v = views.get(id);
  if (!v) return;
  pose(v, 'jump', 1300);
  cue('level');
  for (let k = 0; k < 3; k++) setTimeout(() => views.has(id) && effect(v, '♥'), k * 220);
  bubble(v, lineFor(v.pet, 'bond.up_line'), 3200);
  showCard(
    heartSvg(level),
    t('bond.up_card', { name: name(v.pet) }),
    joinList([t(`bond.level_${level}`), t(`bond.unlock_${level}`)]),
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
const together = cadence(() => TIME_EVERY);
/** Called by the frame loop while the yard is seen. */
export function bondTick(now) {
  if (together.due(now)) for (const id of views.keys()) befriend(id, 'time');
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
        bubble(v, lineFor(v.pet, 'bond.welcome'), 3200);
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

/** Hearts on each friend's name tag as the bonds are now (the Friend panel says it in words, friend.js). */
export function renderBonds() {
  for (const [id, v] of views) {
    const level = levelOf(id);
    if (v.bondLevel === level) continue;
    v.bondLevel = level;
    v.tagBond.textContent = level > 1 ? '♥'.repeat(level - 1) : '';
    v.tagBond.title = t('bond.hearts', { level: t(`bond.level_${level}`) });
    v.button.classList.toggle('dear', level >= 5);
  }
}
/** Starts the welcome after the app opens. Called once, by app.js, once the friends are drawn. */
export function setupBond() {
  setTimeout(welcome, 1500);
  document.addEventListener('visibilitychange', () => seen(!document.hidden));
}
