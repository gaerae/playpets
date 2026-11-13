// Decorations friends bring as gifts: a bench, a lantern, a birdhouse, a little pond, a mailbox,
// a picnic blanket (what there is, how each is drawn and its effects: catalog.json). A friend sets
// its gift down beside it; the person drags it wherever they like, or puts it away from its menu
// (right-click, or Delete). Friends visit them on their own and say something that fits. The
// backend keeps them and decides which gift comes next (src-tauri/src/pets/garden.rs); when one is
// due is in growth.js. Drawn once, like plants: nothing here moves on its own, and the lantern's
// glow is a still layer the evening shows. The Christmas tree's night layers, inside its button,
// are christmas-night.js's.

import { openDecorMenu } from '../core/controls.js';
import { list, t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { between, clamp, pick } from '../core/math.js';
import { systemSouth } from '../core/season.js';
import { aiming, call, data, game, guard, name, views } from '../core/state.js';
import { cadence } from '../core/ticker.js';
import { artSvg } from './art.js';
import { befriend, levelOf } from './bond.js';
import { showCard } from './card.js';
import { giftKind } from './catalog.js';
import { giftSvg } from './creatures.js';
import { decorShown, hiddenKinds, yardSeason } from './decor-shown.js';
import { dressLayers } from './dress-layers.js';
import { effectLayers, effectsVisited } from './effects.js';
import { giftEvent } from './events.js';
import { decorFloor, depthAt, EDGE, field, fieldToYard, footTarget, petHeight, sizeOf, yardToDecor } from './field.js';
import { FIRST_GIFT, GIFT_WAIT, giftDue, giftWait, localDay } from './growth.js';
import {
  beginDrag,
  dragPoint,
  endDrag,
  KEY_STEPS,
  moveSaved,
  propButton,
  reconcile,
  removeWithUndo,
  setDown,
  giftSize as size,
} from './props.js';
import { wornDress } from './snowman-dress.js';
import { cue } from './sound.js';
import { forPerson, isFree, rest, sendTo } from './trips.js';
import { bubble, cheer, effect } from './views.js';
import { blocked } from './workspace.js';
import { scene } from './world.js';

const flat = kind => !!giftKind(kind)?.flat;
const standOn = kind => giftKind(kind)?.stand === 'on';
const shown = new Map();
// Gifts that just came, shown with a little pop the first time they are drawn.
const fresh = new Set();
// The pop's length (garden.css .decor.arrive): after it the class goes, or a later change to the
// button's animations would play it again.
const ARRIVE_MS = 600;
/** Marks a gift as just come, so its next drawing pops it into place. */
export const markFresh = id => fresh.add(id);
const kindName = kind => t(`decor.kind_${kind}`);
// The name a gift goes by as drawn now: the Christmas tree is called grand while it stands grand.
const shownName = (kind, button) =>
  button.classList.contains('xmas-grand') ? t(`decor.kind_${kind}_grand`) : kindName(kind);
// Called at the end of every drawing of the gifts (setupDecor).
let afterDrawing = () => {};
// What a press on a kind does instead of sending a friend over (setupDecor): kind -> (id) => void,
// a view it opens, or { take: (id) => boolean }, asked first and true when it took the press.
let presses = {};
const pressOf = kind => (Object.hasOwn(presses, kind) ? presses[kind] : null);
// A kind whose press opens its own view: named as one to decorate.
const opensView = kind => typeof pressOf(kind) === 'function';
// A press that did not move: the kind's own view, or what takes it, or the nearest friend walks over.
const took = v => (opensView(v.kind) ? (pressOf(v.kind)(v.id), true) : !!pressOf(v.kind)?.take(v.id));
const pressed = v => took(v) || visit(v.id);
// A mark a kind wears (markDecor): kind -> its data-mark, kept through every drawing.
const marks = new Map();
const showMark = (button, kind) => {
  if (marks.has(kind)) button.dataset.mark = marks.get(kind);
  else delete button.dataset.mark;
};
// The kinds out of sight when the yard last drew its gifts (decor-shown.js), joined.
let drawnHidden = null;
// The list last sent to the backend, so the desktop hears of a change once, not at every repaint.
let toldDesktop = null;
// A memento's heart shows for a day after it came; after that only while it is pointed at, chosen
// or dragged (garden.css), so a yard full of mementos is not covered in hearts.
const MEMENTO_NEW_MS = 86_400_000;
let heartsFade = null;

function placement(kind, point) {
  // A gift friends stand on stays where they can reach it (footTarget keeps them on their field);
  // others go down to just above the dock.
  const across = fieldToYard({ x: point.x, y: 0 }).x,
    at = fieldToYard({ x: point.x, y: Math.min(point.y, standOn(kind) ? 1 : decorFloor(across)) }),
    { w, h, foot } = size(kind, at);
  // Saved coordinates locate the foot; wide furniture still needs room at either edge.
  at.x = clamp(at.x, w / 2 + 4, field().width - w / 2 - 4);
  return { ...at, w, h, foot };
}
// In a room a gift is not set down inside the furniture, as a stroll does not end there
// (workspace.js blocks): neither its foot nor the ends of its base may be on it.
const standsFree = at => [-0.4, 0, 0.4].every(side => !blocked(at.x + side * at.w, at.y));
/** Where a gift is drawn, in yard pixels: its foot (x, y) and its size (w, h). */
export const decorPlacement = d => placement(d.kind, d);
// Where a gift is drawn, as a place: a place past the edge a wide gift cannot reach is kept as
// where it stops, so dragging it back moves it at once.
const drawnPlace = (kind, point) => {
  const at = placement(kind, point);
  return yardToDecor(at.x, at.y);
};
function position(v, x, y) {
  const at = placement(v.kind, { x, y });
  setDown(v.button, at.x, at.y, at.w, at.h, flat(v.kind) ? 0 : depthAt(at.y), at.foot);
  return at;
}

function create(d) {
  const button = propButton('decor', d.kind),
    gift = giftKind(d.kind),
    effects = gift?.effects || [];
  if (effects.length) button.dataset.effects = effects.join(' ');
  button.innerHTML = `${effectLayers(effects)}${gift ? artSvg(gift.art) : ''}`;
  // A drawing with no ground of its own stands on a contact shade, under it (garden.css); one on
  // spread feet has a small dark one under each foot, over a wide soft one under it all.
  if (gift?.shade) {
    const shade = document.createElement('span'),
      [w, h, y, x] = gift.shade;
    shade.className = gift.feet ? 'decor-shade wide' : 'decor-shade';
    shade.style.setProperty('--shade-w', String(w));
    shade.style.setProperty('--shade-h', String(h));
    shade.style.setProperty('--shade-y', String(y));
    // A foot off the middle of the drawing (a kite's stand) keeps its shade under it.
    if (x !== undefined) shade.style.setProperty('--shade-x', String(x));
    const feet = (gift.feet || []).map(([fx, fy, fw]) => {
      const foot = document.createElement('span');
      foot.className = 'decor-foot';
      foot.style.setProperty('--foot-x', String(fx));
      foot.style.setProperty('--foot-y', String(fy));
      foot.style.setProperty('--foot-w', String(fw));
      return foot;
    });
    const first = button.firstChild;
    for (const node of [shade, ...feet]) button.insertBefore(node, first);
  }
  const v = { id: d.id, kind: d.kind, button, drag: null, busy: false, dressLayer: null, worn: null };
  // What a snowman wears, over its drawing (snowman-dress.js); the update fills it.
  if (gift?.dress) {
    v.dressLayer = document.createElement('span');
    v.dressLayer.className = 'dress-layers';
    button.append(v.dressLayer);
  }
  // Dragging moves it; a press that does not move opens its view (the Christmas tree's decorating)
  // or sends the nearest friend over to it.
  button.addEventListener('pointerdown', e => {
    // Placing a seed or a treat, the press goes through to the field.
    if (e.button !== 0 || aiming || game || v.busy) return;
    e.preventDefault();
    e.stopPropagation();
    const current = data.garden?.decor.find(item => item.id === v.id),
      f = field();
    if (!current) return;
    const from = drawnPlace(v.kind, current);
    v.drag = beginDrag(button, e, from, {
      width: Math.max(1, f.width - EDGE * 2),
      height: Math.max(1, f.bottom - f.top),
      foot: fieldToYard(from),
      toField: yardToDecor,
    });
  });
  button.addEventListener('pointermove', e => {
    const drag = v.drag;
    if (!drag) return;
    const at = dragPoint(drag, e, drag.width, drag.height, decorFloor());
    if (!at) return;
    button.classList.add('dragging');
    drag.at = at;
    drag.free = standsFree(position(v, at.x, at.y));
    button.classList.toggle('invalid', !drag.free);
  });
  const drop = event => {
    const drag = endDrag(v, button, event);
    button.classList.remove('dragging', 'invalid');
    if (!drag) return;
    if (!drag.moved) return pressed(v);
    // Let go on the furniture, it goes back where it stood.
    if (drag.at && !drag.free) return renderDecor();
    if (drag.at) return save(v.id, drawnPlace(v.kind, drag.at));
  };
  button.addEventListener('pointerup', drop);
  button.addEventListener('pointercancel', () => {
    v.drag = null;
    button.classList.remove('dragging', 'invalid');
    renderDecor();
  });
  button.addEventListener('dragstart', event => event.preventDefault());
  // Its menu: out to the desktop, or put away.
  button.addEventListener('contextmenu', e => {
    e.preventDefault();
    openDecorMenu(v.id, { x: e.clientX, y: e.clientY });
  });
  // By keyboard: arrows move it a few pixels, the same in any window or place; Delete puts it away;
  // the menu key or Shift+F10 opens its menu, as a friend's does; Enter or Space opens a kind's own
  // view, or gives the press to what takes it, as a press does (no friend is sent by key). Aiming a
  // treat or seed, or in a game, the keys leave it alone, as they do a tree and as a press does.
  button.addEventListener('keydown', e => {
    if (aiming || game) return;
    if ((e.key === 'Enter' || e.key === ' ') && took(v)) return e.preventDefault();
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      const r = button.getBoundingClientRect();
      return openDecorMenu(v.id, { x: r.left, y: r.bottom });
    }
    const step = KEY_STEPS[e.key];
    if (step) {
      e.preventDefault();
      const d = data.garden?.decor.find(x => x.id === v.id);
      if (!d) return;
      const at = placement(v.kind, d),
        to = drawnPlace(v.kind, yardToDecor(at.x + step[0], at.y + step[1]));
      if (standsFree(placement(v.kind, to))) save(v.id, to);
    } else if (e.key === 'Delete' || e.key === 'Backspace') putAway(v.id);
  });
  return v;
}
// Kept here at once so it does not jump back while the backend saves it.
const save = guard(async (id, at) => {
  const d = data.garden?.decor.find(x => x.id === id);
  const view = shown.get(id);
  if (!d || !view || view.busy) return;
  await moveSaved(view, d, at, {
    send: () => call('moveDecor', id, at.x, at.y),
    current: () => data.garden?.decor.find(item => item.id === id),
    show: renderDecor,
    settle: renderDecor,
  });
});

/** `drawn` runs after every drawing of the gifts (the Christmas tree's night, christmas-night.js);
 * `press` maps a kind to what a press on it opens (the Christmas tree's decorating view), or to
 * `{ take(id) }`, asked first and true when it took the press (the mailbox with a letter in it). */
export function setupDecor({ drawn = () => {}, press = {} } = {}) {
  afterDrawing = drawn;
  presses = press;
  globalThis.window?.addEventListener('resize', () => {
    for (const view of shown.values()) {
      view.drag = null;
      view.button.classList.remove('dragging');
    }
    renderDecor();
  });
}

/** Brings the yard's decorations in line with the backend's garden. */
export function renderDecor() {
  const make = d => {
    const v = create(d);
    if (fresh.delete(d.id)) {
      v.button.classList.add('arrive');
      setTimeout(() => v.button.classList.remove('arrive'), ARRIVE_MS);
    }
    return v;
  };
  const now = Date.now(),
    date = new Date(now);
  let fadeAt = Infinity;
  const season = yardSeason(scene);
  const hidden = hiddenKinds(date, season);
  drawnHidden = hidden.join();
  tellDesktop(hidden);
  // A kind out of sight is left out, not taken away: it keeps its place for when it shows.
  const decor = (data.garden?.decor || []).filter(d => decorShown(d.kind, date, season));
  reconcile(shown, decor, make, (v, d) => {
    if (!v.drag?.moved) position(v, d.x, d.y);
    const until = d.memento && d.came_at ? d.came_at + MEMENTO_NEW_MS : 0;
    if (until > now) fadeAt = Math.min(fadeAt, until);
    v.button.classList.toggle('memento-new', until > now);
    const from = d.memento && data.pets.find(p => p.id === d.from);
    const kind = shownName(d.kind, v.button);
    const label = from
      ? t('decor.memento_title', { name: name(from), kind })
      : t(opensView(d.kind) ? 'decor.title_decorate' : 'decor.title', { kind });
    v.button.classList.toggle('memento', !!d.memento);
    showMark(v.button, d.kind);
    v.button.title = label;
    v.button.setAttribute('aria-label', label);
    const worn = v.dressLayer && wornDress(d);
    if (worn && worn.join() !== v.worn) {
      v.worn = worn.join();
      v.dressLayer.innerHTML = dressLayers(d.kind, worn);
    }
  });
  // One timer for the next heart to fade, not a check every frame.
  clearTimeout(heartsFade);
  heartsFade = fadeAt < Infinity ? setTimeout(renderDecor, fadeAt - now) : null;
  afterDrawing();
}
/** The decoration of `kind` the yard draws now (not one put away and waiting out its Undo): its
 * button, and its foot point and size in yard pixels. Null when there is none. */
export function shownDecor(kind) {
  for (const v of shown.values()) {
    if (v.kind !== kind || v.button.hidden) continue;
    const d = data.garden?.decor.find(item => item.id === v.id);
    if (d) return { button: v.button, at: placement(kind, d) };
  }
  return null;
}
/** Sets `mark` as the data-mark of every `kind` the yard draws, now and when drawn again (the
 * letter waiting in the mailbox, garden.css); null takes it off. */
export function markDecor(kind, mark) {
  if (mark) marks.set(kind, mark);
  else marks.delete(kind);
  for (const v of shown.values()) if (v.kind === kind) showMark(v.button, kind);
}
/** The button the yard draws now for the gift `id` (not one put away and waiting out its Undo), or
 * null. */
export function decorButton(id) {
  const v = shown.get(id);
  return v && !v.button.hidden ? v.button : null;
}
/** Redraws the gifts when what is out of sight changed since they were drawn (the date or the
 * season), called with the scene's minute repaint rather than every frame. */
export function refreshShownDecor() {
  const hidden = hiddenKinds(new Date(), yardSeason(scene));
  if (hidden.join() !== drawnHidden) renderDecor();
  else tellDesktop(hidden);
}
// The desktop leaves the same kinds out, so nothing unseen there draws or catches clicks. A send
// that failed is tried again at the next minute's check; one that fails after a newer list went
// out leaves that newer one standing.
function tellDesktop(hidden) {
  const sent = hidden.join();
  if (sent === toldDesktop) return;
  toldDesktop = sent;
  call('hideDecor', hidden).catch(() => {
    if (toldDesktop === sent) toldDesktop = null;
  });
}

// Sends a friend to a decoration: onto the bench or the blanket, beside the others; `own` when the
// friend chose to go.
function walkTo(v, d, own = false) {
  const at = placement(d.kind, d),
    dw = at.w,
    width = sizeOf(v.pet),
    side = v.px + width / 2 < at.x ? -1 : 1,
    on = standOn(d.kind),
    x = on ? at.x + (Math.random() - 0.5) * dw * 0.4 : at.x + side * (dw / 2 + width * 0.3),
    y = at.y + (on ? 3 : 0);
  sendTo(v, footTarget(v, x, y), { slow: true, own, arrive: () => visited(v, d.kind) });
}
function visit(id) {
  const d = data.garden?.decor.find(x => x.id === id);
  if (!d || game) return;
  const at = placement(d.kind, d),
    v = forPerson(at.x, at.y);
  if (v) walkTo(v, d);
}
/** Now and then an idle friend goes to a decoration instead of strolling: the target, or null. */
export function decorTarget(v) {
  // Only what the yard draws: a hidden gift has no spot to visit.
  const decor = (data.garden?.decor || []).filter(d => shown.has(d.id));
  if (!decor.length || Math.random() > 0.25) return null;
  walkTo(v, pick(decor), true);
  return v.target;
}
// A friend reached the decoration it went to.
function visited(v, kind) {
  effectsVisited(giftKind(kind)?.effects, { cue });
  if (kind && Math.random() < 0.6) bubble(v, pick(list(`decor.visit_${kind}`)), 3000);
}

// Put away at once with a moment to undo it (props.js); a friend may bring it again another day,
// and a memento or a Christmas gift goes back into the gift box instead.
/** Puts a gift away, with a moment to take it back (its menu, or Delete). */
export function putAway(id) {
  const d = data.garden?.decor.find(x => x.id === id),
    view = shown.get(id);
  if (!d || !view) return;
  // With the box full it goes as any gift does (garden.rs put_away).
  const boxed = (d.memento || !!giftKind(d.kind)?.shown) && (data.garden.boxed?.length ?? 0) < limit(data, 'giftBox');
  // A snowman is not kept: it melts (garden.rs put_away).
  const done = giftKind(d.kind)?.built
    ? t('decor.snowman_put_away')
    : t(boxed ? 'decor.memento_put_away' : 'decor.put_away_done', { kind: kindName(d.kind) });
  // Drawn again at once and when it comes back, so what the yard shows of it follows (the
  // Christmas tree lets go of its night, and comes back grand without the change).
  removeWithUndo(id, view, done, () => call('putAway', id), renderDecor);
  renderDecor();
}

// A friend brings a gift on its own: an everyday one every other day, from a friend the person
// did something with that day, and one for each level it grows closer (its memento at 4). A gift
// that finds the yard full waits in the gift box (album.js). The wait for the next everyday gift
// is the backend's (garden giftWait), so a restart keeps it.
const GIFT_RETRY_MS = 60 * 1000;
// A thanks gift comes a little after the level it is for, and never two at once.
const THANKS_AFTER = [60 * 1000, 3 * 60 * 1000];
const thanking = cadence(() => between(Math.random, THANKS_AFTER));
let bringing = false,
  retryAt = 0;
// A thanks gift the backend refused (friend id:level -> when it may be asked again) waits a while,
// so a failed save neither repeats every frame nor loses the gift until the page reloads.
const THANKS_RETRY_MS = 10 * 60 * 1000;
const refused = new Map();
const togetherToday = (id, day) => data.bonds?.[id]?.day === day && data.bonds[id].today > 0;
const full = g => (g.decor?.length ?? 0) >= limit(data, 'decor') && (g.boxed?.length ?? 0) >= limit(data, 'giftBox');
// The level a friend brings its next thanks gift for: the one after the last it brought, so a
// level reached while the yard and the box were full still comes. A friend with none brought yet
// brings one for where it is (it may have been close before thanks gifts began).
function thanksLevel(g, id) {
  const level = levelOf(id),
    had = g.thanked?.[id];
  return had === undefined ? level : Math.min(level, had + 1);
}

/** When the next everyday gift may come: the saved wait, or a new one saved now. */
function giftDueAt(g, now, today) {
  const after = g.giftDay || '',
    first = !g.received?.length,
    saved = g.giftWait;
  // A clock correction keeps the wait bounded instead of retaining a far-future deadline, and a
  // wait from an earlier day starts again, so a gift never comes the moment someone plays.
  const longest = first ? FIRST_GIFT : GIFT_WAIT[1];
  if (
    saved?.after === after &&
    Number.isSafeInteger(saved.dueAt) &&
    saved.dueAt <= now + longest &&
    localDay(new Date(saved.dueAt)) >= today
  )
    return saved.dueAt;
  const dueAt = Math.ceil(now + giftWait(Math.random, first));
  // Kept here at once so the next frame does not ask again before the backend's state comes back.
  g.giftWait = { after, dueAt };
  call('waitForGift', after, dueAt).catch(() => {});
  return dueAt;
}

/** Called by the frame loop while the yard is seen and no game is on; deadlines use wall time. */
export function giftTick() {
  const g = data.garden;
  if (!g || bringing || full(g)) return;
  const now = Date.now(),
    today = localDay(new Date(now));
  if (now < retryAt || !giftDue(g.giftDay, today, limit(data, 'giftEveryDays'))) return;
  // The wait starts once the person has done something with a friend that day.
  const together = [...views.values()].filter(v => togetherToday(v.pet.id, today));
  if (!together.length || now < giftDueAt(g, now, today)) return;
  const free = together.filter(isFree);
  if (!free.length) return;
  const v = pick(free);
  // During an event, the gift is its own the first time (the backend checks the dates). A calendar
  // festival counts whatever the yard shows; a seasonal one needs the scene to show it.
  const event = giftEvent(new Date(now), systemSouth(), scene.event);
  const ask = at => call('receiveGift', at.x, at.y, today, event, v.pet.id);
  bring(v, ask, { say: 'decor.gift', detail: 'decor.brought' }).then(ok => {
    if (ok) befriend(v.pet.id, 'gift');
    // A failed save must not replay the gift and its request on every frame.
    else retryAt = Date.now() + GIFT_RETRY_MS;
  });
}

/** Called by the frame loop beside giftTick: a friend that grew closer brings a gift for its level. */
export function thanksTick(now) {
  const g = data.garden;
  if (!g || bringing || full(g) || !thanking.due(now)) return;
  const wall = Date.now(),
    today = localDay(new Date(wall));
  // Like an everyday gift, it comes on a day the person did something with that friend.
  const v = [...views.values()].find(v => {
    const level = thanksLevel(g, v.pet.id);
    return (
      isFree(v) &&
      togetherToday(v.pet.id, today) &&
      level > (g.thanked?.[v.pet.id] ?? 1) &&
      !(wall < refused.get(`${v.pet.id}:${level}`))
    );
  });
  if (!v) return;
  const level = thanksLevel(g, v.pet.id);
  const ask = at => call('thanksGift', v.pet.id, level, at.x, at.y, today);
  bring(v, ask, { say: 'decor.gift_thanks', detail: 'decor.brought_thanks' }).then(ok => {
    if (!ok) refused.set(`${v.pet.id}:${level}`, Date.now() + THANKS_RETRY_MS);
  });
}

/** What the card says of a gift that came (`detail` for an everyday or thanks gift set out). */
export function broughtCard(d, detail) {
  if (d.memento) return d.boxed ? 'decor.brought_memento_boxed' : 'decor.brought_memento';
  return d.boxed ? 'decor.brought_boxed' : detail;
}

// A friend sets a gift down beside it (`ask` gets the spot and asks the backend) and says `say`;
// the card says `detail`, or where it went. Resolves to whether it came.
function bring(v, ask, { say, detail }) {
  rest(v);
  // Set down beside the friend, on the side with more room.
  const width = sizeOf(v.pet),
    right = v.px + width / 2 < field().width / 2,
    at = yardToDecor(v.px + width / 2 + (right ? 1 : -1) * width * 0.9, v.py + petHeight(v.pet));
  bringing = true;
  const seen = new Set(data.garden?.received || []);
  return ask(at)
    .then(d => {
      cheer(v, d.memento ? 'decor.gift_memento' : say, { mark: '', say: 3500 });
      if (!d.boxed) {
        markFresh(d.id);
        renderDecor();
      }
      cue('gift');
      effect(v, d.memento ? '♥' : '✦');
      const gift = giftKind(d.kind),
        said = { name: name(v.pet), kind: kindName(d.kind) };
      if (gift) showCard(giftSvg(gift), kindName(d.kind), t(broughtCard(d, detail), said), !seen.has(d.kind), 'gift');
      return true;
    })
    .catch(() => false)
    .finally(() => {
      bringing = false;
    });
}
