import { closeControls, closeScene, openControls } from '../core/controls.js';
// One panel, three tabs. Friend and Invite float over the yard without moving the friends.
// Settings, which needs no view of the yard,
// opens as a wide sheet over it, with an index of its sections.
import { t } from '../core/i18n.js';
import { release } from '../core/sprites.js';
import { $, data, guard, remember, selected, views } from '../core/state.js';
import { quickConnect } from './connection.js';
export const PANELS = ['pet', 'invite', 'settings'];
// Sheets shown only on the Invite tab are let go a minute after it closes, not at once, so
// flipping between tabs does not reload and re-decode every sheet.
let releaseTimer = 0;
const RELEASE_AFTER = 60_000;
let settingsSection = 'general-title';
function selectSettingsSection(section, focus = false) {
  const links = [...document.querySelectorAll('.settings-index [data-section]')];
  const requested = section && !section.endsWith('-title') ? `${section}-title` : section;
  const active = links.find(link => link.dataset.section === requested) || links[0];
  if (!active) return;
  const next = active.dataset.section;
  if (next !== settingsSection && $('settings-content')) $('settings-content').scrollTop = 0;
  settingsSection = next;
  if ($('settings-section')) $('settings-section').value = next;
  for (const body of document.querySelectorAll('.settings-section[data-settings-section]'))
    body.hidden = body.dataset.settingsSection !== next;
  for (const link of links) {
    const selected = link === active;
    link.setAttribute('aria-selected', String(selected));
    link.tabIndex = selected ? 0 : -1;
  }
  if (focus) $(next)?.focus?.({ preventScroll: true });
}
let panelOpener = null;
function closePanel() {
  const compact = document.body.classList.contains('compact');
  const tab = document.querySelector('.panel-tab[aria-expanded="true"]');
  const opener = panelOpener?.isConnected && panelOpener.getClientRects().length ? panelOpener : null;
  openPanel(null);
  (opener || (compact && (views.get(selected)?.button || $('yard'))) || $('yard-controls-toggle') || tab)?.focus();
  panelOpener = null;
}
export function openPanel(kind, section) {
  if (kind) {
    closeControls(false);
    closeScene();
  }
  if (!$('panel-invite').hidden && kind !== 'invite') {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if ($('panel-invite').hidden) release(new Set(data.pets.map(p => p.assetId)));
    }, RELEASE_AFTER);
  }
  if (kind && $('side-panel').hidden)
    panelOpener = document.activeElement?.matches('button, a, input, select, textarea') ? document.activeElement : null;
  $('side-panel').hidden = !kind;
  $('layout').classList.toggle('panel-open', !!kind && kind !== 'settings');
  $('layout').classList.toggle('settings-open', kind === 'settings');
  for (const id of PANELS) $(`panel-${id}`).hidden = id !== kind;
  // Each panel body names its title by key, so the head reads it in the current language.
  if (kind)
    $('panel-title').textContent =
      kind === 'pet' && !$('pet-panel')?.hidden && $('selected-name')?.textContent
        ? $('selected-name').textContent
        : t($(`panel-${kind}`).dataset.title);
  for (const tab of document.querySelectorAll('.panel-tab'))
    tab.setAttribute('aria-expanded', String(tab.dataset.panel === kind));
  remember('panel', kind || 'closed');
  if (kind === 'settings') selectSettingsSection(section || settingsSection, !!section);
  if (kind && !(kind === 'settings' && section)) $('panel-title').focus({ preventScroll: true });
}
// The Invite tab, with the first pet card ready for the keyboard.
export function openInvite() {
  openPanel('invite');
  $('shelf').querySelector('.asset-card')?.focus();
}
// Wires the tabs and the buttons that open a panel. Called once, by app.js.
export function setupTabs() {
  $('panel-menu')?.addEventListener('click', openControls);
  if ($('settings-section')) $('settings-section').onchange = () => selectSettingsSection($('settings-section').value);
  for (const tab of document.querySelectorAll('.panel-tab[data-panel]'))
    tab.onclick = () => openPanel(tab.getAttribute('aria-expanded') === 'true' ? null : tab.dataset.panel);
  // Closing with the panel's own button leaves the focus on the tab it belonged to, not lost on the page.
  $('close-panel').onclick = closePanel;
  // The brand goes "home": the yard alone, the panel closed.
  document.querySelector('.brand').onclick = e => {
    e.preventDefault();
    openPanel(null);
  };
  // The sheet goes with a click beside it or Esc, as sheets do.
  $('layout').addEventListener('click', e => {
    if (e.target === $('layout') && $('layout').classList.contains('settings-open')) openPanel(null);
  });
  document.addEventListener('keydown', e => {
    if (
      e.key === 'Escape' &&
      !e.defaultPrevented &&
      ($('layout').classList.contains('settings-open') || $('layout').classList.contains('panel-open')) &&
      !document.querySelector('dialog[open]')
    ) {
      e.preventDefault();
      closePanel();
    }
  });
  // Each Settings tab owns one body; scrolling never moves its navigation away.
  const links = [...document.querySelectorAll('.settings-index [data-section]')];
  const index = document.querySelector('.settings-index');
  if (index && typeof matchMedia === 'function') {
    const compact = matchMedia('(max-width: 760px)');
    const orient = () => index.setAttribute('aria-orientation', compact.matches ? 'horizontal' : 'vertical');
    compact.addEventListener('change', orient);
    orient();
  }
  for (const [index, link] of links.entries()) {
    link.onclick = () => selectSettingsSection(link.dataset.section);
    link.onkeydown = e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const next =
        e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : (index + step + links.length) % links.length;
      selectSettingsSection(links[next].dataset.section);
      links[next].focus();
    };
  }
  selectSettingsSection(settingsSection);
  $('go-invite').onclick = openInvite;
  // The steps left once a friend is in lead to where they are done.
  // With a CLI on this computer this connects every friend in one go; otherwise it opens the dialog.
  $('step-ai').onclick = guard(async () => {
    openPanel('pet');
    await quickConnect();
  });
  $('step-agent').onclick = () => {
    openPanel('settings', 'agent-link-title');
  };
  $('steps-dismiss').onclick = () => {
    remember('steps-dismissed', '1');
    $('empty-yard').hidden = true;
  };
}
