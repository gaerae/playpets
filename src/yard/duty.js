// A friend linked to a coding agent shows the agent's state in what it does, not only in its dot
// (docs/design/2026-11-11-agent-workspaces.md). Anywhere: working or failed, it stays where it
// stands; waiting for the person, it comes to the front of the yard; done, it rests a moment and
// strolls on. In a workspace (workspace.js stations) it works and fails at a desk, waits at the
// approval spot and rests in the rest corner until its agent's next word. A friend only sitting
// there on its own (lounge.js) gives its seat or the bench to one seeing to its agent.
import { t } from '../core/i18n.js';
import { call, data, game, toast, views } from '../core/state.js';
import { agentStateOf } from '../core/status.js';
import { spoken } from '../core/text.js';
import { dockBox, EDGE, footTarget, geometry, petHeight, sizeOf, underDock } from './field.js';
import { release, rest, sendTo } from './trips.js';
import { stationAt, stations } from './workspace.js';

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
    // Away from its own place at a spot (`v.spot`), a friend walks back to it after, unless the new
    // state has a spot of its own; the spot never changed the place it keeps.
    v.back = !!v.spot;
    v.agent = state;
    v.duty = DUTIES.has(state) || (state === 'done' && !!stations()?.rest) ? state : null;
    v.spot = null;
    v.due = true;
  }
  if (!v.due || held(v)) return;
  v.due = false;
  if (v.duty) release(v);
  const spot = spotFor(v, state);
  // Its own trip: the agent's next word may send it elsewhere on the way.
  if (spot) return void sendTo(v, spot, { save: false, own: true });
  if (v.back) sendTo(v, { x: v.pet.x, y: v.pet.y }, { save: false, slow: true, own: true });
  else if (v.duty) stay(v);
  if (state === 'done') rest(v);
}

/** A new place for the friends (app.js worldChanged): the station a friend held stays behind, and
 * its agent's state is seen to afresh there, so a friend already at work sits down in a room and
 * stands at its own place again outdoors. */
export function dutyAfresh(v) {
  v.spot = null;
  v.back = false;
  v.agent = undefined;
}

// Where the state sends the friend, or null to leave it be.
function spotFor(v, state) {
  const here = stations();
  if (state === 'waiting') {
    const approval = here?.approval && station(v, here.approval);
    if (!approval) return frontSpot(v);
    for (const o of views.values()) if (o !== v && sitting(o) && o.spot.kind === 'waiting') standUp(o);
    return inLine(v, 'waiting', approval);
  }
  if ((state === 'working' || state === 'error') && here?.desks?.length) return desk(v, here.desks);
  const corner = state === 'done' && here?.rest && station(v, here.rest);
  return corner ? inLine(v, 'done', corner) : null;
}
/** A station as a friend's place, or null where the window crops it away: a friend sent there would
 * stop at the floor's edge, often behind the very furniture that shows (a short, wide window). */
export const station = (v, point) => {
  const at = stationAt(point),
    { w, h, top } = geometry(v.pet),
    x = (at.x - EDGE - sizeOf(v.pet) / 2) / w,
    y = (at.y - top - petHeight(v.pet)) / h;
  return x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05 ? null : footTarget(v, at.x, at.y, 0);
};

// Stopped where it stands, mid-stroll perhaps: that is its place now, as the stroll's end would
// have been, so the yard drawn again does not take it back.
function stay(v) {
  const p = v.pet;
  if (p.x === v.x && p.y === v.y) return;
  p.x = v.x;
  p.y = v.y;
  call('updatePet', p.id, { x: v.x, y: v.y }).catch(e => toast(spoken(e, t('error.generic')), { error: true }));
}

/** Where a waiting friend stands outside a workspace: on the friends' lowest row, nearest the
 * middle first, a body apart from the others waiting, never behind the dock. */
export const frontSpot = v => inLine(v, 'waiting', { x: 0.5, y: 1 });

/** A place in line at `at` (a friend's place, 0 to 1 each way) for friends at the same kind of spot:
 * `at` itself, else a body to the right, the left, two to the right..., never behind the dock. Kept
 * as `v.spot` while the friend is there. */
export function inLine(v, kind, at) {
  const { w, h, top } = geometry(v.pet),
    size = sizeOf(v.pet),
    step = Math.min(0.5, size / Math.max(1, w)),
    feet = top + at.y * h + petHeight(v.pet),
    taken = [...views.values()].filter(o => o !== v && o.spot?.kind === kind).map(o => o.spot.x),
    dock = dockBox();
  for (let i = 0; i <= 2 / step; i++) {
    const x = at.x + (i % 2 ? (i + 1) / 2 : -i / 2) * step;
    if (x < 0 || x > 1 || taken.some(other => Math.abs(other - x) < step * 0.9)) continue;
    if (underDock(EDGE + x * w + size / 2, feet, size / 2, dock)) continue;
    v.spot = { kind, x, y: at.y };
    return { x, y: at.y };
  }
  v.spot = { kind, ...at };
  return { ...at };
}

// A desk for a working friend: its own one again when no friend at work sits there, else the first
// free one (friends are seen to in the order they were added); a friend only sitting there gets up.
// With more working friends than desks, the next stand beside one, a desk each side in turn; past
// that, a friend works where it stands.
function desk(v, desks) {
  const seated = [...views.values()].filter(o => o !== v && o.spot?.kind === 'desk' && !sitting(o)),
    taken = new Set(seated.map(o => o.desk));
  if (!(v.desk >= 0 && v.desk < desks.length) || taken.has(v.desk)) v.desk = desks.findIndex((_, i) => !taken.has(i));
  let at;
  if (v.desk >= 0) {
    at = station(v, desks[v.desk]);
    if (at)
      for (const o of views.values())
        if (o !== v && sitting(o) && o.spot.kind === 'desk' && o.desk === v.desk) standUp(o);
  } else {
    const beside = seated.filter(o => o.desk < 0).length;
    if (beside >= desks.length * 2) return null;
    const point = desks[beside % desks.length],
      side = beside < desks.length ? 1 : -1,
      { x, y } = stationAt(point);
    at = station(v, point) && footTarget(v, x + side * sizeOf(v.pet), y, 0);
  }
  // A desk cropped away: the friend works where it stands.
  if (!at) return null;
  v.spot = { kind: 'desk', ...at };
  return at;
}

/** Whether a friend is only sitting somewhere on its own (lounge.js), or on its way there. */
export const sitting = v => !!v.spot?.idle;
// A friend only sitting gives way: it lets go of its seat and walks back to its own place.
function standUp(v) {
  release(v);
  v.spot = null;
  sendTo(v, { x: v.pet.x, y: v.pet.y }, { save: false, slow: true, own: true });
}
