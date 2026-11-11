// A friend linked to a coding agent shows the agent's state in what it does, not only in its dot
// (docs/design/2026-11-11-agent-workspaces.md): working or failed, it stays where it stands;
// waiting for the person, it comes to the front of the yard; done, it rests a moment and strolls on.
import { t } from '../core/i18n.js';
import { call, data, game, toast, views } from '../core/state.js';
import { agentStateOf } from '../core/status.js';
import { spoken } from '../core/text.js';
import { EDGE, geometry, petHeight, sizeOf, underDock } from './field.js';
import { release, rest, sendTo } from './trips.js';

// The states that keep a friend at its agent's side (`v.duty`); trips.js isFree passes it over.
const DUTIES = new Set(['working', 'waiting', 'error']);

// Taken by something the person started (a hold, a game, an errand or a task of theirs): the friend
// sees to its agent once that lets go. What it started on its own (`v.own`) gives way at once.
const held = v => !!v.drag || !!game || (!!v.away && !v.gathered) || ((!!v.target || !!v.doing) && !v.own);

/** Called for each friend by the frame loop: acts when its agent's state changed, or once whatever
 * held the friend then lets go. A friend whose state did not change costs one comparison. */
export function keepDuty(v) {
  const state = agentStateOf(data, v.pet.id);
  if (state !== v.agent) {
    // Back from the front, a friend walks to its own place, which the wait never changed.
    v.back = v.duty === 'waiting';
    v.agent = state;
    v.duty = DUTIES.has(state) ? state : null;
    v.spot = null;
    v.due = true;
  }
  if (!v.due || held(v)) return;
  v.due = false;
  if (v.duty) release(v);
  if (v.duty === 'waiting') return void sendTo(v, frontSpot(v), { save: false });
  if (v.back) sendTo(v, { x: v.pet.x, y: v.pet.y }, { save: false, slow: true, own: true });
  else if (v.duty) stay(v);
  if (state === 'done') rest(v);
}

// Stopped where it stands, mid-stroll perhaps: that is its place now, as the stroll's end would
// have been, so the yard drawn again does not take it back.
function stay(v) {
  const p = v.pet;
  if (p.x === v.x && p.y === v.y) return;
  p.x = v.x;
  p.y = v.y;
  call('updatePet', p.id, { x: v.x, y: v.y }).catch(e => toast(spoken(e, t('error.generic')), { error: true }));
}

/** Where a waiting friend stands: on the friends' lowest row, nearest the middle first, a body apart
 * from the others waiting, never behind the dock. Kept as `v.spot` while it waits. */
export function frontSpot(v) {
  const { w, h, top } = geometry(v.pet),
    size = sizeOf(v.pet),
    step = Math.min(0.5, size / Math.max(1, w)),
    feet = top + h + petHeight(v.pet),
    taken = [...views.values()].filter(o => o !== v && o.duty === 'waiting' && o.spot).map(o => o.spot.x);
  for (let i = 0; i <= 2 / step; i++) {
    const x = 0.5 + (i % 2 ? (i + 1) / 2 : -i / 2) * step;
    if (x < 0 || x > 1 || taken.some(at => Math.abs(at - x) < step * 0.9)) continue;
    if (underDock(EDGE + x * w + size / 2, feet, size / 2)) continue;
    return (v.spot = { x, y: 1 });
  }
  return (v.spot = { x: 0.5, y: 1 });
}
