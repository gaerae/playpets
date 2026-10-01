// The settings tab and the desktop switches: linking coding agents, showing friends on the desktop, quitting.
import { agentFile } from '../core/agent-files.js';
import { agentLabel, agentOf } from '../core/agents.js';
import { confirmAction } from '../core/confirm.js';
import { language, t } from '../core/i18n.js';
import { $, call, data, guard, name, toast } from '../core/state.js';
import { LANGUAGES } from '../core/strings.js';

const windows = () => /Windows/.test(navigator.userAgent);
// What to do with the copied settings, named the same way as in the list.
function copied(kind) {
  const file = agentFile(data, kind, windows());
  if (kind === 'codex') return t('toast.copied_codex', { file });
  if (file && agentOf(data, kind)) return t('toast.copied', { tool: agentLabel(data, kind), file });
  return t('toast.copied_mcp');
}
export function renderDesktopSwitches() {
  $('desktop').disabled = !data.pets.length;
  $('desktop-label').textContent = data.desktop ? t('desktop.hide') : t('desktop.show');
  $('wander-wrap').hidden = !data.desktop;
  $('desktop-wander').checked = !!data.desktopWander;
  $('auto-chatter').checked = !!data.autoChatter;
}
// App updates: the row says which version this is, then what a check found. `found` is the
// newer version ({version, notes}) once a check (the button, or the quiet one after start) saw it.
let found = null;
function showUpdate(note, button) {
  $('update-note').textContent = note;
  $('update-button').textContent = button;
}
export function renderUpdate() {
  if (found) showUpdate(t('settings.update_available', { version: `v${found.version}` }), t('settings.update_install'));
  else
    showUpdate(
      t('settings.update_current', { version: data.version ? `v${data.version}` : '' }),
      t('settings.update_check'),
    );
}
// The backend found a newer version on its own.
export function updateFound(update) {
  found = update;
  renderUpdate();
  toast(t('toast.update_available', { version: `v${update.version}` }));
}
async function updateButton() {
  const button = $('update-button');
  button.disabled = true;
  try {
    if (found) {
      showUpdate(t('settings.update_installing'), t('settings.update_install'));
      await call('installUpdate'); // The app starts again as the new version.
      return;
    }
    showUpdate(t('settings.update_checking'), t('settings.update_check'));
    found = await call('checkUpdate');
    renderUpdate();
    if (!found) $('update-note').textContent = t('settings.update_latest', { version: `v${data.version}` });
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
      await call('assignAgent', select.dataset.agent, select.value);
      const chosen = data.pets.find(p => p.id === select.value);
      toast(t('settings.agent_pet_changed', { name: chosen ? name(chosen) : t('settings.agent_pet_first') }));
    });
  for (const button of document.querySelectorAll('button[data-kind]'))
    button.onclick = guard(async () => {
      const kind = button.dataset.kind;
      await call('copyConnection', kind);
      toast(copied(kind));
    });
  $('quit-app').onclick = guard(async () => {
    const sure = await confirmAction({
      title: t('quit.title'),
      body: t('quit.body'),
      action: t('quit.action'),
      danger: false,
    });
    if (!sure) return;
    await call('quitApp');
  });
  $('update-button').onclick = guard(updateButton);
  $('desktop').onclick = guard(() => call('toggleDesktop'));
  $('desktop-wander').onchange = guard(() => call('toggleDesktopWander'));
  $('auto-chatter').onchange = guard(() => call('setAutoChatter', $('auto-chatter').checked));
}
