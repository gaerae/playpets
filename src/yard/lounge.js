// A workspace is lived in without an agent too (docs/design/2026-11-11-agent-workspaces.md): now and
// then an idle friend sits at a free seat to read, has tea in the rest corner or sits by the bench,
// and strolls on after a while. The trip and the sitting are the friend's own (trips.js `own`), so
// its agent's state or anything the person starts takes it at once, and a friend seeing to its
// agent takes the seat or the bench from it (duty.js). Outdoors nothing changes.
import { list } from '../core/i18n.js';
import { between, pick } from '../core/math.js';
import { views } from '../core/state.js';
import { inLine, sitting, station } from './duty.js';
import { release, rest, sendTo, setDoing } from './trips.js';
import { bubble, gaze } from './views.js';
import { stations } from './workspace.js';
import { scene } from './world.js';

// How often an idle friend's turn goes to the furniture instead of a stroll, and which piece.
const CHANCE = 0.35;
const KINDS = [
  [0.45, 'desk'],
  [0.8, 'done'],
  [1, 'waiting'],
];
// How long a friend stays, and how long before it sits again once it got up.
const SIT = [30000, 70000];
const AGAIN = 60000;
// How long after the first word at the tea table the other answers.
const REPLY_MS = 1800;

/** Now and then, in a place with stations, an idle friend goes to sit instead of strolling: the
 * target, or null. Outdoors it returns null without drawing on `rng`. */
export function loungeTarget(v, now, rng = Math.random) {
  const here = stations();
  if (!here || now < (v.sitAgain ?? 0) || rng() >= CHANCE) return null;
  const roll = rng(),
    kind = KINDS.find(([upTo]) => roll < upTo)[1],
    at = spotFor(v, kind, here);
  if (!at) return null;
  sendTo(v, at, {
    save: false,
    slow: true,
    own: true,
    arrive: (v, now) => sit(v, now),
    cancel: getUp,
  });
  // inLine and the seat keep `v.spot`; marked as sitting, it gives way to a friend at work.
  v.spot = { ...v.spot, kind, idle: true };
  // Counted from setting off too, so a friend picked up on the way or from its seat strolls a while.
  v.sitAgain = now + AGAIN;
  return v.target;
}
// A free seat (the first, as duty.js gives desks), or a place in line at the tea table or the bench.
function spotFor(v, kind, here) {
  if (kind !== 'desk') {
    const point = kind === 'done' ? here.rest : here.approval,
      at = point && station(v, point);
    return at && inLine(v, kind, at);
  }
  const taken = new Set([...views.values()].filter(o => o !== v && o.spot?.kind === 'desk').map(o => o.desk));
  for (const [i, point] of (here.desks || []).entries()) {
    const at = !taken.has(i) && station(v, point);
    if (!at) continue;
    v.desk = i;
    v.spot = { kind: 'desk', ...at };
    return at;
  }
  return null;
}
// Arrived: it sits a while, says a word now and then, and at the tea table talks with a friend
// already there.
function sit(v, now) {
  const kind = v.spot?.kind;
  setDoing(v, { until: now + between(Math.random, SIT), world: scene.world, end: getUp }, true);
  const other = kind === 'done' && [...views.values()].find(o => o !== v && o.spot?.kind === 'done' && !o.target);
  if (other) return talk(v, other);
  if (Math.random() < 0.5) bubble(v, pick(list(`lounge.${kind}`)), 3000);
}
// Two friends at the tea table look at each other: one says a word, the other answers.
function talk(v, other) {
  const toward = Math.sign(other.px - v.px) * 40;
  gaze(v, { x: toward, y: 0 }, 6000);
  gaze(other, { x: -toward, y: 0 }, 6000);
  bubble(v, pick(list('lounge.invite')), 3000);
  setTimeout(() => {
    if (views.get(other.pet.id) === other && other.spot?.kind === 'done' && !other.target)
      bubble(other, pick(list('lounge.reply')), 3000);
  }, REPLY_MS);
}
// Lets go of its seat, whatever ended the sitting or the trip there.
function getUp(v) {
  if (sitting(v)) v.spot = null;
}
/** Called for each friend by the frame loop: a friend sitting on its own gets up once its time is
 * over, or the place changed, and strolls on soon after. One check for every other friend. */
export function sitOut(v, now) {
  const until = v.doing?.until;
  if (!(until <= now || (until && v.doing.world !== scene.world))) return;
  release(v);
  rest(v);
  v.sitAgain = now + AGAIN;
}
