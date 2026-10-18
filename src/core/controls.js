// The button and blank-yard context gesture share the same controls and action handlers.
import { dropdown } from './menu.js';
import { $, aiming } from './state.js';

let dismissControls = null;
let showControls = null;

export function openControls() {
  showControls?.();
}

export function closeControls(focus = true) {
  const panel = $('yard-controls-panel');
  if (!panel || panel.hidden) return;
  const target = dismissControls?.();
  panel.hidden = true;
  $('yard-controls-toggle').setAttribute('aria-expanded', 'false');
  if (focus) (target || $('yard-controls-toggle')).focus();
}

export function closeScene() {
  if (!$('scene-menu')) return;
  $('scene-menu').hidden = true;
  $('scene-button').setAttribute('aria-expanded', 'false');
}

export function setupControls() {
  const button = $('yard-controls-toggle'),
    panel = $('yard-controls-panel');
  let contextPoint = null;
  const resetContext = () => {
    contextPoint = null;
    panel.classList.remove('context-open');
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    panel.style.removeProperty('max-height');
    return document.body.classList.contains('compact') ? $('yard') : button;
  };
  const placeContext = () => {
    if (!contextPoint || panel.hidden) return;
    if (document.body.classList.contains('compact')) {
      panel.classList.remove('context-open');
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('max-height');
      return;
    }
    panel.classList.add('context-open');
    panel.style.removeProperty('max-height');
    const { width, height } = panel.getBoundingClientRect();
    const margin = 8;
    panel.style.left = `${Math.max(margin, Math.min(contextPoint.x, innerWidth - width - margin))}px`;
    const top = Math.max(margin, Math.min(contextPoint.y, innerHeight - height - margin));
    panel.style.top = `${top}px`;
    panel.style.setProperty('max-height', `${innerHeight - top - margin}px`);
  };
  const box = dropdown(
    button,
    panel,
    () => {
      panel.scrollTop = 0;
      closeScene();
      const side = $('side-panel');
      if (side && !side.hidden) $('close-panel').click();
      if (contextPoint) placeContext();
      else resetContext();
      (panel.querySelector('.panel-tab') || panel.querySelector('button:not(:disabled)'))?.focus();
    },
    resetContext,
  );
  dismissControls = box.close;
  showControls = () => {
    resetContext();
    box.open();
  };
  $('close-controls')?.addEventListener('click', () => closeControls());
  $('menu-scene')?.addEventListener('click', () => {
    closeControls(false);
    $('scene-button').click();
  });
  $('yard')?.addEventListener('contextmenu', event => {
    if (
      event.defaultPrevented ||
      event.target.closest(
        'button,input,textarea,select,a,label,[contenteditable="true"],.yard-pet,.pet-tag,.plant,.decor,.found-seed',
      )
    )
      return;
    event.preventDefault();
    contextPoint = { x: event.clientX, y: event.clientY };
    box.open();
  });
  globalThis.window?.addEventListener('resize', placeContext);
  $('scene-button')?.addEventListener('click', () => {
    closeControls(false);
    const side = $('side-panel');
    if (side && !side.hidden) $('close-panel').click();
  });
  // Inline submenus must not collapse on pointerdown and move the next button before its click.
  panel.addEventListener('pointerdown', event => event.stopPropagation());
  panel.addEventListener('click', event => {
    const action = event.target.closest('button');
    if (!action) return;
    // Keyboard placement uses a second activation of the same tool to place nearby.
    if (event.detail === 0 && aiming && ['feed', 'plant-tool'].includes(action.id)) return;
    if (action.matches('.panel-tab')) {
      closeControls(false);
      $('close-panel').focus();
    } else if (
      ['feed', 'chatter', 'plant-tool', 'fish-tool', 'album-button'].includes(action.id) ||
      action.hasAttribute('data-game')
    )
      closeControls();
  });
}
