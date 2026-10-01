// Friend settings: name, personality, relationship, size, and sending the friend away.
import { confirmAction } from '../core/confirm.js';
import { t } from '../core/i18n.js';
import { $, asset, call, data, guard, name, pet, selected, temporaryMessages, toast } from '../core/state.js';

const SIZE_NAMES = [t('size.xs'), t('size.s'), t('size.m'), t('size.l'), t('size.xl')];
export function showSize(size) {
  $('size-range').value = size;
  $('size-label').textContent = SIZE_NAMES[Math.round((size - 64) / 32)] || SIZE_NAMES[2];
}
// Wires the friend settings dialog. `refresh` reloads the page's state after a friend leaves. Called once, by app.js.
export function setupFriendSettings({ refresh }) {
  $('size-range').oninput = () => showSize($('size-range').value);
  $('size-range').onchange = guard(() => call('updatePet', selected, { size: Number($('size-range').value) }));
  $('edit-pet').onclick = () => {
    const p = pet();
    if (!p) return;
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
    $('pet-relation').value = p.relation || '';
    $('pet-call-me').value = p.callMe || '';
    showSize(p.size);
    $('pet-dialog').showModal();
    $('pet-name').focus();
  };
  $('use-intro').onclick = () => {
    const intro = asset(pet())?.intro || '',
      box = $('pet-persona');
    box.value = [intro, box.value.trim()]
      .filter(Boolean)
      .join('\n')
      .slice(0, data.limits?.persona ?? 400);
    $('use-intro').hidden = true;
    box.focus();
  };
  $('close-pet-dialog').onclick = $('cancel-pet-dialog').onclick = () => $('pet-dialog').close();
  $('pet-form').onsubmit = guard(async e => {
    e.preventDefault();
    await call('updatePet', selected, {
      name: $('pet-name').value,
      persona: $('pet-persona').value,
      relation: $('pet-relation').value,
      callMe: $('pet-call-me').value,
    });
    $('pet-dialog').close();
    toast(t('toast.pet_saved'));
  });
  // The friend tab and the settings dialog send a friend away the same way.
  const sendAway = guard(async () => {
    const p = pet();
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
  });
  $('remove').onclick = sendAway;
  $('remove-friend').onclick = sendAway;
}
