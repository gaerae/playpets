// The desktop overlay page, one per monitor: it draws the friends the backend places on this
// monitor and reports presses and drags. Positions, drags and strolls are worked out in overlay.rs.

import { lookAt } from '../core/animation.js';
import { styledAsset } from '../core/appearance.js';
import { follow, language, t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { displayName } from '../core/names.js';
import { setupSeason, southern } from '../core/season.js';
import { canvas, crown, drawSprite, reduced, setSpriteSeason } from '../core/sprites.js';
import { recall } from '../core/state.js';
import { stateOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { every, everyMinute } from '../core/ticker.js';

document.documentElement.lang = language();
const api = window.playPets,
  displayId = window.__DISPLAY,
  views = new Map();
// A look lasts this long after the last pointer move: the window gets no pointerleave once
// the cursor is off the friend and the window is click-through again.
const LOOK_MS = 400;
// The name button stays a moment after the pointer leaves, so it can be reached from the friend.
const NAME_LINGER_MS = 600;
// Under the sprite, room for the name button (FOOT in overlay.rs, plus the sprite's own 4px).
const FOOT = 28;
let data = { pets: [], assets: [], statuses: {} },
  layout = [];
const nameOf = v => displayName(v.pet, v.asset, t('friend.default'));
const south = southern(Intl.DateTimeFormat().resolvedOptions().timeZone);
setupSeason({
  read: () => recall('season'),
  apply: season => {
    if (setSpriteSeason(season)) render();
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
  // Right click (or Enter) opens the app too, as in the yard.
  button.oncontextmenu = e => {
    e.preventDefault();
    api.openChat(pet.id);
  };
  button.onkeydown = e => {
    if (e.key === 'Enter') api.openChat(pet.id);
  };
  return view;
}
function render() {
  const local = layout.filter(p => p.displayId === displayId);
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
    if (!v) {
      v = create(pet);
      views.set(pet.id, v);
    }
    v.pet = pet;
    v.asset = styledAsset(
      data.assets.find(a => a.id === pet.assetId),
      pet.visualStyle,
    );
    v.status = stateOf(data, pet.id);
    v.wrap.style.visibility = 'visible';
    v.wrap.style.width = `${position.width}px`;
    v.wrap.style.height = `${position.height}px`;
    v.wrap.style.transform = `translate(${position.x - position.origin.x}px,${position.y - position.origin.y}px)`;
    // Roaming pets face the way they walk (positions stream in via layout events).
    if (v.lastX !== undefined && Math.abs(position.x - v.lastX) > 0.5 && !v.drag) {
      v.pose = position.x >= v.lastX ? 'right' : 'left';
      v.until = performance.now() + 220;
    }
    v.lastX = position.x;
    const height = (pet.size * 208) / 192;
    v.sprite.style.width = `${pet.size}px`;
    v.sprite.style.height = `${height}px`;
    // How much screen there is above the sprite: near the top edge the bubble slides down over
    // the sprite rather than off the screen.
    const room = position.y - position.origin.y + position.height - FOOT - height;
    v.button.style.setProperty('--room', `${Math.max(0, Math.round(room))}px`);
    v.button.setAttribute('aria-label', t('yard.pat_name', { name: nameOf(v) }));
    v.talk.querySelector('.talk-name').textContent = nameOf(v);
    v.talk.title = t('friend.talk', { name: nameOf(v) });
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
  render();
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
  for (const [id, v] of views) {
    if (event.petId && event.petId !== id) continue;
    if (event.type === 'status') {
      v.status = event.state;
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
  for (const v of views.values()) {
    if (!v.asset) continue;
    const state = now < v.until ? v.pose : v.status;
    const look = state === 'idle' && v.look && now - v.lookedAt < LOOK_MS && !v.drag ? v.look : null;
    // Standing animations share one clock, so still friends change cells together (fewer
    // redraws of the see-through window); a pose runs from when it began.
    drawSprite(v.sprite, v.asset, state, now < v.until ? now - v.since : now, look);
    crown(v.button, v.asset, (v.pet.size * 208) / 192); // the cell is 192×208
  }
}
const result = await api.bootstrap();
if (result.ok) {
  data = result.data;
  // A language chosen in the yard reaches this window too (the page starts over in it).
  follow(data.language);
  layout = data.desktopLayout;
  render();
  // Standing cells last 110-320 ms, so ten frames a second show every one of them.
  every(100, animate);
}
