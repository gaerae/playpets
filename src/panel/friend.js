// The friend tab's header: who you are talking to, how they are doing, and the menu of what can be
// done to them.

import { agentsOf } from '../core/agents.js';
import { put } from '../core/dom.js';
import { joinList, t } from '../core/i18n.js';
import { popup } from '../core/menu.js';
import { drawSprite, photoOver } from '../core/sprites.js';
import {
  $,
  asset,
  companions,
  data,
  labels,
  name,
  pet,
  remember,
  selected,
  setSelected,
  views,
} from '../core/state.js';
import { agentStateOf, stateOf, statusOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { progressOf } from '../yard/bond.js';
import { refreshChat, renderChat, swapDraft } from './chat.js';
import { openFriendSettings } from './friend-settings.js';
export function select(id) {
  if (selected === id) return;
  swapDraft(selected, id);
  setSelected(id);
  remember('friend', id);
  companions.clear();
  renderPanel();
  for (const [key, v] of views) v.button.classList.toggle('selected', key === id);
  refreshChat();
}
// What the agent chip and the list of friends were last built from: a push that changes neither
// leaves them as they are (and the list keeps an open dropdown).
let chipsKey = null,
  friendsKey = null;
// The tab is drawn again on every push, mostly with nothing changed: what is written is written only
// when it differs (core/dom.js put).
export function renderPanel() {
  const p = pet();
  put($('empty-panel'), 'hidden', !!p);
  put($('pet-panel'), 'hidden', !p);
  if (!p) return;
  put($('selected-name'), 'textContent', name(p));
  // The pill is about the coding agent; a chat answer shows in the log, not here.
  const agentState = agentStateOf(data, p.id);
  put($('status'), 'textContent', labels[agentState]);
  // Only something to say when an agent is at work, waiting or done: resting is every friend's state.
  put($('status'), 'hidden', agentState === 'idle');
  put($('status'), 'title', agentState === 'idle' ? '' : plain(statusOf(data, p.id)?.message || ''));
  // Who it is to you, beside how close you are: always said (a friend too), and a click changes it.
  const relation = p.relation || 'friend';
  put($('relation-chip'), 'textContent', t(`relation.${relation}`));
  put($('relation-chip').dataset, 'relation', relation);
  // Under the header: which coding agents report to this friend (the composer's picker says the AI itself).
  const agents = agentsOf(data, p.id);
  const chip = (text, cls) =>
    Object.assign(document.createElement('span'), { className: `fact-chip ${cls}`, textContent: text });
  const chips = agents.length ? t('friend.agent_chip', { agents: joinList(agents) }) : '';
  if (chips !== chipsKey) {
    chipsKey = chips;
    $('friend-chips').replaceChildren(...(chips ? [chip(chips, 'agent')] : []));
  }
  renderCloseness(p);
  renderChat(p);
  // With several friends around, the name becomes a list to switch who you are talking to.
  const many = data.pets.length > 1;
  put($('selected-name'), 'hidden', many);
  put($('friend-select'), 'hidden', !many);
  if (many) {
    const friends = JSON.stringify(data.pets.map(q => [q.id, name(q)]));
    if (friends !== friendsKey) {
      friendsKey = friends;
      $('friend-select').replaceChildren(...data.pets.map(q => new Option(name(q), q.id)));
    }
    put($('friend-select'), 'value', p.id);
  }
  put($('instance-id'), 'textContent', t('friend.id', { id: p.id }));
}
// How close the friend is, under its name, and what the next level brings.
function renderCloseness(p) {
  const { level, share, left } = progressOf(p.id);
  put($('bond-row'), 'hidden', false);
  put($('bond-name'), 'textContent', t(`bond.level_${level}`));
  put($('bond-fill').style, 'width', `${Math.round(share * 100)}%`);
  put(
    $('bond-next'),
    'textContent',
    left
      ? t('bond.next', { level: t(`bond.level_${level + 1}`), left, unlock: t(`bond.unlock_${level + 1}`) })
      : t('bond.max'),
  );
}
export function drawPortrait(now) {
  const p = pet();
  if (!p) return;
  const art = asset(p),
    photo = $('portrait-photo'),
    sprite = $('portrait');
  const url = art?.portraitUrl || '';
  if (photo.dataset.source !== url) photoOver(photo, sprite, url);
  if (!sprite.hidden) drawSprite(sprite, art, stateOf(data, p.id), now);
}
// Wires the list that switches who you are talking to. Called once, by app.js.
export function setupFriend() {
  $('friend-select').onchange = () => select($('friend-select').value);
  // What is done to the friend (settings, its AI, clearing the chat, sending it away) is in its menu.
  popup($('friend-menu-button'), $('friend-menu'));
  $('relation-chip').onclick = () => openFriendSettings('relation');
}
