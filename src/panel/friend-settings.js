// Friend settings: name, personality, relationship, size, and sending the friend away.

import { styledAsset } from '../core/appearance.js';
import { confirmAction, keepEdits, showFormError } from '../core/confirm.js';
import { t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { drawStill } from '../core/sprites.js';
import { $, asset, call, data, guard, name, pet, temporaryMessages, toast } from '../core/state.js';
import { spoken } from '../core/text.js';

// The relationship is picked from cards, each saying the voice it brings (a radio group).
const relation = () => $('pet-form').elements.relation;
const appearance = () => $('pet-form').elements.visualStyle;
// What the form holds, to tell whether anything changed since the dialog opened.
const petForm = () =>
  [$('pet-name').value, $('pet-persona').value, relation().value, $('pet-call-me').value, appearance().value].join(
    '\n',
  );
// What it might call you depends on who it is to you: "honey" for a partner, "big sis" for a sibling.
const callMeHint = () => {
  $('pet-call-me').placeholder = t(`pet.call_me_${relation().value || 'friend'}`);
};
let petOpened = () => {};
// The friend the dialog is open for: the selection can change under a modal (the tray, the desktop),
// and everything the dialog does is for this one.
let editing = null;
let saving = false;
let editEpoch = 0;
const edited = () => data.pets.find(p => p.id === editing) || null;
// Keep failures beside the fields that can correct them.
const petError = e => showFormError('pet-error', spoken(e, t('error.generic')));
const SIZE_NAMES = [t('size.xs'), t('size.s'), t('size.m'), t('size.l'), t('size.xl')];
export function showSize(size) {
  $('size-range').value = size;
  $('size-label').textContent = SIZE_NAMES[Math.round((size - 64) / 32)] || SIZE_NAMES[2];
}
/** Opens the friend settings for the friend talked with; `focus` 'relation' starts at its relationship. */
export function openFriendSettings(focus) {
  if (saving) return;
  const p = pet();
  if (!p) return;
  editEpoch++;
  editing = p.id;
  $('pet-form').reset();
  $('pet-dialog-name').textContent = name(p);
  $('pet-name').value = p.name || asset(p)?.displayName || '';
  const intro = asset(p)?.intro || '';
  $('pet-persona').value = p.persona || intro;
  $('persona-help').textContent =
    !p.persona && intro
      ? t('pet.persona_help_intro')
      : p.providerId
        ? t('pet.persona_help_chat')
        : t('pet.persona_help');
  $('use-intro').hidden = !intro || $('pet-persona').value.includes(intro);
  relation().value = p.relation || '';
  callMeHint();
  $('pet-call-me').value = p.callMe || '';
  const original = data.assets.find(a => a.id === p.assetId);
  $('pet-appearance').hidden = original?.place === 'builtin' || !original?.realisticSpriteUrls?.default;
  appearance().value = p.visualStyle === 'realistic' ? 'realistic' : 'illustrated';
  if (!$('pet-appearance').hidden) {
    drawStill($('style-illustrated'), original);
    drawStill($('style-realistic'), styledAsset(original, 'realistic'));
    const portrait = $('style-realistic-photo');
    portrait.hidden = true;
    $('style-realistic').hidden = false;
    portrait.onload = () => {
      portrait.hidden = false;
      $('style-realistic').hidden = true;
    };
    portrait.onerror = () => {
      portrait.hidden = true;
      $('style-realistic').hidden = false;
    };
    if (original.realisticPortraitUrl) portrait.src = original.realisticPortraitUrl;
    else portrait.removeAttribute('src');
  }
  showSize(p.size);
  $('pet-error').textContent = '';
  petOpened();
  $('pet-dialog').showModal();
  // From the relationship chip in the Friend tab, the relationship is what is being changed.
  if (focus === 'relation') ($('pet-form').querySelector('[name=relation]:checked') || relation()[0]).focus();
  else $('pet-name').focus();
}
// Wires the friend settings dialog. `refresh` reloads the page's state after a friend leaves. Called once, by app.js.
export function setupFriendSettings({ refresh }) {
  $('size-range').oninput = () => showSize($('size-range').value);
  $('size-range').onchange = () => {
    const epoch = editEpoch;
    return call('updatePet', editing, { size: Number($('size-range').value) }).catch(error => {
      if (epoch === editEpoch && $('pet-dialog').open) petError(error);
    });
  };
  $('edit-pet').onclick = () => openFriendSettings();
  for (const card of relation()) card.onchange = callMeHint;
  $('use-intro').onclick = () => {
    const intro = asset(edited())?.intro || '',
      box = $('pet-persona');
    box.value = [intro, box.value.trim()].filter(Boolean).join('\n').slice(0, limit(data, 'persona'));
    $('use-intro').hidden = true;
    box.focus();
  };
  $('close-pet-dialog').onclick = $('cancel-pet-dialog').onclick = () => {
    if (!saving) $('pet-dialog').close();
  };
  // Esc or a click beside it keeps unsaved edits: the dialog says to save or press Cancel.
  petOpened = keepEdits(
    $('pet-dialog'),
    petForm,
    () => showFormError('pet-error', t('dialog.unsaved')),
    () => saving,
  );
  $('pet-form').onsubmit = async e => {
    e.preventDefault();
    if (saving) return;
    saving = true;
    const form = $('pet-form');
    const controls = [...form.querySelectorAll('input, textarea, button, select')].map(control => [
      control,
      control.disabled,
    ]);
    form.setAttribute('aria-busy', 'true');
    $('pet-error').textContent = '';
    for (const [control] of controls) control.disabled = true;
    try {
      await call('updatePet', editing, {
        name: $('pet-name').value,
        persona: $('pet-persona').value,
        relation: relation().value,
        callMe: $('pet-call-me').value,
        visualStyle: appearance().value,
      });
    } catch (error) {
      petError(error);
      return;
    } finally {
      saving = false;
      form.setAttribute('aria-busy', 'false');
      for (const [control, disabled] of controls) control.disabled = disabled;
    }
    $('pet-dialog').close();
    toast(t('toast.pet_saved'));
  };
  // The friend tab and the settings dialog send a friend away the same way: the one talked with, or
  // the one the dialog is open for.
  const sendAway = guard(async p => {
    if (!p) return;
    const sure = await confirmAction({
      title: t('friend.send_away_confirm', { name: name(p) }),
      body: t('friend.send_away_body'),
      action: t('friend.send_away'),
      danger: true,
    });
    if (!sure || !data.pets.some(q => q.id === p.id)) return;
    $('pet-dialog').close();
    await call('removePet', p.id);
    temporaryMessages.delete(p.id);
    await refresh();
    toast(t('toast.sent_away', { name: name(p) }));
    // The button that was pressed is gone with the friend: the panel's heading takes the focus.
    $('panel-title').focus();
  });
  $('remove').onclick = () => sendAway(edited());
  $('remove-friend').onclick = () => sendAway(pet());
}
