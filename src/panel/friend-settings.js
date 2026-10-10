// Friend settings: name, personality, relationship, size, and sending the friend away.
import { confirmAction, keepEdits } from '../core/confirm.js';
import { t } from '../core/i18n.js';
import { limit } from '../core/limits.js';
import { $, asset, call, data, guard, name, pet, temporaryMessages, toast } from '../core/state.js';
import { spoken } from '../core/text.js';

// The relationship is picked from cards, each saying the voice it brings (a radio group).
const relation = () => $('pet-form').elements.relation;
// What the form holds, to tell whether anything changed since the dialog opened.
const petForm = () =>
  [$('pet-name').value, $('pet-persona').value, relation().value, $('pet-call-me').value].join('\n');
// What it might call you depends on who it is to you: "honey" for a partner, "big sis" for a sibling.
const callMeHint = () => {
  $('pet-call-me').placeholder = t(`pet.call_me_${relation().value || 'friend'}`);
};
let petOpened = () => {};
// The friend the dialog is open for: the selection can change under a modal (the tray, the desktop),
// and everything the dialog does is for this one.
let editing = null;
const edited = () => data.pets.find(p => p.id === editing) || null;
// A failure is said inside the dialog: a toast would sit under it, behind the backdrop.
const petError = e => {
  $('pet-error').textContent = spoken(e, t('error.generic'));
};
const SIZE_NAMES = [t('size.xs'), t('size.s'), t('size.m'), t('size.l'), t('size.xl')];
export function showSize(size) {
  $('size-range').value = size;
  $('size-label').textContent = SIZE_NAMES[Math.round((size - 64) / 32)] || SIZE_NAMES[2];
}
/** Opens the friend settings for the friend talked with; `focus` 'relation' starts at its relationship. */
export function openFriendSettings(focus) {
  const p = pet();
  if (!p) return;
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
  $('size-range').onchange = () => call('updatePet', editing, { size: Number($('size-range').value) }).catch(petError);
  $('edit-pet').onclick = () => openFriendSettings();
  for (const card of relation()) card.onchange = callMeHint;
  $('use-intro').onclick = () => {
    const intro = asset(edited())?.intro || '',
      box = $('pet-persona');
    box.value = [intro, box.value.trim()].filter(Boolean).join('\n').slice(0, limit(data, 'persona'));
    $('use-intro').hidden = true;
    box.focus();
  };
  $('close-pet-dialog').onclick = $('cancel-pet-dialog').onclick = () => $('pet-dialog').close();
  // Esc or a click beside it keeps unsaved edits: the dialog says to save or press Cancel.
  petOpened = keepEdits($('pet-dialog'), petForm, () => {
    $('pet-error').textContent = t('dialog.unsaved');
  });
  $('pet-form').onsubmit = async e => {
    e.preventDefault();
    try {
      await call('updatePet', editing, {
        name: $('pet-name').value,
        persona: $('pet-persona').value,
        relation: relation().value,
        callMe: $('pet-call-me').value,
      });
    } catch (error) {
      petError(error);
      return;
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
