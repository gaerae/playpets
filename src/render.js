// Brings every part of the page in line with the latest state from the backend.
import { t } from './core/i18n.js';
import { $, data, recall, selected, setSelected } from './core/state.js';
import { detectedLabel } from './panel/connection.js';
import { renderPanel } from './panel/friend.js';
import { renderShelf } from './panel/invite.js';
import { renderAgentPets, renderDesktopSwitches, renderUpdate } from './panel/settings.js';
import { syncChatter } from './yard/care.js';
import { endGameIfSomeoneLeft, syncGameUi } from './yard/play.js';
import { hint, syncViews } from './yard/views.js';
export function render() {
  if (!data.pets.some(p => p.id === selected)) setSelected(data.pets[0]?.id || null);
  $('app-version').textContent = data.version ? `v${data.version}` : '';
  $('pet-count').textContent = !data.pets.length
    ? ''
    : data.pets.length === 1
      ? t('yard.count_one')
      : t('yard.count', { count: data.pets.length });
  hint();
  renderSteps();
  syncChatter();
  renderDesktopSwitches();
  renderUpdate();
  renderAgentPets();
  endGameIfSomeoneLeft();
  syncGameUi();
  syncViews();
  renderShelf();
  $('warnings').hidden = !data.warnings?.length;
  $('warnings').textContent = (data.warnings || []).join('\n');
  renderPanel();
}
// The first-run card: invite, give an AI, give an agent a friend. Done steps are ticked; the card
// goes once all three are done or when it is dismissed, and it keeps out of the way once friends
// are in the yard.
function renderSteps() {
  const done = {
    invite: data.pets.length > 0,
    ai: data.pets.some(p => p.providerId),
    agent: Object.keys(data.agentPets || {}).length > 0,
  };
  const all = done.invite && done.ai && done.agent;
  const card = $('empty-yard');
  card.hidden = all || (done.invite && recall('steps-dismissed') === '1');
  card.classList.toggle('aside', done.invite);
  for (const li of card.querySelectorAll('[data-step]')) {
    li.classList.toggle('done', !!done[li.dataset.step]);
    // The later steps wait for a friend: shown, but quiet, until the first one is invited.
    li.classList.toggle('waiting', li.dataset.step !== 'invite' && !done.invite);
  }
  // A subscription CLI on this computer makes the AI step one click, and the card says so.
  const tool = done.ai ? null : detectedLabel();
  card.querySelector('[data-step="ai"] [data-i18n]').textContent = tool
    ? t('steps.ai_detected', { tool })
    : t('steps.ai');
  $('step-ai').textContent = tool ? t('steps.go_connect') : t('steps.go_ai');
  $('steps-dismiss').hidden = !done.invite;
}
