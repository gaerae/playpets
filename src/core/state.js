// What every part of the app shares: the latest state from the backend, who is selected,
// and the few helpers everything else is built from. Other modules read these bindings live
// and change them only through the setters.

import { styledAsset } from './appearance.js';
import { t } from './i18n.js';
import { displayName } from './names.js';
import { spoken } from './text.js';

export const $ = id => document.getElementById(id);
// The bridge to the backend (set by the backend before the modules load; absent where there is no
// page, as in a test, so importing this module never fails).
export const api = globalThis.playPets;
export let data = { pets: [], assets: [], providers: [], statuses: {}, busy: [] };
export let selected = null;
// What the next click in the yard puts down: false, 'treat' or 'seed'.
export let aiming = false;
export let game = null;
export function setData(value) {
  data = value;
}
export function setSelected(value) {
  selected = value;
}
export function setAiming(value) {
  aiming = value;
}
export function setGame(value) {
  game = value;
}
// views: friends in the yard by id. companions: friends invited into the current chat.
// temporaryMessages: per friend, the message just sent (or its error) until the backend's history has it.
export const views = new Map();
export const companions = new Set();
export const temporaryMessages = new Map();
export const labels = {
  idle: t('status.idle'),
  working: t('status.working'),
  waiting: t('status.waiting'),
  done: t('status.done'),
  error: t('status.error'),
};
export const pet = () => data.pets.find(p => p.id === selected);
export const asset = p =>
  styledAsset(
    data.assets?.find(a => a.id === p?.assetId),
    p?.visualStyle,
  );
export const name = p => displayName(p, asset(p), t('friend.default'));
/** An AI connection as the lists show it: the name, and the model when it has one. */
export const providerLabel = c => (c?.model ? `${c.name} (${c.model})` : c?.name || '');
const noticeHomes = new WeakMap();
function placeNotice() {
  const notice = $('toast');
  if (!noticeHomes.has(notice)) noticeHomes.set(notice, notice.parentNode);
  // A z-index cannot put a yard notice above a modal's top layer.
  const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
  const actions = dialog?.querySelector('.dialog-actions');
  const host = actions?.parentNode || dialog || noticeHomes.get(notice);
  if (host && notice.parentNode !== host) {
    if (actions) host.insertBefore(notice, actions);
    else host.append(notice);
  }
  if (dialog) notice.dataset.inDialog = 'true';
  else delete notice.dataset.inDialog;
}
export function setupToast() {
  const followDialog = () => {
    if (!$('toast').hidden) placeNotice();
  };
  document.addEventListener('close', followDialog, true);
  // A notice that was already visible also follows a newly opened modal.
  if (globalThis.MutationObserver) {
    const observer = new MutationObserver(followDialog);
    for (const dialog of document.querySelectorAll('dialog'))
      observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
}
/** How long a message stays to be read: 2.5 s and 50 ms a character, between 3 and 8 seconds. The
 * notices below, the cards above a friend and the friends' bubbles all keep to it. */
export const readingTime = text => Math.max(3000, Math.min(8000, 2500 + [...String(text)].length * 50));
// Notices stack at most two lines along the bottom (one in a small window, where two would cover
// the friends); a line already there is refreshed, not repeated, and the oldest gives way. Each
// stays its reading time, and longer while the pointer rests on it.
const noticeLines = () => (document.body?.classList.contains('compact') ? 1 : 2);
const lineTimers = new WeakMap();
function keepLine(line, ms) {
  clearTimeout(lineTimers.get(line));
  lineTimers.set(
    line,
    setTimeout(() => {
      if (line.matches?.(':hover')) return keepLine(line, 1500);
      const notice = $('toast');
      notice.replaceChildren(...[...notice.children].filter(other => other !== line));
      if (!notice.children.length) notice.hidden = true;
    }, ms),
  );
}
/** Says something short along the bottom of the yard; `error` marks a failure apart from news. */
export function toast(message, { error = false } = {}) {
  const words = String(message);
  // A form that already says it beside its field does not need it said twice over its buttons.
  const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
  if (dialog && [...dialog.querySelectorAll('.form-error')].some(e => !e.hidden && e.textContent === words)) return;
  const notice = $('toast');
  let line = [...notice.children].find(other => other.textContent === words);
  if (!line) {
    line = document.createElement('span');
    line.textContent = words;
    notice.append(line);
  }
  line.classList.toggle('error', error);
  const lines = [...notice.children];
  if (lines.length > noticeLines()) notice.replaceChildren(...lines.slice(-noticeLines()));
  placeNotice();
  notice.hidden = false;
  keepLine(line, readingTime(words));
}
export async function call(method, ...args) {
  const result = await api[method](...args);
  if (!result.ok) {
    // The backend's errors are whole sentences in the app's language; spoken() shows them as they are.
    const error = new Error(result.error);
    error.spoken = true;
    throw error;
  }
  return result.data;
}
export const guard =
  fn =>
  async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      toast(spoken(e, t('error.generic')), { error: true });
    }
  };
export const remember = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
export const recall = key => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
