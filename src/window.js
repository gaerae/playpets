// One frameless window: its size and its always-on-top switch are independent.
import { closeControls, closeScene } from './core/controls.js';
import { putAttribute } from './core/dom.js';
import { t } from './core/i18n.js';
import { onEscape, onShortcut } from './core/keys.js';
import { $, call, data, guard } from './core/state.js';

let fullscreen = false;
let changingFullscreen = false;

function renderFullscreen(on) {
  fullscreen = !!on;
  document.body.classList.toggle('fullscreen', fullscreen);
  $('fullscreen')?.setAttribute('aria-pressed', String(fullscreen));
  const label = $('fullscreen-label');
  if (label) {
    const key = fullscreen ? 'win.restore_size' : 'win.fullscreen';
    label.setAttribute('data-i18n', key);
    label.textContent = t(key);
  }
}

export async function setFullscreen(on) {
  if (changingFullscreen) return;
  changingFullscreen = true;
  $('fullscreen').disabled = true;
  try {
    renderFullscreen(await call('windowFullscreen', on));
    closeControls();
  } finally {
    changingFullscreen = false;
    $('fullscreen').disabled = false;
  }
}

export function renderWindow(on = !!data.alwaysOnTop) {
  const button = $('always-on-top'),
    item = document.querySelector('[data-context-action="pin"]');
  if (button) putAttribute(button, 'aria-pressed', String(on));
  if (item) putAttribute(item, 'aria-checked', String(on));
}

export async function setAlwaysOnTop(on) {
  renderWindow(await call('windowAlwaysOnTop', on));
}

// Quitting ends desktop friends too, while closing the window only sends it to the tray. The two
// buttons say so side by side, so quitting acts at once, as it does from the tray and the menu bar.
export async function quitApp() {
  await call('quitApp');
}

function fitWindow() {
  const compact = innerWidth <= 640 || innerHeight <= 480;
  const changed = document.body.classList.contains('compact') !== compact;
  const focused =
    changed &&
    ['yard-controls-panel', 'play-panel', 'yard-context-menu'].some(id => $(id)?.contains(document.activeElement));
  document.body.classList.toggle('compact', compact);
  if (changed && $('play-panel')?.hidden !== false) closeControls(focused);
}

// Surfaces that open at the top of a small window: over them the window's buttons would cover their
// head, and a second Close would sit beside their own.
const TOP_SURFACES = '.side-panel, .dock-panel, .empty-yard';
/** Whether a pointer this far down the window, over `target`, is near enough for the window buttons
 * to show: not while it is on an open panel, whose head the buttons would cover. */
export const nearTop = (y, target = null) => y < 56 && !target?.closest?.(TOP_SURFACES);

// Window movement and resizing use native gestures, so every platform keeps its own edge behavior.
export function setupWindow() {
  if (/Mac/.test(navigator.userAgent)) document.documentElement.classList.add('mac');
  renderFullscreen(false);
  $('fullscreen').onclick = guard(() => setFullscreen(!fullscreen));
  $('always-on-top').onclick = guard(() => setAlwaysOnTop($('always-on-top').getAttribute('aria-pressed') !== 'true'));
  $('window-drag').addEventListener('pointerdown', event => {
    if (event.button === 0) guard(() => call('windowDrag'))();
  });
  for (const grip of document.querySelectorAll('[data-resize]'))
    grip.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      return guard(() => call('windowResize', grip.dataset.resize))();
    });
  $('menu-quit').onclick = guard(quitApp);
  const hideWindow = guard(async () => {
    closeControls(false);
    await call('windowHide');
  });
  $('hide-window').onclick = hideWindow;
  $('window-close').onclick = hideWindow;
  $('window-minimize').onclick = guard(() => call('windowMinimize'));
  const fit = guard(() => call('windowFit'));
  $('window-fit').onclick = fit;
  onShortcut('fitWindow', fit);
  document.addEventListener('pointermove', event =>
    document.body.classList.toggle('window-top', nearTop(event.clientY, event.target)),
  );
  document.body.addEventListener('pointerleave', () => document.body.classList.remove('window-top'));
  window.addEventListener(
    'resize',
    guard(async () => {
      fitWindow();
      if (fullscreen && !changingFullscreen) renderFullscreen(await call('windowIsFullscreen'));
    }),
  );
  // Window bubbling runs after panel and dropdown handlers have consumed Escape.
  onEscape(
    guard(async event => {
      const dialog = document.querySelector('dialog[open]');
      if (dialog) {
        if (fullscreen) {
          // Consume the native fullscreen shortcut while retaining the dialog's cancel guards.
          event.preventDefault();
          if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
        }
        return;
      }
      if ($('side-panel')?.hidden === false) return;
      if (['yard-controls-panel', 'play-panel', 'yard-context-menu'].some(id => $(id) && !$(id).hidden)) {
        event.preventDefault();
        closeControls();
        return;
      }
      if ($('scene-menu')?.hidden === false) {
        event.preventDefault();
        closeScene();
        $('scene-button').focus();
        return;
      }
      if (fullscreen) {
        event.preventDefault();
        await setFullscreen(false);
      }
    }),
    window,
  );
  fitWindow();
  renderWindow();
  for (const button of document.querySelectorAll('[data-expand-window]'))
    button.onclick = guard(() => setFullscreen(true));
}
