// One frameless window: its size and its always-on-top switch are independent.
import { confirmAction } from './core/confirm.js';
import { closeControls } from './core/controls.js';
import { t } from './core/i18n.js';
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
  $('always-on-top')?.setAttribute('aria-pressed', String(on));
  document.querySelector('[data-context-action="pin"]')?.setAttribute('aria-checked', String(on));
}

export async function setAlwaysOnTop(on) {
  renderWindow(await call('windowAlwaysOnTop', on));
}

// Quitting ends desktop friends too; closing the window only sends it to the tray.
export async function quitApp() {
  const sure = await confirmAction({
    title: t('quit.title'),
    body: t('quit.body'),
    action: t('quit.action'),
    danger: false,
  });
  if (sure) await call('quitApp');
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
  $('hide-window').onclick = guard(async () => {
    closeControls(false);
    await call('windowHide');
  });
  window.addEventListener(
    'resize',
    guard(async () => {
      fitWindow();
      if (fullscreen && !changingFullscreen) renderFullscreen(await call('windowIsFullscreen'));
    }),
  );
  // Window bubbling runs after panel and dropdown handlers have consumed Escape.
  window.addEventListener(
    'keydown',
    guard(async event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
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
      if (fullscreen) {
        event.preventDefault();
        await setFullscreen(false);
      }
    }),
  );
  fitWindow();
  renderWindow();
  for (const button of document.querySelectorAll('[data-expand-window]'))
    button.onclick = guard(() => setFullscreen(true));
}
