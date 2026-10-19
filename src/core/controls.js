// Frequent yard actions have their own surface; the pointer menu delegates to the same handlers.

import { prepareCompanionAction } from './companion-actions.js';
import { t } from './i18n.js';
import { dropdown, menuNavigation } from './menu.js';
import { $, aiming, data, game, name, selected, views } from './state.js';

let surfaces = [];
let showControls = null;
let showPlay = null;
const yardFocus = button => (document.body.classList.contains('compact') ? $('yard') : button);

export function openControls() {
  showControls?.();
}
export function openPlay() {
  showPlay?.();
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

export function setupControls({ beforeOpen = () => {}, stopGame = () => {} } = {}) {
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
        for (const body of panel.querySelectorAll('.management-page')) body.scrollTop = 0;
        if (panelId === 'play-panel') renderPlay();

        const visible = [...panel.querySelectorAll('button')].find(
          action => !action.disabled && !action.hidden && action.getClientRects?.().length,
        );
        const activeTab =
          panelId === 'yard-controls-panel' ? panel.querySelector('[role="tab"][aria-selected="true"]') : null;
        (
          activeTab ||
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
  const management = [...document.querySelectorAll('[data-management-tab]')];
  const selectManagement = (name, focus = false) => {
    for (const tab of management) {
      const active = tab.dataset.managementTab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const page = $(`management-${tab.dataset.managementTab}`);
      page.hidden = !active;
      if (active) {
        page.scrollTop = 0;
        if (focus) tab.focus();
      }
    }
  };
  for (const tab of management) {
    tab.addEventListener('click', () => selectManagement(tab.dataset.managementTab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const at = management.indexOf(tab);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? management.length - 1
            : (at + (event.key === 'ArrowRight' ? 1 : -1) + management.length) % management.length;
      selectManagement(management[next].dataset.managementTab, true);
    });
  }
  const menu = wire('yard-controls-toggle', 'yard-controls-panel');
  const play = wire('play-button', 'play-panel', false);
  const showPlayView = (view, focus = true) => {
    for (const [id, value] of [
      ['play-actions', 'main'],
      ['play-garden', 'garden'],
      ['play-games', 'games'],
    ])
      $(id).hidden = value !== view || !data.pets.length;
    $('play-garden-button').setAttribute('aria-expanded', String(view === 'garden'));
    $('games-button').setAttribute('aria-expanded', String(view === 'games'));
    if (focus)
      $(view === 'main' ? 'play-actions' : `play-${view}`)
        .querySelector('button')
        ?.focus();
  };
  const renderPlay = () => {
    const pet = data.pets.find(p => p.id === selected) || data.pets[0];
    const asset = pet && views.get(pet.id)?.asset;
    for (const action of ['dig', 'plant', 'cast', 'wait', 'reel', 'discover']) prepareCompanionAction(asset, action);
    $('play-title').textContent = pet ? t('controls.play_with', { name: name(pet) }) : t('controls.play');
    $('play-empty').hidden = !!pet;
    $('play-garden-button').disabled = !pet || !!game;
    $('games-label').textContent = game ? t('game.stop', { name: t(`game.${game.kind}`) }) : t('controls.group_games');
    showPlayView('main', false);
  };
  showControls = () => menu?.open();
  showPlay = () => play?.open();
  $('play-button')?.addEventListener('click', () => {
    if (!$('play-panel').hidden) closeControls();
    else openPlay();
  });
  $('play-panel')?.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.id === 'play-garden-button') showPlayView('garden');
    else if (button.id === 'games-button') {
      if (game) {
        closeControls();
        stopGame();
      } else showPlayView('games');
    } else if (button.hasAttribute('data-play-back')) showPlayView('main');
  });
  $('close-controls')?.addEventListener('click', () => closeControls());
  $('close-play')?.addEventListener('click', () => closeControls());
  const context = $('yard-context-menu'),
    yard = $('yard');
  if (context && yard) {
    let point = { x: 8, y: 8 };
    const items = menuNavigation(context);
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
      () => yardFocus($('yard-controls-toggle')),
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
      box.open();
    });
    context.addEventListener('click', event => {
      const action = event.target.closest('[data-context-action]')?.dataset.contextAction;
      if (!action) return;
      closeControls();
      if (action === 'scene') $('scene-button').click();
      else if (action === 'play') openPlay();
      else if (action === 'pin') $('always-on-top').click();
      else if (action === 'menu') openControls();
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
