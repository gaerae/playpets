// The settings tab and the desktop switches: linking coding agents, showing friends on the desktop,
// app updates, the app's own pages, quitting.
import { agentFile } from '../core/agent-files.js';
import { agentLabel, agentOf } from '../core/agents.js';
import { language, t } from '../core/i18n.js';
import { onShortcut } from '../core/keys.js';
import { projectLinks } from '../core/project.js';
import { $, call, data, guard, name, recall, remember, toast } from '../core/state.js';
import { LANGUAGES } from '../core/strings.js';
import { quitApp } from '../window.js';
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
  $('autostart').checked = !!data.autostart;
}
// App updates. A newer version ({version, notes}) found by a check (the quiet one after start, the
// Settings row, the tray or the menu bar) shows in three places: a button before the place selector
// that opens the update dialog, a dot on the Settings tab, and the row in About. "Later" puts the button
// away until the next start; the row and the dot stay.
const RESTART_KEY = 'update-restart';
let found = null;
let installing = false;
let later = false;
let updateStage = { phase: 'downloading' };
let updateError = '';
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
  if (installing) showUpdate(stageLabel(), t('settings.update_view'));
  else if (found)
    showUpdate(t('settings.update_available', { version: `v${found.version}` }), t('settings.update_view'));
  else
    showUpdate(
      t('settings.update_current', { version: data.version ? `v${data.version}` : '' }),
      t('settings.update_check'),
    );
  $('update-pill').hidden = !found || later;
  if (found) {
    $('update-pill-label').textContent = `${t('update.pill_label')} v${found.version}`;
    // In a narrow window only the icon shows, so the version remains in the tooltip and accessible label.
    const label = `${t('update.pill_title')} (v${found.version})`;
    $('update-pill').title = label;
    $('update-pill').setAttribute('aria-label', label);
  }
  document.querySelector('.panel-tab[data-panel=settings]')?.classList.toggle('has-update', !!found);
}
// The backend found a newer version on its own.
export function updateFound(update) {
  if (found?.version !== update.version) {
    later = false;
    updateError = '';
  }
  found = update;
  renderUpdate();
  toast(t('toast.update_available', { version: `v${update.version}` }));
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
function openUpdateDialog() {
  if (!found) return;
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
  $('update-later').disabled = installing;
  if (!$('update-dialog').open) $('update-dialog').showModal();
}
// Downloading shows in the dialog and in the row; when it is done the app starts again as the new version.
export function updateStatus(status) {
  if (!installing) return;
  updateStage = status;
  renderUpdate();
  if ($('update-dialog').open) openUpdateDialog();
}
async function install() {
  if (installing || !found) return;
  installing = true;
  updateStage = { phase: 'downloading' };
  updateError = '';
  renderUpdate();
  openUpdateDialog();
  remember(RESTART_KEY, JSON.stringify({ version: found.version, from: data.version }));
  try {
    await call('installUpdate');
  } catch (error) {
    remember(RESTART_KEY, '');
    installing = false;
    updateError = error.message;
    renderUpdate();
    openUpdateDialog();
    throw error;
  }
}
async function check() {
  showUpdate(t('settings.update_checking'), t('settings.update_check'));
  found = await call('checkUpdate');
  renderUpdate();
  if (!found) $('update-note').textContent = t('settings.update_latest', { version: `v${data.version}` });
}
// A part of a panel, opened from the tray or the menu bar ("about" is the About section).
export function showSection(panel, section) {
  openPanel(panel, section);
}
// From the tray or the menu bar: a known update opens its dialog; otherwise the Settings tab checks,
// so the answer has a place to show, and a newer version found there opens the dialog too.
export async function checkForUpdates() {
  if (found) return openUpdateDialog();
  showSection('settings', 'about');
  const button = $('update-button');
  if (button.disabled) return;
  button.disabled = true;
  try {
    await check();
    if (found) openUpdateDialog();
  } catch (error) {
    renderUpdate();
    throw error;
  } finally {
    button.disabled = false;
  }
}
async function updateButton() {
  const button = $('update-button');
  button.disabled = true;
  try {
    if (!found) await check();
    if (found) openUpdateDialog();
  } catch (error) {
    renderUpdate();
    throw error;
  } finally {
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
  $('quit-app').onclick = guard(quitApp);
  $('update-button').onclick = guard(updateButton);
  const notes = guard(() => call('openExternal', links().notes(found.version)));
  $('update-notes').onclick = notes;
  $('update-dialog-notes').onclick = notes;
  $('update-pill').onclick = () => openUpdateDialog();
  $('update-install').onclick = guard(install);
  $('update-later').onclick = () => {
    later = true;
    $('update-dialog').close();
    renderUpdate();
  };
  // While it downloads, the dialog stays: Esc does not close it.
  $('update-dialog').oncancel = event => {
    if (installing) event.preventDefault();
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
  ]) {
    const input = $(id);
    input.onchange = guard(async () => {
      input.disabled = true;
      try {
        await call(method, ...(id === 'auto-chatter' ? [input.checked] : []));
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
