// Asking before something that cannot be taken back. The question names what it acts on, the
// button says what will happen, and focus starts on the Cancel button so Enter never does the harm by itself.
// The action is calm unless `danger` says something that cannot come back is lost (a saved key, a
// friend's closeness, a background's files, a conversation); what can be undone is not asked at all (yard/props.js).
import { t } from './i18n.js';
import { $ } from './state.js';

let answer = null;

// Resolves true only when the action button was pressed; Esc, Cancel and a click outside are false.
export function confirmAction({ title, body, action, danger = false }) {
  answer?.(false);
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  $('confirm-ok').textContent = action;
  $('confirm-ok').classList.toggle('danger-fill', danger);
  // Before losing something for good, the other choice says what it keeps.
  $('confirm-cancel').textContent = t(danger ? 'confirm.keep' : 'confirm.cancel');
  $('confirm-dialog').showModal();
  $('confirm-cancel').focus();
  return new Promise(resolve => {
    answer = resolve;
  });
}

// Called once, by app.js.
export function setupConfirm() {
  const dialog = $('confirm-dialog');
  const settle = value => {
    answer?.(value);
    answer = null;
  };
  $('confirm-ok').onclick = () => {
    settle(true);
    dialog.close();
  };
  $('confirm-cancel').onclick = () => dialog.close();
  if ($('confirm-close')) $('confirm-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => settle(false));
  closeOnBackdrop(dialog);
}

// Keep inline feedback visible when a form has its own scrolling body.
export function showFormError(id, message) {
  const field = $(id);
  field.textContent = message;
  field.scrollIntoView?.({ block: 'nearest' });
}

// A click on the backdrop (outside the dialog's own box) closes the dialog, unless `canClose`
// says not now.
export function closeOnBackdrop(dialog, canClose = () => true) {
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside && canClose()) dialog.close();
  });
}

// A dialog with a form keeps what was typed in it: Esc and a click beside it close it only while
// nothing changed since it opened, and otherwise `unsaved()` says to save or press Cancel. Nothing
// closes it while `busy()` (a save under way). `read()` gives what the form holds, as one string.
// Returns `opened()`, to call once the form is filled on opening.
export function keepEdits(dialog, read, unsaved, busy = () => false) {
  let start = '';
  const mayClose = () => {
    if (busy()) return false;
    if (read() === start) return true;
    unsaved();
    return false;
  };
  dialog.addEventListener('cancel', e => {
    if (!mayClose()) e.preventDefault();
  });
  closeOnBackdrop(dialog, mayClose);
  return () => {
    start = read();
  };
}
