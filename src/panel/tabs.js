import { closeControls, closeScene, closeUpdateDetails, openControls } from '../core/controls.js';
// Management opens one task at a time; play never needs to pass through it.
import { t } from '../core/i18n.js';
import { release } from '../core/sprites.js';
import { $, data, guard, remember, rememberRun, selected, views } from '../core/state.js';
import { chatShown } from './chat.js';
import { closeConnectionEditor, quickConnect } from './connection.js';
export const PANELS = ['pet', 'invite', 'settings'];
// Sheets shown only on the Invite tab are let go a minute after it closes, not at once, so
// flipping between tabs does not reload and re-decode every sheet.
let releaseTimer = 0;
const RELEASE_AFTER = 60_000;
let settingsSection = 'general-title';
// A wide window lists the sections beside the open one, as System Settings does on macOS; a small
// one opens them one at a time, with Back to the list. The sections and their order are the same.
const sideBySide = () => !document.body.classList.contains('compact');
function selectSettingsSection(section, focus = false) {
  const links = [...document.querySelectorAll('.settings-index [data-section]')];
  const requested = section && !section.endsWith('-title') ? `${section}-title` : section;
  const active = links.find(link => link.dataset.section === requested) || links[0];
  if (!active) return;
  const next = active.dataset.section;
  // A new section starts at its top; so does one opened again from the list in a small window.
  if ($('settings-content') && (next !== settingsSection || (!sideBySide() && !$('settings-home')?.hidden)))
    $('settings-content').scrollTop = 0;
  settingsSection = next;
  if ($('settings-home')) $('settings-home').hidden = !sideBySide();
  if ($('settings-content')) $('settings-content').hidden = false;
  for (const link of links)
    if (link === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  const heading = $(next);
  const titleKey = active.querySelector('[data-i18n]')?.dataset.i18n || heading?.dataset.i18n;
  $('panel-title').textContent = t(titleKey || 'tabs.settings');
  // Back from a section always goes to the list of sections, however the section was opened; with
  // the list in view it goes where Back goes from any other panel.
  const back = t(sideBySide() ? 'controls.back' : 'settings.all');
  $('panel-menu')?.setAttribute('aria-label', back);
  $('panel-menu')?.setAttribute('title', back);
  for (const body of document.querySelectorAll('.settings-section[data-settings-section]')) {
    body.hidden = body.dataset.settingsSection !== next;
    // A section that reads something outside the app (an agent's settings file) reads it again.
    if (!body.hidden) body.dispatchEvent(new Event('settings-shown'));
  }
  if (focus) $('panel-title').focus({ preventScroll: true });
}
function showSettingsHome() {
  closeUpdateDetails();
  if (sideBySide()) return selectSettingsSection(settingsSection);
  if ($('settings-home')) $('settings-home').hidden = false;
  if ($('settings-content')) $('settings-content').hidden = true;
  $('panel-title').textContent = t('tabs.settings');
  $('panel-menu')?.setAttribute('aria-label', t('controls.back'));
  $('panel-menu')?.setAttribute('title', t('controls.back'));
}
let panelOpener = null;
let beforePanelOpen = () => {};
function closePanel() {
  const compact = document.body.classList.contains('compact');
  const tab = document.querySelector('.panel-tab[aria-expanded="true"]');
  const opener = panelOpener?.isConnected && panelOpener.getClientRects().length ? panelOpener : null;
  openPanel(null);
  (opener || (compact && (views.get(selected)?.button || $('yard'))) || $('yard-controls-toggle') || tab)?.focus();
  panelOpener = null;
}
export function openPanel(kind, section) {
  if (!kind) closeUpdateDetails();
  // Leaving Settings folds an AI connection being edited there; its form goes back to its dialog.
  if (kind !== 'settings' && $('panel-settings') && !$('panel-settings').hidden) closeConnectionEditor();
  if (kind) {
    beforePanelOpen(kind);
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
  if (kind) $('panel-title').textContent = t($(`panel-${kind}`).dataset.title);
  for (const tab of document.querySelectorAll('.panel-tab'))
    tab.setAttribute('aria-expanded', String(tab.dataset.panel === kind));
  rememberRun('panel', kind || 'closed');
  if (kind === 'settings') {
    if (section) selectSettingsSection(section, true);
    else showSettingsHome();
  } else {
    $('panel-menu')?.setAttribute('aria-label', t('controls.back'));
    $('panel-menu')?.setAttribute('title', t('controls.back'));
  }
  if (kind === 'pet') chatShown();
  // A chat is for writing in, whichever way it was reached.
  if (kind === 'pet' && !$('pet-panel').hidden) $('message').focus({ preventScroll: true });
  else if (kind && !(kind === 'settings' && section)) $('panel-title').focus({ preventScroll: true });
}
// The Invite tab, with the first pet card ready for the keyboard.
export function openInvite() {
  openPanel('invite');
  $('shelf').querySelector('.asset-card')?.focus();
}
// Wires the tabs and the buttons that open a panel. Called once, by app.js.
export function setupTabs({ beforeOpen = () => {} } = {}) {
  beforePanelOpen = beforeOpen;
  $('panel-menu')?.addEventListener('click', () => {
    if (!$('panel-settings').hidden && $('settings-home')?.hidden) {
      showSettingsHome();
      $('panel-title').focus();
    } else openControls();
  });
  for (const tab of document.querySelectorAll('.panel-tab[data-panel]'))
    tab.onclick = () =>
      openPanel(tab.getAttribute('aria-expanded') === 'true' ? null : tab.dataset.panel, tab.dataset.settingsSection);
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
      !e.isComposing &&
      !e.defaultPrevented &&
      ($('layout').classList.contains('settings-open') || $('layout').classList.contains('panel-open')) &&
      !document.querySelector('dialog[open]')
    ) {
      e.preventDefault();
      closePanel();
    }
  });
  // Beside the list, the focus stays on it to move on to the next section, as in a sidebar.
  for (const link of document.querySelectorAll('.settings-index [data-section]'))
    link.onclick = () => selectSettingsSection(link.dataset.section, !sideBySide());
  // window.js listens first and has already marked the page compact or not.
  globalThis.window?.addEventListener('resize', () => {
    const settings = $('panel-settings');
    // A small window showing the list stays on it; otherwise the open section is kept, and a focus
    // in the list that folds away moves to the section's title.
    if (settings && !settings.hidden && (sideBySide() || !$('settings-content')?.hidden))
      selectSettingsSection(settingsSection, !sideBySide() && !!$('settings-home')?.contains(document.activeElement));
  });
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
