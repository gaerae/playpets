// The card that shows something new for a few seconds in the lane above the dock: a fish or a bug
// caught, a flower in bloom, a gift that came. Each says what it is, a detail, and whether it is
// new in the album; one kept in the album offers its book, and a new one marks Album and Play. A
// first find pops onto the card, a rare one wears the album's Rare tag in a gold frame, and a fish
// bigger than any of its kind before wears a record tag (play.css).
import { OVER_YARD, onPanelToggle } from '../core/controls.js';
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
/** Whether the album marks a find Rare (album.js `rare`): a fish or a bug that is rare or comes only
 * with an event, a treasure seldom dug up. */
export const rareKind = (book, kind) =>
  book === 'treasure' ? kind?.rarity === 'uncommon' : kind?.rarity === 'rare' || !!kind?.event;
/** The album was opened: Album and Play lose their dot (each book keeps its own, newBooks). */
export function albumSeen() {
  remember('album-new', '');
  syncNew();
}
// The books with a find not looked at yet, the latest last: the album opens at it, and each one's
// tab carries a dot until it is opened. A book that shows only once something is in it (the
// secrets) is noticed that way, at the end of the row.
const NEW_BOOKS = 'album-new-books';
/** The books with something new in them, the latest last. */
export const newBooks = () => (recall(NEW_BOOKS) || '').split(',').filter(Boolean);
function markNew(book) {
  remember(NEW_BOOKS, [...newBooks().filter(id => id !== book), book].join());
  remember('album-new', '1');
  syncNew();
}
/** A book was opened: what is new in it has been seen. */
export function bookSeen(book) {
  const books = newBooks();
  if (books.includes(book)) remember(NEW_BOOKS, books.filter(id => id !== book).join());
}
// Cards that arrive while one is on show wait their turn (a level-up right after the catch that
// earned it), at most a few, the oldest giving way.
const waiting = [];
const WAITING_MAX = 3;
function dismiss() {
  clearTimeout(timer);
  clearTimeout(soundTimer);
  onShow = null;
  $('catch-card').hidden = true;
  const next = waiting.shift();
  if (next) present(next);
}
/** Shows the card in the yard's one lane of messages, above the dock: a drawing (SVG markup), a name,
 * a detail line, whether it is a first (or, for news of another kind, the words saying why), and the
 * album book it is kept in (none for news such as an event starting). Who found it says so in its
 * own bubble. `shown()` is called once when the card goes on show, and never for one that gave way
 * in the queue; it runs at once, perhaps inside a click or a timer, so it must not throw. `marks`
 * says a find is `rare` (rareKind) or a `record` (the biggest of its kind yet), and `keep` that the
 * detail is what the card is about, so a large window keeps it in view. */
export function showCard(svg, name, detail, first, book = null, shown = null, marks = {}) {
  // `heard` is set once the card has been on show (reveal).
  const next = { svg, name, detail, first, book, shown, heard: false, marks };
  // Kept in the album now, even if its card waits behind another and gives way.
  if (first && book) markNew(book);
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
// second); one beside a panel, in the yard still in view, shows at once. An empty yard's first card,
// the friends to pick, counts too: news over it hid Other pets on a first start.
const PANELS = [...OVER_YARD, 'welcome'];
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
// as the panel may close (hold).
let held = null,
  holdTimer = 0;
// The card on show, so a panel opened over it can send it back to wait.
let onShow = null;
function stepAside() {
  const card = $('catch-card');
  if (!onShow || card.hidden || !covered(card)) return;
  const args = onShow;
  clearTimeout(timer);
  clearTimeout(soundTimer);
  onShow = null;
  card.hidden = true;
  hold(args);
}
// Showing the hidden card to measure it lays out the whole yard (15 ms a look in the app), so a
// held card measures again only once a panel opens or closes or the window changes size; in
// between, each second only reads which panels are open.
// A panel counts as open when neither it nor anything around it is hidden (the empty yard's card
// goes with the empty yard).
const open = el => !!el && !el.hidden && !el.parentElement?.closest?.('[hidden]');
const looks = () => `${globalThis.innerWidth}x${globalThis.innerHeight}:${PANELS.map(id => +open($(id))).join('')}`;
let heldLooks = '';
function hold(args) {
  held = args;
  heldLooks = looks();
  holdTimer = setTimeout(() => lookAgain(args), 1000);
}
function lookAgain(args) {
  if (looks() !== heldLooks) return present(args);
  holdTimer = setTimeout(() => lookAgain(args), 1000);
}
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
  const {
    svg,
    name,
    detail,
    first,
    book,
    marks: { rare = false, record = false, keep = false },
  } = args;
  const card = $('catch-card');
  // A new find wears the short New as a paper tag beside its name, its sentence read aloud only;
  // news in its own words keeps them on screen. Rare and a record are tags of their own, read.
  const tags = [
    first === true && '<span class="catch-new-short" aria-hidden="true"></span>',
    rare && '<span class="catch-rare"></span>',
    record && '<span class="catch-record"></span>',
  ].filter(Boolean);
  const title = tags.length ? `<div class="catch-title"><strong></strong>${tags.join('')}</div>` : '<strong></strong>';
  const news =
    first === true ? '<small class="catch-new sr-only"></small>' : first ? '<small class="catch-new"></small>' : '';
  card.classList.toggle('first', first === true);
  card.classList.toggle('rare', rare);
  card.classList.toggle('record', record);
  // Words the caller keeps (a fish's size, a bug's count, a letter's quote) are what the card is
  // about; they stay in view in a large window (shell.css).
  card.classList.toggle('keep-detail', keep);
  card.innerHTML = `<div class="catch-specimen">${svg}</div><div class="catch-copy">${title}<small></small>${news}</div><button class="icon-button catch-dismiss" type="button"><span data-icon="close"></span></button>`;
  const close = card.querySelector('.catch-dismiss');
  // The card's own click (setupCard) puts it away, Close included.
  close.setAttribute('aria-label', t('common.close'));
  icons(card);
  card.querySelector('strong').textContent = name;
  card.querySelector('small').textContent = detail;
  if (first) {
    card.querySelector('.catch-new').textContent = first === true ? t('catch.new') : first;
    if (first === true) card.querySelector('.catch-new-short').textContent = t('catch.new_short');
  }
  if (rare) card.querySelector('.catch-rare').textContent = t('catch.rare');
  if (record) card.querySelector('.catch-record').textContent = t('catch.record');
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
    hold(args);
    return;
  }
  held = null;
  reveal(args);
}
// On show: a sound for something new (the level-up chime for a rare find or a record), and the
// shared reading time for its words, a little longer then.
function reveal(args) {
  const { name, detail, first, shown, heard, marks } = args;
  const sound = marks.rare || marks.record ? 'level' : first ? 'first' : null;
  // A card back from under a panel has been heard once already.
  if (sound && !heard) soundTimer = setTimeout(() => cue(sound), 450);
  args.heard = true;
  onShow = args;
  timer = setTimeout(expire, readingTime(`${name} ${detail}`) + (sound ? 1500 : 0));
  // Each card says so once, however it came to show; last, so the card goes on as usual whatever
  // the caller does.
  args.shown = null;
  shown?.();
}
function expire() {
  if ($('catch-card').matches(':hover, :focus-within')) timer = setTimeout(expire, 1500);
  else dismiss();
}
/** A click puts the card away early. Called once, by app.js, with the album's opener. */
export function setupCard({ openAlbum: open = () => {} } = {}) {
  openAlbum = open;
  $('catch-card').addEventListener('click', dismiss);
  // A card already on show when a panel opens over it (the chat box, Settings) waits too.
  onPanelToggle(PANELS, stepAside);
  syncNew();
}
