// Flower viewing: during the blossom festival friends gather once a day under a cherry tree the
// person grew (else on a picnic blanket, else in the field's middle), stand in a loose half circle
// facing it, look up now and then and talk in turns, then wander off.
//
// - Where, who and when are viewing-rules.js's; this file walks the friends and keeps the turns.
// - Each friend's walk there is its trip and its standing there its task (trips.js): whatever the
//   person starts (a game, a treat, a dig, a spring shoot, the rod, a drag) takes the friend, and
//   the gathering hears it and lets that friend go.
// - Gathered friends are `away`, as in a game, so a state event does not put them back where they
//   were saved; when one leaves, the place it stands in is kept as its own. They are `gathered` too:
//   what the person starts may take one when no friend is free (trips.js forPerson), while the
//   friends' own doings keep to the free ones.
// - Its timers are the gathering's, cleared when it ends. It draws nothing itself; the petals that
//   fall thicker around the spot are the scenery's (scenery.gather).

import { closeControls } from '../core/controls.js';
import { list, t } from '../core/i18n.js';
import { between, pick, shuffle } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, aiming, call, data, game, toast, views } from '../core/state.js';
import { stateOf } from '../core/status.js';
import { spoken } from '../core/text.js';
import { cadence } from '../core/ticker.js';
import { fishingNow } from './catch.js';
import { yardSeason } from './decor-shown.js';
import { decorPlacement } from './decor.js';
import { digging } from './discovery.js';
import { field, fieldToYard, footOf, footTarget, petHeight, sizeOf, yardZoom } from './field.js';
import { localDay } from './growth.js';
import { treeSize } from './planted-trees.js';
import { shootDigging } from './shoots.js';
import { isFree, sendTo, setDoing, strolling } from './trips.js';
import {
  mayCall,
  mayGather,
  VIEWING_MAX,
  VIEWING_MS,
  viewingSeats,
  viewingSpot,
  viewingTime,
} from './viewing-rules.js';
import { bubble, gaze } from './views.js';
import { scene, scenery } from './world.js';

// The friends look now and then whether to gather: every 2 to 6 minutes, half the time.
const GATHER_EVERY = [2 * 60 * 1000, 6 * 60 * 1000];
const GATHER_CHANCE = 0.5;
// The suggestion's bubble, and the beat before they set off.
const SUGGEST_MS = 3000;
const WALK_AFTER_MS = 900;
// Once the first friend is there: the first turn, the time between turns, how long a line shows
// and how long a friend looks up.
const TURNS_AFTER_MS = 1500;
const TURN_EVERY = [6000, 9000];
const LINE_MS = 3500;
const LOOK_UP_MS = 1600;
// After it ends, friends wander off within a few seconds.
const WANDER_AFTER = [1000, 5000];
// The middle of the field has nothing to face: a spot about as wide as a tree.
const MIDDLE_W = 200;

// When the friends next look whether to gather (setupViewing).
let calling = null;
// When the person last called friends from the menu (ms), kept in page memory only: a restart within
// the hour costs nothing worth saving.
let lastCalled = null;
// The gathering under way: { by, spot, world, members, timers, pool, lines, turns, begun, voiced }, or
// null. `by` is who started it; `voiced` is set while the friends' own AI voices carry the talk.
let gathering = null;
// What a gathered friend is doing, waiting to set off and standing there (trips.js setDoing).
const HERE = { end: v => leave(v) };

/** Wiring: the friends' look at gathering, and the play menu's Flower viewing button. Called once, by
 * app.js. */
export function setupViewing() {
  calling = cadence(() => between(Math.random, GATHER_EVERY));
  lastCalled = null;
  const tool = $('viewing-tool');
  if (tool) tool.onclick = callFriends;
  syncViewingAction();
}

/** Shows the Flower viewing button in blossom time and says whether it can be used now. The play
 * panel's sync calls it, and so a place or time change reaches it with the sky's repaint. */
export function syncViewingAction() {
  const tool = $('viewing-tool');
  if (!tool) return;
  tool.hidden = !viewingTime(scene);
  // Disabled while a gathering is on, so a call is never answered with everyone being busy.
  tool.disabled = !data?.pets?.length || !!game || !!gathering;
  // Waiting stays focusable, like the chatter button, and says why.
  const wait = !mayCall(Date.now(), lastCalled);
  tool.setAttribute('aria-disabled', String(wait));
  tool.title = t(wait && !tool.disabled ? 'viewing.wait' : 'viewing.action_title');
}

// The person's call: friends come unless it is within the hour of the last one, which counts as the
// day's gathering (startViewing marks it).
function callFriends() {
  // Blossom time ended since the menu last looked (night, rain): the button follows the sky, and
  // nobody is told everyone is busy.
  if (!viewingTime(scene)) return syncViewingAction();
  if (!mayCall(Date.now(), lastCalled)) return toast(t('viewing.wait'));
  if (!startViewing('person')) return toast(t('viewing.none_free'));
  lastCalled = Date.now();
  closeControls();
  syncViewingAction();
}

/** Whether friends are viewing the blossom now. */
export const viewing = () => !!gathering;

// Nothing the person started that a gathering would call friends away from.
const busy = () => !!game || !!aiming || fishingNow() || digging() || shootDigging();
// Friends free to come, a stroll let go of; when the friends start it, only those not busy with an
// agent or a chat.
const freeFriends = idle =>
  [...views.values()].filter(v => (isFree(v) || strolling(v)) && (!idle || stateOf(data, v.pet.id) === 'idle'));

/** Called by the frame loop beside the other yard life: now and then, in blossom time, friends who
 * have not viewed it today and have nothing else on gather of their own accord. */
export function viewingTick(now) {
  if (!calling?.due(now) || gathering || Math.random() >= GATHER_CHANCE || !viewingTime(scene)) return;
  const today = localDay(new Date()),
    free = freeFriends(true).length;
  if (mayGather({ today, viewed: data.garden?.viewed ?? '', free, busy: busy() })) startViewing('friends');
}

// The spot in yard pixels: its foot (x, y) and the size it is drawn at (w, h).
function spotNow() {
  const season = yardSeason(scene),
    garden = data.garden ?? {},
    at = viewingSpot({
      trees: garden.trees ?? [],
      decor: garden.decor ?? [],
      world: scene.world,
      now: Date.now(),
      limits: data.limits,
      season,
    }),
    zoom = yardZoom();
  if (at.kind === 'mat') return { ...at, ...decorPlacement(garden.decor.find(d => d.id === at.id)) };
  const foot = fieldToYard(at);
  if (at.kind === 'tree') {
    const [w, h] = treeSize('cherry', 2);
    return { ...at, ...foot, w: w * zoom, h: h * zoom };
  }
  return { ...at, ...foot, w: MIDDLE_W * zoom, h: 0 };
}

/** Starts a gathering, called by the friends (`'friends'`) or by the person (`'person'`). False when
 * it is not blossom time, one is under way, or no friend is free (or the yard has no room for one). */
export function startViewing(by) {
  if (gathering || !viewingTime(scene)) return false;
  const spot = spotNow(),
    near = v => Math.hypot(footOf(v).x - spot.x, footOf(v).y - spot.y),
    free = freeFriends(by === 'friends')
      .sort((a, b) => near(a) - near(b))
      .slice(0, VIEWING_MAX);
  if (!free.length) return false;
  // Seats for the biggest of them and its widest name tag, so no friend or tag covers another; a yard
  // with room for fewer takes the nearest.
  const f = field(),
    seats = viewingSeats({
      spot,
      count: free.length,
      width: f.width,
      top: f.top,
      bottom: f.bottom,
      zoom: yardZoom(),
      size: Math.max(...free.map(v => sizeOf(v.pet))),
      tag: Math.max(0, ...free.map(v => v.tag?.getBoundingClientRect?.().width || 0)),
    }).sort((a, b) => a.x - b.x),
    members = free.slice(0, seats.length);
  if (!members.length) return false;
  // Left to right, so no two cross on the way.
  const walkers = [...members].sort((a, b) => a.px - b.px),
    // A branch line belongs under a tree, a picnic line on a blanket.
    extra = { tree: list('viewing.tree_lines'), mat: list('viewing.mat_lines') }[spot.kind] ?? [];
  const g = {
    by,
    spot,
    world: scene.world,
    members,
    timers: new Set(),
    pool: [...list('viewing.lines'), ...extra],
    lines: [],
    turns: 0,
  };
  gathering = g;
  syncViewingAction();
  const today = localDay(new Date());
  if (data.garden) data.garden.viewed = today;
  call('markViewed', today).catch(() => {});
  // Each waits where it is, held by the gathering, until they set off together.
  for (const v of members) {
    setDoing(v, HERE);
    v.away = true;
    // What the person starts may still take it (trips.js forPerson).
    v.gathered = true;
  }
  bubble(members[0], pick(list('viewing.suggest')), SUGGEST_MS);
  later(g, WALK_AFTER_MS, () => {
    // The clock runs from when they set off, so a walk the frame loop pauses (a hidden window) still
    // ends in time.
    later(g, between(Math.random, VIEWING_MS), endViewing);
    walkers.forEach((v, i) => {
      if (!g.members.includes(v)) return;
      const seat = seats[i];
      v.doing = null;
      v.seat = seat;
      sendTo(v, footTarget(v, seat.x, seat.y, 0), { save: false, arrive: settle, cancel: leave });
    });
  });
  return true;
}

// A timer of the gathering's: it runs only while that gathering is on, and goes when it ends.
function later(g, ms, fn) {
  const timer = setTimeout(() => {
    g.timers.delete(timer);
    if (gathering === g) fn();
  }, ms);
  g.timers.add(timer);
}

// A friend got to its seat: it stands there facing the spot and looking up at it. The first one
// there starts the talk.
function settle(v) {
  const g = gathering;
  if (!g?.members.includes(v)) return;
  setDoing(v, HERE);
  const side = v.seat.side,
    look = { x: g.spot.x - footOf(v).x, y: -petHeight(v.pet) * 2 };
  v.viewing = { side, look };
  v.button.dataset.tilt = side;
  gaze(v, look, VIEWING_MS[1]);
  if (g.begun) return;
  g.begun = true;
  // Petals fall a little thicker around the spot while they are there.
  scenery?.gather({ x: g.spot.x, width: Math.max(160 * yardZoom(), g.spot.w * 1.3) });
  later(g, TURNS_AFTER_MS, () => begin(g));
}

// The talk begins: friends with an AI speak for themselves when two or more are there and the person
// called it or lets them chat on their own; else, or when the AI cannot (fewer than two free, a
// friend still answering, an error), the string lines do. The turns run at once either way, so the
// looks and the end at night, rain or a new place do not wait for the AI; `voiced` only holds the
// string lines back while the AI may speak.
function begin(g) {
  const ai = g.members.filter(v => v.pet.providerId);
  if (ai.length >= 2 && (g.by === 'person' || data.autoChatter)) {
    g.voiced = true;
    call(
      'chatter',
      scene.period,
      scene.weather,
      'blossom',
      ai.map(v => v.pet.id),
    ).catch(() => {
      // A late failure of a gathering that ended is not this one's to answer.
      if (gathering === g) g.voiced = false;
    });
  }
  turn(g);
}

// The next line, from the shuffled lines; once all were said, they are shuffled again.
function nextLine(g) {
  if (!g.lines.length) g.lines = shuffle(g.pool);
  return g.lines.pop();
}

// One turn: a friend says a line, and every other turn one looks up at the blossom. It ends
// when blossom time is over (night, rain, another place).
function turn(g) {
  if (!viewingTime(scene) || g.world !== scene.world) return endViewing();
  const standing = g.members.filter(v => v.viewing);
  // One at a time, so the blossom is not hidden behind bubbles: a turn while one talks stays quiet.
  if (!g.voiced && g.members.every(v => v.bubble.hidden) && standing.length)
    bubble(pick(standing), nextLine(g), LINE_MS);
  if (!reduced.matches && g.turns % 2 === 0 && standing.length) {
    const v = pick(standing);
    v.button.classList.add('looking-up');
    later(g, LOOK_UP_MS, () => v.button.classList.remove('looking-up'));
  }
  // A look the pointer took away comes back.
  for (const v of standing) if (!v.look) gaze(v, v.viewing.look, VIEWING_MS[1]);
  g.turns++;
  later(g, between(Math.random, TURN_EVERY), () => turn(g));
}

// A friend is no longer viewing: its tilt and look go, and the place it stands in is its own now.
function letGo(v) {
  v.button.classList.remove('looking-up');
  delete v.button.dataset.tilt;
  v.viewing = null;
  v.seat = null;
  v.look = null;
  v.away = false;
  v.gathered = false;
  const p = data.pets.find(p => p.id === v.pet.id);
  if (!p || (p.x === v.x && p.y === v.y)) return;
  p.x = v.x;
  p.y = v.y;
  call('updatePet', p.id, { x: v.x, y: v.y }).catch(e => toast(spoken(e, t('error.generic')), { error: true }));
}

// Something else took a friend (trips.js release): it leaves, and the last to leave ends it.
function leave(v) {
  const g = gathering,
    i = g?.members.indexOf(v) ?? -1;
  if (i < 0) return;
  g.members.splice(i, 1);
  letGo(v);
  if (!g.members.length) endViewing();
}

/** Ends the gathering: its timers stop, and each friend still there stays where it stands and soon
 * wanders off. */
export function endViewing() {
  const g = gathering;
  if (!g) return;
  gathering = null;
  syncViewingAction();
  scenery?.gather(null);
  for (const timer of g.timers) clearTimeout(timer);
  for (const v of g.members) {
    // Let go of here, not through release, which would tell leave again.
    if (v.doing === HERE) v.doing = null;
    if (v.trip?.cancel === leave) {
      v.target = null;
      v.trip = null;
    }
    letGo(v);
    v.nextWander = performance.now() + between(Math.random, WANDER_AFTER);
  }
}
