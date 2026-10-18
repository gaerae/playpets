// Startup issues remain available without taking space from the scenery.
import { t } from './i18n.js';
import { $ } from './state.js';

let current = '';
let dismissed = '';

export function renderNotices(messages = []) {
  const warnings = messages.filter(message => typeof message === 'string' && message.trim());
  const signature = JSON.stringify(warnings);
  if (signature !== current) {
    $('warning-details').open = false;
    dismissed = '';
  }
  current = signature;
  $('warnings').hidden = !warnings.length || signature === dismissed;
  $('warning-summary').textContent = t('notices.title', { count: warnings.length });
  $('warning-messages').textContent = warnings.join('\n\n');
}

function dismiss() {
  dismissed = current;
  $('warnings').hidden = true;
  $('warning-details').open = false;
  $('yard-controls-toggle').focus();
}

export function setupNotices() {
  current = '';
  dismissed = '';
  $('dismiss-warnings').onclick = dismiss;
  $('warnings').addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if ($('warning-details').open) {
      $('warning-details').open = false;
      $('warning-toggle').focus();
    } else dismiss();
  });
}
