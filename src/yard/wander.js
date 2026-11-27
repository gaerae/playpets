// Idle-life planning for yard pets: when and where a pet strolls on its own.
import { clamp } from '../core/math.js';

export const WANDER_DELAY = [8000, 20000]; // quiet time before a pet entertains itself
export const SCATTER_DELAY = [2500, 6000]; // how long pets linger where a treat was placed
// How many points along a stroll are looked at for water: enough that a lake's narrowest end
// (ground.js keeps it whole, as one ellipse) cannot slip between two of them.
const STEPS = 12;
const within = (p, e) => ((p.x - e.x) / e.rx) ** 2 + ((p.y - e.y) / e.ry) ** 2 <= 1;
/** Whether a stroll between two feet (field units, as ground.js measures the water and what stands
 * on the field) keeps out of the water and ends clear of trees, flowers and gifts. A friend set
 * down in the water (dragged there, or there before this rule) may walk out of it. */
export function strollClear(from, to, ground) {
  if (!ground) return true;
  const water = ground.water || [];
  if ((ground.obstacles || []).some(e => within(to, e)) || water.some(e => within(to, e))) return false;
  if (water.some(e => within(from, e))) return true;
  for (let i = 1; i < STEPS; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / STEPS, y: from.y + ((to.y - from.y) * i) / STEPS };
    if (water.some(e => within(p, e))) return false;
  }
  return true;
}
// How far a stroll goes, in the friend's own body lengths: the pace is in them too (motion.js
// STROLL), so a stroll takes two to four seconds in any window. As a share of the yard, a full
// screen's strolls were three times as long as a small window's, and the yard drew all the while.
const STROLL_BODIES = [1.2, 3];
// One body length across and down in field units, at 112 px in a 1180 x 850 yard, for a caller
// that does not say (field.js sizeOf and yardSize give the real one).
const BODY = { x: 0.095, y: 0.13 };
// A way within `across` radians of the horizontal, to the right or the left, from one draw.
const acrossAngle = (roll, across) => (roll < 0.5 ? 0 : Math.PI) + ((roll % 0.5) * 4 - 1) * across;
/** Where a friend at `position` strolls next: a visible stroll that `clear(from, to)` allows, or
 * null when none of the tries is (the friend then stays and does something else). `body` is one
 * of the friend's body lengths across and down, in field units. With `across` (radians), the
 * stroll keeps within that angle of the horizontal: a friend with only a side walk. */
export function wanderTarget(position, rng, clear = () => true, body = BODY, { across = null } = {}) {
  const bodies = (a, b) => Math.hypot((b.x - a.x) / body.x, (b.y - a.y) / body.y);
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = across === null ? rng() * Math.PI * 2 : acrossAngle(rng(), across),
      distance = STROLL_BODIES[0] + rng() * (STROLL_BODIES[1] - STROLL_BODIES[0]);
    // a little less up and down than across, as the field is seen from above at a slant
    const target = {
      x: clamp(position.x + Math.cos(angle) * distance * body.x),
      y: clamp(position.y + Math.sin(angle) * distance * body.y * 0.7),
    };
    if (bodies(position, target) >= 1 && clear(position, target)) return target;
  }
  // Cornered pets head back toward the middle of the yard.
  const middle = {
    x: clamp(position.x + (position.x < 0.5 ? 2 : -2) * body.x),
    y: clamp(position.y + (position.y < 0.5 ? 1.2 : -1.2) * body.y),
  };
  return clear(position, middle) ? middle : null;
}
// How each of the four friends moves (docs/design/2026-11-24-the-yard-plays-like-a-game.md, G4):
// `pace` times the stroll's speed (motion.js STROLL), `rest` times the wait before the next turn,
// and the rest are each turn's share of a look around, a meeting, a sit and a stretch. A pet of
// someone else's gets the middle one.
const MIDDLE = Object.freeze({ pace: 1, rest: 1, look: 0.1, meet: 0.06, sit: 0.06, stretch: 0.04 });
const CHARACTERS = {
  // brisk and short of rests, and the first to say hello
  'playpets-pip': { pace: 1.3, rest: 0.7, look: 0.08, meet: 0.12, sit: 0.03, stretch: 0.04 },
  'playpets-clover': MIDDLE,
  // unhurried, rests long, and likes a sit
  'playpets-miso': { pace: 0.7, rest: 1.5, look: 0.08, meet: 0.05, sit: 0.12, stretch: 0.06 },
  // stops to look at things
  'playpets-daisy': { pace: 1, rest: 1.1, look: 0.2, meet: 0.07, sit: 0.05, stretch: 0.03 },
};
/** How the friend drawn by `asset` moves: its own character, or the middle one. */
export const characterOf = asset => CHARACTERS[asset?.sourceId] ?? MIDDLE;
const PASTIMES = ['look', 'meet', 'sit', 'stretch'];
const POSE = 0.12;
/** What an idle friend does this turn: a stroll most often, a wave or a jump (a pose one turn in
 * eight, a jump one pose in four, so big gestures stay a surprise), or, where `can` allows, a look
 * around, a meeting with a friend, a sit or a stretch, in the shares of its `character`. */
export function idleAction(rng, quiet = false, character = MIDDLE, can = {}) {
  const roll = rng();
  if (roll < POSE) return { type: 'pose', pose: quiet || rng() < 0.75 ? 'wave' : 'jump' };
  let upTo = POSE;
  for (const type of PASTIMES) {
    upTo += character[type] ?? 0;
    if (roll < upTo) return can[type] ? { type } : { type: 'move' };
  }
  return { type: 'move' };
}
// A friend calls over one no further than this, in body lengths, and they stand this far apart.
const MEET_REACH = 4;
const MEET_APART = 1.3;
/** Where two friends at `a` and `b` (field units) stand to meet face to face: each on its own side,
 * level, a little more than a body apart around the middle; null when they are too far apart. */
export function meetSpots(a, b, body = BODY) {
  if (Math.hypot((b.x - a.x) / body.x, (b.y - a.y) / body.y) > MEET_REACH) return null;
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    side = a.x <= b.x ? -1 : 1,
    half = (MEET_APART * body.x) / 2;
  return [
    { x: clamp(middle.x + side * half), y: middle.y },
    { x: clamp(middle.x - side * half), y: middle.y },
  ];
}
