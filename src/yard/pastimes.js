// What an idle friend does between strolls (docs/design/2026-11-24-the-yard-plays-like-a-game.md,
// G4): a wave or a jump anywhere, and outdoors a look at what moves around it, a meeting with a
// friend nearby, a sit or a stretch, in its own character's shares (wander.js). A sit and a stretch
// are the pet's own clips (actions.json), so a pet without them strolls instead. All of it is the
// friend's own: its agent's state, a game or what the person asks takes it at once (trips.js).
import { playCompanionAction } from '../core/companion-actions.js';
import { between, distance, pick } from '../core/math.js';
import { data, views } from '../core/state.js';
import { stateOf } from '../core/status.js';
import { bodyInField } from './field.js';
import { isFree, rest, sendTo, setDoing } from './trips.js';
import { gaze, pose } from './views.js';
import { characterOf, idleAction, meetSpots } from './wander.js';
import { stations } from './workspace.js';
import { scene } from './world.js';

// How long a look lasts, and how long two friends who met look at each other.
const LOOK_MS = [1000, 2000];
const MEET_MS = 2600;
// Where a friend with nobody to look at looks: up at a bird or a cloud, to one side.
const SKYWARD = { x: 60, y: -60 };

// A friend free to be called over: idle, not busy, and not seeing to its agent.
const idle = v => isFree(v) && stateOf(data, v.pet.id) === 'idle';
// Another friend's place from this one's, in pixels, as a pointer's look is measured (views.js).
const toward = (v, o) => ({ x: o.px - v.px, y: o.py - v.py });

/** An idle friend's turn: does a pastime and returns true, or returns false for a stroll.
 * `clear(v)` gives the strolls the ground allows that friend (motion.js), and `quiet` is the small
 * window's calmer yard. */
export function pastime(v, now, { quiet = false, clear, rng = Math.random } = {}) {
  const outdoors = !stations(),
    others = [...views.values()].filter(o => o !== v && !o.away);
  const can = outdoors
    ? {
        look: v.asset?.version === 2,
        meet: others.some(idle),
        sit: true,
        stretch: true,
      }
    : {};
  const action = idleAction(rng, quiet, characterOf(v.asset), can);
  if (action.type === 'pose') {
    pose(v, action.pose, 1200);
    return true;
  }
  if (action.type === 'look') return lookAround(v, others, rng);
  if (action.type === 'meet') return meet(v, others.filter(idle), clear, now);
  if (action.type === 'sit' || action.type === 'stretch') return stay(v, action.type, now);
  return false;
}
/** The friend's pace for its own strolls and its rests: its character's (wander.js). */
export const paceOf = v => characterOf(v.asset).pace;
export const restOf = v => characterOf(v.asset).rest;

// It stops and looks at the nearest friend on the move, else the nearest one, else up and away.
function lookAround(v, others, rng) {
  const by = o => Math.hypot(o.px - v.px, o.py - v.py),
    moving = others.filter(o => o.target).sort((a, b) => by(a) - by(b)),
    near = [...others].sort((a, b) => by(a) - by(b));
  const target = moving[0] || near[0],
    at = target && toward(v, target),
    look = at && Math.hypot(at.x, at.y) > 20 ? at : { x: SKYWARD.x * pick([-1, 1], rng), y: SKYWARD.y };
  gaze(v, look, between(rng, LOOK_MS));
  return true;
}
// It calls over the nearest idle friend: both walk to stand face to face, look at each other, and
// the one who called waves. Either taken on the way leaves the other to stroll on.
function meet(v, others, clear, now) {
  const body = bodyInField(v.pet, v.x),
    by = o => distance(o, v);
  for (const o of others.sort((a, b) => by(a) - by(b))) {
    const spots = meetSpots({ x: v.x, y: v.y }, { x: o.x, y: o.y }, body);
    if (!spots) return false;
    const [mine, theirs] = spots;
    if (clear && (!clear(v)({ x: v.x, y: v.y }, mine) || !clear(o)({ x: o.x, y: o.y }, theirs))) continue;
    const world = scene.world;
    let arrived = 0;
    const greet = () => {
      if (++arrived < 2 || scene.world !== world) return;
      gaze(v, toward(v, o), MEET_MS);
      gaze(o, toward(o, v), MEET_MS);
      pose(v, 'wave', 1400);
      // Both stay a moment before they go their ways.
      rest(v);
      rest(o);
    };
    sendTo(v, mine, { slow: true, own: true, arrive: greet });
    sendTo(o, theirs, { slow: true, own: true, arrive: greet });
    o.nextWander = now + MEET_MS;
    return true;
  }
  return false;
}
// It sits a while or stretches where it stands, by its own clip; without one it strolls instead.
function stay(v, kind, now) {
  const action = playCompanionAction(v, kind, now);
  if (!action) return false;
  setDoing(v, { until: now + action.duration, world: scene.world }, true);
  return true;
}
