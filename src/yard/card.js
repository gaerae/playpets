// The card that shows something new for a few seconds at the head of the yard: a fish or a bug
// caught, a flower in bloom, a gift that came. Each says what it is, a detail, and whether it is
// new in the album; one kept in the album offers its book, and a new one marks Album and Play.
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { $, recall, remember } from '../core/state.js';
import { cue } from './sound.js';

let timer, soundTimer;
let openAlbum = () => {};
// A dot on Album and on Play in the dock while something new waits there, kept across restarts.
function syncNew() {
  const waiting = recall('album-new') === '1';
  for (const id of ['album-button', 'play-button']) $(id)?.classList.toggle('has-new', waiting);
}
/** The album was opened: nothing new waits any more. */
export function albumSeen() {
  remember('album-new', '');
  syncNew();
}
function dismiss() {
  clearTimeout(timer);
  clearTimeout(soundTimer);
  $('catch-card').hidden = true;
}
/** Shows the card: a drawing (SVG markup), a name, a detail line, whether it is a first, and the
 * album book it is kept in (none for news such as an event starting). */
export function showCard(svg, name, detail, first, book = null) {
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
    if (book) {
      remember('album-new', '1');
      syncNew();
    }
  }
  if (book) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'catch-album';
    link.textContent = t('catch.see_album');
    link.onclick = event => {
      event.stopPropagation();
      dismiss();
      openAlbum(book);
    };
    // Before Close, so the card reads: what it is, where it is kept, then Close.
    card.insertBefore(link, close);
  }
  card.hidden = false;
  timer = setTimeout(expire, first ? 6000 : 4500);
}
function expire() {
  if ($('catch-card').matches(':hover, :focus-within')) timer = setTimeout(expire, 1500);
  else dismiss();
}
/** A click puts the card away early. Called once, by app.js, with the album's opener. */
export function setupCard({ openAlbum: open = () => {} } = {}) {
  openAlbum = open;
  $('catch-card').addEventListener('click', dismiss);
  syncNew();
}
