// Frequent yard actions have their own surface; the pointer menu delegates to the same handlers.

import { t } from './i18n.js';
import { icons } from './icons.js';
import { dropdown, menuNavigation } from './menu.js';
import { $, aiming, data, game, name, selected } from './state.js';

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
    ['quick-play', 'play-button'],
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

export function setupControls({ beforeOpen = () => {} } = {}) {
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
        const visible = [...panel.querySelectorAll('button')].find(
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
  const quick = wire('yard', 'quick-play', false);
  showControls = () => menu?.open();
  showPlay = () => {
    beforeOpen();
    if (!document.body.classList.contains('compact') || !quick) return play?.open();
    const pet = data.pets.find(p => p.id === selected);
    $('quick-play-title').textContent = pet ? name(pet) : t('controls.play');
    $('quick-play-actions').hidden = !data.pets.length;
    $('quick-play-empty').hidden = !!data.pets.length;
    $('quick-play-explore-button').hidden = !!game;
    $('quick-play-games').hidden = true;
    $('quick-play-explore').hidden = true;
    for (const button of $('quick-play').querySelectorAll('[data-quick-tool]')) {
      const source = $(button.dataset.quickTool);
      button.hidden = !source || source.hidden || !!game;
      button.disabled = source?.disabled || !data.pets.length;
      button.title = source?.title || '';
    }
    $('quick-play-games-label').textContent = game ? t('game.stop', { name: t(`game.${game.kind}`) }) : t('game.label');
    quick.open();
  };
  $('play-button')?.addEventListener('click', () => {
    if (!$('play-panel').hidden || ($('quick-play') && !$('quick-play').hidden)) closeControls();
    else openPlay();
  });
  $('close-quick-play')?.addEventListener('click', () => closeControls());
  $('quick-play')?.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-panel')) {
      closeControls(false);
    } else if (button.dataset.quickTool) {
      const source = $(button.dataset.quickTool);
      if (!source || source.hidden || source.disabled) return;
      closeControls();
      source.click();
    } else if (button.id === 'quick-play-explore-button') {
      $('quick-play-actions').hidden = true;
      $('quick-play-explore').hidden = false;
      $('quick-play-explore').querySelector('button')?.focus();
    } else if (button.id === 'quick-play-games-button') {
      if (game) {
        closeControls();
        $('games-button').click();
        return;
      }
      const choices = $('quick-play-games');
      choices.replaceChildren(
        ...[...$('games-menu').querySelectorAll('[data-game]')].map(source => {
          const choice = document.createElement('button');
          choice.type = 'button';
          choice.className = 'quick-play-action';
          choice.dataset.quickGame = source.dataset.game;
          choice.textContent = source.textContent;
          choice.disabled = source.disabled;
          return choice;
        }),
      );
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'icon-button';
      back.dataset.quickBack = '';
      back.setAttribute('aria-label', t('controls.play_back'));
      const mark = document.createElement('span');
      mark.dataset.icon = 'back';
      back.append(mark);
      choices.insertBefore(back, choices.firstChild);
      icons(choices);
      $('quick-play-actions').hidden = true;
      choices.hidden = false;
      back.focus();
    } else if (button.hasAttribute('data-quick-back')) {
      $('quick-play-actions').hidden = false;
      $('quick-play-games').hidden = true;
      $('quick-play-explore').hidden = true;
      $('quick-play-games-button').focus();
    } else if (button.dataset.quickGame) {
      const source = [...$('games-menu').querySelectorAll('[data-game]')].find(
        item => item.dataset.game === button.dataset.quickGame,
      );
      if (!source || source.disabled) return;
      closeControls();
      source.click();
    }
  });
  $('close-controls')?.addEventListener('click', () => closeControls());
  $('close-play')?.addEventListener('click', () => closeControls());
  $('play-back')?.addEventListener('click', openControls);
  $('menu-play')?.addEventListener('click', openPlay);
  $('menu-scene')?.addEventListener('click', () => {
    closeControls(false);
    $('scene-button').click();
  });

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
          'button,input,textarea,select,a,label,[contenteditable="true"],.yard-pet,.pet-tag,.plant,.decor,.planted-tree,.found-seed',
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
      else if (action === 'friends') $('menu-friends').click();
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
        closeControls(false);
        $('close-panel').focus();
      } else if (
        ['feed', 'chatter', 'plant-tool', 'fish-tool', 'album-button', 'dig-tool', 'tree-tool'].includes(action.id) ||
        action.hasAttribute('data-game')
      )
        closeControls();
    });
  }
}
