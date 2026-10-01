// Connecting an AI: one dialog for every kind of provider.
import { closeOnBackdrop, confirmAction } from '../core/confirm.js';
import { t } from '../core/i18n.js';
import { $, call, data, guard, providerLabel, selected, toast } from '../core/state.js';

// Per-type dialog behavior: which fields show, whether a model name is mandatory, and the data-flow note.
const providerForms = {
  claude: {
    label: 'Claude Code',
    cli: true,
    endpoint: false,
    key: false,
    modelRequired: false,
    placeholder: t('connection.model_default'),
    note: t('connection.note_claude'),
  },
  codex: {
    label: 'Codex CLI',
    cli: true,
    endpoint: false,
    key: false,
    modelRequired: false,
    placeholder: t('connection.model_default'),
    note: t('connection.note_codex'),
  },
  ollama: {
    endpoint: true,
    key: false,
    modelRequired: true,
    placeholder: t('connection.model_installed', { example: 'llama3.2' }),
    note: t('connection.note_ollama'),
    // The address Ollama usually listens at comes from the backend (data.defaults).
    defaultEndpoint: true,
  },
  openai: {
    endpoint: false,
    key: true,
    modelRequired: true,
    placeholder: t('connection.model_placeholder'),
    note: t('connection.note_openai'),
  },
  compatible: {
    endpoint: true,
    key: true,
    modelRequired: true,
    placeholder: t('connection.model_placeholder'),
    note: t('connection.note_compatible'),
  },
};
let editProvider = null;
// What to do once a connection was saved or deleted; whoever opened the dialog says.
let afterChange = () => {};
// What to do once the very first friend can talk; app.js says (a chat between friends, or the chat box).
let onFirstConnection = () => {};
const detectedType = () => {
  const d = data.detected || {};
  return d.claude ? 'claude' : d.codex ? 'codex' : d.ollama?.length ? 'ollama' : 'openai';
};
/** The subscription CLI found on this computer, by its label, when one is (no key needed). */
export function detectedLabel() {
  const d = data.detected || {};
  return d.claude ? providerForms.claude.label : d.codex ? providerForms.codex.label : null;
}
// Friends without an AI, other than `except`.
const unconnected = except => data.pets.filter(p => !p.providerId && p.id !== except);
async function attachAll(pets, providerId) {
  for (const p of pets) await call('updatePet', p.id, { providerId });
  return pets.length;
}
// The first connection is the moment the yard changes: with two or more friends talking they
// start a chat among themselves right away; with one, the chat box is ready.
function connected(first, able) {
  if (first) onFirstConnection(able);
}
/** The first-run card's "connect now": a CLI found on this computer is connected to every friend
 * without an AI in one step; otherwise the dialog opens for the selected friend. */
export async function quickConnect() {
  const d = data.detected || {};
  const type = d.claude ? 'claude' : d.codex ? 'codex' : null;
  if (!type) return openConnectionDialog(null);
  const first = !data.pets.some(p => p.providerId);
  const targets = unconnected();
  const config = await call('saveProvider', { id: null, type, model: '', endpoint: '', apiKey: '' });
  const able = data.pets.length - targets.length + (await attachAll(targets, config.id));
  toast(t('toast.connection_saved'));
  connected(first, able);
}
export function openConnectionDialog(current, onChange = () => {}) {
  editProvider = current?.id || null;
  afterChange = onChange;
  // A new connection can go to every friend still without one, not only the selected friend.
  const others = unconnected(selected).length;
  $('share-all-field').hidden = !!current || !others;
  $('ai-share-all').checked = !current && others > 0;
  $('ai-share-all-label').textContent = t('connection.share_all', { count: others });
  $('connection-form').reset();
  $('connection-error').textContent = '';
  $('ai-type').value = current?.type || detectedType();
  $('ai-model').value = current?.model || '';
  $('ai-endpoint').value = current?.endpoint || '';
  $('ai-key').value = '';
  $('ai-key').placeholder = current?.hasKey ? t('connection.key_saved') : t('connection.key_enter');
  $('delete-provider').hidden = !current;
  $('dialog-title').textContent = current ? t('connection.title_edit') : t('connection.title_new');
  $('save-provider').textContent = current ? t('connection.save_edit') : t('connection.save_new');
  updateProviderForm();
  $('connection-dialog').showModal();
}
function updateProviderForm() {
  const d = data.detected || {};
  const form = providerForms[$('ai-type').value] || providerForms.openai;
  $('endpoint-field').hidden = !form.endpoint;
  $('key-field').hidden = !form.key;
  if (form.defaultEndpoint && !$('ai-endpoint').value) $('ai-endpoint').value = data.defaults?.ollamaEndpoint || '';
  $('ai-model').required = form.modelRequired;
  $('ai-model').placeholder =
    $('ai-type').value === 'ollama' && d.ollama?.length
      ? t('connection.model_installed', { example: d.ollama[0] })
      : form.placeholder;
  $('provider-note').textContent = form.note;
  $('model-req').hidden = !form.modelRequired;
  // Detected backends become one-click chips that switch the type.
  const found = [
    d.claude && ['claude', providerForms.claude.label],
    d.codex && ['codex', providerForms.codex.label],
    d.ollama?.length && ['ollama', t('connection.ollama_found', { count: d.ollama.length })],
  ].filter(Boolean);
  $('detected-note').hidden = !found.length;
  $('detected-note').replaceChildren(t('connection.detected'));
  for (const [type, label] of found) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `detect-chip${$('ai-type').value === type ? ' on' : ''}`;
    chip.textContent = label;
    chip.onclick = () => {
      $('ai-type').value = type;
      $('ai-type').dispatchEvent(new Event('change'));
    };
    $('detected-note').append(chip);
  }
  loadModels();
}
// Fill the model combobox from the live provider, so people pick instead of typing.
let modelEpoch = 0;
async function loadModels() {
  const epoch = ++modelEpoch;
  $('model-list').replaceChildren();
  $('model-status').textContent = t('connection.models_loading');
  try {
    const list = await call('listModels', {
      id: editProvider,
      type: $('ai-type').value,
      endpoint: $('ai-endpoint').value,
      apiKey: $('ai-key').value,
    });
    if (epoch !== modelEpoch) return;
    for (const name of list) {
      const option = document.createElement('option');
      option.value = name;
      $('model-list').append(option);
    }
    // A CLI takes short aliases too, so the line says so there.
    const found = providerForms[$('ai-type').value]?.cli ? 'connection.models_found_cli' : 'connection.models_found';
    $('model-status').classList.remove('error');
    $('model-status').textContent = list.length ? t(found, { count: list.length }) : t('connection.models_none');
  } catch (e) {
    if (epoch === modelEpoch) {
      $('model-status').classList.add('error');
      $('model-status').textContent = e.message;
    }
  }
}
// While a save is under way the dialog can be neither closed nor acted on.
const dialogButtons = ['close-dialog', 'cancel-dialog', 'delete-provider'];
let dialogSaving = false;
// Wires the connection dialog. Called once, by app.js, which says what the first connection leads to.
export function setupConnection({ first = () => {} } = {}) {
  onFirstConnection = first;
  $('ai-endpoint').onchange = loadModels;
  $('ai-key').onchange = loadModels;
  $('ai-type').onchange = () => {
    $('ai-endpoint').value = '';
    $('ai-key').value = '';
    $('ai-model').value = '';
    updateProviderForm();
  };
  $('close-dialog').onclick = () => $('connection-dialog').close();
  $('cancel-dialog').onclick = () => $('connection-dialog').close();
  closeOnBackdrop($('connection-dialog'), () => !dialogSaving);
  $('connection-dialog').addEventListener('cancel', e => {
    if (dialogSaving) e.preventDefault();
  });
  $('connection-form').onsubmit = async e => {
    e.preventDefault();
    if (dialogSaving) return;
    const button = $('save-provider'),
      label = button.textContent,
      id = selected;
    dialogSaving = true;
    button.disabled = true;
    button.textContent = t('connection.saving');
    for (const b of dialogButtons) $(b).disabled = true;
    try {
      const first = !data.pets.some(p => p.providerId);
      const config = await call('saveProvider', {
        id: editProvider,
        type: $('ai-type').value,
        model: $('ai-model').value,
        endpoint: $('ai-endpoint').value,
        apiKey: $('ai-key').value,
      });
      await call('updatePet', id, { providerId: config.id });
      let able = data.pets.filter(p => p.providerId && p.id !== id).length + 1;
      if (!$('share-all-field').hidden && $('ai-share-all').checked)
        able += await attachAll(unconnected(id), config.id);
      $('ai-key').value = '';
      $('connection-dialog').close();
      afterChange();
      toast(t('toast.connection_saved'));
      connected(first, able);
    } catch (error) {
      $('connection-error').textContent = error.message;
    } finally {
      dialogSaving = false;
      button.disabled = false;
      button.textContent = label;
      for (const b of dialogButtons) $(b).disabled = false;
    }
  };
  $('delete-provider').onclick = guard(async () => {
    const uses = data.pets.filter(p => p.providerId === editProvider).length;
    const provider = data.providers.find(c => c.id === editProvider);
    const label = providerLabel(provider) || 'AI';
    const sure = await confirmAction({
      title: t('connection.delete_confirm', { name: label }),
      body: [t('connection.delete_body'), uses ? t('connection.delete_uses', { count: uses }) : '']
        .filter(Boolean)
        .join(' '),
      action: t('connection.delete'),
    });
    if (!sure) return;
    await call('removeProvider', editProvider);
    $('connection-dialog').close();
    afterChange();
    toast(t('toast.connection_deleted'));
  });
}
