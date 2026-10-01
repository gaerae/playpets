// The window itself: the title bar is part of the page, and "mini" leaves only the yard.
import { $, aiming, api, call, game, guard, remember } from './core/state.js';
import { setAimingMode } from './yard/care.js';
import { endGame } from './yard/play.js';

// Mini: only the yard, in a small window that stays on top.
let mini = false;
export async function setMini(on) {
  if (on && game) endGame();
  if (on && aiming) setAimingMode(false);
  await call('windowMini', on);
  mini = on;
  document.body.classList.toggle('mini', on);
  remember('mini', on ? '1' : '');
}
// Empty parts of the title bar (and of the mini yard) move the window.
const controls = 'button,select,input,textarea,a,label';
const grab = e => {
  if (e.button === 0 && !e.target.closest(`${controls},.yard-pet`)) api.windowDrag();
};
// Wires the title bar, the window buttons and mini mode to the page. Called once, by app.js.
export function setupWindow() {
  if (/Mac/.test(navigator.userAgent)) document.documentElement.classList.add('mac');
  $('mini').onclick = guard(() => setMini(true));
  $('unmini').onclick = guard(() => setMini(false));
  document.querySelector('.topbar').addEventListener('pointerdown', grab);
  document.querySelector('.topbar').addEventListener('dblclick', e => {
    if (!e.target.closest(controls)) api.windowMaximize();
  });
  $('yard').addEventListener('pointerdown', e => {
    if (mini) grab(e);
  });
  // Windows and Linux: the page draws the window buttons.
  $('win-min').onclick = () => api.windowMinimize();
  $('win-max').onclick = () => api.windowMaximize();
  $('win-close').onclick = () => api.windowHide();
}
