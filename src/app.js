import { openControls, openFriendMenu, setupControls } from './core/controls.js';
import { setupInteractions } from './core/interactions.js';
import { setupBackgrounds } from './yard/background-ui.js';

// Entry point: sets every part of the page up in order, listens to the backend, and runs the frame loop.
// No other module does anything when it is imported; each has a setup function, called here.

import { setupCompanionActions } from './core/companion-actions.js';
import { confirmAction, setupConfirm } from './core/confirm.js';
import { apply, follow, t } from './core/i18n.js';
import { icons } from './core/icons.js';
import { onShortcut } from './core/keys.js';
import { setupNotices } from './core/notices.js';
import { setSpriteSeason } from './core/sprites.js';
import {
  $,
  aiming,
  api,
  call,
  data,
  game,
  guard,
  pet,
  recallRun,
  selected,
  setData,
  setupToast,
  toast,
  views,
} from './core/state.js';
import { fadedBetween } from './core/status.js';
import { clip, plain, spoken } from './core/text.js';
import { every, everyMinute } from './core/ticker.js';
import { openAlbum, renderAlbum, setupAlbum } from './panel/album.js';
import { chatEvent, refreshChat, setupChat } from './panel/chat.js';
import { setupConnection } from './panel/connection.js';
import { setupFriendSettings } from './panel/friend-settings.js';
import { drawPortrait, select, setupFriend } from './panel/friend.js';
import { drawPreviews, invite, setupInvite } from './panel/invite.js';
import {
  announceInstalledUpdate,
  checkForUpdates,
  setupSettings,
  showSection,
  updateFound,
  updateStatus,
} from './panel/settings.js';
import { openInvite, openPanel, PANELS, setupTabs } from './panel/tabs.js';
import { render } from './render.js';
import { setupWindow } from './window.js';
import { befriend, bondTick, seen, setupBond } from './yard/bond.js';
import { setupCard } from './yard/card.js';
import { react, setupCare, startChatter } from './yard/care.js';
import { endFishing, setupCatch, soloFishing } from './yard/catch.js';
import { loadContent } from './yard/content.js';
import { giftTick, renderDecor, setupDecor, thanksTick } from './yard/decor.js';
import {
  autoDig,
  beginDiscovery,
  cancelDiscovery,
  cancelDiscoveryWork,
  canDigAt,
  digAt,
  setupDiscovery,
  syncDiscovery,
} from './yard/discovery.js';
import { renderGarden, setupGarden } from './yard/garden.js';
import { hint } from './yard/hint.js';
import { moveFriends } from './yard/motion.js';
import { renderTrees, setupTrees } from './yard/planted-trees.js';
import { endGame, gameTap, judge, playGame, setupPlay } from './yard/play.js';
import { idleChatter } from './yard/remarks.js';
import { setupSky } from './yard/sky.js';
import { cue, setupSound, soundSeen } from './yard/sound.js';
import { release } from './yard/trips.js';
import { bubble, place, setupViews, syncViews } from './yard/views.js';
import { drawWelcome, setupWelcome } from './yard/welcome.js';
import { scene, scenery } from './yard/world.js';

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
    const named = data.assets.find(a => a.id === asset)?.displayName;
    toast(t('invite.linked', { name: named || host }));
  } catch (e) {
    toast(t('invite.link_failed', { error: spoken(e, t('error.generic')) }), { error: true });
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

// The app's state first: the backgrounds (loadContent) and the place, season and weather picked
// (setupSky) are read from it, and whether this data folder owns the webview's old copies. A
// failure here is shown by the full start below.
setData(await call('bootstrap').catch(() => data));
// What the yard is made of (the catalogue, the scenery, the drawings), before anything is drawn.
await loadContent();
await setupCompanionActions();
// Words first: everything below builds its labels from them.
apply();
icons();
setupConfirm();
setupNotices();
setupToast();
setupInteractions();
setupWindow();
setupTabs({ beforeOpen: cancelDiscovery });
setupControls({
  openChat,
  canDigAt,
  digAt,
  digWith: id => {
    select(id);
    beginDiscovery('dig');
  },
  beforeOpen: () => {
    cancelDiscovery();
    syncDiscovery();
  },
});
// Keyboard: the panels and the two views, with the keys the macOS menu bar shows (core/keys.js).
onShortcut('controls', openControls);
// The friend the keyboard is on, if any: that is the one being asked for.
onShortcut('friends', () => {
  const focused = [...views].find(([, v]) => v.button === document.activeElement)?.[0];
  if (focused) select(focused);
  openPanel('pet');
});
onShortcut('invite', () => openPanel('invite'));
onShortcut('alwaysOnTop', () => $('always-on-top').click());
onShortcut('desktop', () => data.pets.length && guard(() => call('toggleDesktop'))());
setupSky({
  seasonChanged: season => {
    if (setSpriteSeason(season) && data.assets.length) render();
    else renderAlbum();
  },
  seasonPicked: endFishing,
  // Another place: the game, the fishing and every trip end in the old one, then the friends, the
  // garden, the gifts and the hint are laid out in the new one.
  worldChanged: enter => {
    cancelDiscovery();
    endGame();
    endFishing();
    for (const v of views.values()) {
      release(v);
      v.away = false;
    }
    enter();
    syncViews();
    renderGarden();
    renderDecor();
    renderTrees();
    syncDiscovery();
    hint();
  },
  // The land was drawn the other way (its picture, or the painted land when the picture could not
  // be loaded): the field may begin at another height (field.js fieldTop), so the fishing ends and
  // the friends, the garden and the gifts stand again on the land that shows.
  landChanged: () => {
    cancelDiscoveryWork();
    endFishing();
    for (const v of views.values()) place(v);
    renderGarden();
    renderDecor();
    renderTrees();
  },
});
setupBackgrounds();
setupViews({
  gameTap,
  patted: id => {
    befriend(id, 'pat');
    cue('pat');
  },
  select,
  openChat,
  friendMenu: openFriendMenu,
  resized: () => {
    cancelDiscoveryWork();
    endFishing();
    scenery.resize();
    renderGarden();
    renderDecor();
    renderTrees();
  },
});
setupPlay();
setupCare();
setupGarden();
setupDecor();
setupDiscovery();
setupTrees();
setupCatch();
setupAlbum();
setupCard({ openAlbum });
setupSound();
setupFriend();
setupChat();
setupConnection({
  // The first friend that can talk: with two or more, they start talking among themselves at once
  // (the thing no other pet app does); with one, the chat box is ready for a first word.
  first: guard(async able => {
    refreshChat();
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
  }),
});
setupFriendSettings({ refresh });
setupInvite({ refresh });
setupWelcome({ invite, more: openInvite });
setupSettings();

api.onChange(next => {
  const old = selected,
    ai = pet()?.providerId;
  setData(next);
  render();
  // What the log says before a first word depends on whether the friend has an AI.
  if (old !== selected || ai !== pet()?.providerId) refreshChat();
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
// With Let them dig on, an idle friend digs a spot of its own every few minutes while the yard is
// shown; a game or a tool in the person's hand comes first (yard/discovery.js autoDig).
const AUTO_PLAY_MS = 4 * 60 * 1000;
setInterval(() => {
  if (data.autoPlay && shown) autoDig();
}, AUTO_PLAY_MS);
// A finished agent's state fades after a while (core/status.js): the page looks each minute, and
// is drawn again only when one did, so a picker or an open album is not rebuilt under the person.
let looked = Date.now();
everyMinute(() => {
  if (data.garden?.trees?.length) {
    call('growTrees').catch(console.error);
    renderTrees();
  }
  const now = Date.now();
  if (fadedBetween(data, looked, now)) render();
  looked = now;
});
// Speech bubbles from one conversation are spaced out by this much.
const BUBBLE_GAP = 1200;
let lastBubbleAt = 0;
function speak(event) {
  const v = views.get(event.petId);
  if (v) bubble(v, event.message);
}
// What each event from the backend does on this page; the chat panel hears every one first.
const ON_EVENT = {
  'open-controls': openControls,
  update: e => updateFound(e.update),
  'check-update': () => guard(checkForUpdates)(),
  'update-status': updateStatus,
  'open-panel': e => showSection(e.panel, e.section),
  select: e => openChat(e.petId),
  'import-request': e => importRequested(e.url),
  // A friend's saved place changed; the view already stands there, the record follows.
  'pet-moved': e => {
    const p = data.pets.find(q => q.id === e.petId);
    if (p) Object.assign(p, { x: e.x, y: e.y });
  },
  say: speak,
  status: e => e.source === 'agent' && speak(e),
  'chat-message': e => {
    const v = views.get(e.petId);
    // Answers that arrive together are shown one after another, so a group chat reads as one.
    const wait = Math.max(0, lastBubbleAt + BUBBLE_GAP - Date.now());
    lastBubbleAt = Date.now() + wait;
    if (v) setTimeout(() => bubble(v, clip(plain(e.message), 80)), wait);
  },
  play: react,
  window: e => {
    shown = e.shown;
    seen(shown);
    soundSeen(shown);
    // CSS animations (the clouds) rest too; see base.css.
    document.documentElement.toggleAttribute('data-unseen', !shown);
  },
};
api.onEvent(event => {
  chatEvent(event);
  if (Object.hasOwn(ON_EVENT, event.type)) ON_EVENT[event.type](event);
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
// What goes on in the yard between games, looked at every frame: each knows when it is due.
const YARD_LIFE = [idleChatter, giftTick, thanksTick, soloFishing];
let last = 0;
function interval(now) {
  if (game || aiming) return BUSY_MS;
  for (const v of views.values()) if (v.target || v.drag || now < v.until) return BUSY_MS;
  // Weather sets the pace only where it falls (not in a room without windows, nor with reduced motion).
  if (scenery.busy()) return scene.weather === 'snow' ? SNOW_MS : RAIN_MS;
  return CALM_MS;
}
function animate(now) {
  if (document.hidden || !shown) return CALM_MS;
  const dt = Math.min(120, now - last);
  last = now;
  judge(now);
  moveFriends(now, dt);
  // Time together counts in games too; the rest of yard life waits for a game to end.
  bondTick(now);
  if (game) playGame(now, dt);
  else for (const tick of YARD_LIFE) tick(now);
  scenery.frame(now, dt);
  // Panel pictures move only while their panel is visible.
  if (!$('empty-yard').hidden && !$('welcome').hidden) drawWelcome(now);
  if (!$('side-panel').hidden) {
    if (!$('panel-pet').hidden) drawPortrait(now);
    if (!$('panel-invite').hidden) drawPreviews(now);
  }
  return interval(now);
}
try {
  // Record growth during closed time before the first tree and album are drawn.
  await call('growTrees').catch(error => toast(spoken(error, t('error.start')), { error: true }));
  setData(await call('bootstrap'));
  follow(data.language);
  const saved = recallRun('panel');
  // A first start opens on the yard alone: its card shows the starter pets.
  openPanel(PANELS.includes(saved) ? saved : null);
  render();
  setupBond();
  refreshChat();
  announceInstalledUpdate();
  last = performance.now();
  every(BUSY_MS, animate);
} catch (e) {
  toast(spoken(e, t('error.start')), { error: true });
}
