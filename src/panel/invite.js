// The invite tab: pets on the shelf, and bringing new ones in from a page or a folder.

import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { canvas, drawSprite } from '../core/sprites.js';
import { $, call, data, guard, recall, remember, setSelected, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { bubble, pose } from '../yard/views.js';

const previews = new Map();
let shelfKey = '';
// Reloads the page's state; handed in by setupInvite.
let refresh = async () => {};
export async function invite(assetId) {
  const twins = data.pets.filter(p => p.assetId === assetId).length;
  const created = await call('addPet', assetId);
  setSelected(created.id);
  // Duplicates get a numbered name so people can tell them apart.
  if (twins > 0)
    await call('updatePet', created.id, {
      name: `${data.assets.find(a => a.id === assetId)?.displayName || t('friend.default')} ${twins + 1}`,
    });
  await refresh();
  const v = views.get(created.id);
  if (v) pose(v, 'wave', 1500);
  // The very first friend says how to talk to it, once.
  if (v && data.pets.length === 1 && recall('chat-tip') !== '1') {
    remember('chat-tip', '1');
    setTimeout(() => views.has(created.id) && bubble(v, t('hint.first_chat'), 7000), 1600);
  }
}
// The shelf is grouped by where the pet files live, so it is plain which folder each one is in.
// Codex's pet folder and the app's download folder each have one place to open; a folder picked
// by hand is its own place, named on the card.
const PLACES = [
  { place: 'builtin', title: t('invite.place_builtin'), folder: 'builtin' },
  { place: 'codex', title: t('invite.place_codex'), folder: 'codex' },
  { place: 'downloaded', title: t('invite.place_downloaded'), folder: 'downloaded' },
  { place: 'folder', title: t('invite.place_folder'), folder: null },
];
// Who made a downloaded pet, as the page it came from said: "Petdex · hongtao · CC BY-NC 4.0".
const creditLine = credit => [credit.site, credit.creator, credit.license].filter(Boolean).join(' · ');
function card(a) {
  const card = document.createElement('button');
  card.className = 'asset-card';
  card.dataset.assetId = a.id;
  card.setAttribute('aria-label', t('invite.add_aria', { name: a.displayName }));
  card.title = a.folderPath;
  const c = canvas(),
    info = document.createElement('span'),
    title = document.createElement('strong'),
    hint = document.createElement('small'),
    plus = document.createElement('span');
  info.className = 'asset-info';
  title.textContent = a.displayName;
  hint.className = 'asset-hint';
  plus.className = 'add-mark';
  plus.textContent = '+';
  info.append(title, hint);
  const from = a.credit
    ? creditLine(a.credit)
    : a.place === 'folder'
      ? t('invite.folder_name', { folder: a.folderPath.split(/[\\/]/).pop() })
      : '';
  if (from) {
    const line = document.createElement('small');
    line.className = 'asset-from';
    line.textContent = from;
    // The line is cut to one row on the narrow panel; the whole of it shows on hover.
    line.title = from;
    info.append(line);
  }
  card.append(c, info, plus);
  card.onclick = guard(() => invite(a.id));
  previews.set(a.id, c);
  return card;
}
function group({ place, title, folder }, assets) {
  const box = document.createElement('section');
  box.className = 'shelf-group';
  const head = document.createElement('div'),
    name = document.createElement('h4');
  head.className = 'shelf-group-head';
  name.textContent = title;
  head.append(name);
  if (folder) {
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'button text shelf-open';
    const icon = document.createElement('span');
    icon.dataset.icon = 'folder';
    open.append(icon, t('invite.open_folder'));
    open.title = data.petFolders?.[folder] || '';
    open.setAttribute('aria-label', t('invite.open_aria', { title }));
    open.onclick = guard(() => call('openFolder', folder));
    head.append(open);
  }
  box.append(head, ...assets.map(card));
  box.dataset.place = place;
  return box;
}
// The shelf can show only people, only animals, or the rest, by the pet file's `kind`.
let kind = '';
const ofKind = a => !kind || (kind === 'other' ? !['person', 'animal'].includes(a.kind) : a.kind === kind);
export function renderShelf() {
  const key = `${kind}|${data.assets.map(a => `${a.id}:${a.place}`).join('|')}`;
  if (key !== shelfKey) {
    shelfKey = key;
    previews.clear();
    const shown = data.assets.filter(ofKind);
    const groups = PLACES.map(p => [p, shown.filter(a => a.place === p.place)]).filter(([, list]) => list.length);
    $('shelf').replaceChildren(...groups.map(([p, list]) => group(p, list)));
    icons($('shelf'));
  }
  const limit = data.petLimit ?? 12,
    full = data.pets.length >= limit;
  // A full yard says why the cards cannot be pressed, and what to do.
  $('yard-full').hidden = !full;
  if (full) $('yard-full').textContent = t('invite.full', { limit });
  // A shape with no pets says so, with the way back to every pet.
  $('no-kind').hidden = !data.assets.length || data.assets.some(ofKind);
  for (const b of $('shelf').querySelectorAll('.asset-card')) {
    b.disabled = full;
    // The heading already says a click invites; a card adds a line only when that friend is in the
    // yard already, to say a click brings another.
    const hint = b.querySelector('.asset-hint');
    hint.textContent = data.pets.some(p => p.assetId === b.dataset.assetId) ? t('invite.one_more') : '';
    hint.hidden = !hint.textContent;
  }
  $('no-assets').hidden = data.assets.length > 0;
}
export function drawPreviews(now) {
  for (const a of data.assets) {
    const c = previews.get(a.id);
    if (c) drawSprite(c, a, 'idle', now);
  }
}
function openImportDialog() {
  $('import-form').reset();
  $('import-error').textContent = '';
  $('community-links').replaceChildren();
  for (const c of data.communities || []) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'button chip';
    link.textContent = c.importable ? c.name : t('invite.look_only', { name: c.name });
    link.title = !c.importable
      ? t('invite.not_importable')
      : c.hint
        ? t('invite.open_site_hint', { hint: c.hint, url: c.url })
        : t('invite.open_site', { url: c.url });
    link.onclick = guard(() => call('openExternal', c.url));
    $('community-links').append(link);
  }
  $('import-dialog').showModal();
  $('import-url').focus();
}
let importing = false;
// Wires the invite tab and the import dialog. `refresh` reloads the page's state once a friend arrives. Called once, by app.js.
export function setupInvite(hooks) {
  const chooseKind = chip => {
    kind = chip.dataset.kind;
    for (const c of document.querySelectorAll('#kind-filter .chip')) c.setAttribute('aria-pressed', String(c === chip));
    renderShelf();
  };
  for (const chip of document.querySelectorAll('#kind-filter .chip')) chip.onclick = () => chooseKind(chip);
  $('show-all-kinds').onclick = () => chooseKind(document.querySelector('#kind-filter .chip[data-kind=""]'));
  refresh = hooks.refresh;
  $('import').onclick = openImportDialog;
  $('close-import').onclick = $('cancel-import').onclick = () => $('import-dialog').close();
  // A folder that is not a pet is said inside the dialog, beside the address field's errors.
  $('import-folder').onclick = async () => {
    $('import-error').textContent = '';
    try {
      const id = await call('importFolder');
      if (!id) return;
      $('import-dialog').close();
      await invite(id);
      toast(t('toast.pet_added'));
    } catch (error) {
      $('import-error').textContent = spoken(error, t('error.generic'));
    }
  };
  $('import-dialog').addEventListener('cancel', e => {
    if (importing) e.preventDefault();
  });
  $('import-form').onsubmit = async e => {
    e.preventDefault();
    if (importing) return;
    const button = $('import-submit');
    importing = true;
    button.disabled = true;
    button.textContent = t('invite.importing');
    $('import-error').textContent = '';
    try {
      const id = await call('importUrl', $('import-url').value);
      $('import-dialog').close();
      await invite(id);
      toast(t('toast.pet_added'));
    } catch (error) {
      $('import-error').textContent = error.message;
    } finally {
      importing = false;
      button.disabled = false;
      button.textContent = t('invite.import_go');
    }
  };
}
