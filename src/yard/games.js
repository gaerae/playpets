// Yard games. Positions are yard coordinates (0..1 across the field); the app moves the friends.
import { t } from '../core/i18n.js';
import { clamp, distance } from '../core/math.js';

export const GAMES = {
  hide: t('game.hide'),
  parade: t('game.parade'),
  tag: t('game.tag'),
  snowman: t('game.snowman'),
};
export const TAG_MS = 40000;
// Pressing whoever is it holds it still this long, and not again until TAG_FREEZE_AGAIN_MS after.
export const TAG_FREEZE_MS = 1500;
export const TAG_FREEZE_AGAIN_MS = 4000;
// How fast friends go in a game, in body lengths a millisecond as motion.js counts a walk (an
// errand, WALK, is 0.002): a dash to a hiding spot or into line, the tagger a good step quicker
// than the friends it chases. In the field's width instead, a full screen's game ran at four times
// an errand, and a small window's at half its own.
export const GAME_PACE = { dash: 0.003, chase: 0.0032, run: 0.0022 };
// A parade keeps friends this many body lengths apart along its lap, and a lap takes as long as its
// length at the pace it is walked, kept to PARADE_MS: a small window's is short, not crowded.
export const PARADE_GAP = 1.6;
export const PARADE_MS = [14000, 32000];
// One slot per friend along the ridge, so nobody hides on top of somebody else.
export function hidingSpots(count, rng) {
  return Array.from({ length: count }, (_, i) => ({ x: clamp((i + 0.3 + rng() * 0.4) / count), y: rng() * 0.18 }));
}
export function paradePoint(t) {
  const angle = Math.PI / 2 + t * Math.PI * 2;
  return { x: 0.5 + Math.cos(angle) * 0.42, y: 0.55 + Math.sin(angle) * 0.4 };
}
/** The lap's length, by `apart` (how far two places on the field are, in body lengths). */
export function paradeLap(apart, steps = 64) {
  let length = 0;
  for (let i = 0; i < steps; i++) length += apart(paradePoint(i / steps), paradePoint((i + 1) / steps));
  return length;
}
/** The parade of `count` friends on a lap `lap` body lengths long, walked at `pace`: how long the
 * lap takes, and the share of it between two friends, spread evenly round it when they would not fit. */
export function paradePlan(count, lap, pace) {
  return { ms: clamp(lap / pace, ...PARADE_MS), gap: Math.min(PARADE_GAP / lap, 1 / Math.max(1, count)) };
}
// Everyone walks exactly one lap, each starting `gap` (a share of the lap) behind the friend in front.
export function paradePositions(count, progress, gap) {
  return Array.from({ length: count }, (_, i) => paradePoint(progress - i * gap));
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
