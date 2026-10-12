// Brings every part of the page in line with the latest state from the backend.
import { t } from './core/i18n.js';
import { $, data, recall, selected, setSelected } from './core/state.js';
import { renderAlbum } from './panel/album.js';
import { detectedLabel } from './panel/connection.js';
import { renderPanel } from './panel/friend.js';
import { renderShelf } from './panel/invite.js';
import { renderAgentPets, renderDesktopSwitches, renderUpdate } from './panel/settings.js';
import { isMini, setMini } from './window.js';
import { renderBonds } from './yard/bond.js';
import { syncChatter } from './yard/care.js';
import { renderDecor } from './yard/decor.js';
import { renderGarden } from './yard/garden.js';
import { hint } from './yard/hint.js';
import { endGameIfSomeoneLeft, syncGameUi } from './yard/play.js';
import { renderSound } from './yard/sound.js';
import { syncViews } from './yard/views.js';
import { onboardingSteps, renderWelcome } from './yard/welcome.js';
export function render() {
  if (!data.pets.some(p => p.id === selected)) setSelected(data.pets[0]?.id || null);
  $('app-version').textContent = data.version ? `v${data.version}` : '';
  $('pet-count').textContent = !data.pets.length
    ? ''
    : data.pets.length === 1
      ? t('yard.count_one')
      : t('yard.count', { count: data.pets.length });
  hint();
  $('layout').classList.toggle('no-friends', !data.pets.length);
  // The last friend gone, the small window has nothing to show: the yard comes back to full size.
  if (!data.pets.length && isMini()) setMini(false).catch(() => {});
  renderSteps();
  syncChatter();
  renderDesktopSwitches();
  renderUpdate();
  renderAgentPets();
  endGameIfSomeoneLeft();
  syncGameUi();
  syncViews();
  renderGarden();
  renderDecor();
  renderAlbum();
  renderBonds();
  renderSound();
  renderShelf();
  $('warnings').hidden = !data.warnings?.length;
  $('warnings').textContent = (data.warnings || []).join('\n');
  renderPanel();
}
// The first-run card. An empty yard asks who to play with and shows the starter pets; once a friend
// is in, the card steps aside. Connecting an AI completes setup; coding hooks are optional.
function renderSteps() {
  const { done, hidden } = onboardingSteps(data.pets, data.agentPets, recall('steps-dismissed') === '1');
  const card = $('empty-yard');
  card.hidden = hidden;
  card.classList.toggle('aside', done.invite);
  $('welcome').hidden = done.invite;
  $('next-steps').hidden = !done.invite;
  if (!done.invite) renderWelcome();
  for (const li of card.querySelectorAll('[data-step]')) li.classList.toggle('done', !!done[li.dataset.step]);
  // A subscription CLI on this computer makes the AI step one click, and the card says so.
  const tool = done.ai ? null : detectedLabel();
  card.querySelector('[data-step="ai"] [data-i18n]').textContent = tool
    ? t('steps.ai_detected', { tool })
    : t('steps.ai');
  $('step-ai').textContent = tool ? t('steps.go_connect') : t('steps.go_ai');
}
