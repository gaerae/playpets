// Signing Claude Code or Codex in from the app. The backend runs the CLI's own browser sign-in;
// this module draws the card that starts it, waits for it, takes the code Claude's page may show,
// and says how it ended. The card lives in the chat (above the message box) and in the connection
// dialog, and the same sign-in is shown in both.

import { language, t } from '../core/i18n.js';
import { call, data, toast } from '../core/state.js';
import { spoken } from '../core/text.js';

export const CLI_LABELS = Object.freeze({ claude: 'Claude Code', codex: 'Codex' });
const CLIS = Object.keys(CLI_LABELS);

/** The subscription CLI to offer, as `{ type, signedIn }`: one found and signed in first, else the
 * first found. `signedIn` is null while the backend has not said yet, so nothing flashes at start. */
export function cliChoice(detected = data.detected || {}) {
  const found = CLIS.filter(kind => detected[kind]);
  const ready = found.find(kind => detected.signedIn?.[kind] === true);
  if (ready) return { type: ready, signedIn: true };
  if (!found.length) return null;
  return { type: found[0], signedIn: detected.signedIn ? detected.signedIn[found[0]] === true : null };
}

/** Whether `kind`'s CLI is known to be signed out (false while the backend has not said). */
export const signedOut = kind => (data.detected?.signedIn || {})[kind] === false;

// The one sign-in this app runs at a time: which CLI, and whether it is waiting or did not finish.
let run = { kind: null, phase: 'idle' };
let onSignedIn = () => {};
let onChange = () => {};
// The window came back: the person may have signed in some other way. Asked at most this often.
const RECHECK_MS = 5000;
let checkedAt = 0;
// The cards drawn now, by their element's id, for the window's return to know whether anybody is
// waiting on one.
const showing = new Set();

/** Draws the sign-in card for `kind` into `host`, or hides it for null. Drawn again only when what
 * it says changes, so a code being typed into it survives the panel's other updates. */
export function renderSignIn(host, kind) {
  if (!host) return;
  const phase = kind && run.kind === kind ? run.phase : 'idle';
  const key = kind ? `${kind}|${phase}|${language()}` : '';
  host.hidden = !kind;
  if (kind) showing.add(host.id);
  else showing.delete(host.id);
  if (host.dataset.key === key) return;
  host.dataset.key = key;
  host.replaceChildren();
  if (!kind) return;
  const tool = CLI_LABELS[kind];
  const title = document.createElement('p');
  title.className = 'sign-in-title';
  title.textContent = t('signin.title', { tool });
  const body = document.createElement('p');
  body.className = 'sign-in-body';
  body.textContent = t(phase === 'waiting' ? 'signin.waiting' : phase === 'failed' ? 'signin.failed' : 'signin.body');
  host.append(title, body);
  const stop = phase === 'waiting' && button('signin.cancel', 'secondary', cancel);
  // Claude's page may show a code instead of coming back by itself; it goes to the CLI from here,
  // with Cancel on the same line so the card stays short in a small window.
  if (stop && kind === 'claude') return host.append(codeForm(stop));
  const actions = document.createElement('div');
  actions.className = 'sign-in-actions';
  actions.append(stop || button(phase === 'failed' ? 'signin.retry' : 'signin.start', 'primary', () => start(kind)));
  host.append(actions);
}

function button(key, kind, onclick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `button ${kind}`;
  b.textContent = t(key);
  b.onclick = onclick;
  return b;
}

function codeForm(stop) {
  const form = document.createElement('form');
  form.className = 'sign-in-code';
  const id = `sign-in-code-${Math.random().toString(36).slice(2)}`;
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = t('signin.code_label');
  const input = document.createElement('input');
  input.id = id;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = t('signin.code_placeholder');
  const send = document.createElement('button');
  send.className = 'button secondary';
  send.textContent = t('signin.code_send');
  form.append(label, input, send, stop);
  form.onsubmit = async e => {
    e.preventDefault();
    if (!input.value.trim()) return input.focus();
    send.disabled = true;
    try {
      await call('cliLoginCode', input.value);
      input.value = '';
    } catch (error) {
      toast(spoken(error, t('error.generic')), { error: true });
    } finally {
      send.disabled = false;
    }
  };
  return form;
}

async function start(kind) {
  run = { kind, phase: 'waiting' };
  onChange();
  try {
    await call('cliLogin', kind);
  } catch (error) {
    run = { kind: null, phase: 'idle' };
    onChange();
    toast(spoken(error, t('error.generic')), { error: true });
  }
}

async function cancel() {
  run = { kind: null, phase: 'idle' };
  onChange();
  await call('cancelCliLogin').catch(() => {});
}

/** Moves the focus to the first button of a sign-in card in `host`, for a step that led here. */
export function focusSignIn(host) {
  host?.querySelector('button')?.focus();
}

/** Asks the backend to look again whether each CLI is signed in (after a CLI turn failed, say). */
export function recheckSignIn() {
  checkedAt = Date.now();
  return call('detectAi').catch(() => {});
}

/** The backend's word that a sign-in ended. */
export function signInEvent(event) {
  if (event.type !== 'cliLogin' || run.kind !== event.kind) return;
  if (event.ok) {
    run = { kind: null, phase: 'idle' };
    toast(t('signin.done', { tool: CLI_LABELS[event.kind] }));
    onSignedIn(event.kind);
  } else run = { kind: event.kind, phase: 'failed' };
  onChange();
}

/** Wires the sign-in. `signedIn(kind)` runs once a sign-in started here succeeds; `changed()` draws
 * the cards again. Called once, by chat.js's setup. */
export function setupSignIn({ signedIn = () => {}, changed = () => {} } = {}) {
  onSignedIn = signedIn;
  onChange = changed;
  globalThis.window?.addEventListener('focus', () => {
    // Only while a card offers a sign-in that is not under way, and not on every focus: a CLI
    // signed out that no friend uses is not worth starting it each time the window comes back.
    if (run.phase === 'waiting' || Date.now() - checkedAt < RECHECK_MS) return;
    if ([...showing].some(id => document.getElementById(id)?.hidden === false)) recheckSignIn();
  });
}
