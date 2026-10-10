// The card that shows something new for a few seconds at the head of the yard: a fish or a bug
// caught, a flower in bloom, a gift that came. Each says what it is, a detail, and whether it is
// new in the album.
import { t } from '../core/i18n.js';
import { $ } from '../core/state.js';
import { cue } from './sound.js';

let timer;
/** Shows the card: a drawing (SVG markup), a name, a detail line, and whether it is a first. */
export function showCard(svg, name, detail, first) {
  const card = $('catch-card');
  card.innerHTML = `${svg}<div><strong></strong><small></small>${first ? '<small class="catch-new"></small>' : ''}</div>`;
  card.querySelector('strong').textContent = name;
  card.querySelector('small').textContent = detail;
  if (first) {
    card.querySelector('.catch-new').textContent = t('catch.new');
    setTimeout(() => cue('first'), 450);
  }
  card.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (card.hidden = true), first ? 6000 : 4500);
}
/** A click puts the card away early. Called once, by app.js. */
export function setupCard() {
  $('catch-card').addEventListener('click', () => ($('catch-card').hidden = true));
}
