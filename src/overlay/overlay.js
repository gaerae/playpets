// The desktop overlay page, one per monitor: it draws the friends the backend places on this
// monitor and reports presses and drags. Positions, drags and strolls are worked out in overlay.rs.

import { lookAt } from '../core/animation.js';
import { follow, language, t } from '../core/i18n.js';
import { displayName } from '../core/names.js';
import { canvas, crown, drawSprite } from '../core/sprites.js';
import { stateOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { every } from '../core/ticker.js';

document.documentElement.lang = language();
const api = window.playPets,
  displayId = window.__DISPLAY,
  views = new Map();
// A look lasts this long after the last pointer move: the window gets no pointerleave once
// the cursor is off the friend and the window is click-through again.
const LOOK_MS = 400;
let data = { pets: [], assets: [], statuses: {} },
  layout = [];
function create(pet) {
  const wrap = document.createElement('div');
  wrap.className = 'friend-wrap';
  wrap.dataset.id = pet.id;
  const button = document.createElement('button');
  button.className = 'friend';
  button.setAttribute('aria-label', t('overlay.pat'));
  // No name tag on the desktop: pets blend into the desk, the name lives in the app.
  const sprite = canvas(),
    bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.hidden = true;
  button.append(bubble, sprite);
  wrap.append(button);
  document.getElementById('friends').append(wrap);
  const view = {
    wrap,
    button,
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
  button.onpointerup = async e => {
    const moved = view.drag?.moved;
    view.drag = null;
    await api.dragStop();
    if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
    if (!moved) await api.play('pet', pet.id);
  };
  // Left click pets, drag moves; only right click (or Enter) opens the app, so
  // repositioning never pops the window from an accidental double click.
  button.onpointercancel = () => {
    view.drag = null;
    api.dragStop();
  };
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
    v.asset = data.assets.find(a => a.id === pet.assetId);
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
    const room = position.y - position.origin.y + position.height - 4 - height;
    v.button.style.setProperty('--room', `${Math.max(0, Math.round(room))}px`);
    v.button.setAttribute(
      'aria-label',
      t('overlay.pat_name', { name: displayName(pet, v.asset, t('friend.default')) }),
    );
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
