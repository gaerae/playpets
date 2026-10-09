// Entry point: sets every part of the page up in order, listens to the backend, and runs the frame loop.
// No other module does anything when it is imported; each has a setup function, called here.

import { confirmAction, setupConfirm } from './core/confirm.js';
import { apply, follow, t } from './core/i18n.js';
import { icons } from './core/icons.js';
import { $, aiming, api, call, data, game, guard, recall, selected, setData, toast, views } from './core/state.js';
import { plain, spoken } from './core/text.js';
import { every } from './core/ticker.js';
import { setupAlbum } from './panel/album.js';
import { chatEvent, refreshChat, setupChat } from './panel/chat.js';
import { setupConnection } from './panel/connection.js';
import { drawPortrait, select, setupFriend } from './panel/friend.js';
import { setupFriendSettings } from './panel/friend-settings.js';
import { drawPreviews, invite, setupInvite } from './panel/invite.js';
import { checkForUpdates, setupSettings, showSection, updateFound, updateProgress } from './panel/settings.js';
import { openInvite, openPanel, PANELS, setupTabs } from './panel/tabs.js';
import { render } from './render.js';
import { isMini, setMini, setupWindow } from './window.js';
import { react, setupCare, startChatter } from './yard/care.js';
import { setupCatch } from './yard/catch.js';
import { giftTick, renderDecor } from './yard/decor.js';
import { gardenTick, renderGarden, setupGarden } from './yard/garden.js';
import { moveFriends } from './yard/motion.js';
import { gameTap, judge, playGame, setupPlay } from './yard/play.js';
import { idleChatter, scene, scenery, setupSky } from './yard/sky.js';
import { bubble, setupViews } from './yard/views.js';
import { drawWelcome, setupWelcome } from './yard/welcome.js';

// A playpets://import link: any web page can open one once the browser remembers the choice,
// so the person is asked before anything is downloaded. One request at a time.
let importing = false;
async function importRequested(url) {
  if (importing) return;
  importing = true;
  try {
    let host = url;
    try {
      host = new URL(url).host;
    } catch {}
    const sure = await confirmAction({
      title: t('invite.import_confirm'),
      body: t('invite.import_from', { host, url }),
      action: t('invite.import'),
      danger: false,
    });
    if (!sure) return;
    const asset = await call('importUrl', url);
    openPanel('invite');
    toast(t('invite.linked', { name: asset?.displayName || host }));
  } catch (e) {
    toast(t('invite.link_failed', { error: spoken(e, t('error.generic')) }));
  } finally {
    importing = false;
  }
}
// Whether the yard can be seen; the backend says so for a window it hid or that was minimized.
let shown = true;
// Reloads everything from the backend, for actions that need the page current right away.
async function refresh() {
  setData(await call('bootstrap'));
  render();
  refreshChat();
}
function openChat(id) {
  select(id);
  openPanel('pet');
  $('message').focus();
}

// Words first: everything below builds its labels from them.
apply();
icons();
setupConfirm();
setupWindow();
setupTabs();
// Keyboard: the panels and the two views, with the keys the macOS menu bar shows (View menu). On a
// Mac the menu bar takes the switches' keys, so the page answers them only elsewhere.
const onMac = /Mac/.test(navigator.platform);
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const key = e.key.toLowerCase();
  if (!e.shiftKey && (key === '1' || key === '2')) {
    e.preventDefault();
    openPanel(key === '1' ? 'pet' : 'invite');
  } else if (e.shiftKey && !onMac && data.pets.length && (key === 'm' || key === 'd')) {
    e.preventDefault();
    guard(() => (key === 'm' ? setMini(!isMini()) : call('toggleDesktop')))();
  }
});
setupSky();
setupViews({
  gameTap,
  select,
  openChat,
  resized: () => {
    scenery.resize();
    renderGarden();
    renderDecor();
  },
});
setupPlay();
setupCare();
setupGarden();
setupCatch();
setupAlbum();
setupFriend();
setupChat();
setupConnection({
  // The first friend that can talk: with two or more, they start talking among themselves at once
  // (the thing no other pet app does); with one, the chat box is ready for a first word.
  first: async able => {
    // A word was waiting to be sent (written before the AI was there): it goes now, nothing else.
    if ($('message').value.trim()) return;
    if (able >= 2) {
      toast(t('toast.connected_many', { count: able }));
      await startChatter();
    } else {
      openPanel('pet');
      $('message').focus();
      toast(t('toast.first_chat'));
    }
  },
});
setupFriendSettings({ refresh });
setupInvite({ refresh });
setupWelcome({ invite, more: openInvite });
setupSettings();

api.onChange(next => {
  const old = selected;
  setData(next);
  render();
  if (old !== selected) refreshChat();
});
// The friends chat among themselves every so often when the setting is on: not while the window
// is hidden, not while someone is answering, and only with two friends who have an AI.
const AUTO_CHATTER_MS = 20 * 60 * 1000;
setInterval(() => {
  if (!data.autoChatter || !shown || data.busy.length) return;
  if (data.pets.filter(p => p.providerId).length < 2) return;
  // A round that could not start (someone left, an AI went away) is not worth a toast.
  startChatter().catch(() => {});
}, AUTO_CHATTER_MS);
// A finished agent's state fades after a while (core/status.js): the page looks again each minute.
setInterval(() => {
  if (Object.values(data.statuses).some(s => s.at)) render();
}, 60 * 1000);
// Speech bubbles from one conversation are spaced out by this much.
const BUBBLE_GAP = 1200;
let lastBubbleAt = 0;
api.onEvent(event => {
  chatEvent(event);
  if (event.type === 'update') updateFound(event.update);
  if (event.type === 'check-update') guard(checkForUpdates)();
  if (event.type === 'update-progress') updateProgress(event.percent);
  if (event.type === 'open-panel') showSection(event.panel, event.section);
  // The tray's "Mini view": the page goes in or out of it, as its own button does.
  if (event.type === 'mini' && (event.on ? data.pets.length : isMini())) guard(() => setMini(event.on))();
  if (event.type === 'select') openChat(event.petId);
  if (event.type === 'import-request') importRequested(event.url);
  // A friend's saved place changed; the view already stands there, the record follows.
  if (event.type === 'pet-moved') {
    const p = data.pets.find(q => q.id === event.petId);
    if (p) Object.assign(p, { x: event.x, y: event.y });
  }
  if (event.type === 'say' || (event.type === 'status' && event.source === 'agent')) {
    const v = views.get(event.petId);
    if (v) bubble(v, event.message);
  }
  if (event.type === 'chat-message') {
    const v = views.get(event.petId);
    // Answers that arrive together are shown one after another, so a group chat reads as one.
    const wait = Math.max(0, lastBubbleAt + BUBBLE_GAP - Date.now());
    lastBubbleAt = Date.now() + wait;
    if (v) setTimeout(() => bubble(v, plain(event.message).slice(0, 80)), wait);
  }
  if (event.type === 'play') react(event);
  if (event.type === 'window') {
    shown = event.shown;
    // CSS animations (the clouds) rest too; see base.css.
    document.documentElement.toggleAttribute('data-unseen', !shown);
  }
});

// Twenty frames a second while a friend moves (a walk, a pose, a game, a treat being placed),
// fifteen in rain and while birds or a shooting star cross, twelve in snow, ten while the friends
// only stand and blink: every frame that changes a canvas costs a whole screen update. None at all
// while the window cannot be seen: macOS says so through document.hidden, and the backend says so
// for a window it hid or that was minimized.
const BUSY_MS = 50,
  RAIN_MS = 66,
  SNOW_MS = 80,
  CALM_MS = 100;
let last = 0;
function interval(now) {
  if (game || aiming) return BUSY_MS;
  for (const v of views.values()) if (v.target || v.drag || now < v.until) return BUSY_MS;
  if (scene.weather === 'snow') return SNOW_MS;
  if (scene.weather === 'rain' || scenery.busy()) return RAIN_MS;
  return CALM_MS;
}
function animate(now) {
  if (document.hidden || !shown) return CALM_MS;
  const dt = Math.min(120, now - last);
  last = now;
  judge(now);
  moveFriends(now, dt);
  if (game) playGame(now, dt);
  else {
    idleChatter(now);
    gardenTick(now);
    giftTick(now);
  }
  scenery.frame(now, dt);
  // The panel's own pictures move only while they can be seen (the mini view hides the panel).
  if (!isMini() && !$('empty-yard').hidden && !$('welcome').hidden) drawWelcome(now);
  if (!isMini() && !$('side-panel').hidden) {
    if (!$('panel-pet').hidden) drawPortrait(now);
    if (!$('panel-invite').hidden) drawPreviews(now);
  }
  return interval(now);
}
try {
  setData(await call('bootstrap'));
  follow(data.language);
  const saved = recall('panel');
  // A first start opens on the yard alone: its card shows the starter pets.
  openPanel(PANELS.includes(saved) ? saved : null);
  render();
  if (recall('mini') && data.pets.length) await setMini(true);
  refreshChat();
  last = performance.now();
  every(BUSY_MS, animate);
} catch (e) {
  toast(spoken(e, t('error.start')));
}
