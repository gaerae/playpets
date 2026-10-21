// The settings tab and the desktop switches: the AI connections friends talk through, linking
// coding agents, showing friends on the desktop, app updates and the app's own pages.

import { agentFile } from '../core/agent-files.js';
import { agentLabel, agentOf } from '../core/agents.js';
import { closeUpdateDetails } from '../core/controls.js';
import { language, t } from '../core/i18n.js';
import { onShortcut } from '../core/keys.js';
import { projectLinks } from '../core/project.js';
import { $, call, data, guard, name, providerLabel, recall, remember, toast } from '../core/state.js';
import { LANGUAGES } from '../core/strings.js';
import { openConnectionDialog } from './connection.js';
import { openPanel } from './tabs.js';

const windows = () => /Windows/.test(navigator.userAgent);
// The site and repository pages, in the site's language for the app's language.
const links = () => projectLinks(data.project, language());
// What to do with the copied settings, named the same way as in the list.
function copied(kind) {
  const file = agentFile(data, kind, windows());
  if (kind === 'codex') return t('toast.copied_codex', { file });
  if (file && agentOf(data, kind)) return t('toast.copied', { tool: agentLabel(data, kind), file });
  return t('toast.copied_mcp');
}
export function renderDesktopSwitches() {
  // Desktop friends need someone in the yard; window pinning works independently.
  $('desktop').disabled = !data.pets.length;
  // A switch, as in the tray and the menu bar: the same words, and pressed while it is on. A narrow
  // window shows only the icon, so the words are the tooltip and the label too.
  const desktopLabel = t('desktop.show');
  $('desktop-label').textContent = desktopLabel;
  $('desktop').title = desktopLabel;
  $('desktop').setAttribute('aria-label', desktopLabel);
  $('desktop').setAttribute('aria-pressed', String(!!data.desktop));
  $('wander-wrap').hidden = false;
  $('desktop-wander').disabled = !data.desktop;
  $('desktop-wander').checked = !!data.desktopWander;
  $('auto-chatter').checked = !!data.autoChatter;
  $('auto-play').checked = !!data.autoPlay;
  $('autostart').checked = !!data.autostart;
}
// Update actions live in Settings; the yard entries only navigate there. Background discoveries
// and progress never open a panel or move focus.
const RESTART_KEY = 'update-restart';
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
  const store = data.updateChannel === 'store';
  $('update-button').hidden = store;
  if (store) {
    found = null;
    showUpdate(t('settings.update_store'), '');
    $('update-pill').hidden = true;
    $('update-compact').hidden = true;
    closeUpdateDetails();
    $('menu-settings')?.classList.remove('has-update');
    return;
  }
  if (installing) showUpdate(stageLabel(), t('settings.update_view'));
  else if (found)
    showUpdate(t('settings.update_available', { version: `v${found.version}` }), t('settings.update_view'));
  else
    showUpdate(
      t('settings.update_current', { version: data.version ? `v${data.version}` : '' }),
      t('settings.update_check'),
    );
  const visible = !!found && (!later || installing || !!updateError);
  for (const id of ['update-pill', 'update-compact']) $(id).hidden = !visible;
  if (found) {
    const progress = Number.isFinite(updateStage.percent) ? ` (${updateStage.percent}%)` : '…';
    const label = updateError
      ? t('update.retry')
      : `${t('update.pill_label')}${installing ? progress : ` v${found.version}`}`;
    const title = updateError || (installing ? stageLabel() : `${t('update.pill_title')} (v${found.version})`);
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
  if (!pending) return;
  remember(RESTART_KEY, '');
  try {
    const { version, from } = JSON.parse(pending);
    if (version && from !== version && data.version === version)
      toast(t('toast.update_installed', { version: `v${version}` }));
  } catch {}
}
function paintUpdateDetails() {
  $('update-install').hidden = !found;
  if (!found) {
    $('update-title').textContent = t('settings.update');
    $('update-body').textContent = '';
    $('update-progress-wrap').hidden = true;
    $('update-error').hidden = !updateError;
    $('update-error').textContent = updateError;
    return;
  }
  $('update-title').textContent = t('update.title', { version: `v${found.version}` });
  $('update-body').textContent = t('update.body', { current: `v${data.version}` });
  $('update-progress-wrap').hidden = !installing;
  $('update-progress').hidden = installing && updateStage.phase !== 'downloading';
  if (installing && Number.isFinite(updateStage.percent)) $('update-progress').value = updateStage.percent;
  else $('update-progress').removeAttribute('value');
  $('update-progress-label').textContent = installing ? stageLabel() : '';
  $('update-error').hidden = !updateError;
  $('update-error').textContent = updateError;
  $('update-install').disabled = installing;
  $('update-install').textContent = updateError ? t('update.retry') : t('settings.update_install');
  $('update-later').disabled = false;
  $('update-later').textContent = installing ? t('update.collapse') : t('update.later');
}
function revealUpdateDetails() {
  if (!found || data.updateChannel === 'store') return;
  paintUpdateDetails();
  $('update-dialog').hidden = false;
  for (const id of ['update-pill', 'update-compact']) $(id).setAttribute('aria-expanded', 'true');
  $('update-title').focus();
}
function openUpdatePanel() {
  if (!found || data.updateChannel === 'store') return;
  showSection('settings', 'updates');
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
  installing = true;
  updateStage = { phase: 'downloading' };
  updateError = '';
  renderUpdate();
  paintUpdateDetails();
  remember(RESTART_KEY, JSON.stringify({ version: found.version, from: data.version }));
  try {
    await call('installUpdate');
  } catch (error) {
    remember(RESTART_KEY, '');
    installing = false;
    updateError = error.message;
    renderUpdate();
    paintUpdateDetails();
  }
}
async function check() {
  showUpdate(t('settings.update_checking'), t('settings.update_check'));
  const result = await call('checkUpdate');
  if (result?.channel === 'store') data.updateChannel = 'store';
  found = result?.channel === 'store' ? null : result;
  renderUpdate();
  if (!found && data.updateChannel !== 'store')
    $('update-note').textContent = t('settings.update_latest', { version: `v${data.version}` });
}
// A part of a panel, opened from the tray or the menu bar ("about" is the About section).
export function showSection(panel, section) {
  openPanel(panel, section);
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
  showSection('settings', 'updates');
  if (data.updateChannel === 'store') return renderUpdate();
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
  } finally {
    checking = false;
    button.disabled = false;
  }
}
// The friend selects follow the friends in the yard and the saved assignments.
let agentPetsKey = '';
export function renderAgentPets() {
  const key = `${data.pets.map(p => `${p.id}:${name(p)}`).join('|')}#${JSON.stringify(data.agentPets || {})}`;
  if (key === agentPetsKey) return;
  agentPetsKey = key;
  for (const select of document.querySelectorAll('select[data-agent]')) {
    const chosen = data.agentPets?.[select.dataset.agent] || '';
    select.replaceChildren(
      new Option(t('settings.agent_pet_first'), ''),
      ...data.pets.map(p => new Option(name(p), p.id)),
    );
    select.value = data.pets.some(p => p.id === chosen) ? chosen : '';
    select.disabled = data.pets.length === 0;
  }
}
// Every AI connection in one list, each with the friends using it and a way to edit or remove it
// (the connection dialog). Rebuilt only when a connection or who uses it changes.
let connectionsKey = '';
export function renderConnections() {
  const list = $('ai-connections');
  if (!list) return;
  const uses = id => data.pets.filter(p => p.providerId === id).length;
  const key = JSON.stringify([language(), data.providers.map(c => [c.id, providerLabel(c), uses(c.id)])]);
  if (key === connectionsKey) return;
  connectionsKey = key;
  $('ai-none').hidden = data.providers.length > 0;
  list.replaceChildren(
    ...data.providers.map(c => {
      const row = document.createElement('li'),
        copy = document.createElement('div'),
        title = document.createElement('strong'),
        note = document.createElement('small'),
        edit = document.createElement('button');
      row.className = 'link-row';
      title.id = `ai-name-${c.id}`;
      title.textContent = providerLabel(c);
      const count = uses(c.id);
      note.textContent = count ? t('settings.ai_used_by', { count }) : t('settings.ai_unused');
      copy.append(title, note);
      edit.type = 'button';
      edit.id = `ai-edit-${c.id}`;
      edit.className = 'button secondary small';
      edit.textContent = t('settings.ai_edit');
      edit.setAttribute('aria-labelledby', `${edit.id} ${title.id}`);
      edit.onclick = () => openConnectionDialog(c);
      row.append(copy, edit);
      return row;
    }),
  );
}
// Wires the settings tab and the desktop switches. Called once, by app.js.
export function setupSettings() {
  // The language: the backend remembers it, the page keeps a copy and starts over in it.
  const languages = $('language');
  languages.replaceChildren(...Object.entries(LANGUAGES).map(([code, label]) => new Option(label, code)));
  languages.value = language();
  languages.onchange = guard(async () => {
    // The backend reloads every window in the new language, this one included.
    await call('setLanguage', languages.value);
  });
  // A long path may wrap, but only after a folder separator, never inside a name.
  for (const code of document.querySelectorAll('[data-agent-file]')) {
    const parts = agentFile(data, code.dataset.agentFile, windows())
      .match(/[^\\/]*[\\/]?/g)
      .filter(Boolean);
    code.replaceChildren(...parts.flatMap((part, i) => (i ? [document.createElement('wbr'), part] : [part])));
  }
  // Which friend each agent reports to. The copied settings carry the choice, so they must be pasted again.
  for (const select of document.querySelectorAll('select[data-agent]'))
    select.onchange = guard(async () => {
      const kind = select.dataset.agent,
        requested = select.value;
      select.disabled = true;
      try {
        await call('assignAgent', kind, requested);
        const chosen = data.pets.find(p => p.id === requested);
        toast(t('settings.agent_pet_changed', { name: chosen ? name(chosen) : t('settings.agent_pet_first') }));
      } catch (error) {
        const current = data.agentPets?.[kind] || '';
        select.value = data.pets.some(p => p.id === current) ? current : '';
        throw error;
      } finally {
        select.disabled = !data.pets.length;
      }
    });
  for (const button of document.querySelectorAll('#panel-settings button[data-kind]'))
    button.onclick = guard(async () => {
      const kind = button.dataset.kind;
      await call('copyConnection', kind);
      toast(copied(kind));
    });
  $('ai-add').onclick = () => openConnectionDialog(null);
  $('update-button').onclick = guard(updateButton);
  const notes = guard(() => call('openExternal', links().notes(found.version)));
  $('update-notes').onclick = notes;
  $('update-pill').onclick = openUpdatePanel;
  $('update-compact').onclick = openUpdatePanel;
  $('settings-updates-task')?.addEventListener('click', () => {
    if (found && data.updateChannel !== 'store') openUpdatePanel();
  });
  $('update-install').onclick = guard(install);
  $('update-later').onclick = () => {
    if (!installing && !updateError) later = true;
    renderUpdate();
    // Later folds the details; Settings stays open where the person was.
    closeUpdateDetails();
  };
  // Cmd+, (macOS, where the menu bar also has it) or Ctrl+, opens Settings, as in most desktop apps.
  onShortcut('settings', () => openPanel('settings'));
  for (const button of document.querySelectorAll('button[data-link]'))
    button.onclick = guard(() => call('openExternal', links()[button.dataset.link]));
  $('desktop').onclick = guard(async () => {
    const turningOn = !data.desktop;
    await call('toggleDesktop');
    // The first time friends go out on the desktop, how to talk to them there (it is not a double-click).
    if (turningOn && recall('desktop-tip') !== '1') {
      remember('desktop-tip', '1');
      toast(t('toast.desktop_tip'));
    }
  });
  for (const [id, method, key] of [
    ['desktop-wander', 'toggleDesktopWander', 'desktopWander'],
    ['auto-chatter', 'setAutoChatter', 'autoChatter'],
    ['auto-play', 'setAutoPlay', 'autoPlay'],
  ]) {
    const input = $(id);
    input.onchange = guard(async () => {
      input.disabled = true;
      try {
        await call(method, ...(id === 'desktop-wander' ? [] : [input.checked]));
      } catch (error) {
        input.checked = !!data[key];
        throw error;
      } finally {
        input.disabled = false;
      }
    });
  }
  // What the system ended up with is shown, also when it refused the change.
  $('autostart').onchange = guard(async () => {
    const want = $('autostart').checked;
    try {
      $('autostart').checked = await call('setAutostart', want);
    } catch (e) {
      $('autostart').checked = !want;
      throw e;
    }
  });
}
