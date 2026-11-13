// Brings every part of the page in line with the latest state from the backend.
import { put } from './core/dom.js';
import { t } from './core/i18n.js';
import { renderNotices } from './core/notices.js';
import { $, data, lastFriend, recall, selected, setSelected } from './core/state.js';
import { renderAlbum } from './panel/album.js';
import { CLI_LABELS, cliChoice } from './panel/cli-login.js';
import { renderPanel } from './panel/friend.js';
import { renderShelf } from './panel/invite.js';
import { renderAgentPets, renderConnections, renderDesktopSwitches } from './panel/settings.js';
import { renderUpdate, versionLabel } from './panel/update.js';
import { renderWindow } from './window.js';
import { renderBonds } from './yard/bond.js';
import { syncChatter } from './yard/care.js';
import { renderDecor } from './yard/decor.js';
import { renderDecorating } from './yard/decorating.js';
import { syncDiscovery } from './yard/discovery.js';
import { renderGarden } from './yard/garden.js';
import { hint } from './yard/hint.js';
import { renderTrees } from './yard/planted-trees.js';
import { endGameIfSomeoneLeft, syncGameUi } from './yard/play.js';
import { renderShoots } from './yard/shoots.js';
import { renderSound } from './yard/sound.js';
import { syncViews } from './yard/views.js';
import { onboardingSteps, renderWelcome } from './yard/welcome.js';
import { scene } from './yard/world.js';

// The backend pushes its whole state often with little or nothing changed: a scene echoed back, a
// chat's status, the switches at the start. A section whose input is the state alone keeps a cheap
// key of what it was last drawn from, and a push that leaves that as it was skips it. The rest
// read more than the state (a timer, a drag, a dialog's choices) and write only what differs.
const drawnFrom = new Map();
function changed(section, key) {
  if (drawnFrom.get(section) === key) return false;
  drawnFrom.set(section, key);
  return true;
}
export function render() {
  if (!data.pets.some(p => p.id === selected)) setSelected(lastFriend());
  put($('app-version'), 'textContent', versionLabel(data.version));
  put(
    $('pet-count'),
    'textContent',
    !data.pets.length
      ? ''
      : data.pets.length === 1
        ? t('yard.count_one')
        : t('yard.count', { count: data.pets.length }),
  );
  hint();
  $('layout').classList.toggle('no-friends', !data.pets.length);
  renderWindow();
  renderSteps();
  syncChatter();
  renderDesktopSwitches();
  renderUpdate();
  renderAgentPets();
  renderConnections();
  endGameIfSomeoneLeft();
  syncGameUi();
  syncViews();
  // A plant's stage by the clock is drawn by the garden's own minute (garden.js), a tree's by the
  // app's; another place or size draws them at once (app.js).
  const garden = JSON.stringify(data.garden ?? null);
  if (changed('garden', `${scene.world}|${garden}`)) renderGarden();
  renderDecor();
  if (changed('trees', `${scene.world}|${scene.season}|${JSON.stringify(data.limits ?? null)}|${garden}`))
    renderTrees();
  // After what stands on the ground: a shoot where a gift, a plant or a tree now stands is
  // not drawn.
  renderShoots();
  syncDiscovery();
  renderAlbum();
  renderDecorating();
  renderBonds();
  renderSound();
  renderShelf();
  renderNotices(data.warnings, !data.pets.length);
  renderPanel();
}
// The first-run card. An empty yard asks who to play with and shows the starter pets; once a friend
// is in, the card steps aside. Connecting an AI completes setup; coding hooks are optional.
function renderSteps() {
  const { done, hidden } = onboardingSteps(data.pets, data.agentPets, recall('steps-dismissed') === '1');
  const card = $('empty-yard');
  put(card, 'hidden', hidden);
  card.classList.toggle('aside', done.invite);
  put($('welcome'), 'hidden', done.invite);
  put($('next-steps'), 'hidden', !done.invite);
  if (!done.invite) renderWelcome();
  for (const li of card.querySelectorAll('[data-step]')) li.classList.toggle('done', !!done[li.dataset.step]);
  // A subscription CLI on this computer makes the AI step one click (a sign-in first when it is
  // signed out), and the card says so.
  const choice = done.ai ? null : cliChoice();
  const tool = choice && CLI_LABELS[choice.type];
  const signIn = choice?.signedIn === false;
  put(
    card.querySelector('[data-step="ai"] [data-i18n]'),
    'textContent',
    tool ? t(signIn ? 'steps.ai_login' : 'steps.ai_detected', { tool }) : t('steps.ai'),
  );
  put($('step-ai'), 'textContent', tool ? t(signIn ? 'steps.go_login' : 'steps.go_connect') : t('steps.go_ai'));
}
