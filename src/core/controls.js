// Frequent yard actions have their own surface; the pointer menu delegates to the same handlers.

import { prepareCompanionAction } from './companion-actions.js';
import { t } from './i18n.js';
import { dropdown, menuNavigation } from './menu.js';
import { $, aiming, data, game, name, selected, views } from './state.js';

let surfaces = [];
let showControls = null;
let showPlay = null;
let showFriendMenu = null;
const yardFocus = button => (document.body.classList.contains('compact') ? $('yard') : button);

export function openControls() {
  showControls?.();
}
export function openPlay() {
  showPlay?.();
}
/** A friend's own right-click menu at a point in the window: talk, or play with it. */
export function openFriendMenu(id, point) {
  showFriendMenu?.(id, point);
}
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
  for (const [id, button] of [
    ['yard-controls-panel', 'yard-controls-toggle'],
    ['play-panel', 'play-button'],
    ['yard-context-menu', 'yard-controls-toggle'],
  ]) {
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

export function setupControls({ beforeOpen = () => {}, openChat = () => {} } = {}) {
  surfaces = [];
  const closeOthers = except => {
    beforeOpen();
    for (const surface of surfaces) if (surface.panel !== except) surface.box.close();
    closeUpdateDetails();
    closeScene();
    const side = $('side-panel');
    if (side && !side.hidden) $('close-panel').click();
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

        // The first action in the page, not the head's Close.
        const visible = [...(panel.querySelector('.dock-panel-body') || panel).querySelectorAll('button')].find(
          action => !action.disabled && !action.hidden && action.getClientRects?.().length,
        );
        (visible || panel.querySelector('.panel-tab') || panel.querySelector('button:not(:disabled)'))?.focus();
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
    $('play-title').textContent = pet ? t('controls.play_with', { name: name(pet) }) : t('controls.play');
    $('play-empty').hidden = !!pet;
    $('play-sections').hidden = !pet;
    for (const id of ['plant-tool', 'tree-tool', 'feed']) $(id).disabled = !pet || !!game;
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
    // One menu, two sets of items: the scenery's (where to go) and a friend's (what to do with it).
    let point = { x: 8, y: 8 },
      friend = null;
    const items = menuNavigation(context);
    const show = (forWhat, id = null) => {
      friend = id;
      for (const item of context.querySelectorAll('[data-context-for]'))
        item.hidden = item.dataset.contextFor !== forWhat;
      const pet = id && data.pets.find(p => p.id === id);
      if (pet) {
        context.querySelector('[data-context-action="talk"] .context-label').textContent = t('friend.talk', {
          name: name(pet),
        });
        context.querySelector('[data-context-action="play-friend"] .context-label').textContent = t(
          'controls.play_with',
          { name: name(pet) },
        );
      }
    };
    const place = () => {
      if (context.hidden) return;
      const { width, height } = context.getBoundingClientRect();
      context.style.left = `${Math.max(8, Math.min(point.x, innerWidth - width - 8))}px`;
      const top = Math.max(8, Math.min(point.y, innerHeight - height - 8));
      context.style.top = `${top}px`;
      context.style.setProperty('max-height', `${innerHeight - top - 8}px`);
    };
    const box = dropdown(
      yard,
      context,
      () => {
        closeOthers(context);
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
      show('yard');
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
      show('yard');
      box.open();
      launcher.setAttribute('aria-expanded', 'true');
    });
    showFriendMenu = (id, at) => {
      point = at;
      show('friend', id);
      box.open();
    };
    context.addEventListener('click', event => {
      const action = event.target.closest('[data-context-action]')?.dataset.contextAction;
      if (!action) return;
      closeControls();
      if (action === 'scene') $('scene-button').click();
      else if (action === 'play') openPlay();
      else if (action === 'pin') $('always-on-top').click();
      else if (action === 'menu') openControls();
      else if (action === 'talk') openChat(friend);
      else if (action === 'play-friend') openPlay();
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
        // The destination already closed its opener before showing its task details.
        $('close-panel').focus();
      } else if (
        ['feed', 'chatter', 'plant-tool', 'fish-tool', 'album-button', 'dig-tool', 'tree-tool'].includes(action.id) ||
        action.hasAttribute('data-game')
      )
        closeControls();
    });
  }
}
