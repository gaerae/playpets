// The conversation: the AI a friend talks with, who else joins in, the messages and the composer.

import { logEntries } from '../core/chatlog.js';
import { confirmAction } from '../core/confirm.js';
import { joinList, t } from '../core/i18n.js';
import {
  $,
  call,
  companions,
  data,
  guard,
  name,
  pet,
  providerLabel,
  selected,
  setData,
  temporaryMessages,
  toast,
} from '../core/state.js';
import { blocks, spoken, waitingLine } from '../core/text.js';
import { befriend } from '../yard/bond.js';
import { openConnectionDialog } from './connection.js';

let providerKey = '',
  chatEpoch = 0;
// An answer shown with the styles its Markdown asked for. Every piece is set as text, never as markup.
const STYLE_TAGS = { bold: 'strong', italic: 'em', code: 'code' };
function rich(node, text) {
  let before = null;
  for (const block of blocks(text)) {
    if (before && before.type !== 'code' && block.type !== 'code') node.append('\n');
    before = block;
    if (block.type === 'code') {
      const code = document.createElement('code');
      code.className = 'code-block';
      code.textContent = block.text;
      node.append(code);
      continue;
    }
    const line = block.type === 'heading' ? node.appendChild(document.createElement('strong')) : node;
    if (block.type === 'item') line.append(`${block.marker} `);
    for (const piece of block.inline) {
      const tag = STYLE_TAGS[Object.keys(STYLE_TAGS).find(style => piece[style])];
      if (tag) {
        const styled = document.createElement(tag);
        styled.textContent = piece.text;
        line.append(styled);
      } else line.append(piece.text);
    }
  }
}
// While a friend's answer is on its way, the conversation ends with a bubble that says so.
// The words change a few times as the wait grows; the seconds beside them are not read aloud.
const waitingSince = new Map();
let waitingTimer = null;
let hasHistory = false;
function syncWaiting() {
  for (const id of [...waitingSince.keys()]) if (!data.busy.includes(id)) waitingSince.delete(id);
  for (const id of data.busy) if (!waitingSince.has(id)) waitingSince.set(id, performance.now());
  const log = $('chat-log'),
    since = waitingSince.get(selected);
  let node = log.querySelector('.waiting');
  if (since === undefined) {
    node?.remove();
    clearInterval(waitingTimer);
    waitingTimer = null;
    return;
  }
  if (!node) {
    node = document.createElement('div');
    node.className = 'message assistant waiting';
    const dots = document.createElement('span'),
      words = document.createElement('span'),
      clock = document.createElement('span');
    dots.className = 'waiting-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.append(...[0, 1, 2].map(() => document.createElement('i')));
    words.className = 'waiting-words';
    clock.className = 'waiting-clock';
    clock.setAttribute('aria-hidden', 'true');
    node.append(dots, words, clock);
  }
  if (node !== log.lastElementChild) {
    log.append(node);
    log.scrollTop = log.scrollHeight;
  }
  const seconds = Math.floor((performance.now() - since) / 1000),
    line = waitingLine(seconds),
    words = node.querySelector('.waiting-words');
  if (words.textContent !== line) words.textContent = line;
  node.querySelector('.waiting-clock').textContent = seconds >= 6 ? t('chat.seconds', { seconds }) : '';
  waitingTimer ??= setInterval(syncWaiting, 1000);
}
export function renderChat(p) {
  const key = JSON.stringify(data.providers);
  if (key !== providerKey) {
    providerKey = key;
    $('provider-select').replaceChildren(new Option(t('chat.no_ai'), ''));
    for (const c of data.providers) $('provider-select').append(new Option(providerLabel(c), c.id));
    $('provider-select').append(new Option(t('chat.new_ai'), '__new'));
  }
  $('provider-select').value = p.providerId;
  $('provider-select').disabled = data.busy.includes(p.id);
  const busy = data.busy.includes(p.id);
  $('send').hidden = busy;
  $('cancel').hidden = !busy;
  // A friend with no AI can still be written to: sending connects one first.
  $('message').disabled = busy;
  syncSend();
  // Nothing said yet, nothing to clear.
  $('clear-chat').disabled = busy || !hasHistory;
  $('chat-log').setAttribute('aria-busy', String(busy));
  $('chat-note').textContent = busy ? t('chat.note_busy') : p.providerId ? t('chat.note_keys') : t('chat.note_connect');
  // Friends with an AI of their own can join the conversation.
  for (const id of companions) if (!data.pets.some(q => q.id === id && q.providerId)) companions.delete(id);
  const others = data.pets.filter(q => q.id !== p.id && q.providerId);
  $('companions').hidden = !p.providerId || !others.length;
  $('companion-chips').replaceChildren();
  for (const q of others) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `detect-chip${companions.has(q.id) ? ' on' : ''}`;
    chip.textContent = name(q);
    chip.disabled = busy;
    chip.onclick = () => {
      if (companions.has(q.id)) companions.delete(q.id);
      else if (companions.size < 3) companions.add(q.id);
      else return toast(t('chat.max_companions'));
      renderChat(p);
    };
    $('companion-chips').append(chip);
  }
  $('companion-summary').textContent = companions.size
    ? t('chat.with', {
        names: joinList(data.pets.filter(q => companions.has(q.id)).map(name)),
      })
    : t('chat.pick_companions');
  syncWaiting();
}
// The log shows one friend's conversation. A new message is added at the end rather than the whole
// log redrawn, so a screen reader announces only what is new and someone reading further up is not
// pulled down; switching friends, clearing, or a reset starts the log over.
let shown = { pet: null, keys: [] };
const keyOf = m => `${m.role}|${m.name || ''}|${m.content}`;
function messageNode(m) {
  const node = document.createElement('div');
  if (m.name) {
    node.className = 'message peer';
    const who = document.createElement('b');
    who.textContent = m.name;
    node.append(who);
    rich(node, m.content.replace(`[${m.name}] `, ''));
  } else {
    node.className = `message ${m.role}`;
    if (m.role === 'assistant') rich(node, m.content);
    else node.textContent = m.content;
  }
  return node;
}
function placeholder(p) {
  const log = $('chat-log');
  const hint = document.createElement('p');
  hint.className = 'chat-placeholder';
  hint.textContent = p.providerId ? t('chat.empty_connected') : t('chat.empty_no_ai');
  log.append(hint);
  if (!p.providerId) {
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'button secondary connect-cta';
    cta.textContent = t('connection.title_new');
    cta.onclick = () => $('configure').click();
    log.append(cta);
  }
}
export async function refreshChat() {
  const p = pet();
  const epoch = ++chatEpoch;
  if (!p) return;
  const log = $('chat-log');
  if (shown.pet !== p.id) {
    log.replaceChildren();
    shown = { pet: p.id, keys: [] };
  }
  syncWaiting();
  try {
    const history = await call('getChat', p.id);
    if (selected !== p.id || epoch !== chatEpoch) return;
    const pendingMessage = temporaryMessages.get(p.id);
    const entries = logEntries(history, pendingMessage);
    hasHistory = history.length > 0;
    $('clear-chat').disabled = data.busy.includes(p.id) || !hasHistory;
    const keys = entries.map(keyOf);
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
    // Only the same conversation, grown at its end, keeps what is on screen.
    const grows =
      shown.keys.length > 0 && shown.keys.length <= keys.length && shown.keys.every((k, n) => k === keys[n]);
    if (!grows) {
      log.replaceChildren();
      shown.keys = [];
      if (!entries.length) placeholder(p);
    }
    const waiting = log.querySelector('.waiting');
    for (const m of entries.slice(shown.keys.length)) log.insertBefore(messageNode(m), waiting);
    shown.keys = keys;
    syncWaiting();
    if (!grows || atBottom) log.scrollTop = log.scrollHeight;
  } catch (e) {
    toast(spoken(e, t('error.history')));
  }
}
// What the backend tells the chat about.
export function chatEvent(event) {
  if (event.type === 'history-reset') {
    for (const id of event.petIds) temporaryMessages.delete(id);
    if (event.petIds.includes(selected)) refreshChat();
  }
  if (event.type === 'persona-saved') {
    const p = data.pets.find(q => q.id === event.petId);
    if (p) toast(t('toast.persona_saved', { name: name(p) }));
  }
  if (event.type === 'chat-message' && (event.petId === selected || companions.has(event.petId))) refreshChat();
}
// The composer grows with the text; the send button wakes up once there is something to send.
function syncSend() {
  const box = $('message');
  // With no AI yet, sending opens the connection first (see the form's submit).
  $('send').disabled = !box.value.trim();
  box.style.height = 'auto';
  box.style.height = `${Math.min(140, box.scrollHeight + 2)}px`;
}
// Wires the conversation: the AI choice, the composer and the chat buttons. Called once, by app.js.
export function setupChat() {
  // Who joins in opens above the composer and closes again on a click elsewhere or Esc.
  const together = $('companions');
  document.addEventListener('pointerdown', e => {
    if (together.open && !together.contains(e.target)) together.open = false;
  });
  together.addEventListener('keydown', e => {
    if (e.key === 'Escape' && together.open) {
      e.stopPropagation();
      together.open = false;
      together.querySelector('summary').focus();
    }
  });
  $('configure').onclick = () =>
    openConnectionDialog(data.providers.find(c => c.id === pet()?.providerId) || null, refreshChat);
  $('provider-select').onchange = guard(async () => {
    if ($('provider-select').value === '__new') {
      $('provider-select').value = pet()?.providerId || '';
      openConnectionDialog(null, refreshChat);
      return;
    }
    await call('updatePet', selected, { providerId: $('provider-select').value });
    refreshChat();
  });
  // The conversation itself.
  $('chat-form').onsubmit = async e => {
    e.preventDefault();
    const id = selected,
      text = $('message').value.trim();
    if (!text || data.busy.includes(id)) return;
    // A word for a friend with no AI yet is kept: connecting one sends it.
    if (!pet()?.providerId) {
      openConnectionDialog(null, async () => {
        setData(await call('bootstrap'));
        refreshChat();
        if (selected === id && pet()?.providerId && $('message').value.trim()) $('chat-form').requestSubmit();
      });
      return;
    }
    $('message').value = '';
    syncSend();
    temporaryMessages.set(id, { role: 'user', content: text });
    refreshChat();
    const group = [...companions];
    try {
      if (group.length) await call('chatWith', [id, ...group], text);
      else await call('chat', id, text);
      // Talking is time together too, with each friend in the conversation.
      for (const friend of [id, ...group]) befriend(friend, 'chat');
      temporaryMessages.delete(id);
    } catch (error) {
      temporaryMessages.set(id, { role: 'error', content: error.message });
      if (selected === id) $('message').value = text;
    }
    if (selected === id) refreshChat();
  };
  $('message').addEventListener('input', syncSend);
  $('message').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $('chat-form').requestSubmit();
    }
  });
  $('cancel').onclick = guard(() => call('cancelChat', selected));
  $('clear-chat').onclick = guard(async () => {
    const p = pet();
    if (!p) return;
    const sure = await confirmAction({
      title: t('chat.clear_confirm', { name: name(p) }),
      body: t('chat.clear_body'),
      action: t('chat.clear'),
    });
    if (!sure) return;
    await call('clearChat', p.id);
    temporaryMessages.delete(p.id);
    refreshChat();
    // The clear button is disabled now (nothing left to clear): the focus goes to the message box.
    $('message').focus();
  });
}
