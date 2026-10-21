// The card that shows something new for a few seconds at the head of the yard: a fish or a bug
// caught, a flower in bloom, a gift that came. Each says what it is, a detail, and whether it is
// new in the album; one kept in the album offers its book, and a new one marks Album and Play.
import { t } from '../core/i18n.js';
import { icons } from '../core/icons.js';
import { $, readingTime, recall, remember } from '../core/state.js';
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
// Cards that arrive while one is on show wait their turn (a level-up right after the catch that
// earned it), at most a few, the oldest giving way.
const waiting = [];
const WAITING_MAX = 3;
function dismiss() {
  clearTimeout(timer);
  clearTimeout(soundTimer);
  $('catch-card').hidden = true;
  const next = waiting.shift();
  if (next) present(...next);
}
// Room kept above a friend for its own speech bubble ("I caught one!") when a card stands over it.
const BUBBLE_ROOM = 44;
/** Shows the card: a drawing (SVG markup), a name, a detail line, whether it is a first, the album
 * book it is kept in (none for news such as an event starting), and the friend or thing that found
 * it, which the card stands above (news with no finder keeps to the lane at the top). */
export function showCard(svg, name, detail, first, book = null, finder = null) {
  if (!$('catch-card').hidden || covered()) {
    waiting.push([svg, name, detail, first, book, finder]);
    if (waiting.length > WAITING_MAX) waiting.shift();
    if (covered()) holdWhileCovered();
    return;
  }
  present(svg, name, detail, first, book, finder);
}
// A panel or a sheet open over the yard would hide a card, so cards wait until it closes, looking
// again each second.
const covered = () =>
  !!document.querySelector?.(
    '#side-panel:not([hidden]), #scene-menu:not([hidden]), #play-panel:not([hidden]), #yard-controls-panel:not([hidden])',
  );
let holdTimer = 0;
function holdWhileCovered() {
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    if (covered()) return holdWhileCovered();
    if (!$('catch-card').hidden) return;
    const next = waiting.shift();
    if (next) present(...next);
  }, 1000);
}
// Above the finder, centred on it and kept inside the window; without room above, the top lane.
function place(card, finder) {
  card.classList.remove('near');
  card.style.left = '';
  card.style.top = '';
  if (!finder?.isConnected) return;
  const at = finder.getBoundingClientRect(),
    size = card.getBoundingClientRect(),
    top = at.top - size.height - BUBBLE_ROOM;
  if (top < 8) return;
  const left = Math.max(8, Math.min(at.left + at.width / 2 - size.width / 2, innerWidth - size.width - 8));
  card.classList.add('near');
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
}
function present(svg, name, detail, first, book, finder) {
  clearTimeout(timer);
  clearTimeout(soundTimer);
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
  place(card, finder);
  // The shared reading time for its words, and a little longer for something new.
  timer = setTimeout(expire, readingTime(`${name} ${detail}`) + (first ? 1500 : 0));
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
