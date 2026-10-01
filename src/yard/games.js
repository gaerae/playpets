// Yard games. Positions are yard coordinates (0..1 across the field); the app moves the friends.
import { t } from '../core/i18n.js';
import { clamp } from '../core/math.js';

export const GAMES = { hide: t('game.hide'), parade: t('game.parade'), tag: t('game.tag') };
export const TAG_MS = 40000;
export const PARADE_MS = 26000;
const PARADE_GAP = 0.07;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// One slot per friend along the ridge, so nobody hides on top of somebody else.
export function hidingSpots(count, rng) {
  return Array.from({ length: count }, (_, i) => ({ x: clamp((i + 0.3 + rng() * 0.4) / count), y: rng() * 0.18 }));
}
export function paradePoint(t) {
  const angle = Math.PI / 2 + t * Math.PI * 2;
  return { x: 0.5 + Math.cos(angle) * 0.42, y: 0.55 + Math.sin(angle) * 0.4 };
}
// Everyone walks exactly one lap, each starting a step behind the friend in front.
export function paradePositions(count, progress) {
  return Array.from({ length: count }, (_, i) => paradePoint(progress - i * PARADE_GAP));
}
export const paradeDone = progress => progress >= 1;
export function chaseTarget(it, others, immuneId) {
  let best = null;
  for (const o of others) {
    if (o.id === immuneId) continue;
    if (!best || distance(it, o) < distance(it, best)) best = o;
  }
  return best;
}
export function fleeTarget(me, it, rng) {
  const away = Math.atan2(me.y - it.y, me.x - it.x) + (rng() - 0.5) * 0.8;
  const at = (angle, reach) => ({ x: clamp(me.x + Math.cos(angle) * reach), y: clamp(me.y + Math.sin(angle) * reach) });
  const straight = at(away, 0.3);
  if (distance(straight, me) > 0.15) return straight;
  // Cornered: slide along the wall, whichever way ends up farther from the tagger.
  const ways = [1, -1, 1.5, -1.5]
    .map(turn => at(away + (turn * Math.PI) / 2, 0.35))
    .filter(p => distance(p, me) > 0.15);
  return ways.sort((a, b) => distance(b, it) - distance(a, it))[0] || { x: 0.5, y: 0.5 };
}
// Tags are judged in screen pixels between body centres, so what looks like a catch is one.
export const touching = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.size + b.size) * 0.42;
// Hide and seek by name: the game asks for one hidden friend at a time.
export function pickTarget(hidden, rng) {
  const left = [...hidden];
  return left.length ? left[Math.min(left.length - 1, Math.floor(rng() * left.length))] : null;
}
export const seek = (hidden, target, pressed) =>
  !hidden.has(pressed) ? 'ignored' : pressed === target ? 'found' : 'wrong';
