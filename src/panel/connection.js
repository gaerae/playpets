// Connecting an AI: one dialog for every kind of provider.
import { confirmAction, keepEdits, showFormError } from '../core/confirm.js';
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
  },
  codex: {
    label: 'Codex CLI',
    cli: true,
    endpoint: false,
    key: false,
    modelRequired: false,
    placeholder: t('connection.model_default'),
  },
  ollama: {
    endpoint: true,
    key: false,
    modelRequired: true,
    placeholder: t('connection.model_installed', { example: 'llama3.2' }),
    // The address Ollama usually listens at comes from the backend (data.defaults).
    defaultEndpoint: true,
  },
  openai: {
    endpoint: false,
    key: true,
    modelRequired: true,
    placeholder: t('connection.model_placeholder'),
  },
  compatible: {
    endpoint: true,
    key: true,
    modelRequired: true,
    placeholder: t('connection.model_placeholder'),
  },
};
let editProvider = null;
// What to do once a connection was saved or deleted; whoever opened the dialog says.
let afterChange = () => {};
// What to do once the very first friend can talk; app.js says (a chat between friends, or the chat box).
let onFirstConnection = () => {};
// What this computer has, as a kind to start from; nothing found leaves the choice to the person.
const detectedType = () => {
  const d = data.detected || {};
  return d.claude ? 'claude' : d.codex ? 'codex' : d.ollama?.length ? 'ollama' : '';
};
// The kind of AI picked on the dialog's cards ('' while none is).
const aiType = () => $('connection-form').querySelector('input[name="ai-type"]:checked')?.value || '';
function setAiType(type) {
  for (const input of $('connection-form').querySelectorAll('input[name="ai-type"]'))
    input.checked = input.value === type;
}
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
  // A connection belongs to friends: with none in the yard there is nobody to give it to.
  if (!data.pets.length) return;
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
  if (dialogSaving) return;
  editProvider = current?.id || null;
  afterChange = onChange;
  $('connection-form').reset();
  // A new connection can go to every friend still without one, not only the selected friend.
  const others = unconnected(selected).length;
  $('share-all-field').hidden = !!current || !others;
  $('ai-share-all').checked = !current && others > 0;
  $('ai-share-all-label').textContent = t('connection.share_all', { count: others });
  $('connection-error').textContent = '';
  setAiType(current?.type || detectedType());
  $('ai-model').value = current?.model || '';
  $('ai-endpoint').value = current?.endpoint || '';
  $('ai-key').value = '';
  $('ai-key').placeholder = current?.hasKey ? t('connection.key_saved') : t('connection.key_enter');
  $('delete-provider').hidden = !current;
  $('dialog-title').textContent = current ? t('connection.title_edit') : t('connection.title_new');
  $('save-provider').textContent = current ? t('connection.save_edit') : t('connection.save_new');
  updateProviderForm();
  rememberConnectionForm();
  $('connection-dialog').showModal();
}
// What the dialog holds, to tell whether anything was typed since it opened.
const connectionForm = () =>
  [aiType(), ...['ai-model', 'ai-endpoint', 'ai-key'].map(id => $(id).value), $('ai-share-all').checked].join('\n');
let connectionOpened = () => {};
let connectionStart = '';
function rememberConnectionForm() {
  connectionStart = connectionForm();
  connectionOpened();
}
function updateProviderForm() {
  const d = data.detected || {},
    type = aiType();
  // What this computer has is marked on its card.
  const found = { claude: d.claude, codex: d.codex, ollama: d.ollama?.length };
  for (const card of $('ai-types').querySelectorAll('.ai-type')) {
    card.querySelector('.ai-found').hidden = !found[card.dataset.type];
    card.classList.toggle('on', card.dataset.type === type);
  }
  // Until a kind is picked there is nothing to fill in.
  $('type-fields').hidden = !type;
  $('save-provider').disabled = !type;
  $('connection-help').hidden = !['claude', 'codex', 'ollama'].includes(type);
  $('connection-help').textContent = ['claude', 'codex', 'ollama'].includes(type) ? t(`connection.help_${type}`) : '';
  if (!type) return;
  const form = providerForms[type];
  $('endpoint-field').hidden = !form.endpoint;
  $('key-field').hidden = !form.key;
  if (form.defaultEndpoint && !$('ai-endpoint').value) $('ai-endpoint').value = data.defaults?.ollamaEndpoint || '';
  $('ai-model').required = form.modelRequired;
  $('ai-model').placeholder =
    type === 'ollama' && d.ollama?.length
      ? t('connection.model_installed', { example: d.ollama[0] })
      : form.placeholder;
  $('provider-note').textContent = t(`connection.note_${type}`);
  $('model-req').hidden = !form.modelRequired;
  loadModels();
}
// Fill the model combobox from the live provider, so people pick instead of typing.
let modelEpoch = 0;
async function loadModels() {
  const epoch = ++modelEpoch,
    type = aiType(),
    form = providerForms[type];
  $('model-list').replaceChildren();
  $('model-status').classList.remove('error');
  if (!form) return;
  // A server or a key comes first; asking without them only fails.
  const saved = data.providers.find(c => c.id === editProvider);
  if (form.endpoint && !$('ai-endpoint').value && !form.defaultEndpoint) {
    $('model-status').textContent = t('connection.models_after_endpoint');
    return;
  }
  if (form.key && !$('ai-key').value && !saved?.hasKey) {
    $('model-status').textContent = t('connection.models_after_key');
    return;
  }
  $('model-status').textContent = t('connection.models_loading');
  try {
    const list = await call('listModels', {
      id: editProvider,
      type,
      endpoint: $('ai-endpoint').value,
      apiKey: $('ai-key').value,
    });
    if (epoch !== modelEpoch) return;
    for (const name of list) {
      const option = document.createElement('option');
      option.value = name;
      $('model-list').append(option);
    }
    if (type === 'ollama' && !$('ai-model').value && list.length) {
      const untouched = connectionForm() === connectionStart;
      $('ai-model').value = list[0];
      // Provider discovery fills a default, but cannot make other edits part of the baseline.
      if (untouched) rememberConnectionForm();
    }
    // A CLI takes short aliases too, so the line says so there.
    const found = form.cli ? 'connection.models_found_cli' : 'connection.models_found';
    $('model-status').classList.remove('error');
    $('model-status').textContent = list.length ? t(found, { count: list.length }) : t('connection.models_none');
  } catch (e) {
    if (epoch === modelEpoch) {
      $('model-status').classList.add('error');
      showFormError('model-status', e.message);
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
  $('ai-types').onchange = () => {
    $('ai-endpoint').value = '';
    $('ai-key').value = '';
    $('ai-model').value = '';
    $('connection-error').textContent = '';
    updateProviderForm();
  };
  $('close-dialog').onclick = $('cancel-dialog').onclick = () => {
    if (!dialogSaving) $('connection-dialog').close();
  };
  // A click beside the dialog or Esc does not throw away an address or a key being typed: only
  // Cancel does, and the dialog says so.
  connectionOpened = keepEdits(
    $('connection-dialog'),
    connectionForm,
    () => showFormError('connection-error', t('dialog.unsaved')),
    () => dialogSaving,
  );
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
        type: aiType(),
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
      showFormError('connection-error', error.message);
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
