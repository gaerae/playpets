// The card that shows something new for a few seconds in the lane above the dock: a fish or a bug
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
  if (next) present(next);
}
/** Shows the card in the yard's one lane of messages, above the dock: a drawing (SVG markup), a name,
 * a detail line, whether it is a first, and the album book it is kept in (none for news such as an
 * event starting). Who found it says so in its own bubble. */
export function showCard(svg, name, detail, first, book = null) {
  const next = [svg, name, detail, first, book];
  if (!$('catch-card').hidden) return wait(next);
  // A card held under a panel lets a newer one show if that one is in view, and goes next after it.
  if (held) {
    const card = $('catch-card');
    draw(next);
    if (!landsCovered(card)) {
      waiting.unshift(held);
      held = null;
      clearTimeout(holdTimer);
      return reveal(next);
    }
    return wait(next);
  }
  present(next);
}
function wait(next) {
  waiting.push(next);
  if (waiting.length > WAITING_MAX) waiting.shift();
}
// A card that would land under an open panel or sheet waits for it to close (looking again each
// second); one beside a panel, in the yard still in view, shows at once.
const PANELS = ['side-panel', 'scene-menu', 'play-panel', 'yard-controls-panel'];
function covered(card) {
  const at = card.getBoundingClientRect?.();
  if (!at?.width) return false;
  return PANELS.some(id => {
    const panel = $(id);
    if (!panel || panel.hidden) return false;
    const over = panel.getBoundingClientRect?.();
    return (
      !!over?.width && over.left < at.right && over.right > at.left && over.top < at.bottom && over.bottom > at.top
    );
  });
}
// The card held under a panel (its words, as given to showCard); it looks again each second,
// as the panel may close or the friend walk out from under it.
let held = null,
  holdTimer = 0;
function landsCovered(card) {
  card.hidden = false;
  if (!covered(card)) return false;
  card.hidden = true;
  return true;
}
// The card's words and buttons, drawn again only when it is another card.
let drawn = null;
function draw(args) {
  if (drawn === args) return;
  drawn = args;
  const [svg, name, detail, first, book] = args;
  const card = $('catch-card');
  card.innerHTML = `<div class="catch-specimen">${svg}</div><div class="catch-copy"><strong></strong><small></small>${first ? '<small class="catch-new"></small>' : ''}</div><button class="icon-button catch-dismiss" type="button"><span data-icon="close"></span></button>`;
  const close = card.querySelector('.catch-dismiss');
  // The card's own click (setupCard) puts it away, Close included.
  close.setAttribute('aria-label', t('common.close'));
  icons(card);
  card.querySelector('strong').textContent = name;
  card.querySelector('small').textContent = detail;
  if (first) {
    card.querySelector('.catch-new').textContent = t('catch.new');
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
}
function present(args) {
  clearTimeout(timer);
  clearTimeout(soundTimer);
  clearTimeout(holdTimer);
  draw(args);
  if (landsCovered($('catch-card'))) {
    held = args;
    holdTimer = setTimeout(() => present(args), 1000);
    return;
  }
  held = null;
  reveal(args);
}
// On show: a sound for something new, and the shared reading time for its words, a little longer then.
function reveal([, name, detail, first]) {
  if (first) soundTimer = setTimeout(() => cue('first'), 450);
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
