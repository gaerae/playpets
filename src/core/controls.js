// Secondary controls stay behind one visible entry point in both yard sizes.
import { dropdown } from './menu.js';
import { $, aiming } from './state.js';

export function closeControls(focus = true) {
  const panel = $('yard-controls-panel');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  $('yard-controls-toggle').setAttribute('aria-expanded', 'false');
  if (focus) $('yard-controls-toggle').focus();
}

export function closeScene() {
  if (!$('scene-menu')) return;
  $('scene-menu').hidden = true;
  $('scene-button').setAttribute('aria-expanded', 'false');
}

export function setupControls() {
  const button = $('yard-controls-toggle'),
    panel = $('yard-controls-panel');
  dropdown(button, panel, () => {
    closeScene();
    const side = $('side-panel');
    if (side && !side.hidden) $('close-panel').click();
    panel.querySelector('button:not(:disabled)')?.focus();
  });
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
      ['feed', 'chatter', 'plant-tool', 'fish-tool', 'album-button', 'mini'].includes(action.id) ||
      action.hasAttribute('data-game')
    )
      closeControls();
  });
}
