// Frequent yard actions have their own surface; the pointer menu delegates to the same handlers.

import { prepareCompanionAction } from './companion-actions.js';
import { t } from './i18n.js';
import { clamp } from './math.js';
import { dropdown, menuNavigation } from './menu.js';
import { canvas, drawStill } from './sprites.js';
import { $, aiming, call, data, game, guard, name, recall, remember, selected, toast, views } from './state.js';

let surfaces = [];
let showControls = null;
let showPlay = null;
let showFriendMenu = null;
let showDecorMenu = null;
let showGrowingMenu = null;
// A thing's bar sits this far from the thing (room for its notch), and its notch keeps this far from
// the bar's ends.
const BAR_GAP = 12,
  BAR_NOTCH = 18;
const yardFocus = button => (document.body.classList.contains('compact') ? $('yard') : button);

// The panels that open over the yard, by what each is for, so a panel added here is known to every
// module that has to keep clear of it.
/** The panels the dock opens over the yard. */
export const DOCK_PANELS = ['play-panel', 'yard-controls-panel', 'scene-menu'];
/** Everything a person works in over the yard: the side panel (Settings, a chat) and the dock's. */
export const OVER_YARD = ['side-panel', ...DOCK_PANELS];
// The dock's menus closeControls puts away, each with the button it opened from (the scene menu
// has closeScene).
const MENU_OPENERS = {
  'yard-controls-panel': 'yard-controls-toggle',
  'play-panel': 'play-button',
  'yard-context-menu': 'yard-controls-toggle',
};
/** The dock's menus closeControls puts away. */
export const CONTROL_MENUS = Object.keys(MENU_OPENERS);
/** Calls `fn` each time one of the panels `ids` opens or shuts. */
export function onPanelToggle(ids, fn) {
  if (!globalThis.MutationObserver) return;
  const observer = new MutationObserver(fn);
  for (const id of ids) if ($(id)) observer.observe($(id), { attributes: true, attributeFilter: ['hidden'] });
}

// Each panel opens in its one place above the dock, however it was reached (the dock, the right-click
// menu, a shortcut), so a person always finds it where it was last time.
/** Opens the panel in its corner above the dock. */
export function openControls() {
  showControls?.();
}
export function openPlay() {
  showPlay?.();
}
/** A friend's own right-click menu at a point in the window: talk, play, dig, the desktop, or its settings. */
export function openFriendMenu(id, point) {
  showFriendMenu?.(id, point);
}
/** Opens a gift's own menu (out to the desktop or dress it up, put away) at `point`. */
export function openDecorMenu(id, point) {
  showDecorMenu?.(id, point);
}
/** Opens a flower's own menu (out to the desktop, pull up) at `point`. */
export function openPlantMenu(id, point) {
  showGrowingMenu?.('plant', id, point);
}
/** Opens a planted tree's own menu (out to the desktop, remove) at `point`. */
export function openTreeMenu(id, point) {
  showGrowingMenu?.('tree', id, point);
}
/** The first time anything goes out on the desktop, how to talk to it and move it there. */
export function desktopTip() {
  if (recall('desktop-tip') === '1') return;
  remember('desktop-tip', '1');
  // Said once, so not under the panel the switch sits in.
  closeControls(false);
  toast(t('toast.desktop_tip'), {
    pictures: [
      { icon: 'tap-name', text: t('toast.desktop_chat') },
      { icon: 'drag', text: t('toast.desktop_move') },
      { icon: 'right-click', text: t('toast.desktop_off') },
    ],
  });
}
// One friend, gift, flower or planted tree, out to the desktop or back in (desktop/items.rs).
const sendOut = guard(async (id, on) => {
  await call('setOnDesktop', id, on);
  if (on) desktopTip();
});
export function closeUpdateDetails(focus = false) {
  const panel = $('update-dialog');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  for (const id of ['update-pill', 'update-compact']) $(id)?.setAttribute('aria-expanded', 'false');
  const trigger = $(document.body.classList.contains('compact') ? 'update-compact' : 'update-pill');
  const target = trigger && !trigger.hidden ? trigger : $('yard');
  if (focus) target?.focus();
  return target;
}
export function closeControls(focus = true) {
  let target = null;
  for (const [id, button] of Object.entries(MENU_OPENERS)) {
    const panel = $(id);
    if (!panel || panel.hidden) continue;
    const surface = surfaces.find(item => item.panel === panel);
    if (surface) target = surface.box.close();
    else {
      panel.hidden = true;
      $(button)?.setAttribute('aria-expanded', 'false');
      target = yardFocus($(button));
    }
  }
  target = closeUpdateDetails() || target;
  if (focus && target) target.focus();
}
export function closeScene() {
  if (!$('scene-menu')) return;
  $('scene-menu').hidden = true;
  $('scene-button').setAttribute('aria-expanded', 'false');
}

export function setupControls({
  beforeOpen = () => {},
  openChat = () => {},
  canDigAt = () => false,
  digAt = () => {},
  digWith = () => {},
  friendSettings = () => {},
  putAway = () => {},
  pullPlant = () => {},
  removeTree = () => {},
  dress = () => {},
  canDress = () => false,
  bloomChoice = () => null,
  setSingleBloom = async () => {},
  closeness = () => 0,
  letterReadable = () => false,
  openLetter = () => {},
} = {}) {
  surfaces = [];
  const closeOthers = (except, keepChat = false) => {
    beforeOpen();
    for (const surface of surfaces) if (surface.panel !== except) surface.box.close();
    closeUpdateDetails();
    closeScene();
    const side = $('side-panel');
    if (side && !side.hidden && !keepChat) $('close-panel').click();
  };
  const wire = (buttonId, panelId, toggleOnClick = true) => {
    const button = $(buttonId),
      panel = $(panelId);
    if (!button || !panel) return null;
    const box = dropdown(
      button,
      panel,
      () => {
        closeOthers(panel);
        panel.scrollTop = 0;
        for (const body of panel.querySelectorAll('.dock-panel-body')) body.scrollTop = 0;
        if (panelId === 'play-panel') renderPlay();

        // The game going on if there is one, else the first action in the page, not the head's Close.
        const visible = [...(panel.querySelector('.dock-panel-body') || panel).querySelectorAll('button')].find(
          action => !action.disabled && !action.hidden && action.getClientRects?.().length,
        );
        (
          panel.querySelector('.playing') ||
          visible ||
          panel.querySelector('.panel-tab') ||
          panel.querySelector('button:not(:disabled)')
        )?.focus();
      },
      () => yardFocus(button),
      { toggleOnClick, dismissOnTrigger: buttonId === 'yard' },
    );
    surfaces.push({ panel, box });
    return box;
  };
  const menu = wire('yard-controls-toggle', 'yard-controls-panel');
  const play = wire('play-button', 'play-panel', false);
  const renderPlay = () => {
    const pet = data.pets.find(p => p.id === selected) || data.pets[0];
    const asset = pet && views.get(pet.id)?.asset;
    for (const action of ['dig', 'plant', 'cast', 'wait', 'reel', 'discover']) prepareCompanionAction(asset, action);
    // The board is Play for all of it (the album, the picnic and the games are not one friend's);
    // the friend who digs, fishes and plants is the picture and the small name beside it.
    const who = $('play-who');
    if (who) {
      who.hidden = !pet;
      who.textContent = pet ? name(pet) : '';
    }
    const portrait = $('play-portrait');
    if (portrait) {
      portrait.hidden = !asset;
      if (asset) {
        const still = canvas();
        portrait.replaceChildren(still);
        drawStill(still, asset);
      }
    }
    $('play-empty').hidden = !!pet;
    $('play-sections').hidden = !pet;
    // Dig and Plant a tree also need soil; syncDiscovery (discovery.js) keeps those.
    for (const id of ['plant-tool', 'feed']) $(id).disabled = !pet || !!game;
  };
  showControls = () => menu?.open();
  showPlay = () => play?.open();
  $('play-button')?.addEventListener('click', () => {
    if (!$('play-panel').hidden) closeControls();
    else openPlay();
  });
  $('close-controls')?.addEventListener('click', () => closeControls());
  $('close-play')?.addEventListener('click', () => closeControls());
  const context = $('yard-context-menu'),
    yard = $('yard');
  if (context && yard) {
    // One menu, three sets of items: the scenery's (where to go), a friend's and a gift's (what to do with it).
    let point = { x: 8, y: 8 },
      friend = null;
    const items = menuNavigation(context);
    const row = action =>
      [...context.querySelectorAll('[data-context-action]')].find(item => item.dataset.contextAction === action);
    const digHere = () => row('dig-here');
    // The scenery's menu offers the year-end letter while there is one to read (letter.js).
    const showYard = () => {
      show('yard');
      const letter = row('letter');
      if (letter) letter.hidden = !letterReadable();
    };
    // What a gift's, a flower's or a planted tree's menu is about, in the garden's own list.
    const ownList = forWhat =>
      ({ decor: data.garden?.decor, plant: data.garden?.plants, tree: data.garden?.trees })[forWhat];
    const show = (forWhat, id = null) => {
      friend = id;
      for (const item of context.querySelectorAll('[data-context-for]'))
        item.hidden = item.dataset.contextFor !== forWhat;
      const pet = id && data.pets.find(p => p.id === id);
      // A thing's menu is a bar over it with its name on a plate; the scenery's stays a list at the
      // pointer, and so does every menu in a small window, where a row would not fit.
      const bar = forWhat !== 'yard' && !document.body.classList.contains('compact') && !!point.from;
      context.classList.toggle('thing-bar', bar);
      context.setAttribute('aria-orientation', bar ? 'horizontal' : 'vertical');
      const plate = [...context.children].find(child => child.classList?.contains('thing-plate'));
      const title = pet ? name(pet) : [point.from].flat()[0]?.dataset?.name || '';
      if (plate) plate.hidden = !bar || !title;
      if (plate && bar && title) {
        plate.querySelector('.thing-name').textContent = title;
        context.setAttribute('aria-label', title);
        const hearts = plate.querySelector('.thing-hearts'),
          level = pet ? closeness(id) : 0;
        hearts.hidden = !level;
        if (level) {
          hearts.dataset.level = String(level);
          hearts.setAttribute('aria-label', t(`bond.level_${level}`));
        }
      } else context.setAttribute('aria-label', t('controls.yard'));
      // On the bar the plate names the friend, so its choices say only what they do; the list says
      // whom each is with.
      if (pet) {
        const label = action => context.querySelector(`[data-context-action="${action}"] .context-label`),
          who = { name: name(pet) };
        label('talk').textContent = bar ? t('friend.talk_short') : t('friend.talk', who);
        label('play-friend').textContent = bar ? t('controls.play') : t('controls.play_with', who);
        const dig = label('dig-friend');
        if (dig) dig.textContent = bar ? t('discovery.dig_ask') : t('discovery.dig_with', who);
        const edit = label('settings-friend');
        if (edit) edit.textContent = t(bar ? 'friend.edit_short' : 'friend.edit');
      }
      const out = forWhat === 'friend' ? pet : ownList(forWhat)?.find(d => d.id === id);
      const check = [...context.querySelectorAll('[data-context-for]')].find(
        item => item.dataset.contextAction === `desktop-${forWhat}`,
      );
      check?.setAttribute('aria-checked', String(!!out?.onDesktop));
      // Not out yet: the desktop window it would land on gets ready while the menu is open, so
      // Show on desktop shows it at once (overlay.rs warm). Without it, it only shows a moment later.
      if (out && !out.onDesktop) call('warmDesktop', id).catch(() => {});
      // Only a snowman has things to wear (snowman-dress.js).
      if (forWhat === 'decor')
        for (const item of context.querySelectorAll('[data-context-for]'))
          if (item.dataset.contextAction === 'dress-decor') item.hidden = !canDress(id);
      // A flower in bloom with a planted patch blooms as one flower or as that patch, each shown.
      if (forWhat === 'plant') showBloomChoice(id);
      // Its choices come in one after another (shell.css).
      let order = 0;
      for (const item of context.querySelectorAll('[data-context-for]'))
        if (!item.hidden) item.style.setProperty('--order', String(order++));
    };
    const showBloomChoice = id => {
      const choice = bloomChoice(id);
      for (const [action, single] of [
        ['one-bloom', true],
        ['patch', false],
      ]) {
        const item = row(action);
        if (!item) continue;
        item.hidden = !choice;
        if (!choice) continue;
        item.setAttribute('aria-checked', String(choice.single === single));
        const picture = item.querySelector('.context-picture'),
          drawn = single ? choice.one : choice.patch;
        if (picture.dataset.drawn !== drawn) {
          picture.dataset.drawn = drawn;
          picture.innerHTML = drawn;
        }
      }
    };
    const place = () => {
      if (context.hidden) return;
      context.style.removeProperty('max-height');
      const { width, height } = context.getBoundingClientRect();
      if (context.classList.contains('thing-bar')) return placeBar(width, height);
      context.style.left = `${clamp(point.x, 8, innerWidth - width - 8)}px`;
      const top = clamp(point.y, 8, innerHeight - height - 8);
      context.style.top = `${top}px`;
      context.style.setProperty('max-height', `${innerHeight - top - 8}px`);
    };
    // Over the thing and its name tag, centred, with room for the notch; below them near the top,
    // slid in at the sides with the notch still pointing at the thing.
    const placeBar = (width, height) => {
      const plate = [...context.children].find(child => child.classList?.contains('thing-plate')),
        tall = plate && !plate.hidden ? plate.getBoundingClientRect().height : 0;
      const boxes = [point.from].flat().map(node => node.getBoundingClientRect());
      // What it must also not cover (a friend's line over its head), above and below only: the notch
      // points at the thing. A line not showing measures nothing.
      const clear = [point.clear ?? []]
        .flat()
        .map(node => node?.getBoundingClientRect())
        .filter(b => b?.width > 0 && b.height > 0);
      const around = {
        left: Math.min(...boxes.map(b => b.left)),
        right: Math.max(...boxes.map(b => b.right)),
        top: Math.min(...[...boxes, ...clear].map(b => b.top)),
        bottom: Math.max(...[...boxes, ...clear].map(b => b.bottom)),
      };
      const centre = (around.left + around.right) / 2,
        left = clamp(centre - width / 2, 8, innerWidth - width - 8);
      // The plate rides on the side away from the thing.
      let top = around.top - height - BAR_GAP;
      context.dataset.side = 'above';
      if (top - tall < 8) {
        top = Math.min(around.bottom + BAR_GAP, innerHeight - height - tall - 8);
        context.dataset.side = 'below';
      }
      context.style.left = `${Math.round(left)}px`;
      context.style.top = `${Math.round(top)}px`;
      const notch = clamp(centre - left, BAR_NOTCH, width - BAR_NOTCH);
      context.style.setProperty('--notch', `${Math.round(notch)}px`);
    };
    const box = dropdown(
      yard,
      context,
      () => {
        // Only a choice leaves the chat: each destination closes it, and Esc comes back to it.
        closeOthers(context, true);
        const pin = context.querySelector('[data-context-action="pin"]');
        pin?.setAttribute('aria-checked', $('always-on-top')?.getAttribute('aria-pressed') || 'false');
        context.scrollTop = 0;
        place();
        items()[0]?.focus();
      },
      () => {
        $('compact-launcher')?.setAttribute('aria-expanded', 'false');
        return yardFocus($('yard-controls-toggle'));
      },
      { toggleOnClick: false },
    );
    surfaces.push({ panel: context, box });
    yard.addEventListener('contextmenu', event => {
      if (
        event.defaultPrevented ||
        event.target.closest(
          'button,input,textarea,select,a,label,[contenteditable="true"],.yard-pet,.pet-tag,.plant,.decor,.planted-tree',
        )
      )
        return;
      event.preventDefault();
      point = { x: event.clientX, y: event.clientY };
      showYard();
      // Bare ground offers digging right there, without a trip through Play.
      const dig = digHere();
      if (dig) dig.hidden = !canDigAt(point.x, point.y);
      box.open();
    });
    // Small windows hide the dock; one corner button opens the same menu the scenery's right-click does.
    const launcher = $('compact-launcher');
    // A press outside the menu closes it before the click arrives, so the press remembers it was open.
    let wasOpen = false;
    launcher?.addEventListener('pointerdown', () => {
      wasOpen = !context.hidden;
    });
    launcher?.addEventListener('click', () => {
      if (wasOpen || !context.hidden) {
        wasOpen = false;
        if (!context.hidden) closeControls();
        return;
      }
      const r = launcher.getBoundingClientRect();
      point = { x: r.right, y: r.top - 8 };
      showYard();
      const dig = digHere();
      if (dig) dig.hidden = true;
      box.open();
      launcher.setAttribute('aria-expanded', 'true');
    });
    showFriendMenu = (id, at) => {
      point = at;
      show('friend', id);
      box.open();
    };
    showDecorMenu = (id, at) => {
      point = at;
      show('decor', id);
      box.open();
    };
    showGrowingMenu = (forWhat, id, at) => {
      point = at;
      show(forWhat, id);
      box.open();
    };
    context.addEventListener('click', event => {
      const action = event.target.closest('[data-context-action]')?.dataset.contextAction;
      if (!action) return;
      // One bloom or the patch: the menu stays to compare the two, and follows the flower's new size.
      if (action === 'one-bloom' || action === 'patch') {
        const id = friend,
          single = action === 'one-bloom';
        row('one-bloom').setAttribute('aria-checked', String(single));
        row('patch').setAttribute('aria-checked', String(!single));
        setSingleBloom(id, single).then(() => requestAnimationFrame(place));
        return;
      }
      closeControls();
      if (action === 'scene') {
        $('scene-button').click();
      } else if (action === 'play') openPlay();
      else if (action === 'pin') $('always-on-top').click();
      else if (action === 'fit') $('window-fit').click();
      else if (action === 'menu') showControls?.();
      else if (action === 'dig-here') digAt(point.x, point.y);
      else if (action === 'letter') openLetter();
      else if (action === 'talk') openChat(friend);
      else if (action === 'play-friend') openPlay();
      else if (action === 'dig-friend') digWith(friend);
      else if (action === 'settings-friend') friendSettings(friend);
      else if (action === 'desktop-friend') sendOut(friend, !data.pets.find(p => p.id === friend)?.onDesktop);
      else if (['desktop-decor', 'desktop-plant', 'desktop-tree'].includes(action)) {
        const thing = ownList(action.slice('desktop-'.length))?.find(d => d.id === friend);
        sendOut(friend, !thing?.onDesktop);
      } else if (action === 'pull-plant') pullPlant(friend);
      else if (action === 'remove-tree') removeTree(friend);
      else if (action === 'dress-decor') dress(friend);
      else if (action === 'put-away') putAway(friend);
    });
    globalThis.window?.addEventListener('resize', place);
  }
  $('scene-button')?.addEventListener('click', () => {
    beforeOpen();
    closeControls(false);
    const side = $('side-panel');
    if (side && !side.hidden) $('close-panel').click();
  });
  for (const id of ['yard-controls-panel', 'play-panel']) {
    const panel = $(id);
    if (!panel) continue;
    // Inline games must not move the next target before its click arrives.
    panel.addEventListener('pointerdown', event => event.stopPropagation());
    panel.addEventListener('click', event => {
      const action = event.target.closest('button');
      if (!action) return;
      if (event.detail === 0 && aiming && ['feed', 'plant-tool'].includes(action.id)) return;
      if (action.hasAttribute('data-panel')) {
        // The destination already closed its opener before showing its task details; a chat
        // keeps the focus in its own box.
        if (action.dataset.panel !== 'pet') $('close-panel').focus();
      } else if (
        ['feed', 'chatter', 'plant-tool', 'fish-tool', 'album-button', 'dig-tool', 'tree-tool'].includes(action.id) ||
        action.hasAttribute('data-game')
      )
        closeControls();
    });
  }
}
