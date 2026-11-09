// The snowman game, one of play.js's games: two friends roll a snowball that grows as it goes, the
// person helps by pressing it or rolls it by dragging (or with the arrow keys), and each full ball
// lifts onto a stack of three beside them. The rest of the friends stand by the stack and watch.
//
// - The numbers are snowman-rules.js's; this file draws the balls and moves the friends.
// - Nothing is saved while the balls roll: stopping halfway takes every ball away and leaves the day
//   unspent.
// - Its timers are the round's (play.js after, given to setupSnowman), so they end with it.
// - It runs only inside the game's own frame; the trail behind the ball is snow-trail.js's.

import { list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { clamp, pick } from '../core/math.js';
import { reduced } from '../core/sprites.js';
import { $, data, game, views } from '../core/state.js';
import { artSize, artSvg } from './art.js';
import { giftKind } from './catalog.js';
import { decorShown, yardSeason } from './decor-shown.js';
import { decorFloor, depthAt, EDGE, field, fieldToYard, footTarget, geometry, sizeOf } from './field.js';
import { beginDrag, dragPoint, endDrag, giftSize, KEY_STEPS, setDown } from './props.js';
import { fadeTrail, trailFrame, trailStamp } from './snow-trail.js';
import {
  BALLS,
  dragStep,
  grow,
  LIFT_MS,
  liftPoint,
  push,
  rollRange,
  rollSpeed,
  SNOWMAN,
  snowmanOffer,
  stackBottoms,
  stackSpot,
  START,
} from './snowman-rules.js';
import { sendTo } from './trips.js';
import { bubble, place, pose } from './views.js';
import { scene } from './world.js';

// What play.js lends this game (setupSnowman): starting and ending a game, and the round's timers.
const play = { start: null, end: null, after: (ms, fn) => setTimeout(fn, ms) };
const later = (ms, fn) => play.after(ms, fn);

/** Wires the game to play.js: `start` and `end` are its startGame and endGame, `after` its round
 * timers. Called once, by app.js. */
export function setupSnowman({ start, end, after }) {
  Object.assign(play, { start, end, after });
}

/** Whether the yard shows winter now: the only time the snowman is offered. */
export const showsWinter = () => yardSeason(scene) === 'winter';

// Where a rolled ball keeps to, on the friends' field (the depth reaches down past it, as a gift's).
const LANE = 0.8;
const WAVE = 0.05;
const WAVE_EVERY = 0.6;
const TOP = 0.45;
// Yard pixels a pusher walks in a millisecond to get back behind the ball, and how near it has to
// be to push.
const PUSHER_SPEED = 0.25;
const TOUCH = 6;
const IN_FRONT = 3;
// Where a pusher stands behind the ball's edge, in friend widths, and how far back (yard pixels):
// the first with its paws on the ball, the second beside it a step farther back, so both faces
// and both name tags show.
const BEHIND = [0.26, 0.66];
const BACK = [0, 20];
const SAY_EVERY_MS = 2000;
// The snow a press kicks up, by the angle each puff flies at.
const PUFFS = [-160, -125, -90, -55, -20];
const MOTION = { push: 220, settle: 260, appear: 200 };
// The two lines a friend says when building cannot start; outside winter the row is not shown.
const REFUSALS = ['snowman.built_today', 'snowman.full'];

const across = () => Math.max(1, field().width - EDGE * 2);
const deep = () => Math.max(1, field().bottom - field().top);
const baseWidth = () => giftSize(SNOWMAN).w * giftKind(SNOWMAN).stack[0];
function ballBox(size) {
  const [w, h] = artSize(giftKind(SNOWMAN).ball),
    width = size * baseWidth();
  return { w: width, h: (width * h) / w };
}
// A ball stays whole inside the yard, as a gift does.
function keepX(x, size) {
  const half = ballBox(size).w / 2 + 4;
  return clamp(x, (half - EDGE) / across(), (field().width - half - EDGE) / across());
}
const keepY = y => clamp(y, TOP, decorFloor());
const rolling = b => game?.kind === SNOWMAN && game.ball === b && game.stage === 'rolling';

// Plays a short animation on `node` again from its start, and takes its class off when it ends.
function motion(node, name) {
  node.classList.remove(name);
  void node.offsetWidth;
  node.classList.add(name);
  later(MOTION[name], () => node.classList.remove(name));
}

function draw(b) {
  const at = fieldToYard(b),
    { w, h } = ballBox(b.size);
  // A step in front of its pushers, whose toes would otherwise cover a small ball.
  setDown(b.button, at.x, at.y, w, h, depthAt(at.y) + IN_FRONT);
  return { ...at, w };
}

function newBall(target) {
  const [lo, hi] = rollRange(game.spot.x);
  const button = document.createElement('button'),
    art = document.createElement('span'),
    turn = document.createElement('span');
  button.type = 'button';
  button.className = 'snowball';
  button.setAttribute('aria-label', t('snowman.ball'));
  // The squash and the settle play on the art, the turning on the drawing inside it: the button's
  // own transform is where it stands (props.js setDown).
  art.className = 'snowball-art';
  turn.className = 'snowball-roll';
  turn.innerHTML = artSvg(giftKind(SNOWMAN).ball);
  art.append(turn);
  button.append(art);
  $('garden-layer').append(button);
  // It starts in the middle of the rolling half, rolling away from the stack.
  const b = {
    button,
    art,
    turn,
    x: (lo + hi) / 2,
    y: LANE,
    lane: LANE,
    rolled: 0,
    size: START,
    target,
    dir: game.spot.x >= 0.5 ? -1 : 1,
    angle: 0,
    drag: null,
  };
  draw(b);
  motion(art, 'appear');
  listen(b);
  return b;
}

// A press helps push, a drag rolls it toward the pointer, the arrow keys roll it a step and Enter
// or Space helps, as a press does.
function listen(b) {
  const { button } = b;
  button.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !rolling(b)) return;
    e.preventDefault();
    e.stopPropagation();
    b.drag = beginDrag(button, e, { x: b.x, y: b.y }, { width: across(), height: deep() });
  });
  button.addEventListener('pointermove', e => {
    if (!b.drag || !rolling(b)) return;
    const at = dragPoint(b.drag, e, b.drag.width, b.drag.height, decorFloor());
    if (!at) return;
    button.classList.add('dragging');
    b.drag.to = at;
  });
  button.addEventListener('pointerup', e => {
    const drag = endDrag(b, button, e);
    button.classList.remove('dragging');
    if (!drag || !rolling(b)) return;
    if (drag.moved) letGo(b);
    else help(performance.now());
  });
  // A drag that ends badly (the pointer taken away, or its capture lost without a pointerup) leaves
  // the ball where it is, for the friends. After a pointerup the drag is already over.
  const dropped = () => {
    if (!b.drag) return;
    b.drag = null;
    button.classList.remove('dragging');
    letGo(b);
  };
  button.addEventListener('pointercancel', dropped);
  button.addEventListener('lostpointercapture', dropped);
  button.addEventListener('dragstart', e => e.preventDefault());
  button.addEventListener('keydown', e => {
    if (!rolling(b)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return help(performance.now());
    }
    const step = KEY_STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const x = keepX(b.x + step[0] / across(), b.size),
      y = keepY(b.y + step[1] / deep());
    rolled(b, x, y, Math.hypot(x - b.x, y - b.y), performance.now());
    letGo(b);
  });
}

// The friends roll it on from where the person let it go.
function letGo(b) {
  b.lane = b.y;
  b.rolled = 0;
}

// The ball moved to (x, y), `distance` field widths: it grows by the way it went, turns, leaves its
// trail and, once full, goes up onto the stack.
function rolled(b, x, y, distance, now) {
  const before = fieldToYard(b);
  if (x !== b.x) b.dir = Math.sign(x - b.x);
  b.x = x;
  b.y = y;
  b.size = grow(b.size, distance, b.target);
  const at = draw(b);
  if (!reduced.matches) {
    b.angle += (at.x - before.x) / (at.w / 2);
    b.turn.style.transform = `rotate(${b.angle.toFixed(3)}rad)`;
  }
  trailStamp(at.x, at.y, at.w, now);
  if (b.size >= b.target) lift(now);
}

// A press: the ball grows a step and squashes, snow puffs up, and a pusher says something (not at
// every press).
function help(now) {
  const b = game.ball;
  b.size = push(b.size, b.target);
  const at = draw(b);
  if (!reduced.matches) {
    motion(b.art, 'push');
    puffs(at);
  }
  const v = views.get(game.ids[0]);
  if (v && now - game.saidAt >= SAY_EVERY_MS) {
    game.saidAt = now;
    bubble(v, pick(list('snowman.push')), 1500);
  }
  if (b.size >= b.target) lift(now);
}
function puffs(at) {
  const made = PUFFS.map(angle => {
    const puff = document.createElement('span');
    puff.className = 'snow-puff';
    puff.style.left = `${at.x}px`;
    puff.style.top = `${at.y}px`;
    puff.style.rotate = `${angle}deg`;
    puff.style.zIndex = String(depthAt(at.y) + 1);
    $('garden-layer').append(puff);
    return puff;
  });
  later(600, () => {
    for (const puff of made) puff.remove();
  });
}

// The pushers walk back behind the ball when it went on without them, and push it from there. True
// when one of them is close enough to push.
function pushers(b, dt) {
  const at = fieldToYard(b),
    w = ballBox(b.size).w;
  let touching = false;
  game.ids.slice(0, 2).forEach((id, i) => {
    const v = views.get(id);
    if (!v || v.drag || v.target) return;
    const spot = footTarget(v, at.x - b.dir * (w / 2 + sizeOf(v.pet) * BEHIND[i]), at.y - BACK[i]),
      box = geometry(v.pet),
      dx = (spot.x - v.x) * box.w,
      gap = Math.hypot(dx, (spot.y - v.y) * box.h),
      step = reduced.matches ? gap : PUSHER_SPEED * dt,
      k = gap <= step ? 1 : step / gap;
    v.x += (spot.x - v.x) * k;
    v.y += (spot.y - v.y) * k;
    place(v);
    const there = gap - step <= TOUCH;
    if (there) touching = true;
    if (!reduced.matches) pose(v, (there ? b.dir > 0 : dx >= 0) ? 'right' : 'left', 150);
  });
  return touching;
}

// The friends push it along the half of the field away from the stack, turning at either end, a
// little up and down as it goes.
function roll(b, dt, now) {
  const [lo, hi] = rollRange(game.spot.x);
  // Left outside the range by a drag, it is rolled back toward it.
  if (b.x < lo) b.dir = 1;
  else if (b.x > hi) b.dir = -1;
  const dir = b.dir;
  let x = b.x + (dir * rollSpeed(b.size) * dt) / 1000,
    turn = false;
  if ((dir > 0 && b.x <= hi && x >= hi) || (dir < 0 && b.x >= lo && x <= lo)) {
    x = dir > 0 ? hi : lo;
    turn = true;
  }
  x = keepX(x, b.size);
  const distance = Math.abs(x - b.x);
  b.rolled += distance;
  rolled(b, x, keepY(b.lane + WAVE * Math.sin((2 * Math.PI * b.rolled) / WAVE_EVERY)), distance, now);
  b.dir = turn ? -dir : dir;
}

// Toward where the pointer has dragged it, as fast as its weight allows.
function dragged(b, dt, now) {
  const next = dragStep(b, b.drag.to, b.size, dt),
    x = keepX(next.x, b.size),
    y = keepY(next.y);
  if (x === b.x && y === b.y) return;
  rolled(b, x, y, Math.hypot(x - b.x, y - b.y), now);
}

// Where ball `i` rests on the stack, in yard pixels: its foot, and its depth in front of the one
// below. The base stands where the built snowman's base ball will.
function stackPoint(i) {
  const foot = fieldToYard(game.spot),
    size = giftSize(SNOWMAN);
  return {
    x: foot.x,
    y: foot.y - giftKind(SNOWMAN).stack[1] * size.h - stackBottoms(BALLS)[i] * baseWidth(),
    z: depthAt(foot.y) + i,
  };
}
function setOnStack(b, i, at = stackPoint(i)) {
  const { w, h } = ballBox(BALLS[i]);
  setDown(b.button, at.x, at.y, w, h, at.z);
}

// A full ball goes up in an arc onto the stack; with reduced motion it is there at once.
function lift(now) {
  const b = game.ball;
  b.drag = null;
  b.button.classList.remove('dragging');
  b.button.classList.add('lifting');
  if (reduced.matches) return land(now);
  game.stage = 'lifting';
  game.lift = { from: { x: b.x, y: b.y }, at: now };
}
function lifting(now) {
  const b = game.ball,
    i = game.stack.length,
    k = (now - game.lift.at) / LIFT_MS,
    to = stackPoint(i),
    at = liftPoint(fieldToYard(game.lift.from), to, k, 0.6 * baseWidth());
  setOnStack(b, i, { ...at, z: to.z });
  // It turns back upright on the way up, so the stack is lit as the snowman will be.
  const upright = Math.round(b.angle / (2 * Math.PI)) * 2 * Math.PI;
  b.turn.style.transform = `rotate(${(b.angle + (upright - b.angle) * Math.min(1, k)).toFixed(3)}rad)`;
  if (k >= 1) land(now);
}
function land(now) {
  const b = game.ball,
    i = game.stack.length;
  b.size = BALLS[i];
  b.button.classList.remove('lifting');
  b.button.classList.add('stacked');
  b.button.tabIndex = -1;
  b.turn.style.transform = '';
  b.button.setAttribute('aria-hidden', 'true');
  setOnStack(b, i);
  motion(b.art, reduced.matches ? 'appear' : 'settle');
  game.stack.push(b);
  if (game.stack.length === BALLS.length) return finish(now);
  const focused = document.activeElement === b.button;
  game.ball = newBall(BALLS[game.stack.length]);
  game.stage = 'rolling';
  if (focused) game.ball.button.focus();
  const v = views.get(game.ids[1]) ?? views.get(game.ids[0]);
  if (v) bubble(v, pick(list('snowman.more')), 2500);
}
// The third ball is on: the stack stands, and the game waits there.
function finish() {
  game.stage = 'done';
  game.ball = null;
}

// The friends who do not push stand by the stack, on the side away from the rolling, a row of three
// and the next row a step behind.
function watch(ids) {
  const foot = stackPoint(0),
    side = game.spot.x >= 0.5 ? 1 : -1;
  ids.forEach((id, k) => {
    const v = views.get(id);
    if (!v) return;
    const x = foot.x + side * (baseWidth() * 0.6 + sizeOf(v.pet) * (0.55 + 0.7 * (k % 3))),
      y = foot.y - 14 * Math.floor(k / 3);
    sendTo(v, footTarget(v, x, y), { save: false, speed: 0.0004 });
  });
}

/** The window changed size: a drag ends where the ball is, and the balls stand again in the new
 * yard (the trail is cleared by snow-trail.js resizeTrail). */
export function resizeSnowman() {
  if (game?.kind !== SNOWMAN) return;
  const b = game.ball;
  if (b?.drag) {
    b.drag = null;
    b.button.classList.remove('dragging');
    letGo(b);
  }
  if (b && game.stage === 'rolling') draw(b);
  game.stack.forEach((s, i) => setOnStack(s, i));
}

/** The game's rules for play.js (RULES.snowman). */
export const snowmanGame = {
  icon: 'snow',
  shown: showsWinter,
  // Why building is not offered now, as a key of the friends' lines, or null.
  needs() {
    const why = snowmanOffer({
      date: new Date(),
      season: yardSeason(scene),
      garden: data.garden,
      decorMax: limit(data, 'decor'),
    });
    return why && `snowman.${why}`;
  },
  refused(key, lead) {
    const v = views.get(lead);
    if (v && REFUSALS.includes(key)) bubble(v, pick(list(key)), 3000);
  },
  start(_now, lead) {
    const date = new Date(),
      season = yardSeason(scene),
      // The stack goes where the yard has room among what it shows.
      shown = (data.garden?.decor ?? []).filter(d => decorShown(d.kind, date, season));
    Object.assign(game, { spot: stackSpot(shown), stack: [], stage: 'rolling', saidAt: -Infinity, lift: null });
    game.ball = newBall(BALLS[0]);
    watch(game.ids.slice(2));
    bubble(views.get(lead), pick(list('snowman.start')), 3000);
    game.hint = t('snowman.hint_roll');
  },
  frame(now, dt) {
    const b = game.ball;
    if (game.stage === 'lifting') lifting(now);
    else if (game.stage === 'rolling') {
      const touching = pushers(b, dt);
      if (b.drag?.to) dragged(b, dt, now);
      else if (!b.drag && touching) roll(b, dt, now);
    }
    trailFrame(now);
  },
  // Stopped at any point: every ball and what came with them go, the trail fades back into the
  // snow, and a day the finish had counted but not yet saved (`dayBefore`) is given back.
  end(over) {
    for (const node of $('garden-layer').querySelectorAll('.snowball, .snow-puff, .snowman-preview, .snow-sparkle'))
      node.remove();
    for (const node of $('garden-layer').querySelectorAll('.melting')) node.classList.remove('melting');
    if (over.dayBefore !== undefined && !over.saved && data.garden) data.garden.snowmanDay = over.dayBefore;
    fadeTrail();
  },
};
