// App updates: the version waiting, its download and install, the Store's page for a Store copy,
// and the note after an update. The controls sit in Settings and as a pill beside the places.

import { closeUpdateDetails } from '../core/controls.js';
import { language, t } from '../core/i18n.js';
import { projectLinks } from '../core/project.js';
import { $, call, data, guard, recall, remember, toast } from '../core/state.js';
import { openPanel } from './tabs.js';

// A version as people see it, "v1.6.0"; nothing when it is not known yet.
export const versionLabel = version => (version ? `v${version}` : '');
// Update actions live in Settings; the yard entries only navigate there. Background discoveries
// and progress never open a panel or move focus.
const RESTART_KEY = 'update-restart';
// The version that ran last, so an update the Store or an installer made while the app was closed
// is noticed too.
const LAST_KEY = 'last-version';
let found = null;
let installing = false;
let later = false;
let updateStage = { phase: 'downloading' };
let updateError = '';
let checking = false;
function stageLabel() {
  if (updateStage.phase === 'verifying') return t('update.verifying');
  if (updateStage.phase === 'installing') return t('update.installing');
  if (Number.isFinite(updateStage.percent)) return t('update.progress', { percent: updateStage.percent });
  return t('update.downloading');
}
function showUpdate(note, button) {
  $('update-note').textContent = note;
  $('update-button').textContent = button;
  $('update-notes').hidden = !found;
}
export function renderUpdate() {
  // The Store keeps its own schedule; the note on quiet checks is about this app's own.
  $('update-auto').hidden = data.updateChannel === 'store';
  if (installing) showUpdate(stageLabel(), t('settings.update_view'));
  else if (found)
    showUpdate(t('settings.update_available', { version: versionLabel(found.version) }), t('settings.update_view'));
  else if (data.updateChannel === 'store') showUpdate(t('settings.update_store'), t('settings.update_check'));
  else showUpdate(t('settings.update_current', { version: versionLabel(data.version) }), t('settings.update_check'));
  const visible = !!found && (!later || installing || !!updateError);
  for (const id of ['update-pill', 'update-compact']) $(id).hidden = !visible;
  if (found) {
    const progress = Number.isFinite(updateStage.percent) ? ` (${updateStage.percent}%)` : '…';
    const label = updateError
      ? t('update.retry')
      : `${t('update.pill_label')}${installing ? progress : ` ${versionLabel(found.version)}`}`;
    const title =
      updateError || (installing ? stageLabel() : `${t('update.pill_title')} (${versionLabel(found.version)})`);
    for (const id of ['update-pill', 'update-compact']) {
      $(id).title = title;
      $(id).setAttribute('aria-label', title);
    }
    $('update-pill-label').textContent = label;
    $('update-compact-label').textContent = label;
  }
  paintUpdateDetails();
  $('menu-settings')?.classList.toggle('has-update', !!found);
}
// The backend found a newer version on its own.
export function updateFound(update) {
  if (!update?.version || installing) return;
  if (found?.version !== update.version) {
    later = false;
    updateError = '';
  }
  found = update;
  renderUpdate();
}
// A platform installer may end this process itself, so remember the target before handing it off.
// The new page confirms its own version after boot and clears the marker even if it is still old.
export function announceInstalledUpdate() {
  const pending = recall(RESTART_KEY);
  const last = recall(LAST_KEY);
  if (data.version) remember(LAST_KEY, data.version);
  let installed = !!last && newer(data.version, last);
  if (pending) {
    remember(RESTART_KEY, '');
    try {
      const { version, from } = JSON.parse(pending);
      installed ||= !!version && from !== version && data.version === version;
    } catch {}
  }
  if (installed) toast(t('toast.update_installed', { version: versionLabel(data.version) }));
}
// Whether version a comes after b, part by part as numbers (1.10.0 after 1.9.0).
function newer(a, b) {
  const parts = text =>
    String(text ?? '')
      .split('.')
      .map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
function paintUpdateDetails() {
  $('update-install').hidden = !found;
  $('update-cancel').hidden = true;
  if (!found) {
    $('update-title').textContent = t('settings.update');
    $('update-body').textContent = '';
    $('update-progress-wrap').hidden = true;
    $('update-error').hidden = !updateError;
    $('update-error').textContent = updateError;
    return;
  }
  const store = data.updateChannel === 'store';
  $('update-title').textContent = t('update.title', { version: versionLabel(found.version) });
  $('update-body').textContent = t(store ? 'update.store_body' : 'update.body', {
    current: versionLabel(data.version),
  });
  $('update-progress-wrap').hidden = !installing;
  $('update-progress').hidden = installing && updateStage.phase !== 'downloading';
  if (installing && Number.isFinite(updateStage.percent)) $('update-progress').value = updateStage.percent;
  else $('update-progress').removeAttribute('value');
  $('update-progress-label').textContent = installing ? stageLabel() : '';
  $('update-error').hidden = !updateError;
  $('update-error').textContent = updateError;
  $('update-install').disabled = installing;
  $('update-cancel').hidden = !installing || updateStage.phase !== 'downloading';
  $('update-install').textContent = updateError
    ? t('update.retry')
    : t(store ? 'settings.update_in_store' : 'settings.update_install');
  $('update-later').disabled = false;
  $('update-later').textContent = installing ? t('update.collapse') : t('update.later');
}
function revealUpdateDetails() {
  if (!found) return;
  paintUpdateDetails();
  $('update-dialog').hidden = false;
  for (const id of ['update-pill', 'update-compact']) $(id).setAttribute('aria-expanded', 'true');
  $('update-title').focus();
}
function openUpdatePanel() {
  if (!found) return;
  openPanel('settings', 'updates');
  revealUpdateDetails();
}
// Progress updates the existing surface without interrupting play or reopening collapsed details.
export function updateStatus(status) {
  if (!installing) return;
  updateStage = status;
  renderUpdate();
}
async function install() {
  if (installing || !found) return;
  // The Store downloads and installs it; this only opens PlayPets' page there.
  if (data.updateChannel === 'store') return call('installUpdate');
  installing = true;
  updateStage = { phase: 'downloading' };
  updateError = '';
  renderUpdate();
  paintUpdateDetails();
  remember(RESTART_KEY, JSON.stringify({ version: found.version, from: data.version }));
  try {
    // On success the app restarts and this never returns, unless the download was called off.
    if ((await call('installUpdate'))?.cancelled) stopInstalling();
  } catch (error) {
    updateError = error.message;
    stopInstalling();
  }
}
function stopInstalling() {
  remember(RESTART_KEY, '');
  installing = false;
  renderUpdate();
  paintUpdateDetails();
}
async function check() {
  showUpdate(t('settings.update_checking'), t('settings.update_check'));
  const result = await call('checkUpdate');
  if (result?.channel === 'store') data.updateChannel = 'store';
  found = result?.version ? result : null;
  renderUpdate();
  if (!found && data.updateChannel !== 'store')
    $('update-note').textContent = t('settings.update_latest', { version: versionLabel(data.version) });
}
function updateCheckVisible() {
  return (
    !$('side-panel').hidden &&
    !$('panel-settings').hidden &&
    !$('settings-updates').hidden &&
    !$('settings-content').hidden
  );
}
// Explicit navigation opens Updates once, before any network wait. A slow reply stays there even
// when the person has returned to the yard.
export async function checkForUpdates() {
  openPanel('settings', 'updates');
  if (found) return openUpdatePanel();
  return updateButton();
}
async function updateButton() {
  if (found) return openUpdatePanel();
  if (checking || installing) return;
  checking = true;
  updateError = '';
  paintUpdateDetails();
  const button = $('update-button');
  button.disabled = true;
  try {
    await check();
    if (found && updateCheckVisible()) {
      paintUpdateDetails();
      $('update-dialog').hidden = false;
    }
  } catch (error) {
    renderUpdate();
    updateError = error.message;
    paintUpdateDetails();
    $('update-dialog').hidden = !updateCheckVisible();
    // In a small window it opens below the fold, and the button would look as if nothing happened.
    $('update-error').scrollIntoView({ block: 'nearest' });
  } finally {
    checking = false;
    button.disabled = false;
  }
}
export function setupUpdates() {
  const notes = version => guard(() => call('openExternal', projectLinks(data.project, language()).notes(version())));
  $('update-button').onclick = guard(updateButton);
  $('update-notes').onclick = notes(() => found.version);
  $('update-this-version').onclick = notes(() => data.version);
  $('update-pill').onclick = openUpdatePanel;
  $('update-compact').onclick = openUpdatePanel;
  $('settings-updates-task')?.addEventListener('click', () => {
    if (found) openUpdatePanel();
  });
  $('update-install').onclick = guard(install);
  $('update-cancel').onclick = guard(() => call('cancelUpdate'));
  $('update-later').onclick = () => {
    if (!installing && !updateError) later = true;
    renderUpdate();
    // Later folds the details; Settings stays open where the person was.
    closeUpdateDetails();
  };
}
