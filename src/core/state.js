// What every part of the app shares: the latest state from the backend, who is selected,
// and the few helpers everything else is built from. Other modules read these bindings live
// and change them only through the setters.
import { t } from './i18n.js';
import { displayName } from './names.js';
import { spoken } from './text.js';

export const $ = id => document.getElementById(id);
export const api = window.playPets;
export let data = { pets: [], assets: [], providers: [], statuses: {}, busy: [] };
export let selected = null;
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
export const asset = p => data.assets.find(a => a.id === p?.assetId);
export const name = p => displayName(p, asset(p), t('friend.default'));
/** An AI connection as the lists show it: the name, and the model when it has one. */
export const providerLabel = c => (c?.model ? `${c.name} · ${c.model}` : c?.name || '');
let toastTimer;
export function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 3600);
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
      toast(spoken(e, t('error.generic')));
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
