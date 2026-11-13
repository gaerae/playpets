import { poseClock } from '../core/animation.js';
import { setupInteractions } from '../core/interactions.js';
// The desktop overlay page, one per monitor: it draws the friends, gifts, flowers and planted trees
// the backend places on this monitor and reports presses and drags. Positions, drags and strolls are worked out in
// overlay.rs; a right click asks the backend for its menu (menu.rs desktop_choices).

import { lookAt } from '../core/animation.js';
import { styledAsset } from '../core/appearance.js';
import { follow, language, list, t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { pick } from '../core/math.js';
import { displayName } from '../core/names.js';
import { setupSeason, systemSouth } from '../core/season.js';
import { canvas, crown, drawSprite, reduced, setSpriteSeason, sheetReady } from '../core/sprites.js';
import { sceneValue } from '../core/state.js';
import { applyStatus, fadedBetween, stateOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { every, everyMinute, halt, moveTo } from '../core/ticker.js';
import { useCatalog } from '../yard/catalog.js';
import { dressDecor, drawDecor, holdDecor, settleDecor } from './decor-view.js';
import { glideMs } from './glide.js';
import { visitKey } from './growing.js';

setupInteractions();
document.documentElement.lang = language();
const api = window.playPets,
  displayId = window.__DISPLAY,
  views = new Map(),
  // Gifts, flowers and planted trees out on the desktop: nothing on them moves; a flower or a tree
  // is drawn again when it grows, and what a gift wears changes with the garden.
  decorations = new Map();
// The catalogue the yard draws gifts, flowers and trees by, and what gifts wear.
const catalogue = fetch('content/catalog.json')
  .then(r => r.json())
  .then(useCatalog)
  .catch(() => {});
// A look lasts this long after the last pointer move: the window gets no pointerleave once
// the cursor is off the friend and the window is click-through again.
const LOOK_MS = 400;
// The name button stays a moment after the pointer leaves, so it can be reached from the friend.
const NAME_LINGER_MS = 600;
// Under the sprite, room for the name button (FOOT in overlay.rs, plus the sprite's own 4px).
const FOOT = 28;
let data = { pets: [], assets: [], statuses: {} },
  layout = [];
// Runs the next frame now (core/ticker.js every): a friend just come out is drawn at once, also
// after the loop rested with nobody on this screen.
let drawNow = () => {};
const nameOf = v => displayName(v.pet, v.asset, t('friend.default'));
const south = systemSouth();
// The season the yard shows, which a grown tree wears here too.
let season = null;
const seasonChanged = setupSeason({
  // As the yard reads it (yard/sky.js): a season the app could not save is still in the webview.
  read: () => sceneValue('season', data),
  apply: next => {
    const turned = next !== season;
    season = next;
    if (setSpriteSeason(next) || turned) render();
    if (turned) redress();
  },
  minute: everyMinute,
  south,
});
function create(pet) {
  const wrap = document.createElement('div');
  wrap.className = 'friend-wrap';
  wrap.dataset.id = pet.id;
  const button = document.createElement('button');
  button.className = 'friend';
  // Friends blend into the desk: the name shows only while the pointer is on one, as a button
  // that opens a conversation, so talking needs no hidden gesture.
  const sprite = canvas(),
    bubble = document.createElement('div'),
    talk = document.createElement('button');
  bubble.className = 'bubble';
  bubble.hidden = true;
  talk.className = 'talk';
  talk.innerHTML = '<span data-icon="chat"></span><span class="talk-name"></span>';
  icons(talk);
  talk.onclick = () => api.openChat(pet.id);
  button.append(bubble, sprite);
  wrap.append(button, talk);
  document.getElementById('friends').append(wrap);
  const view = {
    wrap,
    button,
    talk,
    sprite,
    bubble,
    pet,
    asset: null,
    status: 'idle',
    pose: 'idle',
    until: 0,
    since: 0,
    drag: null,
    timer: null,
    look: null,
    lookedAt: 0,
  };
  button.onpointerdown = async e => {
    if (e.button !== 0) return;
    view.drag = { x: e.screenX, y: e.screenY, moved: false };
    // Held, it follows the pointer with no glide behind it.
    halt(wrap);
    wrap.classList.remove('named');
    button.setPointerCapture(e.pointerId);
    await api.dragStart(pet.id);
  };
  button.onpointermove = e => {
    if (view.drag) {
      if (Math.hypot(e.screenX - view.drag.x, e.screenY - view.drag.y) > 5) {
        view.drag.moved = true;
        view.pose = e.screenX >= view.drag.x ? 'right' : 'left';
        view.until = performance.now() + 150;
      }
      return;
    }
    // As in the yard: a resting friend follows the pointer with its eyes (v2 sheets have the
    // frames). The window stops getting events once the pointer leaves the friend, so the look
    // also expires on its own (see animate).
    view.look = lookAt(button.getBoundingClientRect(), e.clientX, e.clientY);
    view.lookedAt = performance.now();
  };
  button.onpointerleave = () => {
    view.look = null;
  };
  // Only the press that started a drag ends one: a right click (which opens the chat) is not a pat.
  button.onpointerup = async e => {
    if (!view.drag) return;
    const moved = view.drag.moved;
    view.drag = null;
    await api.dragStop();
    if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
    if (!moved) await api.play('pet', pet.id);
  };
  button.onpointercancel = () => {
    view.drag = null;
    api.dragStop();
  };
  // A right click (or the menu key) offers talking and taking the friend off the desktop; Enter talks.
  button.oncontextmenu = e => {
    e.preventDefault();
    api.desktopMenu(pet.id);
  };
  button.onkeydown = e => {
    if (e.key === 'Enter') api.openChat(pet.id);
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) api.desktopMenu(pet.id);
  };
  return view;
}
// Gifts, flowers and trees out here, brought in line with the garden, the season, the yard's night
// and the clock (decor-view.js): when one of those changed, never for a friend's step.
const night = () => data.nightDecor || [];
function redress() {
  for (const v of decorations.values()) dressDecor(v, data.garden, season, new Date(), night());
}
// A gift, a flower or a planted tree out on the desktop: dragged to move, and its menu takes it off
// the desktop.
function createDecor(id, kind) {
  const wrap = document.createElement('div'),
    button = document.createElement('button');
  wrap.className = 'decor-wrap';
  button.className = 'decor';
  wrap.append(button);
  document.getElementById('friends').append(wrap);
  const view = {
    id,
    wrap,
    button,
    kind,
    drag: null,
    growing: false,
    look: null,
    drawn: false,
    worn: null,
    dressLayer: null,
    // Where it is drawn, when a drag of it last ended, and its fall to the floor (settleDecor).
    at: null,
    dropped: 0,
    fall: null,
  };
  button.onpointerdown = async e => {
    if (e.button !== 0) return;
    view.drag = true;
    holdDecor(view);
    button.setPointerCapture(e.pointerId);
    await api.dragStart(id);
  };
  button.onpointerup = async e => {
    if (!view.drag) return;
    view.drag = null;
    view.dropped = performance.now();
    await api.dragStop();
    if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
  };
  button.onpointercancel = () => {
    view.drag = null;
    view.dropped = performance.now();
    api.dragStop();
  };
  button.oncontextmenu = e => {
    e.preventDefault();
    api.desktopMenu(id);
  };
  button.onkeydown = e => {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) api.desktopMenu(id);
  };
  return view;
}
function renderDecor(local) {
  for (const [id, v] of decorations)
    if (!local.some(p => p.id === id)) {
      if (v.drag) {
        v.wrap.style.visibility = 'hidden';
        continue;
      }
      v.wrap.remove();
      decorations.delete(id);
    }
  for (const position of local) {
    let v = decorations.get(position.id);
    if (!v) {
      v = createDecor(position.id, position.decor);
      decorations.set(position.id, v);
    }
    // Drawn once the catalogue says what it is; until then each render asks again (cheap).
    if (!v.drawn)
      catalogue.then(() =>
        drawDecor(
          v,
          () => data.garden,
          () => season,
          night,
        ),
      );
    v.wrap.style.visibility = 'visible';
    v.wrap.style.width = `${position.width}px`;
    v.wrap.style.height = `${position.height}px`;
    settleDecor(v, position.x - position.origin.x, position.y - position.origin.y, reduced.matches);
  }
}
function render() {
  const here = layout.filter(p => p.displayId === displayId),
    local = here.filter(p => !p.decor);
  renderDecor(here.filter(p => p.decor));
  for (const [id, v] of views)
    if (!local.some(p => p.id === id)) {
      // Preserve pointer capture in the source display during a cross-display drag.
      if (v.drag) {
        v.wrap.style.visibility = 'hidden';
        continue;
      }
      clearTimeout(v.timer);
      v.wrap.remove();
      views.delete(id);
    }
  for (const position of local) {
    const pet = data.pets.find(p => p.id === position.id);
    if (!pet) continue;
    let v = views.get(pet.id);
    const arrived = !v;
    if (!v) {
      v = create(pet);
      views.set(pet.id, v);
    }
    v.pet = pet;
    v.asset = styledAsset(
      data.assets.find(a => a.id === pet.assetId),
      pet.visualStyle,
    );
    // Drawn now, and again the moment its sheet is in rather than at the next frame.
    if (arrived && v.asset) {
      drawNow();
      sheetReady(v.asset).then(() => drawNow());
    }
    v.status = stateOf(data, pet.id);
    v.wrap.style.visibility = 'visible';
    // A stroll glides from step to step (glide.js); a held friend follows the pointer on whichever
    // screen it is, and with reduced motion a friend is set down where it goes.
    moveTo(
      v.wrap,
      'transform',
      [position.x - position.origin.x, position.y - position.origin.y],
      glideMs(v, position, reduced.matches),
    );
    // Roaming pets face the way they walk (positions stream in via layout events).
    if (v.lastX !== undefined && Math.abs(position.x - v.lastX) > 0.5 && !v.drag) {
      v.pose = position.x >= v.lastX ? 'right' : 'left';
      v.until = performance.now() + 220;
    }
    v.lastX = position.x;
    const height = (pet.size * 208) / 192;
    // How much screen there is above the sprite: near the top edge the bubble slides down over
    // the sprite rather than off the screen.
    const room = Math.max(0, Math.round(position.y - position.origin.y + position.height - FOOT - height));
    if (room !== v.room) {
      v.room = room;
      v.button.style.setProperty('--room', `${room}px`);
    }
    // A walk streams positions many times a second; the rest changes only with the friend itself,
    // so it is written only then.
    // Its own key: `look` is where the friend's eyes turn.
    const name = nameOf(v),
      shape = `${position.width}x${position.height}|${pet.size}|${name}`;
    if (shape === v.shape) continue;
    v.shape = shape;
    v.wrap.style.width = `${position.width}px`;
    v.wrap.style.height = `${position.height}px`;
    v.sprite.style.width = `${pet.size}px`;
    v.sprite.style.height = `${height}px`;
    v.button.setAttribute('aria-label', t('yard.pat_name', { name }));
    v.talk.querySelector('.talk-name').textContent = name;
    v.talk.title = t('friend.talk', { name });
    v.talk.setAttribute('aria-label', v.talk.title);
    v.talk.style.maxWidth = `${Math.max(96, pet.size + 24)}px`;
  }
}
// The friend under the pointer (the backend tells, see overlay.rs) shows its name button.
let unname = null;
function showName(id) {
  clearTimeout(unname);
  if (id) {
    for (const [key, v] of views) v.wrap.classList.toggle('named', key === id && !v.drag);
    return;
  }
  unname = setTimeout(() => {
    for (const v of views.values()) v.wrap.classList.remove('named');
  }, NAME_LINGER_MS);
}
// Hearts for a pat, as in the yard; a treat or a wave says it in words only.
function hearts(v) {
  if (reduced.matches) return;
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = '♥';
    heart.style.left = `${50 + (i - 1) * 12}%`;
    heart.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}px`);
    heart.style.animationDelay = `${i * 90}ms`;
    v.wrap.append(heart);
    setTimeout(() => heart.remove(), 1300 + i * 90);
  }
}
function say(v, message) {
  v.bubble.textContent = plain(message);
  v.bubble.hidden = !message;
  clearTimeout(v.timer);
  v.timer = setTimeout(() => (v.bubble.hidden = true), 6000);
}
api.onChange(next => {
  data = next;
  layout = next.desktopLayout;
  seasonChanged();
  render();
  redress();
});
api.onEvent(event => {
  if (event.type === 'layout') {
    layout = event.layout;
    render();
    return;
  }
  if (event.type === 'hover') {
    showName(event.petId);
    return;
  }
  // Kept for every friend, also one on another monitor now: it may walk over here later.
  if (event.type === 'status') applyStatus(data, event);
  for (const [id, v] of views) {
    if (event.petId && event.petId !== id) continue;
    // A friend that strolled over to a gift, a flower or a tree says something that fits it, as in
    // the yard.
    if (event.type === 'visit') say(v, pick(list(visitKey(event.kind))) || '');
    if (event.type === 'status') {
      v.status = stateOf(data, id);
      say(v, event.message);
    }
    if (event.type === 'say') say(v, event.message);
    if (event.type === 'play') {
      v.pose = event.action === 'wave' ? 'wave' : 'jump';
      v.until = performance.now() + 1400;
      v.since = performance.now();
      if (event.action === 'pet') hearts(v);
      say(v, event.action === 'treat' ? t('care.yum') : event.action === 'wave' ? t('care.hello') : t('care.happy'));
    }
  }
});
function animate(now) {
  // Nobody on this screen (its window is kept a while, overlay.rs LINGER): no frames until one comes.
  if (!views.size) return Infinity;
  for (const v of views.values()) {
    if (!v.asset) continue;
    const state = now < v.until ? v.pose : v.status;
    const look = state === 'idle' && v.look && now - v.lookedAt < LOOK_MS && !v.drag ? v.look : null;
    // Standing animations share one clock, so still friends change cells together (fewer
    // redraws of the see-through window); a pose runs from when it began.
    const elapsed = now - v.since;
    const clock = now < v.until ? (Number.isFinite(v.until) ? poseClock(state, elapsed) : elapsed) : now;
    drawSprite(v.sprite, v.asset, state, clock, look);
    crown(v.button, v.asset, (v.pet.size * 208) / 192); // the cell is 192×208
  }
}
const result = await api.bootstrap();
if (result.ok) {
  data = result.data;
  // A language chosen in the yard reaches this window too (the page starts over in it).
  follow(data.language);
  layout = data.desktopLayout;
  // Standing cells last 110-320 ms, so ten frames a second show every one of them.
  drawNow = every(100, animate);
  seasonChanged();
  render();
  // A finished agent's state fades after a while, as in the yard; nothing else here may draw the
  // friends again for hours, so the page looks each minute. A flower out here grows by the clock.
  let looked = Date.now();
  everyMinute(() => {
    redress();
    const now = Date.now();
    if (fadedBetween(data, looked, now)) render();
    looked = now;
  });
}
