// The card that shows something new for a few seconds at the head of the yard: a fish or a bug
// caught, a flower in bloom, a gift that came. Each says what it is, a detail, and whether it is
// new in the album.
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { $ } from '../core/state.js';
import { cue } from './sound.js';

let timer, soundTimer;
function dismiss() {
  clearTimeout(timer);
  clearTimeout(soundTimer);
  $('catch-card').hidden = true;
}
/** Shows the card: a drawing (SVG markup), a name, a detail line, and whether it is a first. */
export function showCard(svg, name, detail, first) {
  dismiss();
  const card = $('catch-card');
  card.innerHTML = `<div class="catch-specimen">${svg}</div><div class="catch-copy"><strong></strong><small></small>${first ? '<small class="catch-new"></small>' : ''}</div><button class="icon-button catch-dismiss" type="button"><span data-icon="close"></span></button>`;
  const close = card.querySelector('.catch-dismiss');
  close.setAttribute('aria-label', t('common.close'));
  close.onclick = dismiss;
  icons(card);
  card.querySelector('strong').textContent = name;
  card.querySelector('small').textContent = detail;
  if (first) {
    card.querySelector('.catch-new').textContent = t('catch.new');
    soundTimer = setTimeout(() => cue('first'), 450);
  }
  card.hidden = false;
  timer = setTimeout(expire, first ? 6000 : 4500);
}
function expire() {
  if ($('catch-card').matches(':hover, :focus-within')) timer = setTimeout(expire, 1500);
  else dismiss();
}
/** A click puts the card away early. Called once, by app.js. */
export function setupCard() {
  $('catch-card').addEventListener('click', dismiss);
}
