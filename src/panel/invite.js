// The invite tab: pets on the shelf, bringing new ones in from a page, a ZIP or a folder, and
// taking those back off.

import { confirmAction, keepEdits, showFormError } from '../core/confirm.js';
import { joinList, language, t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { limit } from '../core/limits.js';
import { canvas, drawSprite } from '../core/sprites.js';
import { $, call, data, guard, name, recall, remember, selected, setSelected, toast, views } from '../core/state.js';
import { spoken } from '../core/text.js';
import { bubble, pose } from '../yard/views.js';
import { swapDraft } from './chat.js';
import { sharedConnection } from './connection.js';

const previews = new Map();
const inviting = new Set();
let shelfKey = '';
// Reloads the page's state; handed in by setupInvite.
let refresh = async () => {};
/** A name for another friend from the same pet file: its own title while free, else the first
 * number not taken, so sending one away and inviting again never repeats a name. */
export function twinName(title, taken) {
  if (!taken.has(title)) return title;
  let n = 2;
  while (taken.has(`${title} ${n}`)) n++;
  return `${title} ${n}`;
}
export async function invite(assetId) {
  const original = data.assets.find(a => a.id === assetId),
    patch = { visualStyle: 'illustrated' },
    twins = data.pets.filter(p => p.assetId === assetId).length,
    title = original?.displayName || t('friend.default');
  // A friend never renamed goes by its pet file's title.
  const called = p => p.name || data.assets.find(a => a.id === p.assetId)?.displayName;
  if (twins > 0) patch.name = twinName(title, new Set(data.pets.map(called)));
  const shared = sharedConnection();
  const created = await call('addPet', assetId, patch);
  if (shared) await call('updatePet', created.id, { providerId: shared });
  swapDraft(selected, created.id);
  setSelected(created.id);
  remember('friend', created.id);
  await refresh();
  const v = views.get(created.id);
  if (v) pose(v, 'wave', 1500);
  // The very first friend says how to talk to it, once.
  if (v && data.pets.length === 1 && recall('chat-tip') !== '1') {
    remember('chat-tip', '1');
    setTimeout(() => views.has(created.id) && bubble(v, t('hint.first_chat'), 7000), 1600);
  }
}
// A pet that came in joins the yard if it can. With the yard full, or that pet already in it, the
// import still worked: the pet is on the shelf, whose note says the rest.
export async function arrived(id) {
  const stays = data.pets.length >= limit(data, 'pets') || data.pets.some(p => p.assetId === id);
  if (stays) await refresh();
  else await invite(id);
  $('import-dialog').close();
  const title = data.assets.find(a => a.id === id)?.displayName || t('friend.default');
  toast(stays ? t('invite.linked', { name: title }) : t('toast.pet_added'));
}
// The shelf is grouped by where the pet files live, so it is plain which folder each one is in.
// Codex's pet folder and the app's download folder each have one place to open; a folder picked
// by hand is its own place, named on the card.
const PLACES = [
  { place: 'builtin', title: 'invite.place_builtin', folder: 'builtin' },
  { place: 'codex', title: 'invite.place_codex', folder: 'codex' },
  { place: 'downloaded', title: 'invite.place_downloaded', folder: 'downloaded' },
  { place: 'folder', title: 'invite.place_folder', folder: null },
];
const folderName = a =>
  String(a.folderPath || '')
    .split(/[\\/]/)
    .pop();
// Who made a downloaded pet, as the page it came from said: "Petdex, hongtao, CC BY-NC 4.0".
const creditLine = credit => joinList([credit.site, credit.creator, credit.license].filter(Boolean));
function card(a) {
  const card = document.createElement('button');
  card.className = 'asset-card';
  // The asset id is the card's key: each catalog asset is one card, packages with optional legacy
  // looks included.
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
      ? t('invite.folder_name', { folder: folderName(a) })
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
  card.onclick = guard(async () => {
    if (card.disabled) return;
    inviting.add(a.id);
    renderShelf();
    try {
      await invite(a.id);
    } finally {
      inviting.delete(a.id);
      renderShelf();
    }
  });
  previews.set(a.id, { canvas: c, asset: a });
  return card;
}
// A pet brought in by hand (from an address, a ZIP or a picked folder) can leave the shelf. The
// card is itself a button, so its remove button stands beside it rather than inside.
const REMOVABLE = new Set(['downloaded', 'folder']);
function entry(a) {
  const c = card(a);
  if (!REMOVABLE.has(a.place)) return c;
  const slot = document.createElement('div'),
    remove = document.createElement('button'),
    icon = document.createElement('span'),
    label = t('invite.remove_aria', { name: a.displayName });
  slot.className = 'asset-slot';
  remove.type = 'button';
  remove.className = 'icon-button asset-remove';
  remove.dataset.assetId = a.id;
  remove.setAttribute('aria-label', label);
  remove.title = label;
  icon.dataset.icon = 'trash';
  remove.append(icon);
  remove.onclick = guard(() => removeAsset(a));
  slot.append(c, remove);
  return slot;
}
// Friends made from the pet keep it: they are named, so the person knows whom to send away first.
// An imported pet's files go with it; a picked folder only leaves the list.
async function removeAsset(a) {
  const users = data.pets.filter(p => p.assetId === a.id);
  if (users.length) {
    toast(t('invite.remove_in_use', { names: joinList(users.map(name)) }));
    return;
  }
  const picked = a.place === 'folder';
  const sure = await confirmAction({
    title: t('invite.remove_confirm', { name: a.displayName }),
    body: picked ? t('invite.remove_body_folder', { folder: folderName(a) }) : t('invite.remove_body_saved'),
    action: t('invite.remove_go'),
    danger: !picked,
  });
  if (!sure || !data.assets.some(b => b.id === a.id)) return;
  await call('removeAsset', a.id);
  await refresh();
  toast(t('toast.pet_removed', { name: a.displayName }));
  // The pressed button is gone with its card: the panel's heading takes the focus.
  $('panel-title')?.focus();
}
function group({ place, title, folder }, assets) {
  const box = document.createElement('section');
  box.className = 'shelf-group';
  const head = document.createElement('div'),
    name = document.createElement('h4');
  head.className = 'shelf-group-head';
  name.textContent = t(title);
  head.append(name);
  if (folder) {
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'button text shelf-open';
    const icon = document.createElement('span');
    icon.dataset.icon = 'folder';
    open.append(icon, t('invite.open_folder'));
    open.title = data.petFolders?.[folder] || '';
    open.setAttribute('aria-label', t('invite.open_aria', { title: t(title) }));
    open.onclick = guard(() => call('openFolder', folder));
    head.append(open);
  }
  box.append(head, ...assets.map(entry));
  box.dataset.place = place;
  return box;
}
// The shelf can show only people, only animals, or the rest, by the pet file's `kind`.
let kind = '';
/** Type and search narrow the same shelf; unknown file kinds remain available under Other. */
export function shelfAssets(assets, type, query = '') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return assets.filter(a => {
    const raw = String(a.kind || '')
        .trim()
        .toLowerCase(),
      category = ['person', 'human', 'humanoid'].includes(raw) ? 'person' : raw === 'animal' ? 'animal' : 'other',
      text = [a.displayName, a.credit?.site, a.credit?.creator].filter(Boolean).join(' ').toLowerCase();
    return (!type || category === type) && words.every(word => text.includes(word));
  });
}
export function renderShelf() {
  const query = $('invite-search')?.value || '',
    shown = shelfAssets(data.assets, kind, query),
    key = JSON.stringify([
      language(),
      kind,
      query,
      data.assets.map(a => [
        a.id,
        a.place,
        a.kind,
        a.displayName,
        a.folderPath,
        a.spriteUrl,
        a.realisticSpriteUrls,
        a.realisticPortraitUrl,
        a.credit,
      ]),
    ]);
  const filterLabel = $('invite-filter-label');
  if (filterLabel) {
    const labelKey = query.trim() || kind ? 'invite.filter_active' : 'invite.filter';
    filterLabel.setAttribute('data-i18n', labelKey);
    filterLabel.textContent = t(labelKey);
  }
  if (key !== shelfKey) {
    shelfKey = key;
    previews.clear();
    const groups = PLACES.map(p => [p, shown.filter(a => a.place === p.place)]).filter(([, list]) => list.length);
    $('shelf').replaceChildren(...groups.map(([p, list]) => group(p, list)));
    icons($('shelf'));
  }
  const most = limit(data, 'pets'),
    full = data.pets.length >= most;
  // A full yard says why the cards cannot be pressed, and what to do.
  $('yard-full').hidden = !full;
  if (full) $('yard-full').textContent = t('invite.full', { limit: most });
  // A shape with no pets says so, with the way back to every pet.
  $('no-kind').hidden = !data.assets.length || shown.length > 0;
  // A pet on its way into the yard is not taken off the shelf meanwhile.
  for (const b of $('shelf').querySelectorAll('.asset-remove')) b.disabled = inviting.has(b.dataset.assetId);
  for (const b of $('shelf').querySelectorAll('.asset-card')) {
    b.disabled = full || inviting.has(b.dataset.assetId);
    b.setAttribute('aria-busy', String(inviting.has(b.dataset.assetId)));
    // The heading already says a click invites; a card adds a line only when that friend is in the
    // yard already, to say a click brings another.
    const hint = b.querySelector('.asset-hint');
    hint.textContent = data.pets.some(p => p.assetId === b.dataset.assetId) ? t('invite.one_more') : '';
    hint.hidden = !hint.textContent;
  }
  $('no-assets').hidden = data.assets.length > 0;
}
export function drawPreviews(now) {
  for (const { canvas, asset } of previews.values()) drawSprite(canvas, asset, 'idle', now);
}
function openImportDialog() {
  if (importing) return;
  $('import-form').reset();
  $('import-error').textContent = '';
  $('community-links').replaceChildren();
  if ($('community-discovery')) {
    $('community-discovery').open = false;
    $('community-discovery').hidden = !(data.communities || []).length;
    $('community-count').textContent = t('invite.discovery_count', { count: (data.communities || []).length });
  }
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
    const row = document.createElement('div');
    row.className = 'community-choice';
    row.dataset.communityId = c.id || '';
    const hint = document.createElement('small');
    hint.textContent = !c.importable ? t('invite.not_importable') : c.hint || t('invite.open_site', { url: c.url });
    row.append(link, hint);
    $('community-links').append(row);
  }
  importOpened();
  $('import-dialog').showModal();
  $('import-url').focus();
}
let importing = false;
let calledOff = false;
let importOpened = () => {};
// Both import paths share the dialog: another action must not replace a request still running.
// Only an address can be called off: a folder or a ZIP waits on the system's own picker.
function setImporting(busy, cancellable = false) {
  importing = busy;
  calledOff = false;
  for (const id of ['close-import', 'cancel-import', 'import-folder', 'import-zip', 'import-submit', 'import-url'])
    $(id).disabled = busy;
  $('cancel-import').disabled = busy && !cancellable;
  $('import-form').setAttribute('aria-busy', String(busy));
  $('import-submit').textContent = t(busy ? 'invite.importing' : 'invite.import_go');
}
// Wires the invite tab and the import dialog. `refresh` reloads the page's state once a friend arrives. Called once, by app.js.
export function setupInvite(hooks) {
  const chooseKind = chip => {
    kind = chip.dataset.kind;
    for (const c of document.querySelectorAll('#kind-filter .chip')) c.setAttribute('aria-pressed', String(c === chip));
    renderShelf();
  };
  for (const chip of document.querySelectorAll('#kind-filter .chip')) chip.onclick = () => chooseKind(chip);
  $('show-all-kinds').onclick = () => {
    if ($('invite-search')) $('invite-search').value = '';
    chooseKind(document.querySelector('#kind-filter .chip[data-kind=""]'));
  };
  if ($('invite-search')) $('invite-search').oninput = renderShelf;
  refresh = hooks.refresh;
  $('import').onclick = openImportDialog;
  $('close-import').onclick = () => {
    if (!importing) $('import-dialog').close();
  };
  $('cancel-import').onclick = guard(async () => {
    if (!importing) return $('import-dialog').close();
    calledOff = true;
    $('cancel-import').disabled = true;
    await call('cancelImport');
  });
  // A folder or a ZIP that is not a pet is said inside the dialog, beside the address field's errors.
  const fromComputer = command => async () => {
    if (importing) return;
    setImporting(true);
    $('import-error').textContent = '';
    try {
      const id = await call(command);
      if (id) await arrived(id);
    } catch (error) {
      showFormError('import-error', spoken(error, t('error.generic')));
    } finally {
      setImporting(false);
    }
  };
  $('import-folder').onclick = fromComputer('importFolder');
  $('import-zip').onclick = fromComputer('importZip');
  importOpened = keepEdits(
    $('import-dialog'),
    () => $('import-url').value,
    () => showFormError('import-error', t('dialog.unsaved')),
    () => importing,
  );
  $('import-form').onsubmit = async e => {
    e.preventDefault();
    if (importing) return;
    setImporting(true, true);
    $('import-error').textContent = '';
    try {
      await arrived(await call('importUrl', $('import-url').value));
    } catch (error) {
      if (!calledOff) showFormError('import-error', spoken(error, t('error.generic')));
    } finally {
      setImporting(false);
    }
  };
}
