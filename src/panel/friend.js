// The friend tab's header: who you are talking to, how they are doing, and the menu of what can be
// done to them.

import { agentsOf } from '../core/agents.js';
import { joinList, t } from '../core/i18n.js';
import { popup } from '../core/menu.js';
import { drawSprite } from '../core/sprites.js';
import { $, asset, companions, data, labels, name, pet, selected, setSelected, views } from '../core/state.js';
import { agentStateOf, stateOf, statusOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { progressOf } from '../yard/bond.js';
import { refreshChat, renderChat } from './chat.js';
import { openFriendSettings } from './friend-settings.js';
export function select(id) {
  if (selected === id) return;
  setSelected(id);
  companions.clear();
  renderPanel();
  for (const [key, v] of views) v.button.classList.toggle('selected', key === id);
  refreshChat();
}
export function renderPanel() {
  const p = pet();
  $('empty-panel').hidden = !!p;
  $('pet-panel').hidden = !p;
  if (!p) return;
  $('selected-name').textContent = name(p);
  // The pill is about the coding agent; a chat answer shows in the log, not here.
  const agentState = agentStateOf(data, p.id);
  $('status').textContent = labels[agentState];
  // Only something to say when an agent is at work, waiting or done: resting is every friend's state.
  $('status').hidden = agentState === 'idle';
  $('status').title = agentState === 'idle' ? '' : plain(statusOf(data, p.id)?.message || '');
  // Who it is to you, beside how close you are: always said (a friend too), and a click changes it.
  const relation = p.relation || 'friend';
  $('relation-chip').textContent = t(`relation.${relation}`);
  $('relation-chip').dataset.relation = relation;
  // Under the header: which coding agents report to this friend (the composer's picker says the AI itself).
  const agents = agentsOf(data, p.id);
  const chip = (text, cls) =>
    Object.assign(document.createElement('span'), { className: `fact-chip ${cls}`, textContent: text });
  $('friend-chips').replaceChildren(
    ...(agents.length ? [chip(t('friend.agent_chip', { agents: joinList(agents) }), 'agent')] : []),
  );
  renderCloseness(p);
  renderChat(p);
  // With several friends around, the name becomes a list to switch who you are talking to.
  const many = data.pets.length > 1;
  $('selected-name').hidden = many;
  $('friend-select').hidden = !many;
  if (many) {
    $('friend-select').replaceChildren(...data.pets.map(q => new Option(name(q), q.id)));
    $('friend-select').value = p.id;
  }
  $('instance-id').textContent = t('friend.id', { id: p.id });
}
// How close the friend is, under its name, and what the next level brings.
function renderCloseness(p) {
  const { level, share, left } = progressOf(p.id);
  $('bond-row').hidden = false;
  $('bond-name').textContent = t(`bond.level_${level}`);
  $('bond-fill').style.width = `${Math.round(share * 100)}%`;
  $('bond-next').textContent = left
    ? t('bond.next', { level: t(`bond.level_${level + 1}`), left, unlock: t(`bond.unlock_${level + 1}`) })
    : t('bond.max');
}
export function drawPortrait(now) {
  const p = pet();
  if (p) drawSprite($('portrait'), asset(p), stateOf(data, p.id), now);
}
// Wires the list that switches who you are talking to. Called once, by app.js.
export function setupFriend() {
  $('friend-select').onchange = () => select($('friend-select').value);
  // What is done to the friend (settings, its AI, clearing the chat, sending it away) is in its menu.
  popup($('friend-menu-button'), $('friend-menu'));
  $('relation-chip').onclick = () => openFriendSettings('relation');
}
