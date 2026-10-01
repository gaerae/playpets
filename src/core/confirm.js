// Asking before something that cannot be taken back. The question names what it acts on, the
// button says what will happen, and focus starts on the Cancel button so Enter never does the harm by itself.
import { $ } from './state.js';

let answer = null;

// Resolves true only when the action button was pressed; Esc, 취소 and a click outside are false.
export function confirmAction({ title, body, action, danger = true }) {
  answer?.(false);
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  $('confirm-ok').textContent = action;
  $('confirm-ok').classList.toggle('danger-fill', danger);
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
  dialog.addEventListener('close', () => settle(false));
  closeOnBackdrop(dialog);
}

// A click on the backdrop (outside the dialog's own box) closes the dialog, unless `canClose`
// says not now (a save in progress).
export function closeOnBackdrop(dialog, canClose = () => true) {
  dialog.addEventListener('click', e => {
    if (e.target !== dialog || !canClose()) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  });
}
