// The friend tab's header: who you are talking to, and how they are doing.

import { agentsOf } from '../core/agents.js';
import { joinList, t } from '../core/i18n.js';
import { drawSprite } from '../core/sprites.js';
import { $, asset, companions, data, labels, name, pet, selected, setSelected, views } from '../core/state.js';
import { agentStateOf, stateOf, statusOf } from '../core/status.js';
import { plain } from '../core/text.js';
import { refreshChat, renderChat } from './chat.js';
import { showSize } from './friend-settings.js';
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
  showSize(p.size);
  // The pill is about the coding agent; a chat answer shows in the log, not here.
  const agentState = agentStateOf(data, p.id);
  $('status').textContent = labels[agentState];
  $('status').title = agentState === 'idle' ? '' : plain(statusOf(data, p.id)?.message || '');
  // Under the AI picker: the relationship, and which coding agents report to this friend (the
  // picker says the AI itself).
  const agents = agentsOf(data, p.id);
  const chip = (text, cls) =>
    Object.assign(document.createElement('span'), { className: `fact-chip ${cls}`, textContent: text });
  $('friend-chips').replaceChildren(
    ...(p.relation ? [chip(t(`relation.${p.relation}`), 'bond')] : []),
    ...(agents.length ? [chip(t('friend.agent_chip', { agents: joinList(agents) }), 'agent')] : []),
  );
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
export function drawPortrait(now) {
  const p = pet();
  if (p) drawSprite($('portrait'), asset(p), stateOf(data, p.id), now);
}
// Wires the list that switches who you are talking to. Called once, by app.js.
export function setupFriend() {
  $('friend-select').onchange = () => select($('friend-select').value);
}
