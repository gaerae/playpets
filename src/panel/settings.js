// The settings tab and the desktop switches: the AI connections friends talk through, linking
// coding agents, showing friends on the desktop and the app's own pages. Updates are in update.js.

import { agentFile } from '../core/agent-files.js';
import { agentLabel, agentOf, linkView } from '../core/agents.js';
import { confirmAction } from '../core/confirm.js';
import { desktopTip } from '../core/controls.js';
import { put, putAttribute } from '../core/dom.js';
import { language, t } from '../core/i18n.js';
import { onShortcut } from '../core/keys.js';
import { projectLinks } from '../core/project.js';
import { $, call, data, guard, name, providerLabel, toast } from '../core/state.js';
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
  // Grok Build reads every file in its hooks folder, so PlayPets gets one of its own.
  if (kind === 'grok') return t('toast.copied_grok', { file });
  if (file && agentOf(data, kind)) return t('toast.copied', { tool: agentLabel(data, kind), file });
  return t('toast.copied_mcp');
}
// Where each agent stands, read from its own settings file (agent/connect.rs), kind → link.
let agentLinks = {};
// A write that failed leaves the link as it was, so only the row can say so.
const linkFailures = new Map();
export async function refreshLinks() {
  try {
    agentLinks = (await call('agentLinks')) || {};
  } catch {
    agentLinks = {};
  }
  renderLinks();
}
function renderLinks() {
  for (const button of document.querySelectorAll('#panel-settings button[data-connect]')) {
    const kind = button.dataset.connect,
      view = linkView(agentLinks[kind]),
      mark = document.querySelector(`[data-link-state="${kind}"]`),
      problem = document.querySelector(`[data-link-problem="${kind}"]`);
    button.hidden = !view.button;
    button.textContent = view.button ? t(view.button) : '';
    // Connecting is the row's main action; Disconnect stands back beside Copy settings.
    button.classList.toggle('primary', !!view.connect);
    button.classList.toggle('secondary', !view.connect);
    mark.hidden = !view.mark;
    mark.textContent = view.mark ? t(view.mark) : '';
    mark.classList.toggle('outdated', agentLinks[kind] === 'outdated');
    const failure = linkFailures.get(kind);
    problem.hidden = !view.problem && !failure;
    problem.textContent = failure || (view.problem ? t(view.problem) : '');
  }
}
// Connect asks first, naming the file it changes; Disconnect takes out only PlayPets' entries and
// Connect puts them back, so it is not asked.
export async function linkAgent(button) {
  const kind = button.dataset.connect,
    tool = agentLabel(data, kind),
    view = linkView(agentLinks[kind]);
  if (!view.button) return;
  if (view.connect) {
    const file = agentFile(data, kind, windows());
    const yes = await confirmAction({
      title: t('settings.connect_title', { tool }),
      body: t('settings.connect_body', { file }),
      action: t(view.button),
    });
    if (!yes) return;
  }
  button.disabled = true;
  linkFailures.delete(kind);
  try {
    agentLinks[kind] = await call(view.connect ? 'connectAgent' : 'disconnectAgent', kind);
    toast(t(view.connect ? 'toast.connected' : 'toast.disconnected', { tool }));
  } catch (error) {
    linkFailures.set(kind, error.message);
  } finally {
    button.disabled = false;
    await refreshLinks();
  }
}
export function renderDesktopSwitches() {
  // Desktop friends need someone in the yard; window pinning works independently.
  put($('desktop'), 'disabled', !data.pets.length);
  // A switch, as in the tray and the menu bar: the same words, and pressed while it is on. A narrow
  // window shows only the icon, so the words are the tooltip and the label too.
  const desktopLabel = t('desktop.show');
  put($('desktop-label'), 'textContent', desktopLabel);
  put($('desktop'), 'title', desktopLabel);
  putAttribute($('desktop'), 'aria-label', desktopLabel);
  putAttribute($('desktop'), 'aria-pressed', String(!!data.desktop));
  put($('wander-wrap'), 'hidden', false);
  put($('desktop-wander'), 'disabled', !data.desktop);
  $('desktop-wander').checked = !!data.desktopWander;
  $('auto-chatter').checked = !!data.autoChatter;
  $('auto-play').checked = !!data.autoPlay;
  $('autostart').checked = !!data.autostart;
}
// A part of a panel, opened from the tray or the menu bar ("about" is the About section).
export function showSection(panel, section) {
  openPanel(panel, section);
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
      // The row outlives a change it does not show (an address, a key), so Edit opens it as saved now.
      edit.onclick = () =>
        openConnectionDialog(data.providers.find(x => x.id === c.id) || c, () => {}, {
          forFriend: null,
          inline: $('ai-editor'),
        });
      row.append(copy, edit);
      return row;
    }),
  );
}
// Wires the settings tab and the desktop switches. Called once, by app.js.
export function setupSettings() {
  // The language: the backend remembers it, the page keeps a copy and starts over in it.
  const languages = $('language');
  // Each name says which language it is in, so a screen reader reads it in that language.
  languages.replaceChildren(
    ...Object.entries(LANGUAGES).map(([code, label]) => Object.assign(new Option(label, code), { lang: code })),
  );
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
        await refreshLinks();
        // A connected agent still names the friend it had until it is connected again.
        const key =
          agentLinks[kind] === 'outdated' ? 'settings.agent_pet_changed_linked' : 'settings.agent_pet_changed';
        toast(t(key, { name: chosen ? name(chosen) : t('settings.agent_pet_first') }));
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
  for (const button of document.querySelectorAll('#panel-settings button[data-connect]'))
    button.onclick = guard(() => linkAgent(button));
  $('settings-agents').addEventListener('settings-shown', refreshLinks);
  $('ai-add').onclick = () => openConnectionDialog(null, () => {}, { forFriend: null, inline: $('ai-editor') });
  // Where friends, settings and backups are kept, for a report or a copy by hand.
  $('open-data').onclick = guard(() => call('openFolder', 'data'));
  // Cmd+, (macOS, where the menu bar also has it) or Ctrl+, opens Settings, as in most desktop apps.
  onShortcut('settings', () => openPanel('settings'));
  for (const button of document.querySelectorAll('button[data-link]'))
    button.onclick = guard(() => call('openExternal', links()[button.dataset.link]));
  $('desktop').onclick = guard(async () => {
    // The first time friends go out on the desktop, how to talk to them there (it is not a double-click).
    if (await call('toggleDesktop')) desktopTip();
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
  // The system's own settings can change it while the app runs; coming back to the window asks again.
  window.addEventListener('focus', async () => {
    try {
      $('autostart').checked = await call('readAutostart');
    } catch {}
  });
}
