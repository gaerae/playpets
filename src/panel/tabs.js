// One panel, three tabs. Closed, the yard has the whole window. Friend and Invite open beside the
// yard (a friend is talked to where it can be seen); Settings, which needs no view of the yard,
// opens as a wide sheet over it, with an index of its sections.
import { t } from '../core/i18n.js';
import { reduced, release } from '../core/sprites.js';
import { $, data, guard, remember } from '../core/state.js';
import { setMini } from '../window.js';
import { quickConnect } from './connection.js';
export const PANELS = ['pet', 'invite', 'settings'];
// Sheets shown only on the Invite tab are let go a minute after it closes, not at once, so
// flipping between tabs does not reload and re-decode every sheet.
let releaseTimer = 0;
const RELEASE_AFTER = 60_000;
export function openPanel(kind) {
  if (!$('panel-invite').hidden && kind !== 'invite') {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if ($('panel-invite').hidden) release(new Set(data.pets.map(p => p.assetId)));
    }, RELEASE_AFTER);
  }
  $('side-panel').hidden = !kind;
  $('layout').classList.toggle('panel-open', !!kind && kind !== 'settings');
  $('layout').classList.toggle('settings-open', kind === 'settings');
  for (const id of PANELS) $(`panel-${id}`).hidden = id !== kind;
  // The small window has no panel: opening one (double-click, the tray, a shortcut) goes back to full size.
  if (kind && document.body.classList.contains('mini')) guard(() => setMini(false))();
  // Each panel body names its title by key, so the head reads it in the current language.
  if (kind) $('panel-title').textContent = t($(`panel-${kind}`).dataset.title);
  for (const tab of document.querySelectorAll('.panel-tab'))
    tab.setAttribute('aria-expanded', String(tab.dataset.panel === kind));
  remember('panel', kind || 'closed');
}
// The Invite tab, with the first pet card ready for the keyboard.
export function openInvite() {
  openPanel('invite');
  $('shelf').querySelector('.asset-card')?.focus();
}
// Wires the tabs and the buttons that open a panel. Called once, by app.js.
export function setupTabs() {
  for (const tab of document.querySelectorAll('.panel-tab'))
    tab.onclick = () => openPanel(tab.getAttribute('aria-expanded') === 'true' ? null : tab.dataset.panel);
  // Closing with the panel's own button leaves the focus on the tab it belonged to, not lost on the page.
  $('close-panel').onclick = () => {
    const tab = document.querySelector('.panel-tab[aria-expanded="true"]');
    openPanel(null);
    tab?.focus();
  };
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
      $('layout').classList.contains('settings-open') &&
      !document.querySelector('dialog[open]')
    )
      openPanel(null);
  });
  // The index jumps to a section.
  for (const link of document.querySelectorAll('.settings-index [data-section]'))
    link.onclick = () =>
      $(link.dataset.section).scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
  $('go-invite').onclick = openInvite;
  // The steps left once a friend is in lead to where they are done.
  // With a CLI on this computer this connects every friend in one go; otherwise it opens the dialog.
  $('step-ai').onclick = guard(async () => {
    openPanel('pet');
    await quickConnect();
  });
  $('step-agent').onclick = () => {
    openPanel('settings');
    $('agent-link-title').scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
  };
  $('steps-dismiss').onclick = () => {
    remember('steps-dismissed', '1');
    $('empty-yard').hidden = true;
  };
}
